import { Badge } from "@/components/ui";
import type { SystemInfo } from "@/lib/api/types";

const runtimeLabel = { docker: "Docker", podman: "Podman" } as const;

/** Resumen del nivel de aislamiento disponible para proyectos con backend. */
export function IsolationBadge({ isolation }: { isolation: SystemInfo["isolation"] }) {
  return isolation.active_runtime ? (
    <Badge tone="ok">Contenedores · {runtimeLabel[isolation.active_runtime]}</Badge>
  ) : (
    <Badge tone="gold">Sin contenedores</Badge>
  );
}

export function isolationExplanation(isolation: SystemInfo["isolation"]): string {
  if (isolation.active_runtime) {
    return `Los proyectos con backend se ejecutarán en contenedores de ${runtimeLabel[isolation.active_runtime]} (nivel 2).`;
  }
  const installed = isolation.runtimes.filter((r) => r.installed).map((r) => runtimeLabel[r.name]);
  if (installed.length) {
    return `${installed.join(" y ")} está instalado, pero su servicio no responde. Inícialo para ejecutar proyectos con backend de forma aislada.`;
  }
  return "No se detectó Docker ni Podman. Los sitios estáticos funcionan con normalidad; los proyectos con backend no se ejecutarán automáticamente y pedirán tu autorización explícita (nivel 3, protección reducida).";
}
