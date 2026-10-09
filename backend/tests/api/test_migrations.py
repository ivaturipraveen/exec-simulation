"""T-101: schema is managed by Alembic and the models never drift from the migrations."""

from pathlib import Path

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlmodel import SQLModel

from app.db import BASELINE_REVISION, alembic_config, make_engine


def _head() -> str:
    return ScriptDirectory.from_config(alembic_config()).get_current_head() or ""


def _revision(engine) -> str | None:
    with engine.connect() as conn:
        return MigrationContext.configure(conn).get_current_revision()


def test_fresh_database_is_at_head_and_matches_models(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'fresh.db'}")
    assert _revision(engine) == _head()
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), SQLModel.metadata)
    assert diff == [], f"Models changed without a migration (make db-revision m=...): {diff}"


def test_pre_migration_database_is_adopted_without_data_loss(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'legacy.db'}"
    legacy = make_engine(url, run_migrations=False)
    with legacy.begin() as conn:
        # An early schema: no app_settings table, no options column on sessions.
        conn.execute(
            text(
                "CREATE TABLE game_sessions (id VARCHAR PRIMARY KEY, name VARCHAR NOT NULL, seed INTEGER NOT NULL,"
                " round2_mechanic VARCHAR NOT NULL, content_version VARCHAR NOT NULL, stage_index INTEGER NOT NULL,"
                " stage_status VARCHAR NOT NULL, stage_started_at DATETIME, elapsed_before_pause FLOAT NOT NULL,"
                " released JSON NOT NULL, simulated_years INTEGER NOT NULL, round2_granted BOOLEAN NOT NULL,"
                " created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO game_sessions VALUES ('s1', 'Old session', 42, 'hybrid', '1', 0, 'not_started', NULL,"
                " 0, '[]', 0, 0, '2026-10-01 00:00:00', '2026-10-01 00:00:00')"
            )
        )
    legacy.dispose()

    engine = make_engine(url)
    assert _revision(engine) == _head()
    with engine.connect() as conn:
        assert {"app_settings", "teams", "event_log"} <= set(inspect(conn).get_table_names())
        row = conn.execute(text("SELECT name, options FROM game_sessions WHERE id = 's1'")).one()
    assert row.name == "Old session" and row.options == "{}"


def test_downgrade_and_upgrade_round_trip(tmp_path: Path) -> None:
    engine = make_engine(f"sqlite:///{tmp_path / 'trip.db'}")
    cfg = alembic_config()
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        command.downgrade(cfg, "base")
        assert "game_sessions" not in inspect(conn).get_table_names()
        command.upgrade(cfg, "head")
    assert _revision(engine) == _head()
    assert _head() >= BASELINE_REVISION
