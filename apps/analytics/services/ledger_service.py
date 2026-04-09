"""
PLEXUS Ledger Service — append-only, Ed25519-signed cryptographic event log.

Each project maintains an independent hash chain where every event:
  - References the hash of the previous event (chain continuity).
  - Has its own SHA-256 hash computed from payload + prev_hash + timestamp.
  - Is signed with the actor's Ed25519 private key (caller provides for this
    request only; key is NEVER stored server-side).

This complements the existing audit_logs table (which tracks all system
operations) by providing a researcher-signed, sequence-numbered ledger of
analytically significant events for a project.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from uuid import UUID

import nacl.exceptions
import nacl.signing

from ..models.ledger import (
    VALID_ACTOR_ROLES,
    VALID_EVENT_TYPES,
    ChainVerificationResult,
    LedgerEvent,
)

# Genesis sentinel — the previous_hash of the very first event in a project.
GENESIS_HASH = "0" * 64


class LedgerService:
    """Append-only cryptographic ledger for PLEXUS project events."""

    def __init__(self, supabase_client) -> None:
        self.supabase = supabase_client

    # ── Public API ────────────────────────────────────────────────────────────

    def write_event(
        self,
        project_id: str,
        event_type: str,
        payload: dict,
        actor_id: str,
        actor_role: str,
        session_key_id: str,
        session_key: bytes,  # Ed25519 private key seed (32 bytes), NEVER stored
    ) -> LedgerEvent:
        """
        Append a new event to the project ledger.

        Args:
            project_id:     UUID string of the project.
            event_type:     Must be one of VALID_EVENT_TYPES.
            payload:        Arbitrary JSON-serialisable dict describing the event.
            actor_id:       UUID string of the actor.
            actor_role:     One of 'author', 'supervisor', 'institution', 'system'.
            session_key_id: UUID of the session key whose public key is stored
                            in ledger_session_keys (used for later verification).
            session_key:    Raw Ed25519 private key seed (32 bytes). Provided by
                            the caller for this call only; discarded immediately
                            after signing. Never persisted.

        Returns:
            LedgerEvent representing the newly written row.

        Raises:
            ValueError: If event_type or actor_role is invalid.
            RuntimeError: If the DB insert fails.
        """
        # ── 1. Validate inputs ─────────────────────────────────────────────
        if event_type not in VALID_EVENT_TYPES:
            raise ValueError(
                f"Invalid event_type '{event_type}'. "
                f"Valid types: {sorted(VALID_EVENT_TYPES)}"
            )
        if actor_role not in VALID_ACTOR_ROLES:
            raise ValueError(
                f"Invalid actor_role '{actor_role}'. "
                f"Valid roles: {sorted(VALID_ACTOR_ROLES)}"
            )

        # ── 2. Fetch last event to get previous_hash and sequence_number ───
        last_result = (
            self.supabase.table("ledger_events")
            .select("sequence_number, event_hash")
            .eq("project_id", project_id)
            .order("sequence_number", desc=True)
            .limit(1)
            .execute()
        )

        if last_result.data:
            previous_hash = last_result.data[0]["event_hash"]
            sequence_number = last_result.data[0]["sequence_number"] + 1
        else:
            previous_hash = GENESIS_HASH
            sequence_number = 1

        # ── 3. Compute event hash ──────────────────────────────────────────
        timestamp = datetime.now(timezone.utc)

        payload_canonical = json.dumps(payload, sort_keys=True, default=str)
        raw = payload_canonical + previous_hash + timestamp.isoformat()
        event_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()

        # ── 4. Sign the event hash with the caller-supplied private key ────
        try:
            signing_key = nacl.signing.SigningKey(session_key)
            signature_bytes = signing_key.sign(event_hash.encode("utf-8")).signature
            signature = signature_bytes.hex()
        finally:
            # Dereference the signing key as soon as signing is done
            del signing_key

        # ── 5. Insert into ledger_events ───────────────────────────────────
        row = {
            "project_id": project_id,
            "sequence_number": sequence_number,
            "event_type": event_type,
            "payload": payload,
            "previous_hash": previous_hash,
            "event_hash": event_hash,
            "signature": signature,
            "session_key_id": session_key_id,
            "actor_id": actor_id,
            "actor_role": actor_role,
            "timestamp": timestamp.isoformat(),
        }

        insert_result = (
            self.supabase.table("ledger_events")
            .insert(row)
            .execute()
        )

        if not insert_result.data:
            raise RuntimeError("Ledger insert returned no data — write may have failed")

        return self._row_to_model(insert_result.data[0])

    def verify_chain(self, project_id: str) -> ChainVerificationResult:
        """
        Verify the full hash chain and Ed25519 signatures for a project.

        For every event (in sequence order) the service:
          1. Recomputes event_hash from stored payload + previous_hash + timestamp.
          2. Checks recomputed hash matches stored event_hash.
          3. Checks previous_hash equals the prior event's event_hash
             (or GENESIS_HASH for the first event).
          4. Verifies the Ed25519 signature using the stored public key.

        Returns:
            ChainVerificationResult with pass/fail, counts, and per-event detail.
        """
        events_result = (
            self.supabase.table("ledger_events")
            .select("*")
            .eq("project_id", project_id)
            .order("sequence_number", desc=False)
            .execute()
        )

        events = events_result.data or []
        detail: list[dict] = []
        first_broken: int | None = None
        chain_valid = True

        for i, event in enumerate(events):
            seq = event["sequence_number"]
            entry: dict = {"sequence_number": seq, "checks": []}

            # Expected previous_hash
            expected_prev = GENESIS_HASH if i == 0 else events[i - 1]["event_hash"]

            # ── a. Recompute hash ──────────────────────────────────────────
            payload_canonical = json.dumps(
                event["payload"], sort_keys=True, default=str
            )
            raw = payload_canonical + event["previous_hash"] + event["timestamp"]
            recomputed_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()

            hash_ok = recomputed_hash == event["event_hash"]
            entry["checks"].append({
                "check": "hash_integrity",
                "passed": hash_ok,
                "detail": (
                    "Hash matches" if hash_ok
                    else f"Expected {recomputed_hash}, stored {event['event_hash']}"
                ),
            })

            # ── b. Chain continuity ────────────────────────────────────────
            chain_ok = event["previous_hash"] == expected_prev
            entry["checks"].append({
                "check": "chain_continuity",
                "passed": chain_ok,
                "detail": (
                    "Chain linked" if chain_ok
                    else f"previous_hash mismatch at seq {seq}"
                ),
            })

            # ── c. Ed25519 signature ───────────────────────────────────────
            sig_ok = False
            sig_detail = ""
            try:
                pub_key_result = (
                    self.supabase.table("ledger_session_keys")
                    .select("public_key, revoked, expires_at")
                    .eq("id", event["session_key_id"])
                    .single()
                    .execute()
                )
                if pub_key_result.data:
                    key_row = pub_key_result.data
                    verify_key = nacl.signing.VerifyKey(
                        bytes.fromhex(key_row["public_key"])
                    )
                    verify_key.verify(
                        event["event_hash"].encode("utf-8"),
                        bytes.fromhex(event["signature"]),
                    )
                    revoked = key_row.get("revoked", False)
                    sig_ok = not revoked
                    sig_detail = (
                        "Signature valid (key revoked — event predates revocation)"
                        if revoked else "Signature valid"
                    )
                else:
                    sig_detail = f"Session key {event['session_key_id']} not found"
            except nacl.exceptions.BadSignatureError:
                sig_detail = "Signature invalid — event may have been tampered with"
            except Exception as exc:
                sig_detail = f"Signature check error: {exc}"

            entry["checks"].append({
                "check": "signature",
                "passed": sig_ok,
                "detail": sig_detail,
            })

            entry["passed"] = hash_ok and chain_ok and sig_ok
            detail.append(entry)

            if not entry["passed"] and chain_valid:
                chain_valid = False
                first_broken = seq

        return ChainVerificationResult(
            valid=chain_valid,
            total_events=len(events),
            first_broken_sequence=first_broken,
            verification_detail=detail,
        )

    def get_project_ledger(self, project_id: str) -> list[LedgerEvent]:
        """
        Return all events for a project in chronological sequence order.

        Args:
            project_id: UUID string of the project.

        Returns:
            List of LedgerEvent, ordered by sequence_number ascending.
        """
        result = (
            self.supabase.table("ledger_events")
            .select("*")
            .eq("project_id", project_id)
            .order("sequence_number", desc=False)
            .execute()
        )

        return [self._row_to_model(row) for row in (result.data or [])]

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _row_to_model(row: dict) -> LedgerEvent:
        return LedgerEvent(
            id=UUID(row["id"]),
            project_id=UUID(row["project_id"]),
            sequence_number=row["sequence_number"],
            event_type=row["event_type"],
            payload=row["payload"],
            previous_hash=row["previous_hash"],
            event_hash=row["event_hash"],
            signature=row["signature"],
            session_key_id=UUID(row["session_key_id"]),
            actor_id=UUID(row["actor_id"]),
            actor_role=row["actor_role"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
        )
