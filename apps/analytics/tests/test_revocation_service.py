"""
Tests for PLEXUS RevocationService and Revocation Registry API.

All tests mock the Supabase client — no live DB connection required.

Run from the project root:
    pytest apps/analytics/tests/test_revocation_service.py -v
"""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from unittest.mock import MagicMock, call, patch
from uuid import uuid4

import nacl.signing
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.analytics.models.revocation import (
    AttestationRevocationResult,
    BulkRevocationResult,
    KeyRevocationResult,
    PackageRetractionResult,
    RevocationStatusResult,
)
from apps.analytics.services.revocation_service import (
    RevocationError,
    RevocationService,
)
from apps.analytics.routers.revocation import router as revocation_router


# ═════════════════════════════════════════════════════════════════════════════
# Helpers
# ═════════════════════════════════════════════════════════════════════════════

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _signing_key() -> nacl.signing.SigningKey:
    return nacl.signing.SigningKey.generate()


def _make_mock(
    *,
    revoked_keys_rows: list[dict] | None = None,
    revoked_att_rows: list[dict] | None = None,
    retracted_pkg_rows: list[dict] | None = None,
    identity_key_rows: list[dict] | None = None,
    attestation_rows: list[dict] | None = None,
    institution_member_rows: list[dict] | None = None,
    pvp_packages_rows: list[dict] | None = None,
    insert_id: str | None = None,
) -> MagicMock:
    """
    Build a Supabase mock whose .table(name) routes to pre-canned data.
    Inserts return a row with a generated UUID as `id`.
    """
    _id = insert_id or str(uuid4())

    revoked_keys      = revoked_keys_rows or []
    revoked_atts      = revoked_att_rows or []
    retracted_pkgs    = retracted_pkg_rows or []
    id_key_rows       = identity_key_rows or []
    att_rows          = attestation_rows or []
    inst_mem_rows     = institution_member_rows or []
    pvp_rows          = pvp_packages_rows or []

    # Mutable stores so inserts can be tracked
    inserted: dict[str, list[dict]] = {
        "revoked_keys":        [],
        "revoked_attestations": [],
        "retracted_packages":  [],
        "revocation_audit_log": [],
    }

    mock = MagicMock()

    def table(name: str):
        tbl = MagicMock()

        # Data map for selects
        _data: dict[str, list[dict]] = {
            "revoked_keys":          revoked_keys,
            "revoked_attestations":  revoked_atts,
            "retracted_packages":    retracted_pkgs,
            "identity_key_registry": id_key_rows,
            "identity_attestations": att_rows,
            "institution_members":   inst_mem_rows,
            "pvp_packages":          pvp_rows,
        }

        def _select_chain(fields="*"):
            chain = MagicMock()
            rows = _data.get(name, [])

            def _eq(col, val):
                nonlocal rows
                rows = [r for r in rows if str(r.get(col)) == str(val)]
                return chain

            def _in_(col, vals):
                nonlocal rows
                rows = [r for r in rows if r.get(col) in vals]
                return chain

            def _limit(n):
                nonlocal rows
                rows = rows[:n]
                return chain

            def _execute():
                result = MagicMock()
                result.data = list(rows)
                return result

            def _single():
                # Return a chainable object so .single().execute() works
                inner = MagicMock()
                _row = rows[0] if rows else None
                inner.execute = lambda: MagicMock(data=_row)
                return inner

            chain.eq    = _eq
            chain.in_   = _in_
            chain.limit = _limit
            chain.execute = _execute
            chain.single  = _single
            return chain

        def _insert_chain(row_data):
            chain = MagicMock()
            row_with_id = dict(row_data)
            row_with_id.setdefault("id", _id)
            if name in inserted:
                inserted[name].append(row_with_id)

            def _execute():
                result = MagicMock()
                result.data = [row_with_id]
                return result

            chain.execute = _execute
            return chain

        def _update_chain(data):
            chain = MagicMock()
            chain.eq = lambda *a, **kw: chain
            chain.execute = lambda: MagicMock(data=[])
            return chain

        tbl.select = _select_chain
        tbl.insert = _insert_chain
        tbl.update = _update_chain
        return tbl

    mock.table = table
    mock._inserted = inserted
    return mock


def _make_app_with_mock(mock_sb) -> TestClient:
    """Create a TestClient for the revocation router with a mocked Supabase."""
    app = FastAPI()
    app.include_router(revocation_router)
    with patch("apps.analytics.routers.revocation._supabase", return_value=mock_sb):
        client = TestClient(app)
    return client, app, mock_sb


