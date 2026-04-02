# Phase 4 Audit Integration Guide

This document describes how Phase 4 operations integrate with the Phase 1 immutable audit ledger system.

## Overview

Phase 4 extends the trust infrastructure into the analysis layer with two systems:
1. **Statistical assumption verification** - Automated checks before analysis execution
2. **Blind re-entry validation** - Double data entry workflow for critical studies

All Phase 4 operations must be recorded in the Phase 1 audit ledger using the `writeAuditEntry()` service for immutable provenance tracking.

## Phase 1 Audit Logger API

Located in `/src/lib/audit/auditLogger.ts`:

```typescript
export async function writeAuditEntry(
  input: AuditEntryInput,
  supabaseClient: SupabaseClient
): Promise<{
  success: boolean
  entry_id?: string
  error?: string
}>
```

**Parameters:**
- `input.actor_id` (string): User ID performing the action
- `input.action` (AuditAction): Action type (e.g., 'analysis.assumption.acknowledged')
- `input.resource_type` (ResourceType): Type of resource affected
- `input.resource_id` (string): ID of the resource
- `input.project_id` (string, optional): Project ID
- `input.details` (AuditDetails): Operation details object with summary + structured data
- `input.ip_address` (string, optional): Client IP address

**Returns:**
- `{success: true, entry_id}` on success
- `{success: false, error}` on failure (audit errors never crash operations)

## Phase 4 Actions and Mappings

### Assumption Check Operations

#### Action: `analysis.assumptions.checked`
**When:** Assumption checks complete after calling Python checker

**Resource Type:** `analysis_run` (or create interim if no run ID yet)

**Details Structure:**
```typescript
{
  summary: "Assumption check completed on logistic regression configuration",
  operation: {
    analysis_type: "logistic_regression",
    all_passed: boolean,
    critical_violations: number,
    moderate_violations: number,
    minor_violations: number,
    run_recommendation: "proceed" | "proceed_with_caution" | "consider_alternatives"
  },
  analysis_type: "logistic_regression",
  dataset_version_id: "v123"
}
```

**Audit Entry Points:**
- FastAPI: `POST /analytics/integrity/assumption-checks`
- Next.js: `POST /api/analysis/assumption-checks`

---

#### Action: `analysis.assumption.acknowledged`
**When:** Researcher acknowledges critical violations and chooses to proceed

**Resource Type:** `analysis_run`

**Details Structure:**
```typescript
{
  summary: "Critical assumption violations acknowledged by researcher",
  operation: {
    check_id: "check_abc123",
    acknowledged_flags: {
      "Multicollinearity": "VIF > 5 but using robust standard errors",
      "Sample Size Inadequacy": "EPV < 10 but N=500 total..."
    }
  }
}
```

**Audit Entry Points:**
- FastAPI: `POST /analytics/integrity/assumption-checks/{checkId}/acknowledge`
- Next.js: `POST /api/analysis/assumption-checks/[checkId]/acknowledge`

---

### Re-Entry Validation Operations

#### Action: `dataset.reentry.initiated`
**When:** Researcher initiates blind re-entry session

**Resource Type:** `dataset`

**Details Structure:**
```typescript
{
  summary: "Blind re-entry validation initiated",
  operation: {
    session_id: "session_xyz789",
    original_version_id: "v456",
    participant_id_column: "participant_id",
    columns_to_validate: ["age", "systolic_bp"] // null = all columns
  }
}
```

**Audit Entry Points:**
- Next.js: `POST /api/datasets/[id]/reentry`
- No direct FastAPI call (initiated from Next.js only)

---

#### Action: `dataset.reentry.compared`
**When:** Python comparison engine completes comparing original vs re-entered data

**Resource Type:** `dataset`

