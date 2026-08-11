from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from typing import Any

from app.config.settings import settings
from app.models import WorkflowLevel, WorkflowState

ROLES: dict[int, str] = {1: "Legal Officer", 2: "Lawyer", 3: "Judge"}
ROLE_CODES: dict[int, str] = {1: "LEGAL_OFFICER", 2: "LAWYER", 3: "JUDGE"}


class WorkflowError(Exception):
    """Raised when a workflow guard is violated (skip, repeat actor, etc.)."""


class FourEyeManager:
    """Four-Eye Review state machine.

    Guards (per spec):
      - Levels cannot be skipped: level N requires level N-1 approved.
      - Every approval must be performed by an independent actor.
      - Nothing is ever auto-approved; a rejection stops the flow.
    """

    def __init__(self, repository: Any | None = None, signing_secret: str | None = None) -> None:
        self._states: dict[str, WorkflowState] = {}
        self._events: dict[str, list[dict[str, Any]]] = {}
        self._repository = repository
        self._signing_secret = (signing_secret or settings.audit_signing_secret).encode("utf-8")

    # -- state helpers ------------------------------------------------------
    def ensure(self, case_id: str) -> WorkflowState:
        if case_id not in self._states:
            events = self._repository.load_workflow_events(case_id) if self._repository and hasattr(self._repository, "load_workflow_events") else []
            self._verify_event_chain(case_id, events)
            self._events[case_id] = events
            self._states[case_id] = self._fresh(case_id)
            for event in events:
                self._replay(self._states[case_id], event)
        return self._states[case_id]

    @staticmethod
    def _fresh(case_id: str) -> WorkflowState:
        return WorkflowState(
            case_id=case_id,
            levels=[WorkflowLevel(level=i, role=ROLES[i]) for i in (1, 2, 3)],
            current_level=1,
        )

    def _record(
        self, case_id: str, action: str, actor: str, note: str, actor_role: str | None = None,
    ) -> dict[str, Any]:
        at = datetime.now(timezone.utc).isoformat()
        previous = self._events.get(case_id, [])[-1].get("event_hash") if self._events.get(case_id) else None
        canonical = json.dumps({
            "case_id": case_id, "action": action, "actor_id": actor,
            "actor_role": actor_role, "note": note, "at": at, "previous_event_hash": previous,
        }, sort_keys=True, separators=(",", ":"))
        event_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        signature = hmac.new(self._signing_secret, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
        event = {
            "case_id": case_id,
            "action": action,
            "actor": actor,
            "actor_id": actor,
            "actor_role": actor_role,
            "note": note,
            "at": at,
            "previous_event_hash": previous,
            "event_hash": event_hash,
            "signature": signature,
        }
        self._events.setdefault(case_id, []).append(event)
        if self._repository and hasattr(self._repository, "append_workflow_event"):
            self._repository.append_workflow_event(case_id, action, actor, note, event=event)
        return event

    def _verify_event_chain(self, case_id: str, events: list[dict[str, Any]]) -> None:
        previous: str | None = None
        for event in events:
            if not event.get("event_hash") or not event.get("signature"):
                previous = event.get("event_hash") or previous
                continue
            canonical = json.dumps({
                "case_id": event.get("case_id", case_id),
                "action": event.get("action"),
                "actor_id": event.get("actor_id", event.get("actor")),
                "actor_role": event.get("actor_role"),
                "note": event.get("note", ""),
                "at": event.get("at"),
                "previous_event_hash": event.get("previous_event_hash"),
            }, sort_keys=True, separators=(",", ":"))
            expected_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            expected_signature = hmac.new(self._signing_secret, canonical.encode("utf-8"), hashlib.sha256).hexdigest()
            if event.get("previous_event_hash") != previous or event.get("event_hash") != expected_hash or not hmac.compare_digest(str(event.get("signature")), expected_signature):
                raise RuntimeError(f"Workflow audit chain integrity check failed for {case_id}")
            previous = event.get("event_hash")

    @staticmethod
    def _assert_role(level: int, actor_role: str | None) -> None:
        if actor_role and actor_role.upper() != ROLE_CODES[level]:
            raise WorkflowError(f"Level {level} requires role {ROLE_CODES[level]}")

    @staticmethod
    def _replay(state: WorkflowState, event: dict[str, Any]) -> None:
        """Rebuild state from append-only events after a process restart."""
        action = event.get("action")
        actor = event.get("actor_id", event.get("actor"))
        note = event.get("note", "")
        at = event.get("at")
        if action == "submit":
            state.levels = [WorkflowLevel(level=i, role=ROLES[i]) for i in (1, 2, 3)]
            state.current_level = 1
            state.final_decision = "PENDING"
        elif action == "verify":
            level = state.levels[0]
            FourEyeManager._stamp(level, str(actor), note, at)
            state.current_level = max(state.current_level, 2)
        elif action == "approve":
            pending = next((level for level in state.levels if level.status == "PENDING"), None)
            if pending:
                FourEyeManager._stamp(pending, str(actor), note, at)
                state.current_level = min(pending.level + 1, 3)
                if all(level.status == "APPROVED" for level in state.levels):
                    state.final_decision = "APPROVED"
        elif action == "reject":
            pending = next((level for level in state.levels if level.status == "PENDING"), state.levels[state.current_level - 1])
            pending.status = "REJECTED"
            pending.actor = str(actor)
            pending.note = note
            pending.at = at
            state.final_decision = "REJECTED"
        elif action == "request_changes":
            for level in state.levels:
                if level.status == "REJECTED":
                    level.status = "PENDING"
                    level.actor = None
                    level.note = None
                    level.at = None
            state.final_decision = "PENDING"
            state.current_level = next((level.level for level in state.levels if level.status == "PENDING"), 1)

    def _actor_history(self, state: WorkflowState) -> list[str]:
        return [level.actor for level in state.levels if level.actor]

    @staticmethod
    def _stamp(level: WorkflowLevel, actor: str, note: str, at: str | None = None) -> None:
        level.status = "APPROVED"
        level.actor = actor
        level.note = note
        level.at = datetime.fromisoformat(at) if at else datetime.now(timezone.utc)

    # -- actions ------------------------------------------------------------
    def submit(
        self, case_id: str, actor: str = "System intake", note: str = "", actor_role: str = "SYSTEM",
    ) -> dict[str, Any]:
        self._states[case_id] = self._fresh(case_id)
        self._events.setdefault(case_id, [])
        return self._record(case_id, "submit", actor, note, actor_role)

    def verify(self, case_id: str, actor: str, note: str = "", actor_role: str | None = None) -> dict[str, Any]:
        """Level-1 verification by a legal officer."""
        state = self.ensure(case_id)
        level = state.levels[0]
        if level.status != "PENDING":
            raise WorkflowError("Level 1 has already been verified")
        self._assert_role(1, actor_role)
        self._stamp(level, actor, note)
        state.current_level = max(state.current_level, 2)
        return self._record(case_id, "verify", actor, note, actor_role)

    def approve(self, case_id: str, actor: str, note: str = "", actor_role: str | None = None) -> dict[str, Any]:
        """Approve the current pending level (enforces sequencing + independence)."""
        state = self.ensure(case_id)
        pending = [level for level in state.levels if level.status == "PENDING"]
        if not pending:
            raise WorkflowError("No pending level to approve")
        target = pending[0]
        if target.level == 1:
            raise WorkflowError("Level 1 requires verification by a legal officer (use 'verify')")
        index = target.level - 1
        if index > 0 and state.levels[index - 1].status != "APPROVED":
            raise WorkflowError(f"Level {target.level} cannot be approved before level {index} is approved")
        self._assert_role(target.level, actor_role)
        if actor in self._actor_history(state):
            raise WorkflowError("Second approval must be performed by an independent actor")
        self._stamp(target, actor, note)
        state.current_level = min(target.level + 1, 3)
        if all(level.status == "APPROVED" for level in state.levels):
            state.final_decision = "APPROVED"
        return self._record(case_id, "approve", actor, note, actor_role)

    def reject(self, case_id: str, actor: str, note: str = "", actor_role: str | None = None) -> dict[str, Any]:
        state = self.ensure(case_id)
        if state.final_decision != "PENDING":
            raise WorkflowError("Workflow is already complete")
        pending = [level for level in state.levels if level.status == "PENDING"]
        target = pending[0] if pending else state.levels[state.current_level - 1]
        self._assert_role(target.level, actor_role)
        target.status = "REJECTED"
        target.actor = actor
        target.note = note
        target.at = datetime.now(timezone.utc)
        state.final_decision = "REJECTED"
        return self._record(case_id, "reject", actor, note, actor_role)

    def request_changes(self, case_id: str, actor: str, note: str = "", actor_role: str | None = None) -> dict[str, Any]:
        state = self.ensure(case_id)
        if actor_role and actor_role.upper() not in set(ROLE_CODES.values()) | {"ADMIN"}:
            raise WorkflowError("Only an authorised reviewer may request changes")
        if all(level.status == "APPROVED" for level in state.levels):
            raise WorkflowError("Workflow is already complete; no changes can be requested")
        for level in state.levels:
            if level.status == "REJECTED":
                level.status = "PENDING"
                level.actor = None
                level.note = None
                level.at = None
        state.final_decision = "PENDING"
        state.current_level = next((level.level for level in state.levels if level.status == "PENDING"), 1)
        return self._record(case_id, "request_changes", actor, note, actor_role)

    # -- reads --------------------------------------------------------------
    def state(self, case_id: str) -> WorkflowState:
        return self.ensure(case_id)

    def events(self, case_id: str) -> list[dict[str, Any]]:
        self.ensure(case_id)
        return self._events.get(case_id, [])

    def summary(self, case_id: str) -> dict[str, Any]:
        state = self.ensure(case_id)
        next_pending = next((level for level in state.levels if level.status == "PENDING"), None)
        return {
            "case_id": case_id,
            "levels": [level.model_dump() for level in state.levels],
            "current_level": state.current_level,
            "final_decision": state.final_decision,
            "next_action": f"Awaiting {next_pending.role}" if next_pending else "Workflow complete",
        }
