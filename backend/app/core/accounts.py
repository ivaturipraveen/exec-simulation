"""Sign-in accounts, stored in the ``accounts`` table: one facilitator account and one account per
team. Passwords are kept only as salted scrypt hashes. Manage them with
``python scripts/manage_accounts.py`` (add, list, set-password, remove).

A sign-in token is a ``user`` role token whose subject names the account and a fingerprint of its
current password hash, so changing a password signs that account out everywhere.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.core.security import issue_token, verify_token
from app.db import Account, utcnow

Role = Literal["facilitator", "team"]

_N, _R, _P = 2**14, 8, 1  # scrypt cost: ~16 MB and a few tens of milliseconds per check


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    b64 = base64.b64encode
    return f"scrypt${_N}${_R}${_P}${b64(salt).decode()}${b64(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, n, r, p, salt, digest = stored.split("$")
        if algo != "scrypt":
            return False
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# Checked against when the email is unknown, so a wrong email costs as long as a wrong password.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


@dataclass(frozen=True)
class SignedInAccount:
    id: int
    email: str
    role: Role
    payer_id: str | None
    fingerprint: str


def _view(row: Account) -> SignedInAccount:
    assert row.id is not None
    fingerprint = hashlib.sha256(f"{row.email}\n{row.password_hash}".encode()).hexdigest()[:24]
    return SignedInAccount(row.id, row.email, row.role, row.payer_id, fingerprint)  # type: ignore[arg-type]


class AccountStore:
    """Reads accounts from the database, cached briefly so sign-in checks stay off the hot path."""

    CACHE_SECONDS = 30.0

    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        self._lock = threading.Lock()
        self._cache: tuple[float, dict[int, SignedInAccount]] | None = None

    # ---- reads ----
    def _all(self) -> dict[int, SignedInAccount]:
        with self._lock:
            if self._cache and time.monotonic() - self._cache[0] < self.CACHE_SECONDS:
                return self._cache[1]
        with Session(self.engine) as db:
            rows = {r.id: _view(r) for r in db.exec(select(Account)) if r.id is not None}
        with self._lock:
            self._cache = (time.monotonic(), rows)
        return rows

    def invalidate(self) -> None:
        with self._lock:
            self._cache = None

    @property
    def login_required(self) -> bool:
        return bool(self._all())

    def count(self) -> int:
        return len(self._all())

    def authenticate(self, email: str, password: str) -> SignedInAccount | None:
        email = email.strip().lower()
        with Session(self.engine) as db:
            row = db.exec(select(Account).where(Account.email == email)).first()
        if row is None:
            verify_password(password, _DUMMY_HASH)
            return None
        return _view(row) if verify_password(password, row.password_hash) else None

    def from_token(self, secret: str, token: str) -> SignedInAccount | None:
        principal = verify_token(secret, token)
        if principal is None or principal.role != "user":
            return None
        account_id, _, fingerprint = principal.subject_id.partition("~")
        if not account_id.isdigit():
            return None
        account = self._all().get(int(account_id))
        if account is None or not hmac.compare_digest(account.fingerprint, fingerprint):
            return None
        return account

    @staticmethod
    def token_for(secret: str, account: SignedInAccount) -> str:
        return issue_token(secret, "user", f"{account.id}~{account.fingerprint}")

    # ---- writes (used by scripts/manage_accounts.py and tests) ----
    def upsert(self, email: str, password: str, role: Role, payer_id: str | None = None) -> SignedInAccount:
        if role not in ("facilitator", "team"):
            raise ValueError("role must be facilitator or team")
        if role == "team" and not payer_id:
            raise ValueError("a team account needs a payer id")
        if len(password) < 8:
            raise ValueError("passwords need at least 8 characters")
        email = email.strip().lower()
        with Session(self.engine, expire_on_commit=False) as db:
            row = db.exec(select(Account).where(Account.email == email)).first() or Account(
                email=email, password_hash="", role=role
            )
            row.password_hash = hash_password(password)
            row.role = role
            row.payer_id = payer_id if role == "team" else None
            row.updated_at = utcnow()
            db.add(row)
            db.commit()
            db.refresh(row)
        self.invalidate()
        return _view(row)

    def remove(self, email: str) -> bool:
        with Session(self.engine) as db:
            row = db.exec(select(Account).where(Account.email == email.strip().lower())).first()
            if row is None:
                return False
            db.delete(row)
            db.commit()
        self.invalidate()
        return True

    def list(self) -> list[SignedInAccount]:
        self.invalidate()
        return sorted(
            self._all().values(), key=lambda a: (a.role != "facilitator", a.payer_id or "", a.email)
        )
