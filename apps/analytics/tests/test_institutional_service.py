"""
Tests for PLEXUS InstitutionalService.

All tests mock the Supabase client plus IdentityService, RevocationService,
and LedgerService — no live DB or network required.

Uses the same dual-mock pattern as test_pvp_builder.py.

Run from the project root:
    pytest apps/analytics/tests/test_institutional_service.py -v
"""

from __future__ import annotations

import base64
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
from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.analytics.models.institutional import (
    ComplianceSummary,
    DepartureResult,
    EligibilityResult,
    PolicyResult,
    SigningAuthorisationResult,
)
from apps.analytics.models.identity import IdentityVerificationResult
from apps.analytics.models.revocation import (
    AttestationRevocationResult,
    RevocationStatusResult,
)
from apps.analytics.services.institutional_service import (
    InstitutionalError,
    InstitutionalService,
)
from apps.analytics.services.pvp_builder import (
    PVPBuildError,
    PVPBuilder,
    PVPSignError,
    _build_zip,
    _compute_root_hash,
    _read_manifest,
)
from apps.analytics.models.ledger import GENESIS_HASH
from apps.analytics.routers.institutional import router as institutional_router


# ════════════════════════════════════════════════════════════════════════════
# Shared helpers
# ════════════════════════════════════════════════════════════════════════════

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _signing_key() -> tuple[nacl.signing.SigningKey, bytes]:
    key = nacl.signing.SigningKey.generate()
    return key, bytes(key)


def _institution_row(institution_id: str, active: bool = True) -> dict:
    return {
        "id":                institution_id,
        "name":              "Test University",
        "email_domain":      "test.edu",
        "verification_tier": "DOMAIN_VERIFIED",
        "root_public_key":   "a" * 64,
        "plexus_managed_ca": True,
        "active":            active,
        "created_at":        _now().isoformat(),
    }


def _workspace_row(workspace_id: str, institution_id: str) -> dict:
    return {
        "id":             workspace_id,
        "institution_id": institution_id,
        "name":           "Test Workspace",
        "type":           "institutional",
        "created_at":     _now().isoformat(),
    }


def _membership_row(workspace_id: str, user_id: str, role: str = "admin") -> dict:
    return {
        "id":           str(uuid4()),
        "workspace_id": workspace_id,
        "user_id":      user_id,
        "role":         role,
        "status":       "active",
        "joined_at":    _now().isoformat(),
    }


def _policy_row(
    policy_id: str,
    institution_id: str,
    workspace_id: str,
    min_dqi_score: float = 0.70,
    min_trust_level: int = 1,
    supervisor_signing_required: bool = True,
) -> dict:
    now = _now().isoformat()
    return {
        "id":                          policy_id,
        "institution_id":              institution_id,
        "workspace_id":                workspace_id,
        "min_trust_level":             min_trust_level,
        "min_dqi_score":               min_dqi_score,
        "supervisor_signing_required": supervisor_signing_required,
        "institution_signing_required": False,
        "require_assumption_checks":   True,
        "require_ethics_reference":    False,
        "created_by":                  str(uuid4()),
        "created_at":                  now,
        "updated_at":                  now,
    }


def _assignment_row(
    assignment_id: str,
    workspace_id: str,
    supervisor_id: str,
    student_id: str,
    status: str = "active",
) -> dict:
    return {
        "id":           assignment_id,
        "workspace_id": workspace_id,
        "supervisor_id": supervisor_id,
        "student_id":   student_id,
        "department_id": str(uuid4()),
        "assigned_by":  str(uuid4()),
        "status":       status,
        "assigned_at":  _now().isoformat(),
        "ended_at":     None,
    }


def _attestation_row(
    attestation_id: str,
    actor_id: str,
    institution_id: str,
    tier: str = "DOMAIN_VERIFIED",
    revoked: bool = False,
) -> dict:
    return {
        "id":                attestation_id,
        "actor_id":          actor_id,
        "institution_id":    institution_id,
        "identity_key":      "b" * 64,
        "verification_tier": tier,
        "attested_by":       "PLEXUS_CA",
        "affiliation_claim": {},
        "attestation_signature": "c" * 128,
        "valid_from":        _now().isoformat(),
        "valid_to":          (_now() + timedelta(days=365)).isoformat(),
        "revoked":           revoked,
        "created_at":        _now().isoformat(),
    }


def _authorisation_row(
    auth_id: str,
    assignment_id: str,
    supervisor_id: str,
    student_id: str,
    project_id: str,
    workspace_id: str,
    institution_id: str,
    attestation_id: str,
) -> dict:
    return {
        "id":               auth_id,
        "assignment_id":    assignment_id,
        "supervisor_id":    supervisor_id,
        "student_id":       student_id,
        "project_id":       project_id,
        "workspace_id":     workspace_id,
        "institution_id":   institution_id,
        "attestation_id":   attestation_id,
        "signing_authorised": True,
        "authorised_by":    str(uuid4()),
        "authorised_at":    _now().isoformat(),
        "revoked":          False,
        "revoked_at":       None,
        "revocation_reason": None,
    }


