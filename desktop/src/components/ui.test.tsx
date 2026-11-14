import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button, Dialog, Input } from "./ui";

function Example({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  return (
    // Se pasa una función nueva en cada render, como hacen las pantallas reales.
    <Dialog open title="Confirmar" onClose={() => onClose()} footer={<Button>Aceptar</Button>}>
      <Input aria-label="Primero" data-autofocus />
      <Input aria-label="Segundo" value={text} onChange={(event) => setText(event.target.value)} />
    </Dialog>
  );
}

describe("Dialog", () => {
  it("enfoca el campo inicial al abrir y no roba el foco al escribir en otro campo", async () => {
    render(<Example onClose={() => {}} />);
    expect(screen.getByLabelText("Primero")).toHaveFocus();
    const second = screen.getByLabelText("Segundo");
    await userEvent.type(second, "hola");
    expect(second).toHaveValue("hola");
    expect(second).toHaveFocus();
  });

  it("se cierra con Escape y mantiene el foco dentro al tabular", async () => {
    const onClose = vi.fn();
    render(<Example onClose={onClose} />);
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Aceptar" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText("Primero")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("es un diálogo modal con título accesible", () => {
    render(<Example onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Confirmar" })).toHaveAttribute("aria-modal", "true");
  });
});
