"""Detección de Docker y Podman. Solo consulta; nunca instala ni inicia nada."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from fwa.services.commands import run_tool

RuntimeName = Literal["docker", "podman"]


class ContainerRuntimeStatus(BaseModel):
    name: RuntimeName
    installed: bool
    # Instalado y con su servicio respondiendo, es decir, utilizable ahora mismo.
    available: bool
    version: str | None = None
    detail: str | None = None


class IsolationStatus(BaseModel):
    runtimes: list[ContainerRuntimeStatus]
    # Entorno que se usaría para proyectos con backend; ``None`` si no hay ninguno.
    active_runtime: RuntimeName | None
    # Nivel aplicable a proyectos con backend: 2 (contenedores) o 3 (protección reducida).
    backend_projects_level: Literal[2, 3]


def _detect(name: RuntimeName) -> ContainerRuntimeStatus:
    client = run_tool(name, ["--version"])
    if not client.found:
        return ContainerRuntimeStatus(name=name, installed=False, available=False)
    version = client.output.splitlines()[0] if client.output else None
    # ``info`` solo responde si el servicio (o la máquina de Podman) está en marcha.
    info = run_tool(name, ["info", "--format", "{{json .}}"], timeout=8.0)
    detail = None
    if not info.ok:
        detail = "Instalado, pero su servicio no responde. Inícialo para poder usarlo."
    return ContainerRuntimeStatus(
        name=name, installed=True, available=info.ok, version=version, detail=detail
    )


def detect_isolation() -> IsolationStatus:
    runtimes = [_detect("docker"), _detect("podman")]
    active = next((r.name for r in runtimes if r.available), None)
    return IsolationStatus(
        runtimes=runtimes, active_runtime=active, backend_projects_level=2 if active else 3
    )
