from __future__ import annotations

import io
from pathlib import Path
from fastapi.testclient import TestClient
import pytest

from app.db.repository import MockRepository
from app.main import app, REPOSITORY, WORKFLOW
from app.services.workflow.four_eye import FourEyeManager

TEST_DOCUMENT_TEXT = """
IN THE COURT OF THE SESSIONS JUDGE, CHENNAI

Case ID: CASE-UPLOAD-314
FIR 314/2026

Prisoner Name: Rohan Mehta
Prisoner Number: TN-DEMO-701
Age: 31
Gender: Male
Prison Name: Central Prison, Puzhal
District: Chennai
State: Tamil Nadu

Sections: IPC 379, IPC 411
Case Status: Undertrial
Custody Start: 2024-01-15
Maximum Sentence Years: 3
First-time Offender: Yes
Multiple Pending Cases: No
Punishable by Death or Life Imprisonment: No
Next Hearing: 2026-08-18

The matter was adjourned because the court cause list was overburdened.
Counsel for the accused stated readiness to proceed.

Ordered accordingly.
"""


@pytest.fixture
def isolated_repo(tmp_path, monkeypatch):
    """Ensure all test operations run against an isolated temporary repository."""
    test_state_file = tmp_path / "test_mock_state.json"
    repo = MockRepository(path=test_state_file)
    workflow_mgr = FourEyeManager(repository=repo)

    # Seed initial cases into workflow
    for case in repo.get_cases():
        if not workflow_mgr.events(case["id"]):
            workflow_mgr.submit(case["id"], actor_role="SYSTEM")

    monkeypatch.setattr("app.main.REPOSITORY", repo)
    monkeypatch.setattr("app.main.WORKFLOW", workflow_mgr)
    return repo, workflow_mgr, test_state_file


def test_upload_existing_fir_links_to_case_1042(isolated_repo):
    repo, workflow_mgr, _ = isolated_repo
    client = TestClient(app)

    pdf_path = Path(__file__).parents[2] / "mock_data" / "court_orders" / "case_001_order.pdf"
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    response = client.post("/api/upload", files={"file": ("case_001_order.pdf", pdf_bytes, "application/pdf")})
    assert response.status_code == 200
    data = response.json()

    assert data["case_id"] == "CASE-1042"
    assert data["matched_existing_case"] is True
    assert data["created_new_case"] is False

    # Confirm case count remains unchanged (no duplicate created)
    cases = repo.get_cases()
    assert len([c for c in cases if c["id"] == "CASE-1042"]) == 1


def test_upload_new_structured_document_creates_case(isolated_repo):
    repo, workflow_mgr, _ = isolated_repo
    client = TestClient(app)

    file_bytes = TEST_DOCUMENT_TEXT.encode("utf-8")
    response = client.post("/api/upload", files={"file": ("case_314_intake.txt", file_bytes, "text/plain")})
    assert response.status_code == 200
    data = response.json()

    assert data["created_new_case"] is True
    assert data["matched_existing_case"] is False
    assert data["case_id"] == "CASE-UPLOAD-314"
    assert data["prisoner_id"] == "TN-DEMO-701"

    # Analysis check
    analysis = data["analysis"]
    assert analysis["adjournment"]["classification"] == "COURT_DELAY"

    # Case details check
    case_resp = client.get(f"/api/cases/{data['case_id']}")
    assert case_resp.status_code == 200
    bundle = case_resp.json()
    assert bundle["prisoner"]["name"] == "Rohan Mehta"
    assert bundle["case"]["fir_number"] == "314/2026"


def test_new_case_appears_in_dashboard(isolated_repo):
    repo, workflow_mgr, _ = isolated_repo
    client = TestClient(app)

    # Upload document first
    file_bytes = TEST_DOCUMENT_TEXT.encode("utf-8")
    client.post("/api/upload", files={"file": ("case_314_intake.txt", file_bytes, "text/plain")})

    # Dashboard check
    dash_resp = client.get("/api/dashboard")
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()

    # Metrics include new case
    assert dash_data["metrics"]["total_cases"] >= 6
    recent_ids = [bundle["case"]["id"] for bundle in dash_data["recent_cases"]]
    assert "CASE-UPLOAD-314" in recent_ids


