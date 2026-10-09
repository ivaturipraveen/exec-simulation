"""Persistence: SQLite via SQLModel, schema managed by Alembic (`migrations/`).

Team simulation state is stored as validated JSON."""

from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import JSON, Column, Connection, event, inspect
from sqlalchemy.engine import Engine
from sqlmodel import Field, Session, SQLModel, create_engine

log = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(UTC)


class GameSession(SQLModel, table=True):
    __tablename__ = "game_sessions"

    id: str = Field(primary_key=True)
    name: str
    seed: int
    round2_mechanic: str
    content_version: str
    stage_index: int = 0
    stage_status: str = "not_started"  # not_started | running | paused | completed
    stage_started_at: datetime | None = None
    elapsed_before_pause: float = 0.0
    released: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    simulated_years: int = 0
    round2_granted: bool = False
    options: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False, server_default="{}")
    )
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Team(SQLModel, table=True):
    __tablename__ = "teams"

    id: str = Field(primary_key=True)
    session_id: str = Field(foreign_key="game_sessions.id", index=True)
    payer_id: str
    name: str
    join_code: str = Field(index=True, unique=True)
    state: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    workspace: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    version: int = 0
    updated_at: datetime = Field(default_factory=utcnow)


class EventLog(SQLModel, table=True):
    __tablename__ = "event_log"

    id: int | None = Field(default=None, primary_key=True)
    session_id: str = Field(index=True)
    team_id: str | None = Field(default=None, index=True)
    actor: str  # team | facilitator | system
    kind: str = Field(index=True)
    payload: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow, index=True)


class AppSetting(SQLModel, table=True):
    """Overrides saved from the Settings screen (they take precedence over .env and content)."""

    __tablename__ = "app_settings"

    key: str = Field(primary_key=True)
    value: Any = Field(sa_column=Column(JSON, nullable=True))
    updated_by: str = "admin"
    updated_at: datetime = Field(default_factory=utcnow)


BACKEND_DIR = Path(__file__).resolve().parent.parent
BASELINE_REVISION = "0001"


def make_engine(url: str, *, run_migrations: bool = True) -> Engine:
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    engine = create_engine(url, connect_args=connect_args)
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _pragmas(dbapi_conn: Any, _record: Any) -> None:
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA journal_mode=WAL")
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

    if run_migrations:
        migrate(engine)
    return engine


def alembic_config() -> Config:
    return Config(str(BACKEND_DIR / "alembic.ini"))


def migrate(engine: Engine) -> None:
    """Bring the database to the latest schema (T-101).

    A database created before migrations existed (tables but no `alembic_version`) is first
    brought level with the baseline by adding any missing columns, then stamped, so local data
    survives the switch.
    """
    cfg = alembic_config()
    logging.getLogger("alembic").setLevel(logging.WARNING)
    with engine.begin() as conn:
        tables = set(inspect(conn).get_table_names())
        cfg.attributes["connection"] = conn
        if "game_sessions" in tables and "alembic_version" not in tables:
            SQLModel.metadata.create_all(conn)
            _add_missing_columns(conn)
            command.stamp(cfg, BASELINE_REVISION)
            log.info("Adopted an existing database at migration %s", BASELINE_REVISION)
        before = MigrationContext.configure(conn).get_current_revision()
        command.upgrade(cfg, "head")
        after = MigrationContext.configure(conn).get_current_revision()
        if before != after:
            log.info("Database migrated %s → %s", before or "empty", after)


def _add_missing_columns(conn: Connection) -> None:
    """Additive upgrade used only when adopting a pre-migration SQLite database."""
    if conn.dialect.name != "sqlite":
        return
    for table in SQLModel.metadata.sorted_tables:
        existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table.name})")}
        for col in table.columns:
            if col.name in existing:
                continue
            default = col.server_default.arg if col.server_default is not None else None
            ddl = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(conn.dialect)}"
            if default is not None:
                ddl += f" NOT NULL DEFAULT '{default}'"
            conn.exec_driver_sql(ddl)


def session_scope(engine: Engine) -> Iterator[Session]:
    with Session(engine, expire_on_commit=False) as session:
        yield session
