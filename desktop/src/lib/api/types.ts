// Tipos de la API derivados del contrato OpenAPI del backend (schema.d.ts es generado).
import type { components } from "./schema";

type S = components["schemas"];

export type Project = S["ProjectOut"];
export type ProjectDetail = S["ProjectDetailOut"];
export type ProjectStatus = Project["status"];
export type ProjectCreate = S["ProjectCreate"];
export type ProjectUpdate = S["ProjectUpdate"];
export type ProjectDelete = S["ProjectDelete"];
export type ProjectDeleteResult = S["ProjectDeleteResult"];
export type Task = S["TaskOut"];
export type TaskStatus = Task["status"];
export type ActivityEvent = S["EventOut"];
export type AppSettings = S["AppSettings"];
export type AppSettingsUpdate = S["AppSettingsUpdate"];
export type SystemInfo = S["SystemInfo"];
export type ContainerRuntimeStatus = S["ContainerRuntimeStatus"];
export type Health = S["HealthOut"];
