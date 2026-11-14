import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest, setConnection } from "./client";
import { ApiError } from "./errors";

const TOKEN = "token-secreto-0123456789";
const fetchMock = vi.fn();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Espera que la petición falle y devuelve el error. */
const failure = (request: Promise<unknown>): Promise<ApiError> =>
  request.then(
    () => {
      throw new Error("La petición debía fallar.");
    },
    (error: unknown) => error as ApiError,
  );

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  setConnection({ baseUrl: "http://127.0.0.1:9000", token: TOKEN });
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  setConnection(null);
});

describe("apiRequest", () => {
  it("envía el token en la cabecera y nunca en la URL", async () => {
    fetchMock.mockResolvedValue(json([]));
    await apiRequest("/api/v1/projects", { query: { limit: 5, project_id: undefined } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://127.0.0.1:9000/api/v1/projects?limit=5");
    expect(url).not.toContain(TOKEN);
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.credentials).toBe("omit");
  });

  it("no envía el token a rutas públicas", async () => {
    fetchMock.mockResolvedValue(json({ status: "ok" }));
    await apiRequest("/health", { auth: false });
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBeUndefined();
  });

  it("serializa el cuerpo como JSON", async () => {
    fetchMock.mockResolvedValue(json({ id: "1" }, 201));
    await apiRequest("/api/v1/projects", { method: "POST", body: { name: "Demo" } });
    const init = fetchMock.mock.calls[0]![1];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"name":"Demo"}');
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("convierte la respuesta de error del backend en ApiError", async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: "validation_error", message: "Los datos enviados no son válidos.", details: { fields: [{ field: "name", message: "vacío" }] } } }, 422),
    );
    const error = await failure(apiRequest("/api/v1/projects", { method: "POST", body: {} }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("validation_error");
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual([{ field: "name", message: "vacío" }]);
  });

  it("informa un error de red legible cuando el backend no responde", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await failure(apiRequest("/api/v1/projects"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.isNetwork).toBe(true);
    expect(error.message).toBe("No se pudo conectar con el backend local.");
  });

  it("no oculta respuestas de error sin cuerpo JSON", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const error = await failure(apiRequest("/api/v1/projects"));
    expect(error.status).toBe(500);
    expect(error.message).toContain("500");
  });

  it("falla con claridad si todavía no hay conexión", async () => {
    setConnection(null);
    await expect(apiRequest("/api/v1/projects")).rejects.toMatchObject({ code: "network" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
