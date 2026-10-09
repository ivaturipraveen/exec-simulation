"""Shared FastAPI dependencies: settings, services and role-based auth."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, Request

from app.core.config import Settings
from app.core.errors import Forbidden, Unauthorized
from app.core.security import Principal, verify_token
from app.services.game import GameService
from sim.content import ContentBundle


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _content(request: Request) -> ContentBundle:
    return request.app.state.content


def _game(request: Request) -> GameService:
    return request.app.state.game


SettingsDep = Annotated[Settings, Depends(_settings)]
ContentDep = Annotated[ContentBundle, Depends(_content)]
GameDep = Annotated[GameService, Depends(_game)]


def _principal(request: Request, authorization: Annotated[str | None, Header()] = None) -> Principal:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise Unauthorized("Missing bearer token")
    principal = verify_token(request.app.state.secret, authorization[7:].strip())
    if principal is None:
        raise Unauthorized("Invalid token")
    return principal


def require_team(principal: Annotated[Principal, Depends(_principal)]) -> str:
    if principal.role != "team":
        raise Forbidden("Team access required")
    return principal.subject_id


def require_facilitator(session_id: str, principal: Annotated[Principal, Depends(_principal)]) -> str:
    if principal.role != "facilitator" or principal.subject_id != session_id:
        raise Forbidden("Facilitator access to this session required")
    return session_id


def require_admin(principal: Annotated[Principal, Depends(_principal)]) -> str:
    if principal.role != "admin":
        raise Forbidden("Settings access required")
    return principal.subject_id


TeamId = Annotated[str, Depends(require_team)]
Admin = Annotated[str, Depends(require_admin)]
FacilitatorSession = Annotated[str, Depends(require_facilitator)]
