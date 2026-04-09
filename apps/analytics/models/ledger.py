"""
Pydantic models for the PLEXUS cryptographic ledger.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


# ── Valid event types ─────────────────────────────────────────────────────────

VALID_EVENT_TYPES: frozenset[str] = frozenset({
    "project_created",
    "dataset_imported",
    "dataset_version_committed",
    "variable_encoded",
    "variable_transformed",
    "analysis_run_started",
    "analysis_run_completed",
    "assumption_check",
    "outlier_flagged",
    "outlier_removed",
    "model_selected",
    "output_generated",
    "figure_exported",
    "table_exported",
    "supervisor_review_requested",
    "supervisor_approved",
    "supervisor_rejected",
    "ethics_reference_linked",
    "annotation_added",
    "project_sealed",
})

VALID_ACTOR_ROLES: frozenset[str] = frozenset({
    "author",
    "supervisor",
    "institution",
    "system",
})


# ── Database row models ───────────────────────────────────────────────────────

class LedgerEvent(BaseModel):
    """Represents a single immutable entry in ledger_events."""
    id: UUID
    project_id: UUID
    sequence_number: int
    event_type: str
    payload: dict[str, Any]
    previous_hash: str
    event_hash: str
    signature: str
    session_key_id: UUID
    actor_id: UUID
    actor_role: str
    timestamp: datetime

    class Config:
        from_attributes = True


class ChainVerificationResult(BaseModel):
    """Result of a full ledger chain verification pass."""
    valid: bool
    total_events: int
    first_broken_sequence: Optional[int]
    verification_detail: list[dict[str, Any]]


# ── Key service models ────────────────────────────────────────────────────────

class SessionKeyResult(BaseModel):
    """
    Returned to the caller after a new session key is generated.

    The raw private key is NEVER included here and is never stored anywhere.
    The client receives `encrypted_private_key` + `salt` and must decrypt
    locally using their passphrase whenever they need to sign an event.
    """
    session_key_id: UUID
    encrypted_private_key: str   # base64-encoded nacl SecretBox ciphertext
    salt: str                    # base64-encoded KDF salt
    public_key: str              # hex-encoded Ed25519 verify key
    expires_at: datetime
