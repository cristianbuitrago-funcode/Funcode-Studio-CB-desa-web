import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ProjectCreate, ProjectDelete, ProjectUpdate } from "@/lib/api/types";
import { projectsService } from "@/services/projects";
import { useIsConnected } from "@/stores/connection";

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => ["projects", id] as const,
  tasks: (id: string) => ["projects", id, "tasks"] as const,
};

export function useProjects() {
  return useQuery({ queryKey: projectKeys.all, queryFn: projectsService.list, enabled: useIsConnected() });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsService.get(id),
    enabled: useIsConnected(),
  });
}

export function useProjectTasks(id: string) {
  return useQuery({
    queryKey: projectKeys.tasks(id),
    queryFn: () => projectsService.tasks(id),
    enabled: useIsConnected(),
  });
}

function useInvalidate() {
  const client = useQueryClient();
  return () => Promise.all([
    client.invalidateQueries({ queryKey: projectKeys.all }),
    client.invalidateQueries({ queryKey: ["activity"] }),
  ]);
}

export function useCreateProject() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (data: ProjectCreate) => projectsService.create(data), onSuccess: invalidate });
}

export function useUpdateProject(id: string) {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: (data: ProjectUpdate) => projectsService.update(id, data), onSuccess: invalidate });
}

export function useDeleteProject(id: string) {
  const client = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: ProjectDelete) => projectsService.remove(id, data),
    onSuccess: async () => {
      client.removeQueries({ queryKey: projectKeys.detail(id) });
      await invalidate();
    },
  });
}
