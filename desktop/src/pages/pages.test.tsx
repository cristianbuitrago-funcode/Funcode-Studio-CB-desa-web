import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteProjectDialog } from "@/features/projects/DeleteProjectDialog";
import { ApiError } from "@/lib/api/errors";
import type { Project, ProjectDetail } from "@/lib/api/types";
import { renderPage } from "@/test/render";
import { AiSettings } from "./AiSettings";
import { Dashboard } from "./Dashboard";
import { NewProject } from "./NewProject";

const { projects, system, settings, activity } = vi.hoisted(() => ({
  projects: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), tasks: vi.fn() },
  system: { info: vi.fn() },
  settings: { get: vi.fn(), update: vi.fn() },
  activity: { recent: vi.fn() },
}));

vi.mock("@/services/projects", () => ({ projectsService: projects }));
vi.mock("@/services/system", () => ({ systemService: system, settingsService: settings, activityService: activity }));
vi.mock("@/app/ConnectionContext", () => ({
  useConnectionControls: () => ({
    canRestart: false,
    canPickDirectory: false,
    restartBackend: vi.fn(),
    pickDirectory: vi.fn(),
  }),
}));

const project: ProjectDetail = {
  id: "11111111-2222-3333-4444-555555555555",
  name: "Tienda de tecnología",
  slug: "tienda-de-tecnologia",
  description: "Una tienda virtual.",
  directory: "C:\\Proyectos\\tienda-de-tecnologia",
  status: "draft",
  git_initialized: true,
  last_valid_checkpoint: null,
  created_at: "2026-11-14T18:00:00Z",
  updated_at: "2026-11-14T18:00:00Z",
  directory_exists: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  projects.list.mockResolvedValue([]);
  activity.recent.mockResolvedValue([]);
  settings.get.mockResolvedValue({ projects_dir: "C:\\Users\\demo\\Proyectos", theme: "dark" });
  system.info.mockResolvedValue({
    app_version: "0.1.0",
    os_name: "Windows",
    os_release: "11",
    git: { available: true, version: "git version 2.47" },
    isolation: { runtimes: [], active_runtime: null, backend_projects_level: 3 },
  });
});

