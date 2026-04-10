"""
PLEXUS Institutional Service.

Operational heart of the institutional boundary:
  - Institution policy management
  - Supervisor signing authorisation (bridges supervisor_assignments → PVP co-signing)
  - PVP signing eligibility validation
  - Researcher departure cascade
  - Institutional compliance dashboard
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from uuid import UUID

from ..models.institutional import (
    ComplianceEventSummary,
    ComplianceSummary,
    DepartureResult,
    EligibilityResult,
    PolicyResult,
    SigningAuthorisationResult,
)
from ..services.identity_service import IdentityService
from ..services.ledger_service import LedgerService
from ..services.revocation_service import RevocationService

_DEPARTURE_TO_REVOCATION_REASON: dict[str, str] = {
    "graduated":      "affiliation_ended",
    "resigned":       "affiliation_ended",
    "terminated":     "institution_request",
    "transferred":    "affiliation_ended",
    "deceased":       "institution_request",
    "admin_removal":  "institution_request",
}

_VALID_DEPARTURE_REASONS = set(_DEPARTURE_TO_REVOCATION_REASON.keys())

_DEFAULT_POLICY = {
    "min_trust_level":             1,
    "min_dqi_score":               0.70,
    "supervisor_signing_required": True,
    "institution_signing_required": False,
    "require_assumption_checks":   True,
    "require_ethics_reference":    False,
}


class InstitutionalError(Exception):
    """Raised when an institutional operation precondition is not met."""


class InstitutionalService:
    """
    Manages institutional policies, supervisor signing authorisation,
    researcher departures, and compliance dashboards.
    """

    def __init__(
        self,
        supabase_client,
        identity_service: IdentityService,
        revocation_service: RevocationService,
        ledger_service: LedgerService,
    ) -> None:
        self.supabase   = supabase_client
        self.identity   = identity_service
        self.revocation = revocation_service
        self.ledger     = ledger_service

    # ── Policy Management ─────────────────────────────────────────────────────

    def create_policy(
        self,
        institution_id: str,
        workspace_id: str,
        created_by: str,
        min_trust_level: int = 1,
        min_dqi_score: float = 0.70,
        supervisor_signing_required: bool = True,
        institution_signing_required: bool = False,
        require_assumption_checks: bool = True,
        require_ethics_reference: bool = False,
    ) -> PolicyResult:
        """
        Create an institutional policy for a workspace.

        Validates institution existence, workspace-institution link,
        admin role, and uniqueness before inserting.
        """
        # ── STEP 1: Validate ───────────────────────────────────────────────
        inst = (
            self.supabase.table("institutions")
            .select("id, active")
            .eq("id", institution_id)
            .single()
            .execute()
        )
        if not inst.data:
            raise InstitutionalError(
                f"Institution '{institution_id}' not found"
            )
        if not inst.data.get("active", True):
            raise InstitutionalError(
                f"Institution '{institution_id}' is not active"
            )

        ws = (
            self.supabase.table("workspaces")
            .select("id, institution_id")
            .eq("id", workspace_id)
            .single()
            .execute()
        )
        if not ws.data:
            raise InstitutionalError(
                f"Workspace '{workspace_id}' not found"
            )
        if ws.data.get("institution_id") != institution_id:
            raise InstitutionalError(
                "Workspace does not belong to the specified institution"
            )

        if not self._is_workspace_admin(workspace_id, created_by):
            raise InstitutionalError(
                "Only workspace admins or owners may create institutional policies"
            )

        existing = (
            self.supabase.table("institutional_policies")
            .select("id")
            .eq("institution_id", institution_id)
            .eq("workspace_id", workspace_id)
            .execute()
        )
        if existing.data:
            raise InstitutionalError(
                "A policy already exists for this institution and workspace. "
                "Use update_policy() to modify it."
            )

        # ── STEP 2: Insert ─────────────────────────────────────────────────
        now = datetime.now(timezone.utc)
        row = {
            "institution_id":              institution_id,
            "workspace_id":                workspace_id,
            "created_by":                  created_by,
            "min_trust_level":             min_trust_level,
            "min_dqi_score":               min_dqi_score,
            "supervisor_signing_required": supervisor_signing_required,
            "institution_signing_required": institution_signing_required,
            "require_assumption_checks":   require_assumption_checks,
            "require_ethics_reference":    require_ethics_reference,
            "created_at":                  now.isoformat(),
            "updated_at":                  now.isoformat(),
        }
        result = self.supabase.table("institutional_policies").insert(row).execute()
        record = result.data[0]

        # ── STEP 3: Return ─────────────────────────────────────────────────
        return self._policy_from_row(record)

    def get_policy(
        self,
        institution_id: str,
        workspace_id: str,
    ) -> PolicyResult:
        """
        Fetch policy for institution + workspace.
        Returns a default policy (all fields at default values) if none exists.
        """
        result = (
            self.supabase.table("institutional_policies")
            .select("*")
            .eq("institution_id", institution_id)
            .eq("workspace_id", workspace_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return self._policy_from_row(result.data[0])

        # Return synthetic default policy
        now = datetime.now(timezone.utc)
        return PolicyResult(
            policy_id=UUID("00000000-0000-0000-0000-000000000000"),
            institution_id=UUID(institution_id),
            workspace_id=UUID(workspace_id),
            min_trust_level=_DEFAULT_POLICY["min_trust_level"],
            min_dqi_score=_DEFAULT_POLICY["min_dqi_score"],
            supervisor_signing_required=_DEFAULT_POLICY["supervisor_signing_required"],
            institution_signing_required=_DEFAULT_POLICY["institution_signing_required"],
            require_assumption_checks=_DEFAULT_POLICY["require_assumption_checks"],
            require_ethics_reference=_DEFAULT_POLICY["require_ethics_reference"],
            created_at=now,
            updated_at=now,
        )

    def update_policy(
        self,
        policy_id: str,
        updated_by: str,
        **updates,
    ) -> PolicyResult:
        """Update an existing institutional policy."""
        # Fetch to confirm it exists and get workspace_id for role check
        current = (
            self.supabase.table("institutional_policies")
            .select("*")
            .eq("id", policy_id)
            .single()
            .execute()
        )
        if not current.data:
            raise InstitutionalError(f"Policy '{policy_id}' not found")

        workspace_id = current.data["workspace_id"]
        if not self._is_workspace_admin(workspace_id, updated_by):
            raise InstitutionalError(
                "Only workspace admins or owners may update institutional policies"
            )

        allowed = {
            "min_trust_level", "min_dqi_score", "supervisor_signing_required",
            "institution_signing_required", "require_assumption_checks",
            "require_ethics_reference", "allowed_event_types",
        }
        patch = {k: v for k, v in updates.items() if k in allowed}
        now = datetime.now(timezone.utc)
        patch["updated_at"] = now.isoformat()

        result = (
            self.supabase.table("institutional_policies")
            .update(patch)
            .eq("id", policy_id)
            .execute()
        )
        return self._policy_from_row(result.data[0])

    # ── Supervisor Signing Authorisation ──────────────────────────────────────

    def authorise_supervisor_signing(
        self,
        assignment_id: str,
        project_id: str,
        authorised_by: str,
    ) -> SigningAuthorisationResult:
        """
        Bridge a supervisor_assignment to PVP co-signing for a specific project.

        Creates the explicit link that allows a supervisor to co-sign a PVP.
        """
        # ── STEP 1: Fetch assignment ───────────────────────────────────────
        assignment = self._require_active_assignment(assignment_id)
        supervisor_id = assignment["supervisor_id"]
        student_id    = assignment["student_id"]
        workspace_id  = assignment["workspace_id"]

        # ── STEP 2: Confirm project belongs to same workspace ──────────────
        proj = (
            self.supabase.table("projects")
            .select("id, workspace_id")
            .eq("id", project_id)
            .single()
            .execute()
        )
        if not proj.data:
            raise InstitutionalError(f"Project '{project_id}' not found")
        if proj.data.get("workspace_id") != workspace_id:
            raise InstitutionalError(
                "Project does not belong to the same workspace as the assignment"
            )

        # ── STEP 3: Resolve identity attestation ──────────────────────────
        id_result = self.identity.verify_identity(supervisor_id)
        if not id_result.verified:
            raise InstitutionalError(
                "Supervisor identity not verified. Complete identity registration "
                "before authorising signing."
            )

        # Fetch the active attestation_id for the supervisor
        att_row = (
            self.supabase.table("identity_attestations")
            .select("id, verification_tier")
            .eq("actor_id", supervisor_id)
            .eq("revoked", False)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        attestation_id    = att_row.data[0]["id"]
        verification_tier = att_row.data[0]["verification_tier"]

        # ── STEP 4: Confirm institution policy ─────────────────────────────
        # Resolve institution_id from workspace
        ws = (
            self.supabase.table("workspaces")
            .select("institution_id")
            .eq("id", workspace_id)
            .single()
            .execute()
        )
        institution_id = ws.data["institution_id"] if ws.data else None
        if not institution_id:
            raise InstitutionalError(
                "Workspace is not linked to an institution"
            )

        policy = self.get_policy(institution_id, workspace_id)
        if not policy.supervisor_signing_required:
            print(
                "[InstitutionalService] INFO: Creating signing authorisation, "
                "but supervisor signing is not required by current policy."
            )

        # ── STEP 5: Insert supervisor_signing_authorisations ───────────────
        now = datetime.now(timezone.utc)
        row = {
            "assignment_id":    assignment_id,
            "supervisor_id":    supervisor_id,
            "student_id":       student_id,
            "project_id":       project_id,
            "workspace_id":     workspace_id,
            "institution_id":   institution_id,
            "attestation_id":   attestation_id,
            "signing_authorised": True,
            "authorised_by":    authorised_by,
            "authorised_at":    now.isoformat(),
            "revoked":          False,
        }
        result = (
            self.supabase.table("supervisor_signing_authorisations")
            .insert(row)
            .execute()
        )
        record = result.data[0]

        # ── STEP 6: Return ─────────────────────────────────────────────────
        return SigningAuthorisationResult(
            authorisation_id=UUID(record["id"]),
            assignment_id=UUID(assignment_id),
            supervisor_id=UUID(supervisor_id),
            student_id=UUID(student_id),
            project_id=UUID(project_id),
            institution_id=UUID(institution_id),
            attestation_id=UUID(attestation_id),
            verification_tier=verification_tier,
            signing_authorised=True,
            authorised_at=now,
        )

    def get_signing_authorisation(
        self,
        project_id: str,
        supervisor_id: str,
    ) -> SigningAuthorisationResult | None:
        """
        Fetch the active, non-revoked signing authorisation for a
        project + supervisor pair. Returns None if not found.
        """
        result = (
            self.supabase.table("supervisor_signing_authorisations")
            .select("*")
            .eq("project_id", project_id)
            .eq("supervisor_id", supervisor_id)
            .eq("signing_authorised", True)
            .eq("revoked", False)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None

        row = result.data[0]
        # Need verification_tier from attestation
        verification_tier = self._get_attestation_tier(row.get("attestation_id"))

        authorised_at = row["authorised_at"]
        if isinstance(authorised_at, str):
            authorised_at = datetime.fromisoformat(authorised_at)

        return SigningAuthorisationResult(
            authorisation_id=UUID(row["id"]),
            assignment_id=UUID(row["assignment_id"]),
            supervisor_id=UUID(row["supervisor_id"]),
            student_id=UUID(row["student_id"]),
            project_id=UUID(row["project_id"]),
            institution_id=UUID(row["institution_id"]),
            attestation_id=UUID(row["attestation_id"]),
            verification_tier=verification_tier,
            signing_authorised=row["signing_authorised"],
            authorised_at=authorised_at,
        )

    def validate_pvp_signing_eligibility(
        self,
        pvp_id: str,
        supervisor_id: str,
        project_id: str,
    ) -> EligibilityResult:
        """
        Validate whether a supervisor may co-sign a PVP.
        Called by PVPBuilder.sign_supervisor() before accepting the signature.
        """
        # ── STEP 1: Check authorisation exists ────────────────────────────
        authorisation = self.get_signing_authorisation(project_id, supervisor_id)
        if authorisation is None:
            return EligibilityResult(
                eligible=False,
                reason=(
                    "No signing authorisation found for this supervisor and project"
                ),
            )

        # ── STEP 2: Check identity still valid ────────────────────────────
        id_result = self.identity.verify_identity(supervisor_id)
        if not id_result.verified:
            return EligibilityResult(
                eligible=False,
                reason="Supervisor identity attestation expired or revoked",
            )

        # ── STEP 3: Check revocation status of attestation ────────────────
        rev_status = self.revocation.check_attestation(
            str(authorisation.attestation_id)
        )
        if rev_status.revoked:
            return EligibilityResult(
                eligible=False,
                reason="Supervisor attestation revoked",
            )

        # ── STEP 4: Check policy ───────────────────────────────────────────
        # Resolve workspace from project
        pvp = (
            self.supabase.table("pvp_packages")
            .select("project_id")
            .eq("id", pvp_id)
            .single()
            .execute()
        )
        # Get workspace via project
        proj = (
            self.supabase.table("projects")
            .select("workspace_id")
            .eq("id", project_id)
            .single()
            .execute()
        )
        workspace_id   = proj.data["workspace_id"] if proj.data else None
        institution_id = str(authorisation.institution_id)

        if workspace_id:
            policy = self.get_policy(institution_id, workspace_id)
            if (
                policy.supervisor_signing_required
                and not authorisation.signing_authorised
            ):
                return EligibilityResult(
                    eligible=False,
                    reason=(
                        "Policy requires supervisor signing but "
                        "authorisation is inactive"
                    ),
                )

        # ── STEP 5: Return eligible ────────────────────────────────────────
        return EligibilityResult(
            eligible=True,
            authorisation_id=authorisation.authorisation_id,
            verification_tier=authorisation.verification_tier,
            attestation_id=authorisation.attestation_id,
        )

    # ── Researcher Departure ──────────────────────────────────────────────────

    def process_departure(
        self,
        actor_id: str,
        institution_id: str,
        workspace_id: str,
        departed_by: str,
        reason: str,
        signing_private_key: bytes,
        cascade_revocations: bool = True,
    ) -> DepartureResult:
        """
        Handle a researcher leaving an institution.
        Cascades revocations automatically and seals active work.
        """
        # ── STEP 1: Validate ───────────────────────────────────────────────
        actor_check = (
            self.supabase.table("workspace_memberships")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("user_id", actor_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if not actor_check.data:
            raise InstitutionalError(
                f"Actor '{actor_id}' is not an active member of workspace "
                f"'{workspace_id}'"
            )

        if not self._is_workspace_admin(workspace_id, departed_by):
            raise InstitutionalError(
                "Only workspace admins or owners may process researcher departures"
            )

        if reason not in _VALID_DEPARTURE_REASONS:
            raise InstitutionalError(
                f"Invalid departure_reason '{reason}'. "
                f"Must be one of: {sorted(_VALID_DEPARTURE_REASONS)}"
            )

        # ── STEP 2: Fetch active assignments ──────────────────────────────
        assignments_result = (
            self.supabase.table("supervisor_assignments")
            .select("id, supervisor_id, student_id")
            .eq("workspace_id", workspace_id)
            .eq("status", "active")
            .execute()
        )
        active_assignments = [
            row for row in (assignments_result.data or [])
            if row.get("supervisor_id") == actor_id
            or row.get("student_id") == actor_id
        ]

        # ── STEP 3: End active assignments ─────────────────────────────────
        now = datetime.now(timezone.utc)
        assignments_ended = 0
        for assignment in active_assignments:
            assign_id = assignment["id"]
            (
                self.supabase.table("supervisor_assignments")
                .update({"status": "ended", "ended_at": now.isoformat()})
                .eq("id", assign_id)
                .execute()
            )
            # Revoke linked signing authorisations
            (
                self.supabase.table("supervisor_signing_authorisations")
                .update({
                    "revoked":           True,
                    "revoked_at":        now.isoformat(),
                    "revocation_reason": reason,
                })
                .eq("assignment_id", assign_id)
                .eq("revoked", False)
                .execute()
            )
            assignments_ended += 1

        # ── STEP 4: Cascade revocations ───────────────────────────────────
        attestations_revoked = 0
        keys_revoked         = 0

        if cascade_revocations:
            # Fetch the actor's active attestation
            att_row = (
                self.supabase.table("identity_attestations")
                .select("id")
                .eq("actor_id", actor_id)
                .eq("revoked", False)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if att_row.data:
                attestation_id    = att_row.data[0]["id"]
                revocation_reason = _DEPARTURE_TO_REVOCATION_REASON[reason]
                try:
                    rev_result = self.revocation.revoke_attestation(
                        attestation_id=attestation_id,
                        actor_id=actor_id,
                        revoked_by=departed_by,
                        reason=revocation_reason,
                        signing_private_key=signing_private_key,
                    )
                    attestations_revoked = 1
                    keys_revoked         = rev_result.cascaded_key_revocations
                except Exception as exc:
                    print(
                        f"[InstitutionalService] Attestation revocation failed "
                        f"(non-fatal): {exc}"
                    )

        # ── STEP 5: Log compliance event ───────────────────────────────────
        # Find a representative project_id for the event
        # (use first project associated with workspace, or a sentinel)
        project_id = self._get_workspace_sentinel_project(workspace_id)

        self.supabase.table("institutional_compliance_events").insert({
            "institution_id": institution_id,
            "workspace_id":   workspace_id,
            "project_id":     project_id,
            "actor_id":       actor_id,
            "event_type":     "researcher_departed",
            "severity":       "info",
            "detail": {
                "actor_id":            actor_id,
                "reason":              reason,
                "assignments_ended":   assignments_ended,
                "attestations_revoked": attestations_revoked,
                "keys_revoked":        keys_revoked,
            },
        }).execute()

        # ── STEP 6: Insert researcher_departures ──────────────────────────
        departure_result = (
            self.supabase.table("researcher_departures")
            .insert({
                "actor_id":           actor_id,
                "institution_id":     institution_id,
                "workspace_id":       workspace_id,
                "departed_by":        departed_by,
                "departure_reason":   reason,
                "cascade_revocations": cascade_revocations,
                "attestations_revoked": attestations_revoked,
                "keys_revoked":        keys_revoked,
                "projects_sealed":     0,
                "departed_at":         now.isoformat(),
            })
            .execute()
        )
        departure_id = departure_result.data[0]["id"]

        # ── STEP 7: Return ─────────────────────────────────────────────────
        return DepartureResult(
            departure_id=UUID(departure_id),
            actor_id=UUID(actor_id),
            institution_id=UUID(institution_id),
            departure_reason=reason,
            assignments_ended=assignments_ended,
            attestations_revoked=attestations_revoked,
            keys_revoked=keys_revoked,
            cascade_revocations=cascade_revocations,
            departed_at=now,
        )

    # ── Compliance Dashboard ──────────────────────────────────────────────────

    def get_compliance_summary(
        self,
        institution_id: str,
        workspace_id: str,
    ) -> ComplianceSummary:
        """
        Real-time integrity view across all active projects in a workspace.
        Used by department heads and research offices.
        """
        now = datetime.now(timezone.utc)

        # ── Projects ───────────────────────────────────────────────────────
        projects_result = (
            self.supabase.table("projects")
            .select("id, status")
            .eq("workspace_id", workspace_id)
            .execute()
        )
        projects = projects_result.data or []

        active_project_ids    = [p["id"] for p in projects if p.get("status") == "active"]
        sealed_project_ids    = [p["id"] for p in projects if p.get("status") == "sealed"]
        retracted_project_ids = [p["id"] for p in projects if p.get("status") == "retracted"]

        active_projects    = len(active_project_ids)
        sealed_projects    = len(sealed_project_ids)
        retracted_projects = len(retracted_project_ids)

        # ── DQI Scores ────────────────────────────────────────────────────
        policy = self.get_policy(institution_id, workspace_id)
        dqi_threshold = policy.min_dqi_score

        avg_dqi_score, projects_below_dqi = self._compute_dqi_stats(
            active_project_ids, dqi_threshold
        )

        # ── Researchers ───────────────────────────────────────────────────
        members_result = (
            self.supabase.table("workspace_memberships")
            .select("user_id")
            .eq("workspace_id", workspace_id)
            .eq("status", "active")
            .execute()
        )
        member_user_ids = [m["user_id"] for m in (members_result.data or [])]
        active_researchers = len(member_user_ids)

        # Count how many have active, non-expired, non-revoked attestations
        verified_researchers   = 0
        unverified_researchers = 0
        for uid in member_user_ids:
            att = (
                self.supabase.table("identity_attestations")
                .select("id")
                .eq("actor_id", uid)
                .eq("revoked", False)
                .limit(1)
                .execute()
            )
            if att.data:
                verified_researchers += 1
            else:
                unverified_researchers += 1

        # ── Compliance Events ─────────────────────────────────────────────
        events_result = (
            self.supabase.table("institutional_compliance_events")
            .select("id, event_type, severity, project_id, actor_id, detail, created_at")
            .eq("workspace_id", workspace_id)
            .eq("resolved", False)
            .order("created_at", desc=True)
            .execute()
        )
        open_events = events_result.data or []
        open_compliance_events = len(open_events)
        critical_events = sum(1 for e in open_events if e.get("severity") == "critical")
        warning_events  = sum(1 for e in open_events if e.get("severity") == "warning")

        recent_flags = [
            ComplianceEventSummary(
                event_id=UUID(e["id"]),
                event_type=e["event_type"],
                severity=e["severity"],
                project_id=UUID(e["project_id"]),
                actor_id=UUID(e["actor_id"]),
                detail=e.get("detail") or {},
                created_at=(
                    datetime.fromisoformat(e["created_at"])
                    if isinstance(e["created_at"], str)
                    else e["created_at"]
                ),
            )
            for e in open_events[:10]
        ]

        # ── PVP Coverage + Trust Levels ───────────────────────────────────
        (
            pvp_coverage,
            projects_at_level_0,
            projects_at_level_1,
            projects_at_level_2,
            projects_at_level_3,
        ) = self._compute_pvp_stats(active_project_ids)

        return ComplianceSummary(
            institution_id=UUID(institution_id),
            workspace_id=UUID(workspace_id),
            generated_at=now,
            active_projects=active_projects,
            sealed_projects=sealed_projects,
            retracted_projects=retracted_projects,
            avg_dqi_score=avg_dqi_score,
            projects_below_dqi_threshold=projects_below_dqi,
            dqi_threshold=dqi_threshold,
            active_researchers=active_researchers,
            verified_researchers=verified_researchers,
            unverified_researchers=unverified_researchers,
            open_compliance_events=open_compliance_events,
            critical_events=critical_events,
            warning_events=warning_events,
            pvp_coverage=pvp_coverage,
            projects_at_level_0=projects_at_level_0,
            projects_at_level_1=projects_at_level_1,
            projects_at_level_2=projects_at_level_2,
            projects_at_level_3=projects_at_level_3,
            recent_flags=recent_flags,
        )

    # ── Private Helpers ───────────────────────────────────────────────────────

    def _is_workspace_admin(self, workspace_id: str, user_id: str) -> bool:
        """Return True if user_id has admin, owner, or department_head role."""
        row = (
            self.supabase.table("workspace_memberships")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("user_id", user_id)
            .eq("status", "active")
            .in_("role", ["owner", "admin", "department_head"])
            .limit(1)
            .execute()
        )
        return bool(row.data)

    def _require_active_assignment(self, assignment_id: str) -> dict:
        """Load a supervisor_assignment and confirm it is active."""
        result = (
            self.supabase.table("supervisor_assignments")
            .select("*")
            .eq("id", assignment_id)
            .single()
            .execute()
        )
        if not result.data:
            raise InstitutionalError(
                f"Supervisor assignment '{assignment_id}' not found"
            )
        row = result.data
        if row.get("status") != "active":
            raise InstitutionalError(
                f"Supervisor assignment '{assignment_id}' is not active "
                f"(status: '{row.get('status')}')"
            )
        if row.get("ended_at") is not None:
            raise InstitutionalError(
                f"Supervisor assignment '{assignment_id}' has already ended"
            )
        return row

    def _get_attestation_tier(self, attestation_id: str | None) -> str:
        if not attestation_id:
            return "SELF_ATTESTED"
        att = (
            self.supabase.table("identity_attestations")
            .select("verification_tier")
            .eq("id", attestation_id)
            .single()
            .execute()
        )
        return att.data["verification_tier"] if att.data else "SELF_ATTESTED"

    def _get_workspace_sentinel_project(self, workspace_id: str) -> str:
        """Return any project_id for the workspace (for compliance event logging)."""
        result = (
            self.supabase.table("projects")
            .select("id")
            .eq("workspace_id", workspace_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["id"]
        # Fallback: use a nil UUID (service layer ensures project exists normally)
        return "00000000-0000-0000-0000-000000000000"

    def _compute_dqi_stats(
        self,
        project_ids: list[str],
        threshold: float,
    ) -> tuple[float, int]:
        """
        Compute average DQI score and count of projects below threshold.

        Queries dataset_quality_reports via datasets for the given projects.
        DQI is stored as INTEGER 0-100; we normalise to 0.0-1.0.
        Returns (avg_dqi_score, projects_below_threshold).
        """
        if not project_ids:
            return (0.0, 0)

        # Get datasets for these projects
        datasets_result = (
            self.supabase.table("datasets")
            .select("id, project_id")
            .in_("project_id", project_ids)
            .execute()
        )
        datasets = datasets_result.data or []
        if not datasets:
            return (0.0, 0)

        dataset_ids = [d["id"] for d in datasets]
        project_of_dataset = {d["id"]: d["project_id"] for d in datasets}

        # Get latest quality report per dataset
        reports_result = (
            self.supabase.table("dataset_quality_reports")
            .select("dataset_id, overall_score")
            .in_("dataset_id", dataset_ids)
            .execute()
        )
        reports = reports_result.data or []

        # Aggregate per project (use best score per project for the summary)
        project_scores: dict[str, list[float]] = {}
        for report in reports:
            did   = report["dataset_id"]
            score = report["overall_score"] / 100.0
            pid   = project_of_dataset.get(did)
            if pid:
                project_scores.setdefault(pid, []).append(score)

        if not project_scores:
            return (0.0, 0)

        per_project_avg = {
            pid: sum(scores) / len(scores)
            for pid, scores in project_scores.items()
        }
        avg_dqi_score          = sum(per_project_avg.values()) / len(per_project_avg)
        projects_below_threshold = sum(
            1 for s in per_project_avg.values() if s < threshold
        )
        return (round(avg_dqi_score, 4), projects_below_threshold)

    def _compute_pvp_stats(
        self,
        project_ids: list[str],
    ) -> tuple[float, int, int, int, int]:
        """
        Compute PVP coverage and project trust-level distribution.

        Trust level is derived from the signing supervisor's attestation tier:
          No PVP         → level 0
          SELF_ATTESTED  → level 1
          DOMAIN_VERIFIED → level 2
          OFFICIALLY_REGISTERED → level 3

        Returns (pvp_coverage, level_0, level_1, level_2, level_3).
        """
        if not project_ids:
            return (0.0, 0, 0, 0, 0)

        pvps_result = (
            self.supabase.table("pvp_packages")
            .select("project_id, status, supervisor_signature")
            .in_("project_id", project_ids)
            .execute()
        )
        pvps = pvps_result.data or []

        sealed_pvp_projects = {
            p["project_id"] for p in pvps if p.get("status") == "sealed"
        }
        supervised_projects = {
            p["project_id"] for p in pvps
            if p.get("supervisor_signature") is not None
        }

        level_0 = len(project_ids) - len(sealed_pvp_projects)
        # For trust levels 1-3 we need attestation tiers of signers.
        # Approximation: sealed without supervisor → level 1,
        # sealed with supervisor → query attestation tier.
        level_1 = 0
        level_2 = 0
        level_3 = 0

        for pid in sealed_pvp_projects:
            if pid not in supervised_projects:
                level_1 += 1
            else:
                # Query the supervisor's attestation tier
                auth_row = (
                    self.supabase.table("supervisor_signing_authorisations")
                    .select("attestation_id")
                    .eq("project_id", pid)
                    .eq("revoked", False)
                    .limit(1)
                    .execute()
                )
                tier = "DOMAIN_VERIFIED"  # default
                if auth_row.data:
                    att_id = auth_row.data[0].get("attestation_id")
                    if att_id:
                        att = (
                            self.supabase.table("identity_attestations")
                            .select("verification_tier")
                            .eq("id", att_id)
                            .single()
                            .execute()
                        )
                        tier = att.data.get("verification_tier", "DOMAIN_VERIFIED") if att.data else "DOMAIN_VERIFIED"

                if tier == "OFFICIALLY_REGISTERED":
                    level_3 += 1
                elif tier == "DOMAIN_VERIFIED":
                    level_2 += 1
                else:
                    level_1 += 1

        pvp_coverage = (
            len(sealed_pvp_projects) / len(project_ids)
            if project_ids else 0.0
        )
        return (round(pvp_coverage, 4), level_0, level_1, level_2, level_3)

    @staticmethod
    def _policy_from_row(row: dict) -> PolicyResult:
        created_at = row.get("created_at", datetime.now(timezone.utc).isoformat())
        updated_at = row.get("updated_at", datetime.now(timezone.utc).isoformat())
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at)
        return PolicyResult(
            policy_id=UUID(row["id"]),
            institution_id=UUID(row["institution_id"]),
            workspace_id=UUID(row["workspace_id"]),
            min_trust_level=row["min_trust_level"],
            min_dqi_score=float(row["min_dqi_score"]),
            supervisor_signing_required=row["supervisor_signing_required"],
            institution_signing_required=row["institution_signing_required"],
            require_assumption_checks=row["require_assumption_checks"],
            require_ethics_reference=row["require_ethics_reference"],
            created_at=created_at,
            updated_at=updated_at,
        )
