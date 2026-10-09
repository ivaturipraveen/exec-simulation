"""Serializable simulation state. Everything here round-trips through JSON for persistence."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field

QUARTERS_PER_YEAR = 4
YEARS = 2


class InitiativeStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class Initiative(BaseModel):
    investment_id: str
    funded_round: int = Field(ge=1, le=2)
    start_quarter: int = Field(ge=0, description="Global 0-based quarter in which building starts")
    scope: str | None = None
    scope_factor: float = Field(default=1.0, gt=0, le=1)
    owner: str = Field(default="", max_length=120)
    status: InitiativeStatus = InitiativeStatus.ACTIVE
    progress: float = Field(default=0.0, ge=0.0, le=1.0)
    live_quarter: int | None = Field(default=None, description="Quarter in which delivery completed")
    capital_committed: float = Field(ge=0)
    capital_spent: float = Field(default=0.0, ge=0)
    capital_recovered: float = Field(default=0.0, ge=0)
    capital_written_off: float = Field(default=0.0, ge=0)
    draw: float = Field(default=0.5, ge=0.0, le=1.0, description="Position within the effect range")

    @property
    def remaining_commitment(self) -> float:
        return max(0.0, self.capital_committed - self.capital_spent - self.capital_written_off)

    @property
    def in_portfolio(self) -> bool:
        return self.status is not InitiativeStatus.CANCELLED

    def is_live_at(self, quarter: int) -> bool:
        """Delivered before ``quarter`` (effects start the quarter after go-live) and running."""
        return (
            self.status is InitiativeStatus.ACTIVE
            and self.live_quarter is not None
            and self.live_quarter < quarter
        )


class CapitalAdjustment(BaseModel):
    amount_musd: float
    reason: str
    by: str = "facilitator"


class Incident(BaseModel):
    quarter: int
    investment_id: str
    measure: str
    description: str
    member_harm: bool = True


class Contribution(BaseModel):
    investment_id: str
    measure: str
    base: float = Field(description="Base effect in improvement units")
    realized: float = Field(description="After multipliers and diminishing returns, improvement units")


class QuarterSnapshot(BaseModel):
    quarter: int = Field(description="1-based global quarter (1..8)")
    year: int
    quarter_of_year: int
    effects: dict[str, float] = Field(description="Full-effect improvement per measure (positive = better)")
    measures: dict[str, float] = Field(description="Full-effect run-rate value per measure (raw units)")
    kpis: dict[str, float]
    realization: dict[str, float] = Field(description="Per initiative: realized share of base effect")
    contributions: list[Contribution] = []
    progress: dict[str, float]
    capacity_demand: float
    capacity_supply: float
    capacity_utilization: float
    capacity_multiplier: float
    adoption: dict[str, float] = {}
    opex_musd: float
    savings_musd: float
    capital_spent_musd: float
    dual_ratio: float = 1.0


class TeamState(BaseModel):
    payer_id: str
    seed: int
    variable: bool = False
    quarter: int = Field(default=0, description="Quarters simulated so far")
    capital_round1_musd: float
    capital_round2_musd: float = 0.0
    adjustments: list[CapitalAdjustment] = []
    initiatives: list[Initiative] = []
    history: list[QuarterSnapshot] = []
    incidents: list[Incident] = []
    drift_accum: dict[str, float] = Field(default_factory=dict, description="Raw-unit drift so far")
    # Inputs from the exercises, used by conditions and scoring
    opmodel_missing_human_review: bool | None = None
    pitch_unsupported_figure: bool = False
    pitch_points_adjustment: float = 0.0

    @property
    def year(self) -> int:
        return self.quarter // QUARTERS_PER_YEAR

    def initiative(self, investment_id: str) -> Initiative | None:
        for ini in self.initiatives:
            if ini.investment_id == investment_id and ini.in_portfolio:
                return ini
        return None
