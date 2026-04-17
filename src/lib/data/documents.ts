/*
 * DOCUMENTS DATA ACCESS
 *
 * Replaces direct supabase.from('documents') calls found in:
 *
 *   src/app/(dashboard)/projects/[id]/documents/[docId]/page.tsx
 *     - select * by id single() (lines 70-75)
 *     - select * by id single() after restore (line 93)
 *     - update deleted_at (lines 103-106)
 *
 *   src/components/document/MinimalEditor.tsx
 *     - update content, word_count, updated_at (lines 130-133)
 *     - update title (line 224)
 *
 *   src/components/review/FeedbackForm.tsx
 *     - select project_id, title maybeSingle() (line 43)
 *     - update status 'approved' (line 48)
 *     - update status 'revision_requested' (line 55)
 *
 *   src/components/analysis/HubTableGeneratorModal.tsx
 *     - select id, title for project (lines 451-452)
 *     - insert new document (lines 633-640)
 *
 *   src/components/analysis/GenerateTableModal.tsx
 *     - select id, title for project (lines 358-360)
 *     - insert new document (lines 452-459)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Document, DocumentStatus } from '@/types/database'
import { DataResult, DataListResult, ok, okList, err, errList } from './types'

// The Document type in database.ts does not include word_count or deleted_at,
// but those columns exist in the database. These types extend Document for writes.
type DocumentContentUpdate = {
  content: Record<string, unknown>
  word_count: number
  updated_at: string
}

type DocumentInsert = {
  project_id: string
  title: string
  content?: Record<string, unknown> | null
  status?: DocumentStatus
  word_count?: number
  current_version?: number
  document_type?: string
  created_by?: string
}

// ─── READS ────────────────────────────────────────────────────────────────────

// Replaces:
//   docId/page.tsx
//   supabase.from('documents').select('*').eq('id', docId).single()
export async function getDocument(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<Document>> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return err(error.message)
  return ok(data as Document)
}

// Replaces:
//   HubTableGeneratorModal.tsx, GenerateTableModal.tsx — documents for insert mode
//   supabase.from('documents').select('id, title').eq('project_id', projectId)
//     .is('deleted_at', null).order('updated_at', { ascending: false })
export async function getProjectDocuments(
  supabase: SupabaseClient,
  projectId: string
): Promise<DataListResult<{ id: string; title: string }>> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) return errList(error.message)
  return okList((data ?? []) as { id: string; title: string }[])
}

// Replaces:
//   FeedbackForm.tsx — get document for audit context
//   supabase.from('documents').select('project_id, title').eq('id', id).maybeSingle()
export async function getDocumentForAudit(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<{ project_id: string; title: string } | null>> {
  const { data, error } = await supabase
    .from('documents')
    .select('project_id, title')
    .eq('id', id)
    .maybeSingle()
  if (error) return err(error.message)
  return ok(data as { project_id: string; title: string } | null)
}

// ─── WRITES ───────────────────────────────────────────────────────────────────

// Replaces:
//   MinimalEditor.tsx — auto-save content
//   supabase.from('documents').update({ content, word_count, updated_at }).eq('id', documentId)
export async function saveDocumentContent(
  supabase: SupabaseClient,
  id: string,
  content: Record<string, unknown>,
  wordCount: number
): Promise<DataResult<null>> {
  const update: DocumentContentUpdate = {
    content,
    word_count: wordCount,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('documents')
    .update(update as Record<string, unknown>)
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}

// Replaces:
//   MinimalEditor.tsx — save title on blur
//   supabase.from('documents').update({ title }).eq('id', documentId)
export async function updateDocumentTitle(
  supabase: SupabaseClient,
  id: string,
  title: string
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('documents')
    .update({ title })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}

// Replaces:
//   FeedbackForm.tsx — update status after approval or revision request
//   supabase.from('documents').update({ status }).eq('id', documentId)
export async function updateDocumentStatus(
  supabase: SupabaseClient,
  id: string,
  status: DocumentStatus
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('documents')
    .update({ status })
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}

// Replaces:
//   HubTableGeneratorModal.tsx, GenerateTableModal.tsx — create new document
//   supabase.from('documents').insert({ project_id, title, content, status, word_count, current_version })
//     .select('id').single()
export async function createDocument(
  supabase: SupabaseClient,
  input: DocumentInsert
): Promise<DataResult<{ id: string }>> {
  const { data, error } = await supabase
    .from('documents')
    .insert(input as Record<string, unknown>)
    .select('id')
    .single()
  if (error) return err(error.message)
  return ok(data as { id: string })
}

// Replaces:
//   docId/page.tsx — soft delete document
//   supabase.from('documents').update({ deleted_at: new Date().toISOString() }).eq('id', docId)
export async function softDeleteDocument(
  supabase: SupabaseClient,
  id: string
): Promise<DataResult<null>> {
  const { error } = await supabase
    .from('documents')
    .update({ deleted_at: new Date().toISOString() } as Record<string, unknown>)
    .eq('id', id)
  if (error) return err(error.message)
  return ok(null)
}
