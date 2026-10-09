from pathlib import Path

import pytest

from sim.content import ContentBundle, load_content
from sim.engine import TeamState
from sim.portfolios import run_portfolio

CONTENT_DIR = Path(__file__).resolve().parents[3] / "content"


@pytest.fixture(scope="session")
def content() -> ContentBundle:
    return load_content(CONTENT_DIR)


def play(content: ContentBundle, portfolio_id: str, seed: int = 42) -> TeamState:
    pf = next(p for p in content.portfolios if p.id == portfolio_id)
    return run_portfolio(content, pf, seed).state
