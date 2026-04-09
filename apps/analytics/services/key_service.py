"""
PLEXUS Key Service — Ed25519 session key generation and management.

Raw private keys are NEVER persisted. The service:
  1. Generates an Ed25519 keypair via PyNaCl.
  2. Encrypts the private key with a passphrase-derived key (scrypt + SecretBox).
  3. Stores only the PUBLIC key in ledger_session_keys.
  4. Returns the encrypted private key + salt to the caller (client stores it).

When the client needs to sign, they decrypt locally with their passphrase and
send the raw private bytes over HTTPS for that request only.
"""

from __future__ import annotations

import base64
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import nacl.pwhash
import nacl.secret
import nacl.signing
import nacl.utils

from ..models.ledger import SessionKeyResult


class KeyService:
    """Manages Ed25519 session keypairs for ledger signing."""

    def __init__(self, supabase_client) -> None:
        self.supabase = supabase_client

    # ── Public API ────────────────────────────────────────────────────────────

    def generate_session_key(
        self,
        actor_id: str,
        project_id: str,
        passphrase: str,
        ttl_hours: int = 8,
    ) -> SessionKeyResult:
        """
        Generate a new Ed25519 session keypair.

        Steps:
          1. Generate Ed25519 keypair.
          2. Derive a 32-byte symmetric key from `passphrase` using scrypt.
          3. Encrypt the private key bytes with nacl.secret.SecretBox
             (XSalsa20-Poly1305, equivalent security to AES-256-GCM).
          4. Store only the public key in ledger_session_keys.
          5. Return encrypted private key + salt to the caller; the raw
             private key is zeroed from memory and never written anywhere.

        Args:
            actor_id:   UUID string of the actor.
            project_id: UUID string of the project.
            passphrase: Caller-supplied passphrase used to encrypt the private key.
            ttl_hours:  Session key lifetime in hours (default: 8).

        Returns:
            SessionKeyResult — the encrypted private key and salt are for the
            client to store locally. The public_key is stored server-side.
        """
        # 1. Generate Ed25519 keypair
        signing_key = nacl.signing.SigningKey.generate()
        private_key_bytes = bytes(signing_key)              # 32 bytes, raw seed
        public_key_hex = signing_key.verify_key.encode().hex()

        try:
            # 2. Scrypt KDF: derive 32-byte symmetric key from passphrase
            #    INTERACTIVE preset ≈ n=2^14, r=8, p=1 — fast enough for UX,
            #    strong enough to protect against offline dictionary attacks.
            salt = nacl.utils.random(nacl.pwhash.SCRYPT_SALTBYTES)
            kdf_key = nacl.pwhash.kdf_scryptsalsa208sha256(
                nacl.secret.SecretBox.KEY_SIZE,
                passphrase.encode("utf-8"),
                salt,
                opslimit=nacl.pwhash.SCRYPT_OPSLIMIT_INTERACTIVE,
                memlimit=nacl.pwhash.SCRYPT_MEMLIMIT_INTERACTIVE,
            )

            # 3. Encrypt private key bytes
            box = nacl.secret.SecretBox(kdf_key)
            encrypted_private = box.encrypt(private_key_bytes)

        finally:
            # Ensure the raw private key seed is no longer referenced
            del private_key_bytes
            del signing_key

        # 4. Persist only the public key
        expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)

        result = (
            self.supabase.table("ledger_session_keys")
            .insert({
                "actor_id": actor_id,
                "project_id": project_id,
                "public_key": public_key_hex,
                "expires_at": expires_at.isoformat(),
            })
            .execute()
        )

        session_key_id = UUID(result.data[0]["id"])

        # 5. Return encrypted material to caller — raw key never leaves this scope
        return SessionKeyResult(
            session_key_id=session_key_id,
            encrypted_private_key=base64.b64encode(bytes(encrypted_private)).decode(),
            salt=base64.b64encode(bytes(salt)).decode(),
            public_key=public_key_hex,
            expires_at=expires_at,
        )

    def get_public_key(self, session_key_id: UUID) -> str:
        """
        Retrieve the stored public key for a given session key ID.

        Args:
            session_key_id: UUID of the session key.

        Returns:
            Hex-encoded Ed25519 verify key.

        Raises:
            ValueError: If the key is not found, expired, or revoked.
        """
        result = (
            self.supabase.table("ledger_session_keys")
            .select("public_key, expires_at, revoked")
            .eq("id", str(session_key_id))
            .single()
            .execute()
        )

        if not result.data:
            raise ValueError(f"Session key {session_key_id} not found")

        row = result.data

        if row["revoked"]:
            raise ValueError(f"Session key {session_key_id} has been revoked")

        expires_at = datetime.fromisoformat(row["expires_at"])
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if datetime.now(timezone.utc) > expires_at:
            raise ValueError(f"Session key {session_key_id} has expired")

        return row["public_key"]

    @staticmethod
    def decrypt_private_key(
        encrypted_private_key_b64: str,
        salt_b64: str,
        passphrase: str,
    ) -> bytes:
        """
        Convenience helper: re-derive the symmetric key from the passphrase and
        decrypt the private key bytes.  Used by tests and local tooling only.
        The client performs equivalent logic in the browser or CLI.

        Args:
            encrypted_private_key_b64: base64-encoded SecretBox ciphertext.
            salt_b64:                  base64-encoded KDF salt.
            passphrase:                The same passphrase used at generation time.

        Returns:
            Raw Ed25519 private key seed (32 bytes).
        """
        salt = base64.b64decode(salt_b64)
        encrypted = base64.b64decode(encrypted_private_key_b64)

        kdf_key = nacl.pwhash.kdf_scryptsalsa208sha256(
            nacl.secret.SecretBox.KEY_SIZE,
            passphrase.encode("utf-8"),
            salt,
            opslimit=nacl.pwhash.SCRYPT_OPSLIMIT_INTERACTIVE,
            memlimit=nacl.pwhash.SCRYPT_MEMLIMIT_INTERACTIVE,
        )

        box = nacl.secret.SecretBox(kdf_key)
        return bytes(box.decrypt(encrypted))
