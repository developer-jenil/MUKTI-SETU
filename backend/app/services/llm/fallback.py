from __future__ import annotations

import re

from app.models import AdjournmentClassification
from app.services.llm.base import LLMProvider

# Keywords that indicate the DEFENCE asked for the adjournment.
DEFENSE_PATTERNS = (
    r"defen[cs]e\s*(counsel)?\s*(sought|prayed|requested|asked for|applied for)",
    r"on\s+behalf\s+of\s+the\s+accused\s+(sought|prayed|requested|asked for|applied for)",
    r"counsel\s+for\s+the\s+accused\s+(sought|prayed|requested|asked for|applied for|absent|not present)",
)
COURT_PATTERNS = (
    r"court\s*(itself)?\s*(adjourned|posted)",
    r"due\s+to\s+(non|un)availability\s+of\s+(the\s+)?judge",
    r"court\s+holidays?",
    r"case\s+not\s+taken\s+up",
    r"cause\s+list\s+.*?(overburdened|heavy)",
)


class FallbackProvider(LLMProvider):
    """Offline conservative classifier.

    The default is COURT_DELAY with 0.50 confidence and a mandatory human-review
    flag — no time is ever deducted from a prisoner's custody because the AI
    could not verify the cause.
    """

    name = "fallback"

    def classify_adjournment(self, text: str) -> AdjournmentClassification:
        lowered = text.lower()
        for pattern in DEFENSE_PATTERNS:
            if re.search(pattern, lowered):
                return AdjournmentClassification(
                    classification="DEFENSE_DELAY",
                    confidence=0.55,
                    delay_caused_by="defense",
                    flag="HUMAN_REVIEW_REQUIRED",
                    note="Keyword-matched defense request; offline estimate, verify manually.",
                )
        for pattern in COURT_PATTERNS:
            if re.search(pattern, lowered):
                return AdjournmentClassification(
                    classification="COURT_DELAY",
                    confidence=0.60,
                    delay_caused_by="court",
                    flag="HUMAN_REVIEW_REQUIRED",
                    note="Keyword-matched court delay; offline estimate, verify manually.",
                )
        return AdjournmentClassification(
            classification="COURT_DELAY",
            confidence=0.50,
            delay_caused_by="court",
            flag="HUMAN_REVIEW_REQUIRED",
            note="Offline fallback — conservative estimate.",
        )
