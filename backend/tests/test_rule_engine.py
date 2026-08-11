from app.core.rule_engine import RuleEngine
from app.models import EligibilityStatus


def test_missing_data_requires_review() -> None:
    decision = RuleEngine().evaluate({"case_id": "missing", "detention_days": 20})
    assert decision.status == EligibilityStatus.INSUFFICIENT_DATA
    assert decision.requires_human_review


def test_approaching_threshold() -> None:
    decision = RuleEngine().evaluate({
        "case_id": "near", "first_time_offender": True, "multiple_pending_cases": False,
        "punishable_by_death_or_life": False, "maximum_sentence_years": 3, "detention_days": 300,
    })
    assert decision.status == EligibilityStatus.APPROACHING
    assert decision.days_remaining == 65


def test_absolute_cap_flags_case() -> None:
    decision = RuleEngine().evaluate({
        "case_id": "cap", "first_time_offender": False, "multiple_pending_cases": False,
        "punishable_by_death_or_life": False, "maximum_sentence_years": 3, "detention_days": 1096,
    })
    assert decision.status == EligibilityStatus.ELIGIBLE_FLAGGED
    assert decision.eligible is True
    assert "ABSOLUTE_CAP_EXCEEDED" in decision.flags
    assert decision.legal_basis == "S.479(1) third proviso"


def test_maximum_period_cap_precedes_multiple_pending_exclusion() -> None:
    decision = RuleEngine().evaluate({
        "case_id": "multi-cap", "first_time_offender": False, "multiple_pending_cases": True,
        "punishable_by_death_or_life": False, "maximum_sentence_years": 3, "detention_days": 1096,
    })
    assert decision.status == EligibilityStatus.ELIGIBLE_FLAGGED
    assert decision.outcome == "MAXIMUM_PERIOD_REVIEW"
    assert "ABSOLUTE_CAP_EXCEEDED" in decision.flags


def test_unconfirmed_accused_delay_fails_closed() -> None:
    decision = RuleEngine().evaluate({
        "case_id": "delay-review", "first_time_offender": True, "multiple_pending_cases": False,
        "punishable_by_death_or_life": False, "maximum_sentence_years": 3, "detention_days": 400,
        "accused_delay_days": 40, "accused_delay_source": "court_order#page-2",
    })
    assert decision.status == EligibilityStatus.INSUFFICIENT_DATA
    assert "ACCUSED_DELAY_REQUIRES_CONFIRMATION" in decision.flags


def test_confirmed_accused_delay_is_excluded_from_threshold() -> None:
    decision = RuleEngine().evaluate({
        "case_id": "delay-confirmed", "first_time_offender": True, "multiple_pending_cases": False,
        "punishable_by_death_or_life": False, "maximum_sentence_years": 3, "detention_days": 400,
        "accused_delay_days": 40, "accused_delay_confirmed": True,
        "accused_delay_source": "court_order#page-2",
    })
    assert decision.status == EligibilityStatus.APPROACHING
    assert decision.qualifying_detention_days == 360
    assert decision.excluded_delay_days == 40
    assert decision.days_remaining == 5


def test_exclusion_is_priority_over_threshold() -> None:
    decision = RuleEngine().evaluate({
        "case_id": "excl", "first_time_offender": True, "multiple_pending_cases": False,
        "punishable_by_death_or_life": True, "maximum_sentence_years": 3, "detention_days": 4000,
    })
    assert decision.status == EligibilityStatus.INELIGIBLE
    assert decision.exclusions == ["CAPITAL_OR_LIFE_OFFENCE"]
