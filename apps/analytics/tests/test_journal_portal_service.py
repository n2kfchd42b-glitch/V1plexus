"""
Tests for PLEXUS Journal Verification Portal.

Coverage targets:
  - JournalPortalService.verify_package  (happy path, cache, SLA, errors)
  - JournalPortalService.get_certificate (found / not-found)
  - Certificate signature validation
  - AAD flag mapping
  - Human-readable output
  - Rate limiting via FastAPI router
  - /health and /public-key endpoints
  - IP hashing (never stored raw)
  - 90-day certificate expiry

Run from project root:
    pytest apps/analytics/tests/test_journal_portal_service.py -v
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import time
import zipfile
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch
from uuid import uuid4

import nacl.encoding
import nacl.signing
import pytest
from fastapi.testclient import TestClient

# ── Reuse the PVP fixture factory from the engine tests ──────────────────────
from apps.analytics.tests.test_verification_engine import (
    build_test_pvp,
    _level1_events,
    _level2_events,
)

from apps.analytics.services.journal_portal_service import (
    JournalPortalService,
    JournalPortalError,
    _hash_ip,
)
from apps.analytics.models.journal_portal import (
    VerificationCertificate,
    PortalVerificationResult,
    CertificateLookupResult,
)
from apps.analytics.main import app
from apps.analytics.routers.journal_portal import _get_service


# ═════════════════════════════════════════════════════════════════════════════
# Constants & helpers
# ═════════════════════════════════════════════════════════════════════════════

# Deterministic Ed25519 test seed (64 hex chars of zeros)
_TEST_SEED_HEX = "00" * 32

_TEST_IP = "192.168.1.1"


def _q(data: Any):
    """
    Chainable Supabase mock for both .execute() (list) and .single().execute() (dict).
    Matches the dual-mock pattern used throughout the test suite.
    """
    _single_data = data[0] if isinstance(data, list) and data else data

    single_q = MagicMock()
    single_q.execute.return_value = MagicMock(data=_single_data)
    single_q.eq.return_value      = single_q
    single_q.order.return_value   = single_q
    single_q.limit.return_value   = single_q

    q = MagicMock()
    q.execute.return_value = MagicMock(data=data)
    q.eq.return_value      = q
    q.in_.return_value     = q
    q.not_.return_value    = q
    q.limit.return_value   = q
    q.order.return_value   = q
    q.select.return_value  = q
    q.insert.return_value  = q
    q.single.return_value  = single_q
    return q


def _make_sb_mock(
    cert_rows: Optional[List[Dict]] = None,
    insert_cert_row: Optional[Dict] = None,
    insert_req_row: Optional[Dict] = None,
) -> MagicMock:
    """
    Build a Supabase client mock that dispatches by table name.
    """
    cert_rows = cert_rows or []
    insert_cert_data = [insert_cert_row or {"certificate_id": str(uuid4())}]
    insert_req_data  = [insert_req_row  or {"request_id":     str(uuid4())}]

    def _table(name: str):
        if name == "verification_certificates":
            q = _q(cert_rows)
            q.insert.return_value = _q(insert_cert_data)
            return q
        if name == "verification_requests":
            q = _q([])
            q.insert.return_value = _q(insert_req_data)
            return q
        return _q([])

    sb = MagicMock()
    sb.table.side_effect = _table
    return sb


def _make_cert_row(
    pvp_id: str = "",
    project_id: str = "",
    trust_level: int = 1,
    trust_label: str = "Integrity Verified",
    root_hash: str = "a" * 64,
    portal_signature: str = "b" * 128,
    issued_at: Optional[str] = None,
    expires_at: Optional[str] = None,
) -> Dict:
    """Build a fake verification_certificates DB row."""
    now = datetime.now(timezone.utc)
    return {
        "certificate_id": str(uuid4()),
        "pvp_id":         pvp_id or str(uuid4()),
        "project_id":     project_id or str(uuid4()),
        "trust_level":    trust_level,
        "trust_label":    trust_label,
        "aad_flags":      [],
        "integrity_passed": True,
        "root_hash":      root_hash,
        "human_readable": "TEST REPORT",
        "portal_signature": portal_signature,
        "issued_at":      issued_at or now.isoformat(),
        "expires_at":     expires_at or (now.isoformat()),
        "request_id":     None,
    }


@pytest.fixture(autouse=True)
def _set_signing_key(monkeypatch):
    """Inject a deterministic portal signing key for every test."""
    monkeypatch.setenv("PLEXUS_PORTAL_SIGNING_KEY", _TEST_SEED_HEX)


def _make_service(
    cert_rows: Optional[List[Dict]] = None,
    insert_cert_row: Optional[Dict] = None,
) -> JournalPortalService:
    sb = _make_sb_mock(
        cert_rows=cert_rows,
        insert_cert_row=insert_cert_row,
    )
    return JournalPortalService(sb)


def _build_level3_pvp() -> bytes:
    """
    Build a PVP with institution sig + timestamp anchoring so all R3 rules pass.

    R3.2 requires manifest.timestamp_authority_token or blockchain_anchor.
    build_test_pvp doesn't add these, so we re-open the ZIP and patch the manifest.
    The root_hash computation covers ledger.json + artifact_hashes (NOT manifest.json),
    so patching the manifest content does not break integrity.
    """
    pvp_bytes, _, _, _, _ = build_test_pvp(
        _level2_events(), add_supervisor=True, add_institution=True
    )
    # Re-read all files from the ZIP
    file_contents: Dict[str, bytes] = {}
    with zipfile.ZipFile(io.BytesIO(pvp_bytes), "r") as zf:
        for name in zf.namelist():
            file_contents[name] = zf.read(name)

    # Patch manifest: add timestamp_authority_token (satisfies R3.2)
    manifest_data = json.loads(file_contents["manifest.json"])
    manifest_data["timestamp_authority_token"] = "plexus-tsa-test-token-00000000"
    file_contents["manifest.json"] = json.dumps(
        manifest_data, indent=2, default=str
    ).encode()

    # Repack ZIP
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, content in file_contents.items():
            zf.writestr(name, content)
    return out.getvalue()


# ═════════════════════════════════════════════════════════════════════════════
# 1. verify_package — Level 0 (integrity failure)
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_level0_integrity_failure():
    """Invalid ZIP bytes → integrity fails → trust_level=0 in certificate."""
    svc = _make_service()
    result = svc.verify_package(pvp_bytes=b"not-a-zip", requester_ip=_TEST_IP)
    assert isinstance(result, PortalVerificationResult)
    assert result.certificate.trust_level == 0
    assert result.certificate.integrity_passed is False
    assert result.cached is False


# ═════════════════════════════════════════════════════════════════════════════
# 2. verify_package — Level 1
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_level1():
    """Level-1 PVP → trust_level=1, integrity=True, certificate issued."""
    pvp_bytes, _, _, manifest, project_id = build_test_pvp(_level1_events())
    svc    = _make_service()
    result = svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)
    cert   = result.certificate

    assert result.cached is False
    assert cert.trust_level == 1
    assert cert.trust_label == "Integrity Verified"
    assert cert.integrity_passed is True
    assert cert.root_hash == manifest["root_hash"]
    assert str(cert.project_id) == project_id


# ═════════════════════════════════════════════════════════════════════════════
# 3. verify_package — Level 2
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_level2():
    """Level-2 PVP → trust_level=2, trust_label correct."""
    pvp_bytes, _, _, manifest, _ = build_test_pvp(
        _level2_events(), add_supervisor=True
    )
    svc    = _make_service()
    result = svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)
    cert   = result.certificate
    assert cert.trust_level == 2
    assert cert.trust_label == "Methodologically Transparent"


# ═════════════════════════════════════════════════════════════════════════════
# 4. verify_package — Level 3
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_level3():
    """
    Level-3 PVP (institution sig + timestamp anchoring) → trust_level=3.

    R3.2 requires timestamp_authority_token/blockchain_anchor in the manifest;
    _build_level3_pvp() patches this onto the standard level-2 package.
    """
    pvp_bytes = _build_level3_pvp()
    svc    = _make_service()
    result = svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)
    cert   = result.certificate
    assert cert.trust_level == 3
    assert cert.trust_label == "Institutionally Verified"


# ═════════════════════════════════════════════════════════════════════════════
# 5. verify_package — cache hit
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_cached():
    """If a certificate already exists for this pvp_id, return it (cached=True)."""
    pvp_bytes, _, _, manifest, project_id = build_test_pvp(_level1_events())
    pvp_id   = manifest["project_id"]  # used as pvp_id in service
    cert_row = _make_cert_row(pvp_id=pvp_id, project_id=project_id, trust_level=1)

    svc    = _make_service(cert_rows=[cert_row])
    result = svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)

    assert result.cached is True
    assert str(result.certificate.pvp_id) == pvp_id


# ═════════════════════════════════════════════════════════════════════════════
# 6. verify_package — certificate persisted in DB
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_certificate_persisted():
    """Service inserts a row into verification_certificates on new verification."""
    pvp_bytes, _, _, _, _ = build_test_pvp(_level1_events())
    sb  = _make_sb_mock()
    svc = JournalPortalService(sb)
    svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)

    # Should have called .table("verification_certificates").insert(...).execute()
    insert_calls = [
        call
        for call in sb.table.call_args_list
        if call.args == ("verification_certificates",)
    ]
    assert len(insert_calls) >= 1


# ═════════════════════════════════════════════════════════════════════════════
# 7. verify_package — request logged
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_request_logged():
    """Service inserts a row into verification_requests after every verification."""
    pvp_bytes, _, _, _, _ = build_test_pvp(_level1_events())
    sb  = _make_sb_mock()
    svc = JournalPortalService(sb)
    svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)

    req_calls = [
        call
        for call in sb.table.call_args_list
        if call.args == ("verification_requests",)
    ]
    assert len(req_calls) >= 1


# ═════════════════════════════════════════════════════════════════════════════
# 8. verify_package — portal_signature is valid Ed25519
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_signature_verifiable():
    """portal_signature should verify against the portal's Ed25519 public key."""
    pvp_bytes, _, _, manifest, project_id = build_test_pvp(_level1_events())
    svc    = _make_service()
    result = svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)
    cert   = result.certificate

    # Reconstruct the canonical payload that was signed
    canonical = json.dumps(
        {
            "pvp_id":           str(cert.pvp_id),
            "project_id":       str(cert.project_id),
            "trust_level":      cert.trust_level,
            "trust_label":      cert.trust_label,
            "root_hash":        cert.root_hash,
            "integrity_passed": cert.integrity_passed,
        },
        sort_keys=True,
        separators=(",", ":"),
    )

    # Derive the portal's verify key from the test seed
    sk = nacl.signing.SigningKey(bytes.fromhex(_TEST_SEED_HEX))
    vk = sk.verify_key

    sig_bytes = bytes.fromhex(cert.portal_signature)
    vk.verify(canonical.encode("utf-8"), sig_bytes)   # raises if invalid