def _make_supabase_mock(
    *,
    institution_rows: list[dict] | None = None,
    workspace_rows: list[dict] | None = None,
    membership_rows: list[dict] | None = None,
    policy_rows: list[dict] | None = None,
    assignment_rows: list[dict] | None = None,
    attestation_rows: list[dict] | None = None,
    authorisation_rows: list[dict] | None = None,
    project_rows: list[dict] | None = None,
    compliance_event_rows: list[dict] | None = None,
    departure_rows: list[dict] | None = None,
    identity_key_rows: list[dict] | None = None,
    dataset_rows: list[dict] | None = None,
    quality_report_rows: list[dict] | None = None,
    pvp_rows: list[dict] | None = None,
    insert_id: str | None = None,
) -> MagicMock:
    """
    Build a routing Supabase mock for InstitutionalService tests.

    Uses mutable inserted[] store so insert calls can be inspected.
    """
    _id = insert_id or str(uuid4())

    _institutions    = institution_rows or []
    _workspaces      = workspace_rows or []
    _memberships     = membership_rows or []
    _policies        = policy_rows or []
    _assignments     = assignment_rows or []
    _attestations    = attestation_rows or []
    _authorisations  = authorisation_rows or []
    _projects        = project_rows or []
    _events          = compliance_event_rows or []
    _departures      = departure_rows or []
    _id_keys         = identity_key_rows or []
    _datasets        = dataset_rows or []
    _quality_reports = quality_report_rows or []
    _pvps            = pvp_rows or []

    inserted: dict[str, list[dict]] = {
        "institutional_policies":            [],
        "supervisor_signing_authorisations": [],
        "institutional_compliance_events":   [],
        "researcher_departures":             [],
    }
    updated: dict[str, list[dict]] = {
        "supervisor_assignments":            [],
        "supervisor_signing_authorisations": [],
        "institutional_policies":            [],
    }

    def _q(data):
        """
        Return a chainable mock.

        When .single() is called, the subsequent .execute() returns the
        first element of data (if data is a list), matching real Supabase
        behaviour where .single() expects exactly one row.
        """
        # Build a "single-row" sub-mock used after .single() in the chain
        _single_data = data[0] if isinstance(data, list) and data else data
        single_q = MagicMock()
        single_q.execute.return_value = MagicMock(data=_single_data)
        single_q.eq.return_value = single_q
        single_q.order.return_value = single_q
        single_q.limit.return_value = single_q

        q = MagicMock()
        q.execute.return_value = MagicMock(data=data)
        q.eq.return_value = q
        q.in_.return_value = q
        q.not_.return_value = q
        q.limit.return_value = q
        q.order.return_value = q
        q.select.return_value = q
        q.single.return_value = single_q
        return q

    def table(name: str):
        tbl = MagicMock()

        # ── institutions ──────────────────────────────────────────────
        if name == "institutions":
            q = _q(_institutions[0] if _institutions else None)
            q.execute.return_value = MagicMock(data=_institutions[0] if _institutions else None)
            tbl.select.return_value = q

        # ── workspaces ────────────────────────────────────────────────
        elif name == "workspaces":
            q = _q(_workspaces[0] if _workspaces else None)
            tbl.select.return_value = q

        # ── workspace_memberships ─────────────────────────────────────
        elif name == "workspace_memberships":
            q = _q(_memberships)
            tbl.select.return_value = q

        # ── institutional_policies ────────────────────────────────────
        elif name == "institutional_policies":
            q = _q(_policies[0] if _policies else None)
            # select().eq().eq().limit() → list
            list_q = _q(_policies)
            tbl.select.return_value = list_q

            def _insert(row):
                new_row = {**row, "id": _id}
                inserted["institutional_policies"].append(new_row)
                im = MagicMock()
                im.execute.return_value = MagicMock(data=[new_row])
                return im

            def _update(patch):
                updated["institutional_policies"].append(patch)
                merged = {**(_policies[0] if _policies else {}), **patch}
                um = MagicMock()
                um.execute.return_value = MagicMock(data=[merged])
                um.eq.return_value = um
                return um

            tbl.insert.side_effect = _insert
            tbl.update.side_effect = _update

        # ── supervisor_assignments ────────────────────────────────────
        elif name == "supervisor_assignments":
            single_q = _q(_assignments[0] if _assignments else None)
            list_q   = _q(_assignments)
            tbl.select.return_value = list_q

            def _update_assign(patch):
                updated["supervisor_assignments"].append(patch)
                um = MagicMock()
                um.execute.return_value = MagicMock(data=[patch])
                um.eq.return_value = um
                return um

            tbl.update.side_effect = _update_assign

        # ── supervisor_signing_authorisations ─────────────────────────
        elif name == "supervisor_signing_authorisations":
            q = _q(_authorisations)
            tbl.select.return_value = q

            def _insert_auth(row):
                new_row = {**row, "id": _id}
                inserted["supervisor_signing_authorisations"].append(new_row)
                im = MagicMock()
                im.execute.return_value = MagicMock(data=[new_row])
                return im

            def _update_auth(patch):
                updated["supervisor_signing_authorisations"].append(patch)
                um = MagicMock()
                um.execute.return_value = MagicMock(data=[patch])
                um.eq.return_value = um
                return um

            tbl.insert.side_effect = _insert_auth
            tbl.update.side_effect = _update_auth

        # ── identity_attestations ─────────────────────────────────────
        elif name == "identity_attestations":
            q = _q(_attestations)
            tbl.select.return_value = q

        # ── identity_key_registry ─────────────────────────────────────
        elif name == "identity_key_registry":
            q = _q(_id_keys)
            tbl.select.return_value = q

        # ── projects ──────────────────────────────────────────────────
        elif name == "projects":
            q = _q(_projects)
            tbl.select.return_value = q

        # ── institutional_compliance_events ───────────────────────────
        elif name == "institutional_compliance_events":
            q = _q(_events)
            tbl.select.return_value = q

            def _insert_event(row):
                new_row = {**row, "id": str(uuid4())}
                inserted["institutional_compliance_events"].append(new_row)
                im = MagicMock()
                im.execute.return_value = MagicMock(data=[new_row])
                return im

            tbl.insert.side_effect = _insert_event

        # ── researcher_departures ─────────────────────────────────────
        elif name == "researcher_departures":
            q = _q(_departures)
            tbl.select.return_value = q

            def _insert_dep(row):
                new_row = {**row, "id": _id}
                inserted["researcher_departures"].append(new_row)
                im = MagicMock()
                im.execute.return_value = MagicMock(data=[new_row])
                return im

            tbl.insert.side_effect = _insert_dep

        # ── datasets ──────────────────────────────────────────────────
        elif name == "datasets":
            q = _q(_datasets)
            tbl.select.return_value = q

        # ── dataset_quality_reports ───────────────────────────────────
        elif name == "dataset_quality_reports":
            q = _q(_quality_reports)
            tbl.select.return_value = q

        # ── pvp_packages ──────────────────────────────────────────────
        elif name == "pvp_packages":
            q = _q(_pvps)
            tbl.select.return_value = q

        return tbl

    mock = MagicMock()
    mock.table.side_effect = table
    mock._inserted = inserted
    mock._updated  = updated
    return mock


