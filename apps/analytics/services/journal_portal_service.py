"""
PLEXUS Journal Verification Portal Service.

Responsibilities:
  - Accept raw .pvp bytes from zero-auth callers (journals, public)
  - Delegate to VerificationEngine for cryptographic verification
  - Issue signed verification certificates (Ed25519, valid 90 days)
  - Cache certificates by pvp_id — re-verification re-uses existing cert
  - Log every verification request (hashed IP, timing, outcome)
  - Enforce 3-second SLA (raises JournalPortalError on breach)

Environment variables:
  PLEXUS_PORTAL_SIGNING_KEY — 64-char hex Ed25519 seed (required)
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import time
import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

import nacl.encoding
import nacl.signing

from ..models.journal_portal import (
    CertificateLookupResult,
    PortalAADFlag,
    PortalVerificationResult,
    SharedVerificationResult,
    VerificationCertificate,
)
from ..services.verification_engine import TRUST_LABELS, VerificationEngine


class JournalPortalError(Exception):
    """Raised for verification failures or service misconfiguration."""


_CERT_VALID_DAYS = 90
_SLA_MS          = 3_000   # 3-second hard SLA


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_ip(ip: str) -> str:
    """SHA-256 hash of requester IP — never stored in plaintext."""
    return hashlib.sha256(ip.encode()).hexdigest()


def _extract_root_hash(pvp_bytes: bytes) -> Optional[str]:
    """
    Pull root_hash directly from the manifest inside the ZIP.
    IntegrityResult does not expose this field, so we read it ourselves.
    """
    try:
        buf = io.BytesIO(pvp_bytes)
        with zipfile.ZipFile(buf, "r") as zf:
            manifest = json.loads(zf.read("manifest.json"))
            return str(manifest.get("root_hash", ""))
    except Exception:
        return None


def _row_to_cert(row: Dict[str, Any]) -> VerificationCertificate:
    """Convert a Supabase verification_certificates row to a model instance."""
    aad_flags = [
        PortalAADFlag(
            code=f["code"],
            name=f["name"],
            risk=f["risk"],
            triggered=f["triggered"],
        )
        for f in (row.get("aad_flags") or [])
    ]
    return VerificationCertificate(
        certificate_id=UUID(str(row["certificate_id"])),
        pvp_id=UUID(str(row["pvp_id"])),
        project_id=UUID(str(row["project_id"])),
        trust_level=int(row["trust_level"]),
        trust_label=str(row["trust_label"]),
        aad_flags=aad_flags,
        integrity_passed=bool(row["integrity_passed"]),
        root_hash=str(row["root_hash"]),
        human_readable=str(row["human_readable"]),
        portal_signature=str(row["portal_signature"]),
        issued_at=datetime.fromisoformat(str(row["issued_at"])),
        expires_at=datetime.fromisoformat(str(row["expires_at"])),
        request_id=UUID(str(row["request_id"])) if row.get("request_id") else None,
    )


# ═════════════════════════════════════════════════════════════════════════════
# JournalPortalService
# ═════════════════════════════════════════════════════════════════════════════

class JournalPortalService:

    def __init__(self, supabase_client) -> None:
        self._sb     = supabase_client
        self._engine = VerificationEngine()
        self._signing_key = self._load_signing_key()

    # ── Public API ────────────────────────────────────────────────────────────

    def verify_package(
        self,
        pvp_bytes: bytes,
        requester_ip: str,
    ) -> PortalVerificationResult:
        """
        Verify a .pvp package and return a signed certificate.

        Steps:
          1. Extract pvp_id from manifest (if parseable) for cache lookup
          2. Check certificate cache — return immediately if found
          3. Run VerificationEngine pipeline
          4. Generate + persist certificate
          5. Log request record
          6. Enforce SLA
        """
        t_start = time.monotonic()

        ip_hash = _hash_ip(requester_ip)
        pvp_id: Optional[str] = None
        root_hash: Optional[str] = None

        # ── Try to read pvp_id + root_hash from manifest ───────────────────
        try:
            buf = io.BytesIO(pvp_bytes)
            with zipfile.ZipFile(buf, "r") as zf:
                manifest = json.loads(zf.read("manifest.json"))
                pvp_id   = str(manifest.get("pvp_id") or manifest.get("project_id", ""))
                root_hash = str(manifest.get("root_hash", ""))
        except Exception:
            pass

        # ── Cache check ────────────────────────────────────────────────────
        if pvp_id:
            cached_cert = self._lookup_cert_by_pvp_id(pvp_id)
            if cached_cert is not None:
                elapsed_ms = int((time.monotonic() - t_start) * 1000)
                return PortalVerificationResult(
                    certificate=cached_cert,
                    processing_ms=elapsed_ms,
                    cached=True,
                )

        # ── Run verification engine ────────────────────────────────────────
        try:
            report = self._engine.verify(pvp_bytes, online=False)
        except Exception as exc:
            elapsed_ms = int((time.monotonic() - t_start) * 1000)
            self._log_request(
                pvp_id=pvp_id,
                ip_hash=ip_hash,
                pvp_format_version=None,
                status="error",
                trust_level=None,
                aad_flags=[],
                error_detail=str(exc),
                processing_ms=elapsed_ms,
                request_id=None,
            )
            raise JournalPortalError(f"Verification engine error: {exc}") from exc

        # ── Use root_hash from engine's manifest or our pre-extracted value ─
        if not root_hash:
            root_hash = _extract_root_hash(pvp_bytes) or ""

        # ── Generate certificate ───────────────────────────────────────────
        cert_pvp_id   = pvp_id or report.project_id or str(uuid.uuid4())
        project_id    = report.project_id or str(uuid.uuid4())
        trust_level   = report.trust.level
        trust_label   = TRUST_LABELS.get(trust_level, "Unverified")

        aad_flags = self._build_aad_flags(report)
        human_readable = self._format_human_readable(report, root_hash)

        # Sign the certificate
        canonical = self._canonical_payload(
            pvp_id=cert_pvp_id,
            project_id=project_id,
            trust_level=trust_level,
            trust_label=trust_label,
            root_hash=root_hash,
            integrity_passed=report.integrity.passed,
        )
        portal_signature = self._sign(canonical)

        now        = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=_CERT_VALID_DAYS)

        # ── Persist certificate ────────────────────────────────────────────
        cert_id = str(uuid.uuid4())
        aad_flags_json = [
            {"code": f.code, "name": f.name, "risk": f.risk, "triggered": f.triggered}
            for f in aad_flags
        ]
        cert_row = {
            "certificate_id":   cert_id,
            "pvp_id":           cert_pvp_id,
            "project_id":       project_id,
            "trust_level":      trust_level,
            "trust_label":      trust_label,
            "aad_flags":        aad_flags_json,
            "integrity_passed": report.integrity.passed,
            "root_hash":        root_hash,
            "human_readable":   human_readable,
            "portal_signature": portal_signature,
            "issued_at":        now.isoformat(),
            "expires_at":       expires_at.isoformat(),
        }
        self._sb.table("verification_certificates").insert(cert_row).execute()

        elapsed_ms = int((time.monotonic() - t_start) * 1000)

        # ── Log request ────────────────────────────────────────────────────
        request_id = self._log_request(
            pvp_id=cert_pvp_id,
            ip_hash=ip_hash,
            pvp_format_version=report.pvp_format_version,
            status="passed" if report.integrity.passed else "failed",
            trust_level=trust_level,
            aad_flags=aad_flags_json,
            error_detail=None,
            processing_ms=elapsed_ms,
            request_id=cert_id,   # link cert → request
        )

        # ── SLA enforcement ────────────────────────────────────────────────
        if elapsed_ms > _SLA_MS:
            raise JournalPortalError(
                f"Verification exceeded 3-second SLA: {elapsed_ms}ms"
            )

        certificate = VerificationCertificate(
            certificate_id=UUID(cert_id),
            pvp_id=UUID(cert_pvp_id) if self._is_valid_uuid(cert_pvp_id) else uuid.uuid4(),
            project_id=UUID(project_id) if self._is_valid_uuid(project_id) else uuid.uuid4(),
            trust_level=trust_level,
            trust_label=trust_label,
            aad_flags=aad_flags,
            integrity_passed=report.integrity.passed,
            root_hash=root_hash,
            human_readable=human_readable,
            portal_signature=portal_signature,
            issued_at=now,
            expires_at=expires_at,
            request_id=None,
        )
        return PortalVerificationResult(
            certificate=certificate,
            processing_ms=elapsed_ms,
            cached=False,
        )

    def get_certificate(self, pvp_id: str) -> CertificateLookupResult:
        """Look up a certificate by pvp_id."""
        cert = self._lookup_cert_by_pvp_id(pvp_id)
        return CertificateLookupResult(
            pvp_id=pvp_id,
            certificate=cert,
            found=cert is not None,
        )

    # ── Internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _load_signing_key() -> nacl.signing.SigningKey:
        """Load Ed25519 signing key from PLEXUS_PORTAL_SIGNING_KEY env var."""
        hex_seed = os.getenv("PLEXUS_PORTAL_SIGNING_KEY", "")
        if not hex_seed or len(hex_seed) != 64:
            raise JournalPortalError(
                "PLEXUS_PORTAL_SIGNING_KEY must be a 64-char hex Ed25519 seed"
            )
        seed_bytes = bytes.fromhex(hex_seed)
        return nacl.signing.SigningKey(seed_bytes)

    def _sign(self, payload: str) -> str:
        """Sign a canonical string and return the hex-encoded signature."""
        signed = self._signing_key.sign(payload.encode("utf-8"))
        return signed.signature.hex()

    @staticmethod
    def _canonical_payload(
        pvp_id: str,
        project_id: str,
        trust_level: int,
        trust_label: str,
        root_hash: str,
        integrity_passed: bool,
    ) -> str:
        """Deterministic JSON string for signing."""
        return json.dumps(
            {
                "pvp_id":           pvp_id,
                "project_id":       project_id,
                "trust_level":      trust_level,
                "trust_label":      trust_label,
                "root_hash":        root_hash,
                "integrity_passed": integrity_passed,
            },
            sort_keys=True,
            separators=(",", ":"),
        )

    @staticmethod
    def _build_aad_flags(report: Any) -> List[PortalAADFlag]:
        """Convert AADResult flags to portal-simplified PortalAADFlag list."""
        triggered_codes = {f.code for f in report.aad.flags}
        # All known AAD rules, whether triggered or not
        all_rules = [
            ("AAD-01", "Selective Reporting"),
            ("AAD-02", "HARKing (Hypothesising After Results Known)"),
            ("AAD-03", "P-Hacking / Specification Search"),
            ("AAD-04", "Unexplained Outlier Removal"),
            ("AAD-05", "Model Selection Gaming"),
            ("AAD-06", "Undisclosed Data Splitting"),
        ]
        result: List[PortalAADFlag] = []
        for code, name in all_rules:
            triggered = code in triggered_codes
            risk = "LOW"
            if triggered:
                matching = [f for f in report.aad.flags if f.code == code]
                if matching:
                    risk = matching[0].risk
            result.append(PortalAADFlag(code=code, name=name, risk=risk, triggered=triggered))
        return result

    @staticmethod
    def _get_submission_mode(report: Any) -> str:
        """
        Derive submission mode from verification report.
          - "institutional" if institution signature verified (R3.1=True)
          - "supervised"    if supervisor signature verified  (R2.6=True)
          - "individual"    otherwise
        """
        r2_checks = report.trust.requirements_checked.get("R2", {})
        r3_checks = report.trust.requirements_checked.get("R3", {})
        if r3_checks.get("R3.1", False):
            return "institutional"
        if r2_checks.get("R2.6", False):
            return "supervised"
        return "individual"

    @staticmethod
    def _format_human_readable(report: Any, root_hash: str) -> str:
        """Generate a plain-text verification report for humans."""
        trust_level = report.trust.level
        trust_label = TRUST_LABELS.get(trust_level, "Unverified")
        r1_checks   = report.trust.requirements_checked.get("R1", {})
        r2_checks   = report.trust.requirements_checked.get("R2", {})
        r3_checks   = report.trust.requirements_checked.get("R3", {})

        chain_status     = "PASS" if report.chain.passed else "FAIL"
        integrity_status = "PASS" if report.integrity.passed else "FAIL"

        # Summarise R1 checks
        reproducible  = r1_checks.get("R1.2", False)
        author_signed = r1_checks.get("R1.3", False)
        outputs_ok    = r1_checks.get("R1.4", False)

        # Summarise R2/R3 checks
        assumption_checks  = r2_checks.get("R2.3", False)
        dqi_ok             = r2_checks.get("R2.7", False)
        supervisor_signed  = r2_checks.get("R2.6", False)
        institution_signed = r3_checks.get("R3.1", False)

        # ── Endorsement display ───────────────────────────────────────────────
        # N/A vs ❌ is determined by whether the rule was evaluated and failed:
        #   - If R2.6 / R3.1 appears in downgrade_reasons, the sig was expected
        #     and missing → show ❌.
        #   - If the rule was never evaluated (e.g. chain/integrity failed early
        #     and R2/R3 dicts are empty), or the package simply has no supervisor
        #     assigned, → show N/A — Individual submission.
        downgrade_str = " ".join(report.trust.downgrade_reasons)
        r1_3_failed   = "R1.3" in downgrade_str   # evaluated + failed
        r2_6_failed   = "R2.6" in downgrade_str   # evaluated + failed
        r3_1_failed   = "R3.1" in downgrade_str   # evaluated + failed

        # Author signed
        if author_signed:
            auth_display = "✅"
        elif r1_3_failed:
            auth_display = "❌"
        else:
            auth_display = "N/A"   # R1 never evaluated (chain/integrity failed early)

        if supervisor_signed:
            sup_display = "✅"
        elif r2_6_failed:
            sup_display = "❌"
        else:
            sup_display = "N/A — Individual submission"

        if institution_signed:
            inst_display = "✅"
        elif r3_1_failed:
            inst_display = "❌"
        else:
            inst_display = "N/A — Individual submission"

        # submission_mode: embedded for later parsing by get_report()
        if institution_signed:
            submission_mode = "institutional"
        elif supervisor_signed:
            submission_mode = "supervised"
        else:
            submission_mode = "individual"

        # ── AAD summary ───────────────────────────────────────────────────────
        aad_risk    = report.aad.overall_risk
        aad_summary = (
            "No adversarial analysis patterns detected."
            if not report.aad.flags
            else f"{len(report.aad.flags)} potential pattern(s) detected (risk: {aad_risk})."
        )

        downgrade_text = ""
        if report.trust.downgrade_reasons:
            reasons = "\n  - ".join(report.trust.downgrade_reasons)
            downgrade_text = f"\nDowngrade reasons:\n  - {reasons}"

        lines = [
            "=" * 60,
            "PLEXUS VERIFICATION CERTIFICATE",
            "=" * 60,
            f"Project ID     : {report.project_id}",
            f"Root Hash      : {root_hash}",
            f"Verified At    : {report.verified_at.strftime('%Y-%m-%d %H:%M:%S UTC')}",
            f"SUBMISSION_MODE: {submission_mode}",
            "",
            "── INTEGRITY ──────────────────────────────────────────",
            f"Package integrity  : {integrity_status}",
            f"Hash chain         : {chain_status}",
            f"Revocation status  : {report.chain.revocation_status.upper()}",
            "",
            "── PTLS TRUST LEVEL ───────────────────────────────────",
            f"Level {trust_level}: {trust_label}",
            "",
            "── REPRODUCIBILITY CHECKS ─────────────────────────────",
            f"  Reproducible run  : {'YES' if reproducible else 'NO'}",
            f"  Author signature  : {'YES' if author_signed else 'NO'}",
            f"  Outputs recorded  : {'YES' if outputs_ok else 'NO'}",
            f"  Assumption checks : {'YES' if assumption_checks else 'NO'}",
            f"  DQI score >= 0.7  : {'YES' if dqi_ok else 'NO'}",
            downgrade_text,
            "",
            "── ENDORSEMENT ────────────────────────────────────────",
            f"  Author Signed:       {auth_display}",
            f"  Supervisor Signed:   {sup_display}",
            f"  Institution Signed:  {inst_display}",
            "",
            "── ADVERSARIAL ANALYSIS DETECTION ─────────────────────",
            f"Overall AAD risk   : {aad_risk}",
            aad_summary,
            "",
            "=" * 60,
            "This certificate was issued by the PLEXUS Journal Portal",
            "and is cryptographically signed by the portal's Ed25519 key.",
            "=" * 60,
        ]
        return "\n".join(line for line in lines)

    def get_report(self, pvp_root_hash: str) -> Optional[SharedVerificationResult]:
        """
        Look up a previously issued certificate by its root_hash and return a
        SharedVerificationResult suitable for the public verification page.

        Returns None if no certificate exists for this root_hash.
        """
        try:
            resp = (
                self._sb.table("verification_certificates")
                .select("*")
                .eq("root_hash", pvp_root_hash)
                .order("issued_at", desc=True)
                .limit(1)
                .execute()
            )
            if not resp.data:
                return None
            row = resp.data[0]
        except Exception:
            return None

        trust_level  = int(row["trust_level"])
        trust_label  = str(row["trust_label"])
        human_readable = str(row["human_readable"])
        aad_flags_raw  = row.get("aad_flags") or []

        # Derive aad_risk from triggered flags
        triggered_risks = [
            f["risk"] for f in aad_flags_raw if f.get("triggered")
        ]
        if "HIGH" in triggered_risks:
            aad_risk = "HIGH"
        elif "MEDIUM" in triggered_risks:
            aad_risk = "MEDIUM"
        else:
            aad_risk = "LOW"

        # overall_status
        if trust_level == 0:
            overall_status = "FAIL"
        elif aad_risk in ("HIGH", "MEDIUM"):
            overall_status = "REVIEW"
        else:
            overall_status = "PASS"

        # submission_mode — parse the SUBMISSION_MODE: marker embedded in human_readable
        mode_match = re.search(r"SUBMISSION_MODE:\s*(\w+)", human_readable)
        submission_mode = mode_match.group(1) if mode_match else "individual"

        # certificate_hash — SHA-256 of the certificate_id
        certificate_hash = hashlib.sha256(
            str(row["certificate_id"]).encode()
        ).hexdigest()

        base_url  = os.getenv("PLEXUS_BASE_URL", "https://plexus.science")
        share_url = f"{base_url}/verify/{pvp_root_hash}"

        return SharedVerificationResult(
            pvp_root_hash=pvp_root_hash,
            trust_level=trust_level,
            trust_label=trust_label,
            overall_status=overall_status,
            aad_risk=aad_risk,
            submission_mode=submission_mode,
            ptls_version=os.getenv("PTLS_VERSION", "0.1"),
            verified_at=datetime.fromisoformat(str(row["issued_at"])),
            valid_until=datetime.fromisoformat(str(row["expires_at"])),
            certificate_hash=certificate_hash,
            human_readable=human_readable,
            share_url=share_url,
        )

    def _lookup_cert_by_pvp_id(self, pvp_id: str) -> Optional[VerificationCertificate]:
        """Query verification_certificates table for an existing certificate."""
        try:
            resp = (
                self._sb.table("verification_certificates")
                .select("*")
                .eq("pvp_id", pvp_id)
                .limit(1)
                .execute()
            )
            if resp.data:
                return _row_to_cert(resp.data[0])
        except Exception:
            pass
        return None

    def _log_request(
        self,
        pvp_id: Optional[str],
        ip_hash: str,
        pvp_format_version: Optional[str],
        status: str,
        trust_level: Optional[int],
        aad_flags: List[Dict[str, Any]],
        error_detail: Optional[str],
        processing_ms: int,
        request_id: Optional[str],
    ) -> Optional[str]:
        """Insert a row into verification_requests. Failure is non-fatal."""
        try:
            row: Dict[str, Any] = {
                "requester_ip_hash":  ip_hash,
                "pvp_format_version": pvp_format_version,
                "verification_status": status,
                "trust_level":        trust_level,
                "aad_flags":          aad_flags,
                "error_detail":       error_detail,
                "processing_ms":      processing_ms,
            }
            if pvp_id:
                row["pvp_id"] = pvp_id
            if request_id:
                row["request_id"] = request_id
            resp = self._sb.table("verification_requests").insert(row).execute()
            if resp.data:
                return str(resp.data[0].get("request_id"))
        except Exception:
            pass
        return None

    @staticmethod
    def _is_valid_uuid(value: str) -> bool:
        try:
            UUID(value)
            return True
        except (ValueError, AttributeError):
            return False
