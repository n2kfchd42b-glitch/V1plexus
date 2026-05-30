"""
JWT auth middleware for FastAPI analytics endpoints.

Validates the Supabase Bearer token. The fast path verifies the token's HS256
signature locally with SUPABASE_JWT_SECRET (no network round-trip). If local
verification is not possible — the secret is unset, or the token is signed with
an asymmetric key (RS256/ES256) — it falls back to asking Supabase to validate
the token, which previously happened on every request.
"""

import os

import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from ..db import get_supabase

_bearer = HTTPBearer(auto_error=False)
_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def _verify_locally(token: str) -> str | None:
    """
    Verify a Supabase HS256 JWT without a network call.

    Returns the user id (`sub`) on success, or None if the token cannot be
    verified locally (no secret configured, wrong algorithm, bad signature, or
    expired) — in which case the caller falls back to network verification.
    """
    if not _JWT_SECRET:
        return None
    try:
        payload = jwt.decode(
            token,
            _JWT_SECRET,
            algorithms=["HS256"],
            # Supabase access tokens carry aud="authenticated"; we don't pin it
            # here so service/anon variants still verify by signature + expiry.
            options={"verify_aud": False, "require": ["exp", "sub"]},
        )
        return payload.get("sub")
    except jwt.PyJWTError:
        # Includes expired, bad signature, and algorithm mismatch (e.g. RS256
        # tokens). Defer to network verification rather than rejecting outright.
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> str:
    """
    FastAPI dependency — returns the user ID from the Supabase token.
    Raises HTTP 401 if no valid token is present or token is expired/invalid.
    """
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = credentials.credentials

    # Fast path: local HS256 verification.
    local_user_id = _verify_locally(token)
    if local_user_id:
        return local_user_id

    # Fallback: let Supabase validate (asymmetric keys, or no secret configured).
    try:
        client = get_supabase()
        response = client.auth.get_user(token)
        user_id = response.user.id if response.user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: could not resolve user")
        return user_id
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
