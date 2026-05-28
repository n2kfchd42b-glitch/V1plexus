'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { tierLabel } from '@/lib/institutions/tier'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  Shield,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AADFlag {
  code: string
  name: string
  risk: string
  triggered: boolean
}

interface InstitutionStamp {
  slug: string
  name: string
  short_name: string | null
  logo_url: string | null
  brand_color: string | null
  verification_tier: string | null
}

interface SharedVerificationResult {
  pvp_root_hash: string
  trust_level: number
  trust_label: string
  overall_status: string
  aad_risk: string
  submission_mode: string
  ptls_version: string
  verified_at: string
  valid_until: string
  certificate_hash: string
  human_readable: string
  share_url: string
  aad_flags: AADFlag[]
  integrity_passed: boolean
  institution_branding: InstitutionStamp | null
}

// ── Trust level config ────────────────────────────────────────────────────────

const TRUST_CONFIG: Record<
  number,
  { bg: string; border: string; iconColor: string; textColor: string; subtext: string }
> = {
  0: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
    textColor: 'text-red-900',
    subtext: 'This package failed verification.',
  },
  1: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-600',
    textColor: 'text-amber-900',
    subtext: 'This analysis is internally consistent and untampered.',
  },
  2: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    iconColor: 'text-teal-600',
    textColor: 'text-teal-900',
    subtext: 'This analysis is fully traceable and statistically auditable.',
  },
  3: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    iconColor: 'text-green-700',
    textColor: 'text-green-900',
    subtext: 'This analysis is institutionally accountable and audit-ready.',
  },
}

const SUBMISSION_CHIP: Record<string, { label: string; cls: string }> = {
  individual:    { label: 'Individual Submission',    cls: 'bg-zinc-100 text-zinc-600' },
  supervised:    { label: 'Supervised Submission',    cls: 'bg-blue-100 text-blue-700' },
  institutional: { label: 'Institutional Submission', cls: 'bg-green-100 text-green-700' },
}

const AAD_EXPLANATIONS: Record<string, string> = {
  'AAD-01': 'More analysis runs were performed than outputs produced. This may indicate selective reporting.',
  'AAD-02': 'Data points were removed immediately before a significant result was found.',
  'AAD-03': 'Variables were redefined after the first analysis was run.',
  'AAD-04': 'Statistical checks were performed after analysis, not before.',
  'AAD-05': 'The primary outcome being measured changed between analysis runs.',
  'AAD-06': 'Most analysis activity occurred after data collection was complete.',
}

// ── Dimension derivation ──────────────────────────────────────────────────────

function deriveFromHumanReadable(text: string) {
  const has = (s: string) => text.includes(s)

  const integrity     = has('Package integrity  : PASS') && has('Hash chain         : PASS')
  const reproducible  = has('Reproducible run  : YES')
  const authorSigned  = has('Author signature  : YES') || has('Author Signed:       ✅')
  const assumptions   = has('Assumption checks : YES')
  const dqi           = has('DQI score >= 0.7  : YES')
  const supSigned     = has('Supervisor Signed:   ✅')
  const supNA         = has('Supervisor Signed:   N/A')
  const supFail       = has('Supervisor Signed:   ❌')

  const reproducibility = reproducible && authorSigned
  const transparency    = assumptions && dqi

  return { integrity, reproducible, authorSigned, assumptions, dqi, supSigned, supNA, supFail, reproducibility, transparency }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: 'pass' | 'warn' | 'fail' | 'na' }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
  if (status === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
  if (status === 'fail') return <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
  return <span className="h-4 w-4 flex-shrink-0 text-zinc-400 text-xs font-mono">N/A</span>
}

function DimensionCard({
  title,
  status,
  explanation,
}: {
  title: string
  status: 'pass' | 'warn' | 'fail' | 'na'
  explanation: string
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-[0_1px_6px_rgba(0,0,0,0.06)] border border-zinc-100">
      <div className="flex items-center gap-2 mb-1.5">
        <StatusIcon status={status} />
        <span
          className="text-xs font-semibold uppercase tracking-wider text-zinc-500"
          style={{ fontFamily: 'var(--font-manrope, Manrope, system-ui)' }}
        >
          {title}
        </span>
      </div>
      <p className="text-sm text-zinc-600 leading-relaxed">{explanation}</p>
    </div>
  )
}

