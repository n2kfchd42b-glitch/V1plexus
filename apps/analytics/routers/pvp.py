"""
PLEXUS Verification Package (PVP) API — FastAPI router.

All build/sign/seal endpoints are INSTITUTIONAL boundary only.
Journal-facing services receive sealed PVPs via the download endpoint only
after the package has been sealed by institutional actors.

Endpoints:
  POST /api/pvp/build                     Build unsigned PVP
  POST /api/pvp/{pvp_id}/sign/author      Author signature
  POST /api/pvp/{pvp_id}/sign/supervisor  Supervisor signature
  POST /api/pvp/{pvp_id}/seal             Seal and write ledger event
  GET  /api/pvp/{pvp_id}/download         Stream .pvp file
"""

from __future__ import annotations

import binascii
import io
import os
from base64 import b64decode
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from supabase import create_client
from ..db import get_supabase

from ..middleware.auth import get_current_user
from ..models.pvp import PVPBuildResult, PVPSealResult, PVPSignResult
from ..services.pvp_builder import PVPBuildError, PVPBuilder, PVPSealError

router = APIRouter(prefix="/api/pvp", tags=["pvp"])


# ── Service boundary ──────────────────────────────────────────────────────────

class ServiceBoundary(str, Enum):
    INSTITUTIONAL = "institutional"
    JOURNAL       = "journal"


def require_institutional() -> ServiceBoundary:
    """
    FastAPI dependency that enforces the institutional service boundary.
    Journal-facing services (SERVICE_BOUNDARY=journal) cannot call build,
    sign, or seal endpoints.
    """
    boundary = os.getenv("SERVICE_BOUNDARY", "institutional").lower()
    if boundary != ServiceBoundary.INSTITUTIONAL:
        raise HTTPException(
            status_code=403,
            detail=(
                "Journal services cannot access institutional endpoints. "
                "Only sealed PVPs are accessible to journal-boundary services."
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

class BuildRequest(BaseModel):
    project_id:      str
    deployment_mode: str = "cloud"


class SignRequest(BaseModel):
    session_key_id: str
    # Base64-encoded raw Ed25519 private key seed, decrypted client-side.
    # Transmitted over HTTPS for this request only; never stored.
    private_key_b64: str = Field(
        ...,
        description=(
            "Base64-encoded 32-byte Ed25519 private key seed. "
            "Decrypted client-side using passphrase before sending."
        ),
    )


class SealRequest(BaseModel):
    # Key material is optional — if provided, a 'project_sealed' ledger event
    # is also written to cryptographically record the sealing action.
    session_key_id:  Optional[str] = None
    private_key_b64: Optional[str] = Field(
        default=None,
        description="Base64-encoded 32-byte Ed25519 private key seed (optional).",
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _decode_private_key(b64_value: str, field_name: str = "private_key_b64") -> bytes:
    """Decode and validate a base64-encoded Ed25519 private key seed."""
    try:
        raw = b64decode(b64_value)
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must be valid base64",
        )
    if len(raw) != 32:
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} must decode to exactly 32 bytes",
        )
    return raw


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/build", response_model=PVPBuildResult, status_code=201)
async def post_build(
    req:          BuildRequest,
    current_user: str = Depends(get_current_user),
    _boundary:    ServiceBoundary = Depends(require_institutional),
) -> PVPBuildResult:
    """
    Assemble a PLEXUS Verification Package for a project.
    Requires a 'project_sealed' event in the project ledger.
    """
    try:
        builder = PVPBuilder(_supabase())
        return builder.build(
            project_id=req.project_id,
            actor_id=current_user,
            deployment_mode=req.deployment_mode,
        )
    except PVPBuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/{pvp_id}/sign/author", response_model=PVPSignResult)
async def post_sign_author(
    pvp_id:       str,
    req:          SignRequest,
    current_user: str = Depends(get_current_user),
    _boundary:    ServiceBoundary = Depends(require_institutional),
) -> PVPSignResult:
    """
    Author signs the PVP root hash with their Ed25519 private key.
    The private key seed is decoded from base64 in-memory and discarded
    immediately after signing.
    """
    private_key = _decode_private_key(req.private_key_b64)
    try:
        builder = PVPBuilder(_supabase())
        return builder.sign_author(
            pvp_id=pvp_id,
            actor_id=current_user,
            session_key_id=req.session_key_id,
            private_key_bytes=private_key,
        )
    except PVPBuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        del private_key


@router.post("/{pvp_id}/sign/supervisor", response_model=PVPSignResult)
async def post_sign_supervisor(
    pvp_id:       str,
    req:          SignRequest,
    current_user: str = Depends(get_current_user),
    _boundary:    ServiceBoundary = Depends(require_institutional),
) -> PVPSignResult:
    """
    Supervisor signs the PVP root hash. Requires author to have signed first.
    """
    private_key = _decode_private_key(req.private_key_b64)
    try:
        builder = PVPBuilder(_supabase())
        return builder.sign_supervisor(
            pvp_id=pvp_id,
            supervisor_id=current_user,
            session_key_id=req.session_key_id,
            private_key_bytes=private_key,
        )
    except PVPBuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        del private_key


@router.post("/{pvp_id}/seal", response_model=PVPSealResult)
async def post_seal(
    pvp_id:       str,
    req:          SealRequest,
    current_user: str = Depends(get_current_user),
    _boundary:    ServiceBoundary = Depends(require_institutional),
) -> PVPSealResult:
    """
    Seal the PVP: verify root hash integrity and transition status to 'sealed'.
    Optionally writes a 'project_sealed' ledger event if key material is provided.
    """
    private_key: bytes | None = None
    if req.private_key_b64:
        private_key = _decode_private_key(req.private_key_b64)

    try:
        builder = PVPBuilder(_supabase())
        return builder.seal(
            pvp_id=pvp_id,
            actor_id=current_user,
            session_key_id=req.session_key_id,
            private_key_bytes=private_key,
        )
    except PVPSealError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except PVPBuildError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if private_key is not None:
            del private_key


@router.get("/{pvp_id}/download")
async def get_download(
    pvp_id:       str,
    current_user: str = Depends(get_current_user),
) -> StreamingResponse:
    """
    Stream the .pvp ZIP file to the caller.
    Accessible to both institutional and journal boundary services —
    sealed packages are the public-facing artifact.
    """
    sb = _supabase()
    result = (
        sb.table("pvp_packages")
        .select("storage_path, status, project_id")
        .eq("id", pvp_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="PVP package not found")

    pvp = result.data

    try:
        zip_bytes = sb.storage.from_(_STORAGE_BUCKET_FROM_ENV()).download(
            pvp["storage_path"]
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve package from storage: {exc}",
        )

    filename = f"{pvp['project_id']}.pvp"
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _STORAGE_BUCKET_FROM_ENV() -> str:
    return os.getenv("PVP_STORAGE_BUCKET", "pvp-packages")