# ═════════════════════════════════════════════════════════════════════════════
# 1. test_revoke_key_success
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_key_success():
    """
    Revoking a key that exists, is not yet revoked, and is owned by the actor
    must return KeyRevocationResult with correct fields.
    """
    actor_id = str(uuid4())
    key_id   = str(uuid4())
    sk       = _signing_key()
    pub_hex  = sk.verify_key.encode().hex()

    mock_sb = _make_mock(
        revoked_keys_rows=[],
        identity_key_rows=[{"id": key_id, "actor_id": actor_id, "public_key": pub_hex, "key_purpose": "signing"}],
    )
    svc = RevocationService(mock_sb)
    result = svc.revoke_key(
        key_id=key_id,
        key_type="session",
        public_key=pub_hex,
        revoked_by=actor_id,
        reason="compromised",
        signing_private_key=bytes(sk),
    )

    assert isinstance(result, KeyRevocationResult)
    assert str(result.key_id) == key_id
    assert result.key_type == "session"
    assert result.reason == "compromised"
    assert result.revocation_signature  # non-empty hex

    # INSERT happened in revoked_keys
    assert len(mock_sb._inserted["revoked_keys"]) == 1
    inserted = mock_sb._inserted["revoked_keys"][0]
    assert inserted["key_id"] == key_id
    assert inserted["revocation_reason"] == "compromised"


# ═════════════════════════════════════════════════════════════════════════════
# 2. test_revoke_key_already_revoked
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_key_already_revoked():
    """Second revocation of the same key must raise RevocationError."""
    actor_id = str(uuid4())
    key_id   = str(uuid4())
    sk       = _signing_key()
    pub_hex  = sk.verify_key.encode().hex()

    # revoked_keys already contains this key
    mock_sb = _make_mock(
        revoked_keys_rows=[{"id": str(uuid4()), "key_id": key_id}],
        identity_key_rows=[{"id": key_id, "actor_id": actor_id, "public_key": pub_hex, "key_purpose": "signing"}],
    )
    svc = RevocationService(mock_sb)

    with pytest.raises(RevocationError, match="already revoked"):
        svc.revoke_key(
            key_id=key_id,
            key_type="session",
            public_key=pub_hex,
            revoked_by=actor_id,
            reason="compromised",
            signing_private_key=bytes(sk),
        )

    # Only the pre-existing record exists — no new insert
    assert len(mock_sb._inserted["revoked_keys"]) == 0


# ═════════════════════════════════════════════════════════════════════════════
# 3. test_revoke_key_unauthorised
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_key_unauthorised():
    """
    An actor who does not own the key and is not an institution admin
    must receive RevocationError("Not authorised…").
    """
    owner_id    = str(uuid4())
    other_actor = str(uuid4())
    key_id      = str(uuid4())
    sk          = _signing_key()
    pub_hex     = sk.verify_key.encode().hex()

    mock_sb = _make_mock(
        revoked_keys_rows=[],
        # Key belongs to owner_id, not other_actor
        identity_key_rows=[{"id": key_id, "actor_id": owner_id, "public_key": pub_hex, "key_purpose": "signing"}],
        institution_member_rows=[],   # other_actor is not an admin
    )
    svc = RevocationService(mock_sb)

    with pytest.raises(RevocationError, match="Not authorised"):
        svc.revoke_key(
            key_id=key_id,
            key_type="session",
            public_key=pub_hex,
            revoked_by=other_actor,
            reason="compromised",
            signing_private_key=bytes(sk),
        )


# ═════════════════════════════════════════════════════════════════════════════
# 4. test_revoke_attestation_cascades_keys
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_attestation_cascades_keys():
    """
    Revoking an attestation that has 2 linked non-revoked keys must cascade
    and set cascaded_key_revocations == 2.
    """
    actor_id       = str(uuid4())
    attestation_id = str(uuid4())
    key_id_1       = str(uuid4())
    key_id_2       = str(uuid4())
    sk             = _signing_key()
    pub1           = sk.verify_key.encode().hex()
    sk2            = _signing_key()
    pub2           = sk2.verify_key.encode().hex()

    mock_sb = _make_mock(
        revoked_keys_rows=[],
        revoked_att_rows=[],
        attestation_rows=[{"id": attestation_id, "actor_id": actor_id, "institution_id": None}],
        identity_key_rows=[
            {"id": key_id_1, "attestation_id": attestation_id, "actor_id": actor_id,
             "public_key": pub1, "key_purpose": "signing", "revoked": False},
            {"id": key_id_2, "attestation_id": attestation_id, "actor_id": actor_id,
             "public_key": pub2, "key_purpose": "identity", "revoked": False},
        ],
    )
    svc = RevocationService(mock_sb)
    result = svc.revoke_attestation(
        attestation_id=attestation_id,
        actor_id=actor_id,
        revoked_by=actor_id,
        reason="actor_request",
        signing_private_key=bytes(sk),
    )

    assert isinstance(result, AttestationRevocationResult)
    assert str(result.attestation_id) == attestation_id
    assert result.cascaded_key_revocations == 2
    # Both keys should have been inserted into revoked_keys
    assert len(mock_sb._inserted["revoked_keys"]) == 2


