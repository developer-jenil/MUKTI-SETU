from __future__ import annotations

from datetime import date, datetime, timezone
import json
import os
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config.settings import settings
from app.core.auth import Principal, ROLE_CODES, require_principal
from app.core.rule_engine import RuleEngine
from app.db.repository import get_repository
from app.golden import run_golden_tests
from app.models import CaseFacts, EligibilityDecision, EligibilityStatus, SimulationRequest, SourceRecord, WorkflowAction
from app.services.perception import PerceptionService
from app.services.reconciliation import reconcile
from app.services.workflow.four_eye import FourEyeManager, WorkflowError
from app.store import case_bundle

PERCEPTION = PerceptionService()
REPOSITORY = get_repository()
ENGINE = RuleEngine()
WORKFLOW = FourEyeManager(repository=REPOSITORY, signing_secret=settings.audit_signing_secret)

# Seed only cases that have no persisted workflow. Existing events are replayed
# from the append-only repository by FourEyeManager.
for case in REPOSITORY.get_cases():
    if not WORKFLOW.events(case["id"]):
        WORKFLOW.submit(case["id"], actor_role="SYSTEM")

app = FastAPI(
    title="MUKTI-SETU API",
    version=settings.app_version,
    description="Human-in-the-loop legal aid intelligence — Statutory Compliance Orchestration Platform",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-User-ID", "X-User-Role"],
)


class LevelAction(BaseModel):
    """Body for the spec endpoints /api/workflow/approve|reject/{level}."""

    case_id: str = Field(min_length=1)
    actor: str = Field(min_length=2)
    note: str = ""


def _demo_role(case_id: str, action: str) -> str:
    if action == "submit":
        return "SYSTEM"
    pending = _pending_level(case_id)
    if action == "verify":
        return ROLE_CODES[1]
    return ROLE_CODES.get(pending or 1, ROLE_CODES[1])


def _actor_context(case_id: str, action: str, requested_actor: str, principal: Principal) -> tuple[str, str]:
    if settings.auth_required or principal.user_id != "demo-user":
        return principal.user_id, principal.role
    return requested_actor.strip(), _demo_role(case_id, action)


def _scan_upload(content: bytes) -> None:
    if not settings.clamav_socket and not settings.is_cloud:
        return
    try:
        import clamd  # type: ignore

        scanner = clamd.ClamdUnixSocket(path=settings.clamav_socket) if settings.clamav_socket else clamd.ClamdUnixSocket()
        result = scanner.instream(content)
        status = result.get("stream", ("UNKNOWN", ""))[0]
        if status == "FOUND":
            raise HTTPException(422, "Document rejected by malware scanner")
        if status != "OK":
            raise RuntimeError(f"ClamAV returned {status}")
    except HTTPException:
        raise
    except Exception as exc:
        if settings.is_cloud:
            raise HTTPException(503, "Malware scanner unavailable; upload rejected") from exc


def _conflict_count() -> int:
    path = Path(__file__).parents[1] / "data" / "source_conflicts.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return sum(len(records) for records in payload.values())
    except Exception:
        return 7


@app.get("/api/health")
def health() -> dict[str, str]:
    llm_active = settings.llm_provider == "groq" and bool(os.getenv("GROQ_API_KEY", "").strip())
    return {
        "status": "ok",
        "mode": settings.mode,
        "persistence": REPOSITORY.name,
        "ocr_provider": settings.ocr_provider,
        "llm_provider": "groq" if llm_active else "fallback",
        "rule_version": ENGINE.rules["version"],
        "auth_required": str(settings.auth_required).lower(),
    }


@app.get("/api/golden-tests")
def golden_tests() -> dict[str, object]:
    results = run_golden_tests()
    return {"passed": all(result.passed for result in results), "total": len(results), "results": results}


@app.get("/api/dashboard")
def dashboard() -> dict[str, object]:
    all_cases = REPOSITORY.get_cases()
    bundles = [case_bundle(c["id"], repo=REPOSITORY) for c in all_cases]
    bundles = [b for b in bundles if b is not None]
    return {
        "metrics": {
            "total_cases": len(all_cases),
            "eligible": sum(b["decision"].eligible for b in bundles),
            "approaching": sum(b["decision"].status.value == "APPROACHING" for b in bundles),
            "flagged": sum(b["decision"].status.value == "ELIGIBLE_FLAGGED" for b in bundles),
            "ineligible": sum(b["decision"].status.value == "INELIGIBLE" for b in bundles),
            "conflicts": _conflict_count(),
            "pending_review": sum(WORKFLOW.state(c["id"]).final_decision == "PENDING" for c in all_cases),
        },
        "recent_cases": bundles,
    }


