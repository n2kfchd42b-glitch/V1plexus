"""
E-value computation and sensitivity curve generation.

The E-value answers: how strong would an unmeasured confounder need to be
(associated with both exposure and outcome) to fully explain away the result?

Formula (VanderWeele & Ding, 2017):
  For RR ≥ 1:  E = RR + sqrt(RR*(RR-1))
  For RR < 1:  flip to 1/RR first
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np


def _evalue_from_rr(rr: float) -> float:
    if rr == 1.0:
        return 1.0
    if rr < 1.0:
        rr = 1.0 / rr
    return rr + math.sqrt(rr * (rr - 1))


def ate_to_rr(ate: float, baseline_risk: float = 0.3) -> float:
    """Convert ATE (risk difference) to approximate RR."""
    treated = max(0.001, min(0.999, baseline_risk + ate))
    base = max(0.001, min(0.999, baseline_risk))
    return treated / base


def compute_evalue(
    ate: float,
    ci_lower: float | None,
    ci_upper: float | None,
    baseline_risk: float = 0.3,
    n_curve_points: int = 30,
) -> dict[str, Any]:
    """
    Compute E-value, CI E-value, sensitivity curve, and plain-language interpretation.
    """
    rr = ate_to_rr(ate, baseline_risk)
    evalue_est = _evalue_from_rr(rr)

    # CI bound closer to null
    evalue_ci = 1.0
    if ci_lower is not None and ci_upper is not None:
        rr_lo = ate_to_rr(ci_lower, baseline_risk)
        rr_hi = ate_to_rr(ci_upper, baseline_risk)
        ci_rr_null = rr_lo if abs(rr_lo - 1) < abs(rr_hi - 1) else rr_hi
        evalue_ci = _evalue_from_rr(ci_rr_null)

    # Sensitivity curve: for each hypothetical confounder-exposure RR, compute the
    # minimum confounder-outcome RR needed to explain away the effect. Inverting
    # the VanderWeele bias factor RR = (rr_ue·rr_ud)/(rr_ue+rr_ud−1) for rr_ud gives
    #   rr_ud = rr·(rr_ue − 1) / (rr_ue − rr)
    # evaluated on the effect expressed as RR ≥ 1 (flip protective effects first).
    rr_eff = rr if rr >= 1.0 else (1.0 / rr if rr > 0 else 1.0)
    max_axis = max(evalue_est * 1.5, 3.0)
    curve: list[dict] = []
    for rr_ue in np.linspace(1.01, max_axis, n_curve_points):
        den = rr_ue - rr_eff
        if den <= 0:
            # No finite confounder-outcome RR at this rr_ue can reach the effect.
            continue
        rr_ud = rr_eff * (rr_ue - 1) / den
        if not np.isfinite(rr_ud) or rr_ud < 1.0:
            continue
        curve.append({
            "rr_confounder_exposure": round(float(rr_ue), 3),
            "rr_confounder_outcome_needed": round(float(rr_ud), 3),
            "nullifies_effect": bool(rr_ud <= rr_ue),
        })

    direction = "increased" if ate > 0 else "decreased"
    ev_r = round(evalue_est, 2)
    ev_ci_r = round(evalue_ci, 2)
    robustness = (
        "A confounder this strong would be unusually large, lending robustness to the causal interpretation."
        if evalue_est >= 2.5
        else "A confounder of this magnitude is plausible — interpret with caution."
    )

    interpretation = (
        f"The data suggest that the exposure is associated with {direction} risk "
        f"(ATE = {round(ate, 3)}, RR ≈ {round(rr, 2)}). "
        f"The E-value is {ev_r}: an unmeasured confounder would need to be associated "
        f"with both exposure and outcome by at least {ev_r}-fold — after accounting for "
        f"all measured confounders — to fully explain this result. "
        f"To shift the confidence interval to include the null, a {ev_ci_r}-fold "
        f"association would suffice. {robustness}"
    )

    return {
        "evalue_estimate": round(evalue_est, 4),
        "evalue_ci_bound": round(evalue_ci, 4),
        "rr_input": round(rr, 4),
        "sensitivity_curve": curve,
        "interpretation": interpretation,
    }
