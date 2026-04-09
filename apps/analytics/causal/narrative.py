"""
Causal narrative generator.

Builds structured components from estimation results, then either:
  1. Calls the PLEXUS AI service (if AI_SERVICE_URL is set) with a tightly
     constrained prompt anchored to actual values — no hallucination risk.
  2. Falls back to a deterministic template-rendered narrative.
"""

from __future__ import annotations

import os
from typing import Any


def _build_components(
    exposure: str,
    outcome: str,
    primary: dict,
    psm: dict | None,
    ipw: dict | None,
    evalue: dict | None,
    adjustment_set: list[str],
) -> dict[str, Any]:
    ate = primary.get("ate")
    ci_lo = primary.get("ate_ci_lower")
    ci_hi = primary.get("ate_ci_upper")
    p_val = primary.get("p_value")
    significant = p_val is not None and p_val < 0.05
    direction = "increased" if (ate or 0) > 0 else "decreased"
    mag = abs(ate or 0)
    mag_label = "small" if mag < 0.05 else "moderate" if mag < 0.15 else "large"

    all_warnings: list[str] = []
    for r in [primary, psm, ipw]:
        if r:
            all_warnings.extend(r.get("warnings", []))

    consistent = _signs_consistent(
        ate,
        psm.get("ate") if psm else None,
        ipw.get("ate") if ipw else None,
    )

    return {
        "exposure": exposure,
        "outcome": outcome,
        "method_used": "doubly robust estimation",
        "ate": ate,
        "ate_formatted": f"{round(ate, 3)}" if ate is not None else "N/A",
        "ci_lower": ci_lo,
        "ci_upper": ci_hi,
        "ci_formatted": (
            f"95% CI: {round(ci_lo, 3)} to {round(ci_hi, 3)}"
            if ci_lo is not None and ci_hi is not None
            else "95% CI: not available"
        ),
        "p_value": p_val,
        "p_formatted": f"p = {round(p_val, 3)}" if p_val is not None else "p: N/A",
        "is_significant": significant,
        "direction": direction,
        "magnitude_descriptor": mag_label,
        "adjustment_variables": adjustment_set,
        "n_adjustment_vars": len(adjustment_set),
        "evalue": evalue.get("evalue_estimate") if evalue else None,
        "evalue_ci": evalue.get("evalue_ci_bound") if evalue else None,
        "sensitivity_note": evalue.get("interpretation") if evalue else None,
        "psm_ate": psm.get("ate") if psm else None,
        "ipw_ate": ipw.get("ate") if ipw else None,
        "estimates_consistent": consistent,
        "warnings": list(set(all_warnings)),
    }


def _signs_consistent(dr: float | None, psm: float | None, ipw: float | None) -> bool:
    vals = [v for v in [dr, psm, ipw] if v is not None]
    if len(vals) < 2:
        return True
    signs = [v > 0 for v in vals]
    return all(s == signs[0] for s in signs)


def _deterministic_narrative(c: dict) -> str:
    adj = ", ".join(c["adjustment_variables"]) or "no additional covariates"
    consistency = (
        "Results were consistent across PSM, IPW, and doubly robust estimation."
        if c["estimates_consistent"]
        else "Estimates varied across methods — interpret with additional caution."
    )
    sig = (
        f"This difference was statistically significant ({c['p_formatted']})."
        if c["is_significant"]
        else f"This difference did not reach statistical significance ({c['p_formatted']})."
    )
    ev = (
        f" The E-value of {c['evalue']} indicates that an unmeasured confounder "
        f"would need to be associated with both exposure and outcome by at least "
        f"{c['evalue']}-fold to fully explain this result."
        if c["evalue"] else ""
    )
    return (
        f"Using doubly robust estimation, we estimated the causal effect of "
        f"{c['exposure']} on {c['outcome']}, adjusting for {adj}. "
        f"The average treatment effect (ATE) was {c['ate_formatted']} "
        f"({c['ci_formatted']}). {sig} {consistency}{ev} "
        f"Residual confounding from unmeasured variables cannot be excluded."
    ).strip()


async def generate_narrative(
    exposure: str,
    outcome: str,
    primary_result: dict,
    psm_result: dict | None,
    ipw_result: dict | None,
    evalue_result: dict | None,
    adjustment_set: list[str],
) -> dict[str, Any]:
    components = _build_components(
        exposure, outcome, primary_result,
        psm_result, ipw_result, evalue_result, adjustment_set,
    )

    ai_url = os.getenv("AI_SERVICE_URL")
    narrative_text: str

    if ai_url:
        import httpx
        prompt = f"""You are a scientific writing assistant.
Generate a single publication-ready Results paragraph. Use ONLY the numbers below.
Write past tense, third person, formal academic style. Max 150 words.
End with: "Residual confounding from unmeasured variables cannot be excluded."

Exposure: {components['exposure']}
Outcome: {components['outcome']}
Method: {components['method_used']}
ATE: {components['ate_formatted']}
CI: {components['ci_formatted']}
P-value: {components['p_formatted']}
Adjusted for: {', '.join(components['adjustment_variables'])}
E-value: {components['evalue'] or 'not computed'}
Methods consistent: {components['estimates_consistent']}
Warnings: {'; '.join(components['warnings']) or 'none'}

Write the paragraph:"""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{ai_url}/generate",
                    json={"prompt": prompt, "max_tokens": 300},
                )
                narrative_text = (
                    resp.json().get("text", "").strip()
                    if resp.status_code == 200
                    else _deterministic_narrative(components)
                )
        except Exception:
            narrative_text = _deterministic_narrative(components)
    else:
        narrative_text = _deterministic_narrative(components)

    return {"narrative_text": narrative_text, "narrative_components": components}
