from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.api.deps import ContentDep, GameDep
from app.schemas import views as v

router = APIRouter(tags=["public"])


@router.get("/catalog")
def catalog(content: ContentDep) -> v.CatalogView:
    """Public game catalog: measures, investments, stages and workflow. No hidden mechanics."""
    return v.catalog_view(content)


class JoinRequest(BaseModel):
    code: str = Field(min_length=4, max_length=12)


@router.post("/join")
def join(body: JoinRequest, game: GameDep) -> v.JoinResult:
    return game.join(body.code)