def _make_identity_mock(
    verified: bool = True,
    verification_tier: str = "DOMAIN_VERIFIED",
    actor_id: str | None = None,
    institution_id: str | None = None,
) -> MagicMock:
    """Mock IdentityService.verify_identity()."""
    svc = MagicMock()
    result = IdentityVerificationResult(
        verified=verified,
        reason=None if verified else "No active attestation found",
        actor_id=actor_id,
        institution_id=institution_id,
        verification_tier=verification_tier if verified else None,
    )
    svc.verify_identity.return_value = result
    return svc


def _make_revocation_mock(
    is_revoked: bool = False,
    cascaded_key_revocations: int = 0,
) -> MagicMock:
    """Mock RevocationService.check_attestation() and revoke_attestation()."""
    svc = MagicMock()
    svc.check_attestation.return_value = RevocationStatusResult(
        revoked=is_revoked,
        revocation_type="attestation" if is_revoked else None,
        reason="institution_request" if is_revoked else None,
    )
    revocation_id = str(uuid4())
    svc.revoke_attestation.return_value = AttestationRevocationResult(
        revocation_id=revocation_id,
        attestation_id=str(uuid4()),
        actor_id=str(uuid4()),
        cascaded_key_revocations=cascaded_key_revocations,
        reason="affiliation_ended",
        revoked_at=_now(),
    )
    return svc


def _make_ledger_mock() -> MagicMock:
    return MagicMock()


def _make_svc(
    supabase,
    identity_svc=None,
    revocation_svc=None,
    ledger_svc=None,
) -> InstitutionalService:
    return InstitutionalService(
        supabase_client=supabase,
        identity_service=identity_svc or _make_identity_mock(),
        revocation_service=revocation_svc or _make_revocation_mock(),
        ledger_service=ledger_svc or _make_ledger_mock(),
    )


# ════════════════════════════════════════════════════════════════════════════
# 1. test_create_policy_success
# ════════════════════════════════════════════════════════════════════════════

def test_create_policy_success():
    """create_policy() returns PolicyResult with custom DQI = 0.85."""
    inst_id  = str(uuid4())
    ws_id    = str(uuid4())
    admin_id = str(uuid4())
    pol_id   = str(uuid4())

    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        membership_rows=[_membership_row(ws_id, admin_id, "admin")],
        policy_rows=[],  # no existing policy
        insert_id=pol_id,
    )
    svc = _make_svc(sb)

    result = svc.create_policy(
        institution_id=inst_id,
        workspace_id=ws_id,
        created_by=admin_id,
        min_dqi_score=0.85,
    )

    assert isinstance(result, PolicyResult)
    assert result.min_dqi_score == 0.85
    assert result.policy_id is not None
    # Confirm insert was called
    assert len(sb._inserted["institutional_policies"]) == 1


# ════════════════════════════════════════════════════════════════════════════
# 2. test_create_policy_duplicate_rejected
# ════════════════════════════════════════════════════════════════════════════

