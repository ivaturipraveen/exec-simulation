"""Team workspace: everything a team decides or writes that is not simulation state."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from sim.content.models import Severity
from sim.engine import CrisisResponse, OperatingModelDesign, PitchSubmission, RubricScore

Text = Annotated[str, Field(max_length=2000)]
ShortText = Annotated[str, Field(max_length=200)]
Score5 = Annotated[int, Field(ge=1, le=5)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Priority(_Strict):
    title: Annotated[str, Field(min_length=1, max_length=160)]
    rationale: Text = ""
    evidence: Annotated[list[str], Field(max_length=8)] = []


class DraftItem(_Strict):
    investment_id: str
    scope: str | None = None
    start_offset: Annotated[int, Field(ge=0, le=3)] = 0
    owner: ShortText = ""


class Round2Action(_Strict):
    action: Literal["fund", "pause", "resume", "cancel", "owner"]
    investment_id: str
    scope: str | None = None
    start_offset: Annotated[int, Field(ge=0, le=3)] = 0
    owner: ShortText = ""


class Readiness(_Strict):
    data: Score5 = 3
    workflow: Score5 = 3
    owner: Score5 = 3
    controls: Score5 = 3

    @property
    def average(self) -> float:
        return (self.data + self.workflow + self.owner + self.controls) / 4


class Opportunity(_Strict):
    """Pack 10.3 capture fields."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    participant: ShortText
    title: Annotated[str, Field(min_length=1, max_length=200)]
    capability_class: str
    value_hypothesis: Text = ""
    value: Score5
    readiness: Readiness = Readiness()
    dependencies: Text = ""
    risks: Text = ""
    owner: ShortText = ""
    next_step: Text = ""
    foundations: Annotated[list[str], Field(max_length=4)] = []


class Consent(_Strict):
    granted: bool
    participant: ShortText = ""
    at: datetime


class Feedback(_Strict):
    participant: ShortText = ""
    learning: Score5
    judgment_changed: bool
    usefulness_vs_presentation: Score5
    realism: Score5
    would_recommend: Annotated[int, Field(ge=0, le=10)]
    comments: Text = ""
    at: datetime | None = None


class Workspace(BaseModel):
    priorities: Annotated[list[Priority], Field(max_length=3)] = []
    thesis_r1: Text = ""
    round1_draft: list[DraftItem] = []
    round1_submitted_at: datetime | None = None
    thesis_r2: Text = ""
    round2_draft: list[Round2Action] = []
    round2_submitted_at: datetime | None = None
    pitch: PitchSubmission = PitchSubmission()
    pitch_submitted_at: datetime | None = None
    pitch_score: RubricScore | None = None
    pitch_figures: list[str] = []
    round2_base_musd: float | None = None
    opmodel_design: OperatingModelDesign | None = None
    opmodel_score: RubricScore | None = None
    opmodel_findings: list[str] = []
    opmodel_submitted_at: datetime | None = None
    crisis_event_id: str | None = None
    crisis_severity: Severity | None = None
    crisis_assigned_at: datetime | None = None
    crisis_response: CrisisResponse | None = None
    crisis_score: RubricScore | None = None
    opportunities: list[Opportunity] = []
    consent: Consent | None = None
    feedback: list[Feedback] = []
    ai_requests: int = 0
    ai_window_start: datetime | None = None
    ai_window_count: int = 0