describe("Dashboard", () => {
  it("muestra la identidad y un estado vacío que invita a crear el primer proyecto", async () => {
    renderPage(<Dashboard />);
    expect(screen.getByRole("heading", { level: 1, name: "Funcode Web Architect" })).toBeInTheDocument();
    expect(screen.getByText("Funcode Studio CB")).toBeInTheDocument();
    expect(await screen.findByText("Crea tu primer proyecto")).toBeInTheDocument();
    expect(await screen.findByText("Sin actividad todavía")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Crear proyecto" }).length).toBeGreaterThan(0);
    expect(await screen.findByText("Sin contenedores")).toBeInTheDocument();
  });

  it("lista los proyectos reales con su estado y cuenta por estado", async () => {
    const list: Project[] = [project, { ...project, id: "b", name: "Blog", status: "in_progress" }];
    projects.list.mockResolvedValue(list);
    renderPage(<Dashboard />);
    expect(await screen.findByRole("link", { name: /Tienda de tecnología/ })).toHaveAttribute(
      "href",
      `/projects/${project.id}`,
    );
    expect(screen.getByRole("link", { name: /Blog/ })).toHaveTextContent("En desarrollo");
    const summary = screen.getByRole("region", { name: "Resumen de proyectos" });
    expect(within(summary).getByText("Proyectos").nextSibling).toHaveTextContent("2");
    expect(screen.queryByText("Crea tu primer proyecto")).not.toBeInTheDocument();
  });

  it("no consulta al backend mientras no hay conexión", async () => {
    renderPage(<Dashboard />, { connected: false });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(projects.list).not.toHaveBeenCalled();
    expect(activity.recent).not.toHaveBeenCalled();
    expect(system.info).not.toHaveBeenCalled();
  });
});

describe("NewProject", () => {
  it("valida que el nombre no esté vacío sin llamar al backend", async () => {
    renderPage(<NewProject />);
    await userEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un nombre para el proyecto.");
    expect(projects.create).not.toHaveBeenCalled();
  });

  it("propone el directorio configurado y crea el proyecto con los datos escritos", async () => {
    projects.create.mockResolvedValue(project);
    renderPage(<NewProject />);
    const workspace = screen.getByLabelText("Directorio de trabajo");
    await waitFor(() => expect(workspace).toHaveValue("C:\\Users\\demo\\Proyectos"));
    await userEvent.type(screen.getByLabelText("Nombre del proyecto"), "Tienda de tecnología");
    await userEvent.type(screen.getByLabelText("Descripción"), "Una tienda virtual.");
    await userEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));
    await waitFor(() =>
      expect(projects.create).toHaveBeenCalledWith({
        name: "Tienda de tecnología",
        description: "Una tienda virtual.",
        workspace_dir: "C:\\Users\\demo\\Proyectos",
      }),
    );
    expect(await screen.findByText("Detalle del proyecto")).toBeInTheDocument();
  });

  it("muestra junto al campo el error de ruta que devuelve el backend", async () => {
    projects.create.mockRejectedValue(
      new ApiError("unsafe_path", "El directorio de trabajo debe ser una ruta absoluta.", 422),
    );
    renderPage(<NewProject />);
    await userEvent.type(screen.getByLabelText("Nombre del proyecto"), "Demo");
    await userEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("debe ser una ruta absoluta");
    expect(screen.getByLabelText("Directorio de trabajo")).toHaveAttribute("aria-invalid", "true");
  });

  it("muestra los errores generales del backend", async () => {
    projects.create.mockRejectedValue(new ApiError("network", "No se pudo conectar con el backend local."));
    renderPage(<NewProject />);
    await userEvent.type(screen.getByLabelText("Nombre del proyecto"), "Demo");
    await userEvent.click(screen.getByRole("button", { name: "Crear proyecto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar con el backend local.");
  });

  it("no permite crear sin conexión con el backend", () => {
    renderPage(<NewProject />, { connected: false });
    expect(screen.getByRole("button", { name: "Crear proyecto" })).toBeDisabled();
  });
});

describe("DeleteProjectDialog", () => {
  it("solo permite eliminar tras escribir el nombre exacto", async () => {
    projects.remove.mockResolvedValue({ id: project.id, files_deleted: false, backup_path: null });
    const onDeleted = vi.fn();
    renderPage(<DeleteProjectDialog project={project} open onClose={() => {}} onDeleted={onDeleted} />);
    const confirm = screen.getByRole("button", { name: "Eliminar proyecto" });
    expect(confirm).toBeDisabled();
    const input = screen.getByLabelText(/para confirmar/);
    await userEvent.type(input, "tienda");
    expect(confirm).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, project.name);
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(projects.remove).toHaveBeenCalledWith(project.id, { confirm_name: project.name, delete_files: false }),
    );
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("conservar los archivos es la opción por defecto y borrar exige marcarlo", async () => {
    projects.remove.mockResolvedValue({ id: project.id, files_deleted: true, backup_path: "x.zip" });
    renderPage(<DeleteProjectDialog project={project} open onClose={() => {}} onDeleted={() => {}} />);
    const checkbox = screen.getByRole("checkbox", { name: /Eliminar también la carpeta/ });
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    await userEvent.type(screen.getByLabelText(/para confirmar/), project.name);
    await userEvent.click(screen.getByRole("button", { name: "Eliminar proyecto" }));
    await waitFor(() =>
      expect(projects.remove).toHaveBeenCalledWith(project.id, { confirm_name: project.name, delete_files: true }),
    );
  });
});

describe("AiSettings", () => {
  it("se presenta como no disponible y no ofrece controles ficticios", () => {
    renderPage(<AiSettings />);
    expect(screen.getByText("Esta sección todavía no está disponible")).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});
