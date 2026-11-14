// Cliente HTTP del backend local. Añade el token de sesión y normaliza los errores.
import { getProvider, type BackendConnection } from "./connection";
import { ApiError } from "./errors";

let current: BackendConnection | null = null;

export function setConnection(connection: BackendConnection | null): void {
  current = connection;
}

export function getConnectionOrThrow(): BackendConnection {
  if (!current) throw new ApiError("network", "Sin conexión con el backend.");
  return current;
}

export async function refreshConnection(): Promise<BackendConnection> {
  const { baseUrl, token } = await getProvider().getConnection();
  current = { baseUrl, token };
  return current;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOptions["query"]): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const suffix = params.size ? `?${params}` : "";
  return `${baseUrl}${path}${suffix}`;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { baseUrl, token } = getConnectionOrThrow();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.auth !== false) headers["Authorization"] = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(buildUrl(baseUrl, path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError("network", "No se pudo conectar con el backend local.");
  }

  if (response.ok) {
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  let code = "http_error";
  let message = `El backend respondió con un error (${response.status}).`;
  let details: Record<string, unknown> = {};
  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
    };
    if (payload.error) {
      code = payload.error.code ?? code;
      message = payload.error.message ?? message;
      details = payload.error.details ?? {};
    }
  } catch {
    // Respuesta sin cuerpo JSON: se conserva el mensaje genérico.
  }
  throw new ApiError(code, message, response.status, details);
}
