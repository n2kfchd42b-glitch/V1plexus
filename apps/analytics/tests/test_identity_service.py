"""
Tests for PLEXUS IdentityService, Managed CA, and Trust Engine integration.

All tests mock the Supabase client — no live DB connection required.
PLEXUS_CA_MASTER_KEY is patched per-test via os.environ.

Run from the project root:
    pytest apps/analytics/tests/test_identity_service.py -v
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import nacl.signing
import nacl.secret
import pytest
from fastapi.testclient import TestClient

from apps.analytics.models.identity import (
    AttestationResult,
    IdentityVerificationResult,
    InstitutionResult,
    KeyLinkResult,
)
from apps.analytics.models.verification import ChainResult, IntegrityResult
from apps.analytics.services.identity_service import IdentityError, IdentityService
from apps.analytics.services.verification_engine import TrustEngine


# ── Shared test master key ─────────────────────────────────────────────────────

_TEST_MASTER_KEY = os.urandom(32).hex()

# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _institution_row(
    institution_id: str,
    email_domain: str = "university.edu",
    tier: str = "DOMAIN_VERIFIED",
    root_public_key: str | None = None,
    active: bool = True,
    verified_at: str | None = None,
) -> dict:
    return {
        "id":                institution_id,
        "name":              "Test University",
        "short_name":        "TU",
        "country":           "US",
        "email_domain":      email_domain,
        "verification_tier": tier,
        "root_public_key":   root_public_key or "a" * 64,
        "plexus_managed_ca": True,
        "active":            active,
        "verified_at":       verified_at,
        "created_at":        _now().isoformat(),
    }


def _attestation_row(
    attestation_id: str,
    actor_id: str,
    institution_id: str | None,
    identity_key: str,
    tier: str,
    attested_by: str,
    claim: dict,
    signature: str,
    valid_to: datetime | None = None,
    revoked: bool = False,
) -> dict:
    valid_to = valid_to or (_now() + timedelta(days=365))
    return {
        "id":                  attestation_id,
        "actor_id":            actor_id,
        "institution_id":      institution_id,
        "identity_key":        identity_key,
        "verification_tier":   tier,
        "attested_by":         attested_by,
        "affiliation_claim":   claim,
        "attestation_signature": signature,
        "valid_from":          _now().isoformat(),
        "valid_to":            valid_to.isoformat(),
        "revoked":             revoked,
        "created_at":          _now().isoformat(),
    }


def _make_stateful_mock(
    master_key_hex: str,
) -> tuple[MagicMock, dict, dict, list]:
    """
    Build a stateful Supabase mock that:
      - institutions    → insert captures rows; select returns them
      - ca_private_keys → insert captures vault rows; select returns them
      - identity_attestations → insert captures; select returns most recent
      - identity_key_registry → insert captures; no select needed

    Returns (mock, institutions_store, ca_vault_store, attestations_store).
    """
    institutions: dict[str, dict] = {}   # email_domain → row
    ca_vault:     dict[str, dict] = {}   # institution_id → vault row
    attestations: list[dict]      = []
    key_registry: list[dict]      = []

    mock = MagicMock()

    def table(name: str):
        tbl = MagicMock()

        # ── institutions ──────────────────────────────────────────────────
        if name == "institutions":
            def _inst_select(cols):
                q = MagicMock()

                # _check duplicate domain: select("id").eq("email_domain", d)
                # _load institution: select("*").eq("id", id).single()
                # _verify: select("root_public_key, active, name").eq("id", id).single()
                domain_filter:  list[str] = []
                id_filter:      list[str] = []
                cols_requested = cols

                def eq(field, val):
                    if field == "email_domain":
                        domain_filter.append(val.lower())
                    elif field == "id":
                        id_filter.append(str(val))
                    return q

                def single():
                    return q

                def execute():
                    if domain_filter:
                        matched = [
                            r for r in institutions.values()
                            if r["email_domain"] == domain_filter[0]
                        ]
                        return MagicMock(data=matched[0] if matched else None)
                    if id_filter:
                        row = next(
                            (r for r in institutions.values()
                             if r["id"] == id_filter[0]), None
                        )
                        return MagicMock(data=row)
                    return MagicMock(data=list(institutions.values()))

                q.eq = eq
                q.single.return_value = q
                q.execute = execute
                return q

            tbl.select.side_effect = _inst_select

            def _inst_insert(row):
                new_id   = str(uuid4())
                full_row = {"id": new_id, **row, "created_at": _now().isoformat()}
                institutions[row["email_domain"]] = full_row
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[full_row])
                return m

            tbl.insert.side_effect = _inst_insert

        # ── ca_private_keys ───────────────────────────────────────────────
        elif name == "ca_private_keys":
            def _ca_insert(row):
                ca_vault[row["institution_id"]] = deepcopy(row)
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[row])
                return m

            tbl.insert.side_effect = _ca_insert

            def _ca_select(cols):
                q = MagicMock()
                inst_filter: list[str] = []

                def eq(field, val):
                    if field == "institution_id":
                        inst_filter.append(str(val))
                    return q

                def execute():
                    if inst_filter:
                        row = ca_vault.get(inst_filter[0])
                        return MagicMock(data=[row] if row else [])
                    return MagicMock(data=list(ca_vault.values()))

                q.eq     = eq
                q.order  = lambda *a, **kw: q
                q.limit  = lambda *a, **kw: q
                q.execute = execute
                return q

            tbl.select.side_effect = _ca_select

        # ── identity_attestations ─────────────────────────────────────────
        elif name == "identity_attestations":
            def _att_insert(row):
                new_id   = str(uuid4())
                full_row = {
                    "id": new_id, **row,
                    "revoked": row.get("revoked", False),   # ensure key present
                    "created_at": _now().isoformat(),
                }
                attestations.append(full_row)
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[full_row])
                return m

            tbl.insert.side_effect = _att_insert

            def _att_select(cols):
                q = MagicMock()
                actor_filter:   list[str] = []
                revoked_filter: list      = []

                def eq(field, val):
                    if field == "actor_id":
                        actor_filter.append(str(val))
                    elif field == "revoked":
                        revoked_filter.append(val)
                    return q

                def execute():
                    rows = list(attestations)
                    if actor_filter:
                        rows = [r for r in rows if r["actor_id"] == actor_filter[0]]
                    if revoked_filter:
                        rows = [r for r in rows if r["revoked"] == revoked_filter[0]]
                    # Most recent first
                    rows = sorted(rows, key=lambda r: r["created_at"], reverse=True)
                    return MagicMock(data=rows[:1])   # limit(1)

                q.eq     = eq
                q.order  = lambda *a, **kw: q
                q.limit  = lambda *a, **kw: q
                q.execute = execute
                return q

            tbl.select.side_effect = _att_select

        # ── identity_key_registry ─────────────────────────────────────────
        elif name == "identity_key_registry":
            def _reg_insert(row):
                key_registry.append(deepcopy(row))
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[row])
                return m

            tbl.insert.side_effect = _reg_insert

        # ── ledger_session_keys ───────────────────────────────────────────
        elif name == "ledger_session_keys":
            q = MagicMock()
            q.execute.return_value = MagicMock(data=None)
            q.eq.return_value = q
            q.single.return_value = q
            tbl.select.return_value = q

        return tbl

    mock.table.side_effect = table
    return mock, institutions, ca_vault, attestations


# ═════════════════════════════════════════════════════════════════════════════
# 1. test_institution_domain_verified_tier
# ═════════════════════════════════════════════════════════════════════════════

def test_institution_domain_verified_tier():
    """Register institution with valid email domain → DOMAIN_VERIFIED, active."""
    mock, *_ = _make_stateful_mock(_TEST_MASTER_KEY)

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc    = IdentityService(mock)
        result = svc.register_institution(
            name="Test University",
            short_name="TU",
            country="US",
            email_domain="university.edu",
            registration_document=None,
        )

    assert result.verification_tier == "DOMAIN_VERIFIED"
    assert result.status == "active"
    assert result.plexus_managed_ca is True
    assert isinstance(result.institution_id, type(result.institution_id))


# ═════════════════════════════════════════════════════════════════════════════
# 2. test_institution_officially_registered_tier
# ═════════════════════════════════════════════════════════════════════════════

def test_institution_officially_registered_tier():
    """Register institution with registration_document → OFFICIALLY_REGISTERED, pending."""
    mock, *_ = _make_stateful_mock(_TEST_MASTER_KEY)

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc    = IdentityService(mock)
        result = svc.register_institution(
            name="Oxford University",
            short_name="Oxford",
            country="UK",
            email_domain="ox.ac.uk",
            registration_document="base64_encoded_doc_here",
        )

    assert result.verification_tier == "OFFICIALLY_REGISTERED"
    assert result.status == "pending_admin_review"


# ═════════════════════════════════════════════════════════════════════════════
# 3. test_duplicate_domain_rejected
# ═════════════════════════════════════════════════════════════════════════════

def test_duplicate_domain_rejected():
    """Registering a second institution with the same domain must raise IdentityError."""
    mock, *_ = _make_stateful_mock(_TEST_MASTER_KEY)

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc = IdentityService(mock)
        svc.register_institution(
            name="First University",
            short_name=None,
            country="US",
            email_domain="duplicate.edu",
            registration_document=None,
        )
        with pytest.raises(IdentityError, match="already registered"):
            svc.register_institution(
                name="Second University",
                short_name=None,
                country="UK",
                email_domain="duplicate.edu",
                registration_document=None,
            )


# ═════════════════════════════════════════════════════════════════════════════
# 4. test_researcher_domain_verified
# ═════════════════════════════════════════════════════════════════════════════

def test_researcher_domain_verified():
    """
    Register institution 'university.edu', then register researcher whose
    email domain matches → DOMAIN_VERIFIED, attested_by == PLEXUS_CA.
    """
    mock, institutions, *_ = _make_stateful_mock(_TEST_MASTER_KEY)
    actor_id = str(uuid4())

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc  = IdentityService(mock)
        inst = svc.register_institution(
            name="Test University",
            short_name="TU",
            country="US",
            email_domain="university.edu",
            registration_document=None,
        )
        result = svc.register_researcher_identity(
            actor_id=actor_id,
            email="researcher@university.edu",
            institution_id=str(inst.institution_id),
            role="researcher",
        )

    assert result.verification_tier == "DOMAIN_VERIFIED"
    assert result.attested_by == "PLEXUS_CA"
    assert result.institution_id == inst.institution_id


# ═════════════════════════════════════════════════════════════════════════════
# 5. test_researcher_self_attested
# ═════════════════════════════════════════════════════════════════════════════

def test_researcher_self_attested():
    """Register researcher with no institution_id → SELF_ATTESTED, SELF."""
    mock, *_ = _make_stateful_mock(_TEST_MASTER_KEY)
    actor_id = str(uuid4())

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc    = IdentityService(mock)
        result = svc.register_researcher_identity(
            actor_id=actor_id,
            email="indie@personal.com",
            institution_id=None,
            role="researcher",
        )

    assert result.verification_tier == "SELF_ATTESTED"
    assert result.attested_by == "SELF"
    assert result.institution_id is None


# ═════════════════════════════════════════════════════════════════════════════
# 6. test_attestation_signature_valid
# ═════════════════════════════════════════════════════════════════════════════

def test_attestation_signature_valid():
    """
    Register institution then researcher (DOMAIN_VERIFIED).
    Verify the attestation_signature is a valid Ed25519 signature over
    the canonical claim JSON, verifiable with the institution's root_public_key.
    """
    mock, institutions, ca_vault, attestations = _make_stateful_mock(_TEST_MASTER_KEY)
    actor_id = str(uuid4())

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc  = IdentityService(mock)
        inst = svc.register_institution(
            name="Crypto University",
            short_name="CU",
            country="DE",
            email_domain="crypto.uni.de",
            registration_document=None,
        )
        result = svc.register_researcher_identity(
            actor_id=actor_id,
            email="author@crypto.uni.de",
            institution_id=str(inst.institution_id),
            role="researcher",
        )

    assert result.attested_by == "PLEXUS_CA"
    assert len(attestations) == 1
    att_row = attestations[0]

    # Reconstruct canonical claim and verify against institution root_public_key
    inst_row       = institutions["crypto.uni.de"]
    root_public_hex = inst_row["root_public_key"]
    claim_canonical = json.dumps(att_row["affiliation_claim"], sort_keys=True)
    sig_hex         = att_row["attestation_signature"]

    verify_key = nacl.signing.VerifyKey(bytes.fromhex(root_public_hex))
    # Must not raise BadSignatureError
    verify_key.verify(claim_canonical.encode("utf-8"), bytes.fromhex(sig_hex))


# ═════════════════════════════════════════════════════════════════════════════
# 7. test_identity_private_key_not_stored
# ═════════════════════════════════════════════════════════════════════════════

def test_identity_private_key_not_stored():
    """
    Register a researcher, then confirm:
      - identity_attestations contains no private key material
      - identity_key_registry stores only the public key
      - The returned AttestationResult carries the private key exactly once
    """
    mock, _, _, attestations = _make_stateful_mock(_TEST_MASTER_KEY)
    actor_id = str(uuid4())
    key_registry: list[dict] = []

    # Capture key_registry inserts from the stateful mock
    original_side_effect = mock.table.side_effect

    captured_registry: list[dict] = []

    def _table_with_capture(name: str):
        tbl = original_side_effect(name)
        if name == "identity_key_registry":
            orig_insert = tbl.insert.side_effect
            def _capturing_insert(row):
                captured_registry.append(deepcopy(row))
                return orig_insert(row)
            tbl.insert.side_effect = _capturing_insert
        return tbl

    mock.table.side_effect = _table_with_capture

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc    = IdentityService(mock)
        result = svc.register_researcher_identity(
            actor_id=actor_id,
            email="anon@example.org",
            institution_id=None,
            role="researcher",
        )

    # Private key returned in the result
    assert result.identity_private_key is not None
    raw = base64.b64decode(result.identity_private_key)
    assert len(raw) == 32   # 32-byte Ed25519 seed

    # Attestation row has no private key
    assert len(attestations) == 1
    att_row = attestations[0]
    for field_name, value in att_row.items():
        assert "private" not in str(field_name).lower()
        if isinstance(value, str):
            # Ensure private key bytes are not present as a substring
            assert result.identity_private_key not in value

    # Key registry stores only the public key
    assert len(captured_registry) == 1
    reg_row = captured_registry[0]
    assert reg_row["public_key"] == result.identity_public_key
    assert "private" not in str(reg_row).lower()
    assert reg_row["key_purpose"] == "identity"


# ═════════════════════════════════════════════════════════════════════════════
# 8. test_verify_identity_valid
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_identity_valid():
    """
    Register institution + researcher, then call verify_identity().
    Assert verified == True, institution_name correct, tier correct.
    """
    mock, institutions, _, attestations = _make_stateful_mock(_TEST_MASTER_KEY)
    actor_id = str(uuid4())

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc  = IdentityService(mock)
        inst = svc.register_institution(
            name="Verify University",
            short_name="VU",
            country="AU",
            email_domain="verify.edu.au",
            registration_document=None,
        )
        svc.register_researcher_identity(
            actor_id=actor_id,
            email="student@verify.edu.au",
            institution_id=str(inst.institution_id),
            role="researcher",
        )

        result = svc.verify_identity(actor_id)

    assert result.verified is True
    assert result.institution_name == "Verify University"
    assert result.verification_tier == "DOMAIN_VERIFIED"
    assert result.role == "researcher"
    assert result.valid_to is not None


# ═════════════════════════════════════════════════════════════════════════════
# 9. test_verify_identity_expired
# ═════════════════════════════════════════════════════════════════════════════

def test_verify_identity_expired():
    """
    Insert an attestation with valid_to = yesterday.
    verify_identity() must return verified=False, reason='Attestation expired'.
    """
    actor_id       = str(uuid4())
    institution_id = str(uuid4())
    attestation_id = str(uuid4())

    identity_key = nacl.signing.SigningKey.generate()
    identity_pub = identity_key.verify_key.encode().hex()
    expired_at   = _now() - timedelta(days=1)

    claim = {
        "subject_actor_id":  actor_id,
        "institution_id":    institution_id,
        "institution_name":  "Old Uni",
        "role":              "researcher",
        "department":        None,
        "email":             "old@uni.edu",
        "verification_tier": "SELF_ATTESTED",
        "valid_from":        (_now() - timedelta(days=366)).isoformat(),
        "valid_to":          expired_at.isoformat(),
    }
    claim_canonical = json.dumps(claim, sort_keys=True)
    signature = identity_key.sign(claim_canonical.encode("utf-8")).signature.hex()

    att_row = _attestation_row(
        attestation_id, actor_id, institution_id,
        identity_pub, "SELF_ATTESTED", "SELF", claim, signature,
        valid_to=expired_at,
    )

    mock = MagicMock()
    q = MagicMock()
    q.execute.return_value = MagicMock(data=[att_row])
    q.eq.return_value = q
    q.order.return_value = q
    q.limit.return_value = q
    mock.table.return_value.select.return_value = q

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc    = IdentityService(mock)
        result = svc.verify_identity(actor_id)

    assert result.verified is False
    assert result.reason == "Attestation expired"


# ═════════════════════════════════════════════════════════════════════════════
# 10. test_signing_key_linked_to_identity
# ═════════════════════════════════════════════════════════════════════════════

def test_signing_key_linked_to_identity():
    """
    Register institution + researcher → generate session key → link it.
    Assert KeyLinkResult is returned and verification_tier is propagated.
    """
    mock, institutions, _, attestations = _make_stateful_mock(_TEST_MASTER_KEY)
    actor_id         = str(uuid4())
    session_key_id   = str(uuid4())
    session_pub_key  = nacl.signing.SigningKey.generate().verify_key.encode().hex()
    key_expires_at   = (_now() + timedelta(hours=8)).isoformat()

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        svc  = IdentityService(mock)
        inst = svc.register_institution(
            name="Link University",
            short_name="LU",
            country="CA",
            email_domain="link.ca",
            registration_document=None,
        )
        att = svc.register_researcher_identity(
            actor_id=actor_id,
            email="author@link.ca",
            institution_id=str(inst.institution_id),
            role="researcher",
        )

    # Wire up the session key mock on the same supabase instance
    session_key_data = {
        "public_key": session_pub_key,
        "revoked":    False,
        "expires_at": key_expires_at,
    }
    # Override the ledger_session_keys table mock
    original_table_side = mock.table.side_effect

    attestation_id = str(att.attestation_id)

    def _extended_table(name: str):
        tbl = original_table_side(name)
        if name == "ledger_session_keys":
            q2 = MagicMock()
            q2.execute.return_value = MagicMock(data=session_key_data)
            q2.eq.return_value      = q2
            q2.single.return_value  = q2
            tbl.select.return_value = q2
        elif name == "identity_attestations":
            # Also need a select("verification_tier").eq("id", ...).single()
            original_select = tbl.select.side_effect

            def _select_tier(cols):
                if cols == "verification_tier":
                    att_row = next(
                        (a for a in attestations if a["id"] == attestation_id), None
                    )
                    q3 = MagicMock()
                    q3.execute.return_value = MagicMock(
                        data={"verification_tier": att_row["verification_tier"]} if att_row else None
                    )
                    q3.eq.return_value     = q3
                    q3.single.return_value = q3
                    return q3
                return original_select(cols)

            tbl.select.side_effect = _select_tier
        return tbl

    mock.table.side_effect = _extended_table

    # link_signing_key_to_identity internally calls verify_identity first.
    # verify_identity fetches from identity_attestations — our mock returns
    # the attestation row that was inserted above.  The institution lookup
    # for signature verification also uses our mock.

    with patch.dict(os.environ, {"PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY}):
        result = svc.link_signing_key_to_identity(
            actor_id=actor_id,
            session_key_id=session_key_id,
            attestation_id=attestation_id,
        )

    assert isinstance(result, KeyLinkResult)
    assert result.verification_tier == "DOMAIN_VERIFIED"
    assert result.linked_at is not None


# ═════════════════════════════════════════════════════════════════════════════
# 11. test_trust_engine_r3_with_identity
# ═════════════════════════════════════════════════════════════════════════════

def test_trust_engine_r3_with_identity():
    """
    TrustEngine with injected IdentityService returning OFFICIALLY_REGISTERED
    must set R3.1 = True.  With a fully compliant ledger, trust_level == 3.
    """
    actor_id       = str(uuid4())
    session_key_id = str(uuid4())
    institution_id = str(uuid4())

    # Build a minimal compliant ledger
    events = []
    prev_h = "0" * 64

    def _evt(seq, evt_type, payload, actor_role="author"):
        h = hashlib.sha256(f"{seq}".encode()).hexdigest()
        e = {
            "id":               str(uuid4()),
            "sequence_number":  seq,
            "event_type":       evt_type,
            "actor_id":         actor_id,
            "actor_role":       actor_role,
            "session_key_id":   session_key_id,
            "previous_hash":    prev_h,
            "event_hash":       h,
            "signature":        "s" * 128,
            "payload":          payload,
            "timestamp":        _now().isoformat(),
        }
        return e

    events = [
        _evt(1, "dataset_imported",         {}),
        _evt(2, "assumption_check",         {"dqi_score": 0.85}),
        _evt(3, "model_selected",           {"outcome_variable": "y"}),
        _evt(4, "analysis_run_completed",   {
            "input_dataset_hash": "abc123",
            "parameters":         {"alpha": 0.05},
            "environment":        {
                "python_version":  "3.9",
                "package_versions": {"numpy": "1.26"},
            },
        }),
        _evt(5, "output_generated",         {}),
        _evt(6, "project_sealed",           {}),
    ]

    ledger_json      = json.dumps(events, sort_keys=True, default=str)
    artifact_hashes  = {"ledger.json": hashlib.sha256(ledger_json.encode()).hexdigest()}
    sorted_h         = "".join(artifact_hashes[p] for p in sorted(artifact_hashes))
    root_hash        = hashlib.sha256((ledger_json + sorted_h).encode()).hexdigest()

    manifest = {
        "pvp_format_version":    "1.0",
        "ptls_version":          "0.1",
        "project_id":            str(uuid4()),
        "root_hash":             root_hash,
        "total_events":          6,
        "institutional_boundary": "institutional",
        "deployment_mode":       "cloud",
        "artifact_hashes":       artifact_hashes,
        "timestamp_authority_token": "rfc3161_token",   # R3.2
        "signatures": {
            "author": {
                "session_key_id": session_key_id,
                "public_key":     "pk" * 32,
                "signature":      "sig" * 21,
                "signed_at":      _now().isoformat(),
            },
            "supervisor": {
                "session_key_id": str(uuid4()),
                "public_key":     "pk" * 32,
                "signature":      "sig" * 21,
                "signed_at":      _now().isoformat(),
            },
            "institution": {"signature": "inst_sig"},   # R3.1 fallback (unused)
        },
    }

    integrity = IntegrityResult(
        passed=True,
        pvp_format_version="1.0",
        ptls_version="0.1",
        project_id=manifest["project_id"],
        total_events=6,
        institutional_boundary="institutional",
        deployment_mode="cloud",
    )
    chain = ChainResult(
        passed=True,
        total_events=6,
        revocation_status="clean",
    )

    mock_id_svc = MagicMock()
    mock_id_svc.verify_identity.return_value = IdentityVerificationResult(
        verified=True,
        actor_id=actor_id,
        institution_id=institution_id,
        institution_name="Official University",
        verification_tier="OFFICIALLY_REGISTERED",
        role="researcher",
        valid_to=_now() + timedelta(days=365),
    )

    engine = TrustEngine(identity_service=mock_id_svc)
    result = engine.evaluate(events, manifest, integrity, chain)

    assert result.requirements_checked["R3"]["R3.1"] is True
    assert result.level == 3


# ═════════════════════════════════════════════════════════════════════════════
# 12. test_trust_engine_r2_with_domain_verified
# ═════════════════════════════════════════════════════════════════════════════

def test_trust_engine_r2_with_domain_verified():
    """
    TrustEngine with injected IdentityService returning DOMAIN_VERIFIED
    must set R2.6 = True.  R3.1 = False (not OFFICIALLY_REGISTERED) so
    trust_level is capped at 2.
    """
    actor_id       = str(uuid4())
    session_key_id = str(uuid4())

    def _evt(seq, evt_type, payload):
        return {
            "id":              str(uuid4()),
            "sequence_number": seq,
            "event_type":      evt_type,
            "actor_id":        actor_id,
            "actor_role":      "author",
            "session_key_id":  session_key_id,
            "previous_hash":   "0" * 64 if seq == 1 else hashlib.sha256(str(seq - 1).encode()).hexdigest(),
            "event_hash":      hashlib.sha256(str(seq).encode()).hexdigest(),
            "signature":       "s" * 128,
            "payload":         payload,
            "timestamp":       _now().isoformat(),
        }

    events = [
        _evt(1, "dataset_imported",       {}),
        _evt(2, "assumption_check",       {"dqi_score": 0.80}),
        _evt(3, "model_selected",         {"outcome_variable": "y"}),
        _evt(4, "analysis_run_completed", {
            "input_dataset_hash": "abc",
            "parameters":         {"k": 1},
            "environment":        {
                "python_version":  "3.9",
                "package_versions": {"pandas": "2.2"},
            },
        }),
        _evt(5, "output_generated",       {}),
        _evt(6, "project_sealed",         {}),
    ]

    ledger_json     = json.dumps(events, sort_keys=True, default=str)
    artifact_hashes = {"ledger.json": hashlib.sha256(ledger_json.encode()).hexdigest()}
    sorted_h        = "".join(artifact_hashes[p] for p in sorted(artifact_hashes))
    root_hash       = hashlib.sha256((ledger_json + sorted_h).encode()).hexdigest()

    manifest = {
        "pvp_format_version":    "1.0",
        "ptls_version":          "0.1",
        "project_id":            str(uuid4()),
        "root_hash":             root_hash,
        "total_events":          6,
        "institutional_boundary": "institutional",
        "deployment_mode":       "cloud",
        "artifact_hashes":       artifact_hashes,
        "timestamp_authority_token": "token",
        "signatures": {
            "author": {
                "session_key_id": session_key_id,
                "public_key":     "pk" * 32,
                "signature":      "sig" * 21,
                "signed_at":      _now().isoformat(),
            },
            "supervisor": {
                "session_key_id": str(uuid4()),
                "public_key":     "pk" * 32,
                "signature":      "sig" * 21,
                "signed_at":      _now().isoformat(),
            },
            "institution": None,   # no institution sig → R3.1 fallback = False
        },
    }

    integrity = IntegrityResult(
        passed=True, pvp_format_version="1.0", ptls_version="0.1",
        project_id=manifest["project_id"], total_events=6,
        institutional_boundary="institutional", deployment_mode="cloud",
    )
    chain = ChainResult(passed=True, total_events=6, revocation_status="clean")

    mock_id_svc = MagicMock()
    mock_id_svc.verify_identity.return_value = IdentityVerificationResult(
        verified=True,
        actor_id=actor_id,
        institution_id=str(uuid4()),
        institution_name="Domain Uni",
        verification_tier="DOMAIN_VERIFIED",
        role="researcher",
        valid_to=_now() + timedelta(days=365),
    )

    engine = TrustEngine(identity_service=mock_id_svc)
    result = engine.evaluate(events, manifest, integrity, chain)

    assert result.requirements_checked["R2"]["R2.6"] is True
    assert result.requirements_checked["R3"]["R3.1"] is False
    assert result.level == 2


# ═════════════════════════════════════════════════════════════════════════════
# 13. test_ca_private_key_never_exposed_via_api
# ═════════════════════════════════════════════════════════════════════════════

def test_ca_private_key_never_exposed_via_api():
    """
    Call POST /api/identity/institution/register via TestClient.
    Assert:
      - Response body contains no private key material.
      - The ca_private_keys table is not referenced in any response field.
      - Response matches InstitutionResult schema (no extra private key field).
    """
    from apps.analytics.main import app

    # Build a mock Supabase that captures what would be stored
    inst_id          = str(uuid4())
    ca_vault_inserts: list[dict] = []

    mock_sb = MagicMock()

    def _table(name: str):
        tbl = MagicMock()
        if name == "institutions":
            # Duplicate check
            select_q = MagicMock()
            select_q.execute.return_value = MagicMock(data=[])   # no duplicate
            select_q.eq.return_value = select_q
            tbl.select.return_value = select_q
            # Insert
            inst_row = {
                "id":                inst_id,
                "name":              "API University",
                "email_domain":      "api.edu",
                "verification_tier": "DOMAIN_VERIFIED",
                "plexus_managed_ca": True,
                "active":            True,
                "created_at":        _now().isoformat(),
            }
            insert_m = MagicMock()
            insert_m.execute.return_value = MagicMock(data=[inst_row])
            tbl.insert.return_value = insert_m
        elif name == "ca_private_keys":
            def _ca_insert(row):
                ca_vault_inserts.append(deepcopy(row))
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[row])
                return m
            tbl.insert.side_effect = _ca_insert
        return tbl

    mock_sb.table.side_effect = _table

    from apps.analytics.middleware.auth import get_current_user as _get_current_user

    # Override Depends(get_current_user) so auth doesn't reject the request
    app.dependency_overrides[_get_current_user] = lambda: "test-user"
    try:
        with (
            patch("apps.analytics.routers.identity._supabase", return_value=mock_sb),
            patch.dict(os.environ, {
                "PLEXUS_CA_MASTER_KEY": _TEST_MASTER_KEY,
                "SERVICE_BOUNDARY":     "institutional",
            }),
        ):
            client   = TestClient(app, raise_server_exceptions=True)
            response = client.post("/api/identity/institution/register", json={
                "name":        "API University",
                "short_name":  "APIU",
                "country":     "US",
                "email_domain": "api.edu",
            })
    finally:
        app.dependency_overrides.pop(_get_current_user, None)

    assert response.status_code == 201
    body = response.json()

    # Response must match InstitutionResult — no private key fields
    assert "identity_private_key" not in body
    assert "encrypted_private_key" not in body
    assert "private_key" not in body
    assert "ca_private_keys" not in str(body)

    # Verify the CA private key WAS stored in the vault (not leaked to API)
    assert len(ca_vault_inserts) == 1
    vault_row = ca_vault_inserts[0]
    assert vault_row["institution_id"] == inst_id
    assert "encrypted_private_key" in vault_row
    # Ensure the encrypted key is NOT present in the API response
    assert vault_row["encrypted_private_key"] not in str(body)
