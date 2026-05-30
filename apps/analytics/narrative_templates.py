"""
Deterministic statistical narrative templates for PLEXUS analysis types.

Each function receives the structured result dict from the analytics engine
and returns publication-ready prose. Numbers are never invented — only
values present in the result dict are used.
"""

from __future__ import annotations
import math
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _fmt(v: Any, decimals: int = 3) -> str:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return "N/A"
    return f"{float(v):.{decimals}f}"


def _sig(p: float | None) -> str:
    if p is None:
        return "the p-value was not available"
    if p < 0.001:
        return "p < 0.001"
    return f"p = {_fmt(p, 3)}"


def _direction(estimate: float | None) -> str:
    if estimate is None:
        return "was associated with"
    return ("was positively associated with" if estimate > 0
            else "was negatively associated with")


# ── Templates ─────────────────────────────────────────────────────────────────

def _linear_regression(r: dict) -> str:
    exposure = r.get("exposure", "the exposure")
    outcome = r.get("outcome", "the outcome")
    beta = r.get("beta") or r.get("coefficient")
    ci_l, ci_u = r.get("ci_lower"), r.get("ci_upper")
    p = r.get("p_value")
    r2 = r.get("r_squared")
    adj_r2 = r.get("adj_r_squared")
    n = r.get("n")

    ci_str = f" (95% CI: {_fmt(ci_l)} to {_fmt(ci_u)})" if ci_l is not None and ci_u is not None else ""
    r2_str = (f" The model explained {_fmt(r2, 1)}% of the variance (adjusted R² = {_fmt(adj_r2, 3)})."
              if r2 is not None else "")
    n_str = f" (n = {n})" if n else ""
    return (f"Linear regression{n_str} indicated that {exposure} {_direction(beta)} {outcome} "
            f"(β = {_fmt(beta)}{ci_str}, {_sig(p)}).{r2_str}")


def _logistic_regression(r: dict) -> str:
    exposure = r.get("exposure", "the exposure")
    outcome = r.get("outcome", "the outcome")
    OR = r.get("odds_ratio") or r.get("OR")
    ci_l, ci_u = r.get("ci_lower"), r.get("ci_upper")
    p = r.get("p_value")
    n = r.get("n")

    ci_str = f" (95% CI: {_fmt(ci_l)} to {_fmt(ci_u)})" if ci_l is not None and ci_u is not None else ""
    n_str = f" (n = {n})" if n else ""
    direction = "increased" if (OR or 1) > 1 else "decreased"
    return (f"Logistic regression{n_str} showed that {exposure} was associated with "
            f"{direction} odds of {outcome} (OR = {_fmt(OR, 3)}{ci_str}, {_sig(p)}).")


def _cox_regression(r: dict) -> str:
    exposure = r.get("exposure", "the exposure")
    outcome = r.get("outcome", "the outcome")
    HR = r.get("hazard_ratio") or r.get("HR")
    ci_l, ci_u = r.get("ci_lower"), r.get("ci_upper")
    p = r.get("p_value")
    n, n_events = r.get("n"), r.get("n_events")

    ci_str = f" (95% CI: {_fmt(ci_l)} to {_fmt(ci_u)})" if ci_l is not None and ci_u is not None else ""
    events_str = f" with {n_events} events" if n_events else ""
    n_str = f" (n = {n}{events_str})" if n else ""
    direction = "increased" if (HR or 1) > 1 else "decreased"
    return (f"Cox proportional hazards regression{n_str} indicated that {exposure} was associated "
            f"with {direction} hazard of {outcome} (HR = {_fmt(HR, 3)}{ci_str}, {_sig(p)}).")


