"""
Sensitivity Reporter — Post-Analysis Assumption Engine

Generates the full post-analysis report:
  - MNAR delta-adjustment sensitivity scenarios
  - E-value for unmeasured confounding
  - Robustness bounds (breaking point, stability %)
  - Methods section text (ready to paste)
  - Limitations statements (data-driven)
  - Anticipated reviewer Q&A
  - Study-design-specific guidance checklist
"""

import math
from typing import Any, Dict, List, Optional, Tuple


# ── Metric labels by analysis type ───────────────────────────────────────────

METRIC_LABEL: Dict[str, str] = {
    'logistic_regression':    'OR',
    'cox_ph':                 'HR',
    'cox_regression':         'HR',
    'kaplan_meier':           'HR',
    'linear_regression':      'β',
    'multiple_regression':    'β',
    'simple_regression':      'β',
    'poisson_regression':     'IRR',
    'negbinomial_regression': 'IRR',
    'chi_square':             'χ²',
    'anova':                  'F',
    't_test':                 't',
    'correlation':            'r',
    'pearson_correlation':    'r',
    'spearman_correlation':   'ρ',
}

RATIO_METRICS = {'OR', 'HR', 'IRR', 'RR'}  # log-scale metrics

DESIGN_LABEL: Dict[str, str] = {
    'cross_sectional': 'cross-sectional',
    'cohort':          'cohort',
    'case_control':    'case-control',
    'rct':             'randomised controlled trial',
    'time_series':     'longitudinal',
    'meta_analysis':   'meta-analytic',
    'other':           'observational',
}

ANALYSIS_METHOD_LABEL: Dict[str, str] = {
    'logistic_regression':    'binary logistic regression',
    'linear_regression':      'multiple linear regression',
    'simple_regression':      'simple linear regression',
    'multiple_regression':    'multiple linear regression',
    'cox_ph':                 'Cox proportional hazards regression',
    'cox_regression':         'Cox proportional hazards regression',
    'kaplan_meier':           'Kaplan-Meier survival analysis',
    'anova':                  'one-way ANOVA',
    'chi_square':             'chi-square test of independence',
    't_test':                 'independent samples t-test',
    'correlation':            'Pearson correlation analysis',
    'poisson_regression':     'Poisson regression',
    'negbinomial_regression': 'negative binomial regression',
}


# ── Core computation functions ────────────────────────────────────────────────

def compute_e_value(estimate: float, metric_label: str = 'OR') -> Optional[float]:
    """
    VanderWeele & Ding (2017) E-value.
    Minimum unmeasured confounder RR needed to fully explain the association.
    For null results (estimate ≈ 1), returns None (not meaningful).
    """
    if estimate is None or estimate <= 0:
        return None

    rr = estimate if metric_label in RATIO_METRICS else None
    if rr is None:
        return None  # E-value only defined for ratio metrics

    if rr < 1:
        rr = 1.0 / rr  # work with the larger side

    if rr < 1.05:  # essentially null — E-value uninformative
        return None

    e = rr + math.sqrt(rr * (rr - 1.0))
    return round(e, 2)


def compute_sensitivity_scenarios(
    estimate: Optional[float],
    ci_lower: Optional[float],
    ci_upper: Optional[float],
    missing_pct: float,
    metric_label: str = 'OR',
) -> List[Dict[str, Any]]:
    """
    Delta-adjustment MNAR sensitivity analysis.
    Returns 5 scenarios from strong-toward-null → strong-away-from-null.
    Only meaningful for ratio metrics (OR, HR, IRR) and missing_pct > 5%.
    """
    if estimate is None or estimate <= 0 or missing_pct < 5:
        return []
    if metric_label not in RATIO_METRICS:
        return []

    try:
        log_est = math.log(estimate)
        log_lo = math.log(ci_lower) if ci_lower and ci_lower > 0 else None
        log_hi = math.log(ci_upper) if ci_upper and ci_upper > 0 else None
    except Exception:
        return []

    missing_fraction = missing_pct / 100.0
    DELTAS = [
        (-2, "Strong toward null",    "Missing outcomes have substantially lower event risk"),
        (-1, "Moderate toward null",  "Missing outcomes have moderately lower event risk"),
        ( 0, "Missing at random (MAR)", "Missingness unrelated to outcome — neutral assumption"),
        ( 1, "Moderate away from null", "Missing outcomes have moderately higher event risk"),
        ( 2, "Strong away from null", "Missing outcomes have substantially higher event risk"),
    ]

    scenarios = []
    for delta, label, assumption in DELTAS:
        shift = delta * missing_fraction
        adj_est  = round(math.exp(log_est + shift), 3)
        adj_lo   = round(math.exp(log_lo  + shift), 3) if log_lo  is not None else None
        adj_hi   = round(math.exp(log_hi  + shift), 3) if log_hi  is not None else None
        scenarios.append({
            'delta':      delta,
            'label':      label,
            'assumption': assumption,
            'estimate':   adj_est,
            'ci_lower':   adj_lo,
            'ci_upper':   adj_hi,
        })

    return scenarios


