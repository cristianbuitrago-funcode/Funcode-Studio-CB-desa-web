// Mantiene viva la conexión con el backend: espera a que arranque, comprueba su
// salud, escucha el flujo de eventos y se reconecta con esperas crecientes.
import type { QueryClient } from "@tanstack/react-query";

import { apiRequest, refreshConnection, setConnection } from "./api/client";
import { getProvider, type ProcessState } from "./api/connection";
import { readSse } from "./api/sse";
import type { Health } from "./api/types";
import { useConnectionStore, type ConnectionStatus } from "@/stores/connection";

export const RETRY_DELAYS_MS = [400, 800, 1500, 3000, 5000];
/** A partir de este número de intentos fallidos se informa «Error» (se sigue reintentando). */
export const ERROR_AFTER_ATTEMPTS = 6;
/** Mientras el proceso del backend está arrancando se espera más antes de informar error. */
const STARTUP_PATIENCE = 30;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });

export function retryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!;
}

export interface ConnectionManager {
  stop: () => void;
  restartBackend: () => Promise<void>;
}

export function startConnectionManager(queryClient: QueryClient): ConnectionManager {
  const controller = new AbortController();
  const { signal } = controller;
  const provider = getProvider();
  const setStatus = (status: ConnectionStatus, detail: string | null = null, attempts?: number) =>
    useConnectionStore.getState().set(status, detail, attempts);

  let processState: ProcessState = { status: "starting", error: null };
  let streamAbort: AbortController | null = null;
  let unlisten: (() => void) | null = null;

  const applyProcessState = (state: ProcessState) => {
    processState = state;
    if (state.status === "closing") {
      streamAbort?.abort();
      setStatus("closing");
    } else if (state.status === "error") {
      streamAbort?.abort();
      setStatus("error", state.error);
    } else if (state.status === "starting") {
      setStatus("starting", null, 0);
    } else if (state.status === "stopped") {
      setStatus("disconnected", "El backend está detenido.");
    }
  };

  const invalidate = () => {
    void queryClient.invalidateQueries();
  };

  async function connectOnce(): Promise<void> {
    const connection = await provider.getConnection();
    processState = { status: connection.status, error: connection.error };
    if (connection.status === "error") throw new Error(connection.error ?? "El backend no pudo iniciarse.");
    if (connection.status !== "running") throw new Error("El backend todavía está iniciando.");
    setConnection({ baseUrl: connection.baseUrl, token: connection.token });
    await apiRequest<Health>("/health", { auth: false, signal });
    // Verifica también que el token es válido antes de declarar la conexión.
    await apiRequest("/api/v1/settings", { signal });
  }

  async function loop(): Promise<void> {
    let attempts = 0;
    let everConnected = false;
    while (!signal.aborted) {
      try {
        await connectOnce();
      } catch (error) {
        if (signal.aborted) return;
        attempts += 1;
        const message = error instanceof Error ? error.message : String(error);
        if (processState.status === "error") setStatus("error", processState.error ?? message, attempts);
        else if (processState.status === "closing") setStatus("closing", null, attempts);
        else if (attempts >= ERROR_AFTER_ATTEMPTS && !(processState.status === "starting" && attempts < STARTUP_PATIENCE))
          setStatus("error", message, attempts);
        else setStatus(everConnected ? "disconnected" : "starting", everConnected ? message : null, attempts);
        await sleep(retryDelay(attempts - 1), signal);
        continue;
      }

      attempts = 0;
      everConnected = true;
      setStatus("connected", null, 0);
      invalidate();

      streamAbort = new AbortController();
      const abortStream = () => streamAbort?.abort();
      signal.addEventListener("abort", abortStream, { once: true });
      let closing = false;
      try {
        const { baseUrl, token } = await refreshConnection();
        await readSse({
          url: `${baseUrl}/api/v1/events/stream`,
          token,
          signal: streamAbort.signal,
          onMessage: (message) => {
            if (message.event === "activity") invalidate();
            else if (message.event === "closing") closing = true;
          },
        });
      } catch {
        // Flujo interrumpido: se trata igual que un cierre y se reconecta.
      } finally {
        signal.removeEventListener("abort", abortStream);
      }
      if (signal.aborted) return;
      if (closing || processState.status === "closing") setStatus("closing");
      else if (useConnectionStore.getState().status === "connected")
        setStatus("disconnected", "Se perdió la conexión con el backend. Reintentando…");
      await sleep(retryDelay(0), signal);
    }
  }

  void provider.onProcessState(applyProcessState).then((stop) => {
    if (signal.aborted) stop();
    else unlisten = stop;
  });
  void loop();

  return {
    stop: () => {
      controller.abort();
      unlisten?.();
      setConnection(null);
    },
    restartBackend: async () => {
      setStatus("closing");
      await provider.restart();
    },
  };
}
