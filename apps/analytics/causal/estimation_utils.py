"""
Shared utilities for Phase B causal estimation methods.

All three estimators (PSM, IPW, DR) share:
  - Propensity score model fitting
  - Covariate balance computation (SMD)
  - Bootstrap CI computation
  - Input validation
"""

from __future__ import annotations

import logging
from typing import Any, Callable

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


def validate_estimation_inputs(
    df: pd.DataFrame,
    exposure: str,
    outcome: str,
    adjustment_set: list[str],
) -> list[str]:
    """
    Validate inputs before running any estimator.
    Returns list of warning strings. Raises ValueError on fatal errors.
    """
    warnings: list[str] = []

    for var in [exposure, outcome] + adjustment_set:
        if var not in df.columns:
            raise ValueError(f"Variable '{var}' not found in dataset.")

    exposure_vals = df[exposure].dropna().unique()
    if len(exposure_vals) != 2:
        raise ValueError(
            f"Exposure '{exposure}' must be binary (2 unique values). "
            f"Found {len(exposure_vals)}."
        )

    if set(map(float, exposure_vals)) != {0.0, 1.0}:
        warnings.append(
            f"Exposure '{exposure}' encoded: "
            f"{sorted(exposure_vals)[0]} → 0, {sorted(exposure_vals)[1]} → 1."
        )

    n = len(df.dropna(subset=[exposure, outcome] + adjustment_set))
    if n < 100:
        warnings.append(
            f"Only {n} complete cases. Estimates with <100 observations "
            "should be interpreted with caution."
        )

    sorted_vals = sorted(df[exposure].dropna().unique())
    treated = df[df[exposure] == sorted_vals[1]]
    control = df[df[exposure] == sorted_vals[0]]
    if len(treated) < 10 or len(control) < 10:
        warnings.append(
            "Very few observations in one treatment arm. "
            "Positivity assumption may be violated."
        )

    return warnings


def encode_exposure(df: pd.DataFrame, exposure: str) -> pd.DataFrame:
    """Encode exposure to 0/1; returns copy."""
    df = df.copy()
    vals = sorted(df[exposure].dropna().unique())
    df[exposure] = df[exposure].map({vals[0]: 0, vals[1]: 1})
    return df


def fit_propensity_model(
    df: pd.DataFrame,
    exposure: str,
    adjustment_set: list[str],
) -> tuple[np.ndarray, LogisticRegression]:
    """
    Fit logistic regression propensity score model.
    Returns (propensity_scores clipped to [0.01, 0.99], fitted_model).
    """
    X = df[adjustment_set].copy()
    for col in X.select_dtypes(include=["object", "category"]).columns:
        X[col] = pd.Categorical(X[col]).codes

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X.fillna(X.median(numeric_only=True)))

    model = LogisticRegression(max_iter=1000, solver="lbfgs", C=1.0, random_state=42)
    model.fit(X_scaled, df[exposure].values)
    ps = model.predict_proba(X_scaled)[:, 1]
    return np.clip(ps, 0.01, 0.99), model


def compute_smd(
    df: pd.DataFrame,
    exposure: str,
    adjustment_set: list[str],
    weights: np.ndarray | None = None,
) -> list[dict]:
    """
    Standardised Mean Difference for each covariate.
    SMD < 0.1 = good balance.
    """
    results = []
    treated_mask = df[exposure] == 1
    control_mask = df[exposure] == 0

    for var in adjustment_set:
        col = df[var]
        if col.dtype == object:
            fill = col.mode()[0] if not col.mode().empty else 0
        else:
            fill = col.median()
        col = col.fillna(fill)

        mu_t = col[treated_mask].mean()
        mu_c = col[control_mask].mean()
        pooled_sd = float(np.sqrt(
            (col[treated_mask].var() + col[control_mask].var()) / 2
        )) or 1.0
        smd_before = abs(mu_t - mu_c) / pooled_sd

        if weights is not None:
            w_t = weights[treated_mask]
            w_c = weights[control_mask]
            if w_t.sum() > 0 and w_c.sum() > 0:
                mu_t_w = float(np.average(col[treated_mask], weights=w_t))
                mu_c_w = float(np.average(col[control_mask], weights=w_c))
                smd_after = abs(mu_t_w - mu_c_w) / pooled_sd
            else:
                smd_after = smd_before
        else:
            smd_after = smd_before

        results.append({
            "variable": var,
            "smd_before": round(float(smd_before), 4),
            "smd_after": round(float(smd_after), 4),
            "balanced": smd_after < 0.1,
        })

    return results


def bootstrap_ate(
    estimation_fn: Callable,
    df: pd.DataFrame,
    exposure: str,
    outcome: str,
    adjustment_set: list[str],
    n_bootstrap: int = 200,
    seed: int = 42,
) -> tuple[list[float], float, float]:
    """
    Bootstrap CIs for ATE. Returns (estimates, ci_lower_95, ci_upper_95).
    """
    rng = np.random.default_rng(seed)
    estimates: list[float] = []

    for _ in range(n_bootstrap):
        sample = df.sample(len(df), replace=True, random_state=int(rng.integers(1_000_000)))
        try:
            ate = estimation_fn(sample, exposure, outcome, adjustment_set)
            if ate is not None and not np.isnan(float(ate)):
                estimates.append(float(ate))
        except Exception:
            continue

    if len(estimates) < 10:
        return estimates, float("nan"), float("nan")

    return (
        estimates,
        float(np.percentile(estimates, 2.5)),
        float(np.percentile(estimates, 97.5)),
    )


def two_sided_p(estimate: float, se: float) -> float | None:
    if se == 0 or np.isnan(se):
        return None
    from scipy import stats
    return float(2 * (1 - stats.norm.cdf(abs(estimate / se))))