**Details Structure:**
```typescript
{
  summary: "Re-entry validation comparison completed — 94.2% agreement",
  operation: {
    session_id: "session_xyz789",
    original_version_id: "v456",
    reentry_version_id: "v457",
    overall_agreement_pct: 94.2,
    total_cells_compared: 500,
    discrepant_cells: 29,
    discrepant_participant_count: 8,
    per_column_agreement: {
      age: 100.0,
      systolic_bp: 97.3,
      diastolic_bp: 91.5
    }
  }
}
```

**Audit Entry Points:**
- FastAPI: `POST /analytics/integrity/reentry/compare`
- Next.js (delegates): `POST /api/datasets/[id]/reentry/[sessionId]/compare`

---

#### Action: `dataset.reentry.discrepancy.resolved`
**When:** Researchers resolve individual discrepancies

**Resource Type:** `dataset`

**Details Structure:**
```typescript
{
  summary: "14 discrepancies resolved (7 original, 5 re-entry, 2 manual)",
  operation: {
    session_id: "session_xyz789",
    resolutions: {
      resolved_original_count: 7,
      resolved_reentry_count: 5,
      resolved_manual_count: 2,
      flagged_for_investigation_count: 0
    }
  }
}
```

**Audit Entry Points:**
- Next.js: `POST /api/datasets/[id]/reentry/[sessionId]/resolve`

---

#### Action: `dataset.reentry.validated`
**When:** Re-entry validation finalized and new verified version created

**Resource Type:** `dataset`

**Details Structure:**
```typescript
{
  summary: "Blind re-entry validation finalized — verified version created",
  operation: {
    session_id: "session_xyz789",
    verified_version_id: "v458",
    overall_agreement_pct: 94.2,
    total_discrepancies_found: 29,
    all_discrepancies_resolved: true
  }
}
```

**Audit Entry Points:**
- Next.js: `POST /api/datasets/[id]/reentry/[sessionId]/validate`

---

## Implementation Checklist

### FastAPI Updates (`/apps/analytics/routers/analysis_integrity.py`)

**Current State:** Uses direct `supabase.table('audit_logs').insert()` calls

**Changes Needed:**

1. ✅ Import the Supabase client factory
2. ✅ On assumption check complete:
   - Call `writeAuditEntry()` with action='analysis.assumptions.checked'
   - Include checked_violations in operation details
3. ✅ On acknowledgement:
   - Call `writeAuditEntry()` with action='analysis.assumption.acknowledged'
   - Include rejection notes explaining why proceeding despite violations
4. ✅ On re-entry compare:
   - Call `writeAuditEntry()` with action='dataset.reentry.compared'
   - Include agreement metrics in operation details

**Priority:** HIGH - FastAPI is the authoritative source for assumption engine results

---

### Next.js API Routes Updates

**Current State:** Direct `supabase.table('audit_logs').insert()` calls in route handlers

**Changes Needed by Route:**

#### `/api/datasets/[id]/reentry` (POST)
- ✅ Import `writeAuditEntry` from `@/lib/audit/auditLogger`
- ✅ After creating session record:
  ```typescript
  await writeAuditEntry(
    {
      actor_id: userId,
      action: 'dataset.reentry.initiated',
      resource_type: 'dataset',
      resource_id: datasetId,
      project_id: projectId,
      details: {
        summary: `Blind re-entry validation initiated for dataset "${datasetName}"`,
        operation: {
          session_id: session.id,
          original_version_id,
          participant_id_column,
          columns_to_validate
        }
      }
    },
    supabase
  )
  ```

#### `/api/datasets/[id]/reentry/[sessionId]/resolve` (POST)
- ✅ Import `writeAuditEntry`
- ✅ After resolving discrepancies:
  ```typescript
  await writeAuditEntry(
    {
      actor_id: userId,
      action: 'dataset.reentry.discrepancy.resolved',
      resource_type: 'dataset',
      resource_id: datasetId,
      project_id: projectId,
      details: {
        summary: `${total} discrepancies resolved (${byStatus.original} original, ${byStatus.reentry} re-entry, ${byStatus.manual} manual)`,
        operation: {
          session_id: sessionId,
          resolutions: {
            resolved_original_count: byStatus.original,
            resolved_reentry_count: byStatus.reentry,
            resolved_manual_count: byStatus.manual,
            flagged_for_investigation_count: byStatus.flagged
          }
        }
      }
    },
    supabase
  )
  ```

