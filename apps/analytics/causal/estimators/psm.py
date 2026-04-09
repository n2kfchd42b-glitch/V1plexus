"""
Propensity Score Matching (PSM) estimator.

Matches treated and control units on propensity scores using nearest-neighbour
matching with caliper (0.2 × SD of logit(PS) — standard recommendation).
Naturally estimates ATT; ATE is reported as equal to ATT with a diagnostic note.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors

from ..estimation_utils import (
    bootstrap_ate, compute_smd, encode_exposure,
    fit_propensity_model, validate_estimation_inputs, two_sided_p,
)


def _match_units(
    ps: np.ndarray,
    exposure: np.ndarray,
    caliper: float = 0.2,
) -> list[tuple[int, int]]:
    logit_ps = np.log(ps / (1 - ps))
    caliper_sd = caliper * np.std(logit_ps)

    treated_idx = np.where(exposure == 1)[0]
    control_idx = np.where(exposure == 0)[0]

    nn = NearestNeighbors(n_neighbors=1, metric="euclidean")
    nn.fit(logit_ps[control_idx].reshape(-1, 1))

    pairs: list[tuple[int, int]] = []
    for t_idx in treated_idx:
        dists, idxs = nn.kneighbors([[logit_ps[t_idx]]])
        if dists[0, 0] <= caliper_sd:
            pairs.append((t_idx, control_idx[idxs[0, 0]]))
    return pairs


def run_psm(
    df: pd.DataFrame,
    exposure: str,
    outcome: str,
    adjustment_set: list[str],
) -> dict[str, Any]:
    warnings = validate_estimation_inputs(df, exposure, outcome, adjustment_set)
    df = encode_exposure(df, exposure)
    df = df.dropna(subset=[exposure, outcome] + adjustment_set).reset_index(drop=True)

    ps, _ = fit_propensity_model(df, exposure, adjustment_set)
    exp_arr = df[exposure].values.astype(float)
    out_arr = df[outcome].values.astype(float)

    caliper = 0.2
    pairs = _match_units(ps, exp_arr, caliper=caliper)

    if len(pairs) < 10:
        warnings.append(
            f"Only {len(pairs)} pairs at caliper=0.2. Widening to 0.5."
        )
        pairs = _match_units(ps, exp_arr, caliper=0.5)
        caliper = 0.5

    if not pairs:
        raise RuntimeError("No matched pairs found. PSM cannot proceed.")

    t_out = np.array([out_arr[t] for t, _ in pairs])
    c_out = np.array([out_arr[c] for _, c in pairs])
    att = float(np.mean(t_out - c_out))
    ate = att  # PSM estimates ATT; noted in diagnostics

    # Balance
    match_weights = np.zeros(len(df))
    for t_idx, c_idx in pairs:
        match_weights[t_idx] = 1.0
        match_weights[c_idx] = 1.0
    balance = compute_smd(df, exposure, adjustment_set, weights=match_weights)

    # Bootstrap CI
    def _psm_ate(sdf, exp, out, adj):
        sps, _ = fit_propensity_model(sdf, exp, adj)
        sp = _match_units(sps, sdf[exp].values.astype(float))
        if not sp:
            return None
        so = sdf[out].values.astype(float)
        return float(np.mean([so[t] - so[c] for t, c in sp]))

    boot, ci_lo, ci_hi = bootstrap_ate(_psm_ate, df, exposure, outcome, adjustment_set)
    se = float(np.std(boot)) if boot else float("nan")

    return {
        "method": "psm",
        "ate": round(ate, 6),
        "att": round(att, 6),
        "ate_ci_lower": round(ci_lo, 6) if not np.isnan(ci_lo) else None,
        "ate_ci_upper": round(ci_hi, 6) if not np.isnan(ci_hi) else None,
        "att_ci_lower": round(ci_lo, 6) if not np.isnan(ci_lo) else None,
        "att_ci_upper": round(ci_hi, 6) if not np.isnan(ci_hi) else None,
        "std_error": round(se, 6) if not np.isnan(se) else None,
        "p_value": two_sided_p(att, se),
        "diagnostics": {
            "n_matched": len(pairs),
            "n_total": len(df),
            "match_rate": round(len(pairs) / max(int(exp_arr.sum()), 1), 3),
            "caliper_used": caliper,
            "note": "PSM estimates ATT. ATE reported = ATT.",
        },
        "balance_table": balance,
        "bootstrap_estimates": [round(e, 6) for e in boot[:100]],
        "warnings": warnings,
    }
