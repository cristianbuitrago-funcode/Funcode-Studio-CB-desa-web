import { FolderOpen } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { useConnectionControls } from "@/app/ConnectionContext";
import { Button, Card, Field, Input, Notice, PageHeader, PhaseTag, Textarea } from "@/components/ui";
import { useCreateProject } from "@/features/projects/hooks";
import { useAppSettings } from "@/features/system/hooks";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useIsConnected } from "@/stores/connection";

const NAME_MAX = 120;

const upcoming: Array<[string, number]> = [
  ["Análisis de requisitos y preguntas de aclaración", 2],
  ["Archivos adjuntos y referencias", 2],
  ["Investigación de referencias en la web", 3],
  ["Confirmación del alcance y plan de tareas", 2],
];

export function NewProject() {
  const navigate = useNavigate();
  const connected = useIsConnected();
  const settings = useAppSettings();
  const create = useCreateProject();
  const { canPickDirectory, pickDirectory } = useConnectionControls();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [workspaceTouched, setWorkspaceTouched] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Propone el directorio configurado mientras el usuario no haya escrito otro.
  useEffect(() => {
    if (!workspaceTouched && settings.data) setWorkspace(settings.data.projects_dir);
  }, [settings.data, workspaceTouched]);

  const serverFieldError = (field: string) =>
    create.error instanceof ApiError
      ? (create.error.fieldErrors.find((e) => e.field === field)?.message ?? null)
      : null;
  const workspaceError =
    create.error instanceof ApiError && create.error.code === "unsafe_path" ? create.error.message : null;
  const generalError = create.isError && !workspaceError && !serverFieldError("name");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setNameError("Escribe un nombre para el proyecto.");
      return;
    }
    setNameError(null);
    create.mutate(
      { name, description, workspace_dir: workspace.trim() || null },
      { onSuccess: (project) => navigate(`/projects/${project.id}`) },
    );
  };

  const browse = async () => {
    const selected = await pickDirectory(workspace || undefined);
    if (selected) {
      setWorkspace(selected);
      setWorkspaceTouched(true);
    }
  };

  return (
    <>
      <PageHeader
        title="Nuevo proyecto"
        description="Ponle nombre y describe, con tus palabras, el sitio o la aplicación que quieres construir."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-6">
          <form className="flex flex-col gap-5" onSubmit={submit} noValidate>
            <Field label="Nombre del proyecto" error={nameError ?? serverFieldError("name")}>
              {(props) => (
                <Input
                  {...props}
                  autoFocus
                  maxLength={NAME_MAX}
                  placeholder="Por ejemplo: Tienda de tecnología"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (nameError) setNameError(null);
                  }}
                />
              )}
            </Field>
            <Field
              label="Descripción"
              hint="Opcional por ahora. Se guarda tal como la escribas y será el punto de partida del análisis."
            >
              {(props) => (
                <Textarea
                  {...props}
                  rows={8}
                  placeholder="Quiero crear una tienda virtual de tecnología donde las personas puedan consultar celulares, comparar características, registrarse…"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              )}
            </Field>
            <Field
              label="Directorio de trabajo"
              error={workspaceError}
              hint="Dentro de este directorio se creará una carpeta con el nombre del proyecto."
            >
              {(props) => (
                <div className="flex gap-2">
                  <Input
                    {...props}
                    spellCheck={false}
                    className="font-mono text-[13px]"
                    value={workspace}
                    onChange={(event) => {
                      setWorkspace(event.target.value);
                      setWorkspaceTouched(true);
                    }}
                  />
                  {canPickDirectory ? (
                    <Button className="h-10 shrink-0" icon={<FolderOpen className="size-4" aria-hidden />} onClick={browse}>
                      Examinar…
                    </Button>
                  ) : null}
                </div>
              )}
            </Field>
            {generalError ? <Notice title="No se pudo crear el proyecto">{errorMessage(create.error)}</Notice> : null}
            <div className="flex justify-end gap-2 border-t border-line pt-5">
              <Button variant="ghost" onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" busy={create.isPending} disabled={!connected}>
                Crear proyecto
              </Button>
            </div>
          </form>
        </Card>

        <aside>
          <Card className="p-5">
            <h2 className="text-sm font-semibold">Qué ocurre al crear el proyecto</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 pl-4 text-[13px] text-muted">
              <li>Se crea su carpeta en el directorio de trabajo.</li>
              <li>Se inicia un repositorio Git para guardar el historial, si Git está instalado.</li>
              <li>El proyecto queda guardado como borrador y podrás continuarlo cuando quieras.</li>
            </ul>
            <h2 className="mt-6 text-sm font-semibold">Próximamente en este paso</h2>
            <ul className="mt-3 flex flex-col gap-2.5 text-[13px] text-muted">
              {upcoming.map(([label, phase]) => (
                <li key={label} className="flex items-start justify-between gap-3">
                  <span>{label}</span>
                  <PhaseTag phase={phase} />
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}
