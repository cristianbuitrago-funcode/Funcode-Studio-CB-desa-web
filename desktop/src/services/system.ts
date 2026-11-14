import { apiRequest } from "@/lib/api/client";
import type { ActivityEvent, AppSettings, AppSettingsUpdate, SystemInfo } from "@/lib/api/types";

export const systemService = {
  info: (refresh = false) => apiRequest<SystemInfo>("/api/v1/system/info", { query: { refresh } }),
};

export const settingsService = {
  get: () => apiRequest<AppSettings>("/api/v1/settings"),
  update: (changes: AppSettingsUpdate) =>
    apiRequest<AppSettings>("/api/v1/settings", { method: "PATCH", body: changes }),
};

export const activityService = {
  recent: (options: { limit?: number; projectId?: string } = {}) =>
    apiRequest<ActivityEvent[]>("/api/v1/activity", {
      query: { limit: options.limit ?? 20, project_id: options.projectId },
    }),
};
