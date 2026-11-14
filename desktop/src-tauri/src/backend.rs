//! Ciclo de vida del backend local (proceso hijo).
//!
//! - Elige un puerto libre en loopback y genera un token aleatorio por sesión.
//! - Inicia el backend con esos datos en variables de entorno.
//! - Mantiene abierta la entrada estándar del backend: al cerrarla (salida
//!   normal) o al morir este proceso (fallo), el backend se apaga solo. Así no
//!   quedan procesos huérfanos aunque la aplicación termine de forma abrupta.
//! - Vigila el proceso y lo reinicia un número limitado de veces si cae.

use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

pub const STATUS_EVENT: &str = "backend-status";

const SIDECAR_NAME: &str = "fwa-backend";
const MAX_AUTO_RESTARTS: u32 = 3;
const POLL_INTERVAL: Duration = Duration::from_millis(300);
const GRACEFUL_STOP_TIMEOUT: Duration = Duration::from_secs(6);
const STARTUP_TIMEOUT: Duration = Duration::from_secs(45);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BackendStatus {
    Starting,
    Running,
    Closing,
    Stopped,
    Error,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendConnection {
    pub base_url: String,
    pub token: String,
    pub status: BackendStatus,
    pub error: Option<String>,
}

#[derive(Clone, Serialize)]
struct StatusPayload {
    status: BackendStatus,
    error: Option<String>,
}

struct Inner {
    child: Option<Child>,
    // Mantenerla viva es lo que mantiene vivo al backend.
    stdin: Option<ChildStdin>,
    port: u16,
    token: String,
    status: BackendStatus,
    error: Option<String>,
    // Cambia en cada arranque; el hilo vigilante de un arranque anterior se retira.
    generation: u64,
    restarts: u32,
}

pub struct BackendManager {
    inner: Mutex<Inner>,
}

impl BackendManager {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(Inner {
                child: None,
                stdin: None,
                port: 0,
                token: new_token(),
                status: BackendStatus::Stopped,
                error: None,
                generation: 0,
                restarts: 0,
            }),
        }
    }

    pub fn connection(&self) -> BackendConnection {
        let inner = self.inner.lock().unwrap();
        BackendConnection {
            base_url: format!("http://127.0.0.1:{}", inner.port),
            token: inner.token.clone(),
            status: inner.status,
            error: inner.error.clone(),
        }
    }

    /// Inicia el backend (acción del usuario o arranque de la aplicación).
    pub fn start(&self, app: &AppHandle) {
        self.inner.lock().unwrap().restarts = 0;
        self.spawn(app);
    }

    fn spawn(&self, app: &AppHandle) {
        let generation;
        {
            let mut inner = self.inner.lock().unwrap();
            if inner.child.is_some() {
                return; // Ya hay un backend en marcha: nunca dos a la vez.
            }
            inner.generation += 1;
            generation = inner.generation;
            inner.status = BackendStatus::Starting;
            inner.error = None;

            let result = free_port().and_then(|port| {
                inner.port = port;
                spawn_process(app, port, &inner.token)
            });
            match result {
                Ok(mut child) => {
                    inner.stdin = child.stdin.take();
                    inner.child = Some(child);
                }
                Err(message) => {
                    inner.status = BackendStatus::Error;
                    inner.error = Some(message);
                }
            }
        }
        self.emit(app);
        if self.inner.lock().unwrap().child.is_some() {
            let handle = app.clone();
            std::thread::spawn(move || monitor(handle, generation));
        }
    }

    /// Apagado controlado: cierra la entrada estándar y espera; si no termina, lo fuerza.
    pub fn stop(&self, app: &AppHandle) {
        let child = {
            let mut inner = self.inner.lock().unwrap();
            inner.generation += 1; // retira al hilo vigilante
            inner.status = BackendStatus::Closing;
            inner.error = None;
            drop(inner.stdin.take());
            inner.child.take()
        };
        self.emit(app);
        if let Some(mut child) = child {
            let deadline = Instant::now() + GRACEFUL_STOP_TIMEOUT;
            loop {
                match child.try_wait() {
                    Ok(Some(_)) => break,
                    Ok(None) if Instant::now() < deadline => std::thread::sleep(POLL_INTERVAL / 3),
                    _ => {
                        let _ = child.kill();
                        let _ = child.wait();
                        break;
                    }
                }
            }
        }
        self.inner.lock().unwrap().status = BackendStatus::Stopped;
        self.emit(app);
    }

    fn emit(&self, app: &AppHandle) {
        let payload = {
            let inner = self.inner.lock().unwrap();
            StatusPayload { status: inner.status, error: inner.error.clone() }
        };
        let _ = app.emit(STATUS_EVENT, payload);
    }
}

