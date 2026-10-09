"""Stateless HMAC-signed role tokens.

Tokens are ``<role>.<subject_id>.<signature>``. Facilitator tokens grant control of one
session; team tokens grant access to one team's workspace; the admin token (issued after the
``ADMIN_PASSWORD`` check) opens global Settings. Hidden content (root causes,
answer keys, formulas) is only ever served to facilitator tokens.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

Role = Literal["facilitator", "team", "admin"]


@dataclass(frozen=True)
class Principal:
    role: Role
    subject_id: str


def load_or_create_secret(path: Path) -> str:
    if path.is_file():
        return path.read_text().strip()
    path.parent.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_urlsafe(48)
    path.write_text(secret)
    path.chmod(0o600)
    return secret


def _sign(secret: str, role: Role, subject_id: str) -> str:
    msg = f"{role}:{subject_id}".encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()[:40]


def issue_token(secret: str, role: Role, subject_id: str) -> str:
    return f"{role}.{subject_id}.{_sign(secret, role, subject_id)}"


def verify_token(secret: str, token: str) -> Principal | None:
    parts = token.split(".")
    if len(parts) != 3 or parts[0] not in ("facilitator", "team", "admin"):
        return None
    role, subject_id, signature = parts
    expected = _sign(secret, role, subject_id)  # type: ignore[arg-type]
    if not hmac.compare_digest(expected, signature):
        return None
    return Principal(role=role, subject_id=subject_id)  # type: ignore[arg-type]


def new_join_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous characters
    return "".join(secrets.choice(alphabet) for _ in range(6))
