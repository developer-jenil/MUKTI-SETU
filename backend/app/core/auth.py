from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any

from fastapi import Header, HTTPException
from pydantic import BaseModel, Field

from app.config.settings import settings


ROLE_FOR_LEVEL = {1: "LEGAL_OFFICER", 2: "LAWYER", 3: "JUDGE"}
ROLE_CODES = ROLE_FOR_LEVEL
VALID_ROLES = set(ROLE_FOR_LEVEL.values()) | {"SYSTEM", "ADMIN"}


class Principal(BaseModel):
    """Authenticated server-side identity used for workflow decisions."""

    user_id: str = Field(min_length=2)
    role: str = Field(min_length=2)
    display_name: str | None = None

    def normalized(self) -> "Principal":
        role = self.role.strip().upper()
        if role not in VALID_ROLES:
            raise ValueError(f"Unknown role: {role}")
        return self.model_copy(update={"user_id": self.user_id.strip(), "role": role})


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def issue_token(principal: Principal, expires_in_seconds: int = 3600) -> str:
    """Issue a compact HMAC-signed bearer token for integration tests/dev IdP adapters."""
    identity = principal.normalized()
    payload = {
        "sub": identity.user_id,
        "role": identity.role,
        "name": identity.display_name,
        "exp": int(time.time()) + expires_in_seconds,
    }
    body = _encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = hmac.new(settings.auth_token_secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def verify_token(token: str) -> Principal:
    try:
        body, signature = token.split(".", 1)
        expected = hmac.new(settings.auth_token_secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError("invalid signature")
        payload: dict[str, Any] = json.loads(_decode(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("expired token")
        return Principal(user_id=str(payload["sub"]), role=str(payload["role"]), display_name=payload.get("name")).normalized()
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired identity token") from exc


def require_principal(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
) -> Principal:
    """Resolve an authenticated identity; CLOUD mode always requires a bearer token.

    Local/HYBRID demo mode remains usable without an IdP, but production mode
    must provide a signed token. The X-User-* headers are only a convenient
    identity adapter for local integration tests and are never trusted in CLOUD.
    """
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(status_code=401, detail="Use a Bearer identity token")
        return verify_token(token)
    if settings.auth_required:
        raise HTTPException(status_code=401, detail="Authenticated identity required")
    if x_user_id or x_user_role:
        try:
            return Principal(user_id=x_user_id or "demo-user", role=x_user_role or "LEGAL_OFFICER").normalized()
        except ValueError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
    return Principal(user_id="demo-user", role="LEGAL_OFFICER", display_name="Demo user")
