from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

SETTINGS_PATH = Path(__file__).parent / "settings.yaml"

VALID_MODES = {"CLOUD", "LOCAL", "HYBRID"}


@dataclass(frozen=True)
class Settings:
    mode: str = "HYBRID"
    app_name: str = "MUKTI-SETU"
    app_version: str = "0.2.0"
    ocr_provider: str = "mock"
    ocr_languages: list[str] = field(default_factory=lambda: ["en", "hi"])
    llm_provider: str = "groq"
    llm_model: str = "llama3-70b-8192"
    llm_min_confidence: float = 0.90
    llm_timeout_seconds: int = 15
    db_url: str | None = None
    db_require_connection: bool = False
    truth_discovery_min_confidence: float = 0.85
    auth_required: bool = False
    auth_token_secret: str = "dev-only-change-me"
    audit_signing_secret: str = "dev-only-change-me"
    allowed_origins: list[str] = field(default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"])
    clamav_socket: str | None = None

    @property
    def is_cloud(self) -> bool:
        return self.mode == "CLOUD"

    @property
    def db_url_env(self) -> str:
        return os.getenv("DATABASE_URL", "").strip() or ""

    @classmethod
    def load(cls) -> "Settings":
        raw: dict[str, Any] = {}
        if SETTINGS_PATH.exists():
            raw = yaml.safe_load(SETTINGS_PATH.read_text(encoding="utf-8")) or {}
        mode = os.getenv("MODE", (raw.get("mode") or "HYBRID")).strip().upper()
        if mode not in VALID_MODES:
            mode = "HYBRID"

        app_cfg = raw.get("app", {}) or {}
        ocr_cfg = raw.get("ocr", {}) or {}
        llm_cfg = raw.get("llm", {}) or {}
        db_cfg = raw.get("db", {}) or {}
        policy = raw.get("policy", {}) or {}

        require_db = bool(db_cfg.get("require_connection", False)) or mode == "CLOUD"
        auth_required = os.getenv("AUTH_REQUIRED", str(mode == "CLOUD")).strip().lower() in {"1", "true", "yes", "on"}
        token_secret = os.getenv("AUTH_TOKEN_SECRET", "dev-only-change-me").strip()
        origins = [origin.strip() for origin in os.getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",") if origin.strip()]
        return cls(
            mode=mode,
            app_name=os.getenv("APP_NAME", app_cfg.get("name", "MUKTI-SETU")),
            app_version=os.getenv("APP_VERSION", app_cfg.get("version", "0.2.0")),
            ocr_provider=os.getenv("OCR_PROVIDER", ocr_cfg.get("provider", "mock")).strip().lower(),
            ocr_languages=ocr_cfg.get("languages", ["en", "hi"]),
            llm_provider=os.getenv("LLM_PROVIDER", llm_cfg.get("provider", "groq")).strip().lower(),
            llm_model=os.getenv("GROQ_MODEL", llm_cfg.get("model", "llama3-70b-8192")),
            llm_min_confidence=float(os.getenv("LLM_MIN_CONFIDENCE", llm_cfg.get("min_confidence", 0.90))),
            llm_timeout_seconds=int(llm_cfg.get("timeout_seconds", 15)),
            db_url=os.getenv("DATABASE_URL", "").strip() or None,
            db_require_connection=require_db,
            truth_discovery_min_confidence=float(policy.get("truth_discovery_min_confidence", 0.85)),
            auth_required=auth_required,
            auth_token_secret=token_secret,
            audit_signing_secret=os.getenv("AUDIT_SIGNING_SECRET", token_secret).strip(),
            allowed_origins=origins,
            clamav_socket=os.getenv("CLAMAV_SOCKET", "").strip() or None,
        )


def load_settings() -> Settings:
    return Settings.load()


settings = load_settings()