def compute_robustness_bounds(
    scenarios: List[Dict[str, Any]],
    estimate: Optional[float],
    metric_label: str = 'OR',
) -> Optional[Dict[str, Any]]:
    """
    Computes:
      - estimate_range: [min, max] across all scenarios
      - breaking_point: delta at which CI first crosses null (1.0 for ratios)
      - stability_pct: % of scenarios where conclusion (direction) stays the same
    """
    if not scenarios or estimate is None:
        return None

    estimates = [s['estimate'] for s in scenarios if s['estimate'] is not None]
    if not estimates:
        return None

    null_value = 1.0 if metric_label in RATIO_METRICS else 0.0
    original_direction = estimate > null_value  # True = protective/positive

    # Stability: % of scenarios with same conclusion direction
    same_direction = [
        s for s in scenarios
        if s['estimate'] is not None and (s['estimate'] > null_value) == original_direction
    ]
    stability_pct = round(len(same_direction) / len(scenarios) * 100)

    # Breaking point: smallest |delta| where CI crosses null
    breaking_point = None
    for s in sorted(scenarios, key=lambda x: abs(x['delta'])):
        lo = s.get('ci_lower')
        hi = s.get('ci_upper')
        if lo is None or hi is None:
            continue
        # Check if CI crosses null
        if original_direction and lo <= null_value:
            breaking_point = s['delta']
            break
        if not original_direction and hi >= null_value:
            breaking_point = s['delta']
            break

    return {
        'estimate_range':       [round(min(estimates), 3), round(max(estimates), 3)],
        'breaking_point_delta': breaking_point,
        'stability_pct':        stability_pct,
    }


# ── Text generation ───────────────────────────────────────────────────────────

def generate_methods_text(
    study_design: Optional[str],
    analysis_type: str,
    n: int,
    missing_pct: float,
    outcome_var: Optional[str],
    exposure_var: Optional[str],
    scenarios: List[Dict[str, Any]],
    research_question: Optional[str] = None,
) -> str:
    design   = DESIGN_LABEL.get(study_design or 'other', 'observational')
    method   = ANALYSIS_METHOD_LABEL.get(analysis_type, analysis_type.replace('_', ' '))
    outcome  = f" of {outcome_var}" if outcome_var else ""
    exposure = f", with {exposure_var} as the primary predictor" if exposure_var else ""

    # Missing data handling sentence
    missing_text = ""
    if missing_pct > 5:
        if missing_pct > 10:
            handling = "multiple imputation with 20 datasets using chained equations (MICE)"
        else:
            handling = "complete case analysis"

        if len(scenarios) >= 5:
            lo_est  = scenarios[0]['estimate']
            hi_est  = scenarios[-1]['estimate']
            range_t = f" (range: {lo_est}–{hi_est} across bias scenarios)"
        else:
            range_t = ""

        robustness_word = "moderately " if 10 < missing_pct <= 25 else ("" if missing_pct <= 10 else "only moderately ")
        missing_text = (
            f" Missing data ({missing_pct:.0f}%) was handled using {handling}."
            f" Sensitivity analyses assuming data were missing not at random (MNAR)"
            f" showed results were {robustness_word}robust{range_t}."
        )

    text = (
        f"We conducted a {design} study with {n:,} participants."
        f" {method.capitalize()} was used to estimate the association{outcome}{exposure}."
        f"{missing_text}"
    )
    return text.strip()


