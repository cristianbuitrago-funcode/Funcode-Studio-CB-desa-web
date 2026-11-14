import { Cloud, Cpu, KeyRound, Route } from "lucide-react";

import { Card, Notice, PageHeader, PhaseTag, SectionTitle } from "@/components/ui";

const adapters: Array<[name: string, covers: string, key: string]> = [
  ["Ollama", "Modelos instalados en tu computador", "No requiere clave"],
  ["Compatible con OpenAI", "OpenAI, OpenRouter, Groq, LM Studio y otros servicios con la misma API", "Depende del servicio"],
  ["Anthropic", "Modelos Claude", "Requiere clave API"],
  ["Google", "Modelos Gemini", "Requiere clave API"],
];

const tasks = [
  "Análisis de instrucciones",
  "Investigación",
  "Diseño y planificación",
  "Programación frontend",
  "Programación backend",
  "Diseño de bases de datos",
  "Revisión de código",
  "Corrección de errores",
  "Generación de contenido",
  "Generación de imágenes",
];

const principles: Array<[icon: typeof Cpu, title: string, text: string]> = [
  [Cpu, "IA local", "Modelos que se ejecutan en tu computador. Sin clave ni conexión; la calidad depende del equipo y del modelo."],
  [Cloud, "IA conectada", "Proveedores externos mediante su API. Requieren clave y, normalmente, un pago al proveedor."],
  [Route, "Un modelo por tarea", "Podrás asignar un modelo distinto a cada tarea y definir modelos de respaldo. Solo se asignará un modelo que tenga las capacidades que la tarea necesita."],
  [KeyRound, "Claves protegidas", "Se guardarán en el Administrador de credenciales de Windows, nunca en la base de datos, en archivos ni en los proyectos."],
];

export function AiSettings() {
  return (
    <>
      <PageHeader
        title="Inteligencia artificial"
        description="Proveedores, modelos y claves que usará Funcode Web Architect para analizar, diseñar y programar."
      />
      <div className="mb-6">
        <Notice tone="blue" title="Esta sección todavía no está disponible">
          La configuración de proveedores se construye en la fase 2. Por ahora no se puede añadir ningún proveedor ni
          guardar claves, y la aplicación no realiza ninguna llamada a servicios de inteligencia artificial.
        </Notice>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Cómo funcionará</SectionTitle>
          <Card>
            <ul className="divide-y divide-line">
              {principles.map(([Icon, title, text]) => (
                <li key={title} className="flex gap-3.5 px-5 py-4">
                  <Icon className="mt-0.5 size-4 shrink-0 text-blue-soft" aria-hidden />
                  <span>
                    <span className="block text-[13px] font-semibold">{title}</span>
                    <span className="block text-[13px] text-muted">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <div className="flex flex-col gap-6">
          <section>
            <SectionTitle action={<PhaseTag phase="2 y 3" />}>Proveedores previstos</SectionTitle>
            <Card>
              <ul className="divide-y divide-line">
                {adapters.map(([name, covers, key]) => (
                  <li key={name} className="px-5 py-3.5">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold text-muted">{name}</span>
                      <span className="text-xs text-faint">{key}</span>
                    </span>
                    <span className="block text-xs text-faint">{covers}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
          <section>
            <SectionTitle action={<PhaseTag phase={2} />}>Tareas configurables</SectionTitle>
            <Card className="p-5">
              <ul className="flex flex-wrap gap-2">
                {tasks.map((task) => (
                  <li key={task} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
                    {task}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
