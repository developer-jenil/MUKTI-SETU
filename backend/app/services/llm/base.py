from __future__ import annotations

from abc import ABC, abstractmethod

from app.models import AdjournmentClassification


class LLMUnavailable(Exception):
    """Raised when the configured provider cannot answer (offline, no key, timeout)."""


class LLMProvider(ABC):
    """Perception-layer LLM interface.

    The LLM is used ONLY to classify adjournment delays. It never computes
    eligibility — that is the deterministic rule engine's job.
    """

    name: str = "base"

    @abstractmethod
    def classify_adjournment(self, text: str) -> AdjournmentClassification:
        """Classify court order text as DEFENSE_DELAY or COURT_DELAY."""
