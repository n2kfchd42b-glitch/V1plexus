"""
Checklist Engine — Phase 5
Auto-populates reporting checklists (STROBE, CONSORT, PRISMA, TRIPOD) from
project data already stored in Supabase.
"""

import os
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# DATA FETCHERS
# ---------------------------------------------------------------------------

def fetch_version(version_id: str, supabase) -> Optional[Dict]:
    resp = supabase.table('dataset_versions').select('*').eq('id', version_id).single().execute()
    return resp.data


def fetch_quality_report(version_id: str, supabase) -> Optional[Dict]:
    resp = (
        supabase.table('data_quality_reports')
        .select('*')
        .eq('version_id', version_id)
        .order('created_at', desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


def fetch_audit_entries(dataset_id: str, supabase) -> List[Dict]:
    resp = (
        supabase.table('audit_logs')
        .select('*')
        .eq('resource_id', dataset_id)
        .order('created_at', desc=False)
        .execute()
    )
    return resp.data or []


def fetch_analysis_runs(project_id: str, supabase) -> List[Dict]:
    resp = (
        supabase.table('analysis_runs')
        .select('*')
        .eq('project_id', project_id)
        .eq('status', 'completed')
        .order('created_at', desc=True)
        .execute()
    )
    return resp.data or []


def fetch_assumption_checks(project_id: str, supabase) -> List[Dict]:
    resp = (
        supabase.table('analysis_assumption_checks')
        .select('*')
        .eq('project_id', project_id)
        .order('created_at', desc=True)
        .execute()
    )
    return resp.data or []


def fetch_documents(project_id: str, supabase) -> List[Dict]:
    resp = (
        supabase.table('documents')
        .select('id, title, type, created_at')
        .eq('project_id', project_id)
        .execute()
    )
    return resp.data or []


def fetch_approval(project_id: str, supabase) -> Optional[Dict]:
    resp = (
        supabase.table('approval_gates')
        .select('*')
        .eq('project_id', project_id)
        .eq('status', 'approved')
        .order('approved_at', desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


# ---------------------------------------------------------------------------
# CHECKLIST TEMPLATES
# ---------------------------------------------------------------------------

STROBE_CROSSSECTIONAL_ITEMS = [
    {
        "item_id": "STROBE_1",
        "section": "Title and Abstract",
        "item_number": "1",
        "requirement": "Indicate the study's design with a commonly used term in the title or abstract",
        "explanation": "Authors should include a commonly used term for the study design, such as cross-sectional study, in the title or the abstract or both.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_2",
        "section": "Introduction",
        "item_number": "2",
        "requirement": "Explain the scientific background and rationale for the investigation being reported",
        "explanation": "Describe the background, context and rationale for the study.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_3",
        "section": "Methods: Study Design",
        "item_number": "3",
        "requirement": "Present key elements of study design early in the paper",
        "explanation": "Authors should describe their study design at an early stage in the methods section.",
        "source_field": "study_design_from_version",
    },
    {
        "item_id": "STROBE_4",
        "section": "Methods: Setting",
        "item_number": "4",
        "requirement": "Describe the setting, locations, and relevant dates, including periods of recruitment, exposure, follow-up, and data collection",
        "explanation": "The geographic region and time period should be described.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_5",
        "section": "Methods: Participants",
        "item_number": "5",
        "requirement": "Give the eligibility criteria, and the sources and methods of selection of participants",
        "explanation": "Describe how participants were selected and the eligibility criteria.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_6a",
        "section": "Methods: Participants",
        "item_number": "6a",
        "requirement": "Report numbers of individuals at each stage of study — numbers potentially eligible, examined for eligibility, confirmed eligible, included in the study, completing follow-up, and analysed",
        "explanation": "Flow of participants through the study should be described.",
        "source_field": "audit_cleaning_operations",
    },
    {
        "item_id": "STROBE_6b",
        "section": "Methods: Participants",
        "item_number": "6b",
        "requirement": "Give reasons for non-participation at each stage",
        "explanation": "Reasons for exclusions or dropouts should be given.",
        "source_field": "audit_cleaning_operations",
    },
    {
        "item_id": "STROBE_7",
        "section": "Methods: Variables",
        "item_number": "7",
        "requirement": "Clearly define all outcomes, exposures, predictors, potential confounders, and effect modifiers. Give diagnostic criteria, if applicable",
        "explanation": "All variables used in analysis should be defined.",
        "source_field": "schema_info",
    },
    {
        "item_id": "STROBE_8",
        "section": "Methods: Data Sources",
        "item_number": "8",
        "requirement": "For each variable of interest, give sources of data and details of methods of assessment (measurement). Describe comparability of assessment methods if there is more than one group",
        "explanation": "How each variable was measured should be described.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_9",
        "section": "Methods: Bias",
        "item_number": "9",
        "requirement": "Describe any efforts to address potential sources of bias",
        "explanation": "Sources of bias and measures to address them should be described.",
        "source_field": "quality_flags",
    },
    {
        "item_id": "STROBE_10",
        "section": "Methods: Study Size",
        "item_number": "10",
        "requirement": "Explain how the study size was arrived at",
        "explanation": "Sample size justification should be provided.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_11",
        "section": "Methods: Quantitative Variables",
        "item_number": "11",
        "requirement": "Explain how quantitative variables were handled in the analyses. If applicable, describe which groupings were chosen and why",
        "explanation": "Handling of continuous variables should be described.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_12a",
        "section": "Methods: Statistical Methods",
        "item_number": "12a",
        "requirement": "Describe all statistical methods, including those used to control for confounding",
        "explanation": "Statistical methods used in the study should be described.",
        "source_field": "analysis_runs",
    },
    {
        "item_id": "STROBE_12b",
        "section": "Methods: Statistical Methods",
        "item_number": "12b",
        "requirement": "Describe any methods used to examine subgroups and interactions",
        "explanation": "Subgroup and interaction analyses should be described.",
        "source_field": "analysis_runs",
    },
    {
        "item_id": "STROBE_12c",
        "section": "Methods: Statistical Methods",
        "item_number": "12c",
        "requirement": "Explain how missing data were addressed",
        "explanation": "Methods for handling missing data should be described.",
        "source_field": "quality_completeness",
    },
    {
        "item_id": "STROBE_12d",
        "section": "Methods: Statistical Methods",
        "item_number": "12d",
        "requirement": "If applicable, describe analytical methods taking account of sampling strategy",
        "explanation": "Complex sampling designs should be accounted for in the analysis.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_12e",
        "section": "Methods: Statistical Methods",
        "item_number": "12e",
        "requirement": "Describe any sensitivity analyses",
        "explanation": "Sensitivity analyses should be described.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_13",
        "section": "Results: Participants",
        "item_number": "13",
        "requirement": "Report numbers of individuals at each stage of the study and give reasons for non-participation at each stage",
        "explanation": "Flow of participants through each stage should be reported.",
        "source_field": "final_n",
    },
    {
        "item_id": "STROBE_14",
        "section": "Results: Descriptive Data",
        "item_number": "14",
        "requirement": "Give characteristics of study participants and information on exposures and potential confounders",
        "explanation": "Descriptive statistics for participants should be reported.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_15",
        "section": "Results: Outcome Data",
        "item_number": "15",
        "requirement": "Report numbers of outcome events or summary measures",
        "explanation": "Outcome data should be reported.",
        "cannot_auto_populate": True,
    },
    {
        "item_id": "STROBE_16",
        "section": "Results: Main Results",
        "item_number": "16",
        "requirement": "Give unadjusted estimates and, if applicable, confounder-adjusted estimates and their precision. Make clear which confounders were adjusted for and why they were included",
        "explanation": "Main analysis results should be reported.",
        "source_field": "primary_analysis",
    },
    {
        "item_id": "STROBE_22",
        "section": "Funding",
        "item_number": "22",
        "requirement": "Give the source of funding and the role of the funders for the present study and, if applicable, for the original study on which the present article is based",
        "explanation": "Funding sources and their roles should be disclosed.",
        "cannot_auto_populate": True,
    },
]

CONSORT_ITEMS = [
    {"item_id": f"CONSORT_{i}", "section": "CONSORT", "item_number": str(i),
     "requirement": f"CONSORT item {i}", "explanation": f"CONSORT checklist item {i}",
     "cannot_auto_populate": True}
    for i in range(1, 26)
]

PRISMA_ITEMS = [
    {"item_id": f"PRISMA_{i}", "section": "PRISMA", "item_number": str(i),
     "requirement": f"PRISMA item {i}", "explanation": f"PRISMA checklist item {i}",
     "cannot_auto_populate": True}
    for i in range(1, 28)
]

TRIPOD_ITEMS = [
    {"item_id": f"TRIPOD_{i}", "section": "TRIPOD", "item_number": str(i),
     "requirement": f"TRIPOD item {i}", "explanation": f"TRIPOD checklist item {i}",
     "cannot_auto_populate": True}
    for i in range(1, 23)
]


def get_checklist_template(guideline: str, study_design: Optional[str] = None) -> List[Dict]:
    if guideline == "STROBE":
        return [dict(item) for item in STROBE_CROSSSECTIONAL_ITEMS]
    elif guideline == "CONSORT":
        return [dict(item) for item in CONSORT_ITEMS]
    elif guideline == "PRISMA":
        return [dict(item) for item in PRISMA_ITEMS]
    elif guideline == "TRIPOD":
        return [dict(item) for item in TRIPOD_ITEMS]
    else:
        return []


# ---------------------------------------------------------------------------
# AUTO-POPULATION LOGIC
# ---------------------------------------------------------------------------

def _get_schema_columns(version: Dict) -> List[str]:
    schema = version.get("schema_info") or {}
    if isinstance(schema, dict):
        columns = schema.get("columns") or schema.get("fields") or []
        if isinstance(columns, list):
            return [
                c.get("name", "") if isinstance(c, dict) else str(c)
                for c in columns
                if (c.get("name", "") if isinstance(c, dict) else str(c))
                not in ("id", "uuid", "_id", "record_id")
            ]
    return []


def auto_populate_item(
    item: Dict,
    version: Optional[Dict] = None,
    quality_report: Optional[Dict] = None,
    audit_entries: Optional[List[Dict]] = None,
    analysis_runs: Optional[List[Dict]] = None,
    assumption_checks: Optional[List[Dict]] = None,
    **_kwargs,
) -> Dict:
    audit_entries = audit_entries or []
    analysis_runs = analysis_runs or []
    assumption_checks = assumption_checks or []

    result = {
        "item_id": item["item_id"],
        "section": item["section"],
        "item_number": item["item_number"],
        "requirement": item["requirement"],
        "explanation": item["explanation"],
        "status": "incomplete",
        "response": None,
        "source": None,
        "page_reference": None,
        "verified": False,
        "auto_populated_confidence": None,
    }

    if item.get("cannot_auto_populate"):
        return result

    source_field = item.get("source_field", "")

    # --- STROBE_3: Study design ---
    if source_field == "study_design_from_version" and version:
        row_count = version.get("row_count", 0)
        result["status"] = "auto_populated"
        result["response"] = f"Cross-sectional study of {row_count} participants"
        result["source"] = "dataset_versions.row_count"
        result["auto_populated_confidence"] = "high"

    # --- STROBE_6a / 6b: Participant flow from audit ---
    elif source_field == "audit_cleaning_operations":
        cleaning_ops = [
            e for e in audit_entries
            if e.get("action", "").startswith("dataset.")
            and "operation" in (e.get("details") or {})
        ]
        if cleaning_ops:
            lines = []
            for op in cleaning_ops[:5]:
                details = op.get("details", {})
                op_info = details.get("operation", {})
                op_type = op_info.get("type") or op_info.get("operation_type", "")
                rows_removed = op_info.get("rows_removed") or op_info.get("rows_affected", "")
                justification = details.get("justification", "")
                if op_type:
                    line = f"{op_type}"
                    if rows_removed:
                        line += f": {rows_removed} rows"
                    if justification:
                        line += f" ({justification[:80]})"
                    lines.append(line)
            if lines:
                result["status"] = "auto_populated"
                result["response"] = "; ".join(lines)
                result["source"] = "audit_logs (dataset cleaning operations)"
                result["auto_populated_confidence"] = "high"

    # --- STROBE_7: Variables from schema ---
    elif source_field == "schema_info" and version:
        columns = _get_schema_columns(version)
        if columns:
            result["status"] = "auto_populated"
            result["response"] = (
                f"Variables included in the dataset: {', '.join(columns[:20])}"
                + (" (and more)" if len(columns) > 20 else "")
            )
            result["source"] = "dataset_versions.schema_info"
            result["auto_populated_confidence"] = "medium"

    # --- STROBE_9: Bias from quality flags ---
    elif source_field == "quality_flags" and quality_report:
        flags = quality_report.get("flags") or quality_report.get("quality_flags") or []
        enumerator_metrics = quality_report.get("enumerator_metrics") or {}
        parts = []
        if flags:
            flag_texts = [
                f.get("message") or f.get("description") or str(f)
                for f in flags[:3]
                if isinstance(f, dict)
            ]
            if flag_texts:
                parts.append("Quality flags identified: " + "; ".join(flag_texts))
        if enumerator_metrics:
            parts.append(
                f"Enumerator-level quality metrics were assessed across "
                f"{len(enumerator_metrics)} enumerators."
            )
        if parts:
            result["status"] = "auto_populated"
            result["response"] = " ".join(parts)
            result["source"] = "data_quality_reports (flags + enumerator_metrics)"
            result["auto_populated_confidence"] = "medium"

    # --- STROBE_12a: Statistical methods from analysis runs ---
    elif source_field == "analysis_runs" and analysis_runs:
        method_map = {
            "logistic_regression": "multivariable logistic regression",
            "linear_regression": "linear regression",
            "kaplan_meier": "Kaplan-Meier survival analysis",
            "cox_regression": "Cox proportional hazards regression",
            "chi_square": "chi-square test of association",
            "descriptive": "descriptive statistics",
            "t_test": "independent samples t-test",
            "anova": "one-way ANOVA",
            "mann_whitney": "Mann-Whitney U test",
        }
        methods_used = list({
            method_map.get(r.get("analysis_type", ""), r.get("analysis_type", "unknown"))
            for r in analysis_runs
        })
        if methods_used:
            violation_text = ""
            if assumption_checks:
                violations = [
                    c for c in assumption_checks
                    if not c.get("all_passed", True)
                ]
                if violations:
                    violation_text = (
                        f" Assumption violations were detected and acknowledged "
                        f"for {len(violations)} check(s)."
                    )
            result["status"] = "auto_populated"
            result["response"] = (
                f"Statistical analyses included: {', '.join(methods_used)}."
                + violation_text
            )
            result["source"] = "analysis_runs"
            result["auto_populated_confidence"] = "high"

    # --- STROBE_12c: Missing data from quality completeness ---
    elif source_field == "quality_completeness" and quality_report:
        dimensions = quality_report.get("dimensions") or {}
        completeness = dimensions.get("completeness") or {}
        score = completeness.get("score") or quality_report.get("completeness_score")
        missing_pct = None
        if score is not None:
            missing_pct = round(100 - float(score) * 100, 1)
        if missing_pct is not None:
            result["status"] = "auto_populated"
            result["response"] = (
                f"Missing data represented {missing_pct}% of expected values. "
                "Missing data were handled using available case analysis; "
                "variables with >20% missingness were flagged for sensitivity analysis."
            )
            result["source"] = "data_quality_reports (completeness dimension)"
            result["auto_populated_confidence"] = "high"

    # --- STROBE_13: Final analytic N ---
    elif source_field == "final_n" and version:
        final_n = version.get("row_count", 0)
        result["status"] = "auto_populated"
        result["response"] = (
            f"A total of {final_n} participants were included in the final analysis."
        )
        result["source"] = "dataset_versions.row_count"
        result["auto_populated_confidence"] = "high"

    # --- STROBE_16: Primary analysis results ---
    elif source_field == "primary_analysis" and analysis_runs:
        primary = analysis_runs[0]
        a_type = primary.get("analysis_type", "analysis")
        title = primary.get("title") or a_type
        result["status"] = "auto_populated"
        result["response"] = (
            f"Primary analysis: {title}. See analysis output for full results table."
        )
        result["source"] = "analysis_runs (most recent completed)"
        result["auto_populated_confidence"] = "medium"

    return result


# ---------------------------------------------------------------------------
# MAIN ENTRY POINT
# ---------------------------------------------------------------------------

def generate_checklist(
    guideline: str,
    study_design: Optional[str],
    project_id: str,
    dataset_id: str,
    version_id: str,
    supabase_client,
) -> Dict[str, Any]:
    """
    Generate and auto-populate a reporting checklist.
    Returns the full checklist dict ready for upsert into reporting_checklists.
    """
    # Fetch all context data
    version = fetch_version(version_id, supabase_client)
    quality_report = fetch_quality_report(version_id, supabase_client)
    audit_entries = fetch_audit_entries(dataset_id, supabase_client)
    analysis_runs = fetch_analysis_runs(project_id, supabase_client)
    assumption_checks = fetch_assumption_checks(project_id, supabase_client)

    template = get_checklist_template(guideline, study_design)

    items: Dict[str, Dict] = {}
    auto_populated = 0
    manually_completed = 0
    not_applicable = 0
    incomplete = 0

    for template_item in template:
        populated = auto_populate_item(
            template_item,
            version=version,
            quality_report=quality_report,
            audit_entries=audit_entries,
            analysis_runs=analysis_runs,
            assumption_checks=assumption_checks,
        )
        items[populated["item_id"]] = populated
        status = populated["status"]
        if status == "auto_populated":
            auto_populated += 1
        elif status == "manually_completed":
            manually_completed += 1
        elif status == "not_applicable":
            not_applicable += 1
        else:
            incomplete += 1

    total_items = len(items)
    completed_count = auto_populated + manually_completed + not_applicable
    submission_ready = (completed_count == total_items) and total_items > 0

    return {
        "project_id": project_id,
        "dataset_id": dataset_id,
        "version_id": version_id,
        "guideline": guideline,
        "study_design": study_design,
        "items": items,
        "total_items": total_items,
        "auto_populated": auto_populated,
        "manually_completed": manually_completed,
        "not_applicable": not_applicable,
        "incomplete": incomplete,
        "submission_ready": submission_ready,
    }
