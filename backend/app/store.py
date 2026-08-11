from __future__ import annotations

from datetime import date, datetime, timezone
import json
from pathlib import Path
from typing import Any

from app.core.rule_engine import RuleEngine
from app.models import CaseFacts, EligibilityDecision, EligibilityStatus

ENGINE = RuleEngine()

# Seed fallback for legacy imports
_mock_data = json.loads((Path(__file__).parents[1] / "data" / "mock_db.json").read_text(encoding="utf-8"))
PRISONERS: list[dict[str, Any]] = _mock_data["prisoners"]
CASES: list[dict[str, Any]] = _mock_data["cases"]


def get_all_cases(repo: Any | None = None) -> list[dict[str, Any]]:
    if repo and hasattr(repo, "get_cases"):
        return repo.get_cases()
    from app.db.repository import get_repository
    return get_repository().get_cases()


def get_all_prisoners(repo: Any | None = None) -> list[dict[str, Any]]:
    if repo and hasattr(repo, "get_prisoners"):
        return repo.get_prisoners()
    from app.db.repository import get_repository
    return get_repository().get_prisoners()


def case_bundle(case_id: str, repo: Any | None = None) -> dict[str, Any] | None:
    if repo is None:
        from app.db.repository import get_repository
        repo = get_repository()

    case = repo.get_case(case_id) if hasattr(repo, "get_case") else next((item for item in CASES if item["id"] == case_id), None)
    if not case:
        return None

    prisoner = repo.get_prisoner(case["prisoner_id"]) if hasattr(repo, "get_prisoner") else next((item for item in PRISONERS if item["id"] == case["prisoner_id"]), None)
    if not prisoner:
        prisoner = {
            "id": case.get("prisoner_id", "PRIS-UNKNOWN"),
            "prison_number": "UNKNOWN",
            "name": "Unknown Prisoner",
            "gender": "Not provided",
            "age": 30,
            "prison_name": "Not provided",
            "district": "Not provided",
            "state": "Not provided",
        }

    # Check if essential legal facts exist for rule engine evaluation
    custody_start_str = case.get("custody_start")
    has_essential_facts = bool(
        custody_start_str and
        case.get("maximum_sentence_years") is not None and
        case.get("first_time_offender") is not None
    )

    decision = None
    saved_decision = repo.get_decision(case_id) if hasattr(repo, "get_decision") else None
    if saved_decision:
        try:
            decision = EligibilityDecision.model_validate(saved_decision)
        except Exception:
            decision = None

    if not decision:
        if has_essential_facts and custody_start_str:
            try:
                facts = CaseFacts.model_validate({
                    "case_id": case["id"],
                    "prisoner_id": case["prisoner_id"],
                    "first_time_offender": case.get("first_time_offender"),
                    "multiple_pending_cases": case.get("multiple_pending_cases"),
                    "punishable_by_death_or_life": case.get("punishable_by_death_or_life"),
                    "maximum_sentence_years": case.get("maximum_sentence_years"),
                    "custody_start": date.fromisoformat(custody_start_str),
                    "as_of_date": datetime.now(timezone.utc).date(),
                })
                decision = ENGINE.evaluate(facts)
            except Exception:
                decision = None

    if not decision:
        decision = EligibilityDecision(
            case_id=case_id,
            status=EligibilityStatus.INSUFFICIENT_DATA,
            outcome="INSUFFICIENT_DATA",
            eligible=False,
            detention_days=None,
            threshold_days=None,
            days_remaining=None,
            progress_percent=None,
            qualifying_detention_days=None,
            excluded_delay_days=0,
            rule_version=ENGINE.rules["version"],
            legal_basis="Section 479 BNSS",
            reasons=["Incomplete legal parameters (custody start date, maximum sentence years, or offender status). Fails closed to human review."],
            exclusions=[],
            flags=["HUMAN_REVIEW_REQUIRED", "INCOMPLETE_CASE_DATA"],
            trace=[],
            requires_human_review=True,
            generated_at=datetime.now(timezone.utc),
        )

    return {"case": case, "prisoner": prisoner, "decision": decision}
