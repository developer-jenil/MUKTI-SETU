import pytest

from app.services.workflow.four_eye import FourEyeManager, WorkflowError


@pytest.fixture()
def workflow() -> FourEyeManager:
    manager = FourEyeManager()
    manager.submit("CASE-1", actor="System intake")
    return manager


def test_levels_cannot_be_skipped(workflow: FourEyeManager) -> None:
    # An approval without a level-1 verification must be refused outright.
    with pytest.raises(WorkflowError):
        workflow.approve("CASE-1", actor="Judge C", note="skip straight to level 3")


def test_independent_actor_required(workflow: FourEyeManager) -> None:
    workflow.verify("CASE-1", actor="Officer A")
    with pytest.raises(WorkflowError):
        workflow.approve("CASE-1", actor="Officer A")


def test_full_approval_chain(workflow: FourEyeManager) -> None:
    workflow.verify("CASE-1", actor="Officer A")
    workflow.approve("CASE-1", actor="Lawyer B")
    workflow.approve("CASE-1", actor="Judge C")
    state = workflow.state("CASE-1")
    assert state.final_decision == "APPROVED"
    assert all(level.status == "APPROVED" for level in state.levels)


def test_rejection_stops_flow(workflow: FourEyeManager) -> None:
    workflow.reject("CASE-1", actor="Officer A", note="Source documents missing")
    state = workflow.state("CASE-1")
    assert state.final_decision == "REJECTED"


def test_reverification_is_not_allowed_even_with_a_different_actor(workflow: FourEyeManager) -> None:
    workflow.verify("CASE-1", actor="Officer A", actor_role="LEGAL_OFFICER")
    with pytest.raises(WorkflowError, match="already been verified"):
        workflow.verify("CASE-1", actor="Officer B", actor_role="LEGAL_OFFICER")


def test_role_binding_rejects_wrong_reviewer(workflow: FourEyeManager) -> None:
    with pytest.raises(WorkflowError, match="requires role"):
        workflow.verify("CASE-1", actor="Judge C", actor_role="JUDGE")


def test_request_changes_reopens_the_rejected_level(workflow: FourEyeManager) -> None:
    workflow.verify("CASE-1", actor="Officer A", actor_role="LEGAL_OFFICER")
    workflow.reject("CASE-1", actor="Lawyer B", actor_role="LAWYER", note="Missing order")
    workflow.request_changes("CASE-1", actor="Officer A", actor_role="LEGAL_OFFICER")
    state = workflow.state("CASE-1")
    assert state.current_level == 2
    assert state.levels[1].status == "PENDING"


def test_completed_workflow_cannot_be_rejected(workflow: FourEyeManager) -> None:
    workflow.verify("CASE-1", actor="Officer A", actor_role="LEGAL_OFFICER")
    workflow.approve("CASE-1", actor="Lawyer B", actor_role="LAWYER")
    workflow.approve("CASE-1", actor="Judge C", actor_role="JUDGE")
    with pytest.raises(WorkflowError, match="already complete"):
        workflow.reject("CASE-1", actor="Judge C", actor_role="JUDGE")


def test_signed_events_replay_from_repository(tmp_path) -> None:
    from app.db.repository import MockRepository

    repository = MockRepository(tmp_path / "state.json")
    first = FourEyeManager(repository=repository, signing_secret="test-secret")
    first.submit("CASE-PERSIST", actor="System", actor_role="SYSTEM")
    first.verify("CASE-PERSIST", actor="Officer A", actor_role="LEGAL_OFFICER")
    events = first.events("CASE-PERSIST")
    assert events[-1]["signature"]
    assert events[-1]["previous_event_hash"] == events[0]["event_hash"]

    restarted = FourEyeManager(repository=repository, signing_secret="test-secret")
    assert restarted.summary("CASE-PERSIST")["current_level"] == 2
    assert restarted.events("CASE-PERSIST") == events


def test_tampered_audit_chain_fails_closed(tmp_path) -> None:
    from app.db.repository import MockRepository

    repository = MockRepository(tmp_path / "state.json")
    first = FourEyeManager(repository=repository, signing_secret="test-secret")
    first.submit("CASE-TAMPER", actor="System", actor_role="SYSTEM")
    first.verify("CASE-TAMPER", actor="Officer A", actor_role="LEGAL_OFFICER")
    repository._state["workflow_events"]["CASE-TAMPER"][1]["actor_id"] = "attacker"
    repository._save()
    with pytest.raises(RuntimeError, match="integrity check failed"):
        FourEyeManager(repository=repository, signing_secret="test-secret").state("CASE-TAMPER")
