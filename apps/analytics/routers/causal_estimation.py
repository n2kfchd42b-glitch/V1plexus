"""
FastAPI routes for the PLEXUS Causal Inference Engine — Phase B.

All estimation runs use BackgroundTasks (consistent with Phase A pattern).
Supabase Realtime pushes row updates to the frontend.

Endpoints:
  POST /analytics/causal/estimate/run           — start all 3 estimators
  GET  /analytics/causal/estimate/results/{dag_id}
  POST /analytics/causal/estimate/evalue        — compute E-value
  POST /analytics/causal/estimate/narrative     — generate causal narrative
  POST /analytics/causal/estimate/narrative/push — push narrative to doc editor
"""

from __future__ import annotations

import io
import os
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from supabase import create_client
from ..db import get_supabase

from ..middleware.auth import get_current_user
from ..causal.estimators.psm import run_psm
from ..causal.estimators.ipw import run_ipw
from ..causal.estimators.doubly_robust import run_doubly_robust
from ..causal.evalue import compute_evalue
from ..causal.narrative import generate_narrative

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics/causal/estimate", tags=["causal-estimation"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class EstimationRequest(BaseModel):
    dag_id: str
    dataset_id: str
    version_id: str
    project_id: str

class EValueRequest(BaseModel):
    dag_id: str
    project_id: str
    estimation_id: Optional[str] = None
    ate: float
    ci_lower: Optional[float] = None
    ci_upper: Optional[float] = None
    baseline_risk: float = Field(default=0.3, ge=0.01, le=0.99)

class NarrativeRequest(BaseModel):
    dag_id: str
    project_id: str

class PushNarrativeRequest(BaseModel):
    narrative_id: str
    document_id: str
    project_id: str


# =============================================================================
# HELPERS
# =============================================================================

def _supabase():
    return get_supabase()


def _load_dataset(dataset_id: str, version_id: str) -> pd.DataFrame:
    sb = _supabase()
    path = f"{dataset_id}/{version_id}/data.csv"
    raw = sb.storage.from_("datasets").download(path)
    return pd.read_csv(io.StringIO(raw.decode("utf-8")))


def _upsert_result(row: dict) -> None:
    _supabase().table("causal_estimation_results").upsert(
        row, on_conflict="dag_id,method"
    ).execute()


