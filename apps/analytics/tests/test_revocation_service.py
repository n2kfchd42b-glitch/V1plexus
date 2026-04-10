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
