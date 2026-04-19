"""
PLEXUS Identity Service API — FastAPI router.

All endpoints are INSTITUTIONAL boundary only.
Journal-facing services have no access to any identity endpoint.

Endpoints:
  POST /api/identity/institution/register    Register an institution
  POST /api/identity/researcher/register     Register researcher identity
  GET  /api/identity/verify/{actor_id}       Verify researcher identity
  POST /api/identity/keys/link               Link session key to attestation
  GET  /api/identity/institution/{domain}    Lookup institution by email domain
"""

from __future__ import annotations

import os
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import create_client
from ..db import get_supabase

from ..middleware.auth import get_current_user
from ..models.identity import (
    AttestationResult,
    IdentityVerificationResult,
    InstitutionResult,
    KeyLinkResult,
)
from ..services.identity_service import IdentityError, IdentityService

router = APIRouter(prefix="/api/identity", tags=["identity"])


# ── Service boundary ──────────────────────────────────────────────────────────

class ServiceBoundary(str, Enum):
    INSTITUTIONAL = "institutional"
    JOURNAL       = "journal"


def require_institutional() -> ServiceBoundary:
    """Enforce institutional service boundary — journal access is denied."""
    boundary = os.getenv("SERVICE_BOUNDARY", "institutional").lower()
    if boundary != ServiceBoundary.INSTITUTIONAL:
        raise HTTPException(
            status_code=403,
            detail=(
                "Journal services cannot access identity endpoints. "
                "Only institutional services may manage identity and attestations."
            ),
        )
    return ServiceBoundary.INSTITUTIONAL


# ── Supabase factory ──────────────────────────────────────────────────────────

def _supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return get_supabase()


# ── Request schemas ───────────────────────────────────────────────────────────

class RegisterInstitutionRequest(BaseModel):
    name: str
    short_name: Optional[str] = None
    country: str
    email_domain: str
    registration_document: Optional[str] = None


class RegisterResearcherRequest(BaseModel):
    email: str
    institution_id: Optional[str] = None
    role: str
    department: Optional[str] = None


class LinkKeyRequest(BaseModel):
    session_key_id: str
    attestation_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/institution/register",
    response_model=InstitutionResult,
    status_code=201,
)
async def post_register_institution(
    req:          RegisterInstitutionRequest,
    current_user: str = Depends(get_current_user),
    _boundary:    ServiceBoundary = Depends(require_institutional),
) -> InstitutionResult:
    """
    Register an institution with PLEXUS.

    Generates the institution's managed CA keypair.  The private key is
    encrypted server-side and NEVER returned.  The public key is stored in
    the institutions table for attestation verification.
    """
    try:
        svc = IdentityService(_supabase())
        return svc.register_institution(
            name=req.name,
            short_name=req.short_name,
            country=req.country,
            email_domain=req.email_domain,
            registration_document=req.registration_document,
        )
    except IdentityError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/researcher/register",
    response_model=AttestationResult,
    status_code=201,
)
async def post_register_researcher(
    req:          RegisterResearcherRequest,
    current_user: str = Depends(get_current_user),
    _boundary:    ServiceBoundary = Depends(require_institutional),
) -> AttestationResult:
    """
    Register a researcher identity and issue an attestation.

    WARNING: The identity_private_key field in the response is returned
    EXACTLY ONCE.  It is never stored server-side.  The client must save
    it securely — it cannot be recovered after this response.
    """
    try:
        svc = IdentityService(_supabase())
        return svc.register_researcher_identity(
            actor_id=current_user,
            email=req.email,
            institution_id=req.institution_id,
            role=req.role,
            department=req.department,
        )
    except IdentityError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/verify/{actor_id}",
    response_model=IdentityVerificationResult,
)
async def get_verify_identity(
    actor_id:     str,
    current_user: str = Depends(get_current_user),
    _boundary:    ServiceBoundary = Depends(require_institutional),
) -> IdentityVerificationResult:
    """Verify the active identity attestation for an actor."""
    try:
        svc = IdentityService(_supabase())
        return svc.verify_identity(actor_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post(
    "/keys/link",
    response_model=KeyLinkResult,
    status_code=201,
)
async def post_link_key(
    req:          LinkKeyRequest,
    current_user: str = Depends(get_current_user),
    _boundary:    ServiceBoundary = Depends(require_institutional),
) -> KeyLinkResult:
    """
    Link a session signing key to a verified identity attestation.

    Creates the traversal path:
        session_key → identity_key_registry → identity_attestation → institution
    """
    try:
        svc = IdentityService(_supabase())
        return svc.link_signing_key_to_identity(
            actor_id=current_user,
            session_key_id=req.session_key_id,
            attestation_id=req.attestation_id,
        )
    except IdentityError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get(
    "/institution/{domain}",
    response_model=InstitutionResult,
)
async def get_institution_by_domain(
    domain:       str,
    current_user: str = Depends(get_current_user),
    _boundary:    ServiceBoundary = Depends(require_institutional),
) -> InstitutionResult:
    """
    Look up an institution by email domain.

    Used during researcher registration to auto-detect the institution from
    the researcher's email address.
    """
    try:
        sb = _supabase()
        result = (
            sb.table("institutions")
            .select("*")
            .eq("email_domain", domain.lower().strip())
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(
                status_code=404,
                detail=f"No institution registered for domain '{domain}'",
            )
        row = result.data
        # Compute status from active + verification_tier + verified_at
        if row["verification_tier"] == "OFFICIALLY_REGISTERED" and not row.get("verified_at"):
            status = "pending_admin_review"
        elif row.get("active", True):
            status = "active"
        else:
            status = "inactive"

        return InstitutionResult(
            institution_id=row["id"],
            name=row["name"],
            email_domain=row["email_domain"],
            verification_tier=row["verification_tier"],
            plexus_managed_ca=row.get("plexus_managed_ca", True),
            status=status,
            created_at=row["created_at"],
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
