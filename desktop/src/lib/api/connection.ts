// Origen de los datos de conexión con el backend.
//
// En la aplicación de escritorio los entrega el núcleo de Tauri, que es quien
// inicia el backend y genera el token de la sesión. En un navegador (desarrollo
// y pruebas automáticas) se leen de variables de entorno de Vite.
//
// El token vive solo en memoria: nunca se guarda en localStorage ni en el estado
// global visible de la interfaz.

export type ProcessStatus = "starting" | "running" | "closing" | "stopped" | "error";

export interface BackendConnection {
  baseUrl: string;
  token: string;
}

export interface ProcessState {
  status: ProcessStatus;
  error: string | null;
}

export interface ConnectionProvider {
  /** Verdadero si la aplicación controla el proceso del backend (escritorio). */
  readonly managesProcess: boolean;
  getConnection(): Promise<BackendConnection & ProcessState>;
  /** Avisa de cambios de estado del proceso. Devuelve la función para dejar de escuchar. */
  onProcessState(listener: (state: ProcessState) => void): Promise<() => void>;
  restart(): Promise<void>;
  /** Abre el diálogo nativo para elegir carpeta; `null` si no está disponible o se cancela. */
  pickDirectory(initial?: string): Promise<string | null>;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const tauriProvider: ConnectionProvider = {
  managesProcess: true,
  async getConnection() {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<BackendConnection & ProcessState>("backend_connection");
  },
  async onProcessState(listener) {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<ProcessState>("backend-status", (event) => listener(event.payload));
  },
  async restart() {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("restart_backend");
  },
  async pickDirectory(initial) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false, defaultPath: initial });
    return typeof selected === "string" ? selected : null;
  },
};

const browserProvider: ConnectionProvider = {
  managesProcess: false,
  async getConnection() {
    const baseUrl = import.meta.env.VITE_FWA_BACKEND_URL as string | undefined;
    const token = import.meta.env.VITE_FWA_TOKEN as string | undefined;
    if (!baseUrl || !token) {
      return {
        baseUrl: "",
        token: "",
        status: "error",
        error:
          "Modo navegador sin configurar: define VITE_FWA_BACKEND_URL y VITE_FWA_TOKEN e inicia el backend.",
      };
    }
    return { baseUrl: baseUrl.replace(/\/$/, ""), token, status: "running", error: null };
  },
  async onProcessState() {
    return () => {};
  },
  async restart() {
    throw new Error("Reiniciar el backend solo está disponible en la aplicación de escritorio.");
  },
  async pickDirectory() {
    return null;
  },
};

let provider: ConnectionProvider | null = null;

export function getProvider(): ConnectionProvider {
  provider ??= isTauri() ? tauriProvider : browserProvider;
  return provider;
}

/** Solo para pruebas. */
export function setProvider(next: ConnectionProvider | null): void {
  provider = next;
}