# ═════════════════════════════════════════════════════════════════════════════
# 5. test_revoke_attestation_already_revoked
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_attestation_already_revoked():
    """Second revocation of the same attestation must raise RevocationError."""
    actor_id       = str(uuid4())
    attestation_id = str(uuid4())
    sk             = _signing_key()

    mock_sb = _make_mock(
        revoked_att_rows=[{"id": str(uuid4()), "attestation_id": attestation_id}],
        attestation_rows=[{"id": attestation_id, "actor_id": actor_id, "institution_id": None}],
    )
    svc = RevocationService(mock_sb)

    with pytest.raises(RevocationError, match="already revoked"):
        svc.revoke_attestation(
            attestation_id=attestation_id,
            actor_id=actor_id,
            revoked_by=actor_id,
            reason="actor_request",
            signing_private_key=bytes(sk),
        )


# ═════════════════════════════════════════════════════════════════════════════
# 6. test_retract_package_success
# ═════════════════════════════════════════════════════════════════════════════

def test_retract_package_success():
    """
    A package not yet in retracted_packages must be retracted successfully
    when the actor is the system account.
    """
    root_hash  = "a" * 64
    project_id = str(uuid4())
    sk         = _signing_key()

    system_id = str(uuid4())
    mock_sb = _make_mock(retracted_pkg_rows=[])
    svc = RevocationService(mock_sb)

    with patch.dict(os.environ, {"PLEXUS_SYSTEM_ACCOUNT_ID": system_id}):
        result = svc.retract_package(
            pvp_root_hash=root_hash,
            project_id=project_id,
            retracted_by=system_id,
            reason="data_integrity_failure",
            note="Dataset contained fabricated observations.",
            signing_private_key=bytes(sk),
        )

    assert isinstance(result, PackageRetractionResult)
    assert result.pvp_root_hash == root_hash
    assert str(result.project_id) == project_id
    assert result.reason == "data_integrity_failure"
    assert result.retraction_signature

    assert len(mock_sb._inserted["retracted_packages"]) == 1
    row = mock_sb._inserted["retracted_packages"][0]
    assert row["pvp_root_hash"] == root_hash
    assert row["retraction_note"] == "Dataset contained fabricated observations."


# ═════════════════════════════════════════════════════════════════════════════
# 7. test_retract_package_already_retracted
# ═════════════════════════════════════════════════════════════════════════════

def test_retract_package_already_retracted():
    """Second retraction of the same package must raise RevocationError."""
    root_hash  = "b" * 64
    project_id = str(uuid4())
    sk         = _signing_key()
    system_id  = str(uuid4())

    mock_sb = _make_mock(
        retracted_pkg_rows=[{"id": str(uuid4()), "pvp_root_hash": root_hash}],
    )
    svc = RevocationService(mock_sb)

    with patch.dict(os.environ, {"PLEXUS_SYSTEM_ACCOUNT_ID": system_id}):
        with pytest.raises(RevocationError, match="already retracted"):
            svc.retract_package(
                pvp_root_hash=root_hash,
                project_id=project_id,
                retracted_by=system_id,
                reason="misconduct",
                note=None,
                signing_private_key=bytes(sk),
            )


# ═════════════════════════════════════════════════════════════════════════════
# 8. test_check_key_not_revoked
# ═════════════════════════════════════════════════════════════════════════════

def test_check_key_not_revoked():
    """check_key on an active key must return revoked=False."""
    key_id  = str(uuid4())
    mock_sb = _make_mock(revoked_keys_rows=[])
    svc     = RevocationService(mock_sb)

    result = svc.check_key(key_id)

    assert isinstance(result, RevocationStatusResult)
    assert result.revoked is False
    assert result.reason is None


# ═════════════════════════════════════════════════════════════════════════════
# 9. test_check_key_revoked
# ═════════════════════════════════════════════════════════════════════════════

def test_check_key_revoked():
    """check_key after revocation must return revoked=True with matching reason."""
    key_id = str(uuid4())
    mock_sb = _make_mock(
        revoked_keys_rows=[{
            "key_id":               key_id,
            "revocation_reason":    "compromised",
            "revoked_at":           _now_iso(),
            "revocation_signature": "aa" * 32,
        }],
    )
    svc = RevocationService(mock_sb)

    result = svc.check_key(key_id)

    assert result.revoked is True
    assert result.revocation_type == "key"
    assert result.reason == "compromised"
    assert result.revocation_signature == "aa" * 32


# ═════════════════════════════════════════════════════════════════════════════
# 10. test_check_package_retracted
# ═════════════════════════════════════════════════════════════════════════════

def test_check_package_retracted():
    """check_package after retraction must return revoked=True."""
    root_hash = "c" * 64
    mock_sb = _make_mock(
        retracted_pkg_rows=[{
            "pvp_root_hash":       root_hash,
            "retraction_reason":   "misconduct",
            "retracted_at":        _now_iso(),
            "retraction_signature": "bb" * 32,
        }],
    )
    svc = RevocationService(mock_sb)

    result = svc.check_package(root_hash)

    assert result.revoked is True
    assert result.revocation_type == "package"
    assert result.reason == "misconduct"


# ═════════════════════════════════════════════════════════════════════════════
# 11. test_bulk_check_all_clean
# ═════════════════════════════════════════════════════════════════════════════