/// Vigila un arranque concreto: detecta cuándo acepta conexiones y si el proceso cae.
fn monitor(app: AppHandle, generation: u64) {
    let manager = app.state::<BackendManager>();
    let started = Instant::now();
    loop {
        std::thread::sleep(POLL_INTERVAL);
        let mut changed = false;
        let mut restart_after: Option<Duration> = None;
        {
            let mut inner = manager.inner.lock().unwrap();
            if inner.generation != generation {
                return;
            }
            let exited = match inner.child.as_mut().map(|c| c.try_wait()) {
                Some(Ok(Some(status))) => Some(status.to_string()),
                Some(Err(error)) => Some(error.to_string()),
                Some(Ok(None)) => None,
                None => return,
            };
            if let Some(reason) = exited {
                inner.child = None;
                inner.stdin = None;
                inner.status = BackendStatus::Error;
                if inner.restarts < MAX_AUTO_RESTARTS {
                    inner.restarts += 1;
                    inner.error = Some(format!(
                        "El backend se detuvo ({reason}). Reintento {} de {MAX_AUTO_RESTARTS}.",
                        inner.restarts
                    ));
                    restart_after = Some(Duration::from_secs(u64::from(inner.restarts)));
                } else {
                    inner.error = Some(format!(
                        "El backend se detuvo ({reason}) y no pudo recuperarse automáticamente."
                    ));
                }
                changed = true;
            } else if inner.status == BackendStatus::Starting {
                if port_open(inner.port) {
                    inner.status = BackendStatus::Running;
                    changed = true;
                } else if started.elapsed() > STARTUP_TIMEOUT {
                    inner.status = BackendStatus::Error;
                    inner.error = Some("El backend no respondió a tiempo al iniciar.".into());
                    changed = true;
                }
            }
        }
        if changed {
            manager.emit(&app);
        }
        if let Some(delay) = restart_after {
            std::thread::sleep(delay);
            if manager.inner.lock().unwrap().generation == generation {
                manager.spawn(&app);
            }
            return;
        }
        if manager.inner.lock().unwrap().child.is_none() {
            return;
        }
    }
}

fn new_token() -> String {
    // Dos UUID v4 del generador criptográfico del sistema: 244 bits aleatorios.
    format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple())
}

fn free_port() -> Result<u16, String> {
    TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .and_then(|listener| listener.local_addr())
        .map(|address| address.port())
        .map_err(|error| format!("No se pudo reservar un puerto local: {error}"))
}

fn port_open(port: u16) -> bool {
    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    TcpStream::connect_timeout(&address, Duration::from_millis(200)).is_ok()
}

fn sidecar_file_name() -> String {
    if cfg!(windows) {
        format!("{SIDECAR_NAME}.exe")
    } else {
        SIDECAR_NAME.to_string()
    }
}

/// Decide cómo ejecutar el backend, por orden de preferencia:
/// 1. `FWA_BACKEND_BIN` (pruebas y diagnóstico).
/// 2. El ejecutable empaquetado junto a la aplicación (versión instalada).
/// 3. En desarrollo: `uv run` sobre el código fuente del backend.
fn backend_command() -> Result<Command, String> {
    if let Some(path) = std::env::var_os("FWA_BACKEND_BIN") {
        return Ok(Command::new(path));
    }
    let bundled: Option<PathBuf> = std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join(sidecar_file_name())))
        .filter(|path| path.is_file());
    if let Some(path) = bundled {
        return Ok(Command::new(path));
    }
    #[cfg(debug_assertions)]
    {
        let backend_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../backend");
        let mut command = Command::new("uv");
        command.arg("run").arg("--project").arg(&backend_dir).arg(SIDECAR_NAME);
        command.env("FWA_DEV", "1");
        return Ok(command);
    }
    #[cfg(not(debug_assertions))]
    Err(format!(
        "No se encontró el backend ({}) junto a la aplicación. Reinstala Funcode Web Architect.",
        sidecar_file_name()
    ))
}

fn spawn_process(_app: &AppHandle, port: u16, token: &str) -> Result<Child, String> {
    let mut command = backend_command()?;
    command
        .env("FWA_PORT", port.to_string())
        .env("FWA_SESSION_TOKEN", token)
        .env("FWA_WATCH_STDIN", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(if cfg!(debug_assertions) { Stdio::inherit() } else { Stdio::null() });
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command.spawn().map_err(|error| format!("No se pudo iniciar el backend: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_is_long_random_and_unique() {
        let (a, b) = (new_token(), new_token());
        assert_eq!(a.len(), 64);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }

    #[test]
    fn free_port_is_on_loopback_and_detectable() {
        let port = free_port().unwrap();
        assert!(port > 0);
        assert!(!port_open(port), "el puerto reservado debe quedar libre");
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, port)).unwrap();
        assert!(port_open(port));
        drop(listener);
    }

    #[test]
    fn status_serializes_in_lowercase() {
        assert_eq!(serde_json::to_string(&BackendStatus::Running).unwrap(), "\"running\"");
        let connection = BackendConnection {
            base_url: "http://127.0.0.1:1".into(),
            token: "t".into(),
            status: BackendStatus::Starting,
            error: None,
        };
        let json = serde_json::to_value(&connection).unwrap();
        assert!(json.get("baseUrl").is_some());
    }
}
