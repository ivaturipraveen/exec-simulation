"""Manage sign-in accounts in the database (the ``accounts`` table).

    python scripts/manage_accounts.py list
    python scripts/manage_accounts.py add facilitator test@example.com
    python scripts/manage_accounts.py add team admin@horizon.example --payer horizon
    python scripts/manage_accounts.py set-password test@example.com
    python scripts/manage_accounts.py remove admin@horizon.example

Uses DATABASE_URL from backend/.env unless --database-url is given (e.g. the production database's
external URL). Passwords are prompted for (or read from --password) and stored only as hashes.
Adding an existing email updates its password and role.
"""

from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.accounts import AccountStore
from app.core.config import get_settings
from app.db import make_engine
from sim.content import load_content


def _password(args: argparse.Namespace) -> str:
    if args.password:
        return args.password
    first = getpass.getpass("Password: ")
    if first != getpass.getpass("Repeat password: "):
        raise SystemExit("Passwords do not match")
    return first


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--database-url", help="defaults to DATABASE_URL from backend/.env")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list", help="list accounts (never shows passwords)")
    add = sub.add_parser("add", help="add or update an account")
    add.add_argument("role", choices=["facilitator", "team"])
    add.add_argument("email")
    add.add_argument("--payer", help="payer id for a team account (communitycare, heritage, horizon)")
    add.add_argument("--password", help="omit to be prompted")
    pw = sub.add_parser("set-password", help="change an account's password")
    pw.add_argument("email")
    pw.add_argument("--password", help="omit to be prompted")
    rm = sub.add_parser("remove", help="delete an account")
    rm.add_argument("email")
    args = ap.parse_args()

    settings = get_settings()
    store = AccountStore(make_engine(args.database_url or settings.database_url))

    if args.cmd == "list":
        rows = store.list()
        for a in rows:
            print(f"{a.role:<12} {a.payer_id or '-':<14} {a.email}")
        print(f"{len(rows)} account(s)" + ("" if rows else " — sign-in is off until one is added"))
        return 0
    if args.cmd == "add":
        if args.role == "team":
            payers = load_content(settings.content_dir).payers
            if args.payer not in payers:
                ap.error(f"--payer must be one of: {', '.join(sorted(payers))}")
        try:
            store.upsert(args.email, _password(args), args.role, args.payer)
        except ValueError as exc:
            ap.error(str(exc))
        print(f"Saved {args.role} account {args.email.strip().lower()}")
        return 0
    if args.cmd == "set-password":
        current = next((a for a in store.list() if a.email == args.email.strip().lower()), None)
        if current is None:
            ap.error(f"No account {args.email}")
        try:
            store.upsert(current.email, _password(args), current.role, current.payer_id)
        except ValueError as exc:
            ap.error(str(exc))
        print(f"Password changed for {current.email} (signed out everywhere)")
        return 0
    if args.cmd == "remove":
        print("Removed" if store.remove(args.email) else f"No account {args.email}")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