def test_bulk_check_all_clean():
    """
    check_all with active key_ids + attestation_ids + root_hash must return
    any_revoked=False and all individual statuses revoked=False.
    """
    key_id   = str(uuid4())
    att_id   = str(uuid4())
    root_hash = "d" * 64

    mock_sb = _make_mock(
        revoked_keys_rows=[],
        revoked_att_rows=[],
        retracted_pkg_rows=[],
    )
    svc = RevocationService(mock_sb)

    result = svc.check_all(
        key_ids=[key_id],
        attestation_ids=[att_id],
        pvp_root_hash=root_hash,
    )

    assert isinstance(result, BulkRevocationResult)
    assert result.any_revoked is False
    assert result.keys[key_id].revoked is False
    assert result.attestations[att_id].revoked is False
    assert result.package is not None
    assert result.package.revoked is False


# ═════════════════════════════════════════════════════════════════════════════
# 12. test_bulk_check_with_revoked_key
# ═════════════════════════════════════════════════════════════════════════════

def test_bulk_check_with_revoked_key():
    """
    check_all when one key in the set is revoked must return any_revoked=True
    and flag only that key.
    """
    revoked_key_id = str(uuid4())
    clean_key_id   = str(uuid4())

    mock_sb = _make_mock(
        revoked_keys_rows=[{
            "key_id":               revoked_key_id,
            "revocation_reason":    "compromised",
            "revoked_at":           _now_iso(),
            "revocation_signature": "cc" * 32,
        }],
        revoked_att_rows=[],
        retracted_pkg_rows=[],
    )
    svc = RevocationService(mock_sb)

    result = svc.check_all(
        key_ids=[revoked_key_id, clean_key_id],
        attestation_ids=[],
        pvp_root_hash=None,
    )

    assert result.any_revoked is True
    assert result.keys[revoked_key_id].revoked is True
    assert result.keys[clean_key_id].revoked is False


# ═════════════════════════════════════════════════════════════════════════════
# 13. test_public_read_no_auth_required
# ═════════════════════════════════════════════════════════════════════════════

