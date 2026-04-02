"""
FastAPI audit service for Python backend
Writes audit entries from analytics microservice
"""

import hashlib
import json
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
    """Service for writing audit entries from FastAPI backend"""

    def __init__(self, supabase_client):
        """
        Initialize with Supabase client
        
        Args:
            supabase_client: Initialized Supabase client
        """
        self.supabase = supabase_client

    def _compute_hash(
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
        """
        Compute SHA-256 hash using canonical string representation
        
        Args:
            timestamp: ISO format timestamp
            actor_id: User ID
            action: Action type
            resource_type: Type of resource affected
            resource_id: ID of resource affected
            project_id: Optional project ID
            details: Details dict (will be sorted for determinism)
            prev_hash: Previous entry hash in chain
            
        Returns:
            SHA-256 hex digest
        """
        details_json = json.dumps(details, sort_keys=True, default=str)
        canonical = "|".join([
            timestamp,
            actor_id or "",
            action,
            resource_type,
            resource_id,
            project_id or "",
            details_json,
            prev_hash or "GENESIS",
        ])
        return hashlib.sha256(canonical.encode()).hexdigest()

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
        Write an audit entry to the ledger
        
        Args:
            actor_id: User making the action
            action: Action being performed
            resource_type: Type of resource affected
            resource_id: ID of resource affected
            details: Details of the action (must include 'summary' key)
            project_id: Optional project ID
            institution_id: Optional institution ID
            
        Returns:
            Dict with success status and entry_id if successful
            Failures are never raised - audit failures don't crash operations
        """
        try:
            # Get previous hash for this resource
            result = (
                self.supabase.table("audit_logs")
                .select("entry_hash")
                .eq("resource_type", resource_type)
                .eq("resource_id", resource_id)
                .order("timestamp", desc=True)
                .limit(1)
                .execute()
            )

            prev_hash = None
            if result.data:
                prev_hash = result.data[0]["entry_hash"]

            # Build timestamp
            timestamp = datetime.now(timezone.utc).isoformat()

            # Compute hash
            entry_hash = self._compute_hash(
                timestamp,
                actor_id,
                action,
                resource_type,
                resource_id,
                project_id or "",
                details,
                prev_hash or "GENESIS",
            )

            # Insert audit entry
            insert_result = (
                self.supabase.table("audit_logs")
                .insert({
                    "timestamp": timestamp,
                    "actor_id": actor_id,
                    "action": action,
                    "resource_type": resource_type,
                    "resource_id": resource_id,
                    "project_id": project_id,
                    "institution_id": institution_id,
                    "details": details,
                    "prev_hash": prev_hash,
                    "entry_hash": entry_hash,
                })
                .execute()
            )

            return {
                "success": True,
                "entry_id": insert_result.data[0]["id"],
            }

        except Exception as e:
            # Never crash calling operation - log and return error
            print(f"Audit write failed: {e}")
            return {
                "success": False,
                "error": str(e),
            }

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
        """
        Write audit entry for analysis completion
        
        Args:
            actor_id: User who ran the analysis
            analysis_run_id: ID of the analysis run
            analysis_type: Type of analysis performed
            dataset_version_id: Dataset version used
            dataset_id: Dataset ID
            project_id: Project ID
            n_observations: Number of observations analyzed
            duration_seconds: Duration of analysis
            
        Returns:
            Result dict with success status
        """
        return self.write_entry(
            actor_id=actor_id,
            action="analysis.run.completed",
            resource_type="analysis_run",
            resource_id=analysis_run_id,
            project_id=project_id,
            details={
                "summary": f"{analysis_type} completed on dataset",
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
        """
        Write audit entry for MICE imputation
        
        Args:
            actor_id: User who ran imputation
            version_id: New version ID
            dataset_id: Dataset ID
            project_id: Project ID
            columns_imputed: List of imputed columns
            justification: Researcher justification
            n_iterations: Number of MICE iterations
            rows_affected: Number of rows affected
            
        Returns:
            Result dict with success status
        """
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