def _t_test(r: dict, *, paired: bool = False) -> str:
    group_a = r.get("group_a", "Group A")
    group_b = r.get("group_b", "Group B")
    outcome = r.get("outcome", "the outcome")
    diff = r.get("mean_difference")
    ci_l, ci_u = r.get("ci_lower"), r.get("ci_upper")
    p = r.get("p_value")
    t_stat, df_val = r.get("t_statistic"), r.get("df")
    mean_a, mean_b = r.get("mean_a"), r.get("mean_b")

    ci_str = f" (95% CI: {_fmt(ci_l)} to {_fmt(ci_u)})" if ci_l is not None and ci_u is not None else ""
    t_str = (f" (t({int(df_val) if df_val else '?'}) = {_fmt(t_stat, 3)})"
             if t_stat is not None else "")
    means_str = (f" Mean {outcome}: {_fmt(mean_a)} in {group_a} vs {_fmt(mean_b)} in {group_b}."
                 if mean_a is not None and mean_b is not None else "")
    sig = "significant" if p and p < 0.05 else "non-significant"
    test_name = "A paired samples t-test" if paired else "An independent samples t-test"
    return (f"{test_name}{t_str} revealed a {sig} difference in {outcome} "
            f"between {group_a} and {group_b} (mean difference = {_fmt(diff)}{ci_str}, {_sig(p)}).{means_str}")


def _anova(r: dict, *, two_way: bool = False) -> str:
    factor = r.get("factor", "the grouping variable")
    outcome = r.get("outcome", "the outcome")
    F_stat = r.get("F_statistic") or r.get("F")
    df1, df2 = r.get("df_between"), r.get("df_within")
    p = r.get("p_value")
    eta_sq = r.get("eta_squared")
    n = r.get("n")

    f_str = (f"F({int(df1) if df1 else '?'}, {int(df2) if df2 else '?'}) = {_fmt(F_stat, 3)}, "
             if F_stat is not None else "")
    eta_str = f" Effect size: η² = {_fmt(eta_sq, 3)}." if eta_sq is not None else ""
    n_str = f" (n = {n})" if n else ""
    sig = "statistically significant" if p and p < 0.05 else "non-significant"
    test_name = "Two-way ANOVA" if two_way else "One-way ANOVA"
    # For two-way designs `factor` names the specific term whose effect is reported.
    term_label = f"the {factor} term" if two_way else factor
    return (f"{test_name}{n_str} revealed a {sig} effect of {term_label} on {outcome} "
            f"({f_str}{_sig(p)}).{eta_str}")


def _chi_square(r: dict, *, fishers: bool = False) -> str:
    var_a = r.get("variable_a", "the exposure")
    var_b = r.get("variable_b", "the outcome")
    chi2 = r.get("chi2_statistic") or r.get("chi2")
    df_val = r.get("df")
    p = r.get("p_value")
    cramers_v = r.get("cramers_v")
    n = r.get("n")

    v_str = f" Cramér's V = {_fmt(cramers_v, 3)}." if cramers_v is not None else ""
    n_str = f" (n = {n})" if n else ""
    sig = "a statistically significant" if p and p < 0.05 else "no statistically significant"
    if fishers:
        # Fisher's exact test does not yield a chi-square statistic or degrees of freedom.
        return (f"Fisher's exact test{n_str} revealed {sig} association between {var_a} and {var_b} "
                f"({_sig(p)}).{v_str}")
    chi_str = (f"χ²({int(df_val) if df_val else '?'}) = {_fmt(chi2, 3)}, "
               if chi2 is not None else "")
    return (f"A chi-square test{n_str} revealed {sig} association between {var_a} and {var_b} "
            f"({chi_str}{_sig(p)}).{v_str}")


def _correlation(r: dict, *, method: str | None = None) -> str:
    var_a = r.get("variable_a", "Variable A")
    var_b = r.get("variable_b", "Variable B")
    rho = r.get("r") or r.get("rho") or r.get("correlation")
    p = r.get("p_value")
    ci_l, ci_u = r.get("ci_lower"), r.get("ci_upper")
    n = r.get("n")
    # Prefer the explicit method from the analysis type; fall back to the result dict.
    resolved = (method or r.get("method") or "pearson").lower()
    is_spearman = resolved.startswith("spearman")
    method_label = "Spearman" if is_spearman else "Pearson"
    # Spearman measures monotonic association on ranks; Pearson measures linear association.
    relationship = "monotonic relationship" if is_spearman else "linear relationship"

    magnitude = (
        "negligible" if abs(rho or 0) < 0.1 else
        "weak" if abs(rho or 0) < 0.3 else
        "moderate" if abs(rho or 0) < 0.5 else
        "strong" if abs(rho or 0) < 0.7 else
        "very strong"
    )
    direction = "positive" if (rho or 0) >= 0 else "negative"
    ci_str = f" (95% CI: {_fmt(ci_l)} to {_fmt(ci_u)})" if ci_l is not None and ci_u is not None else ""
    n_str = f" (n = {n})" if n else ""
    coef = "ρ" if is_spearman else "r"
    return (f"{method_label} correlation{n_str} indicated a {magnitude} {direction} {relationship} "
            f"between {var_a} and {var_b} ({coef} = {_fmt(rho, 3)}{ci_str}, {_sig(p)}).")


