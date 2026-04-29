/**
 * Public Portfolio Page
 * /profile/[username]
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Building2, Briefcase, ExternalLink, Shield, CheckCircle, Plus, X } from 'lucide-react'
import { ActivitySection } from '@/components/portfolio/ActivitySection'
import { ShareSection } from '@/components/portfolio/ShareSection'
import { EditProfileModal } from '@/components/portfolio/EditProfileModal'
import { BrandLogo } from '@/components/layout/BrandLogo'
import type { PortfolioData } from '@/types/portfolio'

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddPub, setShowAddPub] = useState(false)
  const [pubForm, setPubForm] = useState({ title: '', doi: '', journal: '', year: '' })
  const [pubSaving, setPubSaving] = useState(false)
  const [pubError, setPubError] = useState<string | null>(null)
  const [togglingPrivacy, setTogglingPrivacy] = useState(false)

  useEffect(() => {
    fetchPortfolio()
  }, [username]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchPortfolio() {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/portfolio/${username.toLowerCase()}`)
      if (!response.ok) {
        setError(response.status === 404 ? 'Portfolio not found' : 'Failed to load portfolio')
        return
      }
      setPortfolio(await response.json())
    } catch {
      setError('Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }

  const handleProfileSaved = async (data: Record<string, any>) => {
    const res = await fetch('/api/portfolio/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || 'Failed to save profile')
    }
    await fetchPortfolio()
  }

  const handleTogglePrivacy = async () => {
    if (!portfolio) return
    setTogglingPrivacy(true)
    try {
      const newValue = !portfolio.profile.portfolio_public
      const res = await fetch('/api/portfolio/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolio_public: newValue }),
      })
      if (res.ok) await fetchPortfolio()
    } finally {
      setTogglingPrivacy(false)
    }
  }

  const handleAddPublication = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pubForm.title.trim()) { setPubError('Title is required'); return }
    setPubSaving(true)
    setPubError(null)
    try {
      const res = await fetch('/api/portfolio/publications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pubForm.title,
          doi: pubForm.doi || undefined,
          journal: pubForm.journal || undefined,
          year: pubForm.year ? Number(pubForm.year) : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setPubError(body.error || 'Failed to add publication')
        return
      }
      setPubForm({ title: '', doi: '', journal: '', year: '' })
      setShowAddPub(false)
      await fetchPortfolio()
    } catch {
      setPubError('Failed to add publication')
    } finally {
      setPubSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-clinical-blue rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !portfolio) {
    return (
      <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Portfolio not found</h1>
          <p className="text-sm text-slate-500 mb-6">This profile doesn't exist or is private.</p>
          <Link href="/" className="text-sm text-clinical-blue hover:underline">Return to home</Link>
        </div>
      </div>
    )
  }

  const badge = portfolio.integrity_record.badge
  const isPublic = portfolio.profile.portfolio_public

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 h-14 flex items-center px-6 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
          <BrandLogo variant="standalone" />
          <div className="flex items-center gap-3">
            {portfolio.is_owner ? (
              <>
                <button
                  onClick={() => setShowEditModal(true)}
                  className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Edit Profile
                </button>
                <button
                  onClick={handleTogglePrivacy}
                  disabled={togglingPrivacy}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                    isPublic
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      : 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100'
                  }`}
                >
                  {togglingPrivacy ? '…' : isPublic ? 'Public' : 'Private'}
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                  Sign in
                </Link>
                <Link href="/register" className="text-sm font-semibold text-white bg-clinical-blue hover:bg-clinical-deep px-3 py-1.5 rounded-lg transition-colors">
                  Create portfolio
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mb-8">
          {/* Left: Profile info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            {/* Badge pill */}
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold mb-4"
              style={{ color: badge.color, borderColor: badge.color, backgroundColor: `${badge.color}10` }}
            >
              <Shield className="w-3 h-3" />
              {badge.label}
            </div>

            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {portfolio.profile.full_name}
            </h1>

            {portfolio.profile.portfolio_headline && (
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                {portfolio.profile.portfolio_headline}
              </p>
            )}

            <div className="flex flex-wrap gap-4 mt-3">
              {portfolio.profile.institution && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-600">{portfolio.profile.institution}</span>
                </div>
              )}
              {portfolio.profile.role && (
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm text-slate-600">{portfolio.profile.role}</span>
                </div>
              )}
            </div>

            {portfolio.profile.research_areas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {portfolio.profile.research_areas.map((area) => (
                  <span key={area} className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded-md">
                    {area}
                  </span>
                ))}
              </div>
            )}

            {(portfolio.profile.orcid_id || portfolio.profile.google_scholar_url || portfolio.profile.personal_website) && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                {portfolio.profile.orcid_id && (
                  <a
                    href={`https://orcid.org/${portfolio.profile.orcid_id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    ORCID <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {portfolio.profile.google_scholar_url && (
                  <a
                    href={portfolio.profile.google_scholar_url}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    Scholar <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {portfolio.profile.personal_website && (
                  <a
                    href={portfolio.profile.personal_website}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                  >
                    Website <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {portfolio.profile.bio && (
              <p className="text-sm text-slate-600 leading-relaxed mt-4 pt-4 border-t border-slate-100">
                {portfolio.profile.bio}
              </p>
            )}
          </div>

          {/* Right: Integrity score card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Research Integrity Score
            </p>

            <div className="flex justify-center mb-4">
              <div className="relative w-20 h-20">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" stroke="#f1f5f9" strokeWidth="6" fill="none" />
                  <circle
                    cx="50" cy="50" r="44"
                    stroke={badge.color} strokeWidth="6" fill="none"
                    strokeDasharray={`${(portfolio.integrity_record.integrity_score / 100) * 276} 276`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold" style={{ color: badge.color }}>
                    {portfolio.integrity_record.integrity_score}
                  </span>
                  <span className="text-xs text-slate-400">/100</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <ScoreRow label="Avg DQI" value={`${portfolio.integrity_record.breakdown.avg_dqi}/100`} color={badge.color} />
              <ScoreRow label="Supervision" value={`${Math.round(portfolio.integrity_record.breakdown.supervision_rate)}%`} color={badge.color} />
              <ScoreRow label="Assumption Checks" value={`${Math.round(portfolio.integrity_record.breakdown.assumption_check_rate)}%`} color={badge.color} />
              <ScoreRow label="Chain Verified" value={`${Math.round(portfolio.integrity_record.breakdown.chain_verification_rate)}%`} color={badge.color} />
            </div>

            <div className="mt-auto pt-4 border-t border-slate-100 text-center">
              <span className="text-xs font-semibold" style={{ color: badge.color }}>{badge.label}</span>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{badge.description}</p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Datasets', value: portfolio.stats.total_datasets, sub: `${portfolio.stats.datasets_supervisor_approved} verified` },
            { label: 'Analyses', value: portfolio.stats.total_analyses, sub: `${portfolio.stats.analyses_with_assumption_checks} with checks` },
            { label: 'Participants', value: portfolio.stats.total_participants_studied.toLocaleString(), sub: 'studied' },
            { label: 'Publications', value: portfolio.stats.total_publications, sub: `${portfolio.stats.total_certificates} certified` },
            { label: 'Active Since', value: new Date(portfolio.stats.research_active_since).getFullYear(), sub: 'researcher' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 px-4 py-4 text-center">
              <div className="text-2xl font-bold text-clinical-blue">{stat.value}</div>
              <div className="text-xs font-semibold text-slate-700 mt-1">{stat.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Publications */}
        {(portfolio.is_owner || portfolio.publications.length > 0) && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Publications</h2>
                <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  {portfolio.publications.length}
                </span>
              </div>
              {portfolio.is_owner && !showAddPub && (
                <button
                  onClick={() => { setShowAddPub(true); setPubError(null) }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-clinical-blue border border-clinical-blue/30 bg-clinical-blue/5 hover:bg-clinical-blue/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              )}
            </div>

            {showAddPub && (
              <form onSubmit={handleAddPublication} className="bg-white rounded-xl border border-slate-200 p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-900">New Publication</h3>
                  <button type="button" onClick={() => { setShowAddPub(false); setPubError(null) }}
                    className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {pubError && <p className="text-xs text-red-600 mb-3">{pubError}</p>}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Title *</label>
                    <input type="text" required value={pubForm.title}
                      onChange={(e) => setPubForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-blue/30 focus:border-clinical-blue"
                      placeholder="Publication title" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">DOI (optional)</label>
                    <input type="text" value={pubForm.doi}
                      onChange={(e) => setPubForm(f => ({ ...f, doi: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-blue/30 focus:border-clinical-blue"
                      placeholder="10.xxxx/xxxxx" />
                  </div>
                  <div className="grid grid-cols-[1fr_120px] gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Journal</label>
                      <input type="text" value={pubForm.journal}
                        onChange={(e) => setPubForm(f => ({ ...f, journal: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-blue/30 focus:border-clinical-blue"
                        placeholder="Journal name" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Year</label>
                      <input type="number" value={pubForm.year} min={1900} max={2100}
                        onChange={(e) => setPubForm(f => ({ ...f, year: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-blue/30 focus:border-clinical-blue"
                        placeholder="2024" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                  <button type="button" onClick={() => { setShowAddPub(false); setPubError(null) }}
                    className="text-sm text-slate-500 hover:text-slate-800">
                    Cancel
                  </button>
                  <button type="submit" disabled={pubSaving}
                    className="px-4 py-2 bg-clinical-blue text-white text-sm font-semibold rounded-lg hover:bg-clinical-deep disabled:opacity-50 transition-colors">
                    {pubSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}

            {portfolio.publications.length === 0 && portfolio.is_owner && !showAddPub ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
                <p className="text-sm font-semibold text-slate-700 mb-1">No publications yet</p>
                <p className="text-xs text-slate-400 mb-4">Link your PLEXUS research certificate to published work.</p>
                <button onClick={() => { setShowAddPub(true); setPubError(null) }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-clinical-blue border border-clinical-blue/30 bg-clinical-blue/5 hover:bg-clinical-blue/10 px-3 py-1.5 rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add first publication
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {portfolio.publications.map((pub) => (
                  <PublicationCard key={pub.id} publication={pub} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Certificates */}
        {(portfolio.is_owner || portfolio.certificates.length > 0) && (
          <section className="mb-8">
            <h2 className="text-base font-bold text-slate-900 mb-1">Research Certificates</h2>
            <p className="text-xs text-slate-400 mb-4">Verified data lineage records for datasets used in research.</p>
            {portfolio.certificates.length === 0 && portfolio.is_owner ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                <p className="text-sm text-slate-500">
                  Certificates are generated automatically from your datasets.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {portfolio.certificates.map((cert) => (
                  <CertificateCard key={cert.id} certificate={cert} />
                ))}
              </div>
            )}
          </section>
        )}

        <ActivitySection activity={portfolio.activity} isOwner={portfolio.is_owner} />
        <ShareSection username={username} badgeLevel={portfolio.integrity_record.badge.level} isOwner={portfolio.is_owner} isPublic={portfolio.profile.portfolio_public} />
      </main>

      {portfolio.is_owner && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleProfileSaved}
          profile={portfolio.profile}
        />
      )}
    </div>
  )
}

function ScoreRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-mono font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}

function PublicationCard({ publication }: { publication: any }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {publication.study_type && (
            <span className="inline-block px-2 py-0.5 text-xs font-medium text-slate-500 bg-slate-100 rounded mb-2">
              {publication.study_type}
            </span>
          )}
          {publication.year && (
            <span className="ml-2 text-xs text-slate-400 font-mono">{publication.year}</span>
          )}
          {publication.title && (
            <h3 className="text-sm font-semibold text-slate-900 leading-snug mt-1">
              {publication.doi ? (
                <a href={`https://doi.org/${publication.doi}`} target="_blank" rel="noopener noreferrer"
                   className="hover:text-clinical-blue transition-colors">
                  {publication.title}
                </a>
              ) : publication.title}
            </h3>
          )}
          {publication.journal && (
            <p className="text-xs text-slate-400 italic mt-1">{publication.journal}</p>
          )}
          {publication.abstract && (
            <p className="text-xs text-slate-500 leading-relaxed mt-2 line-clamp-2">{publication.abstract}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {publication.supervisor_approved && (
            <span title="Supervisor approved">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </span>
          )}
          {publication.dqi_score && (
            <span className="text-xs font-mono text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
              {publication.dqi_score}/100
            </span>
          )}
        </div>
      </div>
      {publication.sample_size && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <span className="text-xs font-mono text-slate-400">N = {publication.sample_size}</span>
        </div>
      )}
    </div>
  )
}

function CertificateCard({ certificate }: { certificate: any }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="w-7 h-7 rounded-lg bg-clinical-blue flex items-center justify-center">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
        {certificate.chain_verified && (
          <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Verified
          </span>
        )}
      </div>
      <h3 className="text-sm font-semibold text-slate-900 leading-snug">
        {certificate.display_title || certificate.dataset_name}
      </h3>
      {certificate.context_note && (
        <p className="text-xs text-slate-400 italic mt-1 line-clamp-2">{certificate.context_note}</p>
      )}
      <div className="mt-3 space-y-1">
        {certificate.dqi_score_snapshot && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">DQI</span>
            <span className="text-xs font-mono font-semibold text-slate-700">{certificate.dqi_score_snapshot}/100</span>
          </div>
        )}
        {certificate.supervisor_approved && (
          <div className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-500" />
            <span className="text-xs text-slate-500">Supervisor approved</span>
          </div>
        )}
      </div>
    </div>
  )
}
