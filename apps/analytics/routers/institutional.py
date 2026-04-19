"""
PLEXUS Institutional Service API — FastAPI router.

All endpoints are INSTITUTIONAL boundary only.
Journal-facing services have no access to any institutional endpoint.

Endpoints:
  POST  /api/institutional/policy                         Create institutional policy
  GET   /api/institutional/policy/{workspace_id}          Get policy for workspace
  PATCH /api/institutional/policy/{policy_id}             Update policy
  POST  /api/institutional/signing/authorise              Authorise supervisor signing
  GET   /api/institutional/signing/{project_id}/{supervisor_id}  Get signing authorisation
  POST  /api/institutional/signing/validate               Validate PVP signing eligibility
  POST  /api/institutional/departure                      Process researcher departure
  GET   /api/institutional/compliance/{workspace_id}      Get compliance summary
"""

from __future__ import annotations

import base64
import os
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import create_client
from ..db import get_supabase

from ..middleware.auth import get_current_user
from ..models.institutional import (
    ComplianceSummary,
    DepartureResult,
    EligibilityResult,
    PolicyResult,
    SigningAuthorisationResult,
)
from ..services.identity_service import IdentityService
from ..services.institutional_service import InstitutionalError, InstitutionalService
from ..services.ledger_service import LedgerService
from ..services.revocation_service import RevocationService

router = APIRouter(prefix="/api/institutional", tags=["institutional"])


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
                "Journal services cannot access institutional endpoints. "
                "Only institutional services may manage policies, signing "
                "authorisations, and compliance data."
            ),
        )
    return ServiceBoundary.INSTITUTIONAL


# ── Supabase + service factory ────────────────────────────────────────────────

def _supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    return get_supabase()


def _institutional_service(sb=Depends(_supabase)) -> InstitutionalService:
    return InstitutionalService(
        supabase_client=sb,
        identity_service=IdentityService(sb),
        revocation_service=RevocationService(sb),
        ledger_service=LedgerService(sb),
    )


# ── Request schemas ───────────────────────────────────────────────────────────

class CreatePolicyRequest(BaseModel):
    institution_id: str
    workspace_id: str
    min_trust_level: int = 1
    min_dqi_score: float = 0.70
    supervisor_signing_required: bool = True
    institution_signing_required: bool = False
    require_assumption_checks: bool = True
    require_ethics_reference: bool = False


class UpdatePolicyRequest(BaseModel):
    min_trust_level: Optional[int] = None
    min_dqi_score: Optional[float] = None
    supervisor_signing_required: Optional[bool] = None
    institution_signing_required: Optional[bool] = None
    require_assumption_checks: Optional[bool] = None
    require_ethics_reference: Optional[bool] = None


class AuthoriseSigningRequest(BaseModel):
    assignment_id: str
    project_id: str


class ValidateSigningRequest(BaseModel):
    pvp_id: str
    supervisor_id: str
    project_id: str


class DepartureRequest(BaseModel):
    actor_id: str
    institution_id: str
    workspace_id: str
    reason: str
    cascade_revocations: bool = True
    signing_private_key: str  # base64-encoded


# ── Policy endpoints ──────────────────────────────────────────────────────────

@router.post("/policy", response_model=PolicyResult)
def create_policy(
    body: CreatePolicyRequest,
    current_user: str = Depends(get_current_user),
    _boundary: ServiceBoundary = Depends(require_institutional),
    svc: InstitutionalService = Depends(_institutional_service),
):
    try:
        return svc.create_policy(
            institution_id=body.institution_id,
            workspace_id=body.workspace_id,
            created_by=current_user,
            min_trust_level=body.min_trust_level,
            min_dqi_score=body.min_dqi_score,
            supervisor_signing_required=body.supervisor_signing_required,
            institution_signing_required=body.institution_signing_required,
            require_assumption_checks=body.require_assumption_checks,
            require_ethics_reference=body.require_ethics_reference,
        )
    except InstitutionalError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/policy/{workspace_id}", response_model=PolicyResult)
def get_policy(
    workspace_id: str,
    institution_id: str,
    current_user: str = Depends(get_current_user),
    _boundary: ServiceBoundary = Depends(require_institutional),
    svc: InstitutionalService = Depends(_institutional_service),
):
    try:
        return svc.get_policy(institution_id=institution_id, workspace_id=workspace_id)
    except InstitutionalError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/policy/{policy_id}", response_model=PolicyResult)
def update_policy(
    policy_id: str,
    body: UpdatePolicyRequest,
    current_user: str = Depends(get_current_user),
    _boundary: ServiceBoundary = Depends(require_institutional),
    svc: InstitutionalService = Depends(_institutional_service),
):
    updates = body.model_dump(exclude_none=True)
    try:
        return svc.update_policy(
            policy_id=policy_id,
            updated_by=current_user,
            **updates,
        )
    except InstitutionalError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Signing authorisation endpoints ──────────────────────────────────────────

@router.post("/signing/authorise", response_model=SigningAuthorisationResult)
def authorise_signing(
    body: AuthoriseSigningRequest,
    current_user: str = Depends(get_current_user),
    _boundary: ServiceBoundary = Depends(require_institutional),
    svc: InstitutionalService = Depends(_institutional_service),
):
    try:
        return svc.authorise_supervisor_signing(
            assignment_id=body.assignment_id,
            project_id=body.project_id,
            authorised_by=current_user,
        )
    except InstitutionalError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get(
    "/signing/{project_id}/{supervisor_id}",
    response_model=Optional[SigningAuthorisationResult],
)
def get_signing_authorisation(
    project_id: str,
    supervisor_id: str,
    current_user: str = Depends(get_current_user),
    _boundary: ServiceBoundary = Depends(require_institutional),
    svc: InstitutionalService = Depends(_institutional_service),
):
    return svc.get_signing_authorisation(
        project_id=project_id,
        supervisor_id=supervisor_id,
    )


@router.post("/signing/validate", response_model=EligibilityResult)
def validate_signing(
    body: ValidateSigningRequest,
    current_user: str = Depends(get_current_user),
    _boundary: ServiceBoundary = Depends(require_institutional),
    svc: InstitutionalService = Depends(_institutional_service),
):
    return svc.validate_pvp_signing_eligibility(
        pvp_id=body.pvp_id,
        supervisor_id=body.supervisor_id,
        project_id=body.project_id,
    )


# ── Departure endpoint ────────────────────────────────────────────────────────

@router.post("/departure", response_model=DepartureResult)
def process_departure(
    body: DepartureRequest,
    current_user: str = Depends(get_current_user),
    _boundary: ServiceBoundary = Depends(require_institutional),
    svc: InstitutionalService = Depends(_institutional_service),
):
    try:
        raw_key = base64.b64decode(body.signing_private_key)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="signing_private_key must be valid base64",
        )
    try:
        return svc.process_departure(
            actor_id=body.actor_id,
            institution_id=body.institution_id,
            workspace_id=body.workspace_id,
            departed_by=current_user,
            reason=body.reason,
            signing_private_key=raw_key,
            cascade_revocations=body.cascade_revocations,
        )
    except InstitutionalError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Compliance dashboard endpoint ─────────────────────────────────────────────

@router.get("/compliance/{workspace_id}", response_model=ComplianceSummary)
def get_compliance_summary(
    workspace_id: str,
    institution_id: str,
    current_user: str = Depends(get_current_user),
    _boundary: ServiceBoundary = Depends(require_institutional),
    svc: InstitutionalService = Depends(_institutional_service),
):
    try:
        return svc.get_compliance_summary(
            institution_id=institution_id,
            workspace_id=workspace_id,
        )
    except InstitutionalError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