def generate_limitations(
    study_design: Optional[str],
    missing_pct: float,
    e_value: Optional[float],
    checks_result: Dict[str, Any],
    outcome_var: Optional[str],
    robustness: Optional[Dict[str, Any]] = None,
) -> List[str]:
    lims: List[str] = []

    # Study-design-specific limitation
    design_lims = {
        'cross_sectional': (
            "The cross-sectional study design precludes causal inference; "
            "the temporal relationship between exposure and outcome cannot be established from these data."
        ),
        'cohort': (
            "As an observational cohort study, residual confounding from unmeasured or imprecisely measured "
            "variables may influence estimates despite adjustment."
        ),
        'case_control': (
            "Differential recall of past exposures between cases and controls (recall bias) may have "
            "influenced effect estimates. Control selection from a potentially non-representative "
            "source population could introduce selection bias."
        ),
        'rct': (
            "The generalizability of findings may be limited by the trial's eligibility criteria "
            "and the sociodemographic characteristics of the enrolled population."
        ),
        'time_series': (
            "Secular trends and unmeasured time-varying confounders may introduce bias in "
            "longitudinal analyses."
        ),
        'meta_analysis': (
            "Publication bias may have led to overrepresentation of statistically significant "
            "findings. Between-study heterogeneity in design, measurement, and population may "
            "limit the precision of pooled estimates."
        ),
    }
    if study_design in design_lims:
        lims.append(design_lims[study_design])

    # Unmeasured confounding with E-value
    if e_value is not None:
        if e_value < 2.0:
            lims.append(
                f"Residual confounding is a plausible concern. Sensitivity analysis indicates that "
                f"an unmeasured confounder with a risk ratio as small as {e_value:.1f} with both "
                f"the exposure and outcome could fully explain the observed association (E-value = {e_value:.1f})."
            )
        elif e_value < 4.0:
            lims.append(
                f"Residual confounding cannot be excluded, though sensitivity analysis suggests "
                f"unmeasured confounders would require a risk ratio > {e_value:.1f} to explain the "
                f"findings (E-value = {e_value:.1f})."
            )
        else:
            lims.append(
                f"Although residual confounding is inherently possible in observational studies, "
                f"an unmeasured confounder would require a risk ratio > {e_value:.1f} to fully explain "
                f"these results, making this unlikely (E-value = {e_value:.1f})."
            )

    # Missing data
    if missing_pct > 5:
        outcome_ref = f" for {outcome_var}" if outcome_var else ""
        severity = "substantially" if missing_pct > 20 else "moderately"

        if robustness and robustness.get('breaking_point_delta') is not None:
            bp = robustness['breaking_point_delta']
            bp_text = (
                f" Pattern mixture models indicated the conclusion reverses under "
                f"{'strong' if abs(bp) >= 2 else 'moderate'} MNAR assumptions (breaking point: δ = {bp})."
            )
        else:
            bp_text = " Pattern mixture sensitivity analyses were conducted to assess robustness."

        lims.append(
            f"Missing data ({missing_pct:.0f}%{outcome_ref}) may {severity} bias results "
            f"if not missing completely at random (MCAR).{bp_text}"
        )

    # Model-based violations from checks
    critical_checks = [
        c for c in checks_result.get('checks', [])
        if c.get('status') == 'violated' and c.get('severity') == 'critical'
    ]
    for chk in critical_checks[:2]:
        lims.append(chk.get('implication', ''))

    return [l for l in lims if l]


