from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        anthropic_api_key=None,
        secret_key="test-secret",
        data_dir=tmp_path,
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        static_dir=tmp_path / "no-dist",
    )


@pytest.fixture
def client(settings: Settings) -> TestClient:
    with TestClient(create_app(settings)) as c:
        yield c
