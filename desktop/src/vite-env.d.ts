/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Solo en modo navegador (desarrollo y pruebas): dirección del backend. */
  readonly VITE_FWA_BACKEND_URL?: string;
  /** Solo en modo navegador (desarrollo y pruebas): token de sesión del backend. */
  readonly VITE_FWA_TOKEN?: string;
}
