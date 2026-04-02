'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Shield,
  Database,
  BarChart3,
  Users,
  ClipboardCheck,
  LinkIcon,
} from 'lucide-react'
import type { VerificationResponse } from '@/types/researchOutput'

function VerifyContent() {
  const searchParams = useSearchParams()
  const urlToken = searchParams.get('token')

  const [tokenInput, setTokenInput] = useState(urlToken || '')
  const [result, setResult] = useState<VerificationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)

  // Auto-verify if token in URL
  useEffect(() => {
    if (urlToken) {
      setTokenInput(urlToken)
      doVerify(urlToken)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken])

  const doVerify = async (token: string) => {
    const t = token.trim()
    if (!t) return
    setLoading(true)
    setResult(null)
    setVerified(false)
    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(t)}`)
      const data: VerificationResponse = await res.json()
      setResult(data)
      setVerified(data.valid)
    } catch {
      setResult({ valid: false, reason: 'Network error. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doVerify(tokenInput)
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#f7f9fb' }}
    >
      {/* Top bar */}
      <div className="h-14 px-6 flex items-center border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <span
          className="font-extrabold text-lg tracking-tight"
          style={{
            fontFamily: 'Manrope, system-ui',
            fontSize: '18px',
            fontWeight: 800,
            color: '#3730a3',
          }}
        >
          PLEXUS
        </span>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-[720px]">

          {/* LOADING STATE */}
          {loading && (
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-10 text-center">
              <div className="animate-pulse space-y-4">
                <div className="h-16 w-16 rounded-full bg-slate-100 mx-auto" />
                <div className="h-5 w-48 bg-slate-100 rounded mx-auto" />
                <div className="h-3 w-72 bg-slate-100 rounded mx-auto" />
                <div className="h-3 w-56 bg-slate-100 rounded mx-auto" />
              </div>
              <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying token...
              </div>
            </div>
          )}

          {/* INPUT STATE (no result yet, not loading) */}
          {!loading && !result && (
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-10">
              <div className="text-center mb-8">
                <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-indigo-600" />
                </div>
                <h1
                  className="font-extrabold text-2xl text-[#191c1e] mb-2"
                  style={{ fontFamily: 'Manrope, system-ui' }}
                >
                  Verify Research Record
                </h1>
                <p className="text-sm text-slate-500">
                  Enter a PLX-VRF verification token from a researcher
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={e => setTokenInput(e.target.value.toUpperCase())}
                    placeholder="PLX-VRF-2026-XXXXX"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-mono text-[#191c1e] placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300/40 focus:border-indigo-400 transition-all"
                    style={{ fontFamily: 'JetBrains Mono, Menlo, monospace' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!tokenInput.trim() || loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 transition-all text-sm"
                >
                  <Search className="h-4 w-4" />
                  Verify Token
                </button>
              </form>
            </div>
          )}

          {/* INVALID STATE */}
          {!loading && result && !result.valid && (
            <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-10 text-center">
              <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
              <h2
                className="font-bold text-2xl text-[#191c1e] mb-3"
                style={{ fontFamily: 'Manrope, system-ui' }}
              >
                Verification Failed
              </h2>
              <p className="text-sm text-slate-600 mb-2">
                This token is invalid, expired, or has been revoked.
              </p>
              <p className="text-sm text-slate-400 mb-8">
                If you received this token from a researcher, please contact them for a new link.
              </p>
              {result.reason && (
                <div className="bg-red-50 rounded-lg px-4 py-3 text-sm text-red-700 mb-6">
                  {result.reason}
                </div>
              )}
              <button
                onClick={() => { setResult(null); setTokenInput('') }}
                className="text-sm text-indigo-600 font-semibold hover:underline"
              >
                Try a different token
              </button>
            </div>
          )}

          {/* VALID STATE */}
          {!loading && result && result.valid && (
            <div className="space-y-4">
              {/* Verified banner */}
              <div
                className="rounded-2xl px-6 py-4 flex items-center gap-4"
                style={{ background: '#f0fdf4', border: '1.5px solid #86efac' }}
              >
                <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-bold text-green-800 text-base" style={{ fontFamily: 'Manrope, system-ui' }}>
                    Verified Research Record
                  </p>
                  <p className="text-xs text-green-700">
                    This token is valid and the audit chain is intact.
                  </p>
                </div>
              </div>

              {/* Dataset Information Card */}
              {result.data && (
                <div
                  className="bg-white rounded-2xl p-6"
                  style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' }}
                >
                  <div className="flex items-center gap-2 mb-5">
                    <Database className="h-4 w-4 text-slate-400" />
                    <h3 className="font-semibold text-sm text-slate-700 uppercase tracking-wider">
                      Dataset Information
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {result.data.dataset_name && (
                      <VerifiedFact label="Dataset" value={result.data.dataset_name} />
                    )}
                    {result.data.version && (
                      <VerifiedFact label="Version" value={result.data.version} />
                    )}
                    {result.data.import_date && (
                      <VerifiedFact label="Import Date" value={result.data.import_date} />
                    )}
                    {result.data.final_n !== undefined && (
                      <VerifiedFact
                        label="Analytic Sample"
                        value={`N = ${result.data.final_n.toLocaleString()}`}
                      />
                    )}
                    {result.data.dqi_score !== undefined && (
                      <VerifiedFact label="DQI Score" value={String(result.data.dqi_score)} />
                    )}
                    {result.data.operation_count !== undefined && (
                      <VerifiedFact
                        label="Operations Logged"
                        value={String(result.data.operation_count)}
                      />
                    )}
                    <VerifiedFact
                      label="Supervisor Approved"
                      value={result.data.approved ? 'Yes' : 'Not recorded'}
                    />
                    <VerifiedFact
                      label="Chain Integrity"
                      value={result.data.chain_verified ? 'Verified' : 'Unknown'}
                    />
                    {result.data.certificate_hash_prefix && (
                      <div className="col-span-2">
                        <VerifiedFact
                          label="Raw Data Fingerprint"
                          value={result.data.certificate_hash_prefix}
                          mono
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Verification Metadata footer */}
              <div
                className="px-5 py-3 rounded-xl flex flex-wrap gap-x-6 gap-y-1.5 text-[10px] text-slate-400"
                style={{ background: 'white', border: '1px solid #f1f5f9' }}
              >
                <span>
                  Verified on {new Date().toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </span>
                {result.token && (
                  <span>Token: <span style={{ fontFamily: 'monospace' }}>{result.token}</span></span>
                )}
                {result.view_count !== undefined && (
                  <span>Views: {result.view_count}</span>
                )}
                {result.expires_at && (
                  <span>
                    Expires: {new Date(result.expires_at).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </span>
                )}
              </div>

              {/* Try another */}
              <div className="text-center pt-2">
                <button
                  onClick={() => { setResult(null); setTokenInput(''); setVerified(false) }}
                  className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  Verify a different token
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function VerifiedFact({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p
          className="text-sm font-semibold text-[#191c1e]"
          style={mono ? { fontFamily: 'JetBrains Mono, Menlo, monospace' } : {}}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f7f9fb]">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
