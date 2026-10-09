from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import REPO_ROOT, Settings


def test_relative_paths_resolve_from_project_root() -> None:
    s = Settings(_env_file=None, database_url="sqlite:///data/x.db", data_dir=Path("data"))
    assert s.database_url == f"sqlite:///{REPO_ROOT / 'data' / 'x.db'}"
    assert s.data_dir == REPO_ROOT / "data"
    assert s.content_dir == REPO_ROOT / "content"


def test_secrets_are_masked_and_blank_key_disables_ai() -> None:
    s = Settings(_env_file=None, anthropic_api_key="sk-test-123", secret_key="abc")
    assert "sk-test-123" not in repr(s) and "abc" not in str(s.secret_key)
    assert s.ai_configured
    assert not Settings(_env_file=None, anthropic_api_key="   ").ai_configured


def test_production_requires_secret_key() -> None:
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None, environment="production")
