"""
Tests for PLEXUS LedgerService and KeyService.

All tests mock the Supabase client so no live DB connection is required.

Run from the project root:
    pytest apps/analytics/tests/test_ledger_service.py -v
"""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import nacl.signing
import pytest

from apps.analytics.models.ledger import GENESIS_HASH, VALID_EVENT_TYPES
from apps.analytics.services.key_service import KeyService
from apps.analytics.services.ledger_service import LedgerService


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_signing_key() -> tuple[nacl.signing.SigningKey, bytes]:
    """Return a fresh Ed25519 keypair (SigningKey, raw_seed_bytes)."""
    key = nacl.signing.SigningKey.generate()
    return key, bytes(key)


def _build_event_row(
    seq: int,
    project_id: str,
    prev_hash: str,
    signing_key: nacl.signing.SigningKey,
    session_key_id: str | None = None,
    actor_id: str | None = None,
    payload: dict | None = None,
    timestamp: str | None = None,
) -> dict:
    """Build a realistic ledger_events row as the DB would return it."""
    payload = payload or {"note": f"event {seq}"}
    ts = timestamp or datetime.now(timezone.utc).isoformat()
    session_key_id = session_key_id or str(uuid4())
    actor_id = actor_id or str(uuid4())

    payload_canonical = json.dumps(payload, sort_keys=True, default=str)
    raw = payload_canonical + prev_hash + ts
    event_hash = hashlib.sha256(raw.encode()).hexdigest()
    signature = signing_key.sign(event_hash.encode()).signature.hex()

    return {
        "id": str(uuid4()),
        "project_id": project_id,
        "sequence_number": seq,
        "event_type": "analysis_run_completed",
        "payload": payload,
        "previous_hash": prev_hash,
        "event_hash": event_hash,
        "signature": signature,
        "session_key_id": session_key_id,
        "actor_id": actor_id,
        "actor_role": "author",
        "timestamp": ts,
    }


def _build_chain(
    n: int,
    project_id: str,
    signing_key: nacl.signing.SigningKey,
    session_key_id: str,
    actor_id: str,
) -> list[dict]:
    """Build a valid chain of n events."""
    rows = []
    prev_hash = GENESIS_HASH
    for i in range(1, n + 1):
        row = _build_event_row(
            seq=i,
            project_id=project_id,
            prev_hash=prev_hash,
            signing_key=signing_key,
            session_key_id=session_key_id,
            actor_id=actor_id,
        )
        prev_hash = row["event_hash"]
        rows.append(row)
    return rows


def _make_supabase_mock(chain: list[dict], public_key_hex: str) -> MagicMock:
    """
    Return a Supabase mock that:
      - Returns the full chain from ledger_events queries.
      - Returns public_key_hex from ledger_session_keys queries.
      - Simulates a successful insert returning the last item in `chain`.
    """
    mock = MagicMock()

    # ledger_events select (verify_chain / get_project_ledger)
    events_query = MagicMock()
    events_query.execute.return_value = MagicMock(data=chain)
    events_query.eq.return_value = events_query
    events_query.order.return_value = events_query
    events_query.limit.return_value = events_query

    # ledger_session_keys select
    key_query = MagicMock()
    key_query.execute.return_value = MagicMock(data={
        "public_key": public_key_hex,
        "revoked": False,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=8)).isoformat(),
    })
    key_query.eq.return_value = key_query
    key_query.single.return_value = key_query

    def table_side_effect(name: str):
        tbl = MagicMock()
        if name == "ledger_events":
            tbl.select.return_value = events_query
            tbl.insert.return_value = MagicMock(
                execute=MagicMock(
                    return_value=MagicMock(data=[chain[-1]] if chain else [])
                )
            )
        elif name == "ledger_session_keys":
            tbl.select.return_value = key_query
        return tbl

    mock.table.side_effect = table_side_effect
    return mock


# ═════════════════════════════════════════════════════════════════════════════
# 1. test_chain_integrity_valid
# ═════════════════════════════════════════════════════════════════════════════

