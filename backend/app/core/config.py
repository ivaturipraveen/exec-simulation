"""Application settings, loaded from environment variables and the repo-level .env file.

All configuration lives in `.env` (see `.env.example`). Relative paths resolve from the
project root so the server behaves the same whichever directory it is started from.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
_SQLITE_PREFIX = "sqlite:///"


def _from_root(path: Path) -> Path:
    return path if path.is_absolute() else (REPO_ROOT / path).resolve()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "MA AI Executive Simulation"
    environment: str = Field(default="local", pattern="^(local|test|staging|production)$")
    log_level: str = "INFO"

    content_dir: Path = Path("content")
    data_dir: Path = Path("data")
    static_dir: Path = Path("frontend/dist")
    database_url: str = "sqlite:///data/exec_sim.db"
    # Comma-separated or a JSON list, e.g. https://exec-sim.onrender.com,http://localhost:5180
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5180", "http://127.0.0.1:5180"]
    api_port: int = 8800
    web_port: int = 5180
    admin_password: SecretStr | None = Field(
        default=None, description="Opens the Settings screen. Settings are disabled while unset."
    )
    secret_key: SecretStr | None = Field(
        default=None, description="Token signing key; generated into data/.secret when unset (local only)"
    )

    # Simulation and game rules. Unset values fall back to content/game.yaml (Content Pack v0.1).
    sim_default_seed: int = 42
    sim_mode: Literal["deterministic", "variable"] | None = None
    round2_mechanic: Literal["hybrid", "fixed", "differentiated"] | None = None
    round2_base_musd: float | None = Field(default=None, ge=0, le=50)
    confidence_band: float | None = Field(default=None, ge=0, le=1)
    include_translation: bool = True
    pitch_ai_suggest: bool = True
    opportunity_retention_days: int = Field(default=365, ge=1, le=3650)

    anthropic_api_key: SecretStr | None = None
    anthropic_model: str = "claude-opus-5-5"
    ai_max_tokens: int = Field(default=8000, ge=1024)  # headroom: adaptive thinking counts toward it
    ai_requests_per_10_min: int = Field(default=20, ge=1)
    ai_effort: Literal["low", "medium", "high"] = "medium"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: Any) -> Any:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json

                return json.loads(v)
            return [o.strip().rstrip("/") for o in v.split(",") if o.strip()]
        return v

    @model_validator(mode="after")
    def _resolve(self) -> "Settings":
        self.content_dir = _from_root(self.content_dir)
        self.data_dir = _from_root(self.data_dir)
        self.static_dir = _from_root(self.static_dir)
        if self.database_url.startswith(_SQLITE_PREFIX):
            db_path = Path(self.database_url.removeprefix(_SQLITE_PREFIX))
            self.database_url = f"{_SQLITE_PREFIX}{_from_root(db_path)}"
        if self.environment in ("staging", "production") and self.secret_key is None:
            raise ValueError("SECRET_KEY must be set outside local/test environments")
        if self.anthropic_api_key is not None and not self.anthropic_api_key.get_secret_value().strip():
            self.anthropic_api_key = None
        if self.admin_password is not None and not self.admin_password.get_secret_value().strip():
            self.admin_password = None
        return self

    @property
    def ai_configured(self) -> bool:
        return self.anthropic_api_key is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
