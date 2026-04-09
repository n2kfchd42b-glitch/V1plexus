"""
Tests for PLEXUS PVPBuilder service.

All tests mock the Supabase client and storage so no live DB or bucket is
required.

Run from the project root:
    pytest apps/analytics/tests/test_pvp_builder.py -v
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import zipfile
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import nacl.signing
import pytest

from apps.analytics.models.ledger import GENESIS_HASH
from apps.analytics.services.ledger_service import LedgerService
from apps.analytics.services.pvp_builder import (
    PVPBuildError,
    PVPBuilder,
    PVPSealError,
    _build_zip,
    _compute_root_hash,
    _compute_root_hash_from_zip,
    _read_manifest,
    _rebuild_zip,
)


# ── Shared test fixtures ──────────────────────────────────────────────────────

def _make_signing_key() -> tuple[nacl.signing.SigningKey, bytes]:
    key = nacl.signing.SigningKey.generate()
    return key, bytes(key)


def _make_ledger_event(seq: int, project_id: str, event_type: str = "analysis_run_completed") -> dict:
    """Return a minimal ledger event row dict."""
    return {
        "id": str(uuid4()),
        "project_id": project_id,
        "sequence_number": seq,
        "event_type": event_type,
        "payload": {"note": f"event {seq}"},
        "previous_hash": GENESIS_HASH if seq == 1 else "a" * 64,
        "event_hash": "b" * 64,
        "signature": "c" * 128,
        "session_key_id": str(uuid4()),
        "actor_id": str(uuid4()),
        "actor_role": "author",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def _make_ledger_with_seal(project_id: str, n: int = 3) -> list[dict]:
    """Build n normal events + 1 project_sealed event."""
    events = [_make_ledger_event(i + 1, project_id) for i in range(n)]
    events.append(_make_ledger_event(n + 1, project_id, "project_sealed"))
    return events


def _make_pvp_record(
    pvp_id: str,
    project_id: str,
    status: str,
    storage_path: str,
    root_hash: str = "d" * 64,
) -> dict:
    return {
        "id": pvp_id,
        "project_id": project_id,
        "pvp_format_version": "1.0",
        "ptls_version": "0.1",
        "root_hash": root_hash,
        "total_events": 4,
        "status": status,
        "storage_path": storage_path,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "sealed_at": None,
        "author_signature": "sig_author" if status not in ("unsigned",) else None,
        "supervisor_signature": None,
        "institutional_boundary": "institutional",
        "deployment_mode": "cloud",
    }


def _minimal_zip(manifest: dict | None = None, ledger: list | None = None) -> bytes:
    """Build the simplest valid PVP ZIP for testing."""
    ledger = ledger or []
    ledger_json = json.dumps(ledger, default=str, sort_keys=True)

    artifact_hashes: dict[str, str] = {
        "ledger.json": hashlib.sha256(ledger_json.encode()).hexdigest()
    }
    root_hash = _compute_root_hash(ledger_json, artifact_hashes)

    manifest = manifest or {
        "pvp_format_version": "1.0",
        "ptls_version": "0.1",
        "plexus_version": "1.0.0",
        "project_id": str(uuid4()),
        "project_sealed_at": None,
        "built_at": datetime.now(timezone.utc).isoformat(),
        "total_events": len(ledger),
        "final_run_event_id": str(uuid4()),
        "root_hash": root_hash,
        "artifact_hashes": artifact_hashes,
        "signatures": {"author": None, "supervisor": None},
        "institutional_boundary": "institutional",
        "deployment_mode": "cloud",
        "aad_version": "0.1",
        "revocation_check_url": "https://verify.plexus.science/revocation",
    }

    return _build_zip(manifest, ledger_json, {})


def _make_supabase_mock(
    project_id: str,
    ledger_rows: list[dict],
    pvp_record: dict | None = None,
    zip_bytes: bytes | None = None,
    public_key_hex: str = "e" * 64,
    sealed_pvp_exists: bool = False,
) -> MagicMock:
    """
    Full Supabase mock that wires up all tables and storage calls
    the PVPBuilder touches.
    """
    mock = MagicMock()

    def table(name: str):
        tbl = MagicMock()

        # ── projects ──────────────────────────────────────────────────────
        if name == "projects":
            q = MagicMock()
            q.execute.return_value = MagicMock(data={"id": project_id, "title": "Test"})
            q.eq.return_value = q
            q.select.return_value = q
            q.single.return_value = q
            tbl.select.return_value = q

        # ── ledger_events ─────────────────────────────────────────────────
        elif name == "ledger_events":
            q = MagicMock()
            q.execute.return_value = MagicMock(data=ledger_rows)
            q.eq.return_value = q
            q.order.return_value = q
            q.limit.return_value = q
            q.select.return_value = q
            # insert returns the first row (for write_event calls in seal)
            insert_mock = MagicMock()
            insert_mock.execute.return_value = MagicMock(data=[ledger_rows[-1]] if ledger_rows else [{}])
            tbl.select.return_value = q
            tbl.insert.return_value = insert_mock

        # ── pvp_packages ──────────────────────────────────────────────────
        elif name == "pvp_packages":
            # select (require_pvp, sealed_pvp_exists)
            q = MagicMock()
            pvp_data = [pvp_record] if pvp_record else []
            q.execute.return_value = MagicMock(data=pvp_data[0] if pvp_data else None)
            q.eq.return_value = q
            q.limit.return_value = q
            q.select.return_value = q
            q.single.return_value = q
            tbl.select.return_value = q

            # sealed_pvp_exists uses a separate .limit(1) path
            sealed_q = MagicMock()
            sealed_q.execute.return_value = MagicMock(
                data=[{"id": str(uuid4())}] if sealed_pvp_exists else []
            )
            sealed_q.eq.return_value = sealed_q
            sealed_q.limit.return_value = sealed_q

            # insert
            insert_mock = MagicMock()
            new_id = str(uuid4())
            insert_mock.execute.return_value = MagicMock(data=[{"id": new_id}])
            tbl.insert.return_value = insert_mock

            # update
            update_mock = MagicMock()
            update_mock.execute.return_value = MagicMock(data=[pvp_record or {}])
            update_mock.eq.return_value = update_mock
            tbl.update.return_value = update_mock

        # ── ledger_session_keys ───────────────────────────────────────────
        elif name == "ledger_session_keys":
            q = MagicMock()
            q.execute.return_value = MagicMock(data={
                "public_key": public_key_hex,
                "revoked": False,
                "expires_at": (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat(),
            })
            q.eq.return_value = q
            q.single.return_value = q
            q.select.return_value = q
            tbl.select.return_value = q

        # ── analysis_runs (artifact collection) ───────────────────────────
        elif name == "analysis_runs":
            q = MagicMock()
            q.execute.return_value = MagicMock(data=[])
            q.eq.return_value = q
            q.select.return_value = q
            tbl.select.return_value = q

        return tbl

    mock.table.side_effect = table

    # ── Storage ───────────────────────────────────────────────────────────
    bucket_mock = MagicMock()
    bucket_mock.upload.return_value = None
    bucket_mock.update.return_value = None
    bucket_mock.download.return_value = zip_bytes or _minimal_zip()
    mock.storage.from_.return_value = bucket_mock

    return mock


# ═════════════════════════════════════════════════════════════════════════════
# 1. test_build_requires_sealed_project
# ═════════════════════════════════════════════════════════════════════════════

def test_build_requires_sealed_project():
    """build() must raise PVPBuildError if no 'project_sealed' event exists."""
    project_id = str(uuid4())
    # Ledger has events but none is project_sealed
    ledger_rows = [_make_ledger_event(i + 1, project_id) for i in range(3)]
    mock_sb = _make_supabase_mock(project_id, ledger_rows)

    builder = PVPBuilder(mock_sb)
    with pytest.raises(PVPBuildError, match="sealed"):
        builder.build(project_id=project_id, actor_id=str(uuid4()))


# ═════════════════════════════════════════════════════════════════════════════
# 2. test_root_hash_deterministic
# ═════════════════════════════════════════════════════════════════════════════

def test_root_hash_deterministic():
    """
    Given identical ledger JSON and artifact hashes, _compute_root_hash must
    return the same value on every call regardless of dict insertion order.
    """
    ledger_json = json.dumps([{"id": "1", "event": "test"}], sort_keys=True)

    artifact_hashes_a = {
        "ledger.json":             "aaa",
        "outputs/figure_1.png":   "bbb",
        "outputs/table_1.csv":    "ccc",
    }
    # Same pairs, different insertion order
    artifact_hashes_b = {
        "outputs/table_1.csv":    "ccc",
        "ledger.json":             "aaa",
        "outputs/figure_1.png":   "bbb",
    }

    h1 = _compute_root_hash(ledger_json, artifact_hashes_a)
    h2 = _compute_root_hash(ledger_json, artifact_hashes_b)
    assert h1 == h2, "Root hash must be deterministic regardless of dict order"
    assert len(h1) == 64


# ═════════════════════════════════════════════════════════════════════════════
# 3. test_author_signature_valid
# ═════════════════════════════════════════════════════════════════════════════

def test_author_signature_valid():
    """
    sign_author() must produce a valid Ed25519 signature over the root hash.
    Verified by re-loading the public key and checking the signature.
    """
    signing_key, raw_key = _make_signing_key()
    public_key_hex = signing_key.verify_key.encode().hex()

    project_id   = str(uuid4())
    pvp_id       = str(uuid4())
    session_key_id = str(uuid4())
    storage_path = f"pvp/{project_id}/test.pvp"
    zip_bytes    = _minimal_zip()

    pvp_record = _make_pvp_record(pvp_id, project_id, "unsigned", storage_path)
    mock_sb = _make_supabase_mock(
        project_id,
        _make_ledger_with_seal(project_id),
        pvp_record=pvp_record,
        zip_bytes=zip_bytes,
        public_key_hex=public_key_hex,
    )

    builder = PVPBuilder(mock_sb)
    result = builder.sign_author(
        pvp_id=pvp_id,
        actor_id=str(uuid4()),
        session_key_id=session_key_id,
        private_key_bytes=raw_key,
    )

    assert result.status == "author_signed"

    # Verify the signature is genuinely valid
    updated_manifest = _read_manifest(mock_sb.storage.from_.return_value.update.call_args[0][1])
    sig_hex   = updated_manifest["signatures"]["author"]["signature"]
    root_hash = updated_manifest["root_hash"]

    verify_key = nacl.signing.VerifyKey(bytes.fromhex(public_key_hex))
    # Should not raise BadSignatureError
    verify_key.verify(root_hash.encode("utf-8"), bytes.fromhex(sig_hex))


# ═════════════════════════════════════════════════════════════════════════════
# 4. test_supervisor_signature_requires_author_first
# ═════════════════════════════════════════════════════════════════════════════

def test_supervisor_signature_requires_author_first():
    """sign_supervisor() must raise PVPBuildError if status is not 'author_signed'."""
    _, raw_key = _make_signing_key()
    project_id = str(uuid4())
    pvp_id     = str(uuid4())
    storage_path = f"pvp/{project_id}/test.pvp"

    # Status is still 'unsigned' — author hasn't signed yet
    pvp_record = _make_pvp_record(pvp_id, project_id, "unsigned", storage_path)
    pvp_record["author_signature"] = None
    mock_sb = _make_supabase_mock(
        project_id,
        _make_ledger_with_seal(project_id),
        pvp_record=pvp_record,
    )

    builder = PVPBuilder(mock_sb)
    with pytest.raises(PVPBuildError, match="author_signed"):
        builder.sign_supervisor(
            pvp_id=pvp_id,
            supervisor_id=str(uuid4()),
            session_key_id=str(uuid4()),
            private_key_bytes=raw_key,
        )


# ═════════════════════════════════════════════════════════════════════════════
# 5. test_seal_rejects_tampered_package
# ═════════════════════════════════════════════════════════════════════════════

def test_seal_rejects_tampered_package():
    """
    seal() must raise PVPSealError when an artifact inside the ZIP has been
    modified after signing (root hash recomputation will not match manifest).
    """
    project_id = str(uuid4())
    pvp_id     = str(uuid4())
    storage_path = f"pvp/{project_id}/test.pvp"

    # Build a valid ZIP, then tamper with ledger.json to change its content
    # without updating manifest["root_hash"]
    original_zip = _minimal_zip()
    buf = io.BytesIO(original_zip)
    tampered_buf = io.BytesIO()
    with (
        zipfile.ZipFile(buf, "r") as src,
        zipfile.ZipFile(tampered_buf, "w", zipfile.ZIP_DEFLATED) as dst,
    ):
        for name in src.namelist():
            if name == "ledger.json":
                # Inject extra data — changes the content hash
                dst.writestr(name, src.read(name) + b"\n/* tampered */")
            else:
                dst.writestr(name, src.read(name))
    tampered_zip = tampered_buf.getvalue()

    pvp_record = _make_pvp_record(pvp_id, project_id, "author_signed", storage_path)
    pvp_record["author_signature"] = "existing_author_sig"
    mock_sb = _make_supabase_mock(
        project_id,
        _make_ledger_with_seal(project_id),
        pvp_record=pvp_record,
        zip_bytes=tampered_zip,
    )

    builder = PVPBuilder(mock_sb)
    with pytest.raises(PVPSealError, match="integrity check failed"):
        builder.seal(pvp_id=pvp_id, actor_id=str(uuid4()))


# ═════════════════════════════════════════════════════════════════════════════
# 6. test_journal_boundary_blocked
# ═════════════════════════════════════════════════════════════════════════════

def test_journal_boundary_blocked():
    """
    The require_institutional dependency must raise HTTPException(403)
    when SERVICE_BOUNDARY=journal.
    """
    import importlib

    from fastapi import HTTPException

    from apps.analytics.routers.pvp import require_institutional

    original = os.environ.get("SERVICE_BOUNDARY")
    try:
        os.environ["SERVICE_BOUNDARY"] = "journal"
        with pytest.raises(HTTPException) as exc_info:
            require_institutional()
        assert exc_info.value.status_code == 403
    finally:
        if original is None:
            os.environ.pop("SERVICE_BOUNDARY", None)
        else:
            os.environ["SERVICE_BOUNDARY"] = original


# ═════════════════════════════════════════════════════════════════════════════
# 7. test_manifest_version_fields_present
# ═════════════════════════════════════════════════════════════════════════════

def test_manifest_version_fields_present():
    """
    A ZIP built by _build_zip must contain manifest.json with
    pvp_format_version and ptls_version fields.
    """
    ledger_json = json.dumps([], sort_keys=True)
    artifact_hashes = {"ledger.json": hashlib.sha256(ledger_json.encode()).hexdigest()}
    root_hash = _compute_root_hash(ledger_json, artifact_hashes)

    manifest = {
        "pvp_format_version":   "1.0",
        "ptls_version":         "0.1",
        "plexus_version":       "1.0.0",
        "project_id":           str(uuid4()),
        "project_sealed_at":    None,
        "built_at":             datetime.now(timezone.utc).isoformat(),
        "total_events":         0,
        "final_run_event_id":   str(uuid4()),
        "root_hash":            root_hash,
        "artifact_hashes":      artifact_hashes,
        "signatures":           {"author": None, "supervisor": None},
        "institutional_boundary": "institutional",
        "deployment_mode":      "cloud",
        "aad_version":          "0.1",
        "revocation_check_url": "https://verify.plexus.science/revocation",
    }

    zip_bytes = _build_zip(manifest, ledger_json, {})
    parsed = _read_manifest(zip_bytes)

    assert parsed["pvp_format_version"] == "1.0"
    assert parsed["ptls_version"] == "0.1"
    assert parsed["root_hash"] == root_hash
    assert "signatures" in parsed
    assert "artifact_hashes" in parsed


# ═════════════════════════════════════════════════════════════════════════════
# 8. test_pvp_contains_full_ledger
# ═════════════════════════════════════════════════════════════════════════════

def test_pvp_contains_full_ledger():
    """
    build() must embed all ledger events in ledger.json, in sequence order.
    Verified by opening the ZIP and parsing ledger.json directly.
    """
    project_id = str(uuid4())
    pvp_id     = str(uuid4())

    # 10 normal events + 1 project_sealed
    ledger_rows = _make_ledger_with_seal(project_id, n=10)

    # Capture what gets uploaded to storage
    uploaded: list[bytes] = []

    mock_sb = _make_supabase_mock(project_id, ledger_rows)

    # Override upload to capture the bytes
    def capture_upload(path, data, *args, **kwargs):
        uploaded.append(data)
    mock_sb.storage.from_.return_value.upload.side_effect = capture_upload

    builder = PVPBuilder(mock_sb)
    result = builder.build(project_id=project_id, actor_id=str(uuid4()))

    assert result.total_events == 11
    assert len(uploaded) == 1

    # Open the ZIP and check ledger.json
    buf = io.BytesIO(uploaded[0])
    with zipfile.ZipFile(buf, "r") as zf:
        assert "ledger.json" in zf.namelist()
        assert "manifest.json" in zf.namelist()
        assert "signatures.json" in zf.namelist()

        events = json.loads(zf.read("ledger.json"))

    assert len(events) == 11
    # Sequence order must be ascending
    seqs = [e["sequence_number"] for e in events]
    assert seqs == sorted(seqs)
    # Last event is the seal event
    assert events[-1]["event_type"] == "project_sealed"