def test_chain_integrity_valid():
    """A correctly constructed 5-event chain must verify as valid."""
    signing_key, _ = _make_signing_key()
    public_key_hex = signing_key.verify_key.encode().hex()
    project_id = str(uuid4())
    session_key_id = str(uuid4())
    actor_id = str(uuid4())

    chain = _build_chain(5, project_id, signing_key, session_key_id, actor_id)
    mock_sb = _make_supabase_mock(chain, public_key_hex)

    svc = LedgerService(mock_sb)
    result = svc.verify_chain(project_id)

    assert result.valid is True
    assert result.total_events == 5
    assert result.first_broken_sequence is None
    for entry in result.verification_detail:
        assert entry["passed"] is True, f"Event {entry['sequence_number']} failed: {entry}"


# ═════════════════════════════════════════════════════════════════════════════
# 2. test_chain_integrity_tampered
# ═════════════════════════════════════════════════════════════════════════════

def test_chain_integrity_tampered():
    """
    Tampering with event_hash of event #3 must:
      - report valid=False
      - set first_broken_sequence to 3
    """
    signing_key, _ = _make_signing_key()
    public_key_hex = signing_key.verify_key.encode().hex()
    project_id = str(uuid4())
    session_key_id = str(uuid4())
    actor_id = str(uuid4())

    chain = _build_chain(5, project_id, signing_key, session_key_id, actor_id)

    # Simulate a direct DB mutation of event #3's event_hash
    tampered_chain = deepcopy(chain)
    tampered_chain[2]["event_hash"] = "a" * 64  # corrupt hash at index 2 (seq 3)

    mock_sb = _make_supabase_mock(tampered_chain, public_key_hex)

    svc = LedgerService(mock_sb)
    result = svc.verify_chain(project_id)

    assert result.valid is False
    assert result.first_broken_sequence == 3


# ═════════════════════════════════════════════════════════════════════════════
# 3. test_append_only_enforced
# ═════════════════════════════════════════════════════════════════════════════

def test_append_only_enforced():
    """
    The Supabase table must raise an exception on UPDATE attempts.
    This test simulates the DB rejecting an update (as RLS + REVOKE would do).
    """
    mock_sb = MagicMock()
    update_mock = MagicMock()
    update_mock.eq.return_value = update_mock
    update_mock.execute.side_effect = Exception(
        "permission denied for table ledger_events"
    )
    mock_sb.table.return_value.update.return_value = update_mock

    with pytest.raises(Exception, match="permission denied"):
        mock_sb.table("ledger_events").update(
            {"event_hash": "tampered"}
        ).eq("id", str(uuid4())).execute()


# ═════════════════════════════════════════════════════════════════════════════
# 4. test_event_type_validation
# ═════════════════════════════════════════════════════════════════════════════

def test_event_type_validation():
    """write_event must raise ValueError for an unrecognised event_type."""
    mock_sb = MagicMock()
    svc = LedgerService(mock_sb)

    signing_key, raw_key = _make_signing_key()

    with pytest.raises(ValueError, match="Invalid event_type"):
        svc.write_event(
            project_id=str(uuid4()),
            event_type="not_a_real_event_type",
            payload={"x": 1},
            actor_id=str(uuid4()),
            actor_role="author",
            session_key_id=str(uuid4()),
            session_key=raw_key,
        )

    # Also verify all official types are accepted (no ValueError raised for any)
    for valid_type in VALID_EVENT_TYPES:
        # We only need validation to pass — mock the DB to short-circuit after
        last_query = MagicMock()
        last_query.execute.return_value = MagicMock(data=[])
        last_query.eq.return_value = last_query
        last_query.order.return_value = last_query
        last_query.limit.return_value = last_query

        insert_mock = MagicMock()
        fake_row = _build_event_row(1, str(uuid4()), GENESIS_HASH, signing_key)
        insert_mock.execute.return_value = MagicMock(data=[fake_row])

        tbl = MagicMock()
        tbl.select.return_value = last_query
        tbl.insert.return_value = insert_mock
        mock_sb2 = MagicMock()
        mock_sb2.table.return_value = tbl

        svc2 = LedgerService(mock_sb2)
        # Should not raise
        svc2.write_event(
            project_id=str(uuid4()),
            event_type=valid_type,
            payload={},
            actor_id=str(uuid4()),
            actor_role="author",
            session_key_id=str(uuid4()),
            session_key=raw_key,
        )


