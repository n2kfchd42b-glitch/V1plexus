"""
PLEXUS Revocation Registry Service.

Append-only, publicly queryable service that records revoked keys,
revoked attestations, and retracted packages.

Design principles:
  - APPEND-ONLY: revocation records are never deleted or updated
  - PUBLIC READ: no auth required to query revocation status
  - AUTHENTICATED WRITE: only authorised actors may publish revocations
  - SIGNED: every revocation entry carries a cryptographic signature
  - DOES NOT REWRITE HISTORY: the ledger is never touched
"""

from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from uuid import UUID

import nacl.signing

from ..models.revocation import (
    AttestationRevocationResult,
    BulkRevocationResult,
    KeyRevocationResult,
    PackageRetractionResult,
    RevocationStatusResult,
)

_VALID_KEY_TYPES = {"session", "identity", "institution_ca"}
_VALID_KEY_REASONS = {
    "compromised",
    "actor_departed",
    "policy_violation",
    "routine_rotation",
    "institution_request",
}
_VALID_ATTESTATION_REASONS = {
    "identity_fraud",
    "affiliation_ended",
    "policy_violation",
    "institution_request",
    "actor_request",
}
_VALID_PACKAGE_REASONS = {
    "data_integrity_failure",
    "misconduct",
    "methodology_error",
    "author_request",
    "institution_request",
    "journal_request",
}


class RevocationError(Exception):
    """Raised when a revocation precondition is not met."""