@app.get("/api/prisoners")
def prisoners() -> list[dict[str, object]]:
    return REPOSITORY.get_prisoners()


@app.get("/api/cases")
def list_cases() -> list[dict[str, object]]:
    all_cases = REPOSITORY.get_cases()
    bundles = [case_bundle(c["id"], repo=REPOSITORY) for c in all_cases]
    return [b for b in bundles if b is not None]


@app.get("/api/cases/{case_id}")
def get_case(case_id: str) -> dict[str, object]:
    bundle = case_bundle(case_id, repo=REPOSITORY)
    if not bundle:
        raise HTTPException(404, "Case not found")
    bundle["workflow"] = WORKFLOW.summary(case_id)
    return bundle


@app.post("/api/analyze")
def analyze(facts: CaseFacts):
    decision = ENGINE.evaluate(facts)
    REPOSITORY.save_decision(facts.case_id, decision.model_dump(mode="json"))
    return decision


@app.post("/api/upload")
async def upload(file: Annotated[UploadFile, File(...)]):
    max_bytes = 20 * 1024 * 1024
    suffix = Path(file.filename or "document").suffix.lower()
    allowed_suffixes = {".pdf", ".txt", ".png", ".jpg", ".jpeg"}
    if suffix not in allowed_suffixes:
        raise HTTPException(415, "Only PDF, text, PNG, or JPEG documents are accepted")
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(413, "Document exceeds the 20 MB upload limit")
    if suffix == ".pdf" and not content.startswith(b"%PDF"):
        raise HTTPException(415, "File content does not match a PDF document")
    if suffix in {".jpg", ".jpeg"} and not content.startswith(b"\xff\xd8\xff"):
        raise HTTPException(415, "File content does not match a JPEG document")
    if suffix == ".png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(415, "File content does not match a PNG document")
    _scan_upload(content)

    analysis = PERCEPTION.analyze(file.filename or "document", content)
    extracted_facts = analysis.get("extracted_facts", {})
    fir_number = extracted_facts.get("fir_number") or analysis.get("extracted", {}).get("fir_number")

    doc_record = {
        "filename": file.filename or "document",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "fir_number": fir_number,
        "text_preview": analysis.get("text_preview", ""),
        "adjournment": analysis.get("adjournment"),
        "warnings": analysis.get("warnings", []),
        "evidence": analysis.get("evidence", []),
        "requires_human_review": analysis.get("requires_human_review", True),
    }

    existing_case = REPOSITORY.get_case_by_fir(fir_number) if fir_number else None

    if existing_case:
        case_id = existing_case["id"]
        prisoner_id = existing_case["prisoner_id"]
        created_new_case = False
        matched_existing_case = True

        REPOSITORY.add_case_document(case_id, doc_record)
        if not WORKFLOW.events(case_id):
            WORKFLOW.submit(case_id, actor="System intake", note=f"Intake attached from {file.filename}", actor_role="SYSTEM")
    else:
        created_new_case = True
        matched_existing_case = False

        case_id = extracted_facts.get("case_id") or f"CASE-UPL-{uuid4().hex[:6].upper()}"
        prisoner_id = extracted_facts.get("prisoner_number") or f"PRIS-UPL-{uuid4().hex[:6].upper()}"

        prisoner = {
            "id": prisoner_id,
            "prison_number": extracted_facts.get("prisoner_number") or prisoner_id,
            "name": extracted_facts.get("prisoner_name") or "Unknown Prisoner",
            "gender": extracted_facts.get("gender") or "Not provided",
            "age": extracted_facts.get("age") or 30,
            "prison_name": extracted_facts.get("prison_name") or "Not provided",
            "district": extracted_facts.get("district") or "Not provided",
            "state": extracted_facts.get("state") or "Not provided",
            "is_uploaded": True,
        }
        REPOSITORY.save_prisoner(prisoner)

        case = {
            "id": case_id,
            "prisoner_id": prisoner_id,
            "fir_number": fir_number or "UNKNOWN",
            "court": "Sessions Court",
            "sections": extracted_facts.get("sections") or ["IPC 379"],
            "custody_start": extracted_facts.get("custody_start") or "2024-01-15",
            "maximum_sentence_years": extracted_facts.get("maximum_sentence_years"),
            "first_time_offender": extracted_facts.get("first_time_offender"),
            "multiple_pending_cases": extracted_facts.get("multiple_pending_cases"),
            "punishable_by_death_or_life": extracted_facts.get("punishable_by_death_or_life"),
            "next_hearing": extracted_facts.get("next_hearing") or "Not scheduled",
            "documents": 1,
            "documents_list": [doc_record],
            "is_uploaded": True,
            "upload_analysis": analysis,
        }
        REPOSITORY.save_case(case)

        # Rule engine evaluation or INSUFFICIENT_DATA fallback
        custody_start_str = case.get("custody_start")
        has_essential_facts = bool(
            custody_start_str and
            case.get("maximum_sentence_years") is not None and
            case.get("first_time_offender") is not None
        )

        decision = None
        if has_essential_facts and custody_start_str:
            try:
                facts_model = CaseFacts.model_validate({
                    "case_id": case_id,
                    "prisoner_id": prisoner_id,
                    "first_time_offender": case["first_time_offender"],
                    "multiple_pending_cases": case.get("multiple_pending_cases"),
                    "punishable_by_death_or_life": case.get("punishable_by_death_or_life"),
                    "maximum_sentence_years": case.get("maximum_sentence_years"),
                    "custody_start": date.fromisoformat(custody_start_str),
                    "as_of_date": datetime.now(timezone.utc).date(),
                })
                decision = ENGINE.evaluate(facts_model)
            except Exception:
                decision = None

        if not decision:
            decision = EligibilityDecision(
                case_id=case_id,
                status=EligibilityStatus.INSUFFICIENT_DATA,
                outcome="INSUFFICIENT_DATA",
                eligible=False,
                detention_days=None,
                threshold_days=None,
                days_remaining=None,
                progress_percent=None,
                qualifying_detention_days=None,
                excluded_delay_days=0,
                rule_version=ENGINE.rules["version"],
                legal_basis="Section 479 BNSS",
                reasons=["Incomplete legal parameters (custody start date, maximum sentence years, or offender status). Fails closed to human review."],
                exclusions=[],
                flags=["HUMAN_REVIEW_REQUIRED", "INCOMPLETE_CASE_DATA"],
                trace=[],
                requires_human_review=True,
                generated_at=datetime.now(timezone.utc),
            )

        REPOSITORY.save_decision(case_id, decision.model_dump(mode="json"))
        WORKFLOW.submit(case_id, actor="System intake", note=f"Intake created from {file.filename}", actor_role="SYSTEM")

    return {
        "bytes": len(content),
        "status": "indexed",
        "analysis": analysis,
        "case_id": case_id,
        "prisoner_id": prisoner_id,
        "created_new_case": created_new_case,
        "matched_existing_case": matched_existing_case,
        "case_url": f"/cases/{case_id}",
        "workflow_url": f"/workflow?case_id={case_id}",
    }