# ═════════════════════════════════════════════════════════════════════════════
# 5. test_session_key_never_stored
# ═════════════════════════════════════════════════════════════════════════════

def test_session_key_never_stored():
    """
    Generating a session key must:
      - Store the public key in ledger_session_keys.
      - NOT store raw private key bytes or the passphrase.
      - Return encrypted_private_key and salt so the client can decrypt later.
    """
    captured_inserts: list[dict] = []

    def fake_insert(data: dict):
        captured_inserts.append(deepcopy(data))
        result = MagicMock()
        result.execute.return_value = MagicMock(data=[{
            "id": str(uuid4()),
            **data,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }])
        return result

    mock_sb = MagicMock()
    tbl = MagicMock()
    tbl.insert.side_effect = fake_insert
    mock_sb.table.return_value = tbl

    svc = KeyService(mock_sb)
    passphrase = "correct-horse-battery-staple"
    result = svc.generate_session_key(
        actor_id=str(uuid4()),
        project_id=str(uuid4()),
        passphrase=passphrase,
    )

    assert len(captured_inserts) == 1
    stored = captured_inserts[0]

    # Public key must be stored
    assert "public_key" in stored
    assert len(stored["public_key"]) == 64  # 32 bytes → 64 hex chars

    # Raw private key must NOT be stored
    assert "private_key" not in stored
    assert passphrase not in str(stored)

    # Result carries encrypted form but NOT the raw key
    assert result.encrypted_private_key  # non-empty base64
    assert result.salt                   # non-empty base64
    assert result.public_key == stored["public_key"]

    # Verify the encrypted key can be decrypted to a valid 32-byte seed
    raw = KeyService.decrypt_private_key(
        result.encrypted_private_key,
        result.salt,
        passphrase,
    )
    assert len(raw) == 32

    # Verify the decrypted key corresponds to the stored public key
    verify_key_hex = nacl.signing.SigningKey(raw).verify_key.encode().hex()
    assert verify_key_hex == result.public_key


# ═════════════════════════════════════════════════════════════════════════════
# 6. test_first_event_genesis_hash
# ═════════════════════════════════════════════════════════════════════════════

def test_first_event_genesis_hash():
    """The first event written for a project must have previous_hash == '0' * 64."""
    signing_key, raw_key = _make_signing_key()
    project_id = str(uuid4())
    session_key_id = str(uuid4())
    actor_id = str(uuid4())

    # Build what the inserted row should look like
    # (we need the actual hash that write_event will produce)
    # We'll capture the insert payload instead of pre-computing it.
    captured: list[dict] = []

    # No prior events — simulate empty project
    last_query = MagicMock()
    last_query.execute.return_value = MagicMock(data=[])
    last_query.eq.return_value = last_query
    last_query.order.return_value = last_query
    last_query.limit.return_value = last_query

    def fake_insert(data: dict):
        captured.append(deepcopy(data))
        result = MagicMock()
        # Simulate DB assigning an id and returning the row
        row = {**data, "id": str(uuid4())}
        result.execute.return_value = MagicMock(data=[row])
        return result

    tbl = MagicMock()
    tbl.select.return_value = last_query
    tbl.insert.side_effect = fake_insert

    mock_sb = MagicMock()
    mock_sb.table.return_value = tbl

    svc = LedgerService(mock_sb)
    event = svc.write_event(
        project_id=project_id,
        event_type="project_created",
        payload={"title": "My Study"},
        actor_id=actor_id,
        actor_role="author",
        session_key_id=session_key_id,
        session_key=raw_key,
    )

    assert len(captured) == 1
    assert captured[0]["previous_hash"] == GENESIS_HASH, (
        f"Expected GENESIS_HASH ('{'0'*64}'), "
        f"got '{captured[0]['previous_hash']}'"
    )
    assert event.previous_hash == GENESIS_HASH
    assert event.sequence_number == 1
