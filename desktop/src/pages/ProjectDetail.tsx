import { ArrowLeft, Check, Copy, Pencil, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";

import {
  Button,
  Card,
  DefinitionList,
  Dialog,
  EmptyState,
  Field,
  Input,
  Notice,
  PageHeader,
  PhaseTag,
  SectionTitle,
  Spinner,
  Textarea,
} from "@/components/ui";
import { DeleteProjectDialog } from "@/features/projects/DeleteProjectDialog";
import { ProjectStatusBadge, TaskStatusBadge } from "@/features/projects/StatusBadge";
import { useProject, useProjectTasks, useUpdateProject } from "@/features/projects/hooks";
import { ActivityFeed } from "@/features/system/ActivityFeed";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { ProjectDetail as Project } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

const workspaceAreas: Array<[string, string, string]> = [
  ["Especificación y plan de tareas", "El analizador convertirá la descripción en requisitos y tareas.", "2"],
  ["Explorador de archivos y editor de código", "Edición del código generado dentro de la aplicación.", "8"],
  ["Vista previa responsive", "Computador, tablet y móvil, en un entorno aislado.", "5 y 8"],
  ["Pruebas y reparación automática", "Verificación del proyecto y corrección de errores.", "9"],
  ["Exportación", "Proyecto independiente con documentación y archivo ZIP.", "5 y 10"],
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="ml-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-blue-soft hover:bg-surface-2"
    >
      {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

function EditDialog({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const update = useUpdateProject(project.id);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate({ name, description }, { onSuccess: onClose });
  };
  return (
    <Dialog
      open={open}
      title="Editar proyecto"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="edit-project" busy={update.isPending} disabled={!name.trim()}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <form id="edit-project" className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Nombre" hint="Cambiar el nombre no mueve ni renombra la carpeta del proyecto.">
          {(props) => <Input {...props} data-autofocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Descripción">
          {(props) => <Textarea {...props} rows={7} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        {update.isError ? <Notice title="No se pudo guardar">{errorMessage(update.error)}</Notice> : null}
      </form>
    </Dialog>
  );
}

function Tasks({ projectId }: { projectId: string }) {
  const tasks = useProjectTasks(projectId);
  if (tasks.isPending) return <div className="px-5"><Spinner label="Cargando tareas…" /></div>;
  if (!tasks.data?.length) {
    return (
      <EmptyState title="Aún no hay tareas">
        Cuando el orquestador planifique el trabajo, aquí verás cada tarea con su estado: pendiente, en ejecución,
        completada, fallida, cancelada o interrumpida. El estado se guarda en disco y se recupera al volver a abrir
        la aplicación.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line">
      {tasks.data.map((task) => (
        <li key={task.id} className="flex items-center gap-3 px-5 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{task.title}</span>
            {task.error ? <span className="block text-xs text-danger">{task.error}</span> : null}
          </span>
          <TaskStatusBadge status={task.status} />
        </li>
      ))}
    </ul>
  );
}

export function ProjectDetail() {
  const { projectId = "" } = useParams();
  const navigate = useNavigate();
  const project = useProject(projectId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const back = (
    <Link to="/projects" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text">
      <ArrowLeft className="size-3.5" aria-hidden />
      Proyectos
    </Link>
  );

  if (project.isError) {
    const notFound = project.error instanceof ApiError && project.error.status === 404;
    return (
      <>
        <div className="mb-4">{back}</div>
        <Notice
          title={notFound ? "Este proyecto no existe" : "No se pudo cargar el proyecto"}
          action={notFound ? null : <Button onClick={() => project.refetch()}>Reintentar</Button>}
        >
          {notFound ? "Puede que se haya eliminado." : errorMessage(project.error)}
        </Notice>
      </>
    );
  }
  if (!project.data) return <Spinner label="Cargando proyecto…" />;
  const data = project.data;

  return (
    <>
      <PageHeader
        eyebrow={back}
        title={data.name}
        description={<ProjectStatusBadge status={data.status} />}
        actions={
          <>
            <Button icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDeleting(true)}>
              Eliminar
            </Button>
          </>
        }
      />

      {data.directory_exists ? null : (
        <div className="mb-6">
          <Notice tone="gold" title="No se encuentra la carpeta del proyecto">
            La carpeta <code className="font-mono">{data.directory}</code> fue movida o eliminada fuera de la
            aplicación. El registro del proyecto se conserva.
          </Notice>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section>
            <SectionTitle>Descripción original</SectionTitle>
            <Card className="p-5">
              {data.description ? (
                <p className="text-sm whitespace-pre-wrap text-text">{data.description}</p>
              ) : (
                <p className="text-[13px] text-faint">
                  Este proyecto todavía no tiene descripción. Añádela con «Editar»: será el punto de partida del
                  análisis.
                </p>
              )}
            </Card>
          </section>
          <section>
            <SectionTitle>Tareas</SectionTitle>
            <Card className="overflow-hidden">
              <Tasks projectId={data.id} />
            </Card>
          </section>
          <section>
            <SectionTitle>Entorno de desarrollo</SectionTitle>
            <Card>
              <ul className="divide-y divide-line">
                {workspaceAreas.map(([title, text, phase]) => (
                  <li key={title} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-muted">{title}</span>
                      <span className="block text-xs text-faint">{text}</span>
                    </span>
                    <PhaseTag phase={phase} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section>
            <SectionTitle>Información</SectionTitle>
            <Card className="p-5">
              <DefinitionList
                items={[
                  ["Identificador", <span className="font-mono text-xs">{data.id}</span>],
                  [
                    "Carpeta",
                    <>
                      <span className="font-mono text-xs">{data.directory}</span>
                      <CopyButton value={data.directory} />
                    </>,
                  ],
                  ["Historial Git", data.git_initialized ? "Iniciado" : "No disponible (Git no instalado)"],
                  ["Creado", formatDateTime(data.created_at)],
                  ["Último cambio", formatDateTime(data.updated_at)],
                ]}
              />
            </Card>
          </section>
          <section>
            <SectionTitle>Actividad del proyecto</SectionTitle>
            <Card className="overflow-hidden">
              <ActivityFeed projectId={data.id} limit={6} />
            </Card>
          </section>
        </aside>
      </div>

      {editing ? <EditDialog project={data} open onClose={() => setEditing(false)} /> : null}
      <DeleteProjectDialog
        project={data}
        open={deleting}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate("/projects", { replace: true })}
      />
    </>
  );
}
