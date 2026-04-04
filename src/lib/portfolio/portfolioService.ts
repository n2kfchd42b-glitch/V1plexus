/**
 * Portfolio Service
 * Computes portfolio stats, integrity records, and aggregates portfolio data
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type {
  PortfolioStats,
  IntegrityRecord,
  IntegrityBadge,
  ActivitySummary,
  PortfolioData,
  ResearcherProfile,
  PortfolioPublication,
  PortfolioPublicCert,
} from '@/types/portfolio'

/**
 * Generate username from full name
 * Format: lowercase, hyphens, alphanumeric only
 */
export function generateUsernameFromName(fullName: string): string {
  const base = fullName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 25)

  return base
}

/**
 * Compute portfolio statistics
 */
export async function computePortfolioStats(
  profileId: string,
  isOwner: boolean,
  supabase: SupabaseClient
): Promise<PortfolioStats> {
  // Fetch datasets
  const { data: datasets } = await supabase
    .from('datasets')
    .select(
      `
      id,
      created_at,
      dataset_versions(
        row_count,
        created_at
      )
    `
    )
    .eq('uploaded_by', profileId)
    .is('deleted_at', null)

  // Fetch completed analyses from audit_logs
  const { data: analyses } = await supabase
    .from('audit_logs')
    .select('id, timestamp')
    .eq('actor_id', profileId)
    .eq('action', 'analysis.run.completed')

  // Fetch certificates
  const certQuery = supabase
    .from('portfolio_certificates')
    .select('dqi_score_snapshot, supervisor_approved, assumption_checks_conducted, reentry_conducted')
    .eq('profile_id', profileId)

  if (!isOwner) {
    certQuery.eq('is_public', true)
  }

  const { data: certs } = await certQuery

  // Fetch publications
  const pubQuery = supabase
    .from('portfolio_publications')
    .select('id')
    .eq('profile_id', profileId)

  if (!isOwner) {
    pubQuery.eq('is_public', true)
  }

  const { data: pubs } = await pubQuery

  // Calculate average DQI
  const avgDqi =
    certs && certs.length > 0
      ? Math.round(
          certs.reduce((sum, c) => sum + (c.dqi_score_snapshot || 0), 0) /
            certs.length
        )
      : null

  // Count supervision
  const supervised =
    certs?.filter((c) => c.supervisor_approved).length ?? 0

  // Count assumption checks
  const withChecks =
    certs?.filter((c) => c.assumption_checks_conducted).length ?? 0

  // Count re-entry
  const withReentry =
    certs?.filter((c) => c.reentry_conducted).length ?? 0

  // Count total participants
  const totalParticipants =
    datasets?.reduce((sum, d) => {
      const latestVersion = d.dataset_versions
        ?.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )[0]
      return sum + (latestVersion?.row_count || 0)
    }, 0) ?? 0

  // Collect all dates for activity range
  const allDates = [
    ...(datasets?.map((d) => d.created_at) ?? []),
    ...(analyses?.map((a) => a.timestamp) ?? []),
  ].sort()

  return {
    total_datasets: datasets?.length ?? 0,
    total_analyses: analyses?.length ?? 0,
    total_publications: pubs?.length ?? 0,
    total_certificates: certs?.length ?? 0,
    avg_dqi_score: avgDqi,
    datasets_supervisor_approved: supervised,
    analyses_with_assumption_checks: withChecks,
    datasets_with_reentry: withReentry,
    research_active_since: allDates[0] ?? new Date().toISOString(),
    last_active:
      allDates[allDates.length - 1] ?? new Date().toISOString(),
    total_participants_studied: totalParticipants,
  }
}

/**
 * Compute integrity record and badge
 */
export function computeIntegrityRecord(
  stats: PortfolioStats,
  certs: PortfolioPublicCert[]
): IntegrityRecord {
  const total = certs.length

  if (total === 0) {
    return {
      integrity_score: 0,
      integrity_level: 'emerging',
      breakdown: {
        avg_dqi: 0,
        supervision_rate: 0,
        assumption_check_rate: 0,
        chain_verification_rate: 0,
      },
      badge: {
        level: 'plexus_emerging',
        label: 'PLEXUS Emerging',
        description: 'Research portfolio in progress',
        color: '#737685',
        icon: 'seedling',
      },
    }
  }

  const supervisionRate =
    total > 0 ? (stats.datasets_supervisor_approved / total) * 100 : 0

  const assumptionRate =
    total > 0
      ? (stats.analyses_with_assumption_checks /
          Math.max(stats.total_analyses, 1)) *
        100
      : 0

  const chainRate =
    (certs.filter((c) => c.chain_verified).length / total) * 100

  const dqiComponent = (stats.avg_dqi_score ?? 0) * 0.4
  const supervisionComponent = supervisionRate * 0.2
  const assumptionComponent = assumptionRate * 0.2
  const chainComponent = chainRate * 0.2

  const score = Math.round(
    dqiComponent +
      supervisionComponent +
      assumptionComponent +
      chainComponent
  )

  const pubCount = stats.total_publications

  const level: 'verified' | 'established' | 'emerging' =
    score >= 80 && pubCount >= 3
      ? 'verified'
      : score >= 60 || pubCount >= 1
        ? 'established'
        : 'emerging'

  const badges: Record<
    'verified' | 'established' | 'emerging',
    IntegrityBadge
  > = {
    verified: {
      level: 'plexus_verified',
      label: 'PLEXUS Verified',
      description:
        'High-integrity research record with multiple verified publications',
      color: '#003d9b',
      icon: 'shield-check',
    },
    established: {
      level: 'plexus_established',
      label: 'PLEXUS Established',
      description: 'Documented research record with verified data practices',
      color: '#0d9488',
      icon: 'shield',
    },
    emerging: {
      level: 'plexus_emerging',
      label: 'PLEXUS Emerging',
      description: 'Research portfolio in development',
      color: '#737685',
      icon: 'shield-outline',
    },
  }

  return {
    integrity_score: score,
    integrity_level: level,
    breakdown: {
      avg_dqi: stats.avg_dqi_score ?? 0,
      supervision_rate: supervisionRate,
      assumption_check_rate: assumptionRate,
      chain_verification_rate: chainRate,
    },
    badge: badges[level],
  }
}

