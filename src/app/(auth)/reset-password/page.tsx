"use client"

export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Supabase delivers the recovery token via the URL hash fragment.
  // exchangeCodeForSession is handled automatically by the client on mount
  // when it detects type=recovery in the hash.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
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
        <h2 className="text-lg font-bold text-slate-900 mb-2">Password updated</h2>
        <p className="text-slate-500 text-sm">Taking you to your dashboard…</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-clinical-blue border-t-transparent mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Verifying reset link…</p>
        <p className="text-slate-400 text-xs mt-3">
          If nothing happens,{' '}
          <a href="/forgot-password" className="text-clinical-blue hover:underline">
            request a new link
          </a>
          .
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
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
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
        <input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
          placeholder="Re-enter password"
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
        {loading ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <>
      <div className="flex justify-center mb-6 lg:hidden">
        <BrandLogo variant="standalone" href="/" />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Set a new password</h1>
        <p className="text-slate-500 text-sm mt-1">Choose something you haven&apos;t used before</p>
      </div>

      <Suspense fallback={<div className="h-48 rounded-xl bg-slate-100 animate-pulse" />}>
        <ResetPasswordForm />
      </Suspense>
    </>
  )
}
