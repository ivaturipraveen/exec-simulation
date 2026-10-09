from fastapi import APIRouter

from app.api.routes import admin, health, public, sessions, team

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(public.router)
api_router.include_router(team.router)
api_router.include_router(sessions.router)
api_router.include_router(admin.router)
