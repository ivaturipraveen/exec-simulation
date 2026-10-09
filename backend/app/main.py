"""FastAPI application factory."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.router import api_router
from app.api.routes import ws
from app.core.config import Settings, get_settings
from app.core.errors import NotFound, install_error_handlers
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.core.security import load_or_create_secret
from app.db import make_engine
from app.services.analyst import build_analyst
from app.services.game import GameOptions, GameService
from app.services.realtime import RealtimeHub
from app.services.settings_store import SettingsStore
from sim.content import ContentBundle, load_content


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    content = load_content(settings.content_dir).with_config(
        sim_mode=settings.sim_mode,
        round2_mechanic=settings.round2_mechanic,
        round2_base_musd=settings.round2_base_musd,
        confidence_band=settings.confidence_band,
        default_seed=settings.sim_default_seed,
    )
    secret = (
        settings.secret_key.get_secret_value()
        if settings.secret_key
        else load_or_create_secret(settings.data_dir / ".secret")
    )
    if settings.database_url.startswith("sqlite:///"):
        settings.data_dir.mkdir(parents=True, exist_ok=True)
    engine = make_engine(settings.database_url)
    hub = RealtimeHub()
    analyst = build_analyst(settings, content)
    game = GameService(
        engine,
        content,
        hub,
        secret,
        ai_enabled=analyst.generative,
        default_seed=settings.sim_default_seed,
        options=GameOptions(
            include_translation=settings.include_translation,
            pitch_ai_suggest=settings.pitch_ai_suggest,
            opportunity_retention_days=settings.opportunity_retention_days,
        ),
        advisor=analyst if analyst.generative else None,
    )

    def apply_settings(effective: ContentBundle) -> None:
        """Called whenever Settings change: new sessions use the new config; runtime options apply now."""
        app.state.content = effective
        game.set_content(effective)
        game.options.include_translation = settings.include_translation
        game.options.pitch_ai_suggest = settings.pitch_ai_suggest
        game.options.opportunity_retention_days = settings.opportunity_retention_days

    store = SettingsStore(engine, settings, content, __version__)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        hub.bind_loop(asyncio.get_running_loop())
        yield
        engine.dispose()

    app = FastAPI(title=settings.app_name, version=__version__, lifespan=lifespan)
    app.state.settings = settings
    app.state.content = content
    app.state.secret = secret
    app.state.hub = hub
    app.state.game = game
    app.state.analyst = analyst
    app.state.settings_store = store
    store.on_change = apply_settings
    apply_settings(store.content)
    game.purge_expired()

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)
    app.include_router(api_router)
    app.include_router(ws.router)
    _mount_frontend(app, settings)
    return app


def _mount_frontend(app: FastAPI, settings: Settings) -> None:
    """Serve the built SPA (T-096) when frontend/dist exists; dev uses the Vite server."""
    index = settings.static_dir / "index.html"
    if not index.is_file():
        return
    app.mount("/assets", StaticFiles(directory=settings.static_dir / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith(("api/", "ws/")):
            raise NotFound("Not found")
        candidate = settings.static_dir / path
        if path and candidate.is_file() and settings.static_dir in candidate.resolve().parents:
            return FileResponse(candidate)
        return FileResponse(index)


app = create_app()
