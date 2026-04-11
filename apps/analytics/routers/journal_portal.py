"""
PLEXUS Journal Verification Portal — FastAPI router.

All endpoints are zero-auth (no JWT required).
Journal services access this; institutional services are excluded by boundary.

Rate limits (slowapi):
  POST /api/journal/verify              → 20/minute per IP
  GET  /api/journal/certificate/*       → 60/minute per IP
  GET  /api/journal/report/*            → 60/minute per IP

Endpoints:
  POST /api/journal/verify                        Upload .pvp file for verification
  GET  /api/journal/certificate/{pvp_id}          Look up existing certificate by pvp_id
  GET  /api/journal/report/{pvp_root_hash}        Shareable verification report by root_hash
  GET  /api/journal/health                        Liveness check (no rate limit)
  GET  /api/journal/public-key                    Return portal's Ed25519 public key (hex)
"""

from __future__ import annotations

import os

import nacl.encoding
import nacl.signing
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client

from ..models.journal_portal import (
    CertificateLookupResult,
    PortalVerificationResult,
    SharedVerificationResult,
)
from ..services.journal_portal_service import JournalPortalError, JournalPortalService

# ── Rate limiter (exported so main.py can attach it to the app) ───────────────

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/journal", tags=["journal"])


# ── Service factory ───────────────────────────────────────────────────────────

def _get_service() -> JournalPortalService:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    sb = create_client(url, key)
    try:
        return JournalPortalService(sb)
    except JournalPortalError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/verify", response_model=PortalVerificationResult)
@limiter.limit("20/minute")
async def verify_pvp(
    request: Request,
    file: UploadFile,
    svc: JournalPortalService = Depends(_get_service),
):
    """
    Upload a .pvp file for cryptographic verification.

    Returns a signed VerificationCertificate valid for 90 days.
    Cached: if the same pvp_id was verified before, returns the cached cert.
    Rate limit: 20 requests/minute per IP.
    """
    pvp_bytes = await file.read()
    if not pvp_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    requester_ip: str = get_remote_address(request) or "unknown"

    try:
        return svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=requester_ip)
    except JournalPortalError as exc:
        msg = str(exc)
        if "SLA" in msg:
            raise HTTPException(status_code=504, detail=msg)
        raise HTTPException(status_code=422, detail=msg)


@router.get(
    "/certificate/{pvp_id}",
    response_model=CertificateLookupResult,
)
@limiter.limit("60/minute")
async def get_certificate(
    pvp_id: str,
    request: Request,
    svc: JournalPortalService = Depends(_get_service),
):
    """
    Retrieve a previously issued verification certificate by pvp_id.

    Returns found=False (HTTP 200) when no certificate exists for the pvp_id.
    Rate limit: 60 requests/minute per IP.
    """
    return svc.get_certificate(pvp_id)


@router.get("/report/{pvp_root_hash}", response_model=SharedVerificationResult)
@limiter.limit("60/minute")
async def get_report(
    pvp_root_hash: str,
    request: Request,
    svc: JournalPortalService = Depends(_get_service),
):
    """
    Return a shareable verification result by pvp_root_hash.

    Powers the public /verify/{pvp_root_hash} page.
    Returns 404 if the package has never been verified via POST /verify.
    Rate limit: 60 requests/minute per IP.
    """
    result = svc.get_report(pvp_root_hash)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "No verification record found for this package.",
                "hint": "The package must be verified first via POST /api/journal/verify",
            },
        )
    return result


@router.get("/health")
async def health():
    """Liveness check — no auth, no rate limit."""
    return {"status": "ok", "service": "journal-verification-portal"}


@router.get("/public-key")
async def public_key():
    """
    Return the portal's Ed25519 public key in hex.
    Journals use this to verify portal_signature on certificates.
    """
    hex_seed = os.getenv("PLEXUS_PORTAL_SIGNING_KEY", "")
    if not hex_seed or len(hex_seed) != 64:
        raise HTTPException(
            status_code=503,
            detail="Portal signing key not configured",
        )
    sk = nacl.signing.SigningKey(bytes.fromhex(hex_seed))
    vk_hex = sk.verify_key.encode(nacl.encoding.HexEncoder).decode()
    return {"public_key": vk_hex, "algorithm": "Ed25519"}
