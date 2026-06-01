"""
Sensitivity panel engine — parallel methodological comparisons.

Runs legitimate analytical variants and returns a structured comparison
table so researchers can assess robustness of their primary result.
"""

from __future__ import annotations
import logging
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        logger.debug(f"Sensitivity variant skipped: {e}")
        return None


def _consistent(estimates: list[float | None]) -> bool:
    vals = [e for e in estimates if e is not None and not np.isnan(e)]
    if len(vals) < 2:
        return True
    signs = [v > 0 for v in vals]
    return all(s == signs[0] for s in signs)


def _ols(df: pd.DataFrame, outcome: str, exposure: str, covariates: list[str]) -> dict | None:
    """OLS via statsmodels so the standard error / p-value / CI for the exposure
    coefficient come from the full design matrix (intercept included)."""
    import statsmodels.api as sm
    cols = [c for c in [outcome, exposure] + covariates if c in df.columns]
    clean = df[cols].dropna()
    if len(clean) < 10:
        return None
    X = clean[[exposure] + [c for c in covariates if c in clean.columns]].copy()
    for col in X.select_dtypes(["object", "category"]).columns:
        X[col] = pd.Categorical(X[col]).codes
    X = X.apply(pd.to_numeric, errors="coerce")
    X = X.fillna(X.median(numeric_only=True))
    y = pd.to_numeric(clean[outcome], errors="coerce")
    mask = y.notna()
    X, y = X[mask], y[mask]
    n = int(len(y))
    if n < 10:
        return None
    Xc = sm.add_constant(X, has_constant="add")
    res = sm.OLS(y.values, Xc.values).fit()
    # Exposure is the first predictor → index 1 (index 0 is the constant).
    beta = float(res.params[1])
    se = float(res.bse[1])
    p = float(res.pvalues[1])
    return {
        "estimate": round(beta, 4),
        "ci_lower": round(beta - 1.96 * se, 4),
        "ci_upper": round(beta + 1.96 * se, 4),
        "p_value": round(p, 4),
        "metric_label": "β",
        "n": n,
    }


def _linear_sensitivity(df, outcome, exposure, covariates):
    comparisons = []

    r = _safe(_ols, df, outcome, exposure, [])
    if r:
        comparisons.append({"label": "Unadjusted (complete case)", "method_variant": "unadjusted",
                             **r, "note": "No covariates. Reference estimate."})

    r = _safe(_ols, df, outcome, exposure, covariates)
    if r:
        comparisons.append({"label": "Adjusted (complete case) — Primary", "method_variant": "adjusted",
                             **r, "note": "Primary adjusted estimate."})

    df_imp = df.copy()
    for col in df_imp.select_dtypes(include=[np.number]).columns:
        df_imp[col] = df_imp[col].fillna(df_imp[col].mean())
    r = _safe(_ols, df_imp, outcome, exposure, covariates)
    if r:
        comparisons.append({"label": "Adjusted (mean imputation)", "method_variant": "mean_imputation",
                             **r, "note": "Missing values replaced with column means."})

    if outcome in df.columns:
        mu, sd = df[outcome].mean(), df[outcome].std()
        df_trim = df[abs(df[outcome] - mu) <= 3 * sd] if sd > 0 else df
        r = _safe(_ols, df_trim, outcome, exposure, covariates)
        if r:
            comparisons.append({"label": "Adjusted (outliers excluded ±3 SD)",
                                 "method_variant": "outliers_excluded",
                                 **r, "note": f"Rows with |outcome - mean| > 3 SD removed (n={len(df_trim)})."})

    clean = df[[outcome, exposure]].dropna() if outcome in df.columns and exposure in df.columns else pd.DataFrame()
    if len(clean) >= 10:
        rho, p = stats.spearmanr(clean[exposure], clean[outcome])
        comparisons.append({"label": "Non-parametric (Spearman rank)",
                             "method_variant": "spearman",
                             "estimate": round(float(rho), 4),
                             "ci_lower": None, "ci_upper": None,
                             "p_value": round(float(p), 4),
                             "metric_label": "ρ", "n": len(clean),
                             "note": "Rank-based — robust to non-normality."})
    return comparisons


def _logistic_sensitivity(df, outcome, exposure, covariates):
    import statsmodels.api as sm

    def _logreg(data, cov_list):
        """Maximum-likelihood logistic regression on the RAW (unstandardized)
        exposure so the odds ratio is per-unit and comparable to the primary
        analysis, with a real standard error from the model's information matrix.
        (Previously this standardized predictors — giving a per-SD OR — and
        fabricated the SE as |beta|/3, which forced p≈0.003 for every result.)"""
        cols = [c for c in [outcome, exposure] + cov_list if c in data.columns]
        clean = data[cols].dropna()
        if len(clean) < 20:
            return None
        X = clean[[exposure] + [c for c in cov_list if c in clean.columns]].copy()
        for col in X.select_dtypes(["object", "category"]).columns:
            X[col] = pd.Categorical(X[col]).codes
        X = X.apply(pd.to_numeric, errors="coerce")
        X = X.fillna(X.median(numeric_only=True))
        y = pd.Categorical(clean[outcome]).codes
        if len(np.unique(y)) != 2:
            return None
        Xc = sm.add_constant(X, has_constant="add")
        res = sm.Logit(np.asarray(y), Xc.values).fit(disp=0)
        beta = float(res.params[1])  # exposure coefficient (index 0 is constant)
        se = float(res.bse[1])
        p = float(res.pvalues[1])
        OR = float(np.exp(beta))
        return {"estimate": round(OR, 4),
                "ci_lower": round(float(np.exp(beta - 1.96 * se)), 4),
                "ci_upper": round(float(np.exp(beta + 1.96 * se)), 4),
                "p_value": round(p, 4), "metric_label": "OR", "n": len(clean)}

    comparisons = []
    r = _safe(_logreg, df, [])
    if r:
        comparisons.append({"label": "Unadjusted", "method_variant": "unadjusted",
                             **r, "note": "Crude OR."})
    r = _safe(_logreg, df, covariates)
    if r:
        comparisons.append({"label": "Adjusted — Primary", "method_variant": "adjusted",
                             **r, "note": "Adjusted OR."})

    df_imp = df.copy()
    for col in df_imp.select_dtypes(include=[np.number]).columns:
        df_imp[col] = df_imp[col].fillna(df_imp[col].mean())
    r = _safe(_logreg, df_imp, covariates)
    if r:
        comparisons.append({"label": "Adjusted (mean imputation)", "method_variant": "mean_imputation",
                             **r, "note": "Mean imputation applied."})
    return comparisons


SENSITIVITY_MAP = {
    "linear_regression":           _linear_sensitivity,
    "multiple_linear_regression":  _linear_sensitivity,
    "logistic_regression":         _logistic_sensitivity,
}


def run_sensitivity_panel(
    df: pd.DataFrame,
    analysis_type: str,
    outcome: str,
    exposure: str,
    covariates: list[str],
) -> dict[str, Any]:
    fn = SENSITIVITY_MAP.get(analysis_type)
    if not fn:
        return {"comparisons": [], "consistent": None,
                "note": f"Sensitivity panel not available for {analysis_type}."}

    comparisons = fn(df, outcome, exposure, covariates or [])
    estimates = [c.get("estimate") for c in comparisons]
    return {"comparisons": comparisons, "consistent": _consistent(estimates)}
