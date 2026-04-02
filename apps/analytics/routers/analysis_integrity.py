"""
FastAPI routes for Analysis Integrity (Phase 4)
"""

import os

from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
from datetime import datetime
import json

from ..services.assumption_checker import run_assumption_checks
from ..middleware.auth import get_current_user
from supabase import create_client

router = APIRouter(prefix='/analytics/integrity', tags=['analysis_integrity'])

# ============================================================================
# PYDANTIC MODELS
# ============================================================================


class AssumptionCheckRequest(BaseModel):
    dataset_id: str
    version_id: str
    project_id: str
    analysis_type: str
    analysis_config: Dict[str, Any]
    requested_by: str


class AckowledgeViolationsRequest(BaseModel):
    acknowledged_by: str
    acknowledgement_notes: Dict[str, str]


class ReentryCompareRequest(BaseModel):
    session_id: str
    original_version_id: str
    reentry_version_id: str
    participant_id_column: str
    columns_to_validate: Optional[List[str]] = None
    requested_by: str


class ResolvDiscrepancyRequest(BaseModel):
    discrepancy_id: str
    status: str  # 'resolved_original', 'resolved_reentry', 'resolved_manual', 'flagged_for_investigation'
    resolved_value: str
    resolution_note: Optional[str] = None


class BulkResolveDiscrepanciesRequest(BaseModel):
    session_id: str
    resolutions: List[ResolvDiscrepancyRequest]
    resolved_by: str


# ============================================================================
# ENDPOINT 1: RUN ASSUMPTION CHECKS
# ============================================================================


