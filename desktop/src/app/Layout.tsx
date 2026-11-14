import { Bot, FolderKanban, LayoutDashboard, Plus, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router";

import emblem from "@/assets/brand/emblema-192.png";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { Notice } from "@/components/ui";
import { t } from "@/i18n/es";
import { cx } from "@/lib/format";
import { useConnectionStore } from "@/stores/connection";
import { useSystemInfo } from "@/features/system/hooks";
import { useThemeSync } from "./theme";

const links = [
  { to: "/", label: t.nav.dashboard, icon: LayoutDashboard, end: true },
  { to: "/projects", label: t.nav.projects, icon: FolderKanban, end: false },
  { to: "/ai", label: t.nav.ai, icon: Bot, end: false },
  { to: "/settings", label: t.nav.settings, icon: Settings, end: false },
];

function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status);
  const detail = useConnectionStore((s) => s.detail);
  if (status === "connected" || status === "starting") return null;
  return (
    <div className="mb-6">
      <Notice
        tone={status === "error" ? "danger" : "gold"}
        title={status === "closing" ? t.connection.description.closing : t.connection.unavailableTitle}
      >
        {detail ? <p className="mb-1">{detail}</p> : null}
        {status === "closing" ? null : <p>{t.connection.unavailableBody}</p>}
      </Notice>
    </div>
  );
}

export function Layout() {
  useThemeSync();
  const version = useSystemInfo().data?.app_version;
  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-bg-2">
        <div className="flex items-center gap-3 px-5 pt-5 pb-4">
          <img src={emblem} alt="" className="size-10 rounded-xl border border-line-strong" />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[15px] font-bold text-text">Web Architect</p>
            <p className="text-[11px] text-faint">{t.app.studio}</p>
          </div>
        </div>
        <div className="px-3 pb-3">
          <NavLink
            to="/projects/new"
            className="flex h-9 items-center justify-center gap-2 rounded-lg bg-blue text-[13px] font-semibold text-on-accent transition-colors hover:bg-blue-2"
          >
            <Plus className="size-4" aria-hidden />
            {t.nav.newProject}
          </NavLink>
        </div>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-0.5 px-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx(
                  "flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors",
                  isActive ? "bg-surface-2 text-text" : "text-muted hover:bg-surface hover:text-text",
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-5 py-4">
          <ConnectionIndicator primary />
          {version ? <p className="mt-2 text-[11px] text-faint">Versión {version}</p> : null}
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <ConnectionBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
