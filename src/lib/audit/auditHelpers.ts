/**
 * Common audit entry helpers
 * Pre-configured audit entries for common operations
 */

import { writeAuditEntry } from './auditLogger'
import type { AuditDetails, JustificationCategory } from '@/types/audit'

export interface WriteAuditOptions {
  userId: string
  projectId?: string
  institutionId?: string
}

/**
 * Write dataset import audit entry
 */
export async function auditDatasetImport(
  {
    userId,
    projectId,
    institutionId,
  }: WriteAuditOptions,
  data: {
    datasetId: string
    datasetName: string
    source: string
    rowCount: number
    columnCount: number
    fileSize: number
    fileHash: string
  }
) {
  const details: AuditDetails = {
    summary: `Dataset "${data.datasetName}" imported from ${data.source}`,
    operation: {
      source: data.source,
      row_count: data.rowCount,
      column_count: data.columnCount,
      file_size: data.fileSize,
      file_hash: data.fileHash,
      version_number: 1,
    },
  }

  return writeAuditEntry({
    actor_id: userId,
    action: 'dataset.imported',
    resource_type: 'dataset',
    resource_id: data.datasetId,
    project_id: projectId,
    institution_id: institutionId,
    details,
  })
}

/**
 * Write dataset version commit audit entry
 */
export async function auditDatasetVersionCommit(
  {
    userId,
    projectId,
    institutionId,
  }: WriteAuditOptions,
  data: {
    versionId: string
    versionNumber: number
    parentVersionNumber?: number
    rowsBefore?: number
    rowsAfter?: number
    commitMessage: string
    fileHash: string
    justification: string
    justificationCategory?: JustificationCategory
    operations?: Record<string, unknown>[]
  }
) {
  const details: AuditDetails = {
    summary: data.commitMessage,
    justification: data.justification,
    justification_category: data.justificationCategory,
    operation: data.operations ? { operations: data.operations } : undefined,
    version_before: data.parentVersionNumber,
    version_after: data.versionNumber,
    rows_before: data.rowsBefore,
    rows_after: data.rowsAfter,
    file_hash: data.fileHash,
  }

  return writeAuditEntry({
    actor_id: userId,
    action: 'dataset.version.committed',
    resource_type: 'dataset_version',
    resource_id: data.versionId,
    project_id: projectId,
    institution_id: institutionId,
    details,
  })
}

/**
 * Write analysis run completion audit entry
 */
export async function auditAnalysisCompletion(
  {
    userId,
    projectId,
    institutionId,
  }: WriteAuditOptions,
  data: {
    runId: string
    analysisType: string
    datasetId: string
    datasetVersionId: string
    nObservations: number
    durationSeconds: number
  }
) {
  const details: AuditDetails = {
    summary: `${data.analysisType} analysis completed`,
    operation: {
      analysis_type: data.analysisType,
      dataset_id: data.datasetId,
      dataset_version_id: data.datasetVersionId,
      n_observations: data.nObservations,
      duration_seconds: data.durationSeconds,
    },
  }

  return writeAuditEntry({
    actor_id: userId,
    action: 'analysis.run.completed',
    resource_type: 'analysis_run',
    resource_id: data.runId,
    project_id: projectId,
    institution_id: institutionId,
    details,
  })
}

/**
 * Write document generation audit entry
 */
export async function auditDocumentGeneration(
  {
    userId,
    projectId,
    institutionId,
  }: WriteAuditOptions,
  data: {
    documentId: string
    documentType: string
    sourceRunId: string
    sourceAnalysisType: string
    wordCount: number
  }
) {
  const details: AuditDetails = {
    summary: `${data.documentType} generated from analysis`,
    operation: {
      document_type: data.documentType,
      source_run_id: data.sourceRunId,
      source_analysis_type: data.sourceAnalysisType,
      word_count: data.wordCount,
    },
  }

  return writeAuditEntry({
    actor_id: userId,
    action: 'document.generated',
    resource_type: 'document',
    resource_id: data.documentId,
    project_id: projectId,
    institution_id: institutionId,
    details,
  })
}

/**
 * Write duplicate resolution audit entry
 */
export async function auditDuplicateResolution(
  {
    userId,
    projectId,
    institutionId,
  }: WriteAuditOptions,
  data: {
    versionId: string
    versionNumber: number
    parentVersionNumber: number
    idColumn: string
    rowsBefore: number
    rowsAfter: number
    rowsRemoved: number
    justification: string
  }
) {
  const details: AuditDetails = {
    summary: `${data.rowsRemoved} duplicate IDs resolved, ${data.rowsRemoved} rows removed`,
    justification: data.justification,
    justification_category: 'duplicate_resolution',
    operation: {
      id_column: data.idColumn,
      rows_before: data.rowsBefore,
      rows_after: data.rowsAfter,
      rows_removed: data.rowsRemoved,
    },
    version_before: data.parentVersionNumber,
    version_after: data.versionNumber,
  }

  return writeAuditEntry({
    actor_id: userId,
    action: 'dataset.duplicates.resolved',
    resource_type: 'dataset_version',
    resource_id: data.versionId,
    project_id: projectId,
    institution_id: institutionId,
    details,
  })
}

/**
 * Write MICE imputation audit entry
 */
export async function auditMiceImputation(
  {
    userId,
    projectId,
    institutionId,
  }: WriteAuditOptions,
  data: {
    versionId: string
    versionNumber: number
    parentVersionNumber: number
    columnsImputed: string[]
    justification: string
    nIterations: number
  }
) {
  const details: AuditDetails = {
    summary: `MICE imputation applied to ${data.columnsImputed.length} variables`,
    justification: data.justification,
    justification_category: 'missing_data_handling',
    operation: {
      method: 'MICE',
      library: 'sklearn.IterativeImputer',
      columns_imputed: data.columnsImputed,
      iterations: data.nIterations,
    },
    version_before: data.parentVersionNumber,
    version_after: data.versionNumber,
  }

  return writeAuditEntry({
    actor_id: userId,
    action: 'dataset.imputation.mice',
    resource_type: 'dataset_version',
    resource_id: data.versionId,
    project_id: projectId,
    institution_id: institutionId,
    details,
  })
}