def test_create_policy_duplicate_rejected():
    """create_policy() raises InstitutionalError when policy already exists."""
    inst_id  = str(uuid4())
    ws_id    = str(uuid4())
    admin_id = str(uuid4())
    pol_id   = str(uuid4())

    existing_policy = _policy_row(pol_id, inst_id, ws_id)
    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        membership_rows=[_membership_row(ws_id, admin_id)],
        policy_rows=[existing_policy],  # policy already exists
    )
    svc = _make_svc(sb)

    with pytest.raises(InstitutionalError, match="already exists"):
        svc.create_policy(
            institution_id=inst_id,
            workspace_id=ws_id,
            created_by=admin_id,
        )


# ════════════════════════════════════════════════════════════════════════════
# 3. test_get_policy_returns_defaults
# ════════════════════════════════════════════════════════════════════════════

def test_get_policy_returns_defaults():
    """
    get_policy() returns a synthetic default when no policy is stored.
    supervisor_signing_required must be True by default.
    """
    inst_id = str(uuid4())
    ws_id   = str(uuid4())

    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        policy_rows=[],  # empty
    )
    svc = _make_svc(sb)

    result = svc.get_policy(institution_id=inst_id, workspace_id=ws_id)

    assert isinstance(result, PolicyResult)
    assert result.supervisor_signing_required is True
    assert result.min_dqi_score == 0.70
    assert result.min_trust_level == 1


# ════════════════════════════════════════════════════════════════════════════
# 4. test_update_policy_success
# ════════════════════════════════════════════════════════════════════════════

def test_update_policy_success():
    """update_policy() applies changes and returns updated PolicyResult."""
    inst_id  = str(uuid4())
    ws_id    = str(uuid4())
    admin_id = str(uuid4())
    pol_id   = str(uuid4())

    original_policy = _policy_row(pol_id, inst_id, ws_id, min_trust_level=1)
    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        membership_rows=[_membership_row(ws_id, admin_id)],
        policy_rows=[original_policy],
        insert_id=pol_id,
    )
    svc = _make_svc(sb)

    # The update mock merges the patch onto the original and returns it.
    result = svc.update_policy(
        policy_id=pol_id,
        updated_by=admin_id,
        min_trust_level=2,
    )

    assert isinstance(result, PolicyResult)
    # The update patch should contain the new trust level
    assert sb._updated["institutional_policies"]
    patch_applied = sb._updated["institutional_policies"][0]
    assert patch_applied["min_trust_level"] == 2
    assert "updated_at" in patch_applied


# ════════════════════════════════════════════════════════════════════════════
# 5. test_authorise_supervisor_signing_success
# ════════════════════════════════════════════════════════════════════════════

def test_authorise_supervisor_signing_success():
    """
    authorise_supervisor_signing() returns SigningAuthorisationResult
    with the supervisor's attestation_id linked.
    """
    inst_id     = str(uuid4())
    ws_id       = str(uuid4())
    sup_id      = str(uuid4())
    student_id  = str(uuid4())
    admin_id    = str(uuid4())
    project_id  = str(uuid4())
    assign_id   = str(uuid4())
    att_id      = str(uuid4())
    auth_id     = str(uuid4())

    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        membership_rows=[_membership_row(ws_id, admin_id)],
        policy_rows=[_policy_row(str(uuid4()), inst_id, ws_id)],
        assignment_rows=[_assignment_row(assign_id, ws_id, sup_id, student_id)],
        attestation_rows=[_attestation_row(att_id, sup_id, inst_id)],
        project_rows=[{"id": project_id, "workspace_id": ws_id, "status": "active"}],
        insert_id=auth_id,
    )
    identity_svc = _make_identity_mock(verified=True, actor_id=sup_id)
    svc = _make_svc(sb, identity_svc=identity_svc)

    result = svc.authorise_supervisor_signing(
        assignment_id=assign_id,
        project_id=project_id,
        authorised_by=admin_id,
    )

    assert isinstance(result, SigningAuthorisationResult)
    assert result.signing_authorised is True
    assert str(result.attestation_id) == att_id
    assert str(result.supervisor_id)  == sup_id
    assert str(result.project_id)     == project_id


# ════════════════════════════════════════════════════════════════════════════
# 6. test_authorise_signing_unverified_supervisor
# ════════════════════════════════════════════════════════════════════════════

def test_authorise_signing_unverified_supervisor():
    """
    authorise_supervisor_signing() raises InstitutionalError if the
    supervisor's identity is not verified.
    """
    inst_id    = str(uuid4())
    ws_id      = str(uuid4())
    sup_id     = str(uuid4())
    student_id = str(uuid4())
    admin_id   = str(uuid4())
    project_id = str(uuid4())
    assign_id  = str(uuid4())

    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        membership_rows=[_membership_row(ws_id, admin_id)],
        assignment_rows=[_assignment_row(assign_id, ws_id, sup_id, student_id)],
        attestation_rows=[],  # no attestation
        project_rows=[{"id": project_id, "workspace_id": ws_id}],
    )
    identity_svc = _make_identity_mock(verified=False)
    svc = _make_svc(sb, identity_svc=identity_svc)

    with pytest.raises(InstitutionalError) as exc_info:
        svc.authorise_supervisor_signing(
            assignment_id=assign_id,
            project_id=project_id,
            authorised_by=admin_id,
        )

    assert "identity not verified" in str(exc_info.value).lower()


