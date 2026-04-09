"""
Pydantic models for the PLEXUS Verification Engine (PTLS / AAD).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class IntegrityResult(BaseModel):
    """Layer 1 — Package integrity check result."""
    passed: bool
    reason: Optional[str] = None
    pvp_format_version: Optional[str] = None
    ptls_version: Optional[str] = None
    project_id: Optional[str] = None
    total_events: Optional[int] = None
    institutional_boundary: Optional[str] = None
    deployment_mode: Optional[str] = None


class ChainResult(BaseModel):
    """Layer 2 — Ledger chain verification result."""
    passed: bool
    total_events: int
    first_broken_sequence: Optional[int] = None
    reason: Optional[str] = None
    revocation_status: str  # "clean" | "flagged" | "unchecked"
    revoked_keys: list[str] = []


class TrustResult(BaseModel):
    """Layer 3 — PTLS Trust Level result."""
    level: int
    flags: list[str]
    downgrade_reasons: list[str]
    requirements_checked: dict[str, Any]


class AADFlag(BaseModel):
    """A single Adversarial Analysis Detection flag."""
    code: str
    name: str
    risk: str   # "LOW" | "MEDIUM" | "HIGH"
    detail: str
    evidence: list[str]


class AADResult(BaseModel):
    """Layer 4 — Adversarial Analysis Detection result."""
    overall_risk: str   # "LOW" | "MEDIUM" | "HIGH"
    flags: list[AADFlag]
    total_runs_analysed: int
    aad_version: str


class VerificationSummary(BaseModel):
    """Human-readable summary of the full verification pipeline."""
    trust_level: int
    trust_label: str
    aad_risk: str
    overall_status: str   # "PASS" | "REVIEW" | "FAIL"
    human_readable: str


class VerificationReport(BaseModel):
    """Full structured output of a verification run."""
    verified_at: datetime
    pvp_format_version: str
    ptls_version: str
    project_id: str
    institutional_boundary: str
    deployment_mode: str
    integrity: IntegrityResult
    chain: ChainResult
    trust: TrustResult
    aad: AADResult
    summary: VerificationSummary
