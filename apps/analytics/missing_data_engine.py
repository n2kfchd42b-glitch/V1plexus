"""
Missing data engine + variable profiler for the Data Portrait layer.

Runs automatically on every dataset version. Detects missingness patterns,
classifies MCAR/MAR/MNAR, and produces a comprehensive variable profile.
"""

from __future__ import annotations
import base64
import io
import logging
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats

logger = logging.getLogger(__name__)


# ── MCAR approximation ────────────────────────────────────────────────────────

def _mcar_test(df: pd.DataFrame) -> tuple[float | None, str]:
    """
    Approximate Little's MCAR test using Mann-Whitney U on missingness patterns.
    Returns (combined_p, interpretation).
    """
    try:
        miss = df.isnull().astype(int)
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        p_values = []

        for col in miss.columns:
            if miss[col].sum() < 5:
                continue
            for num_col in numeric_cols:
                if num_col == col:
                    continue
                idx_missing = miss[col] == 1
                idx_obs = ~idx_missing
                g1 = df.loc[idx_missing & df[num_col].notna(), num_col]
                g2 = df.loc[idx_obs & df[num_col].notna(), num_col]
                if len(g1) < 5 or len(g2) < 5:
                    continue
                try:
                    _, p = stats.mannwhitneyu(g1, g2, alternative="two-sided")
                    p_values.append(float(p))
                except Exception:
                    pass

        if not p_values:
            return None, "Insufficient data to test MCAR."

        combined = min(min(p_values) * len(p_values), 1.0)
        interpretation = (
            f"MCAR cannot be rejected (p = {combined:.3f}). Complete case analysis may be appropriate."
            if combined >= 0.05 else
            f"Data appear not MCAR (p = {combined:.3f}). Consider multiple imputation or MICE."
        )
        return round(combined, 4), interpretation
    except Exception as e:
        logger.warning(f"MCAR test failed: {e}")
        return None, "MCAR test could not be completed."


def _classify_pattern(df: pd.DataFrame, little_p: float | None) -> str:
    miss_pct = df.isnull().mean().mean()
    if miss_pct < 0.01:
        return "mcar"
    if little_p is None:
        return "unknown"
    return "mcar" if little_p >= 0.05 else "mar"


# ── Variable profiler ─────────────────────────────────────────────────────────

def _profile_variable(series: pd.Series) -> dict[str, Any]:
    n_total = len(series)
    n_missing = int(series.isnull().sum())
    pct_missing = round(n_missing / max(n_total, 1) * 100, 2)
    clean = series.dropna()

    # Infer type
    if pd.api.types.is_bool_dtype(series):
        dtype = "boolean"
    elif pd.api.types.is_numeric_dtype(series):
        dtype = "numeric"
    elif pd.api.types.is_datetime64_any_dtype(series):
        dtype = "datetime"
    else:
        n_unique = clean.nunique()
        dtype = "categorical" if n_unique <= min(20, len(clean) * 0.5) else "text"

    profile: dict[str, Any] = {
        "name": str(series.name),
        "dtype": dtype,
        "n_missing": n_missing,
        "pct_missing": pct_missing,
        "unique_count": int(clean.nunique()),
        "is_constant": bool(clean.nunique() <= 1),
        "is_id_like": bool(clean.nunique() == len(clean) and len(clean) > 10),
    }

    if dtype == "numeric":
        desc = clean.describe(percentiles=[0.25, 0.5, 0.75])
        profile.update({
            "mean":      round(float(desc["mean"]), 4) if "mean" in desc else None,
            "sd":        round(float(desc["std"]), 4) if "std" in desc else None,
            "min":       round(float(desc["min"]), 4) if "min" in desc else None,
            "max":       round(float(desc["max"]), 4) if "max" in desc else None,
            "p25":       round(float(desc["25%"]), 4) if "25%" in desc else None,
            "p50":       round(float(desc["50%"]), 4) if "50%" in desc else None,
            "p75":       round(float(desc["75%"]), 4) if "75%" in desc else None,
            "skewness":  round(float(clean.skew()), 4) if len(clean) > 2 else None,
            "kurtosis":  round(float(clean.kurt()), 4) if len(clean) > 3 else None,
        })
        # Outlier count (>3 SD)
        if len(clean) > 0:
            mu, sd = clean.mean(), clean.std()
            if sd > 0:
                outliers = clean[abs(clean - mu) > 3 * sd]
                profile["outlier_count"] = int(len(outliers))
                profile["outlier_pct"] = round(len(outliers) / max(len(clean), 1) * 100, 2)
            else:
                profile["outlier_count"] = 0
                profile["outlier_pct"] = 0.0
        else:
            profile["outlier_count"] = 0
            profile["outlier_pct"] = 0.0

    if dtype in ("categorical", "boolean", "text"):
        vc = clean.value_counts(normalize=False).head(10)
        profile["top_values"] = [
            {"value": str(k), "count": int(v)} for k, v in vc.items()
        ]

    # Role hint
    name_lower = str(series.name).lower()
    if profile.get("is_id_like") or "id" in name_lower or name_lower.endswith("_id"):
        profile["role_hint"] = "identifier"
    elif dtype == "datetime" or "date" in name_lower or "time" in name_lower:
        profile["role_hint"] = "temporal"
    elif dtype == "boolean" or profile.get("unique_count", 999) == 2:
        profile["role_hint"] = "binary_outcome"
    elif dtype == "categorical":
        profile["role_hint"] = "categorical_covariate"
    elif dtype == "numeric":
        profile["role_hint"] = "continuous"
    else:
        profile["role_hint"] = "text"

    return profile


