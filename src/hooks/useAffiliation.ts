'use client'

import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface AffiliationData {
  profile: {
    id: string
    email: string
    institution_id: string | null
    public_affiliation_visible?: boolean
    institution: {
      id: string
      name: string
      short_name: string | null
      country: string | null
      type: string | null
      logo_url: string | null
      slug: string | null
      verification_tier: 'SELF_ATTESTED' | 'DOMAIN_VERIFIED' | 'OFFICIALLY_REGISTERED' | null
    } | null
  } | null
  enrollments: Array<{
    id: string
    institution_id: string
    programme_id: string | null
    cohort_id: string | null
    department_id: string | null
    matriculation_number: string | null
    status: 'active' | 'on_leave' | 'graduated' | 'withdrawn'
    enrolled_at: string
    end_date: string | null
    programme: { id: string; name: string; short_code: string | null; degree_level: string } | null
    cohort: { id: string; year: number; label: string | null } | null
    department: { id: string; name: string } | null
  }>
  requests: Array<{
    id: string
    institution_id: string
    status: 'pending' | 'approved' | 'declined' | 'cancelled'
    message: string | null
    auto_approved: boolean
    decided_at: string | null
    decline_reason: string | null
    created_at: string
    institution: { id: string; name: string; short_name: string | null } | null
  }>
}

async function fetchAffiliation(): Promise<AffiliationData> {
  const res = await fetch('/api/me/institution-link', { cache: 'no-store' })
  if (!res.ok) throw new Error('Could not load affiliation')
  return res.json()
}

/**
 * Single source of truth for the user's institution affiliation.
 * Used by:
 *  - Header (AffiliationBadge — shows the institution + programme at a glance)
 *  - /settings (AffiliationPanel — richer detail)
 *  - LinkInstitutionCard (linked / pending / unlinked decisioning)
 *
 * Backed by React Query under a shared key, so the three consumers above
 * deduplicate to a single network request and share one cache entry instead
 * of each fetching /api/me/institution-link independently.
 */
export function useAffiliation() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['affiliation'],
    queryFn: fetchAffiliation,
  })

  // Preserve the previous async refresh() contract — callers may await it.
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['affiliation'] }),
    [queryClient],
  )

  const activeEnrollment = data?.enrollments.find((e) => e.status === 'active') ?? null
  const linked = !!data?.profile?.institution_id

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Network error') : null,
    refresh,
    activeEnrollment,
    linked,
  }
}
