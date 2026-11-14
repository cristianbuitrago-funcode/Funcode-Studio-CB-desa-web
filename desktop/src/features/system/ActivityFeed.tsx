import { FolderMinus, FolderPlus, Pencil, Settings2, Activity } from "lucide-react";

import { EmptyState, Spinner } from "@/components/ui";
import type { ActivityEvent } from "@/lib/api/types";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useActivity } from "./hooks";

const icons: Record<string, typeof Activity> = {
  "project.created": FolderPlus,
  "project.updated": Pencil,
  "project.deleted": FolderMinus,
  "settings.updated": Settings2,
};

function Item({ event }: { event: ActivityEvent }) {
  const Icon = icons[event.kind] ?? Activity;
  return (
    <li className="flex gap-3 px-5 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-blue-soft" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] break-words text-text">{event.message}</p>
        <time dateTime={event.created_at} title={formatDateTime(event.created_at)} className="text-xs text-faint">
          {formatRelative(event.created_at)}
        </time>
      </div>
    </li>
  );
}

export function ActivityFeed({ projectId, limit = 8 }: { projectId?: string; limit?: number }) {
  const activity = useActivity({ projectId, limit });
  if (activity.isPending) return <div className="px-5"><Spinner label="Cargando actividad…" /></div>;
  if (!activity.data?.length) {
    return (
      <EmptyState title="Sin actividad todavía">
        Aquí aparecerá lo que ocurra en tus proyectos: creación, cambios y, más adelante, generación y pruebas.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line" aria-label="Actividad reciente">
      {activity.data.map((event) => (
        <Item key={event.id} event={event} />
      ))}
    </ul>
  );
}
