"""
Methods Generator — Phase 5
Generates ready-to-paste methods section text from PLEXUS project data.
"""

import os
from datetime import datetime
from typing import Any, Dict, List, Optional


SOURCE_PLATFORM_MAP = {
    "kobo": "KoboToolbox",
    "kobotoolbox": "KoboToolbox",
    "redcap": "REDCap",
    "csv": "CSV file upload",
    "spss": "SPSS",
    "excel": "Excel",
    "xlsx": "Excel",
    "xls": "Excel",
    "json": "JSON file upload",
}

ANALYSIS_TYPE_MAP = {
    "logistic_regression": (
        "Multivariable logistic regression was used to assess associations between "
        "predictor variables and the binary outcome, with results expressed as odds ratios "
        "(OR) with 95% confidence intervals (CI)."
    ),
    "linear_regression": (
        "Linear regression was used to model associations between predictor variables "
        "and the continuous outcome, with results expressed as beta coefficients (β) "
        "with 95% confidence intervals."
    ),
    "kaplan_meier": (
        "Kaplan-Meier survival analysis was used to estimate survival functions, "
        "with group comparisons performed using the log-rank test."
    ),
    "cox_regression": (
        "Cox proportional hazards regression was used to estimate hazard ratios (HR) "
        "with 95% confidence intervals for time-to-event outcomes."
    ),
    "chi_square": (
        "Chi-square tests were used to assess associations between categorical variables. "
        "Fisher's exact test was applied where expected cell counts were less than 5."
    ),
    "descriptive": (
        "Descriptive statistics were calculated for all study variables. "
        "Continuous variables were summarised as mean (SD) or median (IQR) as appropriate. "
        "Categorical variables were summarised as counts and percentages."
    ),
    "t_test": (
        "Independent samples t-tests were used to compare means between groups. "
        "Levene's test was used to assess equality of variances."
    ),
    "anova": (
        "One-way ANOVA was used to compare means across three or more groups, "
        "with post-hoc Tukey HSD tests for pairwise comparisons."
    ),
    "mann_whitney": (
        "The Mann-Whitney U test was used as a non-parametric alternative for "
        "comparing distributions between two groups."
    ),
    "kruskal_wallis": (
        "The Kruskal-Wallis test was used to compare distributions across three or more groups."
    ),
    "correlation": (
        "Pearson or Spearman correlation coefficients were calculated to quantify "
        "associations between continuous variables."
    ),
}

OPERATION_TYPE_MAP = {
    "drop_rows": "rows were excluded",
    "impute": "missing values were imputed using multiple imputation by chained equations (MICE)",
    "resolve_duplicates": "duplicate records were identified and resolved",
    "recode": "variables were recoded",
    "rename": "variables were renamed for clarity",
    "filter": "observations were filtered based on inclusion/exclusion criteria",
    "compute": "derived variables were computed",
    "standardise": "variables were standardised",
    "merge": "datasets were merged",
}


# ---------------------------------------------------------------------------
# SECTION GENERATORS
# ---------------------------------------------------------------------------

def generate_data_collection_section(
    dataset_version: Optional[Dict],
    audit_import_entry: Optional[Dict],
    quality_report: Optional[Dict],
) -> str:
    if not dataset_version:
        return "Data collection methods were not available for automated extraction."

    source_platform = dataset_version.get("source_platform") or ""
    platform_name = SOURCE_PLATFORM_MAP.get(source_platform.lower(), source_platform or "an electronic data collection platform")

    row_count = dataset_version.get("row_count") or 0
    col_count = dataset_version.get("column_count") or 0
    imported_at = dataset_version.get("created_at") or ""
    import_date = ""
    if imported_at:
        try:
            import_date = datetime.fromisoformat(imported_at.replace("Z", "+00:00")).strftime("%d %B %Y")
        except Exception:
            import_date = imported_at[:10]

    file_hash = dataset_version.get("file_hash") or dataset_version.get("sha256_hash") or ""
    hash_prefix = file_hash[:16] + "..." if len(file_hash) > 16 else file_hash

    lines = [
        f"Data were collected using {platform_name} and imported into the PLEXUS research "
        f"data management platform on {import_date}." if import_date else
        f"Data were collected using {platform_name} and imported into the PLEXUS research "
        f"data management platform.",

        f"The imported dataset comprised {row_count:,} records and {col_count} variables.",
    ]

    if hash_prefix:
        lines.append(
            f"Dataset integrity was verified using a SHA-256 cryptographic hash "
            f"(hash prefix: {hash_prefix})."
        )

    return " ".join(lines)


