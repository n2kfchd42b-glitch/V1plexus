"""
JWT auth middleware for FastAPI analytics endpoints.
Validates the Supabase Bearer token using the Supabase admin client,
which handles both HS256 and RS256 tokens transparently.
"""

import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client

_bearer = HTTPBearer(auto_error=False)


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
    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not service_key:
        raise HTTPException(status_code=500, detail="Auth not configured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing")

    try:
        client = create_client(supabase_url, service_key)
        response = client.auth.get_user(token)
        user_id = response.user.id if response.user else None
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: could not resolve user")
        return user_id
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")
