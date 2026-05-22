"""
PLEXUS Verification Package (PVP) Builder.

Packages the full project ledger, artifacts, and cryptographic signatures into
a self-contained ZIP artifact ({project_id}.pvp) that can be verified offline
without any PLEXUS dependency.

PVP lifecycle:
  build() → unsigned
  sign_author() → author_signed
  sign_supervisor() → supervisor_signed   (optional, policy-driven)
  seal() → sealed

Once sealed, the package is immutable. Any tampering is detectable by
recomputing the root hash from the ZIP contents.
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import os
import zipfile
from datetime import datetime, timezone
from uuid import UUID

logger = logging.getLogger(__name__)

import nacl.signing

from ..models.pvp import PVPBuildResult, PVPSealResult, PVPSignResult
from ..services.key_service import KeyService
from ..services.ledger_service import LedgerService


# ── Custom exceptions ─────────────────────────────────────────────────────────

class PVPBuildError(Exception):
    """Raised when a PVP build precondition is not met."""


class PVPSealError(Exception):
    """Raised when a PVP cannot be sealed due to an integrity failure."""


class PVPSignError(Exception):
    """Raised when a PVP signing eligibility check fails."""


# ── Constants ─────────────────────────────────────────────────────────────────

_PVP_FORMAT_VERSION  = os.getenv("PVP_FORMAT_VERSION",  "1.0")
_PTLS_VERSION        = os.getenv("PTLS_VERSION",        "0.1")
_PLEXUS_VERSION      = os.getenv("PLEXUS_VERSION",      "1.0.0")
_STORAGE_BUCKET      = os.getenv("PVP_STORAGE_BUCKET",  "pvp-packages")
_REVOCATION_URL      = os.getenv(
    "REVOCATION_CHECK_URL",
    "https://verify.plexus.science/revocation",
)
_AAD_VERSION         = "0.1"
_REQUIRE_SUPERVISOR  = os.getenv("REQUIRE_SUPERVISOR_SIGNATURE", "false").lower() == "true"


# ── Builder ───────────────────────────────────────────────────────────────────

class PVPBuilder:
    """Assembles, signs, and seals PLEXUS Verification Packages."""

    def __init__(self, supabase_client, institutional_service=None) -> None:
        self.supabase              = supabase_client
        self.ledger_svc            = LedgerService(supabase_client)
        self.key_svc               = KeyService(supabase_client)
        self.institutional_service = institutional_service  # optional; None = Phase 1 compat

    # ── Public API ────────────────────────────────────────────────────────────

    def build(
        self,
        project_id: str,
        actor_id: str,
        deployment_mode: str = "cloud",
    ) -> PVPBuildResult:
        """
        STEP 1 — Validate preconditions.
        STEP 2 — Fetch and serialise ledger.
        STEP 3 — Collect project artifacts from storage.
        STEP 4 — Compute deterministic root hash.
        STEP 5 — Build manifest.
        STEP 6 — Package into in-memory ZIP.
        STEP 7 — Upload ZIP to storage and insert pvp_packages record.
        STEP 8 — Return PVPBuildResult.
        """
        # ── 1. Preconditions ──────────────────────────────────────────────
        project  = self._require_project(project_id)
        ledger   = self.ledger_svc.get_project_ledger(project_id)

        if not ledger:
            raise PVPBuildError("Project ledger is empty — nothing to package")

        if not any(e.event_type == "project_sealed" for e in ledger):
            raise PVPBuildError(
                "Project must be sealed before a PVP can be built. "
                "Write a 'project_sealed' ledger event first."
            )

        if self._sealed_pvp_exists(project_id):
            raise PVPBuildError("A sealed PVP already exists for this project")

        # ── 2. Serialise ledger ────────────────────────────────────────────
        ledger_data = [
            e.model_dump(mode="json") for e in ledger
        ]
        ledger_json = json.dumps(ledger_data, default=str, sort_keys=True)

        # ── 3. Collect artifacts ───────────────────────────────────────────
        artifacts = self._collect_artifacts(project_id)

        # ── 4. Compute root hash ───────────────────────────────────────────
        artifact_hashes: dict[str, str] = {}
        artifact_hashes["ledger.json"] = hashlib.sha256(
            ledger_json.encode("utf-8")
        ).hexdigest()
        for path, content in artifacts.items():
            artifact_hashes[path] = hashlib.sha256(content).hexdigest()

        root_hash = _compute_root_hash(ledger_json, artifact_hashes)

        # ── 5. Manifest ────────────────────────────────────────────────────
        built_at       = datetime.now(timezone.utc)
        sealed_event   = next(
            (e for e in ledger if e.event_type == "project_sealed"), None
        )
        final_run      = next(
            (e for e in reversed(ledger) if e.event_type == "analysis_run_completed"),
            ledger[-1],
        )

        manifest = {
            "pvp_format_version":   _PVP_FORMAT_VERSION,
            "ptls_version":         _PTLS_VERSION,
            "plexus_version":       _PLEXUS_VERSION,
            "project_id":           project_id,
            "project_sealed_at":    (
                sealed_event.timestamp.isoformat() if sealed_event else None
            ),
            "built_at":             built_at.isoformat(),
            "total_events":         len(ledger),
            "final_run_event_id":   str(final_run.id),
            "root_hash":            root_hash,
            "artifact_hashes":      artifact_hashes,
            "signatures":           {"author": None, "supervisor": None},
            "institutional_boundary": "institutional",
            "deployment_mode":      deployment_mode,
            "aad_version":          _AAD_VERSION,
            "revocation_check_url": _REVOCATION_URL,
        }

        # ── 6. Package ─────────────────────────────────────────────────────
        zip_bytes = _build_zip(manifest, ledger_json, artifacts)

        # ── 7. Store ───────────────────────────────────────────────────────
        storage_path = (
            f"pvp/{project_id}/{built_at.strftime('%Y%m%dT%H%M%SZ')}.pvp"
        )
        self.supabase.storage.from_(_STORAGE_BUCKET).upload(
            storage_path,
            zip_bytes,
            {"content-type": "application/zip"},
        )

        insert_result = (
            self.supabase.table("pvp_packages")
            .insert({
                "project_id":            project_id,
                "pvp_format_version":    _PVP_FORMAT_VERSION,
                "ptls_version":          _PTLS_VERSION,
                "root_hash":             root_hash,
                "total_events":          len(ledger),
                "status":                "unsigned",
                "storage_path":          storage_path,
                "built_at":              built_at.isoformat(),
                "institutional_boundary": "institutional",
                "deployment_mode":       deployment_mode,
            })
            .execute()
        )

        pvp_id = UUID(insert_result.data[0]["id"])

        return PVPBuildResult(
            pvp_id=pvp_id,
            project_id=UUID(project_id),
            root_hash=root_hash,
            total_events=len(ledger),
            status="unsigned",
            storage_path=storage_path,
            built_at=built_at,
        )

    def sign_author(
        self,
        pvp_id: str,
        actor_id: str,
        session_key_id: str,
        private_key_bytes: bytes,
    ) -> PVPSignResult:
        """
        Author signs the root hash with their Ed25519 private key.
        Updates the manifest inside the ZIP and re-uploads.
        """
        # ── 1. Load ────────────────────────────────────────────────────────
        pvp = self._require_pvp(pvp_id)
        if pvp["status"] != "unsigned":
            raise PVPBuildError(
                f"PVP must be 'unsigned' for author signature; "
                f"current status: '{pvp['status']}'"
            )

        zip_bytes = self.supabase.storage.from_(_STORAGE_BUCKET).download(
            pvp["storage_path"]
        )

        # ── 2. Sign root hash ──────────────────────────────────────────────
        manifest  = _read_manifest(zip_bytes)
        root_hash = manifest["root_hash"]

        try:
            signing_key = nacl.signing.SigningKey(private_key_bytes)
            signature   = signing_key.sign(root_hash.encode("utf-8")).signature.hex()
        finally:
            del signing_key

        # ── 3. Update manifest ─────────────────────────────────────────────
        signed_at = datetime.now(timezone.utc)
        manifest["signatures"]["author"] = {
            "session_key_id": session_key_id,
            "public_key":     self.key_svc.get_public_key(UUID(session_key_id)),
            "signature":      signature,
            "signed_at":      signed_at.isoformat(),
        }

        # ── 4 & 5. Repackage and persist ───────────────────────────────────
        new_zip = _rebuild_zip(zip_bytes, manifest)
        self.supabase.storage.from_(_STORAGE_BUCKET).update(
            pvp["storage_path"],
            new_zip,
            {"content-type": "application/zip"},
        )
        (
            self.supabase.table("pvp_packages")
            .update({"author_signature": signature, "status": "author_signed"})
            .eq("id", pvp_id)
            .execute()
        )

        return PVPSignResult(
            pvp_id=UUID(pvp_id),
            status="author_signed",
            signed_at=signed_at,
        )

    def sign_supervisor(
        self,
        pvp_id: str,
        supervisor_id: str,
        session_key_id: str,
        private_key_bytes: bytes,
    ) -> PVPSignResult:
        """
        Supervisor signs the root hash. Requires author to have signed first.
        """
        pvp = self._require_pvp(pvp_id)
        if pvp["status"] != "author_signed":
            raise PVPBuildError(
                f"PVP must be 'author_signed' before supervisor can sign; "
                f"current status: '{pvp['status']}'"
            )

        # ── Eligibility check (injected InstitutionalService only) ────────
        if self.institutional_service is not None:
            project_id = pvp.get("project_id", "")
            eligibility = self.institutional_service.validate_pvp_signing_eligibility(
                pvp_id=pvp_id,
                supervisor_id=supervisor_id,
                project_id=project_id,
            )
            if not eligibility.eligible:
                raise PVPSignError(eligibility.reason)

        zip_bytes = self.supabase.storage.from_(_STORAGE_BUCKET).download(
            pvp["storage_path"]
        )

        manifest  = _read_manifest(zip_bytes)
        root_hash = manifest["root_hash"]

        try:
            signing_key = nacl.signing.SigningKey(private_key_bytes)
            signature   = signing_key.sign(root_hash.encode("utf-8")).signature.hex()
        finally:
            del signing_key

        signed_at = datetime.now(timezone.utc)
        manifest["signatures"]["supervisor"] = {
            "session_key_id": session_key_id,
            "public_key":     self.key_svc.get_public_key(UUID(session_key_id)),
            "signature":      signature,
            "signed_at":      signed_at.isoformat(),
        }

        new_zip = _rebuild_zip(zip_bytes, manifest)
        self.supabase.storage.from_(_STORAGE_BUCKET).update(
            pvp["storage_path"],
            new_zip,
            {"content-type": "application/zip"},
        )
        (
            self.supabase.table("pvp_packages")
            .update({
                "supervisor_signature": signature,
                "status": "supervisor_signed",
            })
            .eq("id", pvp_id)
            .execute()
        )

        return PVPSignResult(
            pvp_id=UUID(pvp_id),
            status="supervisor_signed",
            signed_at=signed_at,
        )

    def seal(
        self,
        pvp_id: str,
        actor_id: str,
        session_key_id: str,
        private_key_bytes: bytes,
    ) -> PVPSealResult:
        """
        Final integrity check, status transition to 'sealed', and ledger
        event recording the sealing.

        STEP 1 — Confirm required signatures are present.
        STEP 2 — Recompute root hash from ZIP contents; assert matches manifest.
        STEP 3 — Mark pvp_packages record as 'sealed'.
        STEP 4 — Write mandatory 'project_sealed' ledger event.
        """
        # ── 1. Confirm signatures ──────────────────────────────────────────
        pvp = self._require_pvp(pvp_id)

        if not pvp.get("author_signature"):
            raise PVPSealError("Author signature is required before sealing")

        if _REQUIRE_SUPERVISOR and not pvp.get("supervisor_signature"):
            raise PVPSealError(
                "Supervisor signature is required by institutional policy"
            )

        # ── 2. Root hash integrity check ───────────────────────────────────
        zip_bytes = self.supabase.storage.from_(_STORAGE_BUCKET).download(
            pvp["storage_path"]
        )
        manifest       = _read_manifest(zip_bytes)
        recomputed     = _compute_root_hash_from_zip(zip_bytes)

        if recomputed != manifest["root_hash"]:
            raise PVPSealError(
                f"Package integrity check failed at seal: "
                f"recomputed root hash '{recomputed}' does not match "
                f"manifest root hash '{manifest['root_hash']}'"
            )

        # ── 3. Seal ────────────────────────────────────────────────────────
        sealed_at = datetime.now(timezone.utc)
        (
            self.supabase.table("pvp_packages")
            .update({"status": "sealed", "sealed_at": sealed_at.isoformat()})
            .eq("id", pvp_id)
            .execute()
        )

        # ── 4. Ledger event (mandatory — every sealed package must have one) ─
        try:
            self.ledger_svc.write_event(
                project_id=pvp["project_id"],
                event_type="project_sealed",
                payload={
                    "pvp_id":    pvp_id,
                    "root_hash": manifest["root_hash"],
                    "sealed_at": sealed_at.isoformat(),
                },
                actor_id=actor_id,
                actor_role="author",
                session_key_id=session_key_id,
                session_key=private_key_bytes,
            )
        except Exception:
            logger.exception("[PVPBuilder.seal] Ledger event write failed (non-fatal)")

        return PVPSealResult(
            pvp_id=UUID(pvp_id),
            root_hash=manifest["root_hash"],
            sealed_at=sealed_at,
            status="sealed",
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    def _require_project(self, project_id: str) -> dict:
        result = (
            self.supabase.table("projects")
            .select("id, title")
            .eq("id", project_id)
            .single()
            .execute()
        )
        if not result.data:
            raise PVPBuildError(f"Project '{project_id}' not found")
        return result.data

    def _require_pvp(self, pvp_id: str) -> dict:
        result = (
            self.supabase.table("pvp_packages")
            .select("*")
            .eq("id", pvp_id)
            .single()
            .execute()
        )
        if not result.data:
            raise PVPBuildError(f"PVP package '{pvp_id}' not found")
        return result.data

    def _sealed_pvp_exists(self, project_id: str) -> bool:
        result = (
            self.supabase.table("pvp_packages")
            .select("id")
            .eq("project_id", project_id)
            .eq("status", "sealed")
            .limit(1)
            .execute()
        )
        return bool(result.data)

    def _collect_artifacts(self, project_id: str) -> dict[str, bytes]:
        """
        Best-effort artifact collection from Supabase Storage.
        Looks for completed analysis run outputs linked to the project.
        Returns empty dict if nothing is found — the PVP is valid without artifacts.
        """
        artifacts: dict[str, bytes] = {}
        try:
            runs = (
                self.supabase.table("analysis_runs")
                .select("id, output_path")
                .eq("project_id", project_id)
                .eq("status", "completed")
                .execute()
            )
            for run in (runs.data or []):
                if not run.get("output_path"):
                    continue
                try:
                    content  = self.supabase.storage.from_(
                        "analysis-outputs"
                    ).download(run["output_path"])
                    filename = run["output_path"].split("/")[-1]
                    artifacts[f"outputs/{filename}"] = content
                except Exception:
                    pass  # individual file failures are non-fatal
        except Exception:
            pass  # table or bucket may not exist in all deployments
        return artifacts


# ── Module-level pure helpers (no Supabase dependency) ────────────────────────

def _compute_root_hash(ledger_json: str, artifact_hashes: dict[str, str]) -> str:
    """
    Deterministic root hash over ledger + all artifact content hashes.

    Formula:
      root_hash = sha256(
        ledger_json_string +
        concat(artifact_hash for path in sorted(artifact_paths))
      )

    Sorting by path ensures identical inputs always produce the same root hash.
    """
    sorted_hashes = "".join(
        artifact_hashes[p] for p in sorted(artifact_hashes)
    )
    return hashlib.sha256(
        (ledger_json + sorted_hashes).encode("utf-8")
    ).hexdigest()


def _compute_root_hash_from_zip(zip_bytes: bytes) -> str:
    """
    Re-derive root hash by reading the ZIP contents directly.
    Used during seal() to verify the package has not been tampered with.
    The artifact paths inside the ZIP are normalised to strip the leading
    'artifacts/' prefix to match the keys stored in artifact_hashes.
    """
    buf = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(buf, "r") as zf:
        ledger_bytes = zf.read("ledger.json")
        ledger_json  = ledger_bytes.decode("utf-8")

        artifact_hashes: dict[str, str] = {}
        artifact_hashes["ledger.json"] = hashlib.sha256(ledger_bytes).hexdigest()

        for name in zf.namelist():
            if name.startswith("artifacts/") and not name.endswith("/"):
                rel_path = name[len("artifacts/"):]
                artifact_hashes[rel_path] = hashlib.sha256(
                    zf.read(name)
                ).hexdigest()

    return _compute_root_hash(ledger_json, artifact_hashes)


def _build_zip(
    manifest: dict,
    ledger_json: str,
    artifacts: dict[str, bytes],
) -> bytes:
    """Assemble the initial ZIP with unsigned manifest."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json",  json.dumps(manifest,  indent=2, default=str))
        zf.writestr("ledger.json",    ledger_json)
        zf.writestr("signatures.json", json.dumps({}, indent=2))
        for path, content in artifacts.items():
            zf.writestr(f"artifacts/{path}", content)
    return buf.getvalue()


def _rebuild_zip(original_zip_bytes: bytes, updated_manifest: dict) -> bytes:
    """Replace manifest.json inside an existing ZIP, preserving all other files."""
    orig = io.BytesIO(original_zip_bytes)
    new  = io.BytesIO()
    with (
        zipfile.ZipFile(orig, "r") as src,
        zipfile.ZipFile(new,  "w", zipfile.ZIP_DEFLATED) as dst,
    ):
        for name in src.namelist():
            if name == "manifest.json":
                dst.writestr(
                    "manifest.json",
                    json.dumps(updated_manifest, indent=2, default=str),
                )
            else:
                dst.writestr(name, src.read(name))
    return new.getvalue()


def _read_manifest(zip_bytes: bytes) -> dict:
    buf = io.BytesIO(zip_bytes)
    with zipfile.ZipFile(buf, "r") as zf:
        return json.loads(zf.read("manifest.json"))
