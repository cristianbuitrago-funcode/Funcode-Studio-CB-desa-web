import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConnectionIndicator } from "./ConnectionIndicator";
import { useConnectionStore, type ConnectionStatus } from "@/stores/connection";

const cases: Array<[ConnectionStatus, string]> = [
  ["starting", "Iniciando"],
  ["connected", "Conectado"],
  ["disconnected", "Desconectado"],
  ["error", "Error"],
  ["closing", "Cerrando"],
];

describe("ConnectionIndicator", () => {
  it.each(cases)("muestra el estado %s como «%s»", (status, label) => {
    useConnectionStore.setState({ status, detail: null });
    render(<ConnectionIndicator />);
    const indicator = screen.getByRole("status");
    expect(indicator).toHaveAttribute("data-status", status);
    expect(indicator).toHaveTextContent(label);
  });

  it("se actualiza cuando cambia el estado y expone el detalle del error", () => {
    useConnectionStore.setState({ status: "connected", detail: null });
    render(<ConnectionIndicator />);
    act(() => useConnectionStore.getState().set("error", "El backend no pudo iniciarse."));
    expect(screen.getByRole("status")).toHaveTextContent("Error");
    expect(screen.getByRole("status")).toHaveAttribute("title", "El backend no pudo iniciarse.");
  });
});
