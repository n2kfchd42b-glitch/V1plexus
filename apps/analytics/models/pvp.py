"""
Pydantic models for the PLEXUS Verification Package (PVP) Builder.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PVPBuildResult(BaseModel):
    """Returned after a PVP package has been assembled and stored."""
    pvp_id: UUID
    project_id: UUID
    root_hash: str
    total_events: int
    status: str
    storage_path: str
    built_at: datetime


class PVPSignResult(BaseModel):
    """Returned after a signing step (author or supervisor)."""
    pvp_id: UUID
    status: str
    signed_at: datetime


class PVPSealResult(BaseModel):
    """Returned after a PVP is cryptographically sealed."""
    pvp_id: UUID
    root_hash: str
    sealed_at: datetime
    status: str
