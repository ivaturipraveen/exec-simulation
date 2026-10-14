"""Settings (admin). Everything configurable in backend/.env and content/game.yaml can be overridden
here; secrets stay in backend/.env. Access requires the facilitator sign-in (see app.core.accounts)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.api.deps import Admin
from app.core.errors import NotFound
from app.core.security import issue_token
from app.db import GameSession, Team
from app.services.settings_store import SettingsView

router = APIRouter(prefix="/admin", tags=["admin"])


class LoginOut(BaseModel):
    token: str


@router.get("/settings")
def get_settings(_: Admin, request: Request) -> SettingsView:
    return request.app.state.settings_store.view()


class UpdateBody(BaseModel):
    values: dict[str, Any]


@router.put("/settings")
def update_settings(body: UpdateBody, _: Admin, request: Request) -> SettingsView:
    return request.app.state.settings_store.update(body.values)


@router.delete("/settings/{key}")
def reset_setting(key: str, _: Admin, request: Request) -> SettingsView:
    return request.app.state.settings_store.reset(key)


class ReviewBody(BaseModel):
    status: Literal["open", "confirmed", "changed"]
    note: str = Field(default="", max_length=1000)


@router.put("/review/{item_id}")
def review(item_id: str, body: ReviewBody, _: Admin, request: Request) -> SettingsView:
    return request.app.state.settings_store.set_review(item_id, body.status, body.note)


class SessionRow(BaseModel):
    id: str
    name: str
    created_at: datetime
    stage_index: int
    stage_status: str
    simulated_years: int
    teams: list[str]
    content_version: str


@router.get("/sessions")
def sessions(_: Admin, request: Request) -> list[SessionRow]:
    game = request.app.state.game
    with Session(game.engine) as db:
        rows = list(db.exec(select(GameSession).order_by(GameSession.created_at.desc())).all())
        return [
            SessionRow(
                id=gs.id,
                name=gs.name,
                created_at=gs.created_at,
                stage_index=gs.stage_index,
                stage_status=gs.stage_status,
                simulated_years=gs.simulated_years,
                teams=[t.name for t in db.exec(select(Team).where(Team.session_id == gs.id))],
                content_version=gs.content_version,
            )
            for gs in rows[:100]
        ]


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str, _: Admin, request: Request) -> None:
    """Delete a session, its teams and its activity log (admins only; cannot be undone)."""
    request.app.state.game.delete_session(session_id)


@router.post("/sessions/{session_id}/token")
def facilitator_token(session_id: str, _: Admin, request: Request) -> LoginOut:
    """Open any session's facilitator console (admins only)."""
    with Session(request.app.state.game.engine) as db:
        if db.get(GameSession, session_id) is None:
            raise NotFound("Session not found")
    return LoginOut(token=issue_token(request.app.state.secret, "facilitator", session_id))