#### `/api/datasets/[id]/reentry/[sessionId]/validate` (POST)
- ✅ Import `writeAuditEntry`
- ✅ After validation complete:
  ```typescript
  await writeAuditEntry(
    {
      actor_id: userId,
      action: 'dataset.reentry.validated',
      resource_type: 'dataset',
      resource_id: datasetId,
      project_id: projectId,
      details: {
        summary: `Blind re-entry validation finalized — ${agreement}% agreement, verified version created`,
        operation: {
          session_id: sessionId,
          verified_version_id: nextVersionId,
          overall_agreement_pct: agreement,
          total_discrepancies_found: discrepancyCount,
          all_discrepancies_resolved: true
        }
      }
    },
    supabase
  )
  ```

**Priority:** HIGH - These are the user-facing operations that shape the audit trail

---

## Audit Types and Action Registration

### Required Additions to AuditAction Type

Add to `/src/types/audit.ts`:

```typescript
export type AuditAction =
  // ... existing actions ...
  // Analysis assumption operations
  | 'analysis.assumptions.checked'
  | 'analysis.assumption.acknowledged'
  // Dataset re-entry operations
  | 'dataset.reentry.initiated'
  | 'dataset.reentry.compared'
  | 'dataset.reentry.discrepancy.resolved'
  | 'dataset.reentry.validated'
```

**Status:** ✅ ALREADY REGISTERED in current audit types (verified in `/src/types/audit.ts`)

---

## Testing Audit Integration

### Unit Test: Assumption Check Audit

```typescript
describe('Assumption Check Audit', () => {
  it('should write analysis.assumptions.checked entry', async () => {
    // 1. Run assumption checks
    const result = await runAssumptionChecks({...})
    
    // 2. Verify audit entry created
    const audit = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'analysis.assumptions.checked')
      .eq('resource_id', checkId)
      .single()
    
    expect(audit.data.details.operation.run_recommendation).toEqual('proceed')
    expect(audit.data.entry_hash).toBeTruthy() // SHA-256 hash exists
  })
})
```

### Unit Test: Re-entry Initiation Audit

```typescript
describe('Re-entry Initiation Audit', () => {
  it('should write dataset.reentry.initiated entry', async () => {
    // 1. Initiate re-entry
    const session = await createReentrySession({...})
    
    // 2. Verify audit entry
    const audit = await supabase
      .from('audit_logs')
      .select('*')
      .eq('action', 'dataset.reentry.initiated')
      .eq('resource_id', datasetId)
      .single()
    
    expect(audit.data.details.operation.session_id).toEqual(session.id)
  })
})
```

### Chain Integrity Verification

```typescript
// Verify hash chain is intact for all Phase 4 operations
const chainResult = await verifyAuditChain(datasetId, 'dataset')
expect(chainResult.chain_intact).toBe(true)
expect(chainResult.violations).toHaveLength(0)
```

---

## Common Patterns and Best Practices

### Pattern 1: Always Include Summary

Every audit entry must have a human-readable summary:
```typescript
summary: "Blind re-entry validation initiated for dataset 'COVID-19 Patient Data'"
```

### Pattern 2: Structured Operation Details

Separate human-readable field from machine-readable operation:
```typescript
{
  summary: "...",  // Human-readable
  operation: {     // Machine-readable, structured
    session_id: "...",
    original_version_id: "...",
    // ...
  }
}
```

### Pattern 3: Audit Failures Never Block Operations