# ════════════════════════════════════════════════════════════════════════════
# 7. test_authorise_signing_inactive_assignment
# ════════════════════════════════════════════════════════════════════════════

def test_authorise_signing_inactive_assignment():
    """
    authorise_supervisor_signing() raises InstitutionalError when the
    assignment status is 'ended'.
    """
    inst_id    = str(uuid4())
    ws_id      = str(uuid4())
    sup_id     = str(uuid4())
    student_id = str(uuid4())
    admin_id   = str(uuid4())
    project_id = str(uuid4())
    assign_id  = str(uuid4())

    ended_assignment = _assignment_row(assign_id, ws_id, sup_id, student_id, status="ended")
    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        membership_rows=[_membership_row(ws_id, admin_id)],
        assignment_rows=[ended_assignment],
        project_rows=[{"id": project_id, "workspace_id": ws_id}],
    )
    svc = _make_svc(sb)

    with pytest.raises(InstitutionalError, match="not active"):
        svc.authorise_supervisor_signing(
            assignment_id=assign_id,
            project_id=project_id,
            authorised_by=admin_id,
        )


# ════════════════════════════════════════════════════════════════════════════
# 8. test_validate_pvp_signing_eligible
# ════════════════════════════════════════════════════════════════════════════

def test_validate_pvp_signing_eligible():
    """
    validate_pvp_signing_eligibility() returns EligibilityResult(eligible=True)
    when full setup: institution, policy, assignment, identity, authorisation.
    """
    inst_id    = str(uuid4())
    ws_id      = str(uuid4())
    sup_id     = str(uuid4())
    student_id = str(uuid4())
    project_id = str(uuid4())
    pvp_id     = str(uuid4())
    assign_id  = str(uuid4())
    att_id     = str(uuid4())
    auth_id    = str(uuid4())

    auth_row = _authorisation_row(
        auth_id, assign_id, sup_id, student_id,
        project_id, ws_id, inst_id, att_id
    )
    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        policy_rows=[_policy_row(str(uuid4()), inst_id, ws_id)],
        authorisation_rows=[auth_row],
        attestation_rows=[_attestation_row(att_id, sup_id, inst_id)],
        project_rows=[{"id": project_id, "workspace_id": ws_id}],
        pvp_rows=[{"id": pvp_id, "project_id": project_id}],
    )
    identity_svc    = _make_identity_mock(verified=True, actor_id=sup_id)
    revocation_svc  = _make_revocation_mock(is_revoked=False)
    svc = _make_svc(sb, identity_svc=identity_svc, revocation_svc=revocation_svc)

    result = svc.validate_pvp_signing_eligibility(
        pvp_id=pvp_id,
        supervisor_id=sup_id,
        project_id=project_id,
    )

    assert result.eligible is True
    assert result.verification_tier is not None
    assert result.authorisation_id is not None


# ════════════════════════════════════════════════════════════════════════════
# 9. test_validate_pvp_signing_no_authorisation
# ════════════════════════════════════════════════════════════════════════════

def test_validate_pvp_signing_no_authorisation():
    """
    validate_pvp_signing_eligibility() returns eligible=False with
    "No signing authorisation" reason when no authorisation exists.
    """
    sup_id     = str(uuid4())
    project_id = str(uuid4())
    pvp_id     = str(uuid4())

    sb = _make_supabase_mock(
        authorisation_rows=[],  # no authorisation
        project_rows=[{"id": project_id, "workspace_id": str(uuid4())}],
        pvp_rows=[{"id": pvp_id, "project_id": project_id}],
    )
    svc = _make_svc(sb)

    result = svc.validate_pvp_signing_eligibility(
        pvp_id=pvp_id,
        supervisor_id=sup_id,
        project_id=project_id,
    )

    assert result.eligible is False
    assert "No signing authorisation" in result.reason


# ════════════════════════════════════════════════════════════════════════════
# 10. test_validate_pvp_signing_revoked_attestation
# ════════════════════════════════════════════════════════════════════════════

def test_validate_pvp_signing_revoked_attestation():
    """
    validate_pvp_signing_eligibility() returns eligible=False when the
    supervisor's attestation is revoked.
    """
    inst_id    = str(uuid4())
    ws_id      = str(uuid4())
    sup_id     = str(uuid4())
    student_id = str(uuid4())
    project_id = str(uuid4())
    pvp_id     = str(uuid4())
    assign_id  = str(uuid4())
    att_id     = str(uuid4())
    auth_id    = str(uuid4())

    auth_row = _authorisation_row(
        auth_id, assign_id, sup_id, student_id,
        project_id, ws_id, inst_id, att_id
    )
    sb = _make_supabase_mock(
        authorisation_rows=[auth_row],
        attestation_rows=[_attestation_row(att_id, sup_id, inst_id, revoked=True)],
        project_rows=[{"id": project_id, "workspace_id": ws_id}],
        pvp_rows=[{"id": pvp_id, "project_id": project_id}],
    )
    identity_svc   = _make_identity_mock(verified=True, actor_id=sup_id)
    revocation_svc = _make_revocation_mock(is_revoked=True)
    svc = _make_svc(sb, identity_svc=identity_svc, revocation_svc=revocation_svc)

    result = svc.validate_pvp_signing_eligibility(
        pvp_id=pvp_id,
        supervisor_id=sup_id,
        project_id=project_id,
    )

    assert result.eligible is False
    assert "revoked" in result.reason.lower()


