"""
PLEXUS Verification Engine API — FastAPI router.

Endpoints serve BOTH institutional and journal boundaries.
No auth required for journal-facing endpoint (POST /api/verify/package).
Auth required for institutional endpoint.

Endpoints:
  POST /api/verify/package                Journal-facing. No auth.
  POST /api/verify/package/institutional  Institutional. Auth required.
  GET  /api/verify/health                 Public health check.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from ..middleware.auth import get_current_user
from ..models.verification import VerificationReport
from ..services.verification_engine import AAD_VERSION, PTLS_VERSION, VerificationEngine

router = APIRouter(prefix="/api/verify", tags=["verification"])


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
async def get_health():
    """
    Public health check. No auth. No file.
    Returns engine version metadata.
    """
    return {
        "status":       "ok",
        "ptls_version": PTLS_VERSION,
        "aad_version":  AAD_VERSION,
    }


@router.post("/package", response_model=VerificationReport)
async def post_verify_package(
    file:   UploadFile = File(..., description=".pvp file to verify"),
    online: bool       = Form(default=True, description="Enable online revocation check"),
) -> VerificationReport:
    """
    Journal-facing verification endpoint. No authentication required.

    Accepts a .pvp file via multipart upload and runs the full four-layer
    verification pipeline: integrity → chain → PTLS trust level → AAD.

    Works offline — if `online=false`, revocation check is skipped and
    revocation_status will be 'unchecked'.
    """
    if not file.filename or not file.filename.endswith(".pvp"):
        raise HTTPException(
            status_code=422,
            detail="File must be a .pvp package (PLEXUS Verification Package)",
        )

    pvp_bytes = await file.read()
    if not pvp_bytes:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")

    try:
        engine = VerificationEngine()
        return engine.verify(pvp_bytes, online=online)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Verification engine error: {exc}",
        )


@router.post(
    "/package/institutional",
    response_model=VerificationReport,
)
async def post_verify_package_institutional(
    file:         UploadFile = File(..., description=".pvp file to verify"),
    online:       bool       = Form(default=True),
    current_user: str        = Depends(get_current_user),
) -> VerificationReport:
    """
    Institutional verification endpoint. Authentication required.

    Identical pipeline to /package but:
    - Requires a valid JWT token.
    - The verification attempt is logged to the audit record (best-effort;
      a logging failure never blocks the verification result).
    """
    if not file.filename or not file.filename.endswith(".pvp"):
        raise HTTPException(
            status_code=422,
            detail="File must be a .pvp package",
        )

    pvp_bytes = await file.read()
    if not pvp_bytes:
        raise HTTPException(status_code=422, detail="Uploaded file is empty")

    try:
        engine = VerificationEngine()
        report = engine.verify(pvp_bytes, online=online)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Verification engine error: {exc}",
        )

    # Best-effort audit log — never blocks the response
    try:
        _log_institutional_verification(
            actor_id=current_user,
            project_id=report.project_id,
            trust_level=report.summary.trust_level,
            overall_status=report.summary.overall_status,
        )
    except Exception:
        pass

    return report


def _log_institutional_verification(
    actor_id: str,
    project_id: str,
    trust_level: int,
    overall_status: str,
) -> None:
    """
    Write a verification attempt to the institutional audit record.
    Uses Supabase service client if configured; silently skips if not.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        return

    try:
        from supabase import create_client
        sb = create_client(supabase_url, supabase_key)
        sb.table("audit_logs").insert({
            "actor_id":      actor_id,
            "action":        "pvp.verification.run",
            "resource_type": "pvp_package",
            "resource_id":   project_id,
            "project_id":    project_id,
            "details": {
                "summary":   f"PVP verification completed — Trust Level {trust_level}",
                "operation": {
                    "trust_level":    trust_level,
                    "overall_status": overall_status,
                    "ptls_version":   PTLS_VERSION,
                    "aad_version":    AAD_VERSION,
                },
            },
        }).execute()
    except Exception:
        pass  # Audit logging is never allowed to block verification
