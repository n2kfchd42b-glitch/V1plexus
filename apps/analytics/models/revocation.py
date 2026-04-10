"""
Pydantic models for the PLEXUS Revocation Registry.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class KeyRevocationResult(BaseModel):
    revocation_id: UUID
    key_id: UUID
    key_type: str
    reason: str
    revoked_at: datetime
    revocation_signature: str


class AttestationRevocationResult(BaseModel):
    revocation_id: UUID
    attestation_id: UUID
    actor_id: UUID
    cascaded_key_revocations: int
    reason: str
    revoked_at: datetime


class PackageRetractionResult(BaseModel):
    retraction_id: UUID
    pvp_root_hash: str
    project_id: UUID
    reason: str
    retracted_at: datetime
    retraction_signature: str


class RevocationStatusResult(BaseModel):
    revoked: bool
    revocation_type: Optional[str] = None
    reason: Optional[str] = None
    revoked_at: Optional[datetime] = None
    revocation_signature: Optional[str] = None


class BulkRevocationResult(BaseModel):
    any_revoked: bool
    keys: dict[str, RevocationStatusResult]
    attestations: dict[str, RevocationStatusResult]
    package: Optional[RevocationStatusResult] = None
    checked_at: datetime
