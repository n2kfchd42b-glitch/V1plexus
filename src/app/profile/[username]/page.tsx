/**
 * Public Portfolio Page
 * /profile/[username]
 */

'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ActivitySection } from '@/components/portfolio/ActivitySection'
import { ShareSection } from '@/components/portfolio/ShareSection'
import type { PortfolioData } from '@/types/portfolio'

interface ProfilePageProps {
  params: { username: string }
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPortfolio()
  }, [params.username])

  async function fetchPortfolio() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/portfolio/${params.username.toLowerCase()}`
      )

      if (!response.ok) {
        if (response.status === 404) {
          setError('Portfolio not found')
        } else {
          setError('Failed to load portfolio')
        }
        return
      }

      const data = await response.json()
      setPortfolio(data)
    } catch (err) {
      console.error('Error fetching portfolio:', err)
      setError('Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !portfolio) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-on-surface mb-2">
            Portfolio not found
          </h1>
          <p className="text-on-surface-variant mb-6">
            The researcher profile you're looking for doesn't exist or is private.
          </p>
          <Link href="/" className="text-primary hover:text-primary-dark">
            Return to home
          </Link>
        </div>
      </div>
    )
  }

  const badge = portfolio.integrity_record.badge

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal NavBar */}
      <nav className="border-b border-surface-container-low h-14 flex items-center px-6">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="font-bold text-base">PLEXUS</div>
          <div className="flex gap-4">
            {portfolio.is_owner ? (
              <>
                <button className="text-sm text-on-surface-variant hover:text-on-surface">
                  Edit Profile
                </button>
                <button className="text-sm text-on-surface-variant hover:text-on-surface">
                  View as public
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-sm text-on-surface-variant hover:text-on-surface"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="text-sm text-primary hover:text-primary-dark"
                >
                  Create portfolio
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-[900px] mx-auto px-6 py-12">
        {/* Section 1: Profile Hero */}
        <section className="pb-8">
          <div className="flex gap-12">
            {/* Left column */}
            <div className="flex-1">
              {/* Integrity Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-current mb-4"
                   style={{ color: badge.color }}>
                <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-xs">
                  ⊕
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">
                  {badge.label}
                </span>
              </div>

              {/* Name */}
              <h1 className="text-4xl font-black text-on-surface tracking-tight mt-2.5">
                {portfolio.profile.full_name}
              </h1>

              {/* Headline */}
              {portfolio.profile.portfolio_headline && (
                <p className="text-base text-on-surface-variant leading-relaxed mt-1.5">
                  {portfolio.profile.portfolio_headline}
                </p>
              )}

              {/* Institution + Role */}
              <div className="flex flex-wrap gap-4 mt-3">
                {portfolio.profile.institution && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-surface-variant">🏢</span>
                    <span className="text-sm text-on-surface-variant">
                      {portfolio.profile.institution}
                    </span>
                  </div>
                )}
                {portfolio.profile.role && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-surface-variant">💼</span>
                    <span className="text-sm text-on-surface-variant">
                      {portfolio.profile.role}
                    </span>
                  </div>
                )}
              </div>

              {/* Research Areas */}
              {portfolio.profile.research_areas.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {portfolio.profile.research_areas.map((area) => (
                    <span
                      key={area}
                      className="px-3 py-1 text-xs bg-surface-container-low text-on-surface-variant rounded-full"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}

              {/* External Links */}
              <div className="flex flex-wrap gap-3 mt-4">
                {portfolio.profile.orcid_id && (
                  <a
                    href={`https://orcid.org/${portfolio.profile.orcid_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-xs font-semibold text-on-surface-variant bg-surface-container-low rounded-lg hover:bg-surface-container transition"
                  >
                    ORCID
                  </a>
                )}
                {portfolio.profile.google_scholar_url && (
                  <a
                    href={portfolio.profile.google_scholar_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-xs font-semibold text-on-surface-variant bg-surface-container-low rounded-lg hover:bg-surface-container transition"
                  >
                    Scholar
                  </a>
                )}
                {portfolio.profile.personal_website && (
                  <a
                    href={portfolio.profile.personal_website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-xs font-semibold text-on-surface-variant bg-surface-container-low rounded-lg hover:bg-surface-container transition"
                  >
                    Website
                  </a>
                )}
              </div>
            </div>

            {/* Right column - Integrity Score Card */}
            <div className="w-80">
              <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
                  Research Integrity Score
                </div>

                {/* Score Circle */}
                <div className="flex justify-center mb-6">
                  <div className="relative w-24 h-24">
                    <svg
                      className="w-full h-full transform -rotate-90"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                        fill="none"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        stroke={badge.color}
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray={`${(portfolio.integrity_record.integrity_score / 100) * 283} 283`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div
                          className="text-3xl font-black"
                          style={{ color: badge.color }}
                        >
                          {portfolio.integrity_record.integrity_score}
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          /100
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-2.5">
                  <BreakdownRow
                    label="Avg DQI Score"
                    value={`${portfolio.integrity_record.breakdown.avg_dqi}/100`}
                    color={badge.color}
                  />
                  <BreakdownRow
                    label="Supervision Rate"
                    value={`${Math.round(portfolio.integrity_record.breakdown.supervision_rate)}%`}
                    color={badge.color}
                  />
                  <BreakdownRow
                    label="Assumption Checks"
                    value={`${Math.round(portfolio.integrity_record.breakdown.assumption_check_rate)}%`}
                    color={badge.color}
                  />
                  <BreakdownRow
                    label="Chain Verified"
                    value={`${Math.round(portfolio.integrity_record.breakdown.chain_verification_rate)}%`}
                    color={badge.color}
                  />
                </div>

                <div className="h-px bg-surface-container-low my-4" />

                {/* Badge */}
                <div className="text-center">
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{
                      backgroundColor: `${badge.color}15`,
                      border: `1.5px solid ${badge.color}`,
                    }}
                  >
                    <span className="text-lg">⊕</span>
                  </div>
                  <div
                    className="font-bold text-sm"
                    style={{ color: badge.color }}
                  >
                    {badge.label}
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1 leading-relaxed line-clamp-2">
                    {badge.description}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Stats Strip */}
        <StatsStrip portfolio={portfolio} />

        {/* Section 3: Bio */}
        {portfolio.profile.bio && (
          <section className="my-8 max-w-2xl">
            <p className="text-base text-on-surface leading-relaxed">
              {portfolio.profile.bio}
            </p>
          </section>
        )}

        {/* Section 4: Publications */}
        {(portfolio.is_owner || portfolio.publications.length > 0) && (
          <PublicationsSection portfolio={portfolio} />
        )}

        {/* Section 5: Certificates */}
        {(portfolio.is_owner || portfolio.certificates.length > 0) && (
          <CertificatesSection portfolio={portfolio} />
        )}

        {/* Section 6: Activity */}
        <ActivitySection
          activity={portfolio.activity}
          isOwner={portfolio.is_owner}
        />

        {/* Section 7: Share & Verify */}
        <ShareSection
          username={portfolio.profile.username ?? ''}
          badgeLevel={portfolio.integrity_record.badge.level}
          isOwner={portfolio.is_owner}
        />
      </main>
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-on-surface-variant">{label}</span>
      <span className="font-mono text-xs font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

function StatsStrip({ portfolio }: { portfolio: PortfolioData }) {
  const stats = [
    {
      label: 'Datasets Studied',
      value: portfolio.stats.total_datasets,
      sub: `${portfolio.stats.datasets_supervisor_approved} verified`,
    },
    {
      label: 'Analyses Conducted',
      value: portfolio.stats.total_analyses,
      sub: `${portfolio.stats.analyses_with_assumption_checks} with checks`,
    },
    {
      label: 'Participants Studied',
      value: portfolio.stats.total_participants_studied.toLocaleString(),
      sub: `across ${portfolio.stats.total_datasets} datasets`,
    },
    {
      label: 'Publications',
      value: portfolio.stats.total_publications,
      sub: `${portfolio.stats.total_certificates} verified`,
    },
    {
      label: 'Research Since',
      value: new Date(portfolio.stats.research_active_since).toLocaleDateString(
        'en-US',
        { year: 'numeric', month: 'short' }
      ),
      sub: 'Active researcher',
    },
  ]

  return (
    <section className="bg-surface-container-low py-6 -mx-6 px-6 my-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex divide-x divide-surface-container">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex-1 text-center px-8">
              <div className="text-3xl font-black text-primary">
                {stat.value}
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mt-2">
                {stat.label}
              </div>
              <div className="text-xs text-on-surface-variant mt-1">
                {stat.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PublicationsSection({ portfolio }: { portfolio: PortfolioData }) {
  if (!portfolio.is_owner && portfolio.publications.length === 0) {
    return null
  }

  return (
    <section className="my-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Publications</h2>
          <span className="inline-block mt-1 px-2 py-0.5 bg-surface-container-low text-xs font-mono text-on-surface-variant rounded">
            {portfolio.publications.length} total
          </span>
        </div>
        {portfolio.is_owner && (
          <button className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-dark">
            + Add Publication
          </button>
        )}
      </div>

      {portfolio.publications.length === 0 && portfolio.is_owner ? (
        <div className="bg-surface-container-lowest rounded-2xl p-8 border-2 border-dashed border-primary border-opacity-20">
          <h3 className="font-bold text-on-surface mb-2">
            No publications yet
          </h3>
          <p className="text-sm text-on-surface-variant mb-4">
            Add a publication to link your PLEXUS research certificate to your
            published work.
          </p>
          <button className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg">
            + Add your first publication
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {portfolio.publications.map((pub) => (
            <PublicationCard key={pub.id} publication={pub} />
          ))}
        </div>
      )}
    </section>
  )
}

function PublicationCard({ publication }: { publication: any }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-7 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          {publication.study_type && (
            <span className="inline-block px-2 py-1 text-xs font-semibold text-on-surface-variant bg-surface-container-low rounded-full">
              {publication.study_type}
            </span>
          )}
          {publication.year && (
            <span className="ml-2 text-xs text-on-surface-variant font-mono">
              {publication.year}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {publication.supervisor_approved && (
            <div className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center text-xs">
              ✓
            </div>
          )}
          {publication.assumption_checks_conducted && (
            <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-xs">
              ✓
            </div>
          )}
          {publication.dqi_score && (
            <div className="px-2 py-0.5 text-xs font-mono bg-surface-container-low rounded text-on-surface-variant">
              {publication.dqi_score}/100
            </div>
          )}
        </div>
      </div>

      {publication.title && (
        <h3 className="text-lg font-bold text-on-surface mt-2">
          {publication.doi ? (
            <a
              href={`https://doi.org/${publication.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              {publication.title}
            </a>
          ) : (
            publication.title
          )}
        </h3>
      )}

      {publication.journal && (
        <p className="text-sm text-on-surface-variant italic mt-1">
          {publication.journal}
        </p>
      )}

      {publication.abstract && (
        <p className="text-sm text-on-surface-variant leading-relaxed mt-3 line-clamp-3">
          {publication.abstract}
        </p>
      )}

      <div className="flex gap-2 mt-4 pt-4 border-t border-surface-container-low">
        {publication.sample_size && (
          <span className="px-2 py-1 text-xs font-mono bg-surface-container-low rounded">
            N = {publication.sample_size}
          </span>
        )}
      </div>
    </div>
  )
}

function CertificatesSection({ portfolio }: { portfolio: PortfolioData }) {
  if (!portfolio.is_owner && portfolio.certificates.length === 0) {
    return null
  }

  return (
    <section className="my-12">
      <h2 className="text-2xl font-bold text-on-surface mb-2">
        Research Certificates
      </h2>
      <p className="text-sm text-on-surface-variant mb-6">
        Verified data lineage records for datasets used in research.
      </p>

      {portfolio.certificates.length === 0 && portfolio.is_owner ? (
        <button className="px-4 py-3 bg-primary text-white font-bold rounded-lg">
          + Add Certificate
        </button>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {portfolio.certificates.map((cert) => (
            <CertificateCard key={cert.id} certificate={cert} />
          ))}
        </div>
      )}
    </section>
  )
}

function CertificateCard({ certificate }: { certificate: any }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">
          K
        </div>
        {certificate.chain_verified && (
          <span className="text-xs font-bold text-green-600">✓ Verified</span>
        )}
      </div>

      <h3 className="font-bold text-sm text-on-surface mt-3">
        {certificate.display_title || certificate.dataset_name}
      </h3>

      {certificate.context_note && (
        <p className="text-xs text-on-surface-variant italic mt-2 line-clamp-2">
          {certificate.context_note}
        </p>
      )}

      <div className="space-y-1.5 mt-3">
        {certificate.dqi_score_snapshot && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant">DQI:</span>
            <span className="font-mono text-xs font-semibold">
              {certificate.dqi_score_snapshot}/100
            </span>
          </div>
        )}
        {certificate.supervisor_approved && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600">✓</span>
            <span className="text-xs text-on-surface-variant">
              Supervisor approved
            </span>
          </div>
        )}
      </div>

      <button className="mt-4 w-full py-2 text-xs font-bold text-primary hover:bg-primary hover:text-white transition rounded">
        View Certificate →
      </button>
    </div>
  )
}
