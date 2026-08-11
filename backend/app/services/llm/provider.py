from __future__ import annotations

import os

from app.config.settings import settings
from app.services.llm.base import LLMProvider
from app.services.llm.fallback import FallbackProvider
from app.services.llm.groq_provider import GroqProvider


def get_llm_provider() -> LLMProvider:
    """Pick the LLM provider based on settings + environment.

    - llm.provider == "fallback" or missing GROQ_API_KEY -> FallbackProvider
    - otherwise -> GroqProvider (may still raise LLMUnavailable at call time)
    """
    if settings.llm_provider == "fallback" or not os.getenv("GROQ_API_KEY", "").strip():
        return FallbackProvider()
    return GroqProvider()
