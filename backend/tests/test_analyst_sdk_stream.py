"""The streaming analyst against the real Anthropic SDK, with only the network replaced.

`tests/api/test_analyst_stream.py` uses a hand-written fake of the SDK. This file is stricter: it runs
the analyst through the SDK's own streaming client, fed the Messages API's real wire format (server-sent
events: `message_start`, `content_block_delta`, ...), so the SDK's parser, its final-message assembly and
its error handling are the real ones. It cannot show how the live model behaves (that needs an API key:
see `tests/test_live_analyst.py`), but it does show that this code and the SDK agree on the protocol.
"""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from pathlib import Path

import anthropic
import httpx2
import pytest

from app.core.config import Settings
from app.services.analyst import Analyst, AnalystUnavailable, AskBody
from sim.content import load_content

MODEL = "claude-opus-5-5"
QUESTION = AskBody(question="Why are complaints rising in the new counties?")


def sse(name: str, data: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(data)}\n\n"


def message_start() -> str:
    return sse(
        "message_start",
        {
            "type": "message_start",
            "message": {
                "id": "msg_01",
                "type": "message",
                "role": "assistant",
                "model": MODEL,
                "content": [],
                "stop_reason": None,
                "stop_sequence": None,
                "usage": {"input_tokens": 120, "output_tokens": 1},
            },
        },
    )


def text_block(index: int, pieces: list[str]) -> str:
    out = sse(
        "content_block_start",
        {"type": "content_block_start", "index": index, "content_block": {"type": "text", "text": ""}},
    )
    for p in pieces:
        out += sse(
            "content_block_delta",
            {
                "type": "content_block_delta",
                "index": index,
                "delta": {"type": "text_delta", "text": p},
            },
        )
    return out + sse("content_block_stop", {"type": "content_block_stop", "index": index})


def thinking_block(index: int, thought: str) -> str:
    return (
        sse(
            "content_block_start",
            {
                "type": "content_block_start",
                "index": index,
                "content_block": {"type": "thinking", "thinking": "", "signature": ""},
            },
        )
        + sse(
            "content_block_delta",
            {
                "type": "content_block_delta",
                "index": index,
                "delta": {"type": "thinking_delta", "thinking": thought},
            },
        )
        + sse(
            "content_block_delta",
            {
                "type": "content_block_delta",
                "index": index,
                "delta": {"type": "signature_delta", "signature": "sig"},
            },
        )
        + sse("content_block_stop", {"type": "content_block_stop", "index": index})
    )


def finish(stop_reason: str = "end_turn") -> str:
    return sse(
        "message_delta",
        {
            "type": "message_delta",
            "delta": {"stop_reason": stop_reason, "stop_sequence": None},
            "usage": {"output_tokens": 42},
        },
    ) + sse("message_stop", {"type": "message_stop"})


class Pieces(httpx2.SyncByteStream):
    """A response body that arrives in the given pieces, as it would off the network."""

    def __init__(self, pieces: list[bytes], then: Exception | None = None) -> None:
        self.pieces, self.then = pieces, then

    def __iter__(self) -> Iterator[bytes]:
        yield from self.pieces
        if self.then:
            raise self.then


def chunked(text: str, size: int) -> list[bytes]:
    raw = text.encode()
    return [raw[i : i + size] for i in range(0, len(raw), size)]


@pytest.fixture(scope="module")
def content(tmp_path_factory: pytest.TempPathFactory):
    return load_content(Settings(_env_file=None).content_dir)


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(
        _env_file=None, environment="test", anthropic_api_key=None, secret_key="x", data_dir=tmp_path
    )


def analyst_for(
    settings: Settings,
    content,
    respond: Callable[[httpx2.Request], httpx2.Response],
    seen: list | None = None,
) -> Analyst:
    """An Analyst whose Anthropic client is the real one, talking to `respond` instead of the network."""

    def handler(request: httpx2.Request) -> httpx2.Response:
        if seen is not None:
            seen.append(request)
        return respond(request)

    client = anthropic.Anthropic(
        api_key="sk-test-not-real",
        max_retries=0,  # the app retries; a test must not wait for it
        http_client=httpx2.Client(transport=httpx2.MockTransport(handler)),
    )
    return Analyst(settings, content, client)


def ok(body: str | list[bytes]) -> Callable[[httpx2.Request], httpx2.Response]:
    pieces = chunked(body, 1_000_000) if isinstance(body, str) else body
    return lambda _r: httpx2.Response(
        200, headers={"content-type": "text/event-stream"}, stream=Pieces(pieces)
    )


def run(analyst: Analyst, content) -> list[dict]:
    allowed = {a.id for a in content.datarooms["horizon"].artifacts}
    return list(analyst.ask_stream("horizon", allowed, QUESTION))


def first_source(analyst: Analyst, content) -> str:
    allowed = {a.id for a in content.datarooms["horizon"].artifacts}
    sources, _ = analyst._search("horizon", allowed, QUESTION)
    return sources[0].artifact_id


# ----------------------------------------------------------------- what is sent


