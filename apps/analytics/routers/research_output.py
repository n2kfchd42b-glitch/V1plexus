"""
FastAPI routes for Research Output (Phase 5)
"""

import os

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import datetime

from ..services.checklist_engine import generate_checklist
from ..services.methods_generator import generate_methods_statement
from ..services.package_generator import generate_output_package, create_verification_token
from ..middleware.auth import get_current_user
from supabase import create_client

router = APIRouter(prefix='/analytics/output', tags=['research_output'])


def get_supabase():
    return create_client(
        os.getenv('SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_KEY'),
    )


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class GenerateChecklistRequest(BaseModel):
    project_id: str
    dataset_id: str
    version_id: str
    guideline: str
    study_design: Optional[str] = None


class UpdateChecklistItemRequest(BaseModel):
    status: str
    response: Optional[str] = None
    page_reference: Optional[str] = None
    verified: Optional[bool] = None


class GenerateMethodsRequest(BaseModel):
    project_id: str
    version_id: str


class GeneratePackageRequest(BaseModel):
    project_id: str
    dataset_id: str
    version_id: str
    include_components: List[str]
    guideline: str


class CreateVerificationTokenRequest(BaseModel):
    project_id: str
    dataset_id: str
    version_id: str
    access_level: Optional[str] = 'summary'
    restricted_to_email: Optional[str] = None
    expires_days: Optional[int] = 365


# ============================================================================
# ENDPOINT 1: GENERATE CHECKLIST
# ============================================================================

