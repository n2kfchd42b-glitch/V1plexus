"""
Generate the canonical fixture + reference values for the analysis engine's
numerical regression suite (scripts/analysis-regression.ts).

Produces scripts/analysis-fixture.json containing:
  - data: a fixed 80-row dataset (deterministic; seeded RNG)
  - ref:  reference statistics computed independently with scipy / statsmodels

Re-run after intentionally changing the dataset:
    python3 scripts/gen-analysis-fixture.py
"""

import json
import os

import numpy as np
import pandas as pd
from scipy import stats
import statsmodels.api as sm

rng = np.random.default_rng(7)
n = 80
age = np.round(rng.normal(45, 12, n), 1)
grp = np.where(rng.random(n) < 0.5, "A", "B")
sex = np.where(rng.random(n) < 0.5, "M", "F")
region = rng.choice(["North", "South", "East"], n)
sbp = np.round(90 + 0.8 * age + np.where(grp == "B", 6, 0) + rng.normal(0, 8, n), 1)
lp = -6 + 0.10 * age
event = (rng.random(n) < 1 / (1 + np.exp(-lp))).astype(int)

df = pd.DataFrame(dict(age=age, sbp=sbp, grp=grp, sex=sex, region=region, event=event))

ref = {}

r, p = stats.pearsonr(df.age, df.sbp)
ref["pearson_age_sbp"] = {"r": round(float(r), 4), "p": round(float(p), 5)}

rho, p = stats.spearmanr(df.age, df.sbp)
ref["spearman_age_sbp"] = {"rho": round(float(rho), 4), "p": round(float(p), 5)}

a, b = df.sbp[df.grp == "A"], df.sbp[df.grp == "B"]
t, p = stats.ttest_ind(a, b, equal_var=False)
v1, v2, n1, n2 = a.var(ddof=1), b.var(ddof=1), len(a), len(b)
dfw = (v1 / n1 + v2 / n2) ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1))
ref["welch_ttest_sbp_grp"] = {
    "t": round(float(t), 4), "df": round(float(dfw), 3), "p": round(float(p), 5),
    "mean_a": round(float(a.mean()), 4), "mean_b": round(float(b.mean()), 4),
}

groups = [df.sbp[df.region == g] for g in ["East", "North", "South"]]
F, p = stats.f_oneway(*groups)
ref["anova_sbp_region"] = {"F": round(float(F), 4), "p": round(float(p), 5)}

ct = pd.crosstab(df.sex, df.event)
chi2, p, dof, _ = stats.chi2_contingency(ct, correction=False)  # no Yates → matches engine
ref["chisq_sex_event"] = {"chi2": round(float(chi2), 4), "df": int(dof), "p": round(float(p), 5)}

X = sm.add_constant(df[["age"]])
m = sm.OLS(df.sbp, X).fit()
ref["ols_sbp_age"] = {
    "beta_age": round(float(m.params["age"]), 4),
    "r2": round(float(m.rsquared), 4),
    "p_age": round(float(m.pvalues["age"]), 6),
}

ml = sm.Logit(df.event, sm.add_constant(df[["age"]])).fit(disp=0)
ref["logit_event_age"] = {
    "OR_age": round(float(np.exp(ml.params["age"])), 4),
    "beta_age": round(float(ml.params["age"]), 4),
    "p_age": round(float(ml.pvalues["age"]), 5),
}

out = {"data": df.to_dict(orient="records"), "ref": ref}
os.makedirs(os.path.dirname(__file__), exist_ok=True)
with open(os.path.join(os.path.dirname(__file__), "analysis-fixture.json"), "w") as f:
    json.dump(out, f, indent=0)
print(f"Wrote scripts/analysis-fixture.json ({len(df)} rows, {len(ref)} reference sets)")
