import { FolderPlus, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { Button, Card, EmptyState, Input, Notice, PageHeader, Spinner } from "@/components/ui";
import { ProjectList } from "@/features/projects/ProjectList";
import { useProjects } from "@/features/projects/hooks";
import { errorMessage } from "@/lib/api/errors";

export function Projects() {
  const navigate = useNavigate();
  const projects = useProjects();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("es");
    const all = projects.data ?? [];
    return term
      ? all.filter((p) => `${p.name} ${p.description}`.toLocaleLowerCase("es").includes(term))
      : all;
  }, [projects.data, query]);

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Todos los proyectos guardados en este computador."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => navigate("/projects/new")}>
            Crear proyecto
          </Button>
        }
      />
      {projects.isError ? (
        <Notice title="No se pudieron cargar los proyectos" action={<Button onClick={() => projects.refetch()}>Reintentar</Button>}>
          {errorMessage(projects.error)}
        </Notice>
      ) : projects.isPending ? (
        <Spinner label="Cargando proyectos…" />
      ) : projects.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderPlus className="size-5" aria-hidden />}
            title="Aún no hay proyectos"
            action={
              <Button variant="primary" onClick={() => navigate("/projects/new")}>
                Crear proyecto
              </Button>
            }
          >
            Cuando crees uno aparecerá aquí, con su estado y la fecha del último cambio.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search className="pointer-events-none absolute top-3 left-3 size-4 text-faint" aria-hidden />
            <Input
              type="search"
              aria-label="Buscar proyectos"
              placeholder="Buscar por nombre o descripción"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Card className="overflow-hidden">
            {filtered.length ? (
              <ProjectList projects={filtered} />
            ) : (
              <EmptyState title="Sin resultados">Ningún proyecto coincide con «{query}».</EmptyState>
            )}
          </Card>
        </>
      )}
    </>
  );
}