def _run_estimator_bg(
    method: str,
    run_fn,
    dag_id: str,
    dataset_id: str,
    version_id: str,
    project_id: str,
    exposure: str,
    outcome: str,
    adjustment_set: list[str],
    created_by: str,
) -> None:
    """Shared background runner for all three estimation methods."""
    now = datetime.now(timezone.utc).isoformat()
    _upsert_result({
        "dag_id": dag_id, "dataset_id": dataset_id, "project_id": project_id,
        "method": method, "status": "running",
    })
    try:
        df = _load_dataset(dataset_id, version_id)
        result = run_fn(df, exposure, outcome, adjustment_set)
        _upsert_result({
            "dag_id": dag_id, "dataset_id": dataset_id, "project_id": project_id,
            "method": method,
            "ate": result.get("ate"),
            "att": result.get("att"),
            "ate_ci_lower": result.get("ate_ci_lower"),
            "ate_ci_upper": result.get("ate_ci_upper"),
            "att_ci_lower": result.get("att_ci_lower"),
            "att_ci_upper": result.get("att_ci_upper"),
            "std_error": result.get("std_error"),
            "p_value": result.get("p_value"),
            "diagnostics": result.get("diagnostics", {}),
            "balance_table": result.get("balance_table", []),
            "bootstrap_estimates": result.get("bootstrap_estimates", []),
            "status": "complete",
            "completed_at": now,
            "created_by": created_by,
        })
    except Exception:
        logger.exception("Estimation background task failed: method=%s dag=%s", method, dag_id)
        _upsert_result({
            "dag_id": dag_id, "dataset_id": dataset_id, "project_id": project_id,
            "method": method, "status": "failed",
            "error_message": "Estimation failed — see server logs.",
        })


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/run")
async def start_estimation(
    req: EstimationRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    """
    Validate DAG is confirmed, then fire all three estimators as background tasks.
    Returns immediately. Supabase Realtime pushes row updates to the frontend.
    """
    sb = _supabase()
    dag_resp = sb.table("causal_dags").select(
        "id,status,exposure_variable,outcome_variable,adjustment_set"
    ).eq("id", req.dag_id).single().execute()

    if not dag_resp.data:
        raise HTTPException(status_code=404, detail="DAG not found")

    dag = dag_resp.data
    if dag["status"] != "confirmed":
        raise HTTPException(
            status_code=400,
            detail=f"DAG must be confirmed before estimation. Current status: {dag['status']}"
        )
    if not dag.get("adjustment_set"):
        raise HTTPException(
            status_code=400,
            detail="Adjustment set is empty. Confirm the DAG fully before estimating."
        )

    exposure = dag["exposure_variable"]
    outcome = dag["outcome_variable"]
    adj = dag["adjustment_set"]

    kwargs = dict(
        dag_id=req.dag_id,
        dataset_id=req.dataset_id,
        version_id=req.version_id,
        project_id=req.project_id,
        exposure=exposure,
        outcome=outcome,
        adjustment_set=adj,
        created_by=user_id,
    )

    for method, fn in [("psm", run_psm), ("ipw", run_ipw), ("doubly_robust", run_doubly_robust)]:
        background_tasks.add_task(_run_estimator_bg, method, fn, **kwargs)

    return {"dag_id": req.dag_id, "methods_started": ["psm", "ipw", "doubly_robust"]}


@router.get("/results/{dag_id}")
async def get_estimation_results(
    dag_id: str,
    user_id: str = Depends(get_current_user),
):
    """Fetch all estimation results for a DAG."""
    resp = _supabase().table("causal_estimation_results").select("*") \
        .eq("dag_id", dag_id).execute()
    return {"dag_id": dag_id, "results": resp.data or []}


@router.post("/evalue")
async def evalue_endpoint(
    req: EValueRequest,
    user_id: str = Depends(get_current_user),
):
    """Compute E-value and sensitivity curve. Stores in causal_evalues."""
    result = compute_evalue(
        ate=req.ate,
        ci_lower=req.ci_lower,
        ci_upper=req.ci_upper,
        baseline_risk=req.baseline_risk,
    )

    sb = _supabase()
    row = {
        "dag_id": req.dag_id,
        "project_id": req.project_id,
        "estimation_id": req.estimation_id,
        "evalue_estimate": result["evalue_estimate"],
        "evalue_ci_bound": result["evalue_ci_bound"],
        "rr_input": result["rr_input"],
        "sensitivity_curve": result["sensitivity_curve"],
        "interpretation": result["interpretation"],
    }
    insert_resp = sb.table("causal_evalues").insert(row).execute()
    evalue_id = insert_resp.data[0]["id"] if insert_resp.data else None

    return {"evalue_id": evalue_id, **result}


@router.post("/narrative")
async def narrative_endpoint(
    req: NarrativeRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Generate a causal narrative from stored estimation results.
    Requires at least the doubly_robust result to be complete.
    """
    sb = _supabase()

    dag_resp = sb.table("causal_dags").select(
        "exposure_variable,outcome_variable,adjustment_set"
    ).eq("id", req.dag_id).single().execute()
    if not dag_resp.data:
        raise HTTPException(status_code=404, detail="DAG not found")
    dag = dag_resp.data

    results_resp = sb.table("causal_estimation_results").select("*") \
        .eq("dag_id", req.dag_id).eq("status", "complete").execute()
    results_by_method = {r["method"]: r for r in (results_resp.data or [])}

    if "doubly_robust" not in results_by_method:
        raise HTTPException(
            status_code=400,
            detail="Doubly robust estimation must complete before generating narrative."
        )

    evalue_resp = sb.table("causal_evalues").select("*") \
        .eq("dag_id", req.dag_id).order("created_at", desc=True).limit(1).execute()
    evalue = evalue_resp.data[0] if evalue_resp.data else None

    narrative = await generate_narrative(
        exposure=dag["exposure_variable"],
        outcome=dag["outcome_variable"],
        primary_result=results_by_method["doubly_robust"],
        psm_result=results_by_method.get("psm"),
        ipw_result=results_by_method.get("ipw"),
        evalue_result=evalue,
        adjustment_set=dag["adjustment_set"] or [],
    )

    insert_resp = sb.table("causal_narratives").insert({
        "dag_id": req.dag_id,
        "project_id": req.project_id,
        "narrative_text": narrative["narrative_text"],
        "narrative_components": narrative["narrative_components"],
        "created_by": user_id,
    }).execute()
    narrative_id = insert_resp.data[0]["id"] if insert_resp.data else None

    return {"narrative_id": narrative_id, **narrative}


@router.post("/narrative/push")
async def push_narrative_to_document(
    req: PushNarrativeRequest,
    user_id: str = Depends(get_current_user),
):
    """Mark a narrative as pushed to a document."""
    now = datetime.now(timezone.utc).isoformat()
    _supabase().table("causal_narratives").update({
        "pushed_to_document": True,
        "document_id": req.document_id,
        "pushed_at": now,
        "pushed_by": user_id,
    }).eq("id", req.narrative_id).execute()

    return {"narrative_id": req.narrative_id, "document_id": req.document_id, "pushed": True}
