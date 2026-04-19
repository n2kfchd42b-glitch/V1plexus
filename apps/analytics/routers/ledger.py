"""
PLEXUS Ledger API — FastAPI router.

Endpoints:
  POST /api/ledger/session-key          Generate a new Ed25519 session key
  POST /api/ledger/event                Append a signed event to the ledger
  GET  /api/ledger/{project_id}         Retrieve all events for a project
  GET  /api/ledger/{project_id}/verify  Verify chain integrity for a project
"""

from __future__ import annotations

import binascii
import os
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import create_client
from ..db import get_supabase

from ..middleware.auth import get_current_user
from ..models.ledger import ChainVerificationResult, LedgerEvent, SessionKeyResult
from ..services.key_service import KeyService
from ..services.ledger_service import LedgerService

router = APIRouter(prefix="/api/ledger", tags=["ledger"])


# ── Request bodies ────────────────────────────────────────────────────────────

class GenerateSessionKeyRequest(BaseModel):
    project_id: str
    passphrase: str = Field(..., min_length=8)
    ttl_hours: int = Field(default=8, ge=1, le=168)  # 1 h – 7 days


class WriteEventRequest(BaseModel):
    project_id: str
    event_type: str
    payload: dict[str, Any]
    actor_id: str
    actor_role: str
    session_key_id: str
    # The caller decrypts their private key locally and sends the raw 32-byte
    # Ed25519 seed as a hex string for this request only. It is used to sign
    # the event hash in-memory and is NEVER written to any store.
    session_key_hex: str = Field(
        ...,
        description=(
            "Hex-encoded 32-byte Ed25519 private key seed. "
            "Decrypted client-side using passphrase. Never persisted."
        ),
    )


# ── Supabase client factory ───────────────────────────────────────────────────

def _get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return get_supabase()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/session-key", response_model=SessionKeyResult, status_code=201)
async def post_generate_session_key(
    req: GenerateSessionKeyRequest,
    current_user: str = Depends(get_current_user),
) -> SessionKeyResult:
    """
    Generate a new Ed25519 session keypair.

    The public key is stored server-side; the private key is encrypted with the
    caller's passphrase and returned. The raw private key never touches the DB.
    """
    try:
        svc = KeyService(_get_supabase())
        return svc.generate_session_key(
            actor_id=current_user,
            project_id=req.project_id,
            passphrase=req.passphrase,
            ttl_hours=req.ttl_hours,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/event", response_model=LedgerEvent, status_code=201)
async def post_ledger_event(
    req: WriteEventRequest,
    current_user: str = Depends(get_current_user),
) -> LedgerEvent:
    """
    Append a signed event to the project ledger.

    The caller must supply `session_key_hex` — the hex-encoded Ed25519 private
    key seed they decrypted locally using their passphrase. It is used to sign
    this event in-memory and is immediately discarded.
    """
    # Decode private key bytes; reject malformed hex early
    try:
        session_key_bytes = bytes.fromhex(req.session_key_hex)
    except (ValueError, binascii.Error):
        raise HTTPException(
            status_code=422,
            detail="session_key_hex must be a valid hex string",
        )

    if len(session_key_bytes) != 32:
        raise HTTPException(
            status_code=422,
            detail="session_key_hex must represent exactly 32 bytes (64 hex chars)",
        )

    try:
        svc = LedgerService(_get_supabase())
        return svc.write_event(
            project_id=req.project_id,
            event_type=req.event_type,
            payload=req.payload,
            actor_id=req.actor_id,
            actor_role=req.actor_role,
            session_key_id=req.session_key_id,
            session_key=session_key_bytes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        # Explicitly zero out key material from local scope
        del session_key_bytes


@router.get("/{project_id}", response_model=list[LedgerEvent])
async def get_project_ledger(
    project_id: str,
    current_user: str = Depends(get_current_user),
) -> list[LedgerEvent]:
    """
    Return all ledger events for a project in sequence order.
    """
    try:
        svc = LedgerService(_get_supabase())
        return svc.get_project_ledger(project_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/{project_id}/verify", response_model=ChainVerificationResult)
async def get_verify_chain(
    project_id: str,
    current_user: str = Depends(get_current_user),
) -> ChainVerificationResult:
    """
    Verify the full hash chain and Ed25519 signatures for a project ledger.

    Returns a detailed per-event verification report including:
      - hash integrity (recomputed hash vs stored)
      - chain continuity (previous_hash linkage)
      - signature validity (Ed25519 against stored public key)
    """
    try:
        svc = LedgerService(_get_supabase())
        return svc.verify_chain(project_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
