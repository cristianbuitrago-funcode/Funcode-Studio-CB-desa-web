// Lector de Server-Sent Events sobre fetch.
// No se usa EventSource porque no permite enviar la cabecera Authorization,
// y el token nunca debe viajar en la URL.

export interface SseMessage {
  event: string;
  data: string;
}

export interface SseOptions {
  url: string;
  token: string;
  signal: AbortSignal;
  onMessage: (message: SseMessage) => void;
}

/** Analiza bloques SSE completos de un búfer. Devuelve los mensajes y el resto sin procesar. */
export function parseSseChunk(buffer: string): { messages: SseMessage[]; rest: string } {
  const messages: SseMessage[] = [];
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue;
      const separator = line.indexOf(":");
      const field = separator === -1 ? line : line.slice(0, separator);
      const value = separator === -1 ? "" : line.slice(separator + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length || event !== "message") messages.push({ event, data: data.join("\n") });
  }
  return { messages, rest };
}

/** Abre el flujo y lo lee hasta que el servidor lo cierra. Lanza si falla la conexión. */
export async function readSse({ url, token, signal, onMessage }: SseOptions): Promise<void> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
    signal,
    credentials: "omit",
    cache: "no-store",
  });
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo abrir el flujo de eventos (${response.status}).`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer);
    buffer = parsed.rest;
    parsed.messages.forEach(onMessage);
  }
}
