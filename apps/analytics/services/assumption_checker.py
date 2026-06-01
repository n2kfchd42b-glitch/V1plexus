"""
Statistical Assumption Verification Engine (Phase 4)

Automated checks for assumed statistical assumptions across various analysis types.
Used to gate analysis execution and require researcher acknowledgement of violations.
"""

import pandas as pd
import numpy as np
from typing import Any, Dict, List, Optional
from scipy import stats
from scipy.stats import shapiro, levene, chi2_contingency
from statsmodels.stats.outliers_influence import variance_inflation_factor
import statsmodels.api as sm


class AssumptionCheck:
    """Single assumption check result"""
    
    def __init__(
        self,
        assumption_name: str,
        description: str,
        status: str,  # 'passed', 'violated', 'warning', 'not_applicable'
        severity: str,  # 'critical', 'moderate', 'minor'
        finding: str,
        implication: str,
        test_used: Optional[str] = None,
        statistic: Optional[float] = None,
        p_value: Optional[float] = None,
        suggested_action: Optional[str] = None,
        alternative_tests: Optional[List[str]] = None,
        variable_affected: Optional[str] = None,
    ):
        self.assumption_name = assumption_name
        self.description = description
        self.status = status
        self.severity = severity
        self.finding = finding
        self.implication = implication
        self.test_used = test_used
        self.statistic = statistic
        self.p_value = p_value
        self.suggested_action = suggested_action
        self.alternative_tests = alternative_tests or []
        self.variable_affected = variable_affected

    def to_dict(self) -> Dict[str, Any]:
        return {
            'assumption_name': self.assumption_name,
            'description': self.description,
            'status': self.status,
            'severity': self.severity,
            'test_used': self.test_used,
            'statistic': self.statistic,
            'p_value': self.p_value,
            'finding': self.finding,
            'implication': self.implication,
            'suggested_action': self.suggested_action,
            'alternative_tests': self.alternative_tests,
            'variable_affected': self.variable_affected,
        }


