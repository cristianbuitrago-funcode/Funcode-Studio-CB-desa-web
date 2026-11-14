import { ChevronRight, FolderGit2 } from "lucide-react";
import { Link } from "react-router";

import type { Project } from "@/lib/api/types";
import { formatRelative } from "@/lib/format";
import { ProjectStatusBadge } from "./StatusBadge";

export function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <ul className="divide-y divide-line">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            to={`/projects/${project.id}`}
            className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line-strong bg-bg-2 text-blue-soft">
              <FolderGit2 className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-text">{project.name}</span>
              <span className="block truncate text-xs text-faint">
                {project.description || "Sin descripción"}
              </span>
            </span>
            <ProjectStatusBadge status={project.status} />
            <span className="hidden w-28 shrink-0 text-right text-xs text-faint md:block">
              {formatRelative(project.updated_at)}
            </span>
            <ChevronRight className="size-4 shrink-0 text-faint group-hover:text-text" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
