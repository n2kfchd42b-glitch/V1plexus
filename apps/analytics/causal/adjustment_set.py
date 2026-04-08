"""
Minimal adjustment set computation using the backdoor criterion.

Given a confirmed DAG (edge list) and exposure + outcome variables, computes:
  - adjustment_set : minimal set of variables to adjust for
  - mediators      : variables on the causal path (do NOT adjust)
  - colliders      : variables that open paths when conditioned on
  - instruments    : variables associated with exposure but not outcome directly

Uses networkx for graph operations. No causal-learn dependency — pure graph
algorithm, runs synchronously and fast.
"""

from __future__ import annotations

import itertools
import logging
from typing import Any

import networkx as nx

logger = logging.getLogger(__name__)


def _build_graph(edges: list[dict]) -> nx.DiGraph:
    g = nx.DiGraph()
    for e in edges:
        g.add_edge(e["from"], e["to"])
    return g


def _is_backdoor_blocked(
    g: nx.DiGraph,
    exposure: str,
    outcome: str,
    adjustment: set[str],
) -> bool:
    """Test whether the adjustment set blocks all backdoor paths via d-separation."""
    try:
        return nx.d_separated(g, {exposure}, {outcome}, adjustment)
    except Exception:
        return False


def compute_adjustment_set(
    confirmed_edges: list[dict],
    exposure: str,
    outcome: str,
) -> dict[str, Any]:
    """
    Compute the minimal adjustment set and classify all other variables.

    Parameters
    ----------
    confirmed_edges : list[dict]
        Researcher-confirmed edge list. Each dict must have keys: from, to.
    exposure : str
    outcome : str

    Returns
    -------
    dict with keys:
        adjustment_set  : list[str]
        mediators       : list[str]
        colliders       : list[str]
        instruments     : list[str]
        causal_paths    : list[list[str]]
        backdoor_paths  : list[list[str]]
        is_identified   : bool
        warnings        : list[str]
    """
    warnings: list[str] = []
    g = _build_graph(confirmed_edges)

    all_vars = set(g.nodes)
    non_ep_oc = all_vars - {exposure, outcome}

    exposure_descendants = nx.descendants(g, exposure) if exposure in g else set()
    outcome_ancestors = nx.ancestors(g, outcome) if outcome in g else set()

    # Mediators: descendants of exposure AND ancestors of outcome
    mediators = (exposure_descendants & outcome_ancestors) - {outcome}

    # Causal paths: all directed paths from exposure to outcome
    try:
        causal_paths = list(nx.all_simple_paths(g, exposure, outcome))
    except (nx.NetworkXError, nx.NodeNotFound):
        causal_paths = []
        warnings.append(
            "No directed path from exposure to outcome found. "
            "The causal estimate may not be identified."
        )

    # Backdoor paths: undirected paths where the first step goes INTO exposure
    undirected = g.to_undirected()
    backdoor_paths: list[list[str]] = []
    try:
        for path in nx.all_simple_paths(undirected, exposure, outcome):
            if len(path) > 1 and g.has_edge(path[1], exposure):
                backdoor_paths.append(path)
    except Exception:
        pass

    # Colliders on backdoor paths: node where both neighbours point into it
    colliders: set[str] = set()
    for path in backdoor_paths:
        for i in range(1, len(path) - 1):
            prev_n, curr_n, next_n = path[i - 1], path[i], path[i + 1]
            if not g.has_edge(prev_n, curr_n) and not g.has_edge(next_n, curr_n):
                colliders.add(curr_n)

    # Candidate adjustment variables:
    # non-descendants of exposure, not colliders, not mediators
    candidates = non_ep_oc - exposure_descendants - colliders - mediators

    # Find minimal adjustment set (smallest subset that blocks all backdoor paths)
    adjustment_set: set[str] = set()
    found = False
    for size in range(len(candidates) + 1):
        for subset in itertools.combinations(sorted(candidates), size):
            if _is_backdoor_blocked(g, exposure, outcome, set(subset)):
                adjustment_set = set(subset)
                found = True
                break
        if found:
            break

    if not found and backdoor_paths:
        adjustment_set = candidates
        warnings.append(
            "Could not compute a minimal adjustment set. Using all eligible "
            "candidate variables. Review the DAG for potential issues."
        )

    # Instruments: associated with exposure, not directly with outcome,
    # not descendants of outcome
    outcome_descendants = nx.descendants(g, outcome) if outcome in g else set()
    instruments: set[str] = set()
    for var in non_ep_oc - exposure_descendants - outcome_descendants:
        if g.has_edge(var, exposure) or g.has_edge(exposure, var):
            if not g.has_edge(var, outcome):
                instruments.add(var)

    if not adjustment_set and not backdoor_paths:
        warnings.append(
            "No backdoor paths detected. The exposure-outcome relationship "
            "may already be identified without adjustment — verify the DAG."
        )

    return {
        "adjustment_set": sorted(adjustment_set),
        "mediators": sorted(mediators),
        "colliders": sorted(colliders),
        "instruments": sorted(instruments),
        "causal_paths": causal_paths,
        "backdoor_paths": backdoor_paths,
        "is_identified": len(causal_paths) > 0,
        "warnings": warnings,
    }
