"use client"

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { createClient } from '@/lib/supabase/client'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/dashboard'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      router.push(redirect)
      router.refresh()
    } else {
      setConfirming(true)
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <div className="text-center py-4">
        <div className="mb-4 text-4xl">📧</div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Check your email</h2>
        <p className="text-slate-500 text-sm mb-1">
          We sent a confirmation link to <strong>{email}</strong>.
        </p>
        <p className="text-slate-500 text-sm">
          Click the link to confirm your account
          {redirect !== '/dashboard' ? ' and complete your invitation.' : '.'}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
        <input
          type="text"
          required
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
          placeholder="Dr. Jane Smith"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
          placeholder="you@institution.edu"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
          placeholder="Min 6 characters"
        />
      </div>

      {/* GDPR consent */}
      <div className="flex items-start gap-3">
        <input
          id="consent"
          type="checkbox"
          required
          checked={consentAccepted}
          onChange={e => setConsentAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-clinical-blue focus:ring-clinical-blue flex-shrink-0 cursor-pointer"
        />
        <label htmlFor="consent" className="text-xs text-slate-500 leading-relaxed cursor-pointer">
          I have read and agree to the{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-clinical-blue hover:underline font-medium">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-clinical-blue hover:underline font-medium">
            Privacy Policy
          </a>
          . I consent to PLEXUS processing my personal data as described therein, in accordance with the GDPR.
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !consentAccepted}
        className="w-full bg-gradient-to-r from-clinical-deep to-clinical-blue text-white rounded-lg py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(0,82,204,0.22)]"
      >
        {loading ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link
          href={redirect !== '/dashboard' ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'}
          className="text-clinical-blue hover:underline font-medium"
        >
          Sign in
        </Link>
      </p>
    </form>
  )
}

export default function RegisterPage() {
  return (
    <>
      {/* Logo — visible on mobile only */}
      <div className="flex justify-center mb-6 lg:hidden">
        <BrandLogo variant="standalone" href="/" />
      </div>

      {/* Heading — always visible */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create your account</h1>
        <p className="text-slate-500 text-sm mt-1">Join researchers publishing with verifiable integrity</p>
      </div>

      <Suspense fallback={<div className="h-64 rounded-xl bg-slate-100 animate-pulse" />}>
        <RegisterForm />
      </Suspense>
    </>
  )
}