# ════════════════════════════════════════════════════════════════════════════
# 11. test_pvp_builder_rejects_ineligible_supervisor
# ════════════════════════════════════════════════════════════════════════════

def _make_pvp_zip(project_id: str) -> bytes:
    from apps.analytics.services.pvp_builder import _build_zip, _compute_root_hash
    import hashlib, json
    ledger_json = json.dumps([], sort_keys=True)
    art_hashes  = {"ledger.json": hashlib.sha256(ledger_json.encode()).hexdigest()}
    root_hash   = _compute_root_hash(ledger_json, art_hashes)
    manifest = {
        "pvp_format_version": "1.0",
        "ptls_version": "0.1",
        "plexus_version": "1.0.0",
        "project_id": project_id,
        "project_sealed_at": None,
        "built_at": _now().isoformat(),
        "total_events": 1,
        "final_run_event_id": str(uuid4()),
        "root_hash": root_hash,
        "artifact_hashes": art_hashes,
        "signatures": {"author": None, "supervisor": None},
        "institutional_boundary": "institutional",
        "deployment_mode": "cloud",
        "aad_version": "0.1",
        "revocation_check_url": "https://verify.plexus.science/revocation",
    }
    return _build_zip(manifest, ledger_json, {})


def _make_pvp_supabase_mock(
    pvp_id: str,
    project_id: str,
    zip_bytes: bytes,
    public_key_hex: str,
) -> MagicMock:
    """
    Build the Supabase mock that PVPBuilder needs for sign_supervisor().
    Dual mock: pvp_packages + storage + ledger_session_keys.
    """
    from apps.analytics.tests.test_pvp_builder import (
        _make_pvp_record,
        _make_ledger_with_seal,
    )

    pvp_record   = _make_pvp_record(pvp_id, project_id, "author_signed",
                                    f"pvp/{project_id}/test.pvp")
    pvp_record["author_signature"] = "existing_author_sig"
    pvp_record["project_id"]       = project_id
    ledger_rows  = _make_ledger_with_seal(project_id)

    from apps.analytics.tests.test_pvp_builder import _make_supabase_mock as _pvp_sb
    return _pvp_sb(
        project_id=project_id,
        ledger_rows=ledger_rows,
        pvp_record=pvp_record,
        zip_bytes=zip_bytes,
        public_key_hex=public_key_hex,
    )


def test_pvp_builder_rejects_ineligible_supervisor():
    """
    PVPBuilder.sign_supervisor() with an injected InstitutionalService
    raises PVPSignError when there is no signing authorisation.
    """
    _, raw_key    = _signing_key()
    project_id    = str(uuid4())
    pvp_id        = str(uuid4())
    supervisor_id = str(uuid4())
    pub_key_hex   = "e" * 64

    zip_bytes = _make_pvp_zip(project_id)
    sb        = _make_pvp_supabase_mock(pvp_id, project_id, zip_bytes, pub_key_hex)

    # InstitutionalService mock returns ineligible
    inst_svc = MagicMock()
    inst_svc.validate_pvp_signing_eligibility.return_value = EligibilityResult(
        eligible=False,
        reason="No signing authorisation found for this supervisor and project",
    )

    builder = PVPBuilder(sb, institutional_service=inst_svc)

    with pytest.raises(PVPSignError, match="No signing authorisation"):
        builder.sign_supervisor(
            pvp_id=pvp_id,
            supervisor_id=supervisor_id,
            session_key_id=str(uuid4()),
            private_key_bytes=raw_key,
        )


# ════════════════════════════════════════════════════════════════════════════
# 12. test_pvp_builder_accepts_eligible_supervisor
# ════════════════════════════════════════════════════════════════════════════

def test_pvp_builder_accepts_eligible_supervisor():
    """
    PVPBuilder.sign_supervisor() with an injected InstitutionalService
    succeeds when eligibility check returns eligible=True.
    Covers PVP Builder lines 358–386 (supervisor signing flow).
    """
    key, raw_key  = _signing_key()
    pub_key_hex   = key.verify_key.encode().hex()
    project_id    = str(uuid4())
    pvp_id        = str(uuid4())
    supervisor_id = str(uuid4())
    att_id        = str(uuid4())
    auth_id       = str(uuid4())

    zip_bytes = _make_pvp_zip(project_id)
    sb        = _make_pvp_supabase_mock(pvp_id, project_id, zip_bytes, pub_key_hex)

    # InstitutionalService mock returns eligible
    inst_svc = MagicMock()
    inst_svc.validate_pvp_signing_eligibility.return_value = EligibilityResult(
        eligible=True,
        authorisation_id=auth_id,
        verification_tier="DOMAIN_VERIFIED",
        attestation_id=att_id,
    )

    builder = PVPBuilder(sb, institutional_service=inst_svc)

    result = builder.sign_supervisor(
        pvp_id=pvp_id,
        supervisor_id=supervisor_id,
        session_key_id=str(uuid4()),
        private_key_bytes=raw_key,
    )

    assert result.status == "supervisor_signed"
    # Verify eligibility was actually checked
    inst_svc.validate_pvp_signing_eligibility.assert_called_once_with(
        pvp_id=pvp_id,
        supervisor_id=supervisor_id,
        project_id=project_id,
    )


