from app.services.llm.fallback import FallbackProvider
from app.services.llm.groq_provider import GroqProvider
from app.services.llm.base import LLMUnavailable
from app.services.reconciliation import reconcile
from app.services.perception import PerceptionService
from pathlib import Path


def test_fallback_is_conservative() -> None:
    classification = FallbackProvider().classify_adjournment("Hearing posted to next date.")
    assert classification.classification == "COURT_DELAY"
    assert classification.confidence == 0.50
    assert classification.flag == "HUMAN_REVIEW_REQUIRED"


def test_fallback_detects_defense_delay() -> None:
    classification = FallbackProvider().classify_adjournment("Counsel for the accused sought adjournment.")
    assert classification.classification == "DEFENSE_DELAY"
    assert classification.delay_caused_by == "defense"


def test_groq_requires_key() -> None:
    provider = GroqProvider()
    if not provider.api_key:
        try:
            provider.classify_adjournment("some text")
            raise AssertionError("expected LLMUnavailable without an API key")
        except LLMUnavailable:
            pass


def test_reconciliation_flags_conflict() -> None:
    fields = reconcile([
        {"case_id": "CASE-X", "field": "custody_start", "source": "court_order", "value": "2024-01-15", "confidence": 0.98},
        {"case_id": "CASE-X", "field": "custody_start", "source": "prison_register", "value": "2024-01-17", "confidence": 0.94},
    ])
    assert fields[0]["status"] == "conflict"
    assert fields[0]["selected_value"] == "2024-01-15"
    assert fields[0]["requires_human_review"] is True


def test_reconciliation_low_confidence_flags_review() -> None:
    fields = reconcile([
        {"case_id": "CASE-X", "field": "maximum_sentence_years", "source": "ocr", "value": 7, "confidence": 0.60},
    ])
    assert fields[0]["status"] == "single_source"
    assert fields[0]["requires_human_review"] is True


def test_perception_fails_closed_without_text() -> None:
    analysis = PerceptionService().analyze("order.txt", b"")
    assert analysis["provider"] == "manual-review"
    assert analysis["requires_human_review"] is True


def test_pdf_intake_extracts_sample_fir_and_page_evidence() -> None:
    pdf_path = Path(__file__).parents[2] / "mock_data" / "court_orders" / "case_001_order.pdf"
    analysis = PerceptionService().analyze(pdf_path.name, pdf_path.read_bytes())
    assert analysis["extracted"]["fir_number"] == "221/2024"
    assert analysis["pages"] >= 1
    assert analysis["evidence"]