def test_workflow_three_level_approval_chain(isolated_repo):
    repo, workflow_mgr, _ = isolated_repo
    client = TestClient(app)

    file_bytes = TEST_DOCUMENT_TEXT.encode("utf-8")
    client.post("/api/upload", files={"file": ("case_314_intake.txt", file_bytes, "text/plain")})

    case_id = "CASE-UPLOAD-314"

    # Initial workflow state
    wf_resp = client.get(f"/api/cases/{case_id}/workflow")
    assert wf_resp.status_code == 200
    assert wf_resp.json()["final_decision"] == "PENDING"
    assert wf_resp.json()["levels"][0]["status"] == "PENDING"

    # Step 1: Legal Officer A verifies
    headers = {"X-User-ID": "Legal Officer A", "X-User-Role": "LEGAL_OFFICER"}
    act1 = client.post(f"/api/cases/{case_id}/workflow", json={"action": "verify", "actor": "Legal Officer A", "note": "Documents checked"}, headers=headers)
    assert act1.status_code == 200
    assert act1.json()["levels"][0]["status"] == "APPROVED"

    # Step 2: Attempt approval with same actor (Legal Officer A) -> Should fail 409
    headers_lawyer_same = {"X-User-ID": "Legal Officer A", "X-User-Role": "LAWYER"}
    act2_fail = client.post(f"/api/cases/{case_id}/workflow", json={"action": "approve", "actor": "Legal Officer A", "note": "Same actor"}, headers=headers_lawyer_same)
    assert act2_fail.status_code == 409
    assert "independent actor" in act2_fail.json()["detail"].lower()

    # Step 3: Independent Lawyer B approves Level 2
    headers_lawyer = {"X-User-ID": "Lawyer B", "X-User-Role": "LAWYER"}
    act2 = client.post(f"/api/cases/{case_id}/workflow", json={"action": "approve", "actor": "Lawyer B", "note": "Legal merit verified"}, headers=headers_lawyer)
    assert act2.status_code == 200
    assert act2.json()["levels"][1]["status"] == "APPROVED"

    # Step 4: Independent Judge C approves Level 3
    headers_judge = {"X-User-ID": "Judge C", "X-User-Role": "JUDGE"}
    act3 = client.post(f"/api/cases/{case_id}/workflow", json={"action": "approve", "actor": "Judge C", "note": "Final order approved"}, headers=headers_judge)
    assert act3.status_code == 200
    assert act3.json()["levels"][2]["status"] == "APPROVED"
    assert act3.json()["final_decision"] == "APPROVED"


def test_persistence_survives_repository_reload(isolated_repo):
    repo, workflow_mgr, state_file_path = isolated_repo
    client = TestClient(app)

    file_bytes = TEST_DOCUMENT_TEXT.encode("utf-8")
    client.post("/api/upload", files={"file": ("case_314_intake.txt", file_bytes, "text/plain")})

    case_id = "CASE-UPLOAD-314"
    headers_off = {"X-User-ID": "Legal Officer A", "X-User-Role": "LEGAL_OFFICER"}
    client.post(f"/api/cases/{case_id}/workflow", json={"action": "verify", "actor": "Legal Officer A"}, headers=headers_off)

    # Re-instantiate repository from the same saved file
    reloaded_repo = MockRepository(path=state_file_path)
    reloaded_workflow = FourEyeManager(repository=reloaded_repo)

    case_record = reloaded_repo.get_case("CASE-UPLOAD-314")
    assert case_record is not None
    assert case_record["fir_number"] == "314/2026"

    prisoner_record = reloaded_repo.get_prisoner("TN-DEMO-701")
    assert prisoner_record is not None
    assert prisoner_record["name"] == "Rohan Mehta"

    wf_summary = reloaded_workflow.summary("CASE-UPLOAD-314")
    assert wf_summary["levels"][0]["status"] == "APPROVED"
    assert wf_summary["levels"][0]["actor"] == "Legal Officer A"