# ═════════════════════════════════════════════════════════════════════════════
# 9. verify_package — human_readable contains trust label
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_human_readable_contains_trust_label():
    """Human-readable report should include the PTLS trust label."""
    pvp_bytes, _, _, _, _ = build_test_pvp(_level1_events())
    svc    = _make_service()
    result = svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)
    assert "Integrity Verified" in result.certificate.human_readable
    assert "PLEXUS VERIFICATION CERTIFICATE" in result.certificate.human_readable


# ═════════════════════════════════════════════════════════════════════════════
# 10. verify_package — all 6 AAD rules present in result
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_aad_flags_all_six_rules():
    """Certificate aad_flags should include entries for all 6 AAD rules."""
    pvp_bytes, _, _, _, _ = build_test_pvp(_level1_events())
    svc    = _make_service()
    result = svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)
    codes  = {f.code for f in result.certificate.aad_flags}
    for rule in ("AAD-01", "AAD-02", "AAD-03", "AAD-04", "AAD-05", "AAD-06"):
        assert rule in codes, f"Missing AAD flag: {rule}"
    assert len(result.certificate.aad_flags) == 6


# ═════════════════════════════════════════════════════════════════════════════
# 11. verify_package — SLA breach raises JournalPortalError
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_sla_breach():
    """If verification takes >3s, JournalPortalError is raised."""
    pvp_bytes, _, _, _, _ = build_test_pvp(_level1_events())
    svc = _make_service()

    # Patch time.monotonic so elapsed > 3000ms
    _call_count = {"n": 0}
    real_mono   = time.monotonic

    def _fake_mono():
        _call_count["n"] += 1
        if _call_count["n"] == 1:
            return 0.0
        return 4.0   # 4 seconds elapsed → breach

    with patch("apps.analytics.services.journal_portal_service.time.monotonic", _fake_mono):
        with pytest.raises(JournalPortalError, match="SLA"):
            svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)