# ════════════════════════════════════════════════════════════════════════════
# 13. test_process_departure_cascades
# ════════════════════════════════════════════════════════════════════════════

def test_process_departure_cascades():
    """
    process_departure() cascades revocations:
    - assignments_ended == 1 (one active assignment)
    - attestations_revoked == 1
    - keys_revoked == 2 (cascaded_key_revocations = 2)
    - compliance event created
    """
    inst_id    = str(uuid4())
    ws_id      = str(uuid4())
    actor_id   = str(uuid4())
    admin_id   = str(uuid4())
    att_id     = str(uuid4())
    assign_id  = str(uuid4())
    project_id = str(uuid4())
    dep_id     = str(uuid4())

    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        membership_rows=[
            _membership_row(ws_id, actor_id, "researcher"),
            _membership_row(ws_id, admin_id, "admin"),
        ],
        assignment_rows=[_assignment_row(assign_id, ws_id, str(uuid4()), actor_id)],
        attestation_rows=[_attestation_row(att_id, actor_id, inst_id)],
        project_rows=[{"id": project_id, "workspace_id": ws_id, "status": "active"}],
        insert_id=dep_id,
    )

    revocation_svc = _make_revocation_mock(cascaded_key_revocations=2)
    svc = _make_svc(sb, revocation_svc=revocation_svc)

    _, raw_key = _signing_key()
    result = svc.process_departure(
        actor_id=actor_id,
        institution_id=inst_id,
        workspace_id=ws_id,
        departed_by=admin_id,
        reason="graduated",
        signing_private_key=raw_key,
        cascade_revocations=True,
    )

    assert isinstance(result, DepartureResult)
    assert result.assignments_ended   == 1
    assert result.attestations_revoked == 1
    assert result.keys_revoked         == 2
    # Compliance event was inserted
    assert len(sb._inserted["institutional_compliance_events"]) >= 1


# ════════════════════════════════════════════════════════════════════════════
# 14. test_process_departure_ends_assignments
# ════════════════════════════════════════════════════════════════════════════

def test_process_departure_ends_assignments():
    """
    process_departure() marks all active assignments as 'ended'
    and sets ended_at.
    """
    inst_id    = str(uuid4())
    ws_id      = str(uuid4())
    actor_id   = str(uuid4())
    admin_id   = str(uuid4())
    att_id     = str(uuid4())
    assign_id  = str(uuid4())
    project_id = str(uuid4())
    dep_id     = str(uuid4())

    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        membership_rows=[
            _membership_row(ws_id, actor_id, "student"),
            _membership_row(ws_id, admin_id, "admin"),
        ],
        assignment_rows=[
            _assignment_row(assign_id, ws_id, str(uuid4()), actor_id)
        ],
        attestation_rows=[_attestation_row(att_id, actor_id, inst_id)],
        project_rows=[{"id": project_id, "workspace_id": ws_id}],
        insert_id=dep_id,
    )
    svc = _make_svc(sb)

    _, raw_key = _signing_key()
    svc.process_departure(
        actor_id=actor_id,
        institution_id=inst_id,
        workspace_id=ws_id,
        departed_by=admin_id,
        reason="resigned",
        signing_private_key=raw_key,
    )

    # The assignment update was called with status='ended' and ended_at set
    update_calls = sb._updated["supervisor_assignments"]
    assert len(update_calls) >= 1
    ended_patch = update_calls[0]
    assert ended_patch["status"]   == "ended"
    assert ended_patch["ended_at"] is not None


# ════════════════════════════════════════════════════════════════════════════
# 15. test_process_departure_no_cascade
# ════════════════════════════════════════════════════════════════════════════

def test_process_departure_no_cascade():
    """
    process_departure(cascade_revocations=False) does NOT call
    revoke_attestation and returns attestations_revoked == 0.
    """
    inst_id    = str(uuid4())
    ws_id      = str(uuid4())
    actor_id   = str(uuid4())
    admin_id   = str(uuid4())
    att_id     = str(uuid4())
    project_id = str(uuid4())
    dep_id     = str(uuid4())

    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        membership_rows=[
            _membership_row(ws_id, actor_id, "researcher"),
            _membership_row(ws_id, admin_id, "admin"),
        ],
        assignment_rows=[],
        attestation_rows=[_attestation_row(att_id, actor_id, inst_id)],
        project_rows=[{"id": project_id, "workspace_id": ws_id}],
        insert_id=dep_id,
    )
    revocation_svc = _make_revocation_mock()
    svc = _make_svc(sb, revocation_svc=revocation_svc)

    _, raw_key = _signing_key()
    result = svc.process_departure(
        actor_id=actor_id,
        institution_id=inst_id,
        workspace_id=ws_id,
        departed_by=admin_id,
        reason="transferred",
        signing_private_key=raw_key,
        cascade_revocations=False,
    )

    assert result.attestations_revoked == 0
    revocation_svc.revoke_attestation.assert_not_called()