def test_request_matches_the_one_shot_call_and_asks_for_a_stream(settings: Settings, content) -> None:
    seen: list[httpx2.Request] = []
    analyst = analyst_for(settings, content, ok(message_start() + text_block(0, ["Hi"]) + finish()), seen)
    run(analyst, content)

    request = seen[0]
    body = json.loads(request.content)
    assert request.method == "POST" and request.url.path == "/v1/messages"
    assert body.pop("stream") is True
    # everything else is exactly what the one-shot call sends, from the same helper
    expected = analyst._request_args("", "")
    for key in ("model", "max_tokens", "output_config", "fallbacks"):
        assert body[key] == expected[key]
    assert body["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert request.headers["anthropic-beta"] == "server-side-fallback-2026-07-01"
    assert "<question>" in body["messages"][0]["content"]


# ----------------------------------------------------------------- what comes back


def test_pieces_arrive_in_order_and_citations_come_from_the_final_text(settings: Settings, content) -> None:
    probe = analyst_for(settings, content, ok(""))
    cited = first_source(probe, content)
    pieces = ["Complaints ", "rose after ", f"the outreach change [{cited}]."]
    stream = message_start() + text_block(0, pieces) + finish()
    events = run(analyst_for(settings, content, ok(stream)), content)

    assert [e["type"] for e in events] == ["meta", "delta", "delta", "delta", "done"]
    assert [e["text"] for e in events if e["type"] == "delta"] == pieces
    answer = events[-1]["answer"]
    assert answer["answer"] == "".join(pieces) and answer["generative"] is True
    assert answer["citations"] == [cited] and answer["model"] == MODEL
    assert events[0]["generative"] is True and events[0]["sources"]


def test_a_thinking_block_before_the_text_is_never_shown(settings: Settings, content) -> None:
    stream = (
        message_start()
        + thinking_block(0, "PRIVATE-REASONING-MARKER weighs the sources first.")
        + text_block(1, ["The ", "answer."])
        + finish()
    )
    events = run(analyst_for(settings, content, ok(stream)), content)
    deltas = [e["text"] for e in events if e["type"] == "delta"]
    assert deltas == ["The ", "answer."]  # only the answer's own text is streamed
    assert events[-1]["answer"]["answer"] == "The answer."
    assert "PRIVATE-REASONING-MARKER" not in json.dumps(events)  # the thinking never reaches the page


def test_the_stream_can_be_cut_into_any_size_of_network_chunk(settings: Settings, content) -> None:
    stream = message_start() + text_block(0, ["Complaints rose — mostly ", "in new counties."]) + finish()
    for size in (1, 3, 7, 64):  # one byte at a time even splits the em dash across chunks
        events = run(analyst_for(settings, content, ok(chunked(stream, size))), content)
        assert (
            "".join(e["text"] for e in events if e["type"] == "delta")
            == "Complaints rose — mostly in new counties."
        )
        assert events[-1]["type"] == "done"


def test_a_refusal_replaces_whatever_was_written(settings: Settings, content) -> None:
    stream = message_start() + text_block(0, ["I can"]) + finish("refusal")
    events = run(analyst_for(settings, content, ok(stream)), content)
    answer = events[-1]["answer"]
    assert "can't help" in answer["answer"] and answer["citations"] == []


def test_a_cut_off_answer_is_marked(settings: Settings, content) -> None:
    stream = message_start() + text_block(0, ["Complaints rose in the new"]) + finish("max_tokens")
    events = run(analyst_for(settings, content, ok(stream)), content)
    assert "truncated" in events[-1]["answer"]["answer"]


def test_text_in_several_blocks_is_joined_like_the_one_shot_answer(settings: Settings, content) -> None:
    stream = message_start() + text_block(0, ["First part."]) + text_block(1, ["Second part."]) + finish()
    events = run(analyst_for(settings, content, ok(stream)), content)
    assert events[-1]["answer"]["answer"] == "First part.\nSecond part."


# ----------------------------------------------------------------- when Claude or the network fails


def test_an_overloaded_service_before_any_text_is_a_clear_error(settings: Settings, content) -> None:
    def respond(_r: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            529, json={"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}}
        )

    with pytest.raises(AnalystUnavailable, match="temporarily unavailable"):
        run(analyst_for(settings, content, respond), content)


def test_a_rate_limit_is_reported_as_being_at_capacity(settings: Settings, content) -> None:
    def respond(_r: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            429, json={"type": "error", "error": {"type": "rate_limit_error", "message": "slow down"}}
        )

    with pytest.raises(AnalystUnavailable, match="at capacity"):
        run(analyst_for(settings, content, respond), content)


def test_an_error_event_in_the_middle_of_a_stream_is_reported(settings: Settings, content) -> None:
    stream = (
        message_start()
        + text_block(0, ["Complaints "])
        + sse("error", {"type": "error", "error": {"type": "overloaded_error", "message": "Overloaded"}})
    )
    analyst = analyst_for(settings, content, ok(stream))
    allowed = {a.id for a in content.datarooms["horizon"].artifacts}
    seen: list[dict] = []
    with pytest.raises(AnalystUnavailable):
        for event in analyst.ask_stream("horizon", allowed, QUESTION):
            seen.append(event)
    # what had been written before the failure was still delivered, and no "done" follows
    assert [e["type"] for e in seen][:2] == ["meta", "delta"]
    assert "done" not in [e["type"] for e in seen]


@pytest.mark.parametrize(
    "failure",
    [httpx2.ReadError("reset"), httpx2.ReadTimeout("stalled"), httpx2.RemoteProtocolError("cut off")],
)
def test_a_connection_that_drops_mid_stream_is_a_clear_error_not_a_half_answer(
    settings: Settings, content, failure: Exception
) -> None:
    def respond(_r: httpx2.Request) -> httpx2.Response:
        pieces = chunked(message_start() + text_block(0, ["Half of an ans"]), 50)
        return httpx2.Response(
            200, headers={"content-type": "text/event-stream"}, stream=Pieces(pieces, then=failure)
        )

    analyst = analyst_for(settings, content, respond)
    allowed = {a.id for a in content.datarooms["horizon"].artifacts}
    seen: list[str] = []
    with pytest.raises(AnalystUnavailable, match="Cannot reach the AI service"):
        for event in analyst.ask_stream("horizon", allowed, QUESTION):
            seen.append(event["type"])
    assert "done" not in seen  # a half answer is never passed off as a finished one