/**
 * Build researcher profile object
 */
export async function buildResearcherProfile(
  profileData: any,
  supabase: SupabaseClient
): Promise<ResearcherProfile> {
  // Generate initials
  const names = profileData.full_name?.split(' ') ?? ['U']
  const initials = names
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase())
    .join('')
    .slice(0, 2) || 'U'

  return {
    id: profileData.id,
    username: profileData.username || null,
    full_name: profileData.full_name || 'Unknown Researcher',
    bio: profileData.bio || null,
    institution: profileData.institution || null,
    role: profileData.position || profileData.role || null,
    position: profileData.position || null,
    research_areas: profileData.research_areas || [],
    orcid_id: profileData.orcid_id || null,
    google_scholar_url: profileData.google_scholar_url || null,
    researchgate_url: profileData.researchgate_url || null,
    personal_website: profileData.personal_website || null,
    portfolio_headline: profileData.portfolio_headline || null,
    avatar_color: profileData.avatar_color || '#003d9b',
    initials,
    joined_at: profileData.created_at || new Date().toISOString(),
    portfolio_public: profileData.portfolio_public ?? true,
  }
}

/**
 * Fetch complete portfolio data
 */
export async function fetchPortfolioData(
  username: string,
  currentUserId: string | null,
  supabase: SupabaseClient
): Promise<PortfolioData | null> {
  // Fetch profile by username
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', username)
    .single()

  if (profileError || !profileData) {
    return null
  }

  // Check if owner
  const isOwner = currentUserId === profileData.id

  // Check portfolio visibility
  if (!isOwner && !profileData.portfolio_public) {
    return null // Private portfolio
  }

  // Build profile
  const profile = await buildResearcherProfile(profileData, supabase)

  // Compute stats
  const stats = await computePortfolioStats(
    profileData.id,
    isOwner,
    supabase
  )

  // Fetch publications
  let pubQuery = supabase
    .from('portfolio_publications')
    .select('*')
    .eq('profile_id', profileData.id)
    .order('year', { ascending: false })

  if (!isOwner) {
    pubQuery = pubQuery.eq('is_public', true)
  }

  const { data: publications = [] } = await pubQuery

  // Fetch certificates
  let certQuery = supabase
    .from('portfolio_certificates')
    .select(
      `
      *,
      datasets(name, source)
    `
    )
    .eq('profile_id', profileData.id)
    .order('created_at', { ascending: false })

  if (!isOwner) {
    certQuery = certQuery.eq('is_public', true)
  }

  const { data: certificatesRawData } = await certQuery
  const certificatesRaw = certificatesRawData ?? []

  // Map certificates
  const certificates: PortfolioPublicCert[] = certificatesRaw.map(
    (c: any) => ({
      ...c,
      dataset_name: c.datasets?.name,
      dataset_source: c.datasets?.source,
    })
  )

  // Compute integrity record
  const integrityRecord = computeIntegrityRecord(stats, certificates)

  // Fetch activity summary (last 365 days)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  const { data: activityLogsData } = await supabase
    .from('audit_logs')
    .select('timestamp')
    .eq('actor_id', profileData.id)
    .gte('timestamp', oneYearAgo.toISOString())
  const activityLogs = activityLogsData ?? []

  // Group activity by date
  const dailyActivityMap = new Map<string, number>()
  const monthlyActivityMap = new Map<string, number>()

  activityLogs.forEach((log: any) => {
    const date = new Date(log.timestamp)
    const dateStr = date.toISOString().split('T')[0]
    const monthStr = dateStr.slice(0, 7)

    dailyActivityMap.set(dateStr, (dailyActivityMap.get(dateStr) ?? 0) + 1)
    monthlyActivityMap.set(monthStr, (monthlyActivityMap.get(monthStr) ?? 0) + 1)
  })

  const dailyActivity = Array.from(dailyActivityMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const monthlyAnalyses = Array.from(monthlyActivityMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // Fetch analysis types (from audit_logs)
  const { data: analysisLogsData } = await supabase
    .from('audit_logs')
    .select('details')
    .eq('actor_id', profileData.id)
    .eq('action', 'analysis.run.completed')
  const analysisLogs = analysisLogsData ?? []

  const analysisTypeCounts = new Map<string, number>()
  analysisLogs.forEach((log: any) => {
    const type = log.details?.operation?.analysis_type || 'Other'
    analysisTypeCounts.set(type, (analysisTypeCounts.get(type) ?? 0) + 1)
  })

  const totalAnalyses = analysisTypeCounts.size > 0
    ? Array.from(analysisTypeCounts.values()).reduce((a, b) => a + b, 0)
    : 0

  const analysisTypes = Array.from(analysisTypeCounts.entries())
    .map(([type, count]) => ({
      type,
      count,
      pct: totalAnalyses > 0 ? Math.round((count / totalAnalyses) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const activity: ActivitySummary = {
    monthly_analyses: monthlyAnalyses,
    analysis_types: analysisTypes,
    geographic_focus: [], // TODO: Extract from dataset metadata if available
    daily_activity: dailyActivity,
  }

  return {
    profile,
    stats,
    publications: publications || [],
    certificates,
    activity,
    integrity_record: integrityRecord,
    is_owner: isOwner,
  }
}