def generate_data_quality_section(
    quality_report: Optional[Dict],
    dataset_version: Optional[Dict],
) -> str:
    if not quality_report:
        return (
            "Data quality was assessed using the PLEXUS Data Quality Index (DQI) "
            "version 1.0 (Abrokwa, 2026)."
        )

    dqi_score = quality_report.get("overall_score") or quality_report.get("dqi_score")
    readiness = quality_report.get("readiness_status") or quality_report.get("status") or "assessed"
    flags = quality_report.get("flags") or quality_report.get("quality_flags") or []
    enumerator_metrics = quality_report.get("enumerator_metrics") or {}

    lines = [
        "Data quality was assessed using the PLEXUS Data Quality Index (DQI) "
        "version 1.0 (Abrokwa, 2026), which evaluates completeness, consistency, "
        "validity, and enumerator-level performance."
    ]

    if dqi_score is not None:
        score_pct = round(float(dqi_score) * 100, 1) if float(dqi_score) <= 1 else round(float(dqi_score), 1)
        lines.append(
            f"The dataset achieved a DQI score of {score_pct}%, "
            f"with readiness status: {readiness}."
        )

    # Up to 3 flag summaries
    flag_descriptions = []
    for flag in flags[:3]:
        if isinstance(flag, dict):
            msg = flag.get("message") or flag.get("description") or flag.get("type")
            if msg:
                flag_descriptions.append(msg)
        elif isinstance(flag, str):
            flag_descriptions.append(flag)

    if flag_descriptions:
        lines.append(
            "Quality flags were raised for the following: "
            + "; ".join(flag_descriptions) + "."
        )

    if enumerator_metrics:
        n_enumerators = len(enumerator_metrics)
        lines.append(
            f"Enumerator-level quality metrics were assessed across {n_enumerators} "
            f"data collectors to identify systematic collection issues."
        )

    return " ".join(lines)


def generate_data_management_section(
    audit_entries: List[Dict],
    version_history: List[Dict],
    approval: Optional[Dict],
) -> str:
    lines = [
        "All data management operations were performed within the PLEXUS platform "
        "and recorded in an immutable audit ledger."
    ]

    # Walk version operations
    op_descriptions = []
    for entry in audit_entries:
        action = entry.get("action", "")
        details = entry.get("details") or {}
        op = details.get("operation") or {}
        op_type = op.get("type") or op.get("operation_type") or ""
        op_type_lower = op_type.lower().replace("-", "_").replace(" ", "_")

        if op_type_lower in OPERATION_TYPE_MAP:
            desc = OPERATION_TYPE_MAP[op_type_lower]
            rows = op.get("rows_removed") or op.get("rows_affected") or op.get("count")
            if rows and "rows" in desc:
                desc = desc.replace("rows were excluded", f"{rows} rows were excluded")
            justification = details.get("justification") or op.get("justification") or ""
            if justification:
                desc += f" ({justification[:100]})"
            op_descriptions.append(desc)

    if op_descriptions:
        lines.append(
            "The following data management steps were applied: "
            + "; ".join(op_descriptions[:6]) + "."
        )

    if approval:
        supervisor = approval.get("approved_by") or "a designated supervisor"
        approved_at = approval.get("approved_at") or ""
        approval_date = ""
        if approved_at:
            try:
                approval_date = datetime.fromisoformat(approved_at.replace("Z", "+00:00")).strftime("%d %B %Y")
            except Exception:
                approval_date = approved_at[:10]
        lines.append(
            f"The final analytic dataset was reviewed and approved by a designated supervisor"
            + (f" on {approval_date}" if approval_date else "")
            + " prior to analysis."
        )

    return " ".join(lines)


def generate_analytic_sample_section(
    original_n: int,
    final_n: int,
    complete_cases: Optional[int],
    audit_entries: List[Dict],
) -> str:
    excluded = original_n - final_n

    lines = [
        f"Of the {original_n:,} records imported, {final_n:,} participants were included "
        f"in the final analytic dataset"
        + (f" ({excluded:,} records excluded)" if excluded > 0 else "")
        + "."
    ]

    if complete_cases and complete_cases < final_n:
        complete_pct = round((complete_cases / final_n) * 100, 1)
        lines.append(
            f"{complete_cases:,} ({complete_pct}%) participants had complete data on all "
            f"primary analysis variables."
        )

    return " ".join(lines)


