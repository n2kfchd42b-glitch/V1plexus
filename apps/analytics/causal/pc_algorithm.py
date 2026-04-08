"""
PC Algorithm runner for PLEXUS causal discovery.

Uses causal-learn's PC implementation with Fisher-Z conditional independence
test for continuous variables and G-squared for categorical/binary variables.
Mixed datasets use Fisher-Z with label encoding (most common in health data).

Returns a serialisable edge list with confidence scores derived from the PC
algorithm's skeleton discovery phase (adjacency matrix values normalised
to [0, 1]).
"""

from __future__ import annotations

import logging
from typing import Any

import networkx as nx
import numpy as np
import pandas as pd
from causallearn.search.ConstraintBased.PC import pc
from causallearn.utils.cit import fisherz, gsq

logger = logging.getLogger(__name__)


def _select_cit(df: pd.DataFrame) -> str:
    """
    Select conditional independence test based on column types.
    Fisher-Z for predominantly continuous, G-squared for categorical.
    """
    continuous_cols = df.select_dtypes(include=["float64", "float32"]).columns
    ratio = len(continuous_cols) / max(len(df.columns), 1)
    return fisherz if ratio >= 0.5 else gsq


def _encode_for_pc(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    """
    Encode dataframe to numpy array for causal-learn.
    Categorical columns are label-encoded; -1 (unknown) replaced with NaN.
    Returns (array, column_names).
    """
    encoded = df.copy()
    for col in df.select_dtypes(include=["object", "category"]).columns:
        encoded[col] = pd.Categorical(df[col]).codes.astype(float)
        encoded[col] = encoded[col].replace(-1, np.nan)
    return encoded.to_numpy(dtype=float), list(encoded.columns)


def _confidence_score(cg: Any, i: int, j: int) -> float:
    """
    Derive a confidence score for an edge from the PC graph object.
    Uses the adjacency matrix value; normalised to [0.0, 1.0].
    """
    try:
        val = abs(float(cg.G.graph[i, j]))
        return round(min(val, 1.0), 3)
    except Exception:
        return 0.5


def run_pc_algorithm(
    df: pd.DataFrame,
    exposure: str,
    outcome: str,
    alpha: float = 0.05,
    max_cond_vars: int | None = None,
) -> dict[str, Any]:
    """
    Run the PC algorithm on the provided dataframe.

    Parameters
    ----------
    df : pd.DataFrame
        Dataset. Missing values are dropped row-wise before running.
    exposure : str
        Column name of the exposure variable.
    outcome : str
        Column name of the outcome variable.
    alpha : float
        Significance level for conditional independence tests (default 0.05).
        Lower values produce sparser graphs.
    max_cond_vars : int | None
        Maximum conditioning set size. None = unlimited.
        Set to 3–4 for large datasets to control runtime.

    Returns
    -------
    dict with keys:
        edges       : list[dict]  — serialisable edge list
        variables   : list[str]
        algorithm   : str
        cit_used    : str
        alpha       : float
        n_samples   : int
        warnings    : list[str]
    """
    warnings: list[str] = []

    for var in [exposure, outcome]:
        if var not in df.columns:
            raise ValueError(f"Variable '{var}' not found in dataset columns.")

    n_before = len(df)
    df_clean = df.dropna()
    n_after = len(df_clean)
    missing_pct = round((n_before - n_after) / max(n_before, 1) * 100, 1)

    if missing_pct > 20:
        warnings.append(
            f"{missing_pct}% of rows were dropped due to missing values before "
            "causal discovery. Consider running the Missing Data engine first."
        )

    if n_after < 50:
        warnings.append(
            f"Only {n_after} complete cases available. PC algorithm results may "
            "be unreliable with fewer than 50 observations."
        )

    data_array, col_names = _encode_for_pc(df_clean)
    col_index = {name: i for i, name in enumerate(col_names)}
    cit = _select_cit(df_clean)

    kwargs: dict[str, Any] = {
        "data": data_array,
        "alpha": alpha,
        "indep_test": cit,
        "verbose": False,
    }
    if max_cond_vars is not None:
        kwargs["depth"] = max_cond_vars

    try:
        cg = pc(**kwargs)
    except Exception as exc:
        logger.exception("PC algorithm failed")
        raise RuntimeError(f"Causal discovery failed: {exc}") from exc

    adj = cg.G.graph  # shape (n_vars, n_vars)
    edges: list[dict] = []

    for i in range(len(col_names)):
        for j in range(i + 1, len(col_names)):
            # adj[i,j]=-1, adj[j,i]=1  → i → j
            # adj[i,j]=1,  adj[j,i]=-1 → j → i
            # adj[i,j]=1,  adj[j,i]=1  → undirected
            a_ij = int(adj[i, j])
            a_ji = int(adj[j, i])

            if a_ij == 0 and a_ji == 0:
                continue  # no edge

            direction_certain = not (a_ij == 1 and a_ji == 1)
            confidence = _confidence_score(cg, i, j)

            if a_ij == -1 and a_ji == 1:
                edge_from, edge_to = col_names[i], col_names[j]
            elif a_ij == 1 and a_ji == -1:
                edge_from, edge_to = col_names[j], col_names[i]
            else:
                # Undirected — default by index order, flag as uncertain
                edge_from, edge_to = col_names[i], col_names[j]
                direction_certain = False
                confidence = min(confidence, 0.5)

            edges.append({
                "from": edge_from,
                "to": edge_to,
                "confidence": confidence,
                "direction_certain": direction_certain,
                "involves_exposure": exposure in (edge_from, edge_to),
                "involves_outcome": outcome in (edge_from, edge_to),
            })

    # Warn if no directed path between exposure and outcome
    g = nx.DiGraph()
    for e in edges:
        g.add_edge(e["from"], e["to"])
    if exposure in g and outcome in g and not nx.has_path(g, exposure, outcome):
        warnings.append(
            f"No directed path found from '{exposure}' to '{outcome}' in the "
            "suggested DAG. Consider reviewing the graph or adding a direct edge."
        )

    return {
        "edges": edges,
        "variables": col_names,
        "algorithm": "pc",
        "cit_used": "fisherz" if cit == fisherz else "gsq",
        "alpha": alpha,
        "n_samples": n_after,
        "warnings": warnings,
    }