The `writeAuditEntry()` function returns success/error but never throws. If audit fails, the operation succeeds but is logged to console for investigation.

### Pattern 4: Async/Await Audit Writes

All `writeAuditEntry()` calls are non-blocking. They should be awaited but failures don't crash the operation:

```typescript
// Good: Fail the operation on missing data, but audit failure doesn't matter
const auditResult = await writeAuditEntry({...}, supabase)
if (!auditResult.success) {
  console.warn('Audit write failed:', auditResult.error)
  // Continue - operation already succeeded
}
```

---

## Audit Trail Examples

### Example 1: Complete Assumption Check → Acknowledgement Flow

```
[Dataset: v123]

Entry 1: analysis.assumptions.checked
  - Timestamp: 2025-03-22T14:32:00Z
  - Actor: researcher@university.edu
  - Details:
    - summary: "Assumption checks completed on logistic regression model"
    - operation:
      - analysis_type: "logistic_regression"
      - all_passed: false
      - critical_violations: 1
      - run_recommendation: "proceed_with_caution"

Entry 2: analysis.assumption.acknowledged
  - Timestamp: 2025-03-22T14:34:15Z
  - Actor: researcher@university.edu
  - Details:
    - summary: "Critical assumption violation acknowledged"
    - operation:
      - check_id: "check_abc123"
      - acknowledged_flags:
        - "Multicollinearity": "VIF exceeds 5 but will use Huber-White robust standard errors"

Entry 3: analysis.run.started
  - Timestamp: 2025-03-22T14:34:30Z
  - Actor: researcher@university.edu
  - Details:
    - summary: "Analysis execution started (post-acknowledgement)"
    - operation:
      - analysis_type: "logistic_regression"
```

### Example 2: Complete Re-entry Validation Flow

```
[Dataset: v456]

Entry 1: dataset.reentry.initiated
  - Timestamp: 2025-03-22T15:00:00Z
  - Actor: principal_investigator@university.edu
  - Details:
    - summary: "Blind re-entry validation initiated"
    - operation:
      - session_id: "session_xyz789"
      - columns_to_validate: ["age", "systolic_bp", "diastolic_bp"]

Entry 2: dataset.reentry.compared
  - Timestamp: 2025-03-22T16:15:45Z
  - Actor: system (via analytics service)
  - Details:
    - summary: "Re-entry comparison completed — 94.2% agreement"
    - operation:
      - session_id: "session_xyz789"
      - overall_agreement_pct: 94.2
      - discrepant_participant_count: 8

Entry 3: dataset.reentry.discrepancy.resolved
  - Timestamp: 2025-03-22T17:32:00Z
  - Actor: research_assistant@university.edu
  - Details:
    - summary: "14 discrepancies resolved"
    - operation:
      - resolutions:
        - resolved_original_count: 7
        - resolved_reentry_count: 5
        - resolved_manual_count: 2

Entry 4: dataset.reentry.validated
  - Timestamp: 2025-03-22T17:33:15Z
  - Actor: principal_investigator@university.edu
  - Details:
    - summary: "Blind re-entry validation finalized"
    - operation:
      - verified_version_id: "v457"
      - overall_agreement_pct: 94.2
```

---

## Integration Status

### ✅ Complete
- Phase 1 audit logger service implemented and tested
- AuditAction types registered for all Phase 4 operations
- Audit schema supports all Phase 4 details

### ⏳ In Progress
- Update FastAPI endpoints to use writeAuditEntry()
- Update Next.js API routes to use writeAuditEntry()
- Replace direct supabase.table('audit_logs').insert() calls

### 📋 Testing
- Unit tests for audit entry creation
- Integration tests for complete workflows
- Chain integrity verification tests

---

## References

- Phase 1 Audit Logger: `/src/lib/audit/auditLogger.ts`
- Audit Types: `/src/types/audit.ts`
- Audit Entry Details: `/src/types/audit.ts` → `AuditDetails` interface