def test_public_read_no_auth_required():
    """
    GET /api/revocation/key/{key_id} must return 200 without an auth header.
    """
    key_id  = str(uuid4())
    mock_sb = _make_mock(revoked_keys_rows=[])

    app = FastAPI()
    app.include_router(revocation_router)

    with patch("apps.analytics.routers.revocation._supabase", return_value=mock_sb):
        client = TestClient(app)
        response = client.get(f"/api/revocation/key/{key_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["revoked"] is False


# ═════════════════════════════════════════════════════════════════════════════
# 14. test_write_requires_auth
# ═════════════════════════════════════════════════════════════════════════════

def test_write_requires_auth():
    """
    POST /api/revocation/key/revoke without an Authorization header must
    return 401 (auth middleware rejects the request before the service runs).
    """
    mock_sb = _make_mock()

    app = FastAPI()
    app.include_router(revocation_router)

    with patch("apps.analytics.routers.revocation._supabase", return_value=mock_sb):
        client = TestClient(app, raise_server_exceptions=False)
        response = client.post(
            "/api/revocation/key/revoke",
            json={
                "key_id":             str(uuid4()),
                "key_type":           "session",
                "public_key":         "aa" * 32,
                "reason":             "compromised",
                "signing_private_key": base64.b64encode(os.urandom(32)).decode(),
            },
        )

    assert response.status_code == 401


# ═════════════════════════════════════════════════════════════════════════════
# 15. test_revocation_signature_valid
# ═════════════════════════════════════════════════════════════════════════════

def test_revocation_signature_valid():
    """
    The revocation_signature in KeyRevocationResult must be cryptographically
    verifiable against the signing key used for the revocation.
    """
    actor_id = str(uuid4())
    key_id   = str(uuid4())
    sk       = _signing_key()
    pub_hex  = sk.verify_key.encode().hex()

    mock_sb = _make_mock(
        revoked_keys_rows=[],
        identity_key_rows=[{"id": key_id, "actor_id": actor_id, "public_key": pub_hex, "key_purpose": "session"}],
    )
    svc = RevocationService(mock_sb)
    result = svc.revoke_key(
        key_id=key_id,
        key_type="session",
        public_key=pub_hex,
        revoked_by=actor_id,
        reason="routine_rotation",
        signing_private_key=bytes(sk),
    )

    # Reconstruct the signed payload and verify signature
    import nacl.signing as _nacl_signing
    expected_payload = {
        "key_id":     key_id,
        "key_type":   "session",
        "public_key": pub_hex,
        "revoked_by": actor_id,
        "reason":     "routine_rotation",
        "revoked_at": mock_sb._inserted["revoked_keys"][0]["revoked_at"],
    }
    msg = json.dumps(expected_payload, sort_keys=True).encode()
    sig = bytes.fromhex(result.revocation_signature)

    verify_key = sk.verify_key
    # If this raises, the signature is invalid — the test will fail
    verify_key.verify(msg, sig)


# ═════════════════════════════════════════════════════════════════════════════
# 16. test_chain_verifier_flags_revoked_key
# ═════════════════════════════════════════════════════════════════════════════

def test_chain_verifier_flags_revoked_key():
    """
    ChainVerifier with an injected RevocationService that reports any_revoked=True
    must set revocation_status == 'flagged' and populate revoked_keys.
    """
    from apps.analytics.tests.test_verification_engine import (
        build_test_pvp,
        _level1_events,
    )

    pvp_bytes, _, session_key_id, *_ = build_test_pvp(_level1_events())

    # Mock RevocationService.check_all to report the key as revoked
    mock_svc = MagicMock()
    mock_svc.check_all.return_value = BulkRevocationResult(
        any_revoked=True,
        keys={
            session_key_id: RevocationStatusResult(
                revoked=True,
                revocation_type="key",
                reason="compromised",
                revoked_at=datetime.now(timezone.utc),
            )
        },
        attestations={},
        package=None,
        checked_at=datetime.now(timezone.utc),
    )

    from apps.analytics.services.verification_engine import VerificationEngine
    report = VerificationEngine().verify(pvp_bytes, online=True, revocation_service=mock_svc)

    assert report.chain.revocation_status == "flagged"
    assert session_key_id in report.chain.revoked_keys


# ═════════════════════════════════════════════════════════════════════════════
# 17. test_chain_verifier_without_revocation_service
# ═════════════════════════════════════════════════════════════════════════════

def test_chain_verifier_without_revocation_service():
    """
    ChainVerifier without a revocation_service injected and online=False must
    return revocation_status == 'unchecked' (existing behaviour unchanged).
    """
    from apps.analytics.tests.test_verification_engine import (
        build_test_pvp,
        _level1_events,
    )

    pvp_bytes, *_ = build_test_pvp(_level1_events())

    from apps.analytics.services.verification_engine import VerificationEngine
    report = VerificationEngine().verify(pvp_bytes, online=False)

    assert report.chain.revocation_status == "unchecked"
    assert report.integrity.passed is True


# ═════════════════════════════════════════════════════════════════════════════
# 18. test_append_only_enforced
# ═════════════════════════════════════════════════════════════════════════════

def test_append_only_enforced():
    """
    RevocationService must never call .update() or .delete() on the four
    revocation tables (revoked_keys, revoked_attestations, retracted_packages,
    revocation_audit_log).  Updates to identity tables are fine.

    This verifies the application-layer append-only contract.  The DB-level
    enforcement is in the migration (no UPDATE/DELETE RLS policies).
    """
    actor_id = str(uuid4())
    key_id   = str(uuid4())
    sk       = _signing_key()
    pub_hex  = sk.verify_key.encode().hex()

    # Track every .update() call per table name
    update_calls: dict[str, list] = {}

    mock_sb = MagicMock()

    def table(name: str):
        tbl = MagicMock()

        def _select_chain(*a, **kw):
            chain = MagicMock()
            _single_row = {"actor_id": actor_id, "public_key": pub_hex} if name == "identity_key_registry" else None
            _list_data  = [{"actor_id": actor_id}] if name == "identity_key_registry" else []

            def _single_chainable():
                inner = MagicMock()
                inner.execute = lambda: MagicMock(data=_single_row)
                return inner

            chain.eq     = lambda *a, **kw: chain
            chain.in_    = lambda *a, **kw: chain
            chain.limit  = lambda *a, **kw: chain
            chain.execute = lambda: MagicMock(data=_list_data)
            chain.single  = _single_chainable
            return chain

        def _insert_chain(row_data):
            chain = MagicMock()
            chain.execute = lambda: MagicMock(data=[{**row_data, "id": str(uuid4())}])
            return chain

        def _update_chain(data):
            update_calls.setdefault(name, []).append(data)
            chain = MagicMock()
            chain.eq = lambda *a, **kw: chain
            chain.execute = lambda: MagicMock(data=[])
            return chain

        tbl.select = _select_chain
        tbl.insert = _insert_chain
        tbl.update = _update_chain
        return tbl

    mock_sb.table = table

    svc = RevocationService(mock_sb)
    svc.revoke_key(
        key_id=key_id,
        key_type="session",
        public_key=pub_hex,
        revoked_by=actor_id,
        reason="compromised",
        signing_private_key=bytes(sk),
    )

    _revocation_tables = {
        "revoked_keys",
        "revoked_attestations",
        "retracted_packages",
        "revocation_audit_log",
    }
    for tbl_name in _revocation_tables:
        assert tbl_name not in update_calls, (
            f"RevocationService called .update() on append-only table '{tbl_name}'"
        )

    # identity_key_registry update IS expected (marking key revoked)
    assert "identity_key_registry" in update_calls


# ═════════════════════════════════════════════════════════════════════════════
# Additional exception-path coverage
# ═════════════════════════════════════════════════════════════════════════════

def test_retract_package_pvp_packages_update_exception_is_non_fatal():
    """
    If pvp_packages.update() raises (e.g. table doesn't exist yet),
    retract_package must still return PackageRetractionResult — the update
    is best-effort (lines 376-377).
    """
    root_hash  = "g" * 64
    project_id = str(uuid4())
    sk         = _signing_key()
    system_id  = str(uuid4())

    # Standard mock but override pvp_packages.update() to raise
    mock_sb = _make_mock(retracted_pkg_rows=[])

    original_table = mock_sb.table

    def table_with_raising_pvp_update(name: str):
        tbl = original_table(name)
        if name == "pvp_packages":
            def _raise_update(data):
                raise RuntimeError("relation pvp_packages does not exist")
            tbl.update = _raise_update
        return tbl

    mock_sb.table = table_with_raising_pvp_update

    svc = RevocationService(mock_sb)
    with patch.dict(os.environ, {"PLEXUS_SYSTEM_ACCOUNT_ID": system_id}):
        result = svc.retract_package(
            pvp_root_hash=root_hash,
            project_id=project_id,
            retracted_by=system_id,
            reason="misconduct",
            note=None,
            signing_private_key=bytes(sk),
        )

    assert isinstance(result, PackageRetractionResult)


def test_revoke_attestation_system_account_authorized():
    """
    The PLEXUS system account must be able to revoke any attestation,
    even when revoked_by != actor_id (line 540).
    """
    actor_id       = str(uuid4())
    system_id      = str(uuid4())
    attestation_id = str(uuid4())
    sk             = _signing_key()

    mock_sb = _make_mock(
        revoked_att_rows=[],
        attestation_rows=[{"id": attestation_id, "actor_id": actor_id, "institution_id": None}],
        identity_key_rows=[],
    )
    svc = RevocationService(mock_sb)

    with patch.dict(os.environ, {"PLEXUS_SYSTEM_ACCOUNT_ID": system_id}):
        result = svc.revoke_attestation(
            attestation_id=attestation_id,
            actor_id=actor_id,
            revoked_by=system_id,          # system account, not the subject
            reason="policy_violation",
            signing_private_key=bytes(sk),
        )

    assert isinstance(result, AttestationRevocationResult)
    assert result.reason == "policy_violation"


def test_retract_package_pvp_lookup_exception_falls_to_admin():
    """
    When pvp_packages.select() raises, _is_authorized_for_package must catch
    the exception (lines 563-564) and fall through to _is_institution_admin,
    which can still authorise an admin actor.
    """
    root_hash  = "h" * 64
    project_id = str(uuid4())
    admin_id   = str(uuid4())
    sk         = _signing_key()

    # pvp_packages raises on select; institution_members confirms admin
    mock_sb = _make_mock(
        retracted_pkg_rows=[],
        institution_member_rows=[{"id": str(uuid4()), "user_id": admin_id, "role": "admin"}],
    )

    original_table = mock_sb.table

    def table_with_raising_pvp_select(name: str):
        tbl = original_table(name)
        if name == "pvp_packages":
            def _raise_select(*a, **kw):
                raise RuntimeError("permission denied for table pvp_packages")
            tbl.select = _raise_select
        return tbl

    mock_sb.table = table_with_raising_pvp_select

    svc = RevocationService(mock_sb)
    result = svc.retract_package(
        pvp_root_hash=root_hash,
        project_id=project_id,
        retracted_by=admin_id,
        reason="journal_request",
        note=None,
        signing_private_key=bytes(sk),
    )

    assert isinstance(result, PackageRetractionResult)


# ═════════════════════════════════════════════════════════════════════════════
# 19. test_revoke_key_invalid_key_type
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_key_invalid_key_type():
    """Passing an unrecognised key_type must raise RevocationError immediately."""
    sk = _signing_key()
    svc = RevocationService(_make_mock())

    with pytest.raises(RevocationError, match="Invalid key_type"):
        svc.revoke_key(
            key_id=str(uuid4()),
            key_type="magic_key",          # not in valid set
            public_key=sk.verify_key.encode().hex(),
            revoked_by=str(uuid4()),
            reason="compromised",
            signing_private_key=bytes(sk),
        )


# ═════════════════════════════════════════════════════════════════════════════
# 20. test_revoke_key_invalid_reason
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_key_invalid_reason():
    """Passing an unrecognised reason must raise RevocationError immediately."""
    sk = _signing_key()
    svc = RevocationService(_make_mock())

    with pytest.raises(RevocationError, match="Invalid revocation_reason"):
        svc.revoke_key(
            key_id=str(uuid4()),
            key_type="session",
            public_key=sk.verify_key.encode().hex(),
            revoked_by=str(uuid4()),
            reason="i_felt_like_it",       # not in valid set
            signing_private_key=bytes(sk),
        )


# ═════════════════════════════════════════════════════════════════════════════
# 21. test_revoke_attestation_invalid_reason
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_attestation_invalid_reason():
    """Invalid reason in revoke_attestation must raise RevocationError."""
    sk = _signing_key()
    svc = RevocationService(_make_mock())

    with pytest.raises(RevocationError, match="Invalid revocation_reason"):
        svc.revoke_attestation(
            attestation_id=str(uuid4()),
            actor_id=str(uuid4()),
            revoked_by=str(uuid4()),
            reason="just_because",         # not in valid set
            signing_private_key=bytes(sk),
        )


# ═════════════════════════════════════════════════════════════════════════════
# 22. test_revoke_attestation_not_found
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_attestation_not_found():
    """Revoking a non-existent attestation must raise RevocationError."""
    sk  = _signing_key()
    att_id = str(uuid4())

    # identity_attestations returns nothing
    mock_sb = _make_mock(attestation_rows=[])
    svc = RevocationService(mock_sb)

    with pytest.raises(RevocationError, match="not found"):
        svc.revoke_attestation(
            attestation_id=att_id,
            actor_id=str(uuid4()),
            revoked_by=str(uuid4()),
            reason="actor_request",
            signing_private_key=bytes(sk),
        )


# ═════════════════════════════════════════════════════════════════════════════
# 23. test_revoke_attestation_unauthorised
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_attestation_unauthorised():
    """
    An actor who is not the attestation subject, not an institution admin,
    and not the system account must receive RevocationError("Not authorised…").
    """
    actor_id       = str(uuid4())
    other_actor    = str(uuid4())
    attestation_id = str(uuid4())
    sk             = _signing_key()

    mock_sb = _make_mock(
        revoked_att_rows=[],
        attestation_rows=[{"id": attestation_id, "actor_id": actor_id, "institution_id": None}],
        institution_member_rows=[],  # other_actor is not an admin
    )
    svc = RevocationService(mock_sb)

    with pytest.raises(RevocationError, match="Not authorised"):
        svc.revoke_attestation(
            attestation_id=attestation_id,
            actor_id=actor_id,
            revoked_by=other_actor,        # different actor, no admin role
            reason="affiliation_ended",
            signing_private_key=bytes(sk),
        )


# ═════════════════════════════════════════════════════════════════════════════
# 24. test_revoke_attestation_with_institution_id_and_cascade_skip
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_attestation_with_institution_id_and_cascade_skip():
    """
    When an attestation has an institution_id, it must be included in the
    revoked_attestations row.  If one linked key is already revoked, the
    cascade skips it (no RevocationError propagated) and counts only the
    newly revoked keys.
    """
    actor_id       = str(uuid4())
    institution_id = str(uuid4())
    attestation_id = str(uuid4())
    key_id_fresh   = str(uuid4())
    key_id_stale   = str(uuid4())    # already revoked
    sk             = _signing_key()
    pub_fresh      = sk.verify_key.encode().hex()
    pub_stale      = _signing_key().verify_key.encode().hex()

    mock_sb = _make_mock(
        revoked_att_rows=[],
        # key_id_stale is already in revoked_keys — cascade should skip it
        revoked_keys_rows=[{"id": str(uuid4()), "key_id": key_id_stale}],
        attestation_rows=[{
            "id":             attestation_id,
            "actor_id":       actor_id,
            "institution_id": institution_id,
        }],
        identity_key_rows=[
            {"id": key_id_fresh, "attestation_id": attestation_id,
             "actor_id": actor_id, "public_key": pub_fresh,
             "key_purpose": "signing", "revoked": False},
            {"id": key_id_stale, "attestation_id": attestation_id,
             "actor_id": actor_id, "public_key": pub_stale,
             "key_purpose": "signing", "revoked": False},
        ],
    )
    svc = RevocationService(mock_sb)
    result = svc.revoke_attestation(
        attestation_id=attestation_id,
        actor_id=actor_id,
        revoked_by=actor_id,
        reason="affiliation_ended",
        signing_private_key=bytes(sk),
    )

    assert isinstance(result, AttestationRevocationResult)
    # institution_id must appear in the inserted row
    inserted_att = mock_sb._inserted["revoked_attestations"][0]
    assert inserted_att.get("institution_id") == institution_id
    # Only the fresh key was actually revoked; stale was skipped
    assert result.cascaded_key_revocations == 1


# ═════════════════════════════════════════════════════════════════════════════
# 25. test_retract_package_invalid_reason
# ═════════════════════════════════════════════════════════════════════════════

def test_retract_package_invalid_reason():
    """Invalid retraction_reason must raise RevocationError immediately."""
    sk = _signing_key()
    svc = RevocationService(_make_mock())

    with pytest.raises(RevocationError, match="Invalid retraction_reason"):
        svc.retract_package(
            pvp_root_hash="a" * 64,
            project_id=str(uuid4()),
            retracted_by=str(uuid4()),
            reason="oops",                  # not in valid set
            note=None,
            signing_private_key=bytes(sk),
        )


# ═════════════════════════════════════════════════════════════════════════════
# 26. test_retract_package_unauthorised
# ═════════════════════════════════════════════════════════════════════════════

def test_retract_package_unauthorised():
    """
    An actor who is not the project author and not an institution admin
    must receive RevocationError("Not authorised…").
    """
    root_hash      = "e" * 64
    project_id     = str(uuid4())
    other_actor    = str(uuid4())
    sk             = _signing_key()

    mock_sb = _make_mock(
        retracted_pkg_rows=[],
        pvp_packages_rows=[{"created_by": str(uuid4())}],  # different owner
        institution_member_rows=[],
    )
    svc = RevocationService(mock_sb)

    with pytest.raises(RevocationError, match="Not authorised"):
        svc.retract_package(
            pvp_root_hash=root_hash,
            project_id=project_id,
            retracted_by=other_actor,
            reason="author_request",
            note=None,
            signing_private_key=bytes(sk),
        )


# ═════════════════════════════════════════════════════════════════════════════
# 27. test_check_attestation_revoked
# ═════════════════════════════════════════════════════════════════════════════

def test_check_attestation_revoked():
    """check_attestation on a revoked attestation must return revoked=True."""
    att_id = str(uuid4())
    # Include attestation_id in the row so the eq() filter keeps it
    mock_sb = _make_mock(
        revoked_att_rows=[{
            "attestation_id":      att_id,
            "revocation_reason":   "identity_fraud",
            "revoked_at":          _now_iso(),
            "revocation_signature": "dd" * 32,
        }],
    )
    svc = RevocationService(mock_sb)

    result = svc.check_attestation(att_id)

    assert result.revoked is True
    assert result.revocation_type == "attestation"
    assert result.reason == "identity_fraud"
    assert result.revocation_signature == "dd" * 32


# ═════════════════════════════════════════════════════════════════════════════
# 28. test_revoke_key_system_account_authorized
# ═════════════════════════════════════════════════════════════════════════════

def test_revoke_key_system_account_authorized():
    """The PLEXUS system account must be able to revoke any key."""
    system_id = str(uuid4())
    key_id    = str(uuid4())
    sk        = _signing_key()
    pub_hex   = sk.verify_key.encode().hex()

    # identity_key_registry returns a row owned by a DIFFERENT actor —
    # but system account should still be authorized
    mock_sb = _make_mock(
        revoked_keys_rows=[],
        identity_key_rows=[{"id": key_id, "actor_id": str(uuid4()), "public_key": pub_hex, "key_purpose": "session"}],
    )
    svc = RevocationService(mock_sb)

    with patch.dict(os.environ, {"PLEXUS_SYSTEM_ACCOUNT_ID": system_id}):
        result = svc.revoke_key(
            key_id=key_id,
            key_type="session",
            public_key=pub_hex,
            revoked_by=system_id,
            reason="policy_violation",
            signing_private_key=bytes(sk),
        )

    assert isinstance(result, KeyRevocationResult)
    assert result.reason == "policy_violation"


# ═════════════════════════════════════════════════════════════════════════════
# 29. test_retract_package_project_author_authorized
# ═════════════════════════════════════════════════════════════════════════════

def test_retract_package_project_author_authorized():
    """
    The project author (created_by match in pvp_packages) must be able to
    retract their own package without being an institution admin.
    """
    author_id  = str(uuid4())
    root_hash  = "f" * 64
    project_id = str(uuid4())
    sk         = _signing_key()

    mock_sb = _make_mock(
        retracted_pkg_rows=[],
        pvp_packages_rows=[{"project_id": project_id, "created_by": author_id}],
        institution_member_rows=[],   # not an admin — auth via project ownership
    )
    svc = RevocationService(mock_sb)

    result = svc.retract_package(
        pvp_root_hash=root_hash,
        project_id=project_id,
        retracted_by=author_id,
        reason="author_request",
        note=None,
        signing_private_key=bytes(sk),
    )

    assert isinstance(result, PackageRetractionResult)
    assert result.pvp_root_hash == root_hash


# ═════════════════════════════════════════════════════════════════════════════
# 30. test_auth_exception_falls_back_gracefully
# ═════════════════════════════════════════════════════════════════════════════

def test_auth_exception_falls_back_gracefully():
    """
    When both the identity_key_registry lookup AND the institution_members
    query raise exceptions, _is_authorized_for_key must return False (not crash).
    The subsequent revoke_key call must raise RevocationError("Not authorised").
    """
    actor_id  = str(uuid4())
    key_id    = str(uuid4())
    sk        = _signing_key()
    pub_hex   = sk.verify_key.encode().hex()

    # Build a mock where every .single().execute() and .execute() raises
    raising_mock = MagicMock()

    def table(name: str):
        tbl = MagicMock()

        def _select(*a, **kw):
            chain = MagicMock()
            chain.eq     = lambda *a, **kw: chain
            chain.in_    = lambda *a, **kw: chain
            chain.limit  = lambda *a, **kw: chain

            if name == "revoked_keys":
                # Must return empty so the "already revoked" check passes
                chain.execute = lambda: MagicMock(data=[])
            else:
                # All other queries blow up
                def _raise():
                    raise RuntimeError("DB unavailable")
                chain.execute = _raise

                inner = MagicMock()
                inner.execute = _raise
                chain.single  = lambda: inner

            return chain

        tbl.select = _select
        return tbl

    raising_mock.table = table

    svc = RevocationService(raising_mock)

    with pytest.raises(RevocationError, match="Not authorised"):
        svc.revoke_key(
            key_id=key_id,
            key_type="identity",
            public_key=pub_hex,
            revoked_by=actor_id,
            reason="compromised",
            signing_private_key=bytes(sk),
        )
