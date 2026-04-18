"""
FastAPI audit service for Python backend.

All writes go through the append_audit_entry RPC so every Python-sourced
entry is:
  - Serialized under a per-chain advisory lock (no race conditions)
  - Assigned a monotonic sequence_number
  - Marked hardened = TRUE (subject to chain integrity constraints)
  - Protected by idempotency_key (safe to retry)

Hash canonical exactly mirrors auditLogger.ts so JS verification passes
on all Python-written entries.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from pydantic import BaseModel


class AuditEntryData(BaseModel):
    """Pydantic model for audit entry input"""
    actor_id: str
    action: str
    resource_type: str
    resource_id: str
    project_id: Optional[str] = None
    institution_id: Optional[str] = None
    details: Dict[str, Any]


class AuditService:
    """Service for writing audit entries from the FastAPI backend."""

    def __init__(self, supabase_client):
        self.supabase = supabase_client

    # ── Canonical details serialization ──────────────────────────────────────

    @staticmethod
    def _canonical_details(details: Dict[str, Any]) -> str:
        """
        Python equivalent of canonicalDetailsV1 in auditLogger.ts.

        Recursively sorts all dict keys at every nesting level, then serializes
        with compact separators. Produces byte-for-byte identical output to the
        JS v1 canonical so entries written here pass the verification route.

        All entries from this service are written with canonical_version=1.
        """
        def _sort_recursive(obj: Any) -> Any:
            if isinstance(obj, dict):
                return {k: _sort_recursive(v) for k, v in sorted(obj.items())}
            if isinstance(obj, list):
                return [_sort_recursive(item) for item in obj]
            return obj

        return json.dumps(_sort_recursive(details), separators=(',', ':'), ensure_ascii=False)

    # ── Hash computation ──────────────────────────────────────────────────────

    def _compute_resource_hash(
        self,
        timestamp: str,
        actor_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        project_id: Optional[str],
        details: Dict[str, Any],
        prev_hash: Optional[str],
    ) -> str:
        """Resource-scoped hash. Must match buildResourceCanonical in auditLogger.ts."""
        canonical = "|".join([
            timestamp,
            actor_id or "",
            action,
            resource_type,
            resource_id,
            project_id or "",
            self._canonical_details(details),
            prev_hash or "GENESIS",
        ])
        return hashlib.sha256(canonical.encode()).hexdigest()

    def _compute_project_chain_hash(
        self,
        timestamp: str,
        actor_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        details: Dict[str, Any],
        project_chain_prev_hash: Optional[str],
    ) -> str:
        """Project-scoped chain hash. Must match buildProjectCanonical in auditLogger.ts."""
        canonical = "|".join([
            "PROJECT",
            timestamp,
            actor_id or "",
            action,
            resource_type,
            resource_id,
            self._canonical_details(details),
            project_chain_prev_hash or "PROJECT_GENESIS",
        ])
        return hashlib.sha256(canonical.encode()).hexdigest()

    # ── Chain tail helpers ────────────────────────────────────────────────────

    def _fetch_resource_tail(self, resource_type: str, resource_id: str) -> Optional[str]:
        result = (
            self.supabase.table("audit_logs")
            .select("entry_hash")
            .eq("resource_type", resource_type)
            .eq("resource_id", resource_id)
            .order("timestamp", desc=True)
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0]["entry_hash"] if result.data else None

    def _fetch_project_chain_tail(self, project_id: str) -> Optional[str]:
        result = (
            self.supabase.table("audit_logs")
            .select("project_chain_entry_hash")
            .eq("project_id", project_id)
            .not_.is_("project_chain_entry_hash", "null")
            .order("timestamp", desc=True)
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0]["project_chain_entry_hash"] if result.data else None

    # ── Core write ────────────────────────────────────────────────────────────

    def write_entry(
        self,
        actor_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        details: Dict[str, Any],
        project_id: Optional[str] = None,
        institution_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Write an audit entry via the append_audit_entry RPC.

        The RPC takes a per-chain advisory lock, validates the tail hasn't
        moved, assigns a monotonic sequence_number, and marks the row
        hardened = TRUE. Retries once on serialization_failure (40001) or
        lock_not_available (55P03) with freshly-read tails and the same
        idempotency_key to prevent double-writes.

        Failures never raise — audit is a side-effect, not a correctness
        dependency — but the return dict always includes success + error.
        """
        try:
            timestamp = datetime.now(timezone.utc).isoformat()
            idempotency_key = str(uuid.uuid4())

            resource_prev = self._fetch_resource_tail(resource_type, resource_id)
            project_prev = (
                self._fetch_project_chain_tail(project_id) if project_id else None
            )

            def _call_rpc(res_prev: Optional[str], proj_prev: Optional[str]) -> Any:
                res_hash = self._compute_resource_hash(
                    timestamp, actor_id, action, resource_type, resource_id,
                    project_id, details, res_prev,
                )
                proj_hash = (
                    self._compute_project_chain_hash(
                        timestamp, actor_id, action, resource_type, resource_id,
                        details, proj_prev,
                    )
                    if project_id else None
                )
                return self.supabase.rpc("append_audit_entry", {
                    "p_actor_id":                    actor_id,
                    "p_action":                      action,
                    "p_resource_type":               resource_type,
                    "p_resource_id":                 resource_id,
                    "p_project_id":                  project_id,
                    "p_institution_id":              institution_id,
                    "p_details":                     details,
                    "p_ip_address":                  None,
                    "p_timestamp":                   timestamp,
                    "p_expected_resource_prev_hash": res_prev,
                    "p_resource_entry_hash":         res_hash,
                    "p_expected_project_prev_hash":  proj_prev,
                    "p_project_entry_hash":          proj_hash,
                    "p_idempotency_key":             idempotency_key,
                    "p_canonical_version":           1,
                }).execute()

            # First attempt
            try:
                result = _call_rpc(resource_prev, project_prev)
            except Exception as first_err:
                code = getattr(first_err, 'code', '') or str(first_err)
                if any(c in code for c in ('40001', '55P03', 'serialization_failure', 'lock_not_available')):
                    # Chain tail moved or lock contention — re-read tails and retry once.
                    # The same idempotency_key prevents a double-write if the first
                    # attempt actually committed before the exception was raised.
                    resource_prev = self._fetch_resource_tail(resource_type, resource_id)
                    project_prev = (
                        self._fetch_project_chain_tail(project_id) if project_id else None
                    )
                    result = _call_rpc(resource_prev, project_prev)
                else:
                    raise

            rows = result.data if isinstance(result.data, list) else ([result.data] if result.data else [])
            if rows and rows[0]:
                row = rows[0]
                return {
                    "success": True,
                    "entry_id": row.get("id"),
                    "sequence_number": row.get("sequence_number"),
                    "idempotent_replay": row.get("idempotent_replay", False),
                }
            return {"success": False, "error": "append_audit_entry returned no data"}

        except Exception as e:
            print(f"Audit write failed: {e}", flush=True)
            return {"success": False, "error": str(e)}

    # ── Typed convenience methods ─────────────────────────────────────────────

    def write_analysis_completion(
        self,
        actor_id: str,
        analysis_run_id: str,
        analysis_type: str,
        dataset_version_id: str,
        dataset_id: str,
        project_id: str,
        n_observations: int,
        duration_seconds: float,
    ) -> Dict[str, Any]:
        return self.write_entry(
            actor_id=actor_id,
            action="analysis.run.completed",
            resource_type="analysis_run",
            resource_id=analysis_run_id,
            project_id=project_id,
            details={
                "summary": f"{analysis_type} analysis completed on dataset",
                "analysis_type": analysis_type,
                "dataset_version_id": dataset_version_id,
                "operation": {
                    "analysis_type": analysis_type,
                    "dataset_id": dataset_id,
                    "dataset_version_id": dataset_version_id,
                    "n_observations": n_observations,
                    "duration_seconds": duration_seconds,
                },
            },
        )

    def write_imputation_completion(
        self,
        actor_id: str,
        version_id: str,
        dataset_id: str,
        project_id: str,
        columns_imputed: List[str],
        justification: str,
        n_iterations: int,
        rows_affected: int,
    ) -> Dict[str, Any]:
        return self.write_entry(
            actor_id=actor_id,
            action="dataset.imputation.mice",
            resource_type="dataset_version",
            resource_id=version_id,
            project_id=project_id,
            details={
                "summary": f"MICE imputation applied to {len(columns_imputed)} variables",
                "justification": justification,
                "justification_category": "missing_data_handling",
                "operation": {
                    "method": "MICE",
                    "library": "sklearn.IterativeImputer",
                    "columns_imputed": columns_imputed,
                    "iterations": n_iterations,
                    "rows_affected": rows_affected,
                },
            },
        )
