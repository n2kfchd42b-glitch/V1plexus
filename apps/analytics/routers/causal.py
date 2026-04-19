"""
FastAPI routes for the PLEXUS Causal Inference Engine (Phase A).

Endpoints:
  POST /analytics/causal/discover       — enqueue PC algorithm via BackgroundTasks
  POST /analytics/causal/confirm        — researcher confirms / edits suggested DAG
  POST /analytics/causal/adjustment-set — compute minimal adjustment set
  GET  /analytics/causal/{dag_id}       — fetch current DAG state
"""

from __future__ import annotations

import io
import os
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

import pandas as pd
from supabase import create_client
from ..db import get_supabase

from ..middleware.auth import get_current_user
from ..causal.pc_algorithm import run_pc_algorithm
from ..causal.adjustment_set import compute_adjustment_set

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics/causal", tags=["causal"])


# =============================================================================
# PYDANTIC MODELS
# =============================================================================


class CausalDiscoverRequest(BaseModel):
    dag_id: str
    dataset_id: str
    version_id: str
    exposure: str
    outcome: str
    variable_columns: list[str]
    alpha: float = Field(default=0.05, ge=0.01, le=0.1)


class ConfirmDAGRequest(BaseModel):
    dag_id: str
    confirmed_edges: list[dict]
    edge_decisions: list[dict] = Field(default_factory=list)


class AdjustmentSetRequest(BaseModel):
    dag_id: str
    confirmed_edges: list[dict]
    exposure: str
    outcome: str


# =============================================================================
# BACKGROUND TASK: run PC algorithm and write results back to Supabase
# =============================================================================


def _run_discovery_background(
    dag_id: str,
    dataset_id: str,
    version_id: str,
    exposure: str,
    outcome: str,
    variable_columns: list[str],
    alpha: float,
) -> None:
    """
    Loads the dataset from Supabase Storage, runs the PC algorithm,
    and writes suggested edges + status back to causal_dags.
    Runs in a FastAPI BackgroundTask (non-blocking for the HTTP response).
    """
    supabase = get_supabase()

    try:
        # Load dataset version from storage (CSV at {dataset_id}/{version_id}/data.csv)
        storage_path = f"{dataset_id}/{version_id}/data.csv"
        raw = supabase.storage.from_("datasets").download(storage_path)
        df = pd.read_csv(io.StringIO(raw.decode("utf-8")))

        # Restrict to requested columns (drop any not present)
        cols = [c for c in variable_columns if c in df.columns]
        df = df[cols]

        result = run_pc_algorithm(
            df=df,
            exposure=exposure,
            outcome=outcome,
            alpha=alpha,
        )

        supabase.table("causal_dags").update({
            "suggested_edges": result["edges"],
            "status": "suggested",
            "algorithm_params": {
                "alpha": result["alpha"],
                "cit_used": result["cit_used"],
                "n_samples": result["n_samples"],
                "warnings": result["warnings"],
            },
        }).eq("id", dag_id).execute()

    except Exception:
        logger.exception("Background causal discovery failed for dag_id=%s", dag_id)
        supabase.table("causal_dags").update({
            "status": "rejected",
            "algorithm_params": {"error": "Discovery task failed — see server logs."},
        }).eq("id", dag_id).execute()


# =============================================================================
# ENDPOINTS
# =============================================================================


@router.post("/discover")
async def start_causal_discovery(
    req: CausalDiscoverRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    """
    Enqueue PC algorithm for a DAG record that already exists in causal_dags
    with status='pending'. Returns immediately; algorithm runs in background.
    Supabase Realtime will push the status update to the frontend.
    """
    background_tasks.add_task(
        _run_discovery_background,
        dag_id=req.dag_id,
        dataset_id=req.dataset_id,
        version_id=req.version_id,
        exposure=req.exposure,
        outcome=req.outcome,
        variable_columns=req.variable_columns,
        alpha=req.alpha,
    )
    return {"dag_id": req.dag_id, "status": "pending"}


@router.post("/confirm")
async def confirm_dag(
    req: ConfirmDAGRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Researcher confirms (or modifies) the suggested DAG.
    Stores confirmed_edges, logs each edge decision, transitions to 'confirmed'.
    """
    supabase = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    supabase.table("causal_dags").update({
        "confirmed_edges": req.confirmed_edges,
        "status": "confirmed",
        "confirmed_by": user_id,
        "confirmed_at": now,
    }).eq("id", req.dag_id).execute()

    if req.edge_decisions:
        decision_rows = [
            {
                "dag_id": req.dag_id,
                "edge_from": d["from"],
                "edge_to": d["to"],
                "action": d["action"],
                "decided_by": user_id,
                "decided_at": now,
            }
            for d in req.edge_decisions
        ]
        supabase.table("causal_dag_edge_decisions").insert(decision_rows).execute()

    return {"dag_id": req.dag_id, "status": "confirmed"}


@router.post("/adjustment-set")
async def get_adjustment_set(
    req: AdjustmentSetRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Compute the minimal adjustment set from the confirmed DAG.
    Stores result back into causal_dags and returns it.
    """
    result = compute_adjustment_set(
        confirmed_edges=req.confirmed_edges,
        exposure=req.exposure,
        outcome=req.outcome,
    )

    supabase = get_supabase()
    supabase.table("causal_dags").update({
        "adjustment_set": result["adjustment_set"],
        "mediators": result["mediators"],
        "colliders": result["colliders"],
        "instruments": result["instruments"],
    }).eq("id", req.dag_id).execute()

    return result


@router.get("/{dag_id}")
async def get_dag(
    dag_id: str,
    user_id: str = Depends(get_current_user),
):
    """
    Fetch the current state of a DAG record (polling fallback if Realtime unavailable).
    """
    supabase = get_supabase()
    resp = supabase.table("causal_dags").select("*").eq("id", dag_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="DAG not found")
    return resp.data
