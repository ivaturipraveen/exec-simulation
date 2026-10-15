"""session synthesis: a column for the saved Opportunity Map synthesis

The synthesis used to live inside the sessions' `options` JSON under the key "synthesis". It gets its
own nullable column, and any synthesis already saved is moved across so nothing is lost.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-15 17:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SESSIONS = sa.table(
    "game_sessions",
    sa.column("id", sa.String()),
    sa.column("options", sa.JSON()),
    sa.column("synthesis", sa.JSON()),
)


def upgrade() -> None:
    conn = op.get_bind()
    # A pre-migration database adopted at the baseline already got this column from the current models.
    if "synthesis" not in {c["name"] for c in sa.inspect(conn).get_columns("game_sessions")}:
        with op.batch_alter_table("game_sessions", schema=None) as batch_op:
            batch_op.add_column(sa.Column("synthesis", sa.JSON(), nullable=True))
    for row in conn.execute(sa.select(SESSIONS.c.id, SESSIONS.c.options)).all():
        options = dict(row.options or {})
        if "synthesis" in options:
            saved = options.pop("synthesis")
            conn.execute(
                sa.update(SESSIONS).where(SESSIONS.c.id == row.id).values(synthesis=saved, options=options)
            )


def downgrade() -> None:
    conn = op.get_bind()
    for row in conn.execute(sa.select(SESSIONS.c.id, SESSIONS.c.options, SESSIONS.c.synthesis)).all():
        if row.synthesis is not None:
            options = {**(row.options or {}), "synthesis": row.synthesis}
            conn.execute(sa.update(SESSIONS).where(SESSIONS.c.id == row.id).values(options=options))
    with op.batch_alter_table("game_sessions", schema=None) as batch_op:
        batch_op.drop_column("synthesis")
