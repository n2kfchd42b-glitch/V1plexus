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

# ═════════════════════════════════════════════════════════════════════════════
# 9. test_seal_happy_path
# ═════════════════════════════════════════════════════════════════════════════

def test_seal_happy_path():
    """
    Full flow: build → sign_author → seal
    Confirms seal() completes successfully, sets status to 'sealed',
    records sealed_at, and writes project_sealed event to ledger.

    Two separate Supabase mocks are used:
      - mock_sb_pvp  : backs PVPBuilder and its internal LedgerService.
                       Provides the initial ledger (with a pre-existing
                       project_sealed event so build() can proceed) plus
                       all pvp_packages / storage state.
      - mock_sb_ledger: backs the standalone LedgerService used for the
                        final assertion. It only sees events that seal()
                        wrote via write_event(), so len(seal_events) == 1.
    """
    # ── Keypair & IDs ─────────────────────────────────────────────────────────
    signing_key = nacl.signing.SigningKey.generate()
    test_private_key_bytes = bytes(signing_key)
    test_public_key_hex = signing_key.verify_key.encode().hex()

    test_project_id = str(uuid4())
    test_author_id  = str(uuid4())
    test_session_key_id = str(uuid4())
    test_pvp_id     = str(uuid4())

    # ── Initial ledger: 2 normal events + 1 project_sealed (no pvp_id) ───────
    initial_events = _make_ledger_with_seal(test_project_id, n=2)
    # initial_events[2] is project_sealed; its payload has no "pvp_id" key.

    # ── Shared mutable state ──────────────────────────────────────────────────
    zip_storage: dict[str, bytes] = {}
    pvp_record_container: list = [None]   # updated by insert / update calls
    captured_seal_events: list[dict] = []  # populated by write_event inside seal()

    # ── mock_sb_pvp ───────────────────────────────────────────────────────────
    mock_sb_pvp = MagicMock()

    def _pvp_table(name: str):
        tbl = MagicMock()

        if name == "projects":
            q = MagicMock()
            q.execute.return_value = MagicMock(
                data={"id": test_project_id, "title": "Test Project"}
            )
            q.eq.return_value = q
            q.single.return_value = q
            tbl.select.return_value = q

        elif name == "ledger_events":
            # select("*")  → used by get_project_ledger (inside build())
            select_all_q = MagicMock()
            select_all_q.execute.return_value = MagicMock(data=initial_events)
            select_all_q.eq.return_value = select_all_q
            select_all_q.order.return_value = select_all_q
            select_all_q.limit.return_value = select_all_q

            # select("sequence_number, event_hash") → used by write_event in seal()
            last_event = initial_events[-1]
            select_last_q = MagicMock()
            select_last_q.execute.return_value = MagicMock(data=[{
                "sequence_number": last_event["sequence_number"],
                "event_hash":      last_event["event_hash"],
            }])
            select_last_q.eq.return_value = select_last_q
            select_last_q.order.return_value = select_last_q
            select_last_q.limit.return_value = select_last_q

            def _le_select(columns):
                return select_all_q if columns == "*" else select_last_q

            tbl.select.side_effect = _le_select

            def _le_insert(row):
                full_row = {"id": str(uuid4()), **row}
                captured_seal_events.append(full_row)
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[full_row])
                return m

            tbl.insert.side_effect = _le_insert

        elif name == "pvp_packages":
            # _sealed_pvp_exists: select("id").eq(...).eq(...).limit(1)
            sealed_q = MagicMock()
            sealed_q.execute.return_value = MagicMock(data=[])
            sealed_q.eq.return_value = sealed_q
            sealed_q.limit.return_value = sealed_q

            def _pvp_select(columns):
                if columns == "id":
                    return sealed_q
                # _require_pvp: select("*").eq("id", pvp_id).single()
                q = MagicMock()
                q.execute.return_value = MagicMock(data=pvp_record_container[0])
                q.eq.return_value = q
                q.single.return_value = q
                return q

            tbl.select.side_effect = _pvp_select

            def _pvp_insert(row):
                pvp_record_container[0] = {"id": test_pvp_id, **row}
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[pvp_record_container[0]])
                return m

            tbl.insert.side_effect = _pvp_insert

            def _pvp_update(updates):
                pvp_record_container[0] = {**pvp_record_container[0], **updates}
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[pvp_record_container[0]])
                m.eq.return_value = m
                return m

            tbl.update.side_effect = _pvp_update

        elif name == "ledger_session_keys":
            q = MagicMock()
            q.execute.return_value = MagicMock(data={
                "public_key": test_public_key_hex,
                "revoked":    False,
                "expires_at": (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat(),
            })
            q.eq.return_value = q
            q.single.return_value = q
            tbl.select.return_value = q

        elif name == "analysis_runs":
            q = MagicMock()
            q.execute.return_value = MagicMock(data=[])
            q.eq.return_value = q
            tbl.select.return_value = q

        return tbl

    mock_sb_pvp.table.side_effect = _pvp_table

    bucket = MagicMock()
    bucket.upload.side_effect  = lambda path, data, *a, **kw: zip_storage.__setitem__(path, data)
    bucket.update.side_effect  = lambda path, data, *a, **kw: zip_storage.__setitem__(path, data)
    bucket.download.side_effect = lambda path: zip_storage[path]
    mock_sb_pvp.storage.from_.return_value = bucket

    # ── mock_sb_ledger — only sees events written by seal() ───────────────────
    mock_sb_ledger = MagicMock()

    def _ledger_table(name: str):
        tbl = MagicMock()
        if name == "ledger_events":
            q = MagicMock()
            q.execute.side_effect = lambda: MagicMock(data=list(captured_seal_events))
            q.eq.return_value = q
            q.order.return_value = q
            tbl.select.return_value = q
        return tbl

    mock_sb_ledger.table.side_effect = _ledger_table

    # ── Services ──────────────────────────────────────────────────────────────
    pvp_builder    = PVPBuilder(mock_sb_pvp)
    ledger_service = LedgerService(mock_sb_ledger)

    # ── Build ─────────────────────────────────────────────────────────────────
    build_result = pvp_builder.build(
        project_id=test_project_id,
        actor_id=test_author_id,
        deployment_mode="cloud",
    )
    assert build_result.status == "unsigned"

    # ── Sign ──────────────────────────────────────────────────────────────────
    sign_result = pvp_builder.sign_author(
        pvp_id=str(build_result.pvp_id),
        actor_id=test_author_id,
        session_key_id=test_session_key_id,
        private_key_bytes=test_private_key_bytes,
    )
    assert sign_result.status == "author_signed"

    # ── Seal (pass key material so seal() writes the ledger event) ────────────
    seal_result = pvp_builder.seal(
        pvp_id=str(build_result.pvp_id),
        actor_id=test_author_id,
        session_key_id=test_session_key_id,
        private_key_bytes=test_private_key_bytes,
    )
    assert seal_result.status == "sealed"
    assert seal_result.sealed_at is not None
    assert seal_result.root_hash == build_result.root_hash

    # ── Confirm ledger recorded the seal event ────────────────────────────────
    ledger = ledger_service.get_project_ledger(test_project_id)
    seal_events = [e for e in ledger if e.event_type == "project_sealed"]
    assert len(seal_events) == 1
    assert seal_events[0].payload["pvp_id"] == str(build_result.pvp_id)


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
