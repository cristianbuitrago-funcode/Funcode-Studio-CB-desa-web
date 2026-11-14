import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AppSettings, AppSettingsUpdate } from "@/lib/api/types";
import { activityService, settingsService, systemService } from "@/services/system";
import { useIsConnected } from "@/stores/connection";

export function useSystemInfo() {
  return useQuery({ queryKey: ["system"], queryFn: () => systemService.info(), enabled: useIsConnected() });
}

export function useRefreshSystemInfo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => systemService.info(true),
    onSuccess: (info) => client.setQueryData(["system"], info),
  });
}

export function useAppSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: settingsService.get, enabled: useIsConnected() });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: AppSettingsUpdate) => settingsService.update(changes),
    // El tema se aplica al instante; si el guardado falla, se restaura el valor anterior.
    onMutate: (changes) => {
      const previous = client.getQueryData<AppSettings>(["settings"]);
      if (previous && changes.theme) client.setQueryData(["settings"], { ...previous, theme: changes.theme });
      return { previous };
    },
    onError: (_error, _changes, context) => {
      if (context?.previous) client.setQueryData(["settings"], context.previous);
    },
    onSuccess: (settings) => {
      client.setQueryData(["settings"], settings);
      void client.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

export function useActivity(options: { limit?: number; projectId?: string } = {}) {
  return useQuery({
    queryKey: ["activity", options.projectId ?? "all", options.limit ?? 20],
    queryFn: () => activityService.recent(options),
    enabled: useIsConnected(),
  });
}
