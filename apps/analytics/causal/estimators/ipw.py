"""
Inverse Probability Weighting (IPW) estimator.

Constructs stabilised IPW weights and estimates ATE via weighted mean
differences. Applies weight trimming at 1st/99th percentile to handle
near-violations of positivity.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from ..estimation_utils import (
    bootstrap_ate, compute_smd, encode_exposure,
    fit_propensity_model, validate_estimation_inputs, two_sided_p,
)


def _ipw_weights(
    ps: np.ndarray,
    exposure: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Returns (ate_weights, att_weights), stabilised and trimmed."""
    p_t = exposure.mean()

    ate_w = np.where(exposure == 1, p_t / ps, (1 - p_t) / (1 - ps))
    att_w = np.where(exposure == 1, np.ones_like(ps), ps / (1 - ps))

    for w in (ate_w, att_w):
        lo, hi = np.percentile(w, [1, 99])
        w[:] = np.clip(w, lo, hi)

    return ate_w, att_w


def run_ipw(
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

    ate_w, att_w = _ipw_weights(ps, exp_arr)
    t_mask = exp_arr == 1
    c_mask = exp_arr == 0

    ate = float(
        np.average(out_arr[t_mask], weights=ate_w[t_mask])
        - np.average(out_arr[c_mask], weights=ate_w[c_mask])
    )
    att = float(
        np.average(out_arr[t_mask], weights=att_w[t_mask])
        - np.average(out_arr[c_mask], weights=att_w[c_mask])
    )
    ess = float(ate_w.sum() ** 2 / (ate_w ** 2).sum())

    balance = compute_smd(df, exposure, adjustment_set, weights=ate_w)

    def _ipw_ate(sdf, exp, out, adj):
        sps, _ = fit_propensity_model(sdf, exp, adj)
        se_arr = sdf[exp].values.astype(float)
        so_arr = sdf[out].values.astype(float)
        sw, _ = _ipw_weights(sps, se_arr)
        tm, cm = se_arr == 1, se_arr == 0
        return float(
            np.average(so_arr[tm], weights=sw[tm])
            - np.average(so_arr[cm], weights=sw[cm])
        )

    boot, ci_lo, ci_hi = bootstrap_ate(_ipw_ate, df, exposure, outcome, adjustment_set)
    se = float(np.std(boot)) if boot else float("nan")

    return {
        "method": "ipw",
        "ate": round(ate, 6),
        "att": round(att, 6),
        "ate_ci_lower": round(ci_lo, 6) if not np.isnan(ci_lo) else None,
        "ate_ci_upper": round(ci_hi, 6) if not np.isnan(ci_hi) else None,
        "att_ci_lower": None,
        "att_ci_upper": None,
        "std_error": round(se, 6) if not np.isnan(se) else None,
        "p_value": two_sided_p(ate, se),
        "diagnostics": {
            "effective_sample_size": round(ess, 1),
            "n_total": len(df),
            "trimming_applied": True,
            "stabilised_weights": True,
            "weight_summary": {
                "mean": round(float(ate_w.mean()), 4),
                "max": round(float(ate_w.max()), 4),
                "min": round(float(ate_w.min()), 4),
            },
        },
        "balance_table": balance,
        "bootstrap_estimates": [round(e, 6) for e in boot[:100]],
        "warnings": warnings,
    }
