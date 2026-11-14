import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createHashRouter, Link, RouterProvider, type RouteObject } from "react-router";

import { Notice } from "@/components/ui";
import { ApiError } from "@/lib/api/errors";
import { AiSettings } from "@/pages/AiSettings";
import { Dashboard } from "@/pages/Dashboard";
import { NewProject } from "@/pages/NewProject";
import { ProjectDetail } from "@/pages/ProjectDetail";
import { Projects } from "@/pages/Projects";
import { Settings } from "@/pages/Settings";
import { ConnectionProvider } from "./ConnectionContext";
import { Layout } from "./Layout";

function NotFound() {
  return (
    <Notice tone="gold" title="Esta página no existe">
      <Link to="/" className="font-semibold text-blue-soft hover:underline">
        Volver al inicio
      </Link>
    </Notice>
  );
}

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "projects", element: <Projects /> },
      { path: "projects/new", element: <NewProject /> },
      { path: "projects/:projectId", element: <ProjectDetail /> },
      { path: "ai", element: <AiSettings /> },
      { path: "settings", element: <Settings /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        // Los errores de red los gestiona el gestor de conexión; no se insiste desde aquí.
        retry: (count, error) => !(error instanceof ApiError) && count < 1,
      },
      mutations: { retry: false },
    },
  });
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  // Rutas con «#»: funcionan igual con el protocolo propio de Tauri y en el navegador.
  const [router] = useState(() => createHashRouter(routes));
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider>
        <RouterProvider router={router} />
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
