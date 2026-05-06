"use client"

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/i18n/useTranslations'

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const { t } = useTranslations()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="mb-4 text-4xl">📧</div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">{t('auth.checkEmail', 'Check your email')}</h2>
        <p className="text-slate-500 text-sm mb-1">
          {t('auth.resetSentTo', 'We sent a password reset link to')} <strong>{email}</strong>.
        </p>
        <p className="text-slate-500 text-sm mb-6">
          {t('auth.clickToSetNewPassword', 'Click the link in the email to set a new password.')}
        </p>
        <Link href="/login" className="text-clinical-blue hover:underline text-sm font-medium">
          {t('auth.backToSignIn', 'Back to sign in')}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.emailAddress', 'Email address')}</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
          placeholder="you@institution.edu"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-clinical-deep to-clinical-blue text-white rounded-lg py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(0,82,204,0.22)]"
      >
        {loading ? t('auth.sending', 'Sending…') : t('auth.sendResetLink', 'Send reset link')}
      </button>

      <p className="text-center text-sm text-slate-500">
        {t('auth.rememberPassword', 'Remember your password?')}{' '}
        <Link href="/login" className="text-clinical-blue hover:underline font-medium">
          {t('auth.signIn', 'Sign in')}
        </Link>
      </p>
    </form>
  )
}

export default function ForgotPasswordPage() {
  const { t } = useTranslations()

  return (
    <>
      <div className="flex justify-center mb-6 lg:hidden">
        <BrandLogo variant="standalone" href="/" />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('auth.resetYourPassword', 'Reset your password')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('auth.sendResetLinkDesc', "We'll send you a link to set a new one")}</p>
      </div>

      <Suspense fallback={<div className="h-48 rounded-xl bg-slate-100 animate-pulse" />}>
        <ForgotPasswordForm />
      </Suspense>
    </>
  )
}