class RevocationService:
    """
    Manages key revocation, attestation revocation, and package retraction.
    Reads are public; writes require a valid actor context passed by the caller.
    """

    def __init__(self, supabase_client) -> None:
        self.supabase = supabase_client

    # ── Key Revocation ────────────────────────────────────────────────────────

    def revoke_key(
        self,
        key_id: str,
        key_type: str,
        public_key: str,
        revoked_by: str,
        reason: str,
        signing_private_key: bytes,
    ) -> KeyRevocationResult:
        # STEP 1 — Validate
        if key_type not in _VALID_KEY_TYPES:
            raise RevocationError(
                f"Invalid key_type '{key_type}'. "
                f"Must be one of: {sorted(_VALID_KEY_TYPES)}"
            )
        if reason not in _VALID_KEY_REASONS:
            raise RevocationError(
                f"Invalid revocation_reason '{reason}'. "
                f"Must be one of: {sorted(_VALID_KEY_REASONS)}"
            )

        existing = (
            self.supabase.table("revoked_keys")
            .select("id")
            .eq("key_id", key_id)
            .execute()
        )
        if existing.data:
            raise RevocationError("Key already revoked")

        # STEP 2 — Authorisation check
        if not self._is_authorized_for_key(key_id, revoked_by):
            raise RevocationError("Not authorised to revoke this key")

        # STEP 3 — Build revocation payload
        now = datetime.now(timezone.utc)
        payload = {
            "key_id":     key_id,
            "key_type":   key_type,
            "public_key": public_key,
            "revoked_by": revoked_by,
            "reason":     reason,
            "revoked_at": now.isoformat(),
        }

        # STEP 4 — Sign
        signing_key = nacl.signing.SigningKey(signing_private_key)
        revocation_signature = (
            signing_key
            .sign(json.dumps(payload, sort_keys=True).encode())
            .signature.hex()
        )

        # STEP 5 — Insert revoked_keys
        row = {
            "key_id":               key_id,
            "key_type":             key_type,
            "public_key":           public_key,
            "revoked_by":           revoked_by,
            "revocation_reason":    reason,
            "revocation_signature": revocation_signature,
            "revoked_at":           now.isoformat(),
            "published_at":         now.isoformat(),
        }
        insert_result = (
            self.supabase.table("revoked_keys").insert(row).execute()
        )
        revocation_id = insert_result.data[0]["id"]

        # STEP 6 — Audit log
        self.supabase.table("revocation_audit_log").insert({
            "revocation_type": "key",
            "target_id":       key_id,
            "action":          "revoke_key",
            "performed_by":    revoked_by,
        }).execute()

        # STEP 7 — Mark key revoked in identity_key_registry
        self.supabase.table("identity_key_registry").update({
            "revoked":    True,
            "revoked_at": now.isoformat(),
        }).eq("id", key_id).execute()

        # STEP 8 — Return
        return KeyRevocationResult(
            revocation_id=UUID(revocation_id),
            key_id=UUID(key_id),
            key_type=key_type,
            reason=reason,
            revoked_at=now,
            revocation_signature=revocation_signature,
        )

    # ── Attestation Revocation ────────────────────────────────────────────────

    def revoke_attestation(
        self,
        attestation_id: str,
        actor_id: str,
        revoked_by: str,
        reason: str,
        signing_private_key: bytes,
    ) -> AttestationRevocationResult:
        # STEP 1 — Validate
        if reason not in _VALID_ATTESTATION_REASONS:
            raise RevocationError(
                f"Invalid revocation_reason '{reason}'. "
                f"Must be one of: {sorted(_VALID_ATTESTATION_REASONS)}"
            )

        att = (
            self.supabase.table("identity_attestations")
            .select("id, actor_id, institution_id")
            .eq("id", attestation_id)
            .execute()
        )
        if not att.data:
            raise RevocationError(
                f"Attestation '{attestation_id}' not found"
            )

        existing = (
            self.supabase.table("revoked_attestations")
            .select("id")
            .eq("attestation_id", attestation_id)
            .execute()
        )
        if existing.data:
            raise RevocationError("Attestation already revoked")

        # STEP 2 — Authorisation check
        if not self._is_authorized_for_attestation(actor_id, revoked_by):
            raise RevocationError(
                "Not authorised to revoke this attestation"
            )

        # STEP 3 — Build + sign payload
        now = datetime.now(timezone.utc)
        institution_id = att.data[0].get("institution_id")
        payload = {
            "attestation_id": attestation_id,
            "actor_id":       actor_id,
            "revoked_by":     revoked_by,
            "reason":         reason,
            "revoked_at":     now.isoformat(),
        }
        signing_key = nacl.signing.SigningKey(signing_private_key)
        revocation_signature = (
            signing_key
            .sign(json.dumps(payload, sort_keys=True).encode())
            .signature.hex()
        )

        # STEP 4 — Insert revoked_attestations
        row: dict = {
            "attestation_id":      attestation_id,
            "actor_id":            actor_id,
            "revoked_by":          revoked_by,
            "revocation_reason":   reason,
            "revocation_signature": revocation_signature,
            "revoked_at":          now.isoformat(),
            "published_at":        now.isoformat(),
        }
        if institution_id:
            row["institution_id"] = institution_id

        insert_result = (
            self.supabase.table("revoked_attestations").insert(row).execute()
        )
        revocation_id = insert_result.data[0]["id"]

        # STEP 5 — Audit log
        self.supabase.table("revocation_audit_log").insert({
            "revocation_type": "attestation",
            "target_id":       attestation_id,
            "action":          "revoke_attestation",
            "performed_by":    revoked_by,
        }).execute()

        # STEP 6 — Cascade: revoke all non-revoked keys for this attestation
        linked_keys = (
            self.supabase.table("identity_key_registry")
            .select("id, public_key, key_purpose")
            .eq("attestation_id", attestation_id)
            .eq("revoked", False)
            .execute()
        )
        cascaded = 0
        for key_row in (linked_keys.data or []):
            kid = key_row["id"]
            purpose = key_row.get("key_purpose", "signing")
            mapped_type = "identity" if purpose == "identity" else "session"
            try:
                self.revoke_key(
                    key_id=kid,
                    key_type=mapped_type,
                    public_key=key_row["public_key"],
                    revoked_by=revoked_by,
                    reason="institution_request",
                    signing_private_key=signing_private_key,
                )
                cascaded += 1
            except RevocationError:
                # Already revoked — skip
                pass

        # STEP 7 — Mark attestation revoked in identity_attestations
        self.supabase.table("identity_attestations").update({
            "revoked":           True,
            "revoked_at":        now.isoformat(),
            "revocation_reason": reason,
        }).eq("id", attestation_id).execute()

        # STEP 8 — Return
        return AttestationRevocationResult(
            revocation_id=UUID(revocation_id),
            attestation_id=UUID(attestation_id),
            actor_id=UUID(actor_id),
            cascaded_key_revocations=cascaded,
            reason=reason,
            revoked_at=now,
        )

    # ── Package Retraction ────────────────────────────────────────────────────

    def retract_package(
        self,
        pvp_root_hash: str,
        project_id: str,
        retracted_by: str,
        reason: str,
        note: str | None,
        signing_private_key: bytes,
    ) -> PackageRetractionResult:
        # STEP 1 — Validate
        if reason not in _VALID_PACKAGE_REASONS:
            raise RevocationError(
                f"Invalid retraction_reason '{reason}'. "
                f"Must be one of: {sorted(_VALID_PACKAGE_REASONS)}"
            )

        existing = (
            self.supabase.table("retracted_packages")
            .select("id")
            .eq("pvp_root_hash", pvp_root_hash)
            .execute()
        )
        if existing.data:
            raise RevocationError("Package already retracted")

        # STEP 2 — Authorisation check
        if not self._is_authorized_for_package(project_id, retracted_by):
            raise RevocationError(
                "Not authorised to retract this package"
            )

        # STEP 3 — Build + sign payload
        now = datetime.now(timezone.utc)
        payload = {
            "pvp_root_hash": pvp_root_hash,
            "project_id":    project_id,
            "retracted_by":  retracted_by,
            "reason":        reason,
            "retracted_at":  now.isoformat(),
        }
        signing_key = nacl.signing.SigningKey(signing_private_key)
        retraction_signature = (
            signing_key
            .sign(json.dumps(payload, sort_keys=True).encode())
            .signature.hex()
        )

        # STEP 4 — Insert retracted_packages
        row: dict = {
            "pvp_root_hash":       pvp_root_hash,
            "project_id":          project_id,
            "retracted_by":        retracted_by,
            "retraction_reason":   reason,
            "retraction_signature": retraction_signature,
            "retracted_at":        now.isoformat(),
            "published_at":        now.isoformat(),
        }
        if note:
            row["retraction_note"] = note

        insert_result = (
            self.supabase.table("retracted_packages").insert(row).execute()
        )
        retraction_id = insert_result.data[0]["id"]

        # STEP 5 — Audit log
        self.supabase.table("revocation_audit_log").insert({
            "revocation_type": "package",
            "target_id":       pvp_root_hash,
            "action":          "retract_package",
            "performed_by":    retracted_by,
        }).execute()

        # STEP 6 — Update pvp_packages status (best-effort)
        try:
            self.supabase.table("pvp_packages").update({
                "status": "retracted",
            }).eq("root_hash", pvp_root_hash).execute()
        except Exception:
            pass

        # STEP 7 — Return
        return PackageRetractionResult(
            retraction_id=UUID(retraction_id),
            pvp_root_hash=pvp_root_hash,
            project_id=UUID(project_id),
            reason=reason,
            retracted_at=now,
            retraction_signature=retraction_signature,
        )

    # ── Status Checks (public) ────────────────────────────────────────────────

    def check_key(self, key_id: str) -> RevocationStatusResult:
        result = (
            self.supabase.table("revoked_keys")
            .select("revocation_reason, revoked_at, revocation_signature")
            .eq("key_id", key_id)
            .limit(1)
            .execute()
        )
        if result.data:
            row = result.data[0]
            return RevocationStatusResult(
                revoked=True,
                revocation_type="key",
                reason=row["revocation_reason"],
                revoked_at=datetime.fromisoformat(row["revoked_at"])
                if isinstance(row["revoked_at"], str)
                else row["revoked_at"],
                revocation_signature=row["revocation_signature"],
            )
        return RevocationStatusResult(revoked=False)

    def check_attestation(
        self, attestation_id: str
    ) -> RevocationStatusResult:
        result = (
            self.supabase.table("revoked_attestations")
            .select("revocation_reason, revoked_at, revocation_signature")
            .eq("attestation_id", attestation_id)
            .limit(1)
            .execute()
        )
        if result.data:
            row = result.data[0]
            return RevocationStatusResult(
                revoked=True,
                revocation_type="attestation",
                reason=row["revocation_reason"],
                revoked_at=datetime.fromisoformat(row["revoked_at"])
                if isinstance(row["revoked_at"], str)
                else row["revoked_at"],
                revocation_signature=row["revocation_signature"],
            )
        return RevocationStatusResult(revoked=False)

    def check_package(self, pvp_root_hash: str) -> RevocationStatusResult:
        result = (
            self.supabase.table("retracted_packages")
            .select("retraction_reason, retracted_at, retraction_signature")
            .eq("pvp_root_hash", pvp_root_hash)
            .limit(1)
            .execute()
        )
        if result.data:
            row = result.data[0]
            return RevocationStatusResult(
                revoked=True,
                revocation_type="package",
                reason=row["retraction_reason"],
                revoked_at=datetime.fromisoformat(row["retracted_at"])
                if isinstance(row["retracted_at"], str)
                else row["retracted_at"],
                revocation_signature=row["retraction_signature"],
            )
        return RevocationStatusResult(revoked=False)

    def check_all(
        self,
        key_ids: list[str],
        attestation_ids: list[str],
        pvp_root_hash: str | None,
    ) -> BulkRevocationResult:
        """
        Check all keys, attestations, and the package in parallel.
        Used by the Verification Engine during online verification.
        """
        key_results:  dict[str, RevocationStatusResult] = {}
        att_results:  dict[str, RevocationStatusResult] = {}
        pkg_result:   RevocationStatusResult | None = None

        def _check_key(kid: str) -> tuple[str, RevocationStatusResult]:
            return kid, self.check_key(kid)

        def _check_att(aid: str) -> tuple[str, RevocationStatusResult]:
            return aid, self.check_attestation(aid)

        tasks: list = []
        with ThreadPoolExecutor() as pool:
            for kid in key_ids:
                tasks.append(("key", pool.submit(_check_key, kid)))
            for aid in attestation_ids:
                tasks.append(("att", pool.submit(_check_att, aid)))
            if pvp_root_hash:
                tasks.append(("pkg", pool.submit(self.check_package, pvp_root_hash)))

            for kind, future in tasks:
                result = future.result()
                if kind == "key":
                    k, v = result
                    key_results[k] = v
                elif kind == "att":
                    k, v = result
                    att_results[k] = v
                else:
                    pkg_result = result

        any_revoked = (
            any(v.revoked for v in key_results.values())
            or any(v.revoked for v in att_results.values())
            or (pkg_result is not None and pkg_result.revoked)
        )

        return BulkRevocationResult(
            any_revoked=any_revoked,
            keys=key_results,
            attestations=att_results,
            package=pkg_result,
            checked_at=datetime.now(timezone.utc),
        )

    # ── Internal auth helpers ─────────────────────────────────────────────────

    def _is_authorized_for_key(
        self, key_id: str, revoked_by: str
    ) -> bool:
        system_id = os.getenv("PLEXUS_SYSTEM_ACCOUNT_ID", "")
        if system_id and revoked_by == system_id:
            return True

        # Key ownership via identity_key_registry
        try:
            row = (
                self.supabase.table("identity_key_registry")
                .select("actor_id")
                .eq("id", key_id)
                .single()
                .execute()
            )
            if row.data and row.data.get("actor_id") == revoked_by:
                return True
        except Exception:
            pass

        return self._is_institution_admin(revoked_by)

    def _is_authorized_for_attestation(
        self, actor_id: str, revoked_by: str
    ) -> bool:
        system_id = os.getenv("PLEXUS_SYSTEM_ACCOUNT_ID", "")
        if system_id and revoked_by == system_id:
            return True
        if actor_id == revoked_by:
            return True
        return self._is_institution_admin(revoked_by)

    def _is_authorized_for_package(
        self, project_id: str, retracted_by: str
    ) -> bool:
        system_id = os.getenv("PLEXUS_SYSTEM_ACCOUNT_ID", "")
        if system_id and retracted_by == system_id:
            return True

        # Project author check
        try:
            row = (
                self.supabase.table("pvp_packages")
                .select("created_by")
                .eq("project_id", project_id)
                .limit(1)
                .execute()
            )
            if row.data and row.data[0].get("created_by") == retracted_by:
                return True
        except Exception:
            pass

        return self._is_institution_admin(retracted_by)

    def _is_institution_admin(self, actor_id: str) -> bool:
        try:
            row = (
                self.supabase.table("institution_members")
                .select("id")
                .eq("user_id", actor_id)
                .in_("role", ["admin", "owner"])
                .limit(1)
                .execute()
            )
            return bool(row.data)
        except Exception:
            return False
