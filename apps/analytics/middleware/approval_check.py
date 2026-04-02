"""
Approval gate middleware for FastAPI analytics endpoints.

Call require_approved_dataset() at the start of any analysis endpoint
that operates on a specific dataset version.
"""

from fastapi import HTTPException


def _get_blocked_reason(status: str) -> str:
    reasons = {
        "pending": "Awaiting supervisor review. Analysis will be available once approved.",
        "in_review": "Supervisor is reviewing this dataset version. Analysis will be available once approved.",
        "rejected": "This dataset version was rejected by your supervisor. Review the feedback and submit a revised version.",
        "revision_requested": "Your supervisor has requested revisions. Review their feedback before resubmitting.",
    }
    return reasons.get(status, "Supervisor approval is required before analysis.")


async def require_approved_dataset(
    version_id: str,
    project_id: str,
    supabase_client,
) -> None:
    """
    Raises HTTP 403 if the dataset version is not approved for analysis.

    Projects without any active workspace supervisors bypass the gate.
    """
    # 1. Get project workspace
    proj_result = (
        supabase_client.table("projects")
        .select("workspace_id")
        .eq("id", project_id)
        .maybe_single()
        .execute()
    )
    workspace_id = (proj_result.data or {}).get("workspace_id")

    if not workspace_id:
        return  # No workspace → no gate

    # 2. Check for active supervisors in workspace
    supervisors = (
        supabase_client.table("workspace_memberships")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("role", "supervisor")
        .eq("status", "active")
        .limit(1)
        .execute()
    )

    if not supervisors.data:
        return  # No supervisors → no gate

    # 3. Check approval request for this version
    result = (
        supabase_client.table("dataset_approval_requests")
        .select("status")
        .eq("version_id", version_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "approval_required",
                "message": "Dataset version must be submitted for supervisor approval before analysis can run.",
                "status": "not_requested",
            },
        )

    status = result.data.get("status", "")

    if status != "approved":
        raise HTTPException(
            status_code=403,
            detail={
                "error": "approval_required",
                "message": _get_blocked_reason(status),
                "status": status,
            },
        )
