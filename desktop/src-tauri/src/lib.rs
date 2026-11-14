//! Núcleo de escritorio de Funcode Web Architect.
//!
//! Responsabilidades: abrir la ventana, iniciar y vigilar el backend local,
//! entregar a la interfaz los datos de conexión y detener el backend al salir.
//! No contiene lógica de negocio.

mod backend;

use backend::{BackendConnection, BackendManager};
use tauri::{Manager, RunEvent};

#[tauri::command]
fn backend_connection(manager: tauri::State<'_, BackendManager>) -> BackendConnection {
    manager.connection()
}

#[tauri::command]
fn restart_backend(app: tauri::AppHandle) {
    // En un hilo aparte: detener puede tardar unos segundos y no debe bloquear la interfaz.
    std::thread::spawn(move || {
        let manager = app.state::<BackendManager>();
        manager.stop(&app);
        manager.start(&app);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        // Una sola instancia de la aplicación: la segunda enfoca la ventana existente.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .manage(BackendManager::new())
        .invoke_handler(tauri::generate_handler![backend_connection, restart_backend])
        .setup(|app| {
            let handle = app.handle().clone();
            handle.state::<BackendManager>().start(&handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar Funcode Web Architect");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            handle.state::<BackendManager>().stop(handle);
        }
    });
}
