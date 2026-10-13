"""Copy every row from a local SQLite database into another database (e.g. PostgreSQL).

    python scripts/copy_sqlite_to_database.py --source sqlite:///data/exec_sim.db --target "$DATABASE_URL"

The target schema is created by the normal migrations. The copy refuses to run when the target
already holds data (pass --replace to clear it first), verifies row counts afterwards and never
modifies or deletes the source.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import func, text
from sqlmodel import Session, select

from app.db import AppSetting, EventLog, GameSession, Team, make_engine

# Parents before children (teams reference sessions).
TABLES = [GameSession, Team, EventLog, AppSetting]


def counts(engine) -> dict[str, int]:
    with Session(engine) as db:
        return {m.__tablename__: int(db.scalar(select(func.count()).select_from(m)) or 0) for m in TABLES}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--source", required=True, help="SQLite URL to copy from")
    ap.add_argument("--target", required=True, help="Database URL to copy into")
    ap.add_argument("--replace", action="store_true", help="delete existing target rows first")
    args = ap.parse_args()
    if not args.source.startswith("sqlite"):
        ap.error("--source must be a sqlite:/// URL")

    source = make_engine(args.source, run_migrations=False)
    target = make_engine(args.target)  # creates / upgrades the schema
    before = counts(source)
    print("source rows:", before)

    existing = counts(target)
    if any(existing.values()):
        if not args.replace:
            print("target already has data:", existing, "- nothing copied (use --replace to overwrite)")
            return 1
        with Session(target) as db:
            for model in reversed(TABLES):
                db.exec(text(f'DELETE FROM "{model.__tablename__}"'))
            db.commit()

    with Session(source) as src, Session(target) as dst:
        for model in TABLES:
            rows = src.exec(select(model)).all()
            for row in rows:
                dst.add(model.model_validate(row.model_dump()))
            dst.flush()
        dst.commit()

    # Keep the event_log id sequence ahead of the copied ids on PostgreSQL.
    if target.dialect.name == "postgresql":
        with target.begin() as conn:
            conn.execute(
                text(
                    "SELECT setval(pg_get_serial_sequence('event_log', 'id'), "
                    "COALESCE((SELECT MAX(id) FROM event_log), 0) + 1, false)"
                )
            )

    after = counts(target)
    print("target rows:", after)
    if after != before:
        print("MISMATCH: row counts differ; the source was not changed")
        return 2
    print("OK: every row copied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