function AADFlagCard({ flag }: { flag: AADFlag }) {
  const [open, setOpen] = useState(false)
  const riskCls =
    flag.risk === 'HIGH'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700'

  return (
    <div className="bg-white rounded-xl border border-zinc-100 shadow-[0_1px_6px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="text-xs font-mono font-bold text-zinc-400 mt-0.5 flex-shrink-0">
          {flag.code}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-zinc-800">{flag.name}</span>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${riskCls}`}>
              {flag.risk}
            </span>
          </div>
          <p className="text-sm text-zinc-500">{flag.name}</p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors ml-2"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-zinc-100 px-4 py-3 bg-zinc-50">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">
            What this means
          </p>
          <p className="text-sm text-zinc-600 leading-relaxed">
            {AAD_EXPLANATIONS[flag.code] ?? flag.name}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VerifyHashPage() {
  const { pvp_root_hash } = useParams<{ pvp_root_hash: string }>()
  const [result, setResult] = useState<SharedVerificationResult | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [certOpen, setCertOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!pvp_root_hash) return
    fetch(`/api/journal/report/${encodeURIComponent(pvp_root_hash)}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        const data = await res.json()
        setResult(data)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [pvp_root_hash])

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app,#f7f9fb)] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading verification record…</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (notFound || !result) {
    return (
      <div className="min-h-screen bg-[var(--bg-app,#f7f9fb)] flex flex-col">
        <Header />
        <div className="flex-1 flex items-start justify-center px-4 py-16">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-10 text-center">
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2
              className="text-xl font-bold text-zinc-800 mb-2"
              style={{ fontFamily: 'var(--font-manrope, Manrope, system-ui)' }}
            >
              No verification record found.
            </h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              This package has not been verified yet, or the link is incorrect.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Derive dimensions ─────────────────────────────────────────────────────
  const dims = deriveFromHumanReadable(result.human_readable)
  const cfg   = TRUST_CONFIG[result.trust_level] ?? TRUST_CONFIG[0]
  const chip  = SUBMISSION_CHIP[result.submission_mode] ?? SUBMISSION_CHIP['individual']

  const triggeredFlags = (result.aad_flags ?? []).filter((f) => f.triggered)
  const showAAD = triggeredFlags.length > 0

  const endorsementStatus: 'pass' | 'na' | 'fail' =
    dims.supSigned ? 'pass' : dims.supNA ? 'na' : 'fail'

  const endorsementText =
    endorsementStatus === 'pass'
      ? 'This work has been co-signed by a verified supervisor.'
      : endorsementStatus === 'na'
      ? 'Individual submission. No supervisor endorsement required.'
      : 'Supervisor endorsement was expected but not found.'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-app,#f7f9fb)] flex flex-col">
      <Header />

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl space-y-5">

          {/* ── Institution wordmark (only when the certificate is from a thesis whose institution was snapshotted at submission) ── */}
          {result.institution_branding && (
            <a
              href={`/institutions/${result.institution_branding.slug}`}
              className="flex items-center gap-3 bg-white rounded-2xl border border-zinc-100 px-5 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-shadow"
              style={result.institution_branding.brand_color ? { borderColor: `${result.institution_branding.brand_color}33` } : undefined}
            >
              <div
                className="w-12 h-12 rounded-lg border border-zinc-100 bg-white flex items-center justify-center flex-shrink-0 overflow-hidden"
                style={result.institution_branding.brand_color ? { borderColor: `${result.institution_branding.brand_color}40` } : undefined}
              >
                {result.institution_branding.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.institution_branding.logo_url}
                    alt={`${result.institution_branding.name} logo`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Shield className="h-5 w-5 text-zinc-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">
                  Submitted at
                </p>
                <p className="text-sm font-bold text-zinc-800 truncate">
                  {result.institution_branding.name}
                </p>
                {result.institution_branding.verification_tier && (
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    {tierLabel(result.institution_branding.verification_tier)}
                  </p>
                )}
              </div>
              <ExternalLink className="h-4 w-4 text-zinc-400 flex-shrink-0" />
            </a>
          )}

          {/* ── Section 1: Trust Badge ────────────────────────────────── */}
          <div
            className={`rounded-2xl border px-8 py-7 ${cfg.bg} ${cfg.border}`}
          >
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 mt-0.5">
                {result.trust_level === 0 ? (
                  <XCircle className={`h-10 w-10 ${cfg.iconColor}`} />
                ) : (
                  <CheckCircle2 className={`h-10 w-10 ${cfg.iconColor}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h1
                    className={`text-xl font-extrabold ${cfg.textColor}`}
                    style={{ fontFamily: 'var(--font-manrope, Manrope, system-ui)' }}
                  >
                    {result.trust_label}
                  </h1>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${chip.cls}`}
                  >
                    {chip.label}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${cfg.textColor} opacity-80`}>
                  {cfg.subtext}
                </p>
                <p className="text-xs text-zinc-400 mt-2 font-mono">
                  Level {result.trust_level} · PTLS {result.ptls_version}
                </p>
              </div>
            </div>
          </div>

          {/* ── Section 2: Dimension Cards ─────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DimensionCard
              title="Integrity"
              status={dims.integrity ? 'pass' : 'fail'}
              explanation={
                dims.integrity
                  ? 'The analysis chain is intact. Nothing was changed after the work was done.'
                  : 'The analysis chain is broken. Data may have been altered.'
              }
            />
            <DimensionCard
              title="Reproducibility"
              status={dims.reproducibility ? 'pass' : dims.reproducible ? 'warn' : 'fail'}
              explanation={
                dims.reproducibility
                  ? 'All analysis runs are documented and can be reproduced.'
                  : 'Some analysis runs are not fully documented.'
              }
            />
            <DimensionCard
              title="Attribution"
              status={dims.authorSigned ? 'pass' : 'fail'}
              explanation={
                dims.authorSigned
                  ? "The researcher's identity has been verified."
                  : 'Researcher identity could not be verified.'
              }
            />
            <DimensionCard
              title="Transparency"
              status={dims.transparency ? 'pass' : dims.assumptions || dims.dqi ? 'warn' : 'fail'}
              explanation={
                dims.transparency
                  ? 'All analytical decisions are documented and visible.'
                  : 'Some analytical decisions are missing documentation.'
              }
            />
            <DimensionCard
              title="Endorsement"
              status={endorsementStatus === 'na' ? 'na' : endorsementStatus === 'pass' ? 'pass' : 'fail'}
              explanation={endorsementText}
            />
          </div>

          {/* ── Section 3: AAD ─────────────────────────────────────────── */}
          {showAAD && (
            <div className="bg-white rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.06)] border border-zinc-100 p-6">
              <h2
                className="text-sm font-bold text-zinc-800 mb-1"
                style={{ fontFamily: 'var(--font-manrope, Manrope, system-ui)' }}
              >
                Analytical Pattern Flags
              </h2>
              <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                The following patterns were detected in the research workflow. These are informational
                flags for reviewers, not automatic rejections.
              </p>
              <div className="space-y-2">
                {triggeredFlags.map((flag) => (
                  <AADFlagCard key={flag.code} flag={flag} />
                ))}
              </div>
            </div>
          )}

          {/* ── Footer ────────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-zinc-100 shadow-[0_1px_6px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* Certificate details — collapsed by default */}
            <button
              onClick={() => setCertOpen(!certOpen)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm text-zinc-500 hover:bg-zinc-50 transition-colors"
            >
              <span className="font-medium">Certificate details</span>
              {certOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {certOpen && (
              <div className="border-t border-zinc-100 px-5 py-4 space-y-2.5 bg-zinc-50">
                <DetailRow label="Certificate hash">
                  <span
                    className="text-xs break-all text-zinc-600"
                    style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}
                  >
                    {result.certificate_hash}
                  </span>
                </DetailRow>
                <DetailRow label="Root hash">
                  <span
                    className="text-xs break-all text-zinc-600"
                    style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}
                  >
                    {result.pvp_root_hash}
                  </span>
                </DetailRow>
                <DetailRow label="Verified at">
                  <span className="text-xs text-zinc-600">
                    {new Date(result.verified_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
                    })} UTC
                  </span>
                </DetailRow>
                <DetailRow label="Valid until">
                  <span className="text-xs text-zinc-600">
                    {new Date(result.valid_until).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </span>
                </DetailRow>
                <DetailRow label="PTLS version">
                  <span className="text-xs text-zinc-600">{result.ptls_version}</span>
                </DetailRow>
                <p className="text-[10px] text-zinc-400 pt-1">
                  Verified by PLEXUS Verification Service
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="border-t border-zinc-100 px-5 py-3 flex items-center justify-between gap-4">
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-green-600">Link copied ✓</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy verification link
                  </>
                )}
              </button>
              <a
                href="https://plexus.science"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                What is PLEXUS?
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Header() {
  return (
    <div className="h-14 px-6 flex items-center border-b border-zinc-100 bg-white/80 backdrop-blur-xl">
      <BrandLogo variant="standalone" href="/" />
      <div className="ml-4 flex items-center gap-1.5">
        <Shield className="h-3.5 w-3.5 text-zinc-400" />
        <span className="text-xs text-zinc-400 font-medium">Verification Report</span>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-0.5">
        {label}
      </p>
      {children}
    </div>
  )
}
