from __future__ import annotations

import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from app.models import CaseFacts, EligibilityDecision, EligibilityStatus, RuleTrace


DEFAULT_RULES_PATH = Path(__file__).parent / "rules" / "section_479.yaml"


class RuleEngine:
    """Deterministic Section 479 evaluator with an auditable decision trace.

    Evaluation order (per spec): completeness -> exclusions -> absolute cap -> thresholds.
    Pure Python only; the LLM never participates in eligibility calculation.
    """

    REQUIRED_FIELDS = (
        "first_time_offender",
        "multiple_pending_cases",
        "punishable_by_death_or_life",
        "maximum_sentence_years",
        "detention_days",
    )

    def __init__(self, rules_path: str | Path = DEFAULT_RULES_PATH) -> None:
        with Path(rules_path).open("r", encoding="utf-8") as rules_file:
            self.rules: dict[str, Any] = yaml.safe_load(rules_file)

    def evaluate(self, facts: CaseFacts | dict[str, Any]) -> EligibilityDecision:
        if not isinstance(facts, CaseFacts):
            facts = CaseFacts.model_validate(facts)

        trace: list[RuleTrace] = []
        reasons: list[str] = []
        missing = [field for field in self.REQUIRED_FIELDS if getattr(facts, field) is None]
        if missing:
            trace.append(RuleTrace(step="completeness", result="FAIL", detail=f"Missing: {', '.join(missing)}"))
            return self._decision(
                facts, EligibilityStatus.INSUFFICIENT_DATA, "HUMAN_REVIEW_REQUIRED", False,
                None, None, ["Required facts are incomplete."], [], [], trace,
            )
        trace.append(RuleTrace(step="completeness", result="PASS", detail="All mandatory facts are present."))

        # 1) The opening exclusion is absolute. Multiple pending proceedings
        # are evaluated after the maximum-period proviso because s.479(2) is
        # expressly subject to that proviso.
        death_life = self.rules["exclusions"][0]
        if bool(getattr(facts, death_life["field"])):
            trace.append(RuleTrace(step=death_life["code"], result="BLOCK", detail=death_life["message"]))
            return self._decision(
                facts, EligibilityStatus.INELIGIBLE, "STATUTORY_EXCLUSION", False,
                None, None, [death_life["message"]], [death_life["code"]], [], trace,
                legal_basis=self.rules["legal_basis"]["exclusion_death_life"],
            )
        trace.append(RuleTrace(step=death_life["code"], result="PASS", detail=death_life["message"]))

        maximum_days = math.ceil(float(facts.maximum_sentence_years) * int(self.rules["day_basis"]))

        # Detention attributable to delay caused by the accused is excluded
        # from the s.479 calculation, but an AI classification cannot change a
        # legal decision by itself. Until a designated reviewer confirms the
        # source evidence, fail closed to human review.
        actual_days = int(facts.detention_days)
        requested_delay = min(int(facts.accused_delay_days), actual_days)
        if requested_delay and not facts.accused_delay_confirmed:
            trace.append(RuleTrace(
                step="accused_delay", result="REVIEW_REQUIRED",
                detail="Accused-caused delay was supplied but not confirmed by an authorised reviewer.",
            ))
            return self._decision(
                facts, EligibilityStatus.INSUFFICIENT_DATA, "HUMAN_REVIEW_REQUIRED", False,
                None, None,
                ["Accused-caused delay requires human confirmation before it can be excluded."],
                [], ["ACCUSED_DELAY_REQUIRES_CONFIRMATION"], trace,
                legal_basis=self.rules["section"],
                qualifying_detention_days=actual_days,
                excluded_delay_days=0,
            )
        excluded_delay = requested_delay if facts.accused_delay_confirmed else 0
        qualifying_days = max(actual_days - excluded_delay, 0)
        trace.append(RuleTrace(
            step="accused_delay",
            result="APPLIED" if excluded_delay else "NONE",
            detail=(f"Excluded {excluded_delay} days supported by {facts.accused_delay_source or 'confirmed source'}."
                    if excluded_delay else "No confirmed accused-caused delay excluded."),
        ))

        # 2) Maximum-period proviso: no qualifying detention may exceed the
        # maximum sentence period. This check precedes s.479(2), as required
        # by the statute's "subject to" wording.
        cap = self.rules["absolute_cap"]
        if qualifying_days >= maximum_days:
            trace.append(RuleTrace(step="absolute_cap", result="TRIGGER", detail=cap["message"]))
            return self._decision(
                facts, EligibilityStatus.ELIGIBLE_FLAGGED, cap["outcome"], True,
                maximum_days, 0, [cap["message"]], [], [cap["flag"]], trace,
                legal_basis=cap["legal_basis"],
                qualifying_detention_days=qualifying_days,
                excluded_delay_days=excluded_delay,
            )
        trace.append(RuleTrace(step="absolute_cap", result="PASS", detail=f"Detention below the {maximum_days}-day maximum sentence."))

        multiple = self.rules["exclusions"][1]
        if bool(getattr(facts, multiple["field"])):
            trace.append(RuleTrace(step=multiple["code"], result="BLOCK", detail=multiple["message"]))
            return self._decision(
                facts, EligibilityStatus.INELIGIBLE, "STATUTORY_EXCLUSION", False,
                None, None, [multiple["message"]], [multiple["code"]], [], trace,
                legal_basis=self.rules["legal_basis"]["exclusion_multiple"],
                qualifying_detention_days=qualifying_days,
                excluded_delay_days=excluded_delay,
            )
        trace.append(RuleTrace(step=multiple["code"], result="PASS", detail=multiple["message"]))

        # 3) Threshold rules: first-time offenders use the first proviso's
        # one-third threshold; all others use the one-half threshold.
        category = "first_time_offender" if facts.first_time_offender else "other_undertrial"
        threshold_rule = self.rules["thresholds"][category]
        threshold_days = math.ceil(maximum_days * threshold_rule["numerator"] / threshold_rule["denominator"])
        days_remaining = max(threshold_days - qualifying_days, 0)
        progress = min(round(qualifying_days / threshold_days * 100, 1), 100.0)
        trace.append(RuleTrace(
            step="threshold", result=category.upper(),
            detail=f"ceil({maximum_days} x {threshold_rule['numerator']}/{threshold_rule['denominator']}) = {threshold_days} days",
        ))

        if qualifying_days >= threshold_days:
            status = EligibilityStatus.ELIGIBLE
            eligible = True
            outcome = threshold_rule["outcome"]
            reasons.append(f"Qualifying detention of {qualifying_days} days meets the {threshold_days}-day threshold ({threshold_rule['message']}).")
        elif progress >= float(self.rules["policy"]["approaching_threshold_percent"]):
            status = EligibilityStatus.APPROACHING
            eligible = False
            outcome = "PRIORITY_MONITORING"
            reasons.append(f"Threshold is approaching; {days_remaining} detention days remain.")
        else:
            status = EligibilityStatus.NOT_YET_ELIGIBLE
            eligible = False
            outcome = "CONTINUE_MONITORING"
            reasons.append(f"Threshold is not met; {days_remaining} detention days remain.")
        trace.append(RuleTrace(step="decision", result=status.value, detail=reasons[-1]))
        return self._decision(
            facts, status, outcome, eligible, threshold_days, days_remaining, reasons, [], [], trace,
            progress, legal_basis=threshold_rule["legal_basis"],
            qualifying_detention_days=qualifying_days,
            excluded_delay_days=excluded_delay,
        )

    def _decision(
        self,
        facts: CaseFacts,
        status: EligibilityStatus,
        outcome: str,
        eligible: bool,
        threshold_days: int | None,
        days_remaining: int | None,
        reasons: list[str],
        exclusions: list[str],
        flags: list[str],
        trace: list[RuleTrace],
        progress: float | None = None,
        legal_basis: str | None = None,
        qualifying_detention_days: int | None = None,
        excluded_delay_days: int = 0,
    ) -> EligibilityDecision:
        return EligibilityDecision(
            case_id=facts.case_id,
            status=status,
            outcome=outcome,
            eligible=eligible,
            detention_days=facts.detention_days,
            threshold_days=threshold_days,
            days_remaining=days_remaining,
            progress_percent=progress,
            qualifying_detention_days=qualifying_detention_days,
            excluded_delay_days=excluded_delay_days,
            rule_version=self.rules["version"],
            legal_basis=legal_basis or self.rules["section"],
            reasons=reasons,
            exclusions=exclusions,
            flags=flags,
            trace=trace,
            requires_human_review=self.rules["policy"]["require_human_review"],
            generated_at=datetime.now(timezone.utc),
        )
