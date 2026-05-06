"use client"

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/i18n/useTranslations'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslations()

  // The auth/callback route already exchanged the PKCE code and set the session.
  // We just need to confirm a valid session exists before showing the form.
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setReady(true)
      } else {
        router.push('/forgot-password')
      }
    })
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError(t('auth.passwordsDontMatch', 'Passwords do not match.'))
      return
    }
    if (password.length < 6) {
      setError(t('auth.passwordTooShort', 'Password must be at least 6 characters.'))
      return
    }
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (done) {
    return (
      <div className="text-center py-4">
        <div className="mb-4 text-4xl">✓</div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">{t('auth.passwordUpdated', 'Password updated')}</h2>
        <p className="text-slate-500 text-sm">{t('auth.takingToDashboard', 'Taking you to your dashboard…')}</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-clinical-blue border-t-transparent mx-auto mb-3" />
        <p className="text-slate-500 text-sm">{t('auth.verifyingLink', 'Verifying reset link…')}</p>
        <p className="text-slate-400 text-xs mt-3">
          {t('auth.ifNothingHappens', 'If nothing happens,')}{' '}
          <a href="/forgot-password" className="text-clinical-blue hover:underline">
            {t('auth.requestNewLink', 'request a new link')}
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.newPassword', 'New password')}</label>
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
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{t('auth.confirmNewPassword', 'Confirm new password')}</label>
        <input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
          placeholder={t('auth.reEnterPassword', 'Re-enter password')}
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
        {loading ? t('auth.updating', 'Updating…') : t('auth.setNewPasswordBtn', 'Set new password')}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  const { t } = useTranslations()

  return (
    <>
      <div className="flex justify-center mb-6 lg:hidden">
        <BrandLogo variant="standalone" href="/" />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('auth.setNewPassword', 'Set a new password')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('auth.chooseNewPassword', "Choose something you haven't used before")}</p>
      </div>

      <Suspense fallback={<div className="h-48 rounded-xl bg-slate-100 animate-pulse" />}>
        <ResetPasswordForm />
      </Suspense>
    </>
  )
}
