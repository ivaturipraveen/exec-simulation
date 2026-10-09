"""Alembic environment (T-101).

The app runs `upgrade head` on start (see `app.db.migrate`), passing its own connection. From the
command line (`make db-revision`, `make db-upgrade`) the URL comes from the app settings, so `.env`
stays the single source of configuration.
"""

from __future__ import annotations

from alembic import context
from sqlalchemy import Connection, engine_from_config, pool
from sqlmodel import SQLModel

import app.db  # noqa: F401  (registers the tables on SQLModel.metadata)

config = context.config
target_metadata = SQLModel.metadata


def _configure(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        render_as_batch=connection.dialect.name == "sqlite",  # SQLite ALTER TABLE support
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_offline() -> None:
    from app.core.config import get_settings

    context.configure(
        url=get_settings().database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _configure(connection)
        return
    from app.core.config import get_settings

    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = get_settings().database_url
    engine = engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with engine.connect() as conn:
        _configure(conn)


if context.is_offline_mode():
    run_offline()
else:
    run_online()
