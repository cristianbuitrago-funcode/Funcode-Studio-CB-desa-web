import { apiRequest } from "@/lib/api/client";
import type {
  Project,
  ProjectCreate,
  ProjectDelete,
  ProjectDeleteResult,
  ProjectDetail,
  ProjectUpdate,
  Task,
} from "@/lib/api/types";

export const projectsService = {
  list: () => apiRequest<Project[]>("/api/v1/projects"),
  get: (id: string) => apiRequest<ProjectDetail>(`/api/v1/projects/${encodeURIComponent(id)}`),
  create: (data: ProjectCreate) =>
    apiRequest<ProjectDetail>("/api/v1/projects", { method: "POST", body: data }),
  update: (id: string, data: ProjectUpdate) =>
    apiRequest<ProjectDetail>(`/api/v1/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: data }),
  remove: (id: string, data: ProjectDelete) =>
    apiRequest<ProjectDeleteResult>(`/api/v1/projects/${encodeURIComponent(id)}/delete`, {
      method: "POST",
      body: data,
    }),
  tasks: (id: string) => apiRequest<Task[]>(`/api/v1/projects/${encodeURIComponent(id)}/tasks`),
};