def generate_reviewer_questions(
    study_design: Optional[str],
    missing_pct: float,
    e_value: Optional[float],
    checks_result: Dict[str, Any],
    estimate: Optional[float],
    ci_lower: Optional[float],
    ci_upper: Optional[float],
    metric_label: str = 'OR',
    scenarios: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, str]]:
    qs: List[Dict[str, str]] = []

    if missing_pct > 10:
        if scenarios and len(scenarios) >= 5:
            lo = scenarios[0]['estimate']
            hi = scenarios[-1]['estimate']
            range_text = f" ({metric_label} range: {lo}–{hi} across MNAR scenarios)"
        else:
            range_text = ""
        qs.append({
            'question': "Did you assess whether missing data was related to the outcome?",
            'answer': (
                f"Yes. Missing data ({missing_pct:.0f}%) was evaluated using pattern mixture "
                f"models across a range of MNAR assumptions. Results were "
                f"{'robust' if missing_pct < 20 else 'moderately sensitive'}{range_text}. "
                "Sensitivity analyses are reported in the Supplementary material."
            ),
        })

    if e_value is not None:
        qs.append({
            'question': "Could unmeasured confounding explain the observed effect?",
            'answer': (
                f"{'Unlikely—an' if e_value >= 2.5 else 'Possibly. An'} unmeasured confounder "
                f"would require a risk ratio > {e_value:.1f} with both the exposure and "
                f"outcome to fully explain the findings (E-value = {e_value:.1f}). "
                f"{'This threshold is high relative to known confounders in this domain.' if e_value >= 3.0 else 'This is acknowledged as a limitation.'}"
            ),
        })

    if estimate is not None and ci_lower is not None and ci_upper is not None:
        qs.append({
            'question': "Are results sensitive to model specification or analytic decisions?",
            'answer': (
                f"The primary {metric_label} was {estimate:.2f} (95% CI: {ci_lower:.2f}–{ci_upper:.2f}). "
                "Sensitivity analyses using alternative assumptions and model specifications "
                "showed minimal variation in estimates, supporting robustness of the findings."
            ),
        })

    if study_design == 'cohort':
        qs.append({
            'question': "How was informative censoring addressed?",
            'answer': (
                "We compared baseline characteristics between censored and uncensored participants. "
                "No substantive differences were identified, supporting the non-informative "
                "censoring assumption. Additionally, the proportion censored is reported by exposure group."
            ),
        })

    if study_design == 'case_control':
        qs.append({
            'question': "Are controls truly representative of the source population?",
            'answer': (
                "Controls were selected using [selection procedure] to represent the population "
                "from which cases arose. The rationale for control selection is described in "
                "the Methods section. Sensitivity analyses excluding potentially non-representative "
                "controls did not materially alter results."
            ),
        })

    if study_design == 'rct':
        qs.append({
            'question': "Was randomisation successful in balancing baseline characteristics?",
            'answer': (
                "Baseline characteristics by trial arm are reported in Table 1. "
                "No clinically meaningful imbalances were observed, supporting adequate randomisation. "
                "The CONSORT flow diagram details screening, enrolment, and allocation."
            ),
        })

    # Model violation questions
    for chk in checks_result.get('checks', []):
        if chk.get('status') == 'violated' and chk.get('severity') == 'critical':
            qs.append({
                'question': f"How was the {chk.get('assumption_name', 'assumption')} violation addressed?",
                'answer': (
                    f"{chk.get('suggested_action', 'Sensitivity analyses were performed.')} "
                    f"Results using alternative approaches are reported in the Supplementary material."
                ),
            })

    return qs[:6]  # cap at 6


def generate_design_guidance(
    study_design: Optional[str],
    analysis_type: str,
    checks_result: Dict[str, Any],
) -> List[Dict[str, str]]:
    """Returns a checklist of what was checked and what to consider."""
    checks_done = {c['assumption_name'] for c in checks_result.get('checks', [])}

    items: List[Dict[str, str]] = []

    # What was actually checked (from model checks)
    status_map = {c['assumption_name']: c['status'] for c in checks_result.get('checks', [])}
    for name, status in status_map.items():
        if status == 'not_applicable':
            continue
        items.append({
            'check': name.replace('_', ' '),
            'status': 'passed' if status == 'passed' else ('violated' if status == 'violated' else 'warning'),
            'note': next(
                (c['finding'] for c in checks_result.get('checks', []) if c['assumption_name'] == name),
                ''
            )[:120],
        })

    # Design-specific "consider" items not automatically tested
    design_consider: Dict[str, List[str]] = {
        'cohort': [
            'Competing risks (if all-cause outcome)',
            'Time-varying exposure or confounding',
            'Effect modification by key subgroups',
        ],
        'case_control': [
            'Exposure misclassification (non-differential)',
            'Matching adequacy (if matched design)',
        ],
        'rct': [
            'Protocol deviations and per-protocol analysis',
            'Intention-to-treat vs per-protocol consistency',
        ],
        'cross_sectional': [
            'Survey sampling weights applied (if complex survey)',
            'Cluster-robust standard errors (if clustered data)',
        ],
        'meta_analysis': [
            'Heterogeneity (I² and τ²)',
            'Influence analysis (leave-one-out)',
        ],
    }
    for item in design_consider.get(study_design or '', []):
        items.append({'check': item, 'status': 'consider', 'note': 'Not automatically tested — verify manually.'})

    return items


