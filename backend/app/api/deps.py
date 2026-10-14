"""Shared FastAPI dependencies: settings, services and role-based auth."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, Request

from app.core.accounts import AccountStore, SignedInAccount
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


def _signed_in(
    request: Request, authorization: Annotated[str | None, Header()] = None
) -> SignedInAccount | None:
    """The signed-in account, or None when no account exists yet (sign-in is off)."""
    store: AccountStore = request.app.state.accounts
    if not store.login_required:
        return None
    token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else ""
    account = store.from_token(request.app.state.secret, token) if token else None
    if account is None:
        raise Unauthorized("Sign in first")
    return account


SignedIn = Annotated[SignedInAccount | None, Depends(_signed_in)]


def require_facilitator_account(account: SignedIn) -> None:
    if account is not None and account.role != "facilitator":
        raise Forbidden("Only the facilitator can do this")


def require_admin(request: Request, account: SignedIn) -> str:
    """Settings: the signed-in facilitator. Without sign-in configured, open only on local/test."""
    if account is None:
        if request.app.state.settings.environment not in ("local", "test"):
            raise Forbidden("Settings need a facilitator account: add one with scripts/manage_accounts.py")
        return "local"
    if account.role != "facilitator":
        raise Forbidden("Only the facilitator can open Settings")
    return account.email


TeamId = Annotated[str, Depends(require_team)]
Admin = Annotated[str, Depends(require_admin)]
FacilitatorAccount = Annotated[None, Depends(require_facilitator_account)]
FacilitatorSession = Annotated[str, Depends(require_facilitator)]
