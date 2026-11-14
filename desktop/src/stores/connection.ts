import { create } from "zustand";

/** Estado de la conexión entre la interfaz y el backend, tal como lo ve el usuario. */
export type ConnectionStatus = "starting" | "connected" | "disconnected" | "error" | "closing";

interface ConnectionState {
  status: ConnectionStatus;
  detail: string | null;
  /** Número de intentos de reconexión desde la última conexión correcta. */
  attempts: number;
  set: (status: ConnectionStatus, detail?: string | null, attempts?: number) => void;
}

// A propósito, el token NO forma parte de este estado.
export const useConnectionStore = create<ConnectionState>((set) => ({
  status: "starting",
  detail: null,
  attempts: 0,
  set: (status, detail = null, attempts) =>
    set((state) => ({ status, detail, attempts: attempts ?? state.attempts })),
}));

export const useIsConnected = (): boolean => useConnectionStore((s) => s.status === "connected");