def _descriptive(r: dict) -> str:
    variable = r.get("variable", "the variable")
    mean, sd = r.get("mean"), r.get("sd") or r.get("std")
    median = r.get("median")
    q25, q75 = r.get("q25"), r.get("q75")
    n = r.get("n")
    skew = r.get("skewness")

    n_str = f"n = {n}, " if n else ""
    iqr_str = f", IQR: {_fmt(q25)} – {_fmt(q75)}" if q25 is not None and q75 is not None else ""
    skew_label = (
        "approximately symmetric" if abs(skew or 0) < 0.5 else
        "moderately skewed" if abs(skew or 0) < 1.0 else
        "highly skewed"
    )
    skew_str = f" Distribution: {skew_label} (skewness = {_fmt(skew, 3)})." if skew is not None else ""
    return (f"{variable} ({n_str}mean = {_fmt(mean)}, SD = {_fmt(sd)}, "
            f"median = {_fmt(median)}{iqr_str}).{skew_str}")


TEMPLATE_MAP: dict[str, Any] = {
    "linear_regression":            _linear_regression,
    "multiple_linear_regression":   _linear_regression,
    "logistic_regression":          _logistic_regression,
    "cox_regression":               _cox_regression,
    "cox_ph":                       _cox_regression,
    "independent_t_test":           lambda r: _t_test(r, paired=False),
    "t_test":                       lambda r: _t_test(r, paired=False),
    "paired_t_test":                lambda r: _t_test(r, paired=True),
    "one_way_anova":                lambda r: _anova(r, two_way=False),
    "two_way_anova":                lambda r: _anova(r, two_way=True),
    "anova":                        lambda r: _anova(r, two_way=False),
    "chi_square":                   lambda r: _chi_square(r, fishers=False),
    "fishers_exact":                lambda r: _chi_square(r, fishers=True),
    "pearson_correlation":          lambda r: _correlation(r, method="pearson"),
    "spearman_correlation":         lambda r: _correlation(r, method="spearman"),
    "correlation":                  _correlation,
    "descriptive":                  _descriptive,
    "descriptive_statistics":       _descriptive,
}


# Analyses that produce an inferential p-value and therefore warrant the
# estimate-over-p / multiple-comparisons caveat. Descriptive summaries do not.
_INFERENTIAL_TYPES = {
    "linear_regression", "multiple_linear_regression", "logistic_regression",
    "cox_regression", "cox_ph", "independent_t_test", "t_test", "paired_t_test",
    "one_way_anova", "two_way_anova", "anova", "chi_square", "fishers_exact",
    "pearson_correlation", "spearman_correlation", "correlation",
}


def _inferential_caveat(analysis_type: str) -> str:
    """
    A standard methodological caveat appended to inferential narratives, nudging
    the reader toward the effect estimate and its confidence interval rather than
    a dichotomous p < 0.05 verdict, and flagging that the p-value is unadjusted
    for multiple comparisons. Aligns with ASA / Cochrane reporting guidance.
    """
    if analysis_type in _INFERENTIAL_TYPES:
        return (" Interpret the effect estimate and its 95% confidence interval "
                "rather than the p-value alone; the p-value is not adjusted for "
                "multiple comparisons.")
    return ""


def generate_deterministic_narrative(analysis_type: str, result: dict) -> str:
    fn = TEMPLATE_MAP.get(analysis_type)
    if fn:
        try:
            return fn(result) + _inferential_caveat(analysis_type)
        except Exception as e:
            logger.warning(f"Narrative template failed for {analysis_type}: {e}")

    key = result.get("key_result") or result.get("estimate")
    p = result.get("p_value")
    label = analysis_type.replace("_", " ")
    return (f"The {label} analysis yielded a key estimate of {_fmt(key)} ({_sig(p)})."
            + _inferential_caveat(analysis_type))
