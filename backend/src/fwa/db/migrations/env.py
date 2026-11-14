"""Entorno de Alembic. Usa la conexión que le entrega ``fwa.db.session``."""

from __future__ import annotations

import os

from alembic import context
from sqlalchemy import create_engine

from fwa.db.models import Base

target_metadata = Base.metadata


def run() -> None:
    connection = context.config.attributes.get("connection")
    if connection is None:
        # Uso desde la línea de comandos durante el desarrollo (autogenerar migraciones).
        url = os.environ.get("FWA_ALEMBIC_URL") or context.config.get_main_option("sqlalchemy.url")
        if not url:
            raise RuntimeError(
                "Define FWA_ALEMBIC_URL para usar Alembic desde la línea de comandos."
            )
        with create_engine(url).begin() as conn:
            _migrate(conn)
    else:
        _migrate(connection)


def _migrate(connection) -> None:  # type: ignore[no-untyped-def]
    context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


run()
