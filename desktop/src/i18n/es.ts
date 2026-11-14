// Textos de la interfaz. Centralizados para poder añadir otros idiomas más adelante.
import type { ConnectionStatus } from "@/stores/connection";
import type { ProjectStatus, TaskStatus } from "@/lib/api/types";

export const es = {
  app: { name: "Funcode Web Architect", studio: "Funcode Studio CB", tagline: "Aprende · Crea · Innova" },
  nav: {
    dashboard: "Inicio",
    projects: "Proyectos",
    newProject: "Nuevo proyecto",
    ai: "Inteligencia artificial",
    settings: "Configuración",
  },
  connection: {
    label: "Backend local",
    status: {
      starting: "Iniciando",
      connected: "Conectado",
      disconnected: "Desconectado",
      error: "Error",
      closing: "Cerrando",
    } satisfies Record<ConnectionStatus, string>,
    description: {
      starting: "El backend local está arrancando.",
      connected: "La interfaz está conectada al backend local.",
      disconnected: "Se perdió la conexión. Reintentando automáticamente.",
      error: "No se puede conectar con el backend local.",
      closing: "El backend se está deteniendo.",
    } satisfies Record<ConnectionStatus, string>,
    unavailableTitle: "Sin conexión con el backend",
    unavailableBody:
      "Los datos se mostrarán en cuanto se restablezca la conexión. No se ha perdido información: todo está guardado en tu computador.",
  },
  projectStatus: {
    draft: "Borrador",
    in_progress: "En desarrollo",
    completed: "Terminado",
    failed: "Con errores",
    archived: "Archivado",
  } satisfies Record<ProjectStatus, string>,
  taskStatus: {
    pending: "Pendiente",
    running: "En ejecución",
    completed: "Completada",
    failed: "Fallida",
    cancelled: "Cancelada",
    interrupted: "Interrumpida",
    waiting_user: "Esperando al usuario",
  } satisfies Record<TaskStatus, string>,
  common: {
    loading: "Cargando…",
    retry: "Reintentar",
    cancel: "Cancelar",
    save: "Guardar",
    saving: "Guardando…",
    saved: "Guardado",
    close: "Cerrar",
    copy: "Copiar",
    copied: "Copiado",
    browse: "Examinar…",
    back: "Volver",
    phase: (n: number | string) => `Disponible en la fase ${n}`,
    pending: "Pendiente",
    yes: "Sí",
    no: "No",
  },
} as const;

export const t = es;
