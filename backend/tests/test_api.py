from fastapi.testclient import TestClient
from pathlib import Path

from app.main import app
from app.main import WORKFLOW


client = TestClient(app)


def test_golden_endpoint() -> None:
    response = client.get("/api/golden-tests")
    assert response.status_code == 200
    assert response.json()["passed"] is True
    assert response.json()["total"] == 5


def test_four_eye_rule_rejects_same_actor() -> None:
    WORKFLOW.submit("CASE-1042", actor="Test setup", actor_role="SYSTEM")
    verified = client.post("/api/cases/CASE-1042/workflow", json={"action": "verify", "actor": "Officer A", "note": "Checked"})
    assert verified.status_code == 200
    approved = client.post("/api/cases/CASE-1042/workflow", json={"action": "approve", "actor": "Officer A", "note": "Approve"})
    assert approved.status_code == 409


def test_workflow_level_endpoint_validates_pending_level() -> None:
    WORKFLOW.submit("CASE-2088", actor="Test setup", actor_role="SYSTEM")
    verified = client.post("/api/cases/CASE-2088/workflow", json={"action": "verify", "actor": "Officer B", "note": "Checked"})
    assert verified.status_code == 200
    wrong = client.post("/api/workflow/approve/3", json={"case_id": "CASE-2088", "actor": "Lawyer C", "note": ""})
    assert wrong.status_code == 409
    right = client.post("/api/workflow/approve/2", json={"case_id": "CASE-2088", "actor": "Lawyer C", "note": ""})
    assert right.status_code == 200
    assert right.json()["levels"][1]["status"] == "APPROVED"


def test_upload_rejects_unsupported_document_type() -> None:
    response = client.post("/api/upload", files={"file": ("payload.exe", b"MZ", "application/octet-stream")})
    assert response.status_code == 415


def test_upload_extracts_pdf_text_and_fir() -> None:
    pdf_path = Path(__file__).parents[2] / "mock_data" / "court_orders" / "case_001_order.pdf"
    response = client.post("/api/upload", files={"file": (pdf_path.name, pdf_path.read_bytes(), "application/pdf")})
    assert response.status_code == 200
    assert response.json()["analysis"]["extracted"]["fir_number"] == "221/2024"


def test_reconcile_validates_source_confidence() -> None:
    response = client.post("/api/reconcile", json=[{
        "case_id": "CASE-X", "field": "custody_start", "source": "ocr",
        "value": "2024-01-01", "confidence": 2.0,
    }])
    assert response.status_code == 422