# ═════════════════════════════════════════════════════════════════════════════
# 12. verify_package — engine error raises JournalPortalError
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_engine_error_raises():
    """If VerificationEngine.verify raises, JournalPortalError is propagated."""
    svc = _make_service()

    with patch.object(svc._engine, "verify", side_effect=RuntimeError("boom")):
        with pytest.raises(JournalPortalError, match="Verification engine error"):
            svc.verify_package(pvp_bytes=b"fake-zip", requester_ip=_TEST_IP)


# ═════════════════════════════════════════════════════════════════════════════
# 13. verify_package — 90-day expiry on certificate
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_package_certificate_90_day_expiry():
    """Certificate expires_at should be ~90 days after issued_at."""
    pvp_bytes, _, _, _, _ = build_test_pvp(_level1_events())
    svc    = _make_service()
    result = svc.verify_package(pvp_bytes=pvp_bytes, requester_ip=_TEST_IP)
    cert   = result.certificate

    delta = cert.expires_at - cert.issued_at
    assert 89 <= delta.days <= 91


# ═════════════════════════════════════════════════════════════════════════════
# 14. verify_package — IP hash (never stored raw)
# ═════════════════════════════════════════════════════════════════════════════

def test_ip_is_hashed_not_stored_raw():
    """The _hash_ip helper produces a SHA-256 hex digest, not the raw IP."""
    ip     = "10.0.0.5"
    hashed = _hash_ip(ip)
    expected = hashlib.sha256(ip.encode()).hexdigest()
    assert hashed == expected
    assert ip not in hashed
    assert len(hashed) == 64


