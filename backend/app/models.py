from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class EligibilityStatus(str, Enum):
    """Statutory status vocabulary per the Section 479 spec.

    - ELIGIBLE: threshold met (the first proviso's one-third rule or s.479(1)'s one-half rule)
    - ELIGIBLE_FLAGGED: qualifying custody reaches the maximum sentence period
    - APPROACHING: >= 80% of the threshold, flagged for priority monitoring
    - NOT_YET_ELIGIBLE: below threshold
    - INELIGIBLE: excluded by statute (S.479(1) proviso or S.479(2))
    - INSUFFICIENT_DATA: missing mandatory facts -> human review
    """

    ELIGIBLE = "ELIGIBLE"
    ELIGIBLE_FLAGGED = "ELIGIBLE_FLAGGED"
    APPROACHING = "APPROACHING"
    NOT_YET_ELIGIBLE = "NOT_YET_ELIGIBLE"
    INELIGIBLE = "INELIGIBLE"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


class CaseFacts(BaseModel):
    case_id: str = Field(min_length=1)
    prisoner_id: str | None = None
    # Optional by default so partial facts evaluate to INSUFFICIENT_DATA
    # (the engine, not pydantic, decides what is missing).
    first_time_offender: bool | None = None
    multiple_pending_cases: bool | None = None
    punishable_by_death_or_life: bool | None = None
    maximum_sentence_years: float | None = Field(default=None, gt=0, le=100)
    detention_days: int | None = Field(default=None, ge=0)
    # Section 479 excludes detention caused by delay attributable to the accused.
    # These values are only applied by the rule engine after an authorised human
    # confirms the supporting source evidence.
    accused_delay_days: int = Field(default=0, ge=0)
    accused_delay_confirmed: bool = False
    accused_delay_source: str | None = None
    custody_start: date | None = None
    as_of_date: date | None = None

    @model_validator(mode="after")
    def derive_detention_days(self) -> "CaseFacts":
        if self.detention_days is None and self.custody_start and self.as_of_date:
            self.detention_days = max((self.as_of_date - self.custody_start).days, 0)
        return self


class RuleTrace(BaseModel):
    step: str
    result: str
    detail: str


class EligibilityDecision(BaseModel):
    case_id: str
    status: EligibilityStatus
    outcome: str
    eligible: bool
    detention_days: int | None
    threshold_days: int | None
    days_remaining: int | None
    progress_percent: float | None
    qualifying_detention_days: int | None = None
    excluded_delay_days: int = 0
    rule_version: str
    legal_basis: str
    reasons: list[str]
    exclusions: list[str]
    flags: list[str] = []
    trace: list[RuleTrace]
    requires_human_review: bool = True
    generated_at: datetime


class SourceValue(BaseModel):
    source: str
    value: Any
    confidence: float = Field(ge=0, le=1)
    observed_at: str | None = None


class SourceRecord(BaseModel):
    case_id: str = Field(min_length=1)
    field: str = Field(min_length=1)
    source: str = Field(min_length=1)
    value: Any
    confidence: float = Field(ge=0, le=1)
    observed_at: str | None = None


class ReconciledField(BaseModel):
    field: str
    selected_value: Any
    status: Literal["verified", "conflict", "single_source", "missing"]
    sources: list[SourceValue]
    rationale: str
    requires_human_review: bool = False


class WorkflowAction(BaseModel):
    action: Literal["submit", "verify", "approve", "reject", "request_changes"]
    actor: str = Field(min_length=2)
    note: str = ""


class WorkflowLevel(BaseModel):
    level: int  # 1 = Legal officer, 2 = Lawyer, 3 = Judge
    role: str
    status: Literal["PENDING", "APPROVED", "REJECTED", "LOCKED"] = "PENDING"
    actor: str | None = None
    note: str | None = None
    at: datetime | None = None


class WorkflowState(BaseModel):
    case_id: str
    levels: list[WorkflowLevel]
    current_level: int
    final_decision: Literal["PENDING", "APPROVED", "REJECTED"] = "PENDING"


class AdjournmentClassification(BaseModel):
    classification: Literal["DEFENSE_DELAY", "COURT_DELAY", "UNKNOWN"]
    confidence: float = Field(ge=0, le=1)
    delay_caused_by: str | None = None
    flag: str | None = None
    note: str | None = None


class SimulationRequest(BaseModel):
    maximum_sentence_years: float = Field(gt=0, le=100)
    detention_days: int = Field(ge=0)
    first_time_offender: bool
    multiple_pending_cases: bool = False
    punishable_by_death_or_life: bool = False
    accused_delay_days: int = Field(default=0, ge=0)
    accused_delay_confirmed: bool = False
    accused_delay_source: str | None = None


class GoldenTestResult(BaseModel):
    id: str
    name: str
    passed: bool
    expected: dict[str, Any]
    actual: dict[str, Any]