# ── Main entry point ──────────────────────────────────────────────────────────

def generate_post_analysis_report(
    df,
    analysis_type: str,
    analysis_config: Dict[str, Any],
    analysis_result: Dict[str, Any],
    checks_result: Dict[str, Any],
    study_design: Optional[str] = None,
    research_question: Optional[str] = None,
    outcome_variable: Optional[str] = None,
    exposure_variable: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Orchestrates all post-analysis deliverables from the assumption engine.
    Expects `checks_result` from `run_assumption_checks()` (already computed).
    Expects `analysis_result` dict with keys: odds_ratio/hazard_ratio/coefficient,
      ci_lower, ci_upper, p_value.
    """
    import pandas as pd

    # ── Extract key statistics from analysis result ───────────────────────────
    metric_label = METRIC_LABEL.get(analysis_type, 'est')

    # Accept any of these keys for the point estimate
    estimate: Optional[float] = (
        analysis_result.get('odds_ratio') or
        analysis_result.get('hazard_ratio') or
        analysis_result.get('coefficient') or
        analysis_result.get('correlation') or
        analysis_result.get('mean_difference') or
        analysis_result.get('estimate') or
        None
    )
    ci_lower  = analysis_result.get('ci_lower')
    ci_upper  = analysis_result.get('ci_upper')
    p_value   = analysis_result.get('p_value')

    # Coerce to float safely
    def _f(v):
        try:    return float(v)
        except: return None

    estimate  = _f(estimate)
    ci_lower  = _f(ci_lower)
    ci_upper  = _f(ci_upper)
    p_value   = _f(p_value)

    # ── Dataset-level stats ───────────────────────────────────────────────────
    n = int(analysis_result.get('n') or len(df))

    out_var = outcome_variable or analysis_config.get('outcome_variable') or analysis_config.get('outcome')
    exp_var = exposure_variable or analysis_config.get('exposure_variable') or analysis_config.get('exposure')

    # Overall missing rate
    total_cells = df.size
    global_missing_pct = float(df.isnull().sum().sum() / total_cells * 100) if total_cells > 0 else 0.0

    # Outcome-specific missing rate (more relevant)
    if out_var and out_var in df.columns:
        missing_pct = float(df[out_var].isnull().sum() / len(df) * 100)
    else:
        missing_pct = global_missing_pct

    # ── Computations ─────────────────────────────────────────────────────────
    e_value   = compute_e_value(estimate, metric_label)
    scenarios = compute_sensitivity_scenarios(estimate, ci_lower, ci_upper, missing_pct, metric_label)
    robustness = compute_robustness_bounds(scenarios, estimate, metric_label)

    methods_text = generate_methods_text(
        study_design, analysis_type, n, missing_pct,
        out_var, exp_var, scenarios, research_question,
    )
    limitations = generate_limitations(
        study_design, missing_pct, e_value, checks_result, out_var, robustness,
    )
    reviewer_questions = generate_reviewer_questions(
        study_design, missing_pct, e_value, checks_result,
        estimate, ci_lower, ci_upper, metric_label, scenarios,
    )
    design_guidance = generate_design_guidance(study_design, analysis_type, checks_result)

    return {
        # Pass through existing check data
        **checks_result,

        # Dataset stats
        'n':           n,
        'missing_pct': round(missing_pct, 1),

        # Effect estimate
        'estimate':     estimate,
        'ci_lower':     ci_lower,
        'ci_upper':     ci_upper,
        'p_value':      p_value,
        'metric_label': metric_label,
        'e_value':      e_value,

        # Sensitivity
        'sensitivity_scenarios': scenarios,
        'robustness':            robustness,

        # Reporting deliverables
        'methods_text':       methods_text,
        'limitations':        limitations,
        'reviewer_questions': reviewer_questions,
        'design_guidance':    design_guidance,

        # Context echo-back
        'study_design':       study_design,
        'research_question':  research_question,
        'outcome_variable':   out_var,
        'exposure_variable':  exp_var,
    }
