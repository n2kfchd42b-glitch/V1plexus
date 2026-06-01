# Analysis Hub statistical audit — findings

## utils.ts (foundation) — VERIFIED CORRECT
- studentTCDF, tToP, chiSqCDF/chiSqP, fCDF/fToP, incompleteBeta, betaCF,
  regularizedGammaP, logGamma (Lanczos), normalCDF (A&S), pearsonR, spearmanR,
  rankArray, variance/sd (sample), skewness (G1), kurtosis (G2), cramersV,
  cohensD (pooled). All match standard references.

## tests.ts — BUGS FOUND
1. [CRITICAL] Paired t-test misaligns columns (getNumericValues drops missing
   per-column → x[i],y[i] not same row). FIX: row-aligned extraction.
2. [HIGH] Independent t-test & Mann-Whitney: cats (missing dropped) indexed
   against vals (full length) → misalignment when group col has missing. FIX.
3. [HIGH] ANOVA Bonferroni post-hoc: t = q/sqrt(2) is wrong (too conservative).
   Correct t = diff/se. FIX.
4. [HIGH] ANOVA "Tukey HSD": uses t-dist not studentized range → mislabeled +
   wrong p. FIX: implement Tukey-Kramer via ptukey (studentized range).

## tests.ts — FIXED
- Paired t-test / independent t-test / Mann-Whitney: row-aligned extraction (toNum).
- ANOVA Bonferroni post-hoc: removed erroneous /sqrt(2).
- ANOVA Tukey: real studentized-range (Tukey-Kramer), validated vs published tables (err<0.0001).

## regression.ts — VERIFIED + FIXED
- VERIFIED correct: simple/multiple OLS, logistic IRLS+SE+LR+Nagelkerke+AUC,
  multinomial (one-vs-ref, documented), univariableLogistic1, computeAUC/ROC.
- FIXED: Poisson offset (offsetVar was ignored) — validated recovers true RR, exposure-invariant.
- FIXED: Poisson AIC (was deviance+2p → now -2logLik+2p with logGamma).
- NOTE (minor): OR/HR/IRR/RRR CIs hardcode z=1.96 regardless of confidenceLevel (correct for default 95%).
- engine.ts: ordinal→logistic, negbinomial→Poisson, factor→PCA all carry explicit ⚠️ approximation disclaimers (good).

## survival.ts — VERIFIED CORRECT (no fixes)
- KM product-limit + Greenwood + log-log CI; multivariate log-rank; Cox Breslow
  partial-likelihood NR + SE + Harrell's C + LR test; univariable simpleCox1. All correct.
- NOTE: no PH-assumption (Schoenfeld) test; z=1.96 hardcoded. Minor.

## special.ts — VERIFIED CORRECT
- Meta-analysis: fixed+random (DL tau2), Cochran Q, I2, Katz/Woolf SEs all correct.
- Sample size: single-prop, two-prop (cohort/rct/case-control), means — correct.
- NOTE: Egger's slope computed but unused (dead code). 2x2 zero-cell guards crude.

## multivariate.ts — VERIFIED + FIXED
- PCA (power iteration + deflation), silhouette, WCSS, hierarchical — correct.
- FIXED: k-means used unseeded Math.random() → non-reproducible. Now mulberry32
  seeded deterministically from data (reproducible clusters).
- NOTE: time-series seasonal period hardcoded 12; PCA loadings = eigenvectors (terminology).

## descriptive.ts — VERIFIED CORRECT.

## frequencies.ts — FIXED
- [HIGH] Cross-tab built from independently-missing-dropped columns paired by index
  → misaligned contingency table + wrong chi-square. Now row-aligned.
- [MED] Cumulative % accumulated in Map insertion order, not sorted display order. Fixed.

## tests.ts — ADDITIONAL FIX
- [HIGH] runChiSquare had the SAME contingency-alignment bug (independent missing-drop).
  Now row-aligned.

## assumption_checker.py — FIXED
- [HIGH] VIF computed without an intercept column (both logistic + linear checkers)
  → inflated VIFs / false multicollinearity violations. Now uses sm.add_constant.
- VERIFIED correct: Shapiro, Breusch-Pagan, Levene, Cook's distance, chi-square
  expected-cell rule, lifelines proportional_hazard_test (Schoenfeld), EPV.

## sensitivity_engine.py — FIXED (serious)
- [CRITICAL] Logistic sensitivity SE was fabricated (se = |beta|/3) → p≈0.003 always;
  predictors were standardized (per-SD OR, not per-unit) and L2-penalized.
  Rewritten with statsmodels Logit (MLE, raw units, real SE/p/CI).
- [HIGH] OLS SE used (X'X)^-1 without intercept. Rewritten with statsmodels OLS.

## causal/evalue.py — FIXED
- [HIGH] Sensitivity-curve denominator wrong (rr_ue*(rr-1)+1 vs correct rr_ue-rr);
  didn't flip RR<1. Now self-consistent (validated: rr_ud=E at rr_ue=E).

## causal/adjustment_set.py — FIXED (serious)
- [CRITICAL] Collider detection INVERTED — flagged forks/confounders as colliders,
  excluding genuine confounders from the adjustment set → biased causal estimates.
  Fixed condition; future-proofed d-separation API. Validated on confounder/
  collider/mediator DAGs.

## VERIFIED CORRECT (no fixes): 
- estimation_utils.py (SMD, bootstrap, propensity), ipw.py (stabilized Hajek),
  doubly_robust.py (EconML LinearDRLearner), psm.py (caliper matching),
  pc_algorithm.py (causal-learn PC), missing_data_engine.py (hedged MCAR screen).

## NOT deeply re-derived: decision-engine (feasibilityChecker/decisionTree) — this is
  analysis-recommendation logic, not statistical output; no p-values/estimates produced.
