"""
Regression tests for the statistical-correctness fixes from the Analysis Hub audit.

These lock in the behaviour of:
  - narrative_templates: each test prints its own correct name/coefficient
  - evalue: the sensitivity-curve contour is self-consistent with the E-value
  - adjustment_set: backdoor logic adjusts for confounders, not colliders/mediators
"""

import math

import numpy as np
import pytest

from ..narrative_templates import generate_deterministic_narrative
from ..causal.evalue import _evalue_from_rr, compute_evalue
from ..causal.adjustment_set import compute_adjustment_set


# ── narrative_templates ──────────────────────────────────────────────────────

def test_paired_t_test_is_labelled_paired():
    out = generate_deterministic_narrative(
        "paired_t_test",
        {"group_a": "pre", "group_b": "post", "p_value": 0.01, "t_statistic": 3, "df": 20, "mean_difference": 2},
    )
    assert "paired samples t-test" in out
    assert "independent samples t-test" not in out


def test_fishers_exact_not_called_chi_square():
    out = generate_deterministic_narrative(
        "fishers_exact", {"variable_a": "x", "variable_b": "y", "p_value": 0.04}
    )
    assert "Fisher's exact test" in out
    assert "chi-square" not in out


def test_two_way_anova_labelled():
    out = generate_deterministic_narrative(
        "two_way_anova",
        {"factor": "f", "outcome": "o", "F_statistic": 4, "df_between": 2, "df_within": 50, "p_value": 0.02},
    )
    assert "Two-way ANOVA" in out


def test_spearman_uses_rho():
    out = generate_deterministic_narrative(
        "spearman_correlation", {"variable_a": "a", "variable_b": "b", "rho": 0.5, "p_value": 0.01}
    )
    assert "Spearman correlation" in out
    assert "ρ =" in out


def test_inferential_caveat_present_but_not_on_descriptive():
    infer = generate_deterministic_narrative(
        "logistic_regression", {"odds_ratio": 2.0, "p_value": 0.01}
    )
    desc = generate_deterministic_narrative("descriptive", {"variable": "age", "mean": 40, "n": 100})
    assert "multiple comparisons" in infer
    assert "multiple comparisons" not in desc


# ── E-value sensitivity curve ────────────────────────────────────────────────

@pytest.mark.parametrize("rr", [1.5, 2.0, 3.0, 0.5])
def test_evalue_contour_self_consistent(rr):
    """At rr_ue = E-value, the required rr_ud must equal the E-value, and the
    VanderWeele bias factor at (E, E) must exactly equal the effect RR."""
    rr_eff = rr if rr >= 1 else 1.0 / rr
    E = _evalue_from_rr(rr)
    den = E - rr_eff
    rr_ud = rr_eff * (E - 1) / den
    assert math.isclose(rr_ud, E, rel_tol=1e-9)
    bias = (E * rr_ud) / (E + rr_ud - 1)
    assert math.isclose(bias, rr_eff, rel_tol=1e-9)


def test_compute_evalue_curve_points_nullify():
    res = compute_evalue(ate=0.2, ci_lower=0.05, ci_upper=0.35, baseline_risk=0.3)
    assert res["evalue_estimate"] >= 1.0
    # Every contour point should be a valid (>=1) confounder-outcome RR
    for pt in res["sensitivity_curve"]:
        assert pt["rr_confounder_outcome_needed"] >= 1.0


# ── Backdoor adjustment set ───────────────────────────────────────────────────

def test_confounder_is_adjusted_not_collider():
    edges = [{"from": "Z", "to": "X"}, {"from": "Z", "to": "Y"}, {"from": "X", "to": "Y"}]
    r = compute_adjustment_set(edges, "X", "Y")
    assert r["adjustment_set"] == ["Z"]
    assert "Z" not in r["colliders"]


def test_collider_not_adjusted():
    edges = [{"from": "X", "to": "C"}, {"from": "Y", "to": "C"}, {"from": "X", "to": "Y"}]
    r = compute_adjustment_set(edges, "X", "Y")
    assert r["adjustment_set"] == []


def test_mediator_identified_not_adjusted():
    edges = [{"from": "X", "to": "M"}, {"from": "M", "to": "Y"}]
    r = compute_adjustment_set(edges, "X", "Y")
    assert r["mediators"] == ["M"]
    assert r["adjustment_set"] == []