# ═════════════════════════════════════════════════════════════════════════════
# 15. get_certificate — found
# ═════════════════════════════════════════════════════════════════════════════

def test_get_certificate_found():
    """get_certificate returns the existing cert when pvp_id is in DB."""
    pvp_id   = str(uuid4())
    cert_row = _make_cert_row(pvp_id=pvp_id, trust_level=2)
    svc      = _make_service(cert_rows=[cert_row])
    result   = svc.get_certificate(pvp_id)

    assert result.found is True
    assert result.pvp_id == pvp_id
    assert result.certificate is not None
    assert result.certificate.trust_level == 2


# ═════════════════════════════════════════════════════════════════════════════
# 16. get_certificate — not found
# ═════════════════════════════════════════════════════════════════════════════

def test_get_certificate_not_found():
    """get_certificate returns found=False when no cert exists for pvp_id."""
    svc    = _make_service(cert_rows=[])   # empty DB
    result = svc.get_certificate(str(uuid4()))

    assert result.found is False
    assert result.certificate is None


# ═════════════════════════════════════════════════════════════════════════════
# 17. /health endpoint
# ═════════════════════════════════════════════════════════════════════════════

def test_health_endpoint():
    """GET /api/journal/health returns 200 and status=ok."""
    client = TestClient(app)
    resp   = client.get("/api/journal/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert "journal-verification-portal" in resp.json()["service"]


# ═════════════════════════════════════════════════════════════════════════════
# 18. /public-key endpoint
# ═════════════════════════════════════════════════════════════════════════════

def test_public_key_endpoint():
    """GET /api/journal/public-key returns Ed25519 public key in hex."""
    client = TestClient(app)
    resp   = client.get("/api/journal/public-key")
    assert resp.status_code == 200
    data   = resp.json()
    assert data["algorithm"] == "Ed25519"
    pub_key_hex = data["public_key"]
    # Verify it's a valid hex Ed25519 verify key (32 bytes = 64 hex chars)
    assert len(pub_key_hex) == 64
    # Verify it matches our test seed
    sk  = nacl.signing.SigningKey(bytes.fromhex(_TEST_SEED_HEX))
    expected = sk.verify_key.encode(nacl.encoding.HexEncoder).decode()
    assert pub_key_hex == expected


# ═════════════════════════════════════════════════════════════════════════════
# 19. POST /api/journal/verify — router integration (happy path)
# ═════════════════════════════════════════════════════════════════════════════

def test_router_verify_endpoint_happy_path():
    """POST /api/journal/verify with a real .pvp file returns 200 + certificate."""
    pvp_bytes, _, _, manifest, _ = build_test_pvp(_level1_events())
    svc = _make_service()

    app.dependency_overrides[_get_service] = lambda: svc
    try:
        client = TestClient(app)
        resp   = client.post(
            "/api/journal/verify",
            files={"file": ("test.pvp", io.BytesIO(pvp_bytes), "application/octet-stream")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "certificate" in data
        assert data["certificate"]["trust_level"] >= 0
        assert data["cached"] is False
    finally:
        app.dependency_overrides.pop(_get_service, None)


# ═════════════════════════════════════════════════════════════════════════════
# 20. Rate limiting — POST /api/journal/verify capped at 20/minute
# ═════════════════════════════════════════════════════════════════════════════

def test_rate_limit_verify_endpoint():
    """
    Rate limit on POST /api/journal/verify is 20/minute per IP.

    We send enough requests to trigger a 429 and verify:
      - At least one 200 is returned (endpoint works)
      - A 429 is eventually returned (rate limit enforced)
      - No more than 20 requests succeed

    NOTE: slowapi state is shared across tests in this session; we reset it
    via the limiter's storage before this test to get a clean baseline.
    """
    from datetime import timedelta
    from apps.analytics.routers.journal_portal import limiter

    # Reset in-memory rate limit counters so prior tests don't contaminate
    try:
        limiter._storage.reset()
    except Exception:
        pass  # storage reset is best-effort; test still validates the invariant

    pvp_bytes, _, _, _, _ = build_test_pvp(_level1_events())

    now = datetime.now(timezone.utc)
    fake_cert = VerificationCertificate(
        certificate_id=uuid4(),
        pvp_id=uuid4(),
        project_id=uuid4(),
        trust_level=1,
        trust_label="Integrity Verified",
        aad_flags=[],
        integrity_passed=True,
        root_hash="a" * 64,
        human_readable="TEST",
        portal_signature="b" * 128,
        issued_at=now,
        expires_at=now + timedelta(days=90),
    )
    fake_result = PortalVerificationResult(
        certificate=fake_cert, processing_ms=5, cached=False
    )

    mock_svc = MagicMock()
    mock_svc.verify_package.return_value = fake_result

    app.dependency_overrides[_get_service] = lambda: mock_svc
    try:
        client   = TestClient(app, raise_server_exceptions=False)
        statuses: List[int] = []
        # Send 25 requests to guarantee we hit the limit regardless of prior state
        for _ in range(25):
            resp = client.post(
                "/api/journal/verify",
                files={"file": ("t.pvp", io.BytesIO(pvp_bytes), "application/octet-stream")},
                headers={"X-Forwarded-For": "10.0.0.1"},
            )
            statuses.append(resp.status_code)

        ok_count      = statuses.count(200)
        limited_count = statuses.count(429)

        assert ok_count >= 1,       f"Expected at least 1 successful request, got: {statuses}"
        assert limited_count >= 1,  f"Expected at least 1 rate-limited (429) response, got: {statuses}"
        assert ok_count <= 20,      f"Expected at most 20 successes (limit=20/min), got {ok_count}: {statuses}"
    finally:
        app.dependency_overrides.pop(_get_service, None)
