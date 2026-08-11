from __future__ import annotations

import json
import os

import httpx

from app.config.settings import settings
from app.models import AdjournmentClassification
from app.services.llm.base import LLMProvider, LLMUnavailable

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are a conservative legal-document assistant. You classify the reason for "
    "adjournments recorded in Indian court orders. Return ONLY a JSON object: "
    '{"classification": "DEFENSE_DELAY" | "COURT_DELAY", "confidence": <0.0-1.0>, '
    '"reason": "<short quote>"}. If the cause is unclear, prefer COURT_DELAY. '
    "Never invent facts not present in the text."
)


class GroqProvider(LLMProvider):
    """Online LLM provider backed by the Groq API (llama3-70b-8192)."""

    name = "groq"

    def __init__(self) -> None:
        self.api_key = os.getenv("GROQ_API_KEY", "").strip()
        self.model = settings.llm_model
        self.min_confidence = settings.llm_min_confidence

    def classify_adjournment(self, text: str) -> AdjournmentClassification:
        if not self.api_key:
            raise LLMUnavailable("GROQ_API_KEY is not configured.")
        sample = text[:3000]  # keep the request bounded
        payload = {
            "model": self.model,
            "temperature": 0.0,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Court order text:\n{sample}"},
            ],
        }
        try:
            response = httpx.post(
                GROQ_ENDPOINT,
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload,
                timeout=settings.llm_timeout_seconds,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content.strip().strip("`").lstrip("json"))
        except Exception as exc:
            raise LLMUnavailable(f"Groq request failed: {exc}") from exc

        classification = parsed.get("classification", "UNKNOWN").upper()
        if classification not in {"DEFENSE_DELAY", "COURT_DELAY"}:
            classification = "UNKNOWN"
        confidence = float(parsed.get("confidence", 0.0))
        flag = None if confidence >= self.min_confidence else "HUMAN_REVIEW_REQUIRED"
        return AdjournmentClassification(
            classification=classification,  # type: ignore[arg-type]
            confidence=confidence,
            delay_caused_by="defense" if classification == "DEFENSE_DELAY" else "court" if classification == "COURT_DELAY" else None,
            flag=flag,
            note="LLM classified" + (" (low confidence)" if flag else ""),
        )