@router.post('/assumption-checks')
async def post_assumption_checks(
    req: AssumptionCheckRequest,
    background_tasks: BackgroundTasks,
    current_user: str = Depends(get_current_user),
):
    """
    Run assumption checks for an analysis configuration.
    Creates a record, computes checks, writes audit entry.
    """
    
    try:
        # Get Supabase client
        supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_KEY')
        )
        
        # Load dataset version data from storage
        # Assuming data is stored in dataset_versions as CSV
        storage_path = f"{req.dataset_id}/{req.version_id}/data.csv"
        response = supabase.storage.from_('datasets').download(storage_path)
        df = pd.read_csv(pd.io.common.StringIO(response.decode('utf-8')))
        
        # Run assumption checks
        result = run_assumption_checks(
            df=df,
            analysis_type=req.analysis_type,
            analysis_config=req.analysis_config
        )
        
        # INSERT into analysis_assumption_checks
        check_record = {
            'dataset_id': req.dataset_id,
            'version_id': req.version_id,
            'project_id': req.project_id,
            'analysis_type': req.analysis_type,
            'requested_by': req.requested_by,
            'checks': result['checks'],
            'all_passed': result['all_passed'],
            'acknowledged': False,
            'analysis_proceeded': False,
        }
        
        insert_resp = supabase.table('analysis_assumption_checks').insert(
            check_record
        ).execute()
        
        check_id = insert_resp.data[0]['id']
        
        # Write audit entry
        audit_entry = {
            'actor_id': req.requested_by,
            'action': 'analysis.assumptions.checked',
            'resource_type': 'analysis_run',
            'resource_id': check_id,
            'project_id': req.project_id,
            'details': {
                'summary': (
                    f"Assumption checks run for {req.analysis_type}: "
                    f"{result['critical_violations']} critical, "
                    f"{result['moderate_violations']} moderate violations"
                ),
                'operation': {
                    'analysis_type': req.analysis_type,
                    'all_passed': result['all_passed'],
                    'critical_violations': result['critical_violations'],
                    'moderate_violations': result['moderate_violations'],
                    'recommendation': result['run_recommendation'],
                    'checks_count': len(result['checks']),
                }
            }
        }
        
        supabase.table('audit_logs').insert(audit_entry).execute()
        
        return {
            'check_id': check_id,
            'all_passed': result['all_passed'],
            'run_recommendation': result['run_recommendation'],
            'checks': result['checks'],
            'critical_violations': result['critical_violations'],
            'moderate_violations': result['moderate_violations'],
            'minor_violations': result['minor_violations'],
            'not_applicable_count': result['not_applicable_count'],
            'requires_acknowledgement': (
                not result['all_passed'] 
                or result['not_applicable_count'] > 0
            ),
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 2: ACKNOWLEDGE VIOLATIONS
# ============================================================================


@router.post('/assumption-checks/{check_id}/acknowledge')
async def post_acknowledge_violations(
    check_id: str,
    req: AckowledgeViolationsRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Researcher acknowledges violations and approves proceeding.
    Validates critical violations have notes.
    Writes audit entry.
    """
    
    try:
        supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_KEY')
        )
        
        # Fetch check record
        resp = supabase.table('analysis_assumption_checks').select(
            '*'
        ).eq('id', check_id).single().execute()
        
        check_record = resp.data
        
        if check_record['acknowledged']:
            raise HTTPException(status_code=409, detail='Already acknowledged')
        
        # Validate critical violations have notes
        for check in check_record['checks']:
            if (check['status'] == 'violated' 
                and check['severity'] == 'critical'):
                assumption_name = check['assumption_name']
                if not req.acknowledgement_notes.get(assumption_name):
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            f'Critical violation "{assumption_name}" '
                            f'requires explanation note'
                        )
                    )
        
        # Write audit entry
        audit_entry = {
            'actor_id': req.acknowledged_by,
            'action': 'analysis.assumption.acknowledged',
            'resource_type': 'analysis_run',
            'resource_id': check_id,
            'project_id': check_record['project_id'],
            'details': {
                'summary': (
                    f'Researcher acknowledged {len(check_record["checks"])} '
                    f'assumption violations and approved proceeding'
                ),
                'justification': json.dumps(req.acknowledgement_notes),
                'justification_category': 'other',
                'operation': {
                    'check_id': check_id,
                    'analysis_type': check_record['analysis_type'],
                    'acknowledgement_notes': req.acknowledgement_notes,
                }
            }
        }
        
        audit_resp = supabase.table('audit_logs').insert(
            audit_entry
        ).execute()
        
        audit_id = audit_resp.data[0]['id']
        
        # UPDATE check record
        supabase.table('analysis_assumption_checks').update({
            'acknowledged': True,
            'acknowledged_at': datetime.utcnow().isoformat(),
            'acknowledged_by': req.acknowledged_by,
            'acknowledgement_audit_id': audit_id,
        }).eq('id', check_id).execute()
        
        return {
            'success': True,
            'can_proceed': True,
            'audit_entry_id': audit_id,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 3: RE-ENTRY COMPARISON
# ============================================================================


@router.post('/reentry/compare')
async def post_reentry_compare(
    req: ReentryCompareRequest,
    current_user: str = Depends(get_current_user),
):
    """
    Compare original and re-entered datasets.
    Identifies discrepancies, computes agreement.
    """
    
    try:
        supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_KEY')
        )
        
        # Load both datasets
        storage_path_orig = (
            f"{req.session_id}/original/data.csv"
        )
        storage_path_re = (
            f"{req.session_id}/reentry/data.csv"
        )
        
        df_orig = pd.read_csv(
            pd.io.common.StringIO(
                supabase.storage.from_('reentry').download(
                    storage_path_orig
                ).decode('utf-8')
            )
        )
        
        df_reentry = pd.read_csv(
            pd.io.common.StringIO(
                supabase.storage.from_('reentry').download(
                    storage_path_re
                ).decode('utf-8')
            )
        )
        
        # Get columns to validate
        cols_to_validate = req.columns_to_validate
        if not cols_to_validate:
            # All non-ID columns
            cols_to_validate = [
                c for c in df_orig.columns 
                if c != req.participant_id_column
            ]
        
        # Match on participant ID
        merged = df_orig.merge(
            df_reentry,
            on=req.participant_id_column,
            how='outer',
            suffixes=('_orig', '_reentry'),
            indicator=True
        )
        
        matched = merged[merged['_merge'] == 'both']
        only_orig = (merged['_merge'] == 'left_only').sum()
        only_reentry = (merged['_merge'] == 'right_only').sum()
        
        # Find discrepancies
        discrepancies = []
        total_cells = 0
        discrepant_cells = 0
        
        for idx, row in matched.iterrows():
            participant_id = row[req.participant_id_column]
            
            for col in cols_to_validate:
                total_cells += 1
                
                col_orig = f"{col}_orig" if f"{col}_orig" in row.index else col
                col_re = f"{col}_reentry" if f"{col}_reentry" in row.index else col
                
                val_orig = row[col_orig] if col_orig in row.index else None
                val_re = row[col_re] if col_re in row.index else None
                
                if str(val_orig) != str(val_re):
                    discrepant_cells += 1
                    discrepancies.append({
                        'session_id': req.session_id,
                        'participant_id': str(participant_id),
                        'column_name': col,
                        'original_value': str(val_orig) if val_orig is not None else None,
                        'reentry_value': str(val_re) if val_re is not None else None,
                        'status': 'pending',
                    })
        
        # Compute agreement
        overall_agreement_pct = (
            round((1 - discrepant_cells / total_cells) * 100, 2)
            if total_cells > 0 else 100.0
        )
        
        # Per-column agreement
        per_column = {}
        for col in cols_to_validate:
            col_disc_count = len([
                d for d in discrepancies 
                if d['column_name'] == col
            ])
            per_column[col] = {
                'agreement_pct': round(
                    (1 - col_disc_count / len(matched)) * 100, 2
                ),
                'discrepancy_count': col_disc_count,
            }
        
        # Build comparison result
        comparison_result = {
            'compared_at': datetime.utcnow().isoformat(),
            'total_participants_original': len(df_orig),
            'total_participants_reentry': len(df_reentry),
            'matched_participants': len(matched),
            'only_in_original': only_orig,
            'only_in_reentry': only_reentry,
            'columns_validated': cols_to_validate,
            'total_cells_compared': total_cells,
            'total_discrepancies': discrepant_cells,
            'overall_agreement_pct': overall_agreement_pct,
            'per_column_agreement': per_column,
            'perfect_match_count': (
                (matched.apply(lambda r: True, axis=1)).sum() 
                - discrepant_cells
            ),
            'discrepant_participant_count': (matched).drop_duplicates(
                subset=req.participant_id_column
            ).index.size,
        }
        
        # INSERT discrepancies
        if discrepancies:
            supabase.table('reentry_discrepancies').insert(
                discrepancies
            ).execute()
        
        # UPDATE session
        new_status = (
            'discrepancies_found' if discrepant_cells > 0 else 'resolved'
        )
        
        supabase.table('reentry_sessions').update({
            'status': new_status,
            'reentry_version_id': req.reentry_version_id,
            'comparison_result': comparison_result,
            'overall_agreement_pct': overall_agreement_pct,
        }).eq('id', req.session_id).execute()
        
        # Write audit entry
        audit_entry = {
            'actor_id': req.requested_by,
            'action': 'dataset.reentry.compared',
            'resource_type': 'dataset',
            'resource_id': req.session_id,
            'details': {
                'summary': (
                    f'Re-entry validation: {overall_agreement_pct}% '
                    f'agreement across {total_cells} cells'
                ),
                'operation': {
                    'session_id': req.session_id,
                    'total_discrepancies': discrepant_cells,
                    'overall_agreement_pct': overall_agreement_pct,
                    'matched_participants': len(matched),
                    'columns_validated': len(cols_to_validate),
                }
            }
        }
        
        supabase.table('audit_logs').insert(audit_entry).execute()
        
        return {
            'comparison_result': comparison_result,
            'discrepancy_count': discrepant_cells,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ENDPOINT 4: HEALTH CHECK
# ============================================================================


@router.get('/health')
async def get_health():
    """Health check endpoint"""
    return {'status': 'ok', 'service': 'analysis_integrity'}
