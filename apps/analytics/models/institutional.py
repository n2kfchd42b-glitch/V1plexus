"""
Pydantic models for the PLEXUS Institutional Service.

Covers policy management, supervisor signing authorisation,
researcher departure, and compliance dashboard data.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class PolicyResult(BaseModel):
    policy_id: UUID
    institution_id: UUID
    workspace_id: UUID
    min_trust_level: int
    min_dqi_score: float
    supervisor_signing_required: bool
    institution_signing_required: bool
    require_assumption_checks: bool
    require_ethics_reference: bool
    created_at: datetime
    updated_at: datetime


class SigningAuthorisationResult(BaseModel):
    authorisation_id: UUID
    assignment_id: UUID
    supervisor_id: UUID
    student_id: UUID
    project_id: UUID
    institution_id: UUID
    attestation_id: UUID
    verification_tier: str
    signing_authorised: bool
    authorised_at: datetime


class EligibilityResult(BaseModel):
    eligible: bool
    reason: Optional[str] = None
    authorisation_id: Optional[UUID] = None
    verification_tier: Optional[str] = None
    attestation_id: Optional[UUID] = None


class DepartureResult(BaseModel):
    departure_id: UUID
    actor_id: UUID
    institution_id: UUID
    departure_reason: str
    assignments_ended: int
    attestations_revoked: int
    keys_revoked: int
    cascade_revocations: bool
    departed_at: datetime


class ComplianceEventSummary(BaseModel):
    event_id: UUID
    event_type: str
    severity: str
    project_id: UUID
    actor_id: UUID
    detail: Dict[str, Any]
    created_at: datetime


class ComplianceSummary(BaseModel):
    institution_id: UUID
    workspace_id: UUID
    generated_at: datetime
    active_projects: int
    sealed_projects: int
    retracted_projects: int
    avg_dqi_score: float
    projects_below_dqi_threshold: int
    dqi_threshold: float
    active_researchers: int
    verified_researchers: int
    unverified_researchers: int
    open_compliance_events: int
    critical_events: int
    warning_events: int
    pvp_coverage: float
    projects_at_level_0: int
    projects_at_level_1: int
    projects_at_level_2: int
    projects_at_level_3: int
    recent_flags: List[ComplianceEventSummary]