# ── Imputation recommendations ────────────────────────────────────────────────

def _imputation_recommendations(profiles: list[dict], pattern: str) -> list[dict]:
    recs = []
    for p in profiles:
        pct = p.get("pct_missing", 0)
        dtype = p.get("dtype", "unknown")
        name = p.get("name", "")

        if pct == 0:
            continue
        if pct > 40:
            recs.append({
                "variable": name,
                "recommendation": "consider_exclusion",
                "reason": f"{pct:.1f}% missing — consider excluding or collecting more data.",
            })
        elif pattern == "mcar" and dtype == "numeric":
            recs.append({
                "variable": name,
                "recommendation": "mean_or_median_imputation",
                "reason": "Data appear MCAR; simple imputation is appropriate.",
            })
        elif dtype == "numeric":
            recs.append({
                "variable": name,
                "recommendation": "multiple_imputation",
                "reason": "Data may be MAR; multiple imputation (MICE) recommended.",
            })
        elif dtype in ("categorical", "boolean"):
            recs.append({
                "variable": name,
                "recommendation": "mode_imputation_or_missing_category",
                "reason": "For categorical data, impute mode or create 'missing' category.",
            })
    return recs


# ── Analysis recommendations ──────────────────────────────────────────────────

def _analysis_recommendations(profiles: list[dict], n_rows: int) -> list[dict]:
    recs = []
    dtypes = [p["dtype"] for p in profiles]
    binary_count = sum(1 for p in profiles if p.get("role_hint") == "binary_outcome")
    numeric_count = dtypes.count("numeric")
    cat_count = dtypes.count("categorical")

    if n_rows < 30:
        recs.append({"analysis_type": "descriptive_statistics", "reason": "Small sample — describe first.", "confidence": "high"})
        recs.append({"analysis_type": "non_parametric_tests", "reason": "Small n favours non-parametric methods.", "confidence": "high"})
        return recs

    if binary_count >= 1 and numeric_count >= 1:
        recs.append({"analysis_type": "logistic_regression", "reason": "Binary outcome + numeric predictors detected.", "confidence": "high"})
    if numeric_count >= 2:
        recs.append({"analysis_type": "linear_regression", "reason": "Multiple numeric variables — regression suitable.", "confidence": "medium"})
        recs.append({"analysis_type": "pearson_correlation", "reason": "Numeric pairs available for correlation analysis.", "confidence": "medium"})
    if cat_count >= 1 and binary_count >= 1:
        recs.append({"analysis_type": "chi_square", "reason": "Categorical × binary — chi-square or Fisher's exact.", "confidence": "medium"})
    if cat_count >= 1 and numeric_count >= 1:
        recs.append({"analysis_type": "one_way_anova", "reason": "Categorical grouping + numeric outcome — ANOVA suitable.", "confidence": "medium"})

    recs.append({"analysis_type": "descriptive_statistics", "reason": "Always recommended as first step.", "confidence": "high"})
    return recs


# ── Missingness heatmap ───────────────────────────────────────────────────────

def _missingness_matrix_b64(df: pd.DataFrame, max_cols: int = 30) -> str | None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import matplotlib.colors as mcolors

        sub = df.iloc[:min(200, len(df)), :max_cols]
        miss = sub.isnull().astype(float)

        fig, ax = plt.subplots(figsize=(max(4, min(12, len(sub.columns) * 0.4)), 3))
        cmap = mcolors.ListedColormap(["#003d9b", "#f8f9fa"])
        ax.imshow(miss.T.values, aspect="auto", cmap=cmap, vmin=0, vmax=1, interpolation="nearest")
        ax.set_yticks(range(len(sub.columns)))
        ax.set_yticklabels(sub.columns.tolist(), fontsize=6)
        ax.set_xlabel("Observations", fontsize=7)
        ax.set_title("Missingness pattern (blue = present)", fontsize=8)
        plt.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=80, bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")
    except Exception as e:
        logger.debug(f"Missingness heatmap skipped: {e}")
        return None


# ── Main entry point ──────────────────────────────────────────────────────────

def run_data_portrait(df: pd.DataFrame, file_size_bytes: int = 0) -> dict[str, Any]:
    """
    Full data portrait for a dataset.
    Returns dict matching the dataset_portraits table schema.
    """
    n_rows, n_cols = df.shape
    overall_missing_pct = round(df.isnull().mean().mean() * 100, 2)

    little_p, mcar_notes = _mcar_test(df)
    pattern = _classify_pattern(df, little_p)
    profiles = [_profile_variable(df[col]) for col in df.columns]
    imputation_recs = _imputation_recommendations(profiles, pattern)
    analysis_recs = _analysis_recommendations(profiles, n_rows)
    matrix_b64 = _missingness_matrix_b64(df) if overall_missing_pct > 0 else None

    return {
        "n_rows": n_rows,
        "n_columns": n_cols,
        "file_size_bytes": file_size_bytes,
        "overall_missing_pct": overall_missing_pct,
        "missing_pattern": pattern,
        "little_mcar_p_value": little_p,
        "missing_pattern_notes": mcar_notes,
        "variable_profiles": profiles,
        "missingness_matrix_b64": matrix_b64,
        "imputation_recommendations": imputation_recs,
        "analysis_recommendations": analysis_recs,
    }
