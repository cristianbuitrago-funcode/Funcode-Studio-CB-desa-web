import { useState } from "react";

import { Button, Dialog, Field, Input, Notice } from "@/components/ui";
import { errorMessage } from "@/lib/api/errors";
import type { ProjectDeleteResult, ProjectDetail } from "@/lib/api/types";
import { useDeleteProject } from "./hooks";

interface Props {
  project: ProjectDetail;
  open: boolean;
  onClose: () => void;
  onDeleted: (result: ProjectDeleteResult) => void;
}

export function DeleteProjectDialog({ project, open, onClose, onDeleted }: Props) {
  const [confirmName, setConfirmName] = useState("");
  const [deleteFiles, setDeleteFiles] = useState(false);
  const remove = useDeleteProject(project.id);
  const matches = confirmName.trim() === project.name;

  const close = () => {
    setConfirmName("");
    setDeleteFiles(false);
    remove.reset();
    onClose();
  };

  const submit = () => {
    if (!matches) return;
    remove.mutate({ confirm_name: confirmName, delete_files: deleteFiles }, { onSuccess: onDeleted });
  };

  return (
    <Dialog
      open={open}
      title="Eliminar proyecto"
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={submit} disabled={!matches} busy={remove.isPending}>
            Eliminar proyecto
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <p className="text-[13px] text-muted">
          Se quitará <strong className="text-text">{project.name}</strong> de Funcode Web Architect. Esta acción
          no se puede deshacer desde la aplicación.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-[13px]">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--fw-danger)]"
            checked={deleteFiles}
            onChange={(event) => setDeleteFiles(event.target.checked)}
            disabled={!project.directory_exists}
          />
          <span>
            <span className="font-semibold text-text">Eliminar también la carpeta del proyecto</span>
            <span className="mt-0.5 block text-faint">
              {project.directory_exists
                ? "Antes de borrarla se guardará una copia de seguridad en ZIP. Si no marcas esta opción, los archivos se conservan."
                : "La carpeta ya no existe en el disco."}
            </span>
          </span>
        </label>
        <Field label={`Escribe «${project.name}» para confirmar`}>
          {(props) => (
            <Input
              {...props}
              data-autofocus
              autoComplete="off"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
            />
          )}
        </Field>
        {remove.isError ? <Notice title="No se pudo eliminar">{errorMessage(remove.error)}</Notice> : null}
      </form>
    </Dialog>
  );
}
