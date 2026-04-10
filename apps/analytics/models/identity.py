"""
Pydantic models for the PLEXUS Identity Service + Managed CA.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class InstitutionResult(BaseModel):
    """Returned after an institution is registered."""
    institution_id: UUID
    name: str
    email_domain: str
    verification_tier: str
    plexus_managed_ca: bool
    status: str          # "active" | "pending_admin_review" | "inactive"
    created_at: datetime


class AttestationResult(BaseModel):
    """
    Returned after a researcher identity is registered.

    identity_private_key is included ONCE at registration time only.
    The raw private key is never stored server-side; the client must
    save it securely.  Subsequent calls will not return it.
    """
    attestation_id: UUID
    actor_id: UUID
    institution_id: Optional[UUID] = None
    verification_tier: str
    attested_by: str
    identity_public_key: str
    valid_from: datetime
    valid_to: datetime
    # Returned once at registration; never stored raw.
    identity_private_key: Optional[str] = None


class IdentityVerificationResult(BaseModel):
    """Result of verifying a researcher's active identity attestation."""
    verified: bool
    reason: Optional[str] = None
    actor_id: Optional[UUID] = None
    institution_id: Optional[UUID] = None
    institution_name: Optional[str] = None
    verification_tier: Optional[str] = None
    role: Optional[str] = None
    valid_to: Optional[datetime] = None


class KeyLinkResult(BaseModel):
    """Returned after a session signing key is linked to an attestation."""
    session_key_id: UUID
    attestation_id: UUID
    verification_tier: str
    linked_at: datetime
