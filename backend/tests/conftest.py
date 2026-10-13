import os
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.core.config import Settings
from app.db import normalize_database_url
from app.main import create_app

# Set TEST_DATABASE_URL (a PostgreSQL server URL) to run the suite against PostgreSQL:
# each test gets its own throwaway database. Unset, tests use a temporary SQLite file.
PG_SERVER = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture
def database_url(tmp_path: Path) -> Iterator[str]:
    if not PG_SERVER:
        yield f"sqlite:///{tmp_path / 'test.db'}"
        return
    admin = create_engine(normalize_database_url(PG_SERVER), isolation_level="AUTOCOMMIT")
    name = f"test_{uuid.uuid4().hex[:12]}"
    with admin.connect() as c:
        c.execute(text(f'CREATE DATABASE "{name}"'))
    base, _, query = PG_SERVER.partition("?")
    yield f"{base.rsplit('/', 1)[0]}/{name}" + (f"?{query}" if query else "")
    with admin.connect() as c:
        c.execute(text(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))
    admin.dispose()


@pytest.fixture
def settings(tmp_path: Path, database_url: str) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        anthropic_api_key=None,
        secret_key="test-secret",
        data_dir=tmp_path,
        database_url=database_url,
        static_dir=tmp_path / "no-dist",
    )


@pytest.fixture
def client(settings: Settings) -> TestClient:
    with TestClient(create_app(settings)) as c:
        yield c
