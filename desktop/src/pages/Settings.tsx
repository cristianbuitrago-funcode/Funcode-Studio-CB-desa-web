import { FolderOpen, RefreshCw, RotateCw } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";

import { useConnectionControls } from "@/app/ConnectionContext";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { Badge, Button, Card, DefinitionList, Field, Input, Notice, PageHeader, PhaseTag, Spinner } from "@/components/ui";
import { isolationExplanation } from "@/features/system/IsolationSummary";
import { useAppSettings, useRefreshSystemInfo, useSystemInfo, useUpdateSettings } from "@/features/system/hooks";
import { errorMessage } from "@/lib/api/errors";
import type { ContainerRuntimeStatus } from "@/lib/api/types";
import { cx, formatDateTime } from "@/lib/format";
import { useConnectionStore } from "@/stores/connection";

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-line py-7 first:border-t-0 first:pt-0 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {description ? <p className="mt-1 text-[13px] text-muted">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ProjectsDirectory() {
  const settings = useAppSettings();
  const update = useUpdateSettings();
  const { canPickDirectory, pickDirectory } = useConnectionControls();
  const [value, setValue] = useState("");
  const saved = settings.data?.projects_dir ?? "";
  useEffect(() => setValue(saved), [saved]);
  const dirty = value.trim() !== saved && value.trim() !== "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (dirty) update.mutate({ projects_dir: value.trim() });
  };
  const browse = async () => {
    const selected = await pickDirectory(value || undefined);
    if (selected) setValue(selected);
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field
          label="Directorio de proyectos"
          hint="Directorio propuesto al crear proyectos nuevos. Cambiarlo no mueve los proyectos existentes."
          error={update.isError ? errorMessage(update.error) : null}
        >
          {(props) => (
            <div className="flex gap-2">
              <Input
                {...props}
                spellCheck={false}
                className="font-mono text-[13px]"
                value={value}
                disabled={!settings.data}
                onChange={(event) => {
                  setValue(event.target.value);
                  if (update.isError || update.isSuccess) update.reset();
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
        <div className="flex items-center justify-end gap-3">
          {update.isSuccess && !dirty ? <span role="status" className="text-xs text-ok">Guardado</span> : null}
          <Button type="submit" variant="primary" disabled={!dirty} busy={update.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ThemePreference() {
  const settings = useAppSettings();
  const update = useUpdateSettings();
  const current = settings.data?.theme;
  const options = [
    ["dark", "Oscuro", "Identidad de Funcode Studio CB"],
    ["light", "Claro", "Para entornos muy iluminados"],
  ] as const;
  return (
    <Card className="p-5">
      <fieldset disabled={!current || update.isPending}>
        <legend className="mb-3 text-[13px] font-semibold">Tema de la interfaz</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map(([value, label, hint]) => (
            <label
              key={value}
              className={cx(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                current === value ? "border-blue-2 bg-blue/10" : "border-line hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="theme"
                className="mt-0.5 size-4 accent-[var(--fw-blue)]"
                checked={current === value}
                onChange={() => update.mutate({ theme: value })}
              />
              <span>
                <span className="block text-[13px] font-semibold">{label}</span>
                <span className="block text-xs text-faint">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {update.isError ? <p role="alert" className="mt-3 text-xs text-danger">{errorMessage(update.error)}</p> : null}
      <p className="mt-4 flex items-center justify-between gap-3 text-[13px] text-muted">
        Idioma de la interfaz: español
        <span className="text-xs text-faint">Otros idiomas: pendiente</span>
      </p>
    </Card>
  );
}

function RuntimeRow({ runtime }: { runtime: ContainerRuntimeStatus }) {
  const name = runtime.name === "docker" ? "Docker" : "Podman";
  return (
    <li className="flex items-center justify-between gap-4 px-5 py-3.5">
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{name}</span>
        <span className="block text-xs text-faint">
          {runtime.installed ? (runtime.detail ?? runtime.version ?? "Instalado") : "No se encontró en este computador."}
        </span>
      </span>
      {runtime.available ? (
        <Badge tone="ok">Disponible</Badge>
      ) : runtime.installed ? (
        <Badge tone="gold">Instalado, detenido</Badge>
      ) : (
        <Badge>No instalado</Badge>
      )}
    </li>
  );
}

function Containers() {
  const system = useSystemInfo();
  const refresh = useRefreshSystemInfo();
  if (!system.data) return <Spinner label="Comprobando…" />;
  const { isolation } = system.data;
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <ul className="divide-y divide-line">
          {isolation.runtimes.map((runtime) => (
            <RuntimeRow key={runtime.name} runtime={runtime} />
          ))}
        </ul>
      </Card>
      <Notice tone={isolation.active_runtime ? "blue" : "gold"} title={isolation.active_runtime ? "Aislamiento con contenedores disponible" : "Sin entorno de contenedores"}>
        {isolationExplanation(isolation)}
      </Notice>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-faint">
          Funcode Web Architect solo comprueba si están instalados. Nunca los instala ni los inicia por su cuenta.
        </p>
        <Button icon={<RefreshCw className="size-4" aria-hidden />} busy={refresh.isPending} onClick={() => refresh.mutate()}>
          Volver a comprobar
        </Button>
      </div>
      {refresh.isError ? <p role="alert" className="text-xs text-danger">{errorMessage(refresh.error)}</p> : null}
    </div>
  );
}

const isolationLevels: Array<[level: string, title: string, text: string, phase: string]> = [
  ["1", "Sitios estáticos", "Vista previa controlada. No se ejecuta código de servidor en el computador.", "5"],
  ["2", "Proyectos con backend, con contenedores", "Ejecución en Docker o Podman, sin privilegios, con límites de recursos y acceso solo a la carpeta del proyecto.", "6"],
  ["3", "Proyectos con backend, sin contenedores", "Protección reducida. Nada se ejecuta automáticamente: solo edición y análisis, salvo autorización explícita tuya en cada proyecto.", "6"],
];

function Security() {
  const system = useSystemInfo().data;
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <h3 className="mb-3 text-[13px] font-semibold">Protecciones activas</h3>
        <ul className="flex list-disc flex-col gap-2 pl-4 text-[13px] text-muted">
          <li>El backend solo acepta conexiones desde este computador (127.0.0.1){system ? `, puerto ${system.backend_port}` : ""}. No es visible en la red local ni en Internet.</li>
          <li>Cada sesión usa un token aleatorio nuevo. Sin él, el backend rechaza cualquier petición.</li>
          <li>Se rechazan las peticiones que provengan de páginas web o de otros orígenes.</li>
          <li>Eliminar un proyecto exige escribir su nombre, y sus archivos se respaldan antes de borrarse.</li>
        </ul>
      </Card>
      <Card>
        <h3 className="px-5 pt-5 text-[13px] font-semibold">Niveles de aislamiento de proyectos</h3>
        <ul className="mt-2 divide-y divide-line">
          {isolationLevels.map(([level, title, text, phase]) => (
            <li key={level} className="flex items-start gap-4 px-5 py-3.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-line-strong font-display text-[13px] font-bold text-blue-soft">
                {level}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold">{title}</span>
                <span className="block text-xs text-muted">{text}</span>
              </span>
              <PhaseTag phase={phase} />
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-5 py-3 text-xs text-faint">
          La ejecución de proyectos todavía no está construida; por eso hoy no se ejecuta ningún código generado.
        </p>
      </Card>
      <Card className="flex items-center justify-between gap-4 p-5">
        <span>
          <span className="block text-[13px] font-semibold text-muted">Almacén de claves API</span>
          <span className="block text-xs text-faint">Administrador de credenciales del sistema operativo.</span>
        </span>
        <PhaseTag phase={2} />
      </Card>
    </div>
  );
}

function BackendStatus() {
  const system = useSystemInfo().data;
  const status = useConnectionStore((s) => s.status);
  const { canRestart, restartBackend } = useConnectionControls();
  const [error, setError] = useState<string | null>(null);
  const restart = async () => {
    setError(null);
    try {
      await restartBackend();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <ConnectionIndicator />
        {canRestart ? (
          <Button
            icon={<RotateCw className="size-4" aria-hidden />}
            onClick={restart}
            disabled={status === "starting" || status === "closing"}
          >
            Reiniciar backend
          </Button>
        ) : (
          <span className="max-w-56 text-right text-xs text-faint">
            Reiniciar el backend solo está disponible en la aplicación de escritorio.
          </span>
        )}
      </div>
      {error ? <p role="alert" className="mb-3 text-xs text-danger">{error}</p> : null}
      {system ? (
        <DefinitionList
          items={[
            ["Dirección", <span className="font-mono text-xs">127.0.0.1:{system.backend_port}</span>],
            ["Proceso", <span className="font-mono text-xs">PID {system.backend_pid}</span>],
            ["Iniciado", formatDateTime(system.backend_started_at)],
            ["Modo", system.packaged ? "Empaquetado" : system.dev_mode ? "Desarrollo" : "Código fuente"],
          ]}
        />
      ) : (
        <p className="text-[13px] text-faint">La información aparecerá cuando el backend esté conectado.</p>
      )}
    </Card>
  );
}

function SystemInformation() {
  const system = useSystemInfo().data;
  if (!system) return <Spinner label="Cargando…" />;
  const mono = (value: string) => <span className="font-mono text-xs">{value}</span>;
  return (
    <Card className="p-5">
      <DefinitionList
        items={[
          ["Aplicación", `${system.app_name} ${system.app_version}`],
          ["Sistema operativo", `${system.os_name} ${system.os_release} (${system.architecture})`],
          ["Python del backend", system.python_version],
          ["Git", system.git.available ? (system.git.version ?? "Disponible") : "No instalado: el historial de versiones no estará disponible"],
          ["Datos de la aplicación", mono(system.data_dir)],
          ["Base de datos", mono(system.database_path)],
          ["Registros", mono(system.logs_dir)],
        ]}
      />
    </Card>
  );
}

export function Settings() {
  return (
    <>
      <PageHeader title="Configuración" description="Directorios, preferencias, seguridad y estado del sistema." />
      <Section id="s-dir" title="Directorio de proyectos" description="Dónde se guardan los proyectos que crees.">
        <ProjectsDirectory />
      </Section>
      <Section id="s-ui" title="Preferencias de interfaz">
        <ThemePreference />
      </Section>
      <Section id="s-sec" title="Seguridad" description="Cómo se protege tu computador y tus proyectos.">
        <Security />
      </Section>
      <Section id="s-cont" title="Docker o Podman" description="Recomendados, pero opcionales. Permiten ejecutar proyectos con backend de forma aislada.">
        <Containers />
      </Section>
      <Section id="s-backend" title="Estado del backend" description="El proceso local que guarda los datos y hará el trabajo de generación.">
        <BackendStatus />
      </Section>
      <Section id="s-sys" title="Información del sistema">
        <SystemInformation />
      </Section>
      <Section id="s-ai" title="Proveedores de inteligencia artificial">
        <Card className="flex items-center justify-between gap-4 p-5">
          <span className="text-[13px] text-muted">
            La configuración de proveedores y modelos tiene su propia sección.{" "}
            <Link to="/ai" className="font-semibold text-blue-soft hover:underline">
              Ir a Inteligencia artificial
            </Link>
          </span>
          <PhaseTag phase={2} />
        </Card>
      </Section>
    </>
  );
}
