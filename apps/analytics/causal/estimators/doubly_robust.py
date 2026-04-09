"""
Doubly Robust (DR) estimator using EconML's LinearDRLearner.

DR is consistent if EITHER the propensity score model OR the outcome model
is correctly specified. Recommended primary estimator for observational health
data. Uses 5-fold CV for the nuisance models.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from econml.dr import LinearDRLearner
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.preprocessing import StandardScaler

from ..estimation_utils import (
    bootstrap_ate, compute_smd, encode_exposure,
    fit_propensity_model, validate_estimation_inputs, two_sided_p,
)


def _prepare_X(df: pd.DataFrame, adjustment_set: list[str]) -> np.ndarray:
    X = df[adjustment_set].copy()
    for col in X.select_dtypes(include=["object", "category"]).columns:
        X[col] = pd.Categorical(X[col]).codes
    return StandardScaler().fit_transform(X.fillna(X.median(numeric_only=True)))


def run_doubly_robust(
    df: pd.DataFrame,
    exposure: str,
    outcome: str,
    adjustment_set: list[str],
) -> dict[str, Any]:
    warnings = validate_estimation_inputs(df, exposure, outcome, adjustment_set)
    df = encode_exposure(df, exposure)
    df = df.dropna(subset=[exposure, outcome] + adjustment_set).reset_index(drop=True)

    X = _prepare_X(df, adjustment_set)
    T = df[exposure].values.astype(float)
    Y = df[outcome].values.astype(float)

    model = LinearDRLearner(
        model_propensity=LogisticRegression(max_iter=1000, random_state=42),
        model_regression=Ridge(alpha=1.0),
        cv=5,
        random_state=42,
    )
    try:
        model.fit(Y, T, X=X)
    except Exception as exc:
        raise RuntimeError(f"Doubly robust estimation failed: {exc}") from exc

    effect = model.effect(X)
    ate = float(np.mean(effect))
    att = float(np.mean(effect[T == 1])) if T.sum() > 0 else ate

    ci_lo, ci_hi = float("nan"), float("nan")
    try:
        interval = model.ate_interval(X, alpha=0.05)
        ci_lo, ci_hi = float(interval[0]), float(interval[1])
    except Exception:
        warnings.append("Confidence intervals could not be computed for DR estimator.")

    se = (ci_hi - ci_lo) / (2 * 1.96) if not np.isnan(ci_hi) else float("nan")

    # Balance using propensity model
    ps, _ = fit_propensity_model(df, exposure, adjustment_set)
    ate_w = np.where(T == 1, 1 / ps, 1 / (1 - ps))
    balance = compute_smd(df, exposure, adjustment_set, weights=ate_w)

    # Lightweight bootstrap (100 reps) for distribution display
    def _dr_ate(sdf, exp, out, adj):
        sX = _prepare_X(sdf, adj)
        sT = sdf[exp].values.astype(float)
        sY = sdf[out].values.astype(float)
        m = LinearDRLearner(
            model_propensity=LogisticRegression(max_iter=500, random_state=42),
            model_regression=Ridge(alpha=1.0),
            cv=3,
            random_state=42,
        )
        m.fit(sY, sT, X=sX)
        return float(np.mean(m.effect(sX)))

    boot, _, _ = bootstrap_ate(_dr_ate, df, exposure, outcome, adjustment_set, n_bootstrap=100)

    return {
        "method": "doubly_robust",
        "ate": round(ate, 6),
        "att": round(att, 6),
        "ate_ci_lower": round(ci_lo, 6) if not np.isnan(ci_lo) else None,
        "ate_ci_upper": round(ci_hi, 6) if not np.isnan(ci_hi) else None,
        "att_ci_lower": None,
        "att_ci_upper": None,
        "std_error": round(se, 6) if not np.isnan(se) else None,
        "p_value": two_sided_p(ate, se),
        "diagnostics": {
            "outcome_model": "Ridge regression",
            "propensity_model": "Logistic regression (5-fold CV)",
            "estimator": "LinearDRLearner (EconML)",
            "n_total": len(df),
            "note": "Primary estimator. Consistent if either nuisance model is correctly specified.",
        },
        "balance_table": balance,
        "bootstrap_estimates": [round(e, 6) for e in boot[:100]],
        "warnings": warnings,
    }