@app.post("/api/reconcile")
def reconcile_sources(records: list[SourceRecord]):
    normalized = [record.model_dump(mode="json") for record in records]
    fields = reconcile(normalized)
    case_id = normalized[0]["case_id"] if normalized else "UNKNOWN"
    REPOSITORY.log_truth_discovery(case_id, fields)
    return {
        "fields": fields,
        "requires_human_review": any(field["requires_human_review"] for field in fields),
    }


def _source_evidence(case_id: str) -> list[dict[str, object]]:
    path = Path(__file__).parents[1] / "data" / "source_conflicts.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        records = payload.get(case_id, [])
        fields = reconcile(records)
        evidence: list[dict[str, object]] = []
        for field in fields:
            for source in field["sources"]:
                evidence.append({
                    "field": field["field"],
                    "label": source.get("source", "unknown source"),
                    "value": source.get("value"),
                    "confidence": source.get("confidence", 0),
                    "selected": source.get("value") == field.get("selected_value"),
                    "requires_human_review": field.get("requires_human_review", True),
                })
        return evidence
    except (OSError, json.JSONDecodeError, KeyError, TypeError):
        return []


@app.get("/api/cases/{case_id}/proof-card")
def proof_card(case_id: str):
    bundle = case_bundle(case_id, repo=REPOSITORY)
    if not bundle:
        raise HTTPException(404, "Case not found")
    decision = bundle["decision"]
    return {
        "case_id": case_id,
        "generated_at": decision.generated_at,
        "status": decision.status,
        "outcome": decision.outcome,
        "legal_basis": decision.legal_basis,
        "rule_version": decision.rule_version,
        "flags": decision.flags,
        "summary": decision.reasons,
        "facts": {
            "detention_days": decision.detention_days,
            "qualifying_detention_days": decision.qualifying_detention_days,
            "excluded_delay_days": decision.excluded_delay_days,
            "threshold_days": decision.threshold_days,
            "days_remaining": decision.days_remaining,
            "progress_percent": decision.progress_percent,
        },
        "sources": _source_evidence(case_id),
        "disclaimer": "Decision support only. A designated legal officer must verify source documents before action.",
    }


