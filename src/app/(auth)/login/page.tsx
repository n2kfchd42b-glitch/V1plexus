"use client"

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/i18n/useTranslations'
import { logAudit } from '@/lib/audit'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/dashboard'
  const confirmationFailed = searchParams.get('error') === 'confirmation_failed'
  const supabase = createClient()
  const { t } = useTranslations()

  // Prefetch the destination so navigation after sign-in is instant
  useEffect(() => { router.prefetch(redirect) }, [router, redirect])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setError(t('auth.confirmEmailFirst'))
      } else {
        setError(error.message)
      }
    } else {
      if (data.user) {
        logAudit('auth.login', 'profile', data.user.id, { summary: 'User signed in', method: 'password' })
      }
      router.push(redirect)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@university.edu"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="mt-1"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
          <Link href="/forgot-password" className="text-xs text-clinical-blue hover:underline">
            {t('auth.forgotPassword', 'Forgot password?')}
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="mt-1"
        />
      </div>
      {confirmationFailed && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-700 text-sm">
          {t('auth.confirmationExpired')}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t('auth.pleaseWait', 'Please wait...') : t('auth.signIn', 'Sign In')}
      </Button>
      <p className="text-sm text-slate-500 text-center">
        {t('auth.noAccount', "Don't have an account?")}{' '}
        <Link
          href={redirect !== '/dashboard' ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'}
          className="text-clinical-blue hover:underline font-medium"
        >
          {t('auth.signUp', 'Sign up')}
        </Link>
      </p>
    </form>
  )
}

export default function LoginPage() {
  const { t } = useTranslations()

  return (
    <>
      <div className="flex justify-center mb-6 lg:hidden">
        <BrandLogo variant="standalone" href="/" />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('auth.welcomeBack', 'Welcome back')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('auth.signInToAccount', 'Sign in to your PLEXUS account')}</p>
      </div>

      <Suspense fallback={<div className="h-48 rounded-xl bg-slate-100 animate-pulse" />}>
        <LoginForm />
      </Suspense>
    </>
  )
}
