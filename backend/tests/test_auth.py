import pytest
from fastapi import HTTPException

from app.core.auth import Principal, issue_token, verify_token


def test_identity_token_is_signed_and_round_trips() -> None:
    principal = Principal(user_id="u-123", role="JUDGE", display_name="Judge C")
    token = issue_token(principal)
    assert verify_token(token).user_id == "u-123"
    assert verify_token(token).role == "JUDGE"


def test_identity_token_tampering_is_rejected() -> None:
    token = issue_token(Principal(user_id="u-123", role="JUDGE"))
    body, signature = token.split(".", 1)
    with pytest.raises(HTTPException) as error:
        verify_token(f"{body}.{'0' * len(signature)}")
    assert error.value.status_code == 401