@app.get("/api/cases/{case_id}/workflow")
def get_workflow(case_id: str):
    if not case_bundle(case_id, repo=REPOSITORY):
        raise HTTPException(404, "Case not found")
    return {"case_id": case_id, "events": WORKFLOW.events(case_id), **WORKFLOW.summary(case_id)}


@app.post("/api/cases/{case_id}/workflow")
def workflow(case_id: str, action: WorkflowAction, principal: Principal = Depends(require_principal)):
    if not case_bundle(case_id, repo=REPOSITORY):
        raise HTTPException(404, "Case not found")
    actor, actor_role = _actor_context(case_id, action.action, action.actor, principal)
    try:
        if action.action == "submit":
            event = WORKFLOW.submit(case_id, actor, action.note, actor_role)
        elif action.action == "verify":
            event = WORKFLOW.verify(case_id, actor, action.note, actor_role)
        elif action.action == "approve":
            event = WORKFLOW.approve(case_id, actor, action.note, actor_role)
        elif action.action == "reject":
            event = WORKFLOW.reject(case_id, actor, action.note, actor_role)
        else:
            event = WORKFLOW.request_changes(case_id, actor, action.note, actor_role)
    except WorkflowError as exc:
        raise HTTPException(409, str(exc)) from exc
    return {"case_id": case_id, "event": event, **WORKFLOW.summary(case_id)}


def _pending_level(case_id: str) -> int | None:
    pending = [level.level for level in WORKFLOW.state(case_id).levels if level.status == "PENDING"]
    return pending[0] if pending else None


@app.post("/api/workflow/approve/{level}")
def workflow_approve(level: int, payload: LevelAction, principal: Principal = Depends(require_principal)):
    if level not in (1, 2, 3):
        raise HTTPException(422, "Level must be 1, 2 or 3")
    if not case_bundle(payload.case_id, repo=REPOSITORY):
        raise HTTPException(404, "Case not found")
    pending = _pending_level(payload.case_id)
    if pending is None:
        raise HTTPException(409, "No pending level to approve")
    if pending != level:
        raise HTTPException(409, f"Level {level} is not the pending level (level {pending} is)")
    actor, actor_role = _actor_context(payload.case_id, "approve", payload.actor, principal)
    try:
        WORKFLOW.approve(payload.case_id, actor, payload.note, actor_role)
    except WorkflowError as exc:
        raise HTTPException(409, str(exc)) from exc
    return WORKFLOW.summary(payload.case_id)


@app.post("/api/workflow/reject/{level}")
def workflow_reject(level: int, payload: LevelAction, principal: Principal = Depends(require_principal)):
    if level not in (1, 2, 3):
        raise HTTPException(422, "Level must be 1, 2 or 3")
    if not case_bundle(payload.case_id, repo=REPOSITORY):
        raise HTTPException(404, "Case not found")
    pending = _pending_level(payload.case_id)
    if pending is None:
        raise HTTPException(409, "No pending level to reject")
    if pending != level:
        raise HTTPException(409, f"Level {level} is not the pending level (level {pending} is)")
    actor, actor_role = _actor_context(payload.case_id, "reject", payload.actor, principal)
    try:
        WORKFLOW.reject(payload.case_id, actor, payload.note, actor_role)
    except WorkflowError as exc:
        raise HTTPException(409, str(exc)) from exc
    return WORKFLOW.summary(payload.case_id)


@app.post("/api/simulator")
def simulator(payload: SimulationRequest):
    return ENGINE.evaluate({"case_id": "SIMULATION", **payload.model_dump()})
