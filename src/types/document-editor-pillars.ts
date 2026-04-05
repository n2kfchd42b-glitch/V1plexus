/**
 * Types for Pillar 1, 2, 5 document editor enhancements
 */

import type { CreditRole } from '@/lib/credit-taxonomy'

/**
 * DocumentVersion with enhanced fields for diff/snapshot
 */
export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  content: Record<string, unknown> | null
  content_hash?: string
  label?: string | null
  change_summary?: string | null
  is_auto_save?: boolean
  created_by?: {
    id: string
    display_name: string
  } | null
  created_at: string
  word_count?: number
}

/**
 * Document presence for collaborative editing
 */
export interface DocumentPresence {
  id: string
  document_id: string
  user_id: string
  cursor_position?: {
    line: number
    column: number
  }
  selection?: {
    from: number
    to: number
  }
  color?: string
  last_seen: string
  created_at: string
  updated_at: string
}

/**
 * Document authorship with CRediT roles
 */
export interface DocumentAuthorRole {
  id: string
  document_id: string
  user_id?: string
  display_name: string
  email?: string
  orcid?: string
  institution?: string
  credit_roles: CreditRole[]
  contribution_order: number
  is_corresponding: boolean
  confirmed_at?: string | null
  confirmation_token?: string
  confirmation_token_expires_at?: string
  added_by: string
  created_at: string
  updated_at?: string
}

/**
 * Document citations
 */
export interface DocumentCitation {
  id: string
  document_id: string
  citation_id: string
  reference_number?: number
  inserted_by?: string
  inserted_at: string
}
