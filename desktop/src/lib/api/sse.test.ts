import { describe, expect, it } from "vitest";

import { parseSseChunk } from "./sse";

describe("parseSseChunk", () => {
  it("separa mensajes completos y conserva el resto", () => {
    const { messages, rest } = parseSseChunk('event: ready\ndata: {}\n\nevent: activity\ndata: {"id":1}\n\nevent: act');
    expect(messages).toEqual([
      { event: "ready", data: "{}" },
      { event: "activity", data: '{"id":1}' },
    ]);
    expect(rest).toBe("event: act");
  });

  it("ignora los latidos y admite saltos de línea de Windows", () => {
    const { messages } = parseSseChunk(": latido\n\nevent: closing\r\ndata: {}\r\n\r\n");
    expect(messages).toEqual([{ event: "closing", data: "{}" }]);
  });

  it("une varias líneas de datos", () => {
    expect(parseSseChunk("data: a\ndata: b\n\n").messages).toEqual([{ event: "message", data: "a\nb" }]);
  });
});
