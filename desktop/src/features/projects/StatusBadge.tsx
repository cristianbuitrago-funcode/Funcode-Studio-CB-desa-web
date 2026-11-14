import { Badge } from "@/components/ui";
import { t } from "@/i18n/es";
import type { ProjectStatus, TaskStatus } from "@/lib/api/types";

const projectTone = {
  draft: "neutral",
  in_progress: "blue",
  completed: "ok",
  failed: "danger",
  archived: "neutral",
} as const satisfies Record<ProjectStatus, string>;

const taskTone = {
  pending: "neutral",
  running: "blue",
  completed: "ok",
  failed: "danger",
  cancelled: "neutral",
  interrupted: "gold",
  waiting_user: "gold",
} as const satisfies Record<TaskStatus, string>;

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={projectTone[status]}>{t.projectStatus[status]}</Badge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={taskTone[status]}>{t.taskStatus[status]}</Badge>;
}
