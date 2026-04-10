"""
PLEXUS Verification Engine — four-layer cryptographic verification pipeline.

Architecture rule: STATELESS.
  - No database reads
  - No Supabase calls
  - All truth comes from the .pvp ZIP file
  - Optional revocation check via HTTP (skipped gracefully if offline)

Pipeline:
  Layer 1 — PackageIntegrityChecker   (ZIP structure + root hash)
  Layer 2 — ChainVerifier             (hash chain + Ed25519 signatures)
  Layer 3 — TrustEngine               (PTLS trust level, rule-based)
  Layer 4 — AADEngine                 (Adversarial Analysis Detection)

If Layer 1 fails → layers 2/3/4 receive stub results.
If Layer 2 fails → TrustEngine returns level 0; AAD still runs.
Layers 3 and 4 always execute if the package can be opened.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import zipfile
from datetime import datetime, timezone
from typing import Optional

import httpx
import nacl.exceptions
import nacl.signing

from ..models.verification import (
    AADFlag,
    AADResult,
    ChainResult,
    IntegrityResult,
    TrustResult,
    VerificationReport,
    VerificationSummary,
)

# ── Constants ─────────────────────────────────────────────────────────────────

GENESIS_HASH          = "0" * 64
AAD_VERSION           = os.getenv("AAD_VERSION", "0.1")
PTLS_VERSION          = os.getenv("PTLS_VERSION", "0.1")
_REVOCATION_URL       = os.getenv(
    "REVOCATION_CHECK_URL", "https://verify.plexus.science/revocation"
)
_VERIFY_TIMEOUT       = int(os.getenv("VERIFICATION_TIMEOUT_SECONDS", "30"))

TRUST_LABELS: dict[int, str] = {
    0: "Unverified",
    1: "Integrity Verified",
    2: "Methodologically Transparent",
    3: "Institutionally Verified",
}

# ── Stub results used when a layer cannot run ─────────────────────────────────

def _stub_chain(reason: str = "Layer 1 failed — cannot verify chain") -> ChainResult:
    return ChainResult(
        passed=False,
        total_events=0,
        reason=reason,
        revocation_status="unchecked",
    )


def _stub_trust(reason: str = "Package integrity failed") -> TrustResult:
    return TrustResult(
        level=0,
        flags=[],
        downgrade_reasons=[reason],
        requirements_checked={},
    )


def _stub_aad() -> AADResult:
    return AADResult(
        overall_risk="LOW",
        flags=[],
        total_runs_analysed=0,
        aad_version=AAD_VERSION,
    )


# ═════════════════════════════════════════════════════════════════════════════
# LAYER 1 — Package Integrity
# ═════════════════════════════════════════════════════════════════════════════

class PackageIntegrityChecker:
    """
    Verifies the structural and cryptographic integrity of a .pvp ZIP package.
    All truth comes from the ZIP itself — no external calls.
    """

    REQUIRED_FILES = {"manifest.json", "ledger.json", "signatures.json"}
    REQUIRED_MANIFEST_FIELDS = {
        "pvp_format_version", "ptls_version", "project_id",
        "root_hash", "total_events", "built_at",
        "institutional_boundary", "deployment_mode",
    }

    def check(self, pvp_bytes: bytes) -> IntegrityResult:
        result, _, _ = self._run(pvp_bytes)
        return result

    def check_full(
        self, pvp_bytes: bytes
    ) -> tuple[IntegrityResult, dict, list[dict]]:
        """Returns (IntegrityResult, manifest, ledger_events)."""
        return self._run(pvp_bytes)

    def _run(
        self, pvp_bytes: bytes
    ) -> tuple[IntegrityResult, dict, list[dict]]:
        _fail = lambda reason: (IntegrityResult(passed=False, reason=reason), {}, [])

        # ── Step 1: Open ZIP ───────────────────────────────────────────────
        try:
            buf = io.BytesIO(pvp_bytes)
            zf = zipfile.ZipFile(buf, "r")
        except Exception as exc:
            return _fail(f"Invalid ZIP format: {exc}")

        with zf:
            names = set(zf.namelist())

            # ── Step 2: Required files ─────────────────────────────────────
            for f in self.REQUIRED_FILES:
                if f not in names:
                    return _fail(f"Missing required file: {f}")

            # ── Step 3: Parse manifest ─────────────────────────────────────
            try:
                manifest = json.loads(zf.read("manifest.json"))
            except Exception as exc:
                return _fail(f"Cannot parse manifest.json: {exc}")

            for field in self.REQUIRED_MANIFEST_FIELDS:
                if field not in manifest:
                    return _fail(f"Malformed manifest: missing {field}")

            # ── Step 4: Artifact hashes + root hash ───────────────────────
            try:
                ledger_bytes = zf.read("ledger.json")
                ledger_str   = ledger_bytes.decode("utf-8")
                ledger       = json.loads(ledger_str)
            except Exception as exc:
                return _fail(f"Cannot parse ledger.json: {exc}")

            artifact_hashes: dict = manifest.get("artifact_hashes", {})

            for path, expected in artifact_hashes.items():
                if path == "ledger.json":
                    actual = hashlib.sha256(ledger_bytes).hexdigest()
                else:
                    # Artifacts are stored under artifacts/ prefix in the ZIP
                    zip_path = (
                        path if path.startswith("artifacts/")
                        else f"artifacts/{path}"
                    )
                    if zip_path not in names and path not in names:
                        return _fail(
                            f"Artifact hash mismatch: {path} (file not found in ZIP)"
                        )
                    actual = hashlib.sha256(
                        zf.read(zip_path if zip_path in names else path)
                    ).hexdigest()

                if actual != expected:
                    return _fail(f"Artifact hash mismatch: {path}")

            # Recompute root hash — must match manifest
            sorted_hashes = "".join(artifact_hashes[p] for p in sorted(artifact_hashes))
            recomputed = hashlib.sha256(
                (ledger_str + sorted_hashes).encode("utf-8")
            ).hexdigest()

            if recomputed != manifest["root_hash"]:
                return _fail("Root hash mismatch — package tampered")

        # ── Step 5: Return success ─────────────────────────────────────────
        return (
            IntegrityResult(
                passed=True,
                pvp_format_version=manifest.get("pvp_format_version"),
                ptls_version=manifest.get("ptls_version"),
                project_id=str(manifest.get("project_id", "")),
                total_events=manifest.get("total_events"),
                institutional_boundary=manifest.get("institutional_boundary"),
                deployment_mode=manifest.get("deployment_mode"),
            ),
            manifest,
            ledger,
        )


# ═════════════════════════════════════════════════════════════════════════════
# LAYER 2 — Chain Verification
# ═════════════════════════════════════════════════════════════════════════════

class ChainVerifier:
    """
    Verifies ledger hash chain continuity, event hash integrity, and
    Ed25519 signatures. Public keys are read from the manifest — stateless.
    """

    def verify(
        self,
        ledger: list[dict],
        manifest: dict,
        online: bool = True,
        revocation_service=None,
    ) -> ChainResult:
        if not ledger:
            return ChainResult(
                passed=True,
                total_events=0,
                revocation_status="unchecked" if not online else "clean",
            )

        # Build session_key_id → public_key_hex map from manifest signatures
        key_map: dict[str, str] = {}
        for sig in manifest.get("signatures", {}).values():
            if sig and isinstance(sig, dict):
                kid = sig.get("session_key_id")
                pk  = sig.get("public_key")
                if kid and pk:
                    key_map[kid] = pk

        # Sort by sequence_number (should already be ordered, but be safe)
        events = sorted(ledger, key=lambda e: e["sequence_number"])

        # ── Step 1 & 2: Sequence continuity + hash recomputation ──────────
        for i, event in enumerate(events):
            seq = event["sequence_number"]

            # Sequence continuity
            expected_seq = i + 1
            if seq != expected_seq:
                return ChainResult(
                    passed=False,
                    total_events=len(events),
                    first_broken_sequence=seq,
                    reason=f"Sequence gap: expected {expected_seq}, found {seq}",
                    revocation_status="unchecked",
                )

            # Previous hash linkage
            expected_prev = GENESIS_HASH if i == 0 else events[i - 1]["event_hash"]
            if event["previous_hash"] != expected_prev:
                return ChainResult(
                    passed=False,
                    total_events=len(events),
                    first_broken_sequence=seq,
                    reason=f"Chain broken at sequence {seq}: previous_hash mismatch",
                    revocation_status="unchecked",
                )

            # Hash recomputation — must use exact same formula as LedgerService
            payload_canonical = json.dumps(
                event["payload"], sort_keys=True, default=str
            )
            raw = payload_canonical + event["previous_hash"] + event["timestamp"]
            recomputed = hashlib.sha256(raw.encode("utf-8")).hexdigest()

            if recomputed != event["event_hash"]:
                return ChainResult(
                    passed=False,
                    total_events=len(events),
                    first_broken_sequence=seq,
                    reason=f"Hash mismatch at sequence {seq}",
                    revocation_status="unchecked",
                )

        # ── Step 3: Ed25519 signature verification ────────────────────────
        for event in events:
            seq      = event["sequence_number"]
            kid      = event.get("session_key_id", "")
            pub_hex  = key_map.get(str(kid))

            if not pub_hex:
                # Key not embedded in manifest — cannot verify; skip silently
                continue

            try:
                verify_key = nacl.signing.VerifyKey(bytes.fromhex(pub_hex))
                verify_key.verify(
                    event["event_hash"].encode("utf-8"),
                    bytes.fromhex(event["signature"]),
                )
            except nacl.exceptions.BadSignatureError:
                return ChainResult(
                    passed=False,
                    total_events=len(events),
                    first_broken_sequence=seq,
                    reason=f"Invalid signature at sequence {seq}",
                    revocation_status="unchecked",
                )
            except Exception as exc:
                return ChainResult(
                    passed=False,
                    total_events=len(events),
                    first_broken_sequence=seq,
                    reason=f"Signature check error at sequence {seq}: {exc}",
                    revocation_status="unchecked",
                )

        # ── Step 4: Revocation check (online only) ────────────────────────
        revocation_status = "unchecked"
        revoked_keys: list[str] = []

        if online:
            if revocation_service is not None:
                # Use injected RevocationService (preferred path)
                key_ids = [
                    str(e["session_key_id"])
                    for e in events
                    if e.get("session_key_id")
                ]
                attestation_ids: list[str] = []
                pvp_root_hash = manifest.get("root_hash")
                try:
                    bulk = revocation_service.check_all(
                        key_ids, attestation_ids, pvp_root_hash
                    )
                    if bulk.any_revoked:
                        revocation_status = "flagged"
                        revoked_keys = [
                            k for k, v in bulk.keys.items() if v.revoked
                        ]
                    else:
                        revocation_status = "clean"
                except Exception:
                    revocation_status = "unchecked"
            else:
                # Fallback: HTTP revocation endpoint (existing behaviour)
                unique_keys = {str(e.get("session_key_id", "")) for e in events}
                revocation_status = "clean"
                try:
                    with httpx.Client(timeout=min(_VERIFY_TIMEOUT, 10)) as client:
                        for kid in unique_keys:
                            if not kid:
                                continue
                            try:
                                resp = client.get(f"{_REVOCATION_URL}/{kid}")
                                if resp.status_code == 200:
                                    data = resp.json()
                                    if data.get("revoked"):
                                        revoked_keys.append(kid)
                                        revocation_status = "flagged"
                            except Exception:
                                # Individual key check failure is non-fatal
                                revocation_status = "unchecked"
                                break
                except Exception:
                    revocation_status = "unchecked"

        return ChainResult(
            passed=True,
            total_events=len(events),
            revocation_status=revocation_status,
            revoked_keys=revoked_keys,
        )


# ═════════════════════════════════════════════════════════════════════════════
# LAYER 3 — Trust Engine (PTLS)
# ═════════════════════════════════════════════════════════════════════════════

class TrustEngine:
    """
    Computes PTLS Trust Level from 0–3 using deterministic, rule-based logic.
    Pure function: same inputs always produce same output. No side effects.

    identity_service (optional): when injected, R3.1 and R2.6 are resolved via
    IdentityService.verify_identity() rather than manifest signature presence.
    All other rules are unchanged.
    """

    def __init__(self, identity_service=None) -> None:
        self._identity_svc = identity_service

    def evaluate(
        self,
        ledger: list[dict],
        manifest: dict,
        integrity: IntegrityResult,
        chain: ChainResult,
    ) -> TrustResult:
        downgrade: list[str] = []
        flags: list[str]     = []
        r3: dict[str, bool]  = {}
        r2: dict[str, bool]  = {}
        r1: dict[str, bool]  = {}

        # ── Hard failures → Level 0 immediately ───────────────────────────
        if not integrity.passed:
            return TrustResult(
                level=0,
                flags=flags,
                downgrade_reasons=["Package integrity failed"],
                requirements_checked={"R3": r3, "R2": r2, "R1": r1},
            )
        if not chain.passed:
            return TrustResult(
                level=0,
                flags=flags,
                downgrade_reasons=["Chain verification failed"],
                requirements_checked={"R3": r3, "R2": r2, "R1": r1},
            )
        if chain.revocation_status == "flagged":
            return TrustResult(
                level=0,
                flags=flags,
                downgrade_reasons=["Revoked key detected"],
                requirements_checked={"R3": r3, "R2": r2, "R1": r1},
            )

        # ── Index events by type for fast lookup ───────────────────────────
        events_by_type: dict[str, list[dict]] = {}
        for e in ledger:
            events_by_type.setdefault(e["event_type"], []).append(e)

        def get(t: str) -> list[dict]:
            return events_by_type.get(t, [])

        sigs        = manifest.get("signatures", {})
        author_sig  = sigs.get("author")
        sup_sig     = sigs.get("supervisor")
        inst_sig    = sigs.get("institution")

        runs        = get("analysis_run_completed")
        outputs     = get("output_generated") + get("figure_exported") + get("table_exported")
        checks      = get("assumption_check")
        seal_events = get("project_sealed")
        outlier_rm  = get("outlier_removed")
        outlier_fl  = get("outlier_flagged")
        models      = get("model_selected")

        # Actor-id extraction for identity-service checks (author events only)
        _author_actor_ids = {
            str(e.get("actor_id"))
            for e in ledger
            if e.get("actor_role") == "author" and e.get("actor_id")
        }
        _author_actor_id = next(iter(_author_actor_ids), None)

        # ── R3.x checks ───────────────────────────────────────────────────

        # R3.1 — Institution signature present / OFFICIALLY_REGISTERED identity
        if self._identity_svc and _author_actor_id:
            try:
                _id_r3 = self._identity_svc.verify_identity(_author_actor_id)
                r3["R3.1"] = (
                    _id_r3.verified
                    and _id_r3.verification_tier == "OFFICIALLY_REGISTERED"
                )
            except Exception:
                r3["R3.1"] = inst_sig is not None   # graceful fallback
        else:
            r3["R3.1"] = inst_sig is not None

        # R3.2 — Time anchoring present
        r3["R3.2"] = bool(
            manifest.get("timestamp_authority_token")
            or manifest.get("blockchain_anchor")
        )

        # R3.3 — Environment captured in at least one run
        def _has_env(run: dict) -> bool:
            env = run.get("payload", {}).get("environment", {})
            has_version = bool(
                env.get("python_version") or env.get("r_version")
            )
            has_packages = bool(env.get("package_versions"))
            return has_version and has_packages

        r3["R3.3"] = any(_has_env(r) for r in runs)

        # R3.4 — Full DQI history: one assumption_check per run, no DQI drop > 0.2
        r3_4 = len(checks) >= len(runs) if runs else len(checks) > 0
        if r3_4 and len(checks) >= 2:
            scores = [
                c["payload"].get("dqi_score")
                for c in sorted(checks, key=lambda e: e["sequence_number"])
                if c["payload"].get("dqi_score") is not None
            ]
            for j in range(1, len(scores)):
                if (scores[j - 1] - scores[j]) > 0.2:
                    r3_4 = False
                    break
        r3["R3.4"] = r3_4

        # R3.5 — No events after project_sealed (except further project_sealed)
        if seal_events:
            first_seal_seq = min(e["sequence_number"] for e in seal_events)
            post_seal = [
                e for e in ledger
                if e["sequence_number"] > first_seal_seq
                and e["event_type"] != "project_sealed"
            ]
            r3["R3.5"] = len(post_seal) == 0
        else:
            r3["R3.5"] = False  # No seal at all → cannot reach Level 3

        # R3.6 — All figures cryptographically bound
        artifact_hashes = manifest.get("artifact_hashes", {})
        figure_paths = [p for p in artifact_hashes if "figure" in p]
        r3["R3.6"] = len(figure_paths) > 0 or len(get("figure_exported")) == 0

        # ── R2.x checks ───────────────────────────────────────────────────

        # R2.1 — Full ledger (no truncation)
        sorted_ledger = sorted(ledger, key=lambda e: e["sequence_number"])
        r2_1 = (
            bool(sorted_ledger)
            and sorted_ledger[0]["previous_hash"] == GENESIS_HASH
            and sorted_ledger[-1]["sequence_number"] == len(sorted_ledger)
        )
        r2["R2.1"] = r2_1

        # R2.2 — All runs traceable to outputs
        r2["R2.2"] = len(outputs) >= len(runs) if runs else True

        # R2.3 — Assumption checks recorded
        r2["R2.3"] = len(checks) > 0

        # R2.4 — Outlier handling documented (removed must follow flagged)
        if outlier_rm:
            flagged_seqs = {e["sequence_number"] for e in outlier_fl}
            # For each removal, there must be a flagged event with lower seq
            r2_4 = all(
                any(fs < rm["sequence_number"] for fs in flagged_seqs)
                for rm in outlier_rm
            )
        else:
            r2_4 = True  # No outlier removal → rule vacuously satisfied
        r2["R2.4"] = r2_4

        # R2.5 — Model selection visible
        r2["R2.5"] = len(models) > 0

        # R2.6 — Author identity institution-linked
        if self._identity_svc and _author_actor_id:
            try:
                _id_r2 = self._identity_svc.verify_identity(_author_actor_id)
                r2["R2.6"] = (
                    _id_r2.verified
                    and _id_r2.verification_tier in (
                        "DOMAIN_VERIFIED", "OFFICIALLY_REGISTERED"
                    )
                )
            except Exception:
                r2["R2.6"] = bool(   # graceful fallback
                    author_sig
                    and author_sig.get("public_key")
                    and sup_sig is not None
                )
        else:
            r2["R2.6"] = bool(
                author_sig
                and author_sig.get("public_key")
                and sup_sig is not None
            )

        # R2.7 — DQI score at seal >= 0.7
        if checks:
            last_check = max(checks, key=lambda e: e["sequence_number"])
            dqi = last_check.get("payload", {}).get("dqi_score")
            r2["R2.7"] = dqi is not None and dqi >= 0.7
        else:
            r2["R2.7"] = False

        # ── R1.x checks ───────────────────────────────────────────────────

        # R1.1 — Hash chain complete
        r1["R1.1"] = chain.passed

        # R1.2 — Final run reproducible (input_dataset_hash + non-empty parameters)
        def _is_reproducible(run: dict) -> bool:
            p = run.get("payload", {})
            return bool(p.get("input_dataset_hash") and p.get("parameters"))

        r1["R1.2"] = any(_is_reproducible(r) for r in runs)

        # R1.3 — Author signature present
        r1["R1.3"] = author_sig is not None

        # R1.4 — Final outputs present
        r1["R1.4"] = len(outputs) > 0

        # ── Compute final level ────────────────────────────────────────────
        level = 3

        for rule, passed in r3.items():
            if not passed:
                level = min(level, 2)
                downgrade.append(f"{rule}: {_r3_desc(rule)}")

        for rule, passed in r2.items():
            if not passed:
                level = min(level, 1)
                downgrade.append(f"{rule}: {_r2_desc(rule)}")

        for rule, passed in r1.items():
            if not passed:
                level = 0
                downgrade.append(f"{rule}: {_r1_desc(rule)}")

        return TrustResult(
            level=level,
            flags=flags,
            downgrade_reasons=downgrade,
            requirements_checked={"R3": r3, "R2": r2, "R1": r1},
        )


def _r3_desc(rule: str) -> str:
    return {
        "R3.1": "Institution signature not present",
        "R3.2": "No time anchoring (timestamp authority or blockchain anchor)",
        "R3.3": "No analysis run has captured environment metadata",
        "R3.4": "DQI history incomplete or unexplained DQI drop > 0.2",
        "R3.5": "Events exist after project_sealed",
        "R3.6": "Figures not all cryptographically bound in artifact_hashes",
    }.get(rule, rule)


def _r2_desc(rule: str) -> str:
    return {
        "R2.1": "Ledger appears truncated (missing genesis or sequence gap)",
        "R2.2": "Not all analysis runs have traceable outputs",
        "R2.3": "No assumption checks recorded",
        "R2.4": "Outlier removed without prior outlier_flagged event",
        "R2.5": "No model_selected event recorded",
        "R2.6": "Author public key missing or supervisor signature absent",
        "R2.7": "Final DQI score < 0.7",
    }.get(rule, rule)


def _r1_desc(rule: str) -> str:
    return {
        "R1.1": "Hash chain not complete",
        "R1.2": "No reproducible analysis run (missing input_dataset_hash or parameters)",
        "R1.3": "Author signature absent",
        "R1.4": "No outputs recorded",
    }.get(rule, rule)


# ═════════════════════════════════════════════════════════════════════════════
# LAYER 4 — Adversarial Analysis Detection (AAD)
# ═════════════════════════════════════════════════════════════════════════════

class AADEngine:
    """
    Pattern-based detection of methodological red flags.
    Pure function: no ML, no side effects, no external calls.
    Every flag cites specific event IDs as evidence.
    Flags are informational — trust level is managed by TrustEngine.
    """

    def analyze(self, ledger: list[dict]) -> AADResult:
        events  = sorted(ledger, key=lambda e: e["sequence_number"])
        flags: list[AADFlag] = []

        by_type: dict[str, list[dict]] = {}
        for e in events:
            by_type.setdefault(e["event_type"], []).append(e)

        def get(t: str) -> list[dict]:
            return by_type.get(t, [])

        runs    = get("analysis_run_completed")
        outputs = get("output_generated") + get("figure_exported") + get("table_exported")

        # ── AAD-01: Selective Reporting ────────────────────────────────────
        if len(runs) >= 3:
            ratio = len(outputs) / len(runs) if runs else 1.0
            # Find runs with no subsequent output before the next run
            runs_sorted = sorted(runs, key=lambda e: e["sequence_number"])
            out_seqs    = sorted(e["sequence_number"] for e in outputs)

            runs_without_output: list[str] = []
            for i, run in enumerate(runs_sorted):
                next_run_seq = runs_sorted[i + 1]["sequence_number"] if i + 1 < len(runs_sorted) else float("inf")
                has_output = any(
                    run["sequence_number"] < s < next_run_seq for s in out_seqs
                )
                if not has_output:
                    runs_without_output.append(str(run["id"]))

            if ratio < 0.5:
                flags.append(AADFlag(
                    code="AAD-01",
                    name="Selective Reporting Risk",
                    risk="HIGH",
                    detail=f"{len(runs)} analysis runs, only {len(outputs)} produced outputs",
                    evidence=runs_without_output,
                ))
            elif len(runs) >= 5 and ratio < 0.7:
                flags.append(AADFlag(
                    code="AAD-01",
                    name="Selective Reporting Risk",
                    risk="MEDIUM",
                    detail=f"{len(runs)} analysis runs, only {len(outputs)} produced outputs ({ratio:.0%})",
                    evidence=runs_without_output,
                ))

        # ── AAD-02: Data-Dependent Outlier Removal ────────────────────────
        outlier_rm = get("outlier_removed")
        for rm_event in outlier_rm:
            rm_seq = rm_event["sequence_number"]
            # Find nearest subsequent run (within 2 events)
            nearby_runs = [
                e for e in runs
                if 0 < e["sequence_number"] - rm_seq <= 2
            ]
            for run in nearby_runs:
                payload = run.get("payload", {})
                p_val   = payload.get("p_value")
                dqi     = payload.get("dqi_score")
                crossing = (
                    (p_val is not None and p_val < 0.05)
                    or (dqi is not None and dqi > 0.15)
                )
                if crossing:
                    flags.append(AADFlag(
                        code="AAD-02",
                        name="Data-Dependent Outlier Removal",
                        risk="HIGH",
                        detail="Outlier removal preceded significance threshold crossing",
                        evidence=[str(rm_event["id"]), str(run["id"])],
                    ))
                    break

        # ── AAD-03: Post-Hoc Variable Manipulation ────────────────────────
        var_events = get("variable_encoded") + get("variable_transformed")
        if runs and var_events:
            first_run_seq = min(e["sequence_number"] for e in runs)
            post_run_vars = [
                e for e in var_events if e["sequence_number"] > first_run_seq
            ]
            if post_run_vars:
                first_run = min(runs, key=lambda e: e["sequence_number"])
                flags.append(AADFlag(
                    code="AAD-03",
                    name="Variable Change After Analysis",
                    risk="HIGH",
                    detail="Variable modification detected after first analysis run",
                    evidence=[
                        str(post_run_vars[0]["id"]),
                        str(first_run["id"]),
                    ],
                ))

        # ── AAD-04: Reverse-Engineered Assumption Checks ──────────────────
        checks = get("assumption_check")
        for run in runs:
            run_seq = run["sequence_number"]
            # Find nearest assumption_check to this run
            nearest = min(
                checks,
                key=lambda c, rs=run_seq: abs(c["sequence_number"] - rs),
                default=None,
            )
            if nearest and nearest["sequence_number"] > run_seq:
                flags.append(AADFlag(
                    code="AAD-04",
                    name="Assumption Check After Analysis",
                    risk="MEDIUM",
                    detail="Assumption check logged after analysis run — expected before",
                    evidence=[str(nearest["id"]), str(run["id"])],
                ))
                break  # One flag per project is sufficient

        # ── AAD-05: Outcome Variable Switching ────────────────────────────
        model_events = sorted(get("model_selected"), key=lambda e: e["sequence_number"])
        if len(model_events) >= 2:
            outcomes = [
                (e, e.get("payload", {}).get("outcome_variable"))
                for e in model_events
                if e.get("payload", {}).get("outcome_variable")
            ]
            for j in range(1, len(outcomes)):
                e_prev, v_prev = outcomes[j - 1]
                e_curr, v_curr = outcomes[j]
                if v_prev != v_curr:
                    flags.append(AADFlag(
                        code="AAD-05",
                        name="Primary Variable Switching",
                        risk="HIGH",
                        detail=f"Outcome variable changed from '{v_prev}' to '{v_curr}' between runs",
                        evidence=[str(e_prev["id"]), str(e_curr["id"])],
                    ))
                    break

        # ── AAD-06: Late-Stage Analysis Concentration ─────────────────────
        data_events = get("dataset_imported") + get("dataset_version_committed")
        if runs and data_events:
            all_seqs  = sorted(e["sequence_number"] for e in events)
            total_n   = len(all_seqs)
            cutoff_80 = all_seqs[int(total_n * 0.8)] if total_n > 0 else float("inf")

            data_done_at = max(e["sequence_number"] for e in data_events)
            late_runs = [
                e for e in runs
                if e["sequence_number"] > data_done_at
                and e["sequence_number"] > cutoff_80
            ]
            if len(late_runs) / len(runs) > 0.70:
                flags.append(AADFlag(
                    code="AAD-06",
                    name="Late-Stage Analysis Concentration",
                    risk="MEDIUM",
                    detail=(
                        f"Majority of analysis runs ({len(late_runs)}/{len(runs)}) "
                        "concentrated after data collection completed — possible fishing"
                    ),
                    evidence=[str(e["id"]) for e in late_runs],
                ))

        # ── Overall risk ───────────────────────────────────────────────────
        if any(f.risk == "HIGH" for f in flags):
            overall = "HIGH"
        elif any(f.risk == "MEDIUM" for f in flags):
            overall = "MEDIUM"
        else:
            overall = "LOW"

        return AADResult(
            overall_risk=overall,
            flags=flags,
            total_runs_analysed=len(runs),
            aad_version=AAD_VERSION,
        )


# ═════════════════════════════════════════════════════════════════════════════
# Orchestrator
# ═════════════════════════════════════════════════════════════════════════════

class VerificationEngine:
    """
    Executes the four-layer verification pipeline against a .pvp ZIP file.
    Stateless — accepts raw bytes, returns VerificationReport.
    """

    def verify(
        self,
        pvp_bytes: bytes,
        online: bool = True,
        revocation_service=None,
    ) -> VerificationReport:
        verified_at = datetime.now(timezone.utc)

        # ── Layer 1 ────────────────────────────────────────────────────────
        integrity, manifest, ledger = PackageIntegrityChecker().check_full(pvp_bytes)

        if not integrity.passed:
            chain  = _stub_chain()
            trust  = _stub_trust()
            aad    = _stub_aad()
            return self._report(verified_at, manifest, integrity, chain, trust, aad)

        # ── Layer 2 ────────────────────────────────────────────────────────
        chain = ChainVerifier().verify(
            ledger, manifest, online=online, revocation_service=revocation_service
        )

        # ── Layer 3 ────────────────────────────────────────────────────────
        trust = TrustEngine().evaluate(ledger, manifest, integrity, chain)

        # ── Layer 4 ────────────────────────────────────────────────────────
        aad = AADEngine().analyze(ledger)

        return self._report(verified_at, manifest, integrity, chain, trust, aad)

    # ── Private ───────────────────────────────────────────────────────────────

    @staticmethod
    def _report(
        verified_at: datetime,
        manifest: dict,
        integrity: IntegrityResult,
        chain: ChainResult,
        trust: TrustResult,
        aad: AADResult,
    ) -> VerificationReport:
        level        = trust.level
        label        = TRUST_LABELS.get(level, "Unknown")
        aad_risk     = aad.overall_risk

        if level == 0:
            overall_status = "FAIL"
        elif aad_risk == "HIGH":
            overall_status = "REVIEW"
        else:
            overall_status = "PASS"

        # Human-readable report
        i_icon  = "✅" if integrity.passed else "❌"
        c_icon  = "✅" if chain.passed else "❌"
        r_icon  = "✅" if level >= 1 else "❌"
        t_icon  = "✅" if level >= 2 else ("⚠️" if level == 1 else "❌")
        e_icon  = "✅" if level >= 3 else ("⚠️" if level >= 1 else "❌")

        flag_lines = "\n    ".join(
            f"- {f.code}: {f.name} ({f.risk})" for f in aad.flags
        ) or "None"

        dr_lines = "\n    ".join(
            f"- {r}" for r in trust.downgrade_reasons
        ) or "None"

        human = (
            f"PLEXUS TRUST LEVEL: {level} — {label}\n\n"
            f"  Integrity:        {i_icon}\n"
            f"  Chain:            {c_icon}\n"
            f"  Reproducibility:  {r_icon}\n"
            f"  Transparency:     {t_icon}\n"
            f"  Endorsement:      {e_icon}\n\n"
            f"  Adversarial Risk: {aad_risk}\n"
            f"  AAD Flags:\n    {flag_lines}\n\n"
            f"  Downgrade Reasons:\n    {dr_lines}"
        )

        summary = VerificationSummary(
            trust_level=level,
            trust_label=label,
            aad_risk=aad_risk,
            overall_status=overall_status,
            human_readable=human,
        )

        return VerificationReport(
            verified_at=verified_at,
            pvp_format_version=manifest.get("pvp_format_version", "unknown"),
            ptls_version=manifest.get("ptls_version", PTLS_VERSION),
            project_id=str(manifest.get("project_id", "")),
            institutional_boundary=manifest.get("institutional_boundary", "unknown"),
            deployment_mode=manifest.get("deployment_mode", "unknown"),
            integrity=integrity,
            chain=chain,
            trust=trust,
            aad=aad,
            summary=summary,
        )