def run_assumption_checks(
    df: pd.DataFrame,
    analysis_type: str,
    analysis_config: Dict[str, Any],
    study_design: Optional[str] = None,
    research_question: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main entry point for assumption verification.

    Args:
        df: The dataset as a pandas DataFrame
        analysis_type: Type of analysis (e.g., 'logistic_regression', 'chi_square')
        analysis_config: Configuration dict with outcome, predictors, grouping, etc.
        study_design: Declared study design (cross_sectional, cohort, case_control, rct, …)
        research_question: Free-text research question for context (unused in computation)

    Returns:
        Dict with checks, all_passed, violations counts, recommendation
    """

    checks: List[AssumptionCheck] = []

    # Dispatch to model-specific checker
    if analysis_type == 'logistic_regression':
        checks = check_logistic_regression(df, analysis_config)
    elif analysis_type in ['kaplan_meier', 'cox_ph']:
        checks = check_survival(df, analysis_config, analysis_type)
    elif analysis_type == 'linear_regression':
        checks = check_linear_regression(df, analysis_config)
    elif analysis_type == 'chi_square':
        checks = check_chi_square(df, analysis_config)
    elif analysis_type == 'anova':
        checks = check_anova(df, analysis_config)
    elif analysis_type == 'descriptive':
        checks = check_descriptive(df, analysis_config)
    else:
        # Unknown type — return a clean pass and let study-design checks still run below
        pass

    # Append study-design-aware checks (always runs when design is declared)
    if study_design:
        checks.extend(get_study_design_checks(df, study_design, analysis_type, analysis_config))

    if not checks:
        return {
            'analysis_type': analysis_type,
            'checks': [],
            'all_passed': True,
            'critical_violations': 0,
            'moderate_violations': 0,
            'minor_violations': 0,
            'not_applicable_count': 0,
            'run_recommendation': 'proceed'
        }

    # Count violations by severity
    critical = len([c for c in checks if c.status == 'violated' and c.severity == 'critical'])
    moderate = len([c for c in checks if c.status == 'violated' and c.severity == 'moderate'])
    minor = len([c for c in checks if c.status in ['violated', 'warning'] and c.severity == 'minor'])
    not_applicable = len([c for c in checks if c.status == 'not_applicable'])

    all_passed = critical == 0 and moderate == 0

    if critical > 0:
        recommendation = 'consider_alternatives'
    elif moderate > 0:
        recommendation = 'proceed_with_caution'
    else:
        recommendation = 'proceed'

    return {
        'analysis_type': analysis_type,
        'checks': [c.to_dict() for c in checks],
        'all_passed': all_passed,
        'critical_violations': critical,
        'moderate_violations': moderate,
        'minor_violations': minor,
        'not_applicable_count': not_applicable,
        'run_recommendation': recommendation,
    }


# ============================================================================
# STUDY-DESIGN CONTEXT CHECKS
# ============================================================================

def get_study_design_checks(
    df: pd.DataFrame,
    study_design: str,
    analysis_type: str,
    config: Dict[str, Any],
) -> List[AssumptionCheck]:
    """
    Returns qualitative assumption checks driven by the declared study design.
    These supplement (not replace) model-specific checks.
    """
    checks: List[AssumptionCheck] = []

    # ── Global: missing data rate ─────────────────────────────────────────────
    try:
        total_cells = df.size
        if total_cells > 0:
            missing_pct = df.isnull().sum().sum() / total_cells * 100
            if missing_pct > 30:
                checks.append(AssumptionCheck(
                    assumption_name='Missing data mechanism',
                    description='High missingness can bias results if data are not missing completely at random (MCAR).',
                    status='violated',
                    severity='critical',
                    finding=f'{missing_pct:.1f}% of all data cells are missing.',
                    implication='Results are likely biased. Complete-case analysis will discard substantial data.',
                    suggested_action='Use multiple imputation (MICE) and report a sensitivity analysis under MNAR assumptions.',
                    alternative_tests=['Multiple imputation (MICE)', 'Maximum likelihood estimation'],
                ))
            elif missing_pct > 15:
                checks.append(AssumptionCheck(
                    assumption_name='Missing data mechanism',
                    description='High missingness can bias results if data are not missing completely at random (MCAR).',
                    status='warning',
                    severity='moderate',
                    finding=f'{missing_pct:.1f}% of all data cells are missing.',
                    implication='Results may be biased if missingness is related to the outcome.',
                    suggested_action='Assess missingness patterns. Consider multiple imputation if missingness is not random.',
                    alternative_tests=['Multiple imputation (MICE)', 'Complete case sensitivity analysis'],
                ))
    except Exception:
        pass

    # ── Design-specific checks ────────────────────────────────────────────────
    if study_design == 'cross_sectional':
        checks.append(AssumptionCheck(
            assumption_name='Reverse causation',
            description='Cross-sectional data cannot establish temporal order between exposure and outcome.',
            status='not_applicable',
            severity='moderate',
            finding='Design: cross-sectional. Temporal sequence cannot be established statistically.',
            implication='The observed association may reflect reverse causation — the outcome may precede or cause the exposure.',
            suggested_action=(
                'Justify the causal direction on biological or contextual grounds. '
                'Acknowledge reverse causation as a limitation in your discussion.'
            ),
        ))

    elif study_design == 'cohort':
        checks.append(AssumptionCheck(
            assumption_name='Non-informative censoring',
            description='Participants lost to follow-up should be censored for reasons unrelated to the outcome.',
            status='not_applicable',
            severity='moderate',
            finding='Design: cohort. Censoring mechanism cannot be verified from observed data alone.',
            implication='Informative censoring (dropout related to outcome risk) will bias survival or incidence estimates.',
            suggested_action=(
                'Compare baseline characteristics of censored vs. event participants. '
                'Report reasons for dropout. Consider sensitivity analysis assuming worst-case outcomes for censored participants.'
            ),
        ))

        # Exposure group imbalance
        exposure_var = config.get('exposure_variable') or config.get('exposure')
        if exposure_var and exposure_var in df.columns:
            try:
                counts = df[exposure_var].dropna().value_counts()
                if len(counts) == 2:
                    ratio = max(counts) / min(counts)
                    if ratio > 3:
                        checks.append(AssumptionCheck(
                            assumption_name='Exposure group balance',
                            description='Highly imbalanced groups reduce precision and may introduce sparse-data bias.',
                            status='warning',
                            severity='minor',
                            finding=f'Exposure group imbalance: largest to smallest group ratio = {ratio:.1f}:1.',
                            implication='Unequal group sizes reduce statistical power and precision of the effect estimate.',
                            suggested_action='Consider propensity score matching or inverse probability of treatment weighting (IPTW).',
                            alternative_tests=['Propensity score matching', 'IPTW'],
                        ))
            except Exception:
                pass

    elif study_design == 'case_control':
        checks.append(AssumptionCheck(
            assumption_name='Recall bias',
            description='Cases may recall past exposures differently from controls, distorting the odds ratio.',
            status='not_applicable',
            severity='moderate',
            finding='Design: case-control. Differential recall cannot be quantified from the dataset.',
            implication='Recall bias will inflate or deflate the estimated odds ratio depending on direction of differential recall.',
            suggested_action=(
                'Use validated, structured questionnaires. Blind interviewers to case/control status. '
                'Consider record-based exposure measures where available.'
            ),
        ))
        checks.append(AssumptionCheck(
            assumption_name='Selection bias',
            description='Controls must represent the population from which cases arose.',
            status='not_applicable',
            severity='moderate',
            finding='Design: case-control. Control representativeness cannot be verified statistically.',
            implication='Non-representative controls (e.g., hospital convenience sample) will bias the odds ratio.',
            suggested_action=(
                'Describe the control selection procedure in your methods. '
                'Verify controls come from the same source population as cases.'
            ),
        ))

    elif study_design == 'rct':
        checks.append(AssumptionCheck(
            assumption_name='Randomisation integrity',
            description='Randomisation should produce well-balanced groups at baseline across key confounders.',
            status='not_applicable',
            severity='minor',
            finding='Design: RCT. Formal balance assessment requires a Table 1 comparison by trial arm.',
            implication='Imbalanced baseline characteristics suggest randomisation failure or post-randomisation attrition.',
            suggested_action=(
                'Report Table 1 (baseline characteristics stratified by arm). '
                'Test for balance on key confounders. Report the CONSORT flow diagram.'
            ),
        ))

    elif study_design == 'meta_analysis':
        checks.append(AssumptionCheck(
            assumption_name='Publication bias',
            description='Studies with non-significant or negative results are less likely to be published.',
            status='not_applicable',
            severity='moderate',
            finding='Design: meta-analysis. Publication bias assessment requires pooled study-level data.',
            implication='If publication bias is present, the pooled effect estimate will be inflated toward significance.',
            suggested_action=(
                'Conduct funnel plot inspection and Egger\'s test for small-study effects. '
                'Apply the trim-and-fill method if asymmetry is detected.'
            ),
            alternative_tests=["Egger's test", 'Trim-and-fill analysis'],
        ))

    return checks


# ============================================================================
# LOGISTIC REGRESSION CHECKS
# ============================================================================

def check_logistic_regression(
    df: pd.DataFrame,
    config: Dict[str, Any],
) -> List[AssumptionCheck]:
    """Check assumptions for logistic regression"""

    checks = []
    outcome_var = config.get('outcome_variable') or config.get('outcome')
    predictors = config.get('predictors', [])
    
    if not outcome_var or not predictors:
        return checks
    
    try:
        X = df[predictors].copy()
        y = df[outcome_var].copy()
        
        # Remove rows with missing values
        valid_idx = X.notna().all(axis=1) & y.notna()
        X = X[valid_idx]
        y = y[valid_idx]
        
        if len(X) == 0:
            return checks
        
        # 1. MULTICOLLINEARITY CHECK (VIF)
        numeric_predictors = [p for p in predictors if pd.api.types.is_numeric_dtype(df[p])]
        if len(numeric_predictors) > 1:
            try:
                X_numeric = X[numeric_predictors].copy()
                X_numeric = X_numeric.fillna(X_numeric.mean())
                
                # VIF requires an intercept in the design matrix. Without a
                # constant column the auxiliary regressions are forced through
                # the origin, inflating R² and reporting spuriously high VIFs
                # (and false multicollinearity violations).
                X_vif = sm.add_constant(X_numeric)
                vif_values = []
                for i in range(1, X_vif.shape[1]):  # skip the constant at index 0
                    try:
                        vif = variance_inflation_factor(X_vif.values, i)
                        vif_values.append((numeric_predictors[i - 1], vif))
                    except Exception:
                        pass
                
                high_vif = [v for v in vif_values if v[1] > 5]
                
                if high_vif:
                    max_vif = max(high_vif, key=lambda x: x[1])
                    if any(v[1] > 10 for v in high_vif):
                        status = 'violated'
                        severity = 'critical'
                        implication = 'Strong multicollinearity detected. Standard errors may be inflated and coefficients unstable.'
                    else:
                        status = 'violated'
                        severity = 'moderate'
                        implication = 'Moderate multicollinearity detected. Coefficients may be unstable.'
                    
                    finding = f"VIF values > 5: {', '.join([f'{v[0]} (VIF={v[1]:.2f})' for v in high_vif])}"
                    
                    checks.append(AssumptionCheck(
                        assumption_name='No multicollinearity',
                        description='Predictor variables should not be highly correlated with each other.',
                        status=status,
                        severity=severity,
                        test_used='Variance Inflation Factor (VIF)',
                        finding=finding,
                        implication=implication,
                        suggested_action='Remove or combine highly correlated predictors. Consider ridge regression or PCA.',
                        alternative_tests=['Ridge regression', 'Principal Component Analysis'],
                    ))
                else:
                    checks.append(AssumptionCheck(
                        assumption_name='No multicollinearity',
                        description='Predictor variables should not be highly correlated with each other.',
                        status='passed',
                        severity='minor',
                        finding=f'All VIF values <= 5 (max: {max(v[1] for v in vif_values):.2f})',
                        implication='No multicollinearity detected.',
                        test_used='Variance Inflation Factor (VIF)',
                    ))
            except Exception as e:
                pass
        
        # 2. SAMPLE SIZE ADEQUACY (EPV >= 10)
        n_events = min((y == 1).sum(), (y == 0).sum())
        n_predictors = len(predictors)
        epv = n_events / n_predictors if n_predictors > 0 else 0
        
        if epv < 5:
            status = 'violated'
            severity = 'critical'
            suggested = 'Reduce number of predictors or collect more data. Use penalized regression methods.'
        elif epv < 10:
            status = 'violated'
            severity = 'moderate'
            suggested = 'Consider reducing predictors or penalized regression (ridge, elastic net).'
        else:
            status = 'passed'
            severity = 'minor'
            suggested = None
        
        checks.append(AssumptionCheck(
            assumption_name='Adequate sample size',
            description='Logistic regression requires minimum 10 events per predictor (EPV >= 10).',
            status=status,
            severity=severity,
            finding=f'EPV = {epv:.1f} ({n_events} events, {n_predictors} predictors)',
            implication='Low EPV may lead to overfitting and unstable estimates.' if status != 'passed' else 'Adequate events for stable estimation.',
            suggested_action=suggested,
            alternative_tests=['Penalized logistics', 'Bayesian logistic regression'] if status != 'passed' else None,
        ))
        
        # 3. OUTCOME BALANCE
        outcome_counts = y.value_counts()
        minority_pct = min(outcome_counts) / len(y) * 100 if len(outcome_counts) == 2 else 50
        
        if minority_pct < 5:
            status = 'violated'
            severity = 'moderate'
            implication = 'Highly imbalanced outcomes can bias estimates and inflate false discovery rates.'
            suggested = 'Use SMOTE oversampling, case-weighted regression, or report sensitivity/specificity.'
        elif minority_pct < 10:
            status = 'warning'
            severity = 'minor'
            implication = 'Slightly imbalanced outcomes may affect estimates mildly.'
            suggested = None
        else:
            status = 'passed'
            severity = 'minor'
            implication = 'Adequate outcome balance.'
            suggested = None
        
        checks.append(AssumptionCheck(
            assumption_name='Adequate outcome distribution',
            description='Highly imbalanced outcomes can bias logistic regression estimates.',
            status=status,
            severity=severity,
            finding=f'{minority_pct:.1f}% minority class',
            implication=implication,
            suggested_action=suggested,
        ))
        
    except Exception as e:
        pass
    
    return checks


# ============================================================================
# LINEAR REGRESSION CHECKS
# ============================================================================

def check_linear_regression(
    df: pd.DataFrame,
    config: Dict[str, Any],
) -> List[AssumptionCheck]:
    """Check assumptions for linear regression"""

    checks = []
    outcome_var = config.get('outcome_variable') or config.get('dependent')
    predictors = config.get('predictors') or config.get('independents', [])
    
    if not outcome_var or not predictors:
        return checks
    
    try:
        X = df[predictors].copy()
        y = df[outcome_var].copy()
        
        valid_idx = X.notna().all(axis=1) & y.notna()
        X = X[valid_idx]
        y = y[valid_idx]
        
        if len(X) < 10:
            return checks
        
        # Fit OLS to get residuals
        X_const = sm.add_constant(X)
        model = sm.OLS(y, X_const).fit()
        residuals = model.resid
        
        # 1. NORMALITY OF RESIDUALS (Shapiro-Wilk)
        try:
            stat_val, p_val = shapiro(residuals)
            
            if p_val < 0.01:
                checks.append(AssumptionCheck(
                    assumption_name='Normality of residuals',
                    description='Residuals should be approximately normally distributed.',
                    status='violated',
                    severity='moderate',
                    test_used='Shapiro-Wilk',
                    statistic=stat_val,
                    p_value=p_val,
                    finding=f'Shapiro-Wilk W={stat_val:.4f}, p={p_val:.4f} — non-normal distribution detected.',
                    implication='Standard errors may be inaccurate. Results may be unreliable.',
                    suggested_action='Use robust standard errors or consider transformation/non-parametric alternative.',
                    alternative_tests=['Bootstrap regression', 'Robust standard errors', 'Quantile regression'],
                ))
            elif p_val < 0.05:
                checks.append(AssumptionCheck(
                    assumption_name='Normality of residuals',
                    description='Residuals should be approximately normally distributed.',
                    status='warning',
                    severity='minor',
                    test_used='Shapiro-Wilk',
                    statistic=stat_val,
                    p_value=p_val,
                    finding=f'Shapiro-Wilk W={stat_val:.4f}, p={p_val:.4f} — slight deviation from normality.',
                    implication='Minor deviation from normality detected.',
                    alternative_tests=['Robust standard errors'],
                ))
            else:
                checks.append(AssumptionCheck(
                    assumption_name='Normality of residuals',
                    description='Residuals should be approximately normally distributed.',
                    status='passed',
                    severity='minor',
                    test_used='Shapiro-Wilk',
                    statistic=stat_val,
                    p_value=p_val,
                    finding=f'Shapiro-Wilk W={stat_val:.4f}, p={p_val:.4f} — residuals approximately normal.',
                    implication='Normality assumption satisfied.',
                ))
        except:
            pass
        
        # 2. HOMOSCEDASTICITY (Breusch-Pagan)
        try:
            from statsmodels.stats.diagnostic import het_breuschpagan
            
            bp_result = het_breuschpagan(residuals, X_const)
            lm_stat = bp_result[0]
            p_val = bp_result[1]
            
            if p_val < 0.05:
                checks.append(AssumptionCheck(
                    assumption_name='Homoscedasticity',
                    description='Residual variance should be constant across fitted values.',
                    status='violated',
                    severity='moderate',
                    test_used='Breusch-Pagan',
                    statistic=lm_stat,
                    p_value=p_val,
                    finding=f'Breusch-Pagan LM={lm_stat:.4f}, p={p_val:.4f} — heteroscedasticity detected.',
                    implication='Standard errors are biased. Confidence intervals unreliable.',
                    suggested_action='Use heteroscedasticity-robust standard errors (HC3) or weighted least squares.',
                    alternative_tests=['Weighted least squares', 'Quantile regression'],
                ))
            else:
                checks.append(AssumptionCheck(
                    assumption_name='Homoscedasticity',
                    description='Residual variance should be constant across fitted values.',
                    status='passed',
                    severity='minor',
                    test_used='Breusch-Pagan',
                    statistic=lm_stat,
                    p_value=p_val,
                    finding=f'Breusch-Pagan p={p_val:.4f} — homoscedasticity assumption satisfied.',
                    implication='Residual variance is approximately constant.',
                ))
        except:
            pass
        
        # 3. MULTICOLLINEARITY (VIF)
        numeric_predictors = [p for p in predictors if pd.api.types.is_numeric_dtype(df[p])]
        if len(numeric_predictors) > 1:
            try:
                X_numeric = X[numeric_predictors].copy()
                X_numeric = X_numeric.fillna(X_numeric.mean())
                
                # VIF requires an intercept in the design matrix. Without a
                # constant column the auxiliary regressions are forced through
                # the origin, inflating R² and reporting spuriously high VIFs
                # (and false multicollinearity violations).
                X_vif = sm.add_constant(X_numeric)
                vif_values = []
                for i in range(1, X_vif.shape[1]):  # skip the constant at index 0
                    try:
                        vif = variance_inflation_factor(X_vif.values, i)
                        vif_values.append((numeric_predictors[i - 1], vif))
                    except Exception:
                        pass
                
                high_vif = [v for v in vif_values if v[1] > 5]
                
                if high_vif:
                    if any(v[1] > 10 for v in high_vif):
                        severity = 'critical'
                    else:
                        severity = 'moderate'
                    
                    checks.append(AssumptionCheck(
                        assumption_name='No multicollinearity',
                        description='Predictor variables should not be highly correlated.',
                        status='violated',
                        severity=severity,
                        test_used='Variance Inflation Factor (VIF)',
                        finding=f"VIF > 5: {', '.join([f'{v[0]} (VIF={v[1]:.2f})' for v in high_vif])}",
                        implication='Coefficients unstable and difficult to interpret.',
                        suggested_action='Remove or combine correlated predictors.',
                        alternative_tests=['Ridge regression', 'PCA'],
                    ))
                else:
                    checks.append(AssumptionCheck(
                        assumption_name='No multicollinearity',
                        description='Predictor variables should not be highly correlated.',
                        status='passed',
                        severity='minor',
                        test_used='Variance Inflation Factor (VIF)',
                        finding=f"All VIF <= 5 (max: {max(v[1] for v in vif_values):.2f})",
                        implication='No problematic multicollinearity detected.',
                    ))
            except:
                pass
        
        # 4. INFLUENTIAL OBSERVATIONS (Cook's Distance)
        try:
            influence = model.get_influence()
            cooks_d = influence.cooks_distance[0]
            threshold = 4 / len(df)
            influential_count = (cooks_d > threshold).sum()
            influential_pct = (influential_count / len(df)) * 100
            
            if influential_pct > 5:
                checks.append(AssumptionCheck(
                    assumption_name='No highly influential observations',
                    description='Single observations should not dominate the regression.',
                    status='violated',
                    severity='moderate',
                    finding=f'{influential_count} influential observations ({influential_pct:.1f}% of data, Cook\'s D > {threshold:.4f})',
                    implication='Results heavily influenced by few observations. Results may not generalize.',
                    suggested_action='Investigate outliers. Consider robust regression or sensitivity analysis.',
                    alternative_tests=['Robust regression', 'Quantile regression'],
                ))
            elif influential_count > 0:
                checks.append(AssumptionCheck(
                    assumption_name='No highly influential observations',
                    description='Single observations should not dominate the regression.',
                    status='warning',
                    severity='minor',
                    finding=f'{influential_count} influential observations detected.',
                    implication='Minor influential observations detected. Review recommended.',
                ))
            else:
                checks.append(AssumptionCheck(
                    assumption_name='No highly influential observations',
                    description='Single observations should not dominate the regression.',
                    status='passed',
                    severity='minor',
                    finding='No influential observations detected.',
                    implication='No highly influential observations detected.',
                ))
        except:
            pass
        
    except Exception as e:
        pass
    
    return checks


# ============================================================================
# CHI-SQUARE CHECKS
# ============================================================================

def check_chi_square(
    df: pd.DataFrame,
    config: Dict[str, Any],
) -> List[AssumptionCheck]:
    """Check assumptions for chi-square test"""

    checks = []
    var1 = config.get('variable_1') or config.get('variable1')
    var2 = config.get('variable_2') or config.get('variable2')
    
    if not var1 or not var2:
        return checks
    
    try:
        # Build contingency table
        ct = pd.crosstab(df[var1], df[var2])
        chi2, p, dof, expected = chi2_contingency(ct)
        
        # 1. MINIMUM EXPECTED CELL FREQUENCY
        below_5 = (expected < 5).sum()
        below_1 = (expected < 1).sum()
        pct_below_5 = below_5 / expected.size
        
        if below_1 > 0:
            checks.append(AssumptionCheck(
                assumption_name='Minimum expected cell frequency',
                description='Chi-square requires expected frequency >= 5 in at least 80% of cells.',
                status='violated',
                severity='critical',
                test_used='Chi-square goodness of fit',
                finding=f'{below_1} cells with expected frequency < 1, {below_5} cells < 5 ({pct_below_5*100:.1f}%)',
                implication='Chi-square test is invalid. Use Fisher\'s exact test instead.',
                alternative_tests=['Fisher\'s exact test'],
            ))
        elif pct_below_5 > 0.20:
            checks.append(AssumptionCheck(
                assumption_name='Minimum expected cell frequency',
                description='Chi-square requires expected frequency >= 5 in at least 80% of cells.',
                status='violated',
                severity='moderate',
                test_used='Chi-square goodness of fit',
                finding=f'{below_5} cells with expected frequency < 5 ({pct_below_5*100:.1f}%)',
                implication='Chi-square test may be invalid. Consider Fisher\'s exact or larger sample.',
                alternative_tests=['Fisher\'s exact test', 'Yates\' correction'],
            ))
        else:
            checks.append(AssumptionCheck(
                assumption_name='Minimum expected cell frequency',
                description='Chi-square requires expected frequency >= 5 in at least 80% of cells.',
                status='passed',
                severity='minor',
                finding=f'All cells have expected frequency >= 5',
                implication='Minimum cell frequency assumption satisfied.',
            ))
        
        # 2. INDEPENDENCE OF OBSERVATIONS
        # This cannot be statistically tested - raise as not_applicable
        checks.append(AssumptionCheck(
            assumption_name='Independence of observations',
            description='Each participant should appear only once.',
            status='not_applicable',
            severity='moderate',
            finding='Cannot be statistically verified.',
            implication='Researcher must confirm each observation is independent.',
            suggested_action='Verify data collection procedures ensure independence.',
        ))
        
    except Exception as e:
        pass
    
    return checks


# ============================================================================
# ANOVA CHECKS
# ============================================================================

def check_anova(
    df: pd.DataFrame,
    config: Dict[str, Any],
) -> List[AssumptionCheck]:
    """Check assumptions for ANOVA"""

    checks = []
    outcome_var = config.get('outcome_variable') or config.get('dependent')
    grouping_var = config.get('grouping_variable') or config.get('factor1')
    
    if not outcome_var or not grouping_var:
        return checks
    
    try:
        # Group data
        groups = [group[outcome_var].dropna().values for name, group in df.groupby(grouping_var)]
        
        if len(groups) < 2:
            return checks
        
        # 1. NORMALITY per group
        normality_violations = []
        for i, group in enumerate(groups):
            if len(group) >= 3:
                try:
                    stat, p = shapiro(group)
                    if p < 0.05:
                        normality_violations.append(i)
                except:
                    pass
        
        if normality_violations:
            checks.append(AssumptionCheck(
                assumption_name='Normality within groups',
                description='Each group should be approximately normally distributed.',
                status='warning',
                severity='minor',
                test_used='Shapiro-Wilk',
                finding=f'Non-normality in {len(normality_violations)}/{len(groups)} groups.',
                implication='ANOVA results may be affected if deviations are severe.',
                alternative_tests=['Kruskal-Wallis test (non-parametric)'],
            ))
        else:
            checks.append(AssumptionCheck(
                assumption_name='Normality within groups',
                description='Each group should be approximately normally distributed.',
                status='passed',
                severity='minor',
                finding='All groups approximately normal.',
                implication='Normality assumption satisfied.',
            ))
        
        # 2. HOMOGENEITY OF VARIANCES (Levene)
        try:
            stat, p = levene(*groups)
            
            if p < 0.05:
                checks.append(AssumptionCheck(
                    assumption_name='Homogeneity of variances',
                    description='Variance should be equal across groups.',
                    status='violated',
                    severity='moderate',
                    test_used="Levene's test",
                    statistic=stat,
                    p_value=p,
                    finding=f"Levene's test p={p:.4f} — unequal variances detected.",
                    implication='ANOVA F-test may be biased. Consider Welch\'s ANOVA.',
                    alternative_tests=['Welch\'s ANOVA', 'Kruskal-Wallis test'],
                ))
            else:
                checks.append(AssumptionCheck(
                    assumption_name='Homogeneity of variances',
                    description='Variance should be equal across groups.',
                    status='passed',
                    severity='minor',
                    test_used="Levene's test",
                    statistic=stat,
                    p_value=p,
                    finding=f"Levene's test p={p:.4f} — equal variances assumed.",
                    implication='Homogeneity of variance assumption satisfied.',
                ))
        except:
            pass
        
        # 3. INDEPENDENCE
        checks.append(AssumptionCheck(
            assumption_name='Independence of observations',
            description='Observations in different groups should be independent.',
            status='not_applicable',
            severity='moderate',
            finding='Cannot be statistically verified.',
            implication='Researcher must confirm independence.',
        ))
        
    except Exception as e:
        pass
    
    return checks


# ============================================================================
# SURVIVAL ANALYSIS CHECKS (Kaplan-Meier, Cox PH)
# ============================================================================

def check_survival(
    df: pd.DataFrame,
    config: Dict[str, Any],
    analysis_type: str,
) -> List[AssumptionCheck]:
    """Check assumptions for survival analysis"""
    
    checks = []
    event_var = config.get('event_variable') or config.get('eventVariable')
    time_var = config.get('time_variable') or config.get('timeVariable')
    
    if not event_var or not time_var:
        return checks
    
    try:
        event_count = (df[event_var] == 1).sum()
        
        # 1. ADEQUATE EVENTS
        if event_count < 10:
            severity = 'critical'
            status = 'violated'
            implication = 'Insufficient events for reliable survival estimates.'
        elif event_count < 30:
            severity = 'moderate'
            status = 'violated'
            implication = 'Limited events may reduce estimate precision.'
        else:
            severity = 'minor'
            status = 'passed'
            implication = 'Adequate number of events for stable estimates.'
        
        checks.append(AssumptionCheck(
            assumption_name='Adequate event count',
            description='Survival analysis requires sufficient observed events.',
            status=status,
            severity=severity,
            finding=f'{event_count} events observed.',
            implication=implication,
        ))
        
        # 2. NON-INFORMATIVE CENSORING (Cox PH only)
        if analysis_type == 'cox_ph':
            checks.append(AssumptionCheck(
                assumption_name='Non-informative censoring',
                description='Censoring mechanism must be unrelated to survival.',
                status='not_applicable',
                severity='moderate',
                finding='Cannot be statistically verified.',
                implication='Researcher must confirm censoring is non-informative.',
                suggested_action='Verify no differential dropout or loss to follow-up by outcome.',
            ))
        
        # 3. PROPORTIONAL HAZARDS (Cox PH only)
        if analysis_type == 'cox_ph':
            try:
                from lifelines import CoxPHFitter
                from lifelines.statistics import proportional_hazard_test
                
                predictors = config.get('predictors', [])
                if predictors:
                    try:
                        cph = CoxPHFitter()
                        # Only use numeric predictors
                        numeric_preds = [p for p in predictors if pd.api.types.is_numeric_dtype(df[p])]
                        if numeric_preds:
                            df_ph = df[[time_var, event_var] + numeric_preds].dropna()
                            if len(df_ph) > 10:
                                cph.fit(df_ph, duration_col=time_var, event_col=event_var)
                                
                                # Test PH assumption
                                ph_test = proportional_hazard_test(cph, df_ph, time_transform='rank')
                                
                                violations = ph_test[ph_test['p'] < 0.05].index.tolist()
                                
                                if violations:
                                    checks.append(AssumptionCheck(
                                        assumption_name='Proportional hazards',
                                        description='Hazard ratio should be constant over time.',
                                        status='violated',
                                        severity='critical',
                                        finding=f'Variables violating PH: {", ".join(violations)}',
                                        implication='Hazard ratio changes over time. Standard Cox model invalid.',
                                        suggested_action='Stratify analysis or use time-varying coefficients.',
                                        alternative_tests=['Stratified Cox model', 'Time-varying coefficient model'],
                                    ))
                                else:
                                    checks.append(AssumptionCheck(
                                        assumption_name='Proportional hazards',
                                        description='Hazard ratio should be constant over time.',
                                        status='passed',
                                        severity='minor',
                                        finding='All variables satisfy proportional hazards assumption.',
                                        implication='PH assumption satisfied.',
                                    ))
                    except:
                        pass
            except ImportError:
                pass
    
    except Exception as e:
        pass
    
    return checks


# ============================================================================
# DESCRIPTIVE STATISTICS CHECKS
# ============================================================================

def check_descriptive(
    df: pd.DataFrame,
    config: Dict[str, Any],
) -> List[AssumptionCheck]:
    """Check for descriptive statistics (mainly normality guidance)"""
    
    checks = []
    variables = config.get('variables', [])
    
    for var in variables:
        if var not in df.columns:
            continue
        
        numeric_data = pd.to_numeric(df[var], errors='coerce').dropna()
        
        if len(numeric_data) < 3:
            continue
        
        try:
            stat, p = shapiro(numeric_data)
            
            # This is FYI only - doesn't block analysis
            if p < 0.05:
                status = 'warning'
                implied_stat = 'non-normal, report median (IQR)'
            else:
                status = 'passed'
                implied_stat = 'normal, report mean (SD)'
            
            checks.append(AssumptionCheck(
                assumption_name=f'Normality of {var}',
                description='Guides how results should be reported (mean/SD vs median/IQR).',
                status=status,
                severity='minor',
                test_used='Shapiro-Wilk',
                statistic=stat,
                p_value=p,
                finding=f'Shapiro-Wilk p={p:.4f}. Recommend: {implied_stat}',
                implication='Informs choice of descriptive statistics (not blocking).',
            ))
        except:
            pass
    
    return checks
