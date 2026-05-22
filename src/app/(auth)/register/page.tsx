"use client"

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/i18n/useTranslations'

function ConfirmationPrompt({ email, redirect, emailRedirectTo }: { email: string; redirect: string; emailRedirectTo: string }) {
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const supabase = createClient()
  const { t } = useTranslations()

  const handleResend = async () => {
    setResending(true)
    await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })
    setResent(true)
    setResending(false)
  }

  return (
    <div className="text-center py-4">
      <div className="mb-4 text-4xl">📧</div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">{t('auth.checkEmail', 'Check your email')}</h2>
      <p className="text-slate-500 text-sm mb-1">
        {t('auth.confirmationSentTo', 'We sent a confirmation link to')} <strong>{email}</strong>.
      </p>
      <p className="text-slate-500 text-sm mb-6">
        {t('auth.clickToConfirm', 'Click the link to confirm your account')}
        {redirect !== '/dashboard' ? ` ${t('auth.andCompleteInvitation', 'and complete your invitation.')}` : '.'}
      </p>
      {resent ? (
        <p className="text-sm text-green-600">{t('auth.linkResent', 'Link resent — check your inbox again.')}</p>
      ) : (
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-clinical-blue hover:underline disabled:opacity-50"
        >
          {resending ? t('auth.resending', 'Resending…') : t('auth.didntReceive', "Didn't receive it? Resend")}
        </button>
      )}
    </div>
  )
}

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
  const { t } = useTranslations()

  useEffect(() => { router.prefetch(redirect) }, [router, redirect])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, emailRedirectTo }),
    })

    const json = await res.json() as { userId?: string; error?: string }

    if (!res.ok) {
      setError(json.error ?? t('auth.registrationFailed', 'Registration failed. Please try again.'))
      setLoading(false)
      return
    }

    setConfirming(true)
    setLoading(false)

    if (res.status === 200) {
      router.push(redirect)
      router.refresh()
    }
  }

  if (confirming) {
    return (
      <ConfirmationPrompt
        email={email}
        redirect={redirect}
        emailRedirectTo={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=${encodeURIComponent(redirect)}`}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.fullName', 'Full name')}</label>
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
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.email', 'Email')}</label>
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
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.password', 'Password')}</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
          placeholder={t('auth.minChars', 'Min 6 characters')}
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
          {t('auth.termsPrefix', 'I have read and agree to the')}{' '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-clinical-blue hover:underline font-medium">
            {t('auth.termsOfService', 'Terms of Service')}
          </a>{' '}
          {t('auth.and', 'and')}{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-clinical-blue hover:underline font-medium">
            {t('auth.privacyPolicy', 'Privacy Policy')}
          </a>
          {t('auth.gdprSuffix', '. I consent to PLEXUS processing my personal data as described therein, in accordance with the GDPR.')}
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
        {loading ? t('auth.creatingAccount', 'Creating account…') : t('auth.createAccountBtn', 'Create account')}
      </button>

      <p className="text-center text-sm text-slate-500">
        {t('auth.alreadyAccount', 'Already have an account?')}{' '}
        <Link
          href={redirect !== '/dashboard' ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'}
          className="text-clinical-blue hover:underline font-medium"
        >
          {t('auth.signIn', 'Sign in')}
        </Link>
      </p>
    </form>
  )
}

export default function RegisterPage() {
  const { t } = useTranslations()

  return (
    <>
      <div className="flex justify-center mb-6 lg:hidden">
        <BrandLogo variant="standalone" href="/" />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('auth.createAccount', 'Create your account')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('auth.joinResearchers', 'Join researchers publishing with verifiable integrity')}</p>
      </div>

      <Suspense fallback={<div className="h-64 rounded-xl bg-slate-100 animate-pulse" />}>
        <RegisterForm />
      </Suspense>
    </>
  )
}
