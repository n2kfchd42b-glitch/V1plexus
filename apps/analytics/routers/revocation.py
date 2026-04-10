"""
PLEXUS Revocation Registry API — FastAPI router.

Public (no auth) endpoints:
  GET  /api/revocation/key/{key_id}
  GET  /api/revocation/attestation/{attestation_id}
  GET  /api/revocation/package/{pvp_root_hash}
  POST /api/revocation/check/bulk

Authenticated write endpoints:
  POST /api/revocation/key/revoke
  POST /api/revocation/attestation/revoke
  POST /api/revocation/package/retract
"""

from __future__ import annotations

import base64
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import create_client

from ..middleware.auth import get_current_user
from ..models.revocation import (
    AttestationRevocationResult,
    BulkRevocationResult,
    KeyRevocationResult,
    PackageRetractionResult,
    RevocationStatusResult,
)
from ..services.revocation_service import RevocationError, RevocationService

router = APIRouter(prefix="/api/revocation", tags=["revocation"])


# ── Supabase factory ──────────────────────────────────────────────────────────

def _supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return create_client(url, key)


# ── Request schemas ───────────────────────────────────────────────────────────

class RevokeKeyRequest(BaseModel):
    key_id: str
    key_type: str
    public_key: str
    reason: str
    signing_private_key: str  # base64-encoded


class RevokeAttestationRequest(BaseModel):
    attestation_id: str
    actor_id: str
    reason: str
    signing_private_key: str  # base64-encoded


class RetractPackageRequest(BaseModel):
    pvp_root_hash: str
    project_id: str
    reason: str
    note: Optional[str] = None
    signing_private_key: str  # base64-encoded


class BulkCheckRequest(BaseModel):
    key_ids: list[str] = []
    attestation_ids: list[str] = []
    pvp_root_hash: Optional[str] = None


# ── Public read endpoints ─────────────────────────────────────────────────────

@router.get(
    "/key/{key_id}",
    response_model=RevocationStatusResult,
)
async def get_key_status(key_id: str) -> RevocationStatusResult:
    """Check whether a signing key has been revoked. No auth required."""
    try:
        svc = RevocationService(_supabase())
        return svc.check_key(key_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/attestation/{attestation_id}",
    response_model=RevocationStatusResult,
)
async def get_attestation_status(
    attestation_id: str,
) -> RevocationStatusResult:
    """Check whether an identity attestation has been revoked. No auth required."""
    try:
        svc = RevocationService(_supabase())
        return svc.check_attestation(attestation_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/package/{pvp_root_hash}",
    response_model=RevocationStatusResult,
)
async def get_package_status(pvp_root_hash: str) -> RevocationStatusResult:
    """Check whether a PVP package has been retracted. No auth required."""
    try:
        svc = RevocationService(_supabase())
        return svc.check_package(pvp_root_hash)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/check/bulk",
    response_model=BulkRevocationResult,
)
async def post_bulk_check(req: BulkCheckRequest) -> BulkRevocationResult:
    """
    Check all key IDs, attestation IDs, and an optional PVP root hash at once.
    Used by the Verification Engine during online verification. No auth required.
    """
    try:
        svc = RevocationService(_supabase())
        return svc.check_all(
            key_ids=req.key_ids,
            attestation_ids=req.attestation_ids,
            pvp_root_hash=req.pvp_root_hash,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Authenticated write endpoints ─────────────────────────────────────────────

@router.post(
    "/key/revoke",
    response_model=KeyRevocationResult,
    status_code=201,
)
async def post_revoke_key(
    req: RevokeKeyRequest,
    current_user: str = Depends(get_current_user),
) -> KeyRevocationResult:
    """Revoke a signing key. Requires authentication."""
    try:
        private_key_bytes = base64.b64decode(req.signing_private_key)
        svc = RevocationService(_supabase())
        return svc.revoke_key(
            key_id=req.key_id,
            key_type=req.key_type,
            public_key=req.public_key,
            revoked_by=current_user,
            reason=req.reason,
            signing_private_key=private_key_bytes,
        )
    except RevocationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/attestation/revoke",
    response_model=AttestationRevocationResult,
    status_code=201,
)
async def post_revoke_attestation(
    req: RevokeAttestationRequest,
    current_user: str = Depends(get_current_user),
) -> AttestationRevocationResult:
    """Revoke an identity attestation. Requires authentication."""
    try:
        private_key_bytes = base64.b64decode(req.signing_private_key)
        svc = RevocationService(_supabase())
        return svc.revoke_attestation(
            attestation_id=req.attestation_id,
            actor_id=req.actor_id,
            revoked_by=current_user,
            reason=req.reason,
            signing_private_key=private_key_bytes,
        )
    except RevocationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/package/retract",
    response_model=PackageRetractionResult,
    status_code=201,
)
async def post_retract_package(
    req: RetractPackageRequest,
    current_user: str = Depends(get_current_user),
) -> PackageRetractionResult:
    """Retract a PVP package by root hash. Requires authentication."""
    try:
        private_key_bytes = base64.b64decode(req.signing_private_key)
        svc = RevocationService(_supabase())
        return svc.retract_package(
            pvp_root_hash=req.pvp_root_hash,
            project_id=req.project_id,
            retracted_by=current_user,
            reason=req.reason,
            note=req.note,
            signing_private_key=private_key_bytes,
        )
    except RevocationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