# ════════════════════════════════════════════════════════════════════════════
# 16. test_compliance_summary_structure
# ════════════════════════════════════════════════════════════════════════════

def test_compliance_summary_structure():
    """
    get_compliance_summary() returns ComplianceSummary with all fields
    present and non-negative. active_projects == 3.
    """
    inst_id = str(uuid4())
    ws_id   = str(uuid4())

    projects = [
        {"id": str(uuid4()), "workspace_id": ws_id, "status": "active"},
        {"id": str(uuid4()), "workspace_id": ws_id, "status": "active"},
        {"id": str(uuid4()), "workspace_id": ws_id, "status": "active"},
    ]
    members = [_membership_row(ws_id, str(uuid4()), "researcher") for _ in range(5)]

    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        policy_rows=[_policy_row(str(uuid4()), inst_id, ws_id)],
        project_rows=projects,
        membership_rows=members,
        attestation_rows=[],
        compliance_event_rows=[],
        dataset_rows=[],
        quality_report_rows=[],
        pvp_rows=[],
    )
    svc = _make_svc(sb)

    summary = svc.get_compliance_summary(
        institution_id=inst_id,
        workspace_id=ws_id,
    )

    assert isinstance(summary, ComplianceSummary)
    assert summary.active_projects == 3
    assert summary.avg_dqi_score   >= 0.0
    assert summary.pvp_coverage    >= 0.0
    assert summary.active_researchers >= 0
    assert summary.open_compliance_events >= 0
    assert summary.projects_at_level_0 >= 0
    # All numeric fields must be non-negative
    for field in [
        "sealed_projects", "retracted_projects",
        "projects_below_dqi_threshold", "verified_researchers",
        "unverified_researchers", "critical_events", "warning_events",
        "projects_at_level_1", "projects_at_level_2", "projects_at_level_3",
    ]:
        assert getattr(summary, field) >= 0, f"{field} must be non-negative"


# ════════════════════════════════════════════════════════════════════════════
# 17. test_compliance_summary_dqi_threshold
# ════════════════════════════════════════════════════════════════════════════

def test_compliance_summary_dqi_threshold():
    """
    When policy min_dqi_score = 0.9 and a project has DQI = 0.75 (75/100),
    projects_below_dqi_threshold == 1.
    """
    inst_id    = str(uuid4())
    ws_id      = str(uuid4())
    project_id = str(uuid4())
    dataset_id = str(uuid4())

    projects = [{"id": project_id, "workspace_id": ws_id, "status": "active"}]
    datasets = [{"id": dataset_id, "project_id": project_id}]
    quality_reports = [{"dataset_id": dataset_id, "overall_score": 75}]  # 0.75

    sb = _make_supabase_mock(
        institution_rows=[_institution_row(inst_id)],
        workspace_rows=[_workspace_row(ws_id, inst_id)],
        policy_rows=[_policy_row(str(uuid4()), inst_id, ws_id, min_dqi_score=0.9)],
        project_rows=projects,
        membership_rows=[],
        attestation_rows=[],
        compliance_event_rows=[],
        dataset_rows=datasets,
        quality_report_rows=quality_reports,
        pvp_rows=[],
    )
    svc = _make_svc(sb)

    summary = svc.get_compliance_summary(
        institution_id=inst_id,
        workspace_id=ws_id,
    )

    assert summary.dqi_threshold == 0.9
    assert summary.projects_below_dqi_threshold == 1
    assert abs(summary.avg_dqi_score - 0.75) < 0.001


# ════════════════════════════════════════════════════════════════════════════
# 18. test_journal_boundary_blocked
# ════════════════════════════════════════════════════════════════════════════

def test_journal_boundary_blocked():
    """
    Any /api/institutional/ endpoint returns HTTP 403 when
    SERVICE_BOUNDARY=journal.
    Auth middleware is overridden so the boundary check is the first thing
    that can reject the request.
    """
    from apps.analytics.middleware.auth import get_current_user
    from apps.analytics.routers.institutional import _institutional_service

    app = FastAPI()
    app.include_router(institutional_router)

    # Override auth so boundary check is reached
    app.dependency_overrides[get_current_user]     = lambda: "test-user-id"
    app.dependency_overrides[_institutional_service] = lambda: MagicMock()

    client = TestClient(app, raise_server_exceptions=False)

    with patch.dict(os.environ, {"SERVICE_BOUNDARY": "journal"}):
        resp = client.get(
            "/api/institutional/compliance/some-workspace-id",
            params={"institution_id": str(uuid4())},
        )

    assert resp.status_code == 403
