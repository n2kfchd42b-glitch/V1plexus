"""
Pydantic models for the PLEXUS Journal Verification Portal.

Covers zero-auth PVP verification, signed certificates, and certificate lookup.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel


class PortalAADFlag(BaseModel):
    """Simplified AAD flag stored in a verification certificate."""
    code: str           # e.g. "AAD-01"
    name: str
    risk: str           # "LOW" | "MEDIUM" | "HIGH"
    triggered: bool


class VerificationCertificate(BaseModel):
    certificate_id: UUID
    pvp_id: UUID
    project_id: UUID
    trust_level: int
    trust_label: str
    aad_flags: List[PortalAADFlag]
    integrity_passed: bool
    root_hash: str
    human_readable: str
    portal_signature: str   # hex Ed25519 signature over canonical JSON
    issued_at: datetime
    expires_at: datetime
    request_id: Optional[UUID] = None


class PortalVerificationResult(BaseModel):
    """
    Returned immediately from POST /api/journal/verify.
    Contains the full certificate plus timing metadata.
    """
    certificate: VerificationCertificate
    processing_ms: int
    cached: bool            # True if certificate already existed for this pvp_id


class CertificateLookupResult(BaseModel):
    """
    Returned from GET /api/journal/certificate/{pvp_id}.
    certificate is None when no certificate has been issued for this pvp_id.
    """
    pvp_id: str
    certificate: Optional[VerificationCertificate] = None
    found: bool


class SharedVerificationResult(BaseModel):
    """
    Returned from GET /api/journal/report/{pvp_root_hash}.
    Powers the public shareable verification page.
    """
    pvp_root_hash: str
    trust_level: int
    trust_label: str
    overall_status: str     # "PASS" | "REVIEW" | "FAIL"
    aad_risk: str           # "LOW" | "MEDIUM" | "HIGH"
    submission_mode: str    # "individual" | "supervised" | "institutional"
    ptls_version: str
    verified_at: datetime
    valid_until: datetime
    certificate_hash: str   # SHA-256 of certificate_id — for display
    human_readable: str
    share_url: str          # {PLEXUS_BASE_URL}/verify/{pvp_root_hash}
