"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    // emailRedirectTo tells Supabase where to send the user after they click
    // the confirmation link. We route through /auth/callback (PKCE exchange)
    // and pass `next` so the invite redirect survives email confirmation.
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // If Supabase requires email confirmation, the user won't have a session yet.
      // Show a "check your email" message instead of redirecting to a protected page.
      setConfirming(true);
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,24,72,0.06)] p-8 text-center">
        <div className="mb-4 text-4xl">📧</div>
        <h1 className="text-xl font-bold text-slate-900 font-headline mb-2">Check your email</h1>
        <p className="text-slate-500 text-sm mb-1">
          We sent a confirmation link to <strong>{email}</strong>.
        </p>
        <p className="text-slate-500 text-sm">
          Click the link in that email to confirm your account
          {redirect !== '/dashboard' ? ' and complete your invitation.' : '.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,24,72,0.06)] p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 font-headline">Create account</h1>
        <p className="text-slate-500 mt-1 text-sm">Join PLEXUS Platform</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Full name
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
            placeholder="Dr. Jane Smith"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
            placeholder="you@institution.edu"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
            placeholder="Min 6 characters"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-clinical-deep to-clinical-blue text-white rounded-lg py-2.5 text-sm font-bold font-headline hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(0,82,204,0.22)]"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href={redirect !== '/dashboard' ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'} className="text-clinical-blue hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="h-64 rounded-xl bg-slate-100 animate-pulse" />}>
      <RegisterForm />
    </Suspense>
  );
}
