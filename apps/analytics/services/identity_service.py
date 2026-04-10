"""
PLEXUS Identity Service + Managed Certificate Authority.

Binds real-world identities to cryptographic keys and establishes the
institutional trust hierarchy.

Three verification tiers:
  SELF_ATTESTED         — no institutional check; Trust Level 1 only.
  DOMAIN_VERIFIED       — email domain matches registered institution.
  OFFICIALLY_REGISTERED — institution formally registered; admin-verified.

The PLEXUS Managed CA generates an Ed25519 keypair per institution and
stores only the public key in the institutions table.  The private key is
encrypted with PLEXUS_CA_MASTER_KEY (env, never stored in code) and held
exclusively in the ca_private_keys vault table — never returned via any API.
"""

from __future__ import annotations

import base64
import json
import os
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID

import nacl.exceptions
import nacl.secret
import nacl.signing

from ..models.identity import (
    AttestationResult,
    IdentityVerificationResult,
    InstitutionResult,
    KeyLinkResult,
)

_ATTESTATION_TTL_DAYS = int(os.getenv("IDENTITY_ATTESTATION_TTL_DAYS", "365"))
_DOMAIN_RE = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
)


class IdentityError(Exception):
    """Raised when an identity operation precondition is not met."""


class IdentityService:
    """
    Manages institution registration, researcher identity attestation,
    identity verification, and session-key → identity linkage.
    """

    def __init__(self, supabase_client) -> None:
        self.supabase = supabase_client

    # ── Institution Registration ──────────────────────────────────────────────

    def register_institution(
        self,
        name: str,
        short_name: str | None,
        country: str,
        email_domain: str,
        registration_document: str | None,
        requested_tier: str = "DOMAIN_VERIFIED",
    ) -> InstitutionResult:
        """
        Register an institution with PLEXUS and generate its root CA keypair.

        Returns InstitutionResult.  The institution private key is encrypted
        and stored in ca_private_keys; it is never returned to the caller.
        """
        # ── STEP 1: Validate email domain ─────────────────────────────────
        email_domain = email_domain.lower().strip()
        if not _DOMAIN_RE.match(email_domain):
            raise IdentityError(f"Invalid email domain format: '{email_domain}'")

        existing = (
            self.supabase.table("institutions")
            .select("id")
            .eq("email_domain", email_domain)
            .execute()
        )
        if existing.data:
            raise IdentityError(
                "Institution with this domain already registered"
            )

        # ── STEP 2: Determine verification tier ───────────────────────────
        if registration_document:
            tier   = "OFFICIALLY_REGISTERED"
            active = False   # pending admin review
        else:
            tier   = "DOMAIN_VERIFIED"
            active = True

        # ── STEP 3: Generate institution root keypair (Managed CA) ────────
        inst_signing_key  = nacl.signing.SigningKey.generate()
        root_public_key   = inst_signing_key.verify_key.encode().hex()
        raw_private_bytes = bytes(inst_signing_key)

        encrypted_private = self._encrypt_ca_key(raw_private_bytes)

        # ── STEP 4: Insert institutions record ────────────────────────────
        row = {
            "name":                  name,
            "country":               country,
            "email_domain":          email_domain,
            "verification_tier":     tier,
            "root_public_key":       root_public_key,
            "plexus_managed_ca":     True,
            "active":                active,
        }
        if short_name:
            row["short_name"] = short_name
        if registration_document:
            row["registration_document"] = registration_document

        result = (
            self.supabase.table("institutions")
            .insert(row)
            .execute()
        )
        institution = result.data[0]
        institution_id = institution["id"]

        # Store encrypted private key in vault
        self.supabase.table("ca_private_keys").insert({
            "institution_id":        institution_id,
            "encrypted_private_key": encrypted_private,
            "encryption_algorithm":  "NaCl-SecretBox-XSalsa20Poly1305",
            "key_version":           1,
        }).execute()

        # ── STEP 5: Return ────────────────────────────────────────────────
        status = "pending_admin_review" if not active else "active"
        return InstitutionResult(
            institution_id=UUID(institution_id),
            name=name,
            email_domain=email_domain,
            verification_tier=tier,
            plexus_managed_ca=True,
            status=status,
            created_at=datetime.fromisoformat(
                institution.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
        )

    # ── Researcher Identity Registration ──────────────────────────────────────

    def register_researcher_identity(
        self,
        actor_id: str,
        email: str,
        institution_id: str | None,
        role: str,
        department: str | None = None,
    ) -> AttestationResult:
        """
        Register a researcher identity and issue an attestation.

        The identity private key is returned ONCE in AttestationResult.
        It is never stored server-side.  The caller must save it securely.
        """
        now      = datetime.now(timezone.utc)
        valid_to = now + timedelta(days=_ATTESTATION_TTL_DAYS)

        # ── STEP 1: Resolve verification tier ────────────────────────────
        institution: dict | None = None
        if institution_id:
            inst_result = (
                self.supabase.table("institutions")
                .select("*")
                .eq("id", institution_id)
                .single()
                .execute()
            )
            if not inst_result.data:
                raise IdentityError(f"Institution '{institution_id}' not found")
            institution = inst_result.data

            inst_tier    = institution["verification_tier"]
            email_domain = email.split("@")[-1].lower()

            if inst_tier == "OFFICIALLY_REGISTERED":
                tier        = "OFFICIALLY_REGISTERED"
                attested_by = "INSTITUTION"
            elif email_domain == institution["email_domain"].lower():
                tier        = "DOMAIN_VERIFIED"
                attested_by = "PLEXUS_CA"
            else:
                tier        = "SELF_ATTESTED"
                attested_by = "SELF"
        else:
            tier        = "SELF_ATTESTED"
            attested_by = "SELF"

        # ── STEP 2: Generate identity keypair ─────────────────────────────
        identity_signing_key  = nacl.signing.SigningKey.generate()
        identity_public_key   = identity_signing_key.verify_key.encode().hex()
        identity_private_bytes = bytes(identity_signing_key)

        # ── STEP 3: Build affiliation claim ───────────────────────────────
        claim: dict = {
            "subject_actor_id":  actor_id,
            "institution_id":    institution_id,
            "institution_name":  institution["name"] if institution else None,
            "role":              role,
            "department":        department,
            "email":             email,
            "verification_tier": tier,
            "valid_from":        now.isoformat(),
            "valid_to":          valid_to.isoformat(),
        }
        claim_canonical = json.dumps(claim, sort_keys=True)

        # ── STEP 4: Sign attestation ──────────────────────────────────────
        if attested_by in ("INSTITUTION", "PLEXUS_CA"):
            ca_signing_key = self._load_ca_signing_key(institution_id)
            try:
                attestation_signature = (
                    ca_signing_key.sign(claim_canonical.encode("utf-8")).signature.hex()
                )
            finally:
                del ca_signing_key
        else:
            # SELF — sign with the identity key just generated
            attestation_signature = (
                identity_signing_key.sign(claim_canonical.encode("utf-8")).signature.hex()
            )

        # Clear identity signing key reference after use
        del identity_signing_key

        # ── STEP 5: Store attestation + key registry ──────────────────────
        att_result = (
            self.supabase.table("identity_attestations")
            .insert({
                "actor_id":             actor_id,
                "institution_id":       institution_id,
                "identity_key":         identity_public_key,
                "verification_tier":    tier,
                "attested_by":          attested_by,
                "affiliation_claim":    claim,
                "attestation_signature": attestation_signature,
                "valid_from":           now.isoformat(),
                "valid_to":             valid_to.isoformat(),
            })
            .execute()
        )
        attestation_id = att_result.data[0]["id"]

        self.supabase.table("identity_key_registry").insert({
            "actor_id":       actor_id,
            "attestation_id": attestation_id,
            "public_key":     identity_public_key,
            "key_type":       "Ed25519",
            "key_purpose":    "identity",
            "expires_at":     valid_to.isoformat(),
        }).execute()

        # ── STEP 6: Return (private key included once) ────────────────────
        return AttestationResult(
            attestation_id=UUID(attestation_id),
            actor_id=UUID(actor_id),
            institution_id=UUID(institution_id) if institution_id else None,
            verification_tier=tier,
            attested_by=attested_by,
            identity_public_key=identity_public_key,
            valid_from=now,
            valid_to=valid_to,
            identity_private_key=base64.b64encode(identity_private_bytes).decode(),
        )

    # ── Identity Verification ─────────────────────────────────────────────────

    def verify_identity(self, actor_id: str) -> IdentityVerificationResult:
        """
        Verify the most recent active attestation for actor_id.

        Returns IdentityVerificationResult with verified=True/False and
        the identity details if verified.
        """
        _fail = lambda reason: IdentityVerificationResult(
            verified=False, reason=reason
        )

        # ── STEP 1: Fetch active attestation ─────────────────────────────
        att_result = (
            self.supabase.table("identity_attestations")
            .select("*")
            .eq("actor_id", actor_id)
            .eq("revoked", False)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not att_result.data:
            return _fail("No active attestation found")

        attestation = att_result.data[0]

        # ── STEP 2: Check expiry ──────────────────────────────────────────
        valid_to = datetime.fromisoformat(attestation["valid_to"])
        if valid_to.tzinfo is None:
            valid_to = valid_to.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > valid_to:
            return _fail("Attestation expired")

        # ── STEP 3: Verify attestation signature ──────────────────────────
        claim          = attestation["affiliation_claim"]
        claim_canonical = json.dumps(claim, sort_keys=True)
        attested_by    = attestation["attested_by"]

        try:
            if attested_by in ("PLEXUS_CA", "INSTITUTION"):
                institution_id = attestation["institution_id"]
                inst_result = (
                    self.supabase.table("institutions")
                    .select("root_public_key, active, name")
                    .eq("id", institution_id)
                    .single()
                    .execute()
                )
                if not inst_result.data:
                    return _fail("Institution not found")
                pub_key_hex = inst_result.data["root_public_key"]
            else:
                # SELF — verify against the identity key
                pub_key_hex = attestation["identity_key"]
                inst_result = None

            verify_key = nacl.signing.VerifyKey(bytes.fromhex(pub_key_hex))
            verify_key.verify(
                claim_canonical.encode("utf-8"),
                bytes.fromhex(attestation["attestation_signature"]),
            )
        except nacl.exceptions.BadSignatureError:
            return _fail("Invalid attestation signature")
        except Exception as exc:
            return _fail(f"Signature verification error: {exc}")

        # ── STEP 4: Check institution status ──────────────────────────────
        if attested_by in ("PLEXUS_CA", "INSTITUTION") and inst_result:
            institution = inst_result.data
            if not institution.get("active", True):
                return _fail("Institution no longer active")
        else:
            institution = None

        # ── STEP 5: Return ────────────────────────────────────────────────
        return IdentityVerificationResult(
            verified=True,
            actor_id=UUID(actor_id),
            institution_id=(
                UUID(attestation["institution_id"])
                if attestation.get("institution_id") else None
            ),
            institution_name=(
                institution["name"] if institution else None
            ),
            verification_tier=attestation["verification_tier"],
            role=claim.get("role"),
            valid_to=valid_to,
        )

    # ── Key Linking ───────────────────────────────────────────────────────────

    def link_signing_key_to_identity(
        self,
        actor_id: str,
        session_key_id: str,
        attestation_id: str,
    ) -> KeyLinkResult:
        """
        Link a session signing key (from KeyService) to a verified attestation.

        This creates the traversal path that the Trust Engine uses:
            session_key → identity_key_registry → identity_attestation → institution
        """
        # ── STEP 1: Confirm attestation is valid ──────────────────────────
        id_result = self.verify_identity(actor_id)
        if not id_result.verified:
            raise IdentityError(
                f"Identity verification failed: {id_result.reason}"
            )

        # ── STEP 2: Confirm session key exists and is valid ───────────────
        key_result = (
            self.supabase.table("ledger_session_keys")
            .select("public_key, revoked, expires_at")
            .eq("id", session_key_id)
            .single()
            .execute()
        )
        if not key_result.data:
            raise IdentityError(f"Session key '{session_key_id}' not found")

        key_row = key_result.data
        if key_row.get("revoked"):
            raise IdentityError(f"Session key '{session_key_id}' has been revoked")

        expires_at = datetime.fromisoformat(key_row["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            raise IdentityError(f"Session key '{session_key_id}' has expired")

        # ── STEP 3: Insert identity_key_registry (purpose=signing) ────────
        linked_at = datetime.now(timezone.utc)
        self.supabase.table("identity_key_registry").insert({
            "actor_id":       actor_id,
            "attestation_id": attestation_id,
            "public_key":     key_row["public_key"],
            "key_type":       "Ed25519",
            "key_purpose":    "signing",
            "expires_at":     key_row["expires_at"],
        }).execute()

        # Fetch the attestation's verification_tier for the result
        att_result = (
            self.supabase.table("identity_attestations")
            .select("verification_tier")
            .eq("id", attestation_id)
            .single()
            .execute()
        )
        verification_tier = (
            att_result.data["verification_tier"] if att_result.data else "SELF_ATTESTED"
        )

        # ── STEP 4: Return ────────────────────────────────────────────────
        return KeyLinkResult(
            session_key_id=UUID(session_key_id),
            attestation_id=UUID(attestation_id),
            verification_tier=verification_tier,
            linked_at=linked_at,
        )

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _encrypt_ca_key(self, raw_private_bytes: bytes) -> str:
        """
        Encrypt a 32-byte Ed25519 private key seed with PLEXUS_CA_MASTER_KEY.
        Returns base64-encoded ciphertext.  Master key is never stored; it
        must be present in the environment at call time.
        """
        master_key = self._load_master_key()
        box        = nacl.secret.SecretBox(master_key)
        encrypted  = bytes(box.encrypt(raw_private_bytes))
        return base64.b64encode(encrypted).decode()

    def _decrypt_ca_key(self, encrypted_b64: str) -> bytes:
        """Decrypt a base64-encoded SecretBox ciphertext back to the raw seed."""
        master_key = self._load_master_key()
        box        = nacl.secret.SecretBox(master_key)
        ciphertext = base64.b64decode(encrypted_b64)
        return bytes(box.decrypt(ciphertext))

    def _load_master_key(self) -> bytes:
        hex_key = os.getenv("PLEXUS_CA_MASTER_KEY", "")
        if not hex_key:
            raise IdentityError(
                "PLEXUS_CA_MASTER_KEY environment variable is not set. "
                "Generate with: python3 -c \"import os; print(os.urandom(32).hex())\""
            )
        try:
            key_bytes = bytes.fromhex(hex_key)
        except ValueError:
            raise IdentityError("PLEXUS_CA_MASTER_KEY must be a valid hex string")
        if len(key_bytes) != 32:
            raise IdentityError(
                f"PLEXUS_CA_MASTER_KEY must decode to exactly 32 bytes "
                f"(got {len(key_bytes)})"
            )
        return key_bytes

    def _load_ca_signing_key(self, institution_id: str) -> nacl.signing.SigningKey:
        """
        Load and decrypt the institution's CA private key from the vault.
        The returned SigningKey should be used immediately and then deleted
        by the caller.
        """
        vault_result = (
            self.supabase.table("ca_private_keys")
            .select("encrypted_private_key")
            .eq("institution_id", institution_id)
            .order("key_version", desc=True)
            .limit(1)
            .execute()
        )
        if not vault_result.data:
            raise IdentityError(
                f"No CA private key found for institution '{institution_id}'"
            )
        encrypted_b64 = vault_result.data[0]["encrypted_private_key"]
        raw_seed      = self._decrypt_ca_key(encrypted_b64)
        return nacl.signing.SigningKey(raw_seed)
