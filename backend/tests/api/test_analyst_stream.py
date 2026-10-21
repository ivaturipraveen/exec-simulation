"""The streaming analyst: `POST /api/team/ai/ask/stream` (server-sent events).

The AI service is replaced by a small fake that speaks the same streaming interface, so these run
offline and cost nothing. Live-model checks belong in tests/test_live_analyst.py.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from types import SimpleNamespace

import anthropic
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.services.analyst import Analyst, AskBody
from tests.api.helpers import auth, create_session, goto_kind, join_all, stage

QUESTION = {"question": "Why are complaints rising in new counties?"}
URL = "/api/team/ai/ask/stream"


def parse(lines: Iterator[str]) -> list[dict]:
    """Server-sent events back into their JSON payloads, in order."""
    events: list[dict] = []
    for line in lines:
        if line.startswith("data: "):
            events.append(json.loads(line[len("data: ") :]))
    return events


def ask(client: TestClient, headers: dict, body: dict | None = None) -> tuple[int, list[dict], str]:
    with client.stream("POST", URL, json=body or QUESTION, headers=headers) as r:
        content_type = r.headers.get("content-type", "")
        if r.status_code != 200:
            r.read()
            return r.status_code, [r.json()], content_type
        return r.status_code, parse(r.iter_lines()), content_type


def message(text_blocks: list[str], stop_reason: str = "end_turn") -> SimpleNamespace:
    return SimpleNamespace(
        stop_reason=stop_reason,
        model="fake-model",
        content=[SimpleNamespace(type="text", text=t) for t in text_blocks],
    )


class FakeStream:
    def __init__(self, pieces: list[str], final: SimpleNamespace, fail_after: int | None = None) -> None:
        self.pieces, self.final, self.fail_after = pieces, final, fail_after
        self.closed = False

    def __enter__(self) -> FakeStream:
        return self

    def __exit__(self, *exc) -> None:
        self.closed = True

    @property
    def text_stream(self) -> Iterator[str]:
        for i, piece in enumerate(self.pieces):
            if self.fail_after is not None and i >= self.fail_after:
                raise anthropic.APIConnectionError(request=httpx.Request("POST", "https://example.test"))
            yield piece

    def get_final_message(self) -> SimpleNamespace:
        return self.final


class FakeClient:
    """Stands in for `anthropic.Anthropic`: records the call and hands back one prepared stream."""

    def __init__(self, stream: FakeStream) -> None:
        self.stream_obj = stream
        self.calls: list[dict] = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))

    def _stream(self, **kwargs) -> FakeStream:
        self.calls.append(kwargs)
        return self.stream_obj


@pytest.fixture
def team(client: TestClient) -> dict:
    """A running session with the Horizon team in Diagnose, where the data room is open."""
    session, ftok = create_session(client, seed=7)
    teams = join_all(client, session)
    stage(client, session["id"], ftok, "start")
    goto_kind(client, session, ftok, "company")
    goto_kind(client, session, ftok, "diagnose")
    return {"headers": auth(teams["horizon"]), "session": session, "ftok": ftok}


def use_fake(client: TestClient, settings: Settings, stream: FakeStream) -> FakeClient:
    fake = FakeClient(stream)
    client.app.state.analyst = Analyst(settings, client.app.state.content, fake)  # type: ignore[arg-type]
    return fake


# ----------------------------------------------------------------- retrieval only (no API key)


def test_stream_matches_the_one_shot_answer(client: TestClient, team: dict) -> None:
    status, events, content_type = ask(client, team["headers"])
    assert status == 200 and content_type.startswith("text/event-stream")
    assert [e["type"] for e in events] == ["meta", "delta", "done"]

    one_shot = client.post("/api/team/ai/ask", json=QUESTION, headers=team["headers"]).json()
    final = events[-1]["answer"]
    assert final == one_shot
    assert events[0]["sources"] == one_shot["sources"] and events[0]["generative"] is False
    assert events[1]["text"] == one_shot["answer"]


def test_stream_is_scoped_to_the_team_data_room(client: TestClient, team: dict) -> None:
    _, events, _ = ask(client, team["headers"])
    assert all(s["artifact_id"].startswith("H-") for s in events[0]["sources"])


def test_stream_needs_a_team_sign_in(client: TestClient, team: dict) -> None:
    status, body, _ = ask(client, {})
    assert status == 401 and body[0]["error"]["code"] == "unauthorized"
    status, _, _ = ask(client, auth(team["ftok"]))  # the facilitator's token is not a team token
    assert status in (401, 403)


def test_stream_rejects_a_bad_question_before_streaming(client: TestClient, team: dict) -> None:
    status, body, _ = ask(client, team["headers"], {"question": "x"})
    assert status == 422 and "error" in body[0]


def test_stream_counts_against_the_rate_limit(tmp_path, database_url: str) -> None:
    settings = Settings(
        _env_file=None,
        environment="test",
        anthropic_api_key=None,
        secret_key="test-secret",
        data_dir=tmp_path,
        database_url=database_url,
        static_dir=tmp_path / "no-dist",
        ai_requests_per_10_min=1,
    )
    with TestClient(create_app(settings)) as client:
        session, ftok = create_session(client, seed=7)
        teams = join_all(client, session)
        stage(client, session["id"], ftok, "start")
        goto_kind(client, session, ftok, "company")
        goto_kind(client, session, ftok, "diagnose")
        headers = auth(teams["horizon"])
        assert ask(client, headers)[0] == 200
        status, body, _ = ask(client, headers)
        assert status == 429 and body[0]["error"]["code"] == "rate_limited"  # a normal JSON error
        assert client.post("/api/team/ai/ask", json=QUESTION, headers=headers).status_code == 429


# ----------------------------------------------------------------- with a (fake) AI service


def test_pieces_arrive_in_order_and_the_final_answer_carries_citations(
    client: TestClient, settings: Settings, team: dict
) -> None:
    probe = client.post("/api/team/ai/ask", json=QUESTION, headers=team["headers"]).json()
    cited_id = probe["sources"][0]["artifact_id"]
    pieces = ["Complaints ", "rose after the ", f"outreach change [{cited_id}]."]
    fake = use_fake(client, settings, FakeStream(pieces, message(["".join(pieces)])))

    status, events, _ = ask(client, team["headers"])
    assert status == 200
    assert [e["type"] for e in events] == ["meta", "delta", "delta", "delta", "done"]
    assert [e["text"] for e in events if e["type"] == "delta"] == pieces
    final = events[-1]["answer"]
    assert final["answer"] == "".join(pieces) and final["generative"] is True
    assert final["citations"] == [cited_id] and final["model"] == "fake-model"
    assert events[0]["generative"] is True
    assert fake.stream_obj.closed  # the AI connection is released

    sent = fake.calls[0]  # the streaming call carries the same settings as the one-shot call
    assert sent["model"] == settings.anthropic_model and sent["max_tokens"] == settings.ai_max_tokens
    assert sent["betas"] == ["server-side-fallback-2026-07-01"] and sent["fallbacks"] == "default"
    assert "<question>" in sent["messages"][0]["content"]


def test_truncated_answer_is_marked_in_the_final_event(
    client: TestClient, settings: Settings, team: dict
) -> None:
    use_fake(client, settings, FakeStream(["Half an ans"], message(["Half an ans"], "max_tokens")))
    _, events, _ = ask(client, team["headers"])
    assert "truncated" in events[-1]["answer"]["answer"]


def test_refusal_replaces_whatever_was_streamed(client: TestClient, settings: Settings, team: dict) -> None:
    use_fake(client, settings, FakeStream([], message([], "refusal")))
    _, events, _ = ask(client, team["headers"])
    assert [e["type"] for e in events] == ["meta", "done"]
    assert events[-1]["answer"]["citations"] == [] and "can't help" in events[-1]["answer"]["answer"]


def test_failure_part_way_arrives_as_an_error_event(
    client: TestClient, settings: Settings, team: dict
) -> None:
    pieces = ["Partial ", "answer ", "never finishes"]
    use_fake(client, settings, FakeStream(pieces, message(pieces), fail_after=2))
    status, events, _ = ask(client, team["headers"])
    assert status == 200  # the status line was already sent when the failure happened
    assert [e["type"] for e in events] == ["meta", "delta", "delta", "error"]
    assert events[-1]["message"] == "Cannot reach the AI service — check the network"
    assert "done" not in [e["type"] for e in events]


def test_an_unexpected_failure_is_a_plain_error_that_leaks_no_internals(
    client: TestClient, team: dict, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(*_args, **_kwargs):
        yield {"type": "meta", "sources": [], "generative": False}
        raise RuntimeError("secret internal detail: db password=hunter2")

    monkeypatch.setattr(client.app.state.analyst, "ask_stream", boom)
    status, events, _ = ask(client, team["headers"])
    assert status == 200
    assert events[-1] == {"type": "error", "message": "The analyst ran into a problem — try again"}
    assert "hunter2" not in json.dumps(events) and "secret internal" not in json.dumps(events)


def test_failure_does_not_log_an_answer(client: TestClient, settings: Settings, team: dict) -> None:
    use_fake(client, settings, FakeStream(["a"], message(["a"]), fail_after=0))
    ask(client, team["headers"])
    log = client.get(f"/api/sessions/{team['session']['id']}/events", headers=auth(team["ftok"]))
    assert log.status_code == 200
    assert "ai_answer" not in [e["kind"] for e in log.json()]


def test_a_finished_stream_is_logged_like_the_one_shot_answer(
    client: TestClient, settings: Settings, team: dict
) -> None:
    use_fake(client, settings, FakeStream(["ok"], message(["ok"])))
    ask(client, team["headers"])
    log = client.get(f"/api/sessions/{team['session']['id']}/events", headers=auth(team["ftok"]))
    assert log.status_code == 200
    assert [e["kind"] for e in log.json()].count("ai_answer") == 1


# ----------------------------------------------------------------- the service on its own


def test_ask_stream_without_a_client_yields_the_retrieval_answer(settings: Settings) -> None:
    app = create_app(settings)
    analyst: Analyst = app.state.analyst
    allowed = {a.id for a in app.state.content.datarooms["horizon"].artifacts}
    body = AskBody(question="Why are complaints rising in new counties?")
    events = list(analyst.ask_stream("horizon", allowed, body))
    assert [e["type"] for e in events] == ["meta", "delta", "done"]
    assert events[1]["text"] == analyst.ask("horizon", allowed, body).answer
