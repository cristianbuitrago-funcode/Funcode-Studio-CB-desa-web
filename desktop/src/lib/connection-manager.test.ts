import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setProvider, type ConnectionProvider, type ProcessState } from "./api/connection";
import { ERROR_AFTER_ATTEMPTS, retryDelay, startConnectionManager, type ConnectionManager } from "./connection-manager";
import { useConnectionStore } from "@/stores/connection";

const fetchMock = vi.fn();
let manager: ConnectionManager | null = null;
let emit: (state: ProcessState) => void = () => {};
let processStatus: ProcessState["status"] = "running";

const provider: ConnectionProvider = {
  managesProcess: true,
  getConnection: async () => ({
    baseUrl: "http://127.0.0.1:9000",
    token: "token-0123456789abcdef",
    status: processStatus,
    error: processStatus === "error" ? "El backend no pudo iniciarse." : null,
  }),
  onProcessState: async (listener) => {
    emit = listener;
    return () => {};
  },
  restart: vi.fn(async () => {}),
  pickDirectory: async () => null,
};

const ok = () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
/** Flujo SSE que permanece abierto hasta que se aborta o se cierra desde la prueba. */
function openStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start: (c) => { controller = c; } });
  return { response: new Response(body, { status: 200 }), close: () => controller.close() };
}

const status = () => useConnectionStore.getState().status;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
  setProvider(provider);
  processStatus = "running";
  useConnectionStore.setState({ status: "starting", detail: null, attempts: 0 });
});
afterEach(() => {
  manager?.stop();
  manager = null;
  setProvider(null);
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("gestor de conexión", () => {
  it("pasa de «iniciando» a «conectado» cuando el backend responde", async () => {
    const stream = openStream();
    fetchMock.mockImplementation(async (url: string) => (url.endsWith("/events/stream") ? stream.response : ok()));
    expect(status()).toBe("starting");
    manager = startConnectionManager(new QueryClient());
    await vi.advanceTimersByTimeAsync(10);
    expect(status()).toBe("connected");
    const urls = fetchMock.mock.calls.map((call) => call[0] as string);
    expect(urls.some((u) => u.endsWith("/health"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/api/v1/events/stream"))).toBe(true);
  });

  it("marca «desconectado» y reintenta cuando se corta el flujo", async () => {
    const first = openStream();
    const second = openStream();
    const streams = [first, second];
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/events/stream") ? streams.shift()!.response : ok(),
    );
    manager = startConnectionManager(new QueryClient());
    await vi.advanceTimersByTimeAsync(10);
    first.close();
    await vi.advanceTimersByTimeAsync(10);
    expect(status()).toBe("disconnected");
    await vi.advanceTimersByTimeAsync(retryDelay(0) + 50);
    expect(status()).toBe("connected");
  });

  it("informa «error» tras varios intentos fallidos y sigue reintentando", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    manager = startConnectionManager(new QueryClient());
    await vi.advanceTimersByTimeAsync(10);
    expect(status()).toBe("starting");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(status()).toBe("error");
    expect(useConnectionStore.getState().attempts).toBeGreaterThanOrEqual(ERROR_AFTER_ATTEMPTS);
    const callsBefore = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    // Y se recupera sola cuando el backend vuelve.
    const stream = openStream();
    fetchMock.mockImplementation(async (url: string) => (url.endsWith("/events/stream") ? stream.response : ok()));
    await vi.advanceTimersByTimeAsync(6_000);
    expect(status()).toBe("connected");
  });

  it("refleja el error del proceso del backend con su mensaje", async () => {
    processStatus = "error";
    manager = startConnectionManager(new QueryClient());
    await vi.advanceTimersByTimeAsync(10);
    expect(status()).toBe("error");
    expect(useConnectionStore.getState().detail).toBe("El backend no pudo iniciarse.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("muestra «cerrando» al reiniciar y vuelve a «iniciando»", async () => {
    const stream = openStream();
    fetchMock.mockImplementation(async (url: string) => (url.endsWith("/events/stream") ? stream.response : ok()));
    manager = startConnectionManager(new QueryClient());
    await vi.advanceTimersByTimeAsync(10);
    await manager.restartBackend();
    expect(status()).toBe("closing");
    expect(provider.restart).toHaveBeenCalledOnce();
    emit({ status: "starting", error: null });
    expect(status()).toBe("starting");
  });

  it("las esperas de reintento crecen hasta un máximo", () => {
    expect(retryDelay(0)).toBeLessThan(retryDelay(3));
    expect(retryDelay(50)).toBe(retryDelay(4));
  });
});
