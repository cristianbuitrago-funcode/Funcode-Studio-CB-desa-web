from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter

from fwa.api.deps import Uow
from fwa.api.schemas import ProjectDetailOut, ProjectOut, TaskOut
from fwa.services.projects import ProjectCreate, ProjectDelete, ProjectDeleteResult, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["proyectos"])


def _detail(project: object) -> ProjectDetailOut:
    out = ProjectDetailOut.model_validate(
        {**ProjectOut.model_validate(project).model_dump(), "directory_exists": False}
    )
    out.directory_exists = Path(out.directory).is_dir()
    return out


@router.get("", response_model=list[ProjectOut])
def list_projects(uow: Uow) -> list[ProjectOut]:
    return [ProjectOut.model_validate(p) for p in uow.projects.list()]


@router.post("", response_model=ProjectDetailOut, status_code=201)
def create_project(data: ProjectCreate, uow: Uow) -> ProjectDetailOut:
    project = uow.projects.create(data)
    uow.commit()
    return _detail(project)


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(project_id: str, uow: Uow) -> ProjectDetailOut:
    return _detail(uow.projects.get(project_id))


@router.patch("/{project_id}", response_model=ProjectDetailOut)
def update_project(project_id: str, data: ProjectUpdate, uow: Uow) -> ProjectDetailOut:
    project = uow.projects.update(project_id, data)
    uow.commit()
    return _detail(project)


@router.post("/{project_id}/delete", response_model=ProjectDeleteResult)
def delete_project(project_id: str, data: ProjectDelete, uow: Uow) -> ProjectDeleteResult:
    """Eliminación con confirmación explícita (el nombre del proyecto en el cuerpo)."""
    result = uow.projects.delete(project_id, data)
    uow.commit()
    return result


@router.get("/{project_id}/tasks", response_model=list[TaskOut])
def list_tasks(project_id: str, uow: Uow) -> list[TaskOut]:
    uow.projects.get(project_id)
    return [TaskOut.model_validate(t) for t in uow.tasks.list_for_project(project_id)]
