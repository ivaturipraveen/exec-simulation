"""Sign-in. Accounts live in the ``accounts`` table (see app.core.accounts and
scripts/manage_accounts.py): the facilitator and one per team. A team account then enters its join
code, which must be its own team's. While the table is empty, the sign-in page is skipped."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Annotated, Literal

from fastapi import APIRouter, Header, Request
from pydantic import BaseModel, Field

from app.core.accounts import AccountStore, SignedInAccount
from app.core.errors import DomainError, Forbidden

router = APIRouter(prefix="/auth", tags=["auth"])

_FAILURES: dict[str, deque[float]] = defaultdict(deque)
_WINDOW_S, _MAX_FAILURES = 300, 5


class TooManyAttempts(DomainError):
    status_code = 429
    code = "too_many_attempts"


class LoginBody(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=256)


class AuthStatus(BaseModel):
    required: bool
    signed_in: bool
    email: str | None = None
    role: Literal["facilitator", "team"] | None = None
    payer_id: str | None = None
    payer_name: str | None = None


class LoginOut(AuthStatus):
    token: str


def _store(request: Request) -> AccountStore:
    return request.app.state.accounts


def _status(request: Request, account: SignedInAccount | None) -> AuthStatus:
    if not _store(request).login_required:
        return AuthStatus(required=False, signed_in=True)
    if account is None:
        return AuthStatus(required=True, signed_in=False)
    payers = request.app.state.content.payers
    return AuthStatus(
        required=True,
        signed_in=True,
        email=account.email,
        role=account.role,
        payer_id=account.payer_id,
        payer_name=payers[account.payer_id].name if account.payer_id in payers else None,
    )


@router.get("/status")
def status(request: Request, authorization: Annotated[str | None, Header()] = None) -> AuthStatus:
    """Whether sign-in is required, and who the bearer token (if any) is signed in as."""
    token = authorization[7:].strip() if authorization and authorization.lower().startswith("bearer ") else ""
    account = _store(request).from_token(request.app.state.secret, token) if token else None
    return _status(request, account)


@router.post("/login")
def login(body: LoginBody, request: Request) -> LoginOut:
    store = _store(request)
    if not store.login_required:
        raise Forbidden("Sign-in is not enabled on this server")
    client = request.client.host if request.client else "local"
    now = time.monotonic()
    attempts = _FAILURES[client]
    while attempts and now - attempts[0] > _WINDOW_S:
        attempts.popleft()
    if len(attempts) >= _MAX_FAILURES:
        raise TooManyAttempts("Too many attempts — wait five minutes")
    account = store.authenticate(body.email, body.password)
    if account is None:
        attempts.append(now)
        raise Forbidden("Incorrect email or password")
    attempts.clear()
    return LoginOut(
        token=store.token_for(request.app.state.secret, account), **_status(request, account).model_dump()
    )
