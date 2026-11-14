import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router";

import { useConnectionStore } from "@/stores/connection";

/** Renderiza una pantalla con enrutador y caché de consultas, con la conexión establecida. */
export function renderPage(ui: ReactElement, { route = "/", path = "/", connected = true } = {}) {
  useConnectionStore.setState({ status: connected ? "connected" : "disconnected", detail: null, attempts: 0 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="/projects/:projectId" element={<p>Detalle del proyecto</p>} />
          <Route path="*" element={<p>Otra página</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
