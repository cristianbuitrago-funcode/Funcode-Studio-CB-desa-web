import { ArrowRight, Bot, FolderPlus, Plus, Settings, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router";

import logo from "@/assets/brand/emblema-192.png";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { Button, Card, DefinitionList, EmptyState, SectionTitle, Spinner } from "@/components/ui";
import { ProjectList } from "@/features/projects/ProjectList";
import { useProjects } from "@/features/projects/hooks";
import { ActivityFeed } from "@/features/system/ActivityFeed";
import { IsolationBadge } from "@/features/system/IsolationSummary";
import { useSystemInfo } from "@/features/system/hooks";
import { t } from "@/i18n/es";
import type { Project } from "@/lib/api/types";

const RECENT = 6;

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value ?? "—"}</p>
    </Card>
  );
}

function count(projects: Project[] | undefined, ...statuses: Project["status"][]) {
  return projects?.filter((p) => statuses.includes(p.status)).length;
}

function SystemPanel() {
  const system = useSystemInfo().data;
  return (
    <Card className="p-5">
      <SectionTitle
        action={
          <Link to="/settings" className="text-xs font-semibold text-blue-soft hover:underline">
            Ver detalles
          </Link>
        }
      >
        Estado del sistema
      </SectionTitle>
      <DefinitionList
        items={[
          ["Backend", <ConnectionIndicator compact />],
          ["Aislamiento", system ? <IsolationBadge isolation={system.isolation} /> : "—"],
          ["Git", system ? (system.git.available ? "Disponible" : "No instalado") : "—"],
          ["Sistema", system ? `${system.os_name} ${system.os_release}` : "—"],
        ]}
      />
    </Card>
  );
}

function Shortcut({ to, icon, title, children }: { to: string; icon: React.ReactNode; title: string; children: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-bg-2 text-blue-soft">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-text">{title}</span>
        <span className="block text-xs text-faint">{children}</span>
      </span>
      <ArrowRight className="size-4 text-faint group-hover:text-text" aria-hidden />
    </Link>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const projects = useProjects();
  const list = projects.data;

  return (
    <>
      <header className="mb-7 flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-line bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_srgb,var(--fw-blue)_22%,transparent),transparent_60%)] bg-surface p-7">
        <div className="flex min-w-0 items-center gap-5">
          <img src={logo} alt="Emblema de Funcode Studio CB" className="size-16 rounded-2xl border border-line-strong" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-gold uppercase">{t.app.studio}</p>
            <h1 className="text-[30px] font-bold">{t.app.name}</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Describe lo que necesitas y construye sitios y aplicaciones web reales, en tu computador.
            </p>
          </div>
        </div>
        <Button variant="primary" className="h-11 px-5 text-sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => navigate("/projects/new")}>
          Crear proyecto
        </Button>
      </header>

      <section aria-label="Resumen de proyectos" className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Proyectos" value={list?.length} />
        <Stat label="Borradores" value={count(list, "draft")} />
        <Stat label="En desarrollo" value={count(list, "in_progress")} />
        <Stat label="Terminados" value={count(list, "completed")} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section>
            <SectionTitle
              action={
                list && list.length > RECENT ? (
                  <Link to="/projects" className="text-xs font-semibold text-blue-soft hover:underline">
                    Ver todos ({list.length})
                  </Link>
                ) : null
              }
            >
              Proyectos recientes
            </SectionTitle>
            <Card className="overflow-hidden">
              {projects.isPending ? (
                <div className="px-5"><Spinner label={t.common.loading} /></div>
              ) : list?.length ? (
                <ProjectList projects={list.slice(0, RECENT)} />
              ) : (
                <EmptyState
                  icon={<Sparkles className="size-5" aria-hidden />}
                  title="Crea tu primer proyecto"
                  action={
                    <Button variant="primary" icon={<FolderPlus className="size-4" aria-hidden />} onClick={() => navigate("/projects/new")}>
                      Crear proyecto
                    </Button>
                  }
                >
                  Todavía no hay proyectos. Empieza poniéndole nombre y describiendo, con tus palabras, el sitio o la
                  aplicación que quieres construir.
                </EmptyState>
              )}
            </Card>
          </section>
          <section>
            <SectionTitle>Actividad reciente</SectionTitle>
            <Card className="overflow-hidden">
              <ActivityFeed />
            </Card>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <SystemPanel />
          <Shortcut to="/ai" icon={<Bot className="size-4" aria-hidden />} title="Proveedores de IA">
            Modelos locales y externos
          </Shortcut>
          <Shortcut to="/settings" icon={<Settings className="size-4" aria-hidden />} title="Configuración">
            Directorios, interfaz y seguridad
          </Shortcut>
        </aside>
      </div>
    </>
  );
}
