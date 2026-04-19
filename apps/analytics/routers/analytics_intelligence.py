"""
Phase C — Analytics Intelligence + Data Portrait router.

Endpoints:
  POST /analytics/intelligence/narrative        — generate statistical narrative
  POST /analytics/intelligence/sensitivity      — run sensitivity panel
  POST /analytics/portrait/trigger              — trigger data portrait (background)
  GET  /analytics/portrait/{dataset_id}         — get portrait for a dataset
  POST /analytics/timeline/entry                — create timeline entry
  GET  /analytics/timeline/{dataset_id}         — list timeline entries for dataset
"""

from __future__ import annotations

import os
import logging
from typing import Any, Optional

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel

from ..middleware.auth import get_current_user
from ..narrative_templates import generate_deterministic_narrative
from ..sensitivity_engine import run_sensitivity_panel
from ..missing_data_engine import run_data_portrait

from supabase import create_client
from ..db import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics_intelligence"])


def _supa():
    return get_supabase()


def _load_df(dataset_id: str, version_id: str) -> pd.DataFrame:
    """Download CSV from Supabase Storage and parse to DataFrame."""
    sb = _supa()
    res = sb.table("dataset_versions").select("file_path").eq("id", version_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Dataset version not found")
    file_path = res.data["file_path"]
    bytes_data = sb.storage.from_("datasets").download(file_path)
    import io
    return pd.read_csv(io.BytesIO(bytes_data))


# ── Narrative ─────────────────────────────────────────────────────────────────

class NarrativeRequest(BaseModel):
    project_id: str
    dataset_id: str
    analysis_type: str
    result: dict[str, Any]
    variables: dict[str, Any] = {}
    analysis_run_id: Optional[str] = None


@router.post("/intelligence/narrative")
async def generate_narrative(
    body: NarrativeRequest,
    user: str=Depends(get_current_user),
):
    text = generate_deterministic_narrative(body.analysis_type, body.result)

    sb = _supa()
    row = {
        "project_id": body.project_id,
        "dataset_id": body.dataset_id,
        "analysis_type": body.analysis_type,
        "variables": body.variables,
        "deterministic_text": text,
        "active_version": "deterministic",
        "components": body.result,
        "created_by": user,
    }
    if body.analysis_run_id:
        row["analysis_run_id"] = body.analysis_run_id

    ins = sb.table("analysis_narratives").insert(row).execute()
    narrative_id = ins.data[0]["id"] if ins.data else None

    return {"narrative_id": narrative_id, "deterministic_text": text}


# ── Sensitivity ───────────────────────────────────────────────────────────────

class SensitivityRequest(BaseModel):
    project_id: str
    dataset_id: str
    version_id: str
    analysis_type: str
    outcome: str
    exposure: str
    covariates: list[str] = []


@router.post("/intelligence/sensitivity")
async def run_sensitivity(
    body: SensitivityRequest,
    user: str=Depends(get_current_user),
):
    try:
        df = _load_df(body.dataset_id, body.version_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {e}")

    result = run_sensitivity_panel(df, body.analysis_type, body.outcome,
                                   body.exposure, body.covariates)

    sb = _supa()
    row = {
        "project_id": body.project_id,
        "dataset_id": body.dataset_id,
        "analysis_type": body.analysis_type,
        "primary_variables": {
            "outcome": body.outcome,
            "exposure": body.exposure,
            "covariates": body.covariates,
        },
        "comparisons": result["comparisons"],
        "consistent": result.get("consistent"),
        "created_by": user,
    }
    ins = sb.table("analysis_sensitivity_results").insert(row).execute()
    sensitivity_id = ins.data[0]["id"] if ins.data else None

    return {"sensitivity_id": sensitivity_id, **result}


# ── Data Portrait ─────────────────────────────────────────────────────────────

class PortraitTriggerRequest(BaseModel):
    dataset_id: str
    project_id: str
    version_id: str
    file_size_bytes: int = 0


def _run_portrait_bg(dataset_id: str, project_id: str, version_id: str,
                     file_size_bytes: int, portrait_id: str):
    try:
        sb = _supa()
        df = _load_df(dataset_id, version_id)
        portrait = run_data_portrait(df, file_size_bytes)

        sb.table("dataset_portraits").update({
            "status": "complete",
            "completed_at": "now()",
            **{k: v for k, v in portrait.items()
               if k != "missingness_matrix_b64"},
            "missingness_matrix_b64": portrait.get("missingness_matrix_b64"),
        }).eq("id", portrait_id).execute()
    except Exception as e:
        logger.error(f"Portrait bg task failed: {e}")
        try:
            _supa().table("dataset_portraits").update({
                "status": "failed",
                "error_message": str(e)[:500],
            }).eq("id", portrait_id).execute()
        except Exception:
            pass


@router.post("/portrait/trigger")
async def trigger_portrait(
    body: PortraitTriggerRequest,
    background_tasks: BackgroundTasks,
    user: str=Depends(get_current_user),
):
    sb = _supa()

    # Upsert — one portrait per dataset (unique constraint)
    existing = sb.table("dataset_portraits").select("id").eq("dataset_id", body.dataset_id).execute()
    if existing.data:
        portrait_id = existing.data[0]["id"]
        sb.table("dataset_portraits").update({"status": "running", "error_message": None}).eq("id", portrait_id).execute()
    else:
        ins = sb.table("dataset_portraits").insert({
            "dataset_id": body.dataset_id,
            "project_id": body.project_id,
            "status": "running",
        }).execute()
        portrait_id = ins.data[0]["id"]

    background_tasks.add_task(
        _run_portrait_bg,
        body.dataset_id, body.project_id,
        body.version_id, body.file_size_bytes,
        portrait_id,
    )
    return {"portrait_id": portrait_id, "status": "running"}


@router.get("/portrait/{dataset_id}")
async def get_portrait(
    dataset_id: str,
    user: str=Depends(get_current_user),
):
    sb = _supa()
    res = sb.table("dataset_portraits").select("*").eq("dataset_id", dataset_id).execute()
    if not res.data:
        return {"portrait": None}

    portrait = res.data[0]
    # Don't return the full base64 matrix by default (can be large)
    portrait.pop("missingness_matrix_b64", None)
    return {"portrait": portrait}


@router.get("/portrait/{dataset_id}/matrix")
async def get_portrait_matrix(
    dataset_id: str,
    user: str=Depends(get_current_user),
):
    sb = _supa()
    res = (sb.table("dataset_portraits")
           .select("missingness_matrix_b64, status")
           .eq("dataset_id", dataset_id)
           .execute())
    if not res.data:
        return {"matrix": None}
    return {"matrix": res.data[0].get("missingness_matrix_b64"), "status": res.data[0].get("status")}


# ── Analysis Timeline ─────────────────────────────────────────────────────────

class TimelineEntryRequest(BaseModel):
    project_id: str
    dataset_id: str
    analysis_type: str
    variables: dict[str, Any]
    key_result: Optional[dict] = None
    label: Optional[str] = None
    parent_id: Optional[str] = None
    branch_name: str = "main"
    assumption_status: Optional[str] = None
    assumption_check_id: Optional[str] = None
    causal_dag_id: Optional[str] = None


@router.post("/timeline/entry")
async def create_timeline_entry(
    body: TimelineEntryRequest,
    user: str=Depends(get_current_user),
):
    sb = _supa()
    row = {
        "project_id": body.project_id,
        "dataset_id": body.dataset_id,
        "analysis_type": body.analysis_type,
        "variables": body.variables,
        "key_result": body.key_result,
        "label": body.label or body.analysis_type.replace("_", " ").title(),
        "parent_id": body.parent_id,
        "branch_name": body.branch_name,
        "assumption_status": body.assumption_status,
        "assumption_check_id": body.assumption_check_id,
        "causal_dag_id": body.causal_dag_id,
        "created_by": user,
    }
    ins = sb.table("analysis_timeline_entries").insert(row).execute()
    return {"entry_id": ins.data[0]["id"] if ins.data else None}


@router.get("/timeline/{dataset_id}")
async def get_timeline(
    dataset_id: str,
    user: str=Depends(get_current_user),
):
    sb = _supa()
    res = (sb.table("analysis_timeline_entries")
           .select("*")
           .eq("dataset_id", dataset_id)
           .order("created_at")
           .execute())
    return {"entries": res.data or []}