def generate_statistical_section(
    analysis_runs: List[Dict],
    assumption_checks: List[Dict],
) -> str:
    if not analysis_runs:
        return (
            "Statistical analyses were performed using the PLEXUS analytics engine "
            "(Python 3.x; scikit-learn, statsmodels, lifelines). "
            "Statistical significance was defined as p < 0.05."
        )

    method_texts = []
    seen_types = set()
    for run in analysis_runs:
        a_type = run.get("analysis_type", "")
        if a_type and a_type not in seen_types:
            seen_types.add(a_type)
            text = ANALYSIS_TYPE_MAP.get(a_type)
            if text:
                method_texts.append(text)

    # Assumption violations
    violation_texts = []
    for check in assumption_checks:
        if not check.get("all_passed", True):
            checks_list = check.get("checks") or []
            for c in checks_list:
                if c.get("status") == "violated" and c.get("severity") == "critical":
                    assumption_name = c.get("assumption_name", "assumption")
                    implication = c.get("implication") or ""
                    violation_texts.append(
                        f"Violation of {assumption_name} was detected and acknowledged "
                        + (f"({implication[:80]})" if implication else "") + "."
                    )

    lines = method_texts or ["Standard statistical methods were applied."]

    if violation_texts:
        lines.append(
            "The following assumption violations were identified and acknowledged "
            "prior to analysis: " + " ".join(violation_texts[:3])
        )

    lines.append(
        "All analyses were performed using the PLEXUS analytics engine "
        "(Python 3.x; scikit-learn, statsmodels, lifelines). "
        "Statistical significance was defined as p < 0.05."
    )

    return " ".join(lines)


# ---------------------------------------------------------------------------
# MAIN ENTRY POINT
# ---------------------------------------------------------------------------

def generate_methods_statement(
    version_id: str,
    project_id: str,
    supabase_client,
) -> Dict[str, Any]:
    """
    Generate a full methods statement from project data.
    Returns {sections, full_text, word_count}.
    """
    # Fetch data
    version_resp = supabase_client.table("dataset_versions").select("*").eq("id", version_id).single().execute()
    version = version_resp.data

    dataset_id = version.get("dataset_id") if version else None

    quality_resp = (
        supabase_client.table("data_quality_reports")
        .select("*")
        .eq("version_id", version_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    ) if version else None
    quality_report = quality_resp.data[0] if (quality_resp and quality_resp.data) else None

    audit_resp = (
        supabase_client.table("audit_logs")
        .select("*")
        .eq("resource_id", dataset_id)
        .order("created_at", desc=False)
        .execute()
    ) if dataset_id else None
    audit_entries = audit_resp.data if audit_resp else []

    # Separate import entry from rest
    import_entry = None
    for e in audit_entries:
        if "import" in e.get("action", "").lower():
            import_entry = e
            break

    analysis_runs_resp = (
        supabase_client.table("analysis_runs")
        .select("*")
        .eq("project_id", project_id)
        .eq("status", "completed")
        .execute()
    )
    analysis_runs = analysis_runs_resp.data or []

    assumption_checks_resp = (
        supabase_client.table("analysis_assumption_checks")
        .select("*")
        .eq("project_id", project_id)
        .execute()
    )
    assumption_checks = assumption_checks_resp.data or []

    versions_resp = (
        supabase_client.table("dataset_versions")
        .select("id, version_number, created_at")
        .eq("dataset_id", dataset_id)
        .order("version_number", desc=False)
        .execute()
    ) if dataset_id else None
    version_history = versions_resp.data or []

    approval_resp = (
        supabase_client.table("approval_gates")
        .select("*")
        .eq("project_id", project_id)
        .eq("status", "approved")
        .order("approved_at", desc=True)
        .limit(1)
        .execute()
    )
    approval = approval_resp.data[0] if approval_resp.data else None

    # Compute analytic sample numbers
    original_n = 0
    final_n = version.get("row_count") or 0 if version else 0

    # Estimate original_n from the first version in history
    if version_history:
        first_ver_resp = (
            supabase_client.table("dataset_versions")
            .select("row_count")
            .eq("id", version_history[0]["id"])
            .single()
            .execute()
        )
        original_n = (first_ver_resp.data or {}).get("row_count") or final_n

    # Generate each section
    data_collection = generate_data_collection_section(version, import_entry, quality_report)
    data_quality = generate_data_quality_section(quality_report, version)
    data_management = generate_data_management_section(audit_entries, version_history, approval)
    analytic_sample = generate_analytic_sample_section(original_n, final_n, None, audit_entries)
    statistical_methods = generate_statistical_section(analysis_runs, assumption_checks)

    sections = {
        "data_collection": data_collection,
        "data_quality": data_quality,
        "data_management": data_management,
        "analytic_sample": analytic_sample,
        "statistical_methods": statistical_methods,
    }

    full_text = "\n\n".join([
        f"Data Collection\n{data_collection}",
        f"Data Quality Assessment\n{data_quality}",
        f"Data Management\n{data_management}",
        f"Analytic Sample\n{analytic_sample}",
        f"Statistical Methods\n{statistical_methods}",
    ])

    word_count = len(full_text.split())

    return {
        "sections": sections,
        "full_text": full_text,
        "word_count": word_count,
    }