@router.post('/checklist/generate')
async def post_generate_checklist(
    req: GenerateChecklistRequest,
    current_user: str = Depends(get_current_user),
):
    """Generate and auto-populate a reporting checklist."""
    try:
        supabase = get_supabase()

        checklist_data = generate_checklist(
            guideline=req.guideline,
            study_design=req.study_design,
            project_id=req.project_id,
            dataset_id=req.dataset_id,
            version_id=req.version_id,
            supabase_client=supabase,
        )
        checklist_data['created_by'] = current_user

        # Upsert into reporting_checklists
        resp = supabase.table('reporting_checklists').insert(checklist_data).execute()
        checklist_id = resp.data[0]['id']

        # Write audit entry via immutable ledger RPC
        supabase.rpc('append_audit_entry', {
            'p_actor_id': current_user,
            'p_action': 'document.checklist.generated',
            'p_resource_type': 'dataset',
            'p_resource_id': req.dataset_id,
            'p_project_id': req.project_id,
            'p_details': {
                'summary': (
                    f"{req.guideline} reporting checklist generated: "
                    f"{checklist_data['auto_populated']} auto-populated, "
                    f"{checklist_data['incomplete']} incomplete"
                ),
                'operation': {
                    'checklist_id': checklist_id,
                    'guideline': req.guideline,
                    'total_items': checklist_data['total_items'],
                    'auto_populated': checklist_data['auto_populated'],
                },
            },
        }).execute()

        return {
            'checklist_id': checklist_id,
            **checklist_data,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 2: UPDATE SINGLE CHECKLIST ITEM
# ============================================================================

@router.patch('/checklist/{checklist_id}/items/{item_id}')
async def patch_checklist_item(
    checklist_id: str,
    item_id: str,
    req: UpdateChecklistItemRequest,
    current_user: str = Depends(get_current_user),
):
    """Update a single item in the checklist JSONB and recompute counts."""
    try:
        supabase = get_supabase()

        # Fetch current checklist
        resp = supabase.table('reporting_checklists').select('*').eq('id', checklist_id).single().execute()
        checklist = resp.data
        if not checklist:
            raise HTTPException(status_code=404, detail='Checklist not found')

        items: Dict[str, Any] = checklist.get('items') or {}
        if item_id not in items:
            raise HTTPException(status_code=404, detail=f'Item {item_id} not found')

        # Update item fields
        item = dict(items[item_id])
        item['status'] = req.status
        if req.response is not None:
            item['response'] = req.response
        if req.page_reference is not None:
            item['page_reference'] = req.page_reference
        if req.verified is not None:
            item['verified'] = req.verified

        items[item_id] = item

        # Recompute counts
        auto_populated = sum(1 for i in items.values() if i.get('status') == 'auto_populated')
        manually_completed = sum(1 for i in items.values() if i.get('status') == 'manually_completed')
        not_applicable = sum(1 for i in items.values() if i.get('status') == 'not_applicable')
        incomplete = sum(1 for i in items.values() if i.get('status') == 'incomplete')
        total_items = len(items)
        completed = auto_populated + manually_completed + not_applicable
        submission_ready = (completed == total_items) and total_items > 0

        supabase.table('reporting_checklists').update({
            'items': items,
            'auto_populated': auto_populated,
            'manually_completed': manually_completed,
            'not_applicable': not_applicable,
            'incomplete': incomplete,
            'submission_ready': submission_ready,
        }).eq('id', checklist_id).execute()

        return {
            'success': True,
            'item': items[item_id],
            'auto_populated': auto_populated,
            'manually_completed': manually_completed,
            'not_applicable': not_applicable,
            'incomplete': incomplete,
            'submission_ready': submission_ready,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 3: GENERATE METHODS STATEMENT
# ============================================================================

@router.post('/methods/generate')
async def post_generate_methods(
    req: GenerateMethodsRequest,
    current_user: str = Depends(get_current_user),
):
    """Generate a ready-to-paste methods statement."""
    try:
        supabase = get_supabase()

        result = generate_methods_statement(
            version_id=req.version_id,
            project_id=req.project_id,
            supabase_client=supabase,
        )

        # Write audit entry via immutable ledger RPC
        supabase.rpc('append_audit_entry', {
            'p_actor_id': current_user,
            'p_action': 'document.generated',
            'p_resource_type': 'dataset',
            'p_resource_id': req.version_id,
            'p_project_id': req.project_id,
            'p_details': {
                'summary': f"Methods statement generated ({result['word_count']} words)",
                'operation': {
                    'version_id': req.version_id,
                    'word_count': result['word_count'],
                    'document_type': 'methods_statement',
                },
            },
        }).execute()

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 4: GENERATE OUTPUT PACKAGE (background task)
# ============================================================================

@router.post('/package/generate')
async def post_generate_package(
    req: GeneratePackageRequest,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(get_current_user),
):
    """Insert package record and dispatch background generation task."""
    try:
        supabase = get_supabase()

        # Insert package record with status 'generating'
        resp = supabase.table('output_packages').insert({
            'project_id': req.project_id,
            'dataset_id': req.dataset_id,
            'version_id': req.version_id,
            'manifest': {
                'components': req.include_components,
                'guideline': req.guideline,
            },
            'status': 'generating',
            'generated_by': current_user,
        }).execute()

        package_id = resp.data[0]['id']

        # Dispatch background task
        background_tasks.add_task(
            generate_output_package,
            package_id=package_id,
            project_id=req.project_id,
            dataset_id=req.dataset_id,
            version_id=req.version_id,
            include_components=req.include_components,
            guideline=req.guideline,
            generated_by=current_user,
            supabase_client=supabase,
        )

        return {
            'package_id': package_id,
            'status': 'generating',
            'message': 'Package generation started. Poll /status for updates.',
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 5: GET PACKAGE STATUS
# ============================================================================

@router.get('/package/{package_id}/status')
async def get_package_status(
    package_id: str,
    current_user: str = Depends(get_current_user),
):
    """Return status, manifest, storage_path, package_hash; signed URL if ready."""
    try:
        supabase = get_supabase()

        resp = supabase.table('output_packages').select('*').eq('id', package_id).single().execute()
        pkg = resp.data
        if not pkg:
            raise HTTPException(status_code=404, detail='Package not found')

        result = {
            'package_id': package_id,
            'status': pkg.get('status'),
            'manifest': pkg.get('manifest'),
            'storage_path': pkg.get('storage_path'),
            'package_hash': pkg.get('package_hash'),
            'generated_at': pkg.get('generated_at'),
            'expires_at': pkg.get('expires_at'),
            'signed_url': None,
        }

        if pkg.get('status') == 'ready' and pkg.get('storage_path'):
            try:
                signed = supabase.storage.from_('research-packages').create_signed_url(
                    pkg['storage_path'], 3600
                )
                result['signed_url'] = signed.get('signedURL') or signed.get('signed_url')
            except Exception:
                pass

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 6: CREATE VERIFICATION TOKEN
# ============================================================================

@router.post('/verify/token')
async def post_create_verification_token(
    req: CreateVerificationTokenRequest,
    current_user: str = Depends(get_current_user),
):
    """Generate a PLX-VRF token for external verification."""
    try:
        supabase = get_supabase()

        from datetime import timedelta, timezone
        from ..services.package_generator import _generate_token_string

        token = _generate_token_string()
        expires_at = (
            datetime.now(timezone.utc) + timedelta(days=req.expires_days or 365)
        ).isoformat()

        token_record: Dict[str, Any] = {
            'resource_type': 'dataset_lineage',
            'resource_id': req.version_id,
            'project_id': req.project_id,
            'token': token,
            'access_level': req.access_level or 'summary',
            'created_by': current_user,
            'expires_at': expires_at,
            'view_count': 0,
        }
        if req.restricted_to_email:
            token_record['restricted_to_email'] = req.restricted_to_email

        supabase.table('verification_tokens').insert(token_record).execute()

        # Write audit entry via immutable ledger RPC
        supabase.rpc('append_audit_entry', {
            'p_actor_id': current_user,
            'p_action': 'dataset.verification.token_created',
            'p_resource_type': 'dataset',
            'p_resource_id': req.dataset_id,
            'p_project_id': req.project_id,
            'p_details': {
                'summary': f'Verification token created: {token}',
                'operation': {
                    'token': token,
                    'access_level': req.access_level,
                    'expires_at': expires_at,
                },
            },
        }).execute()

        return {
            'token': token,
            'expires_at': expires_at,
            'access_level': req.access_level,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get('/health')
async def get_health():
    return {'status': 'ok', 'service': 'research_output'}
