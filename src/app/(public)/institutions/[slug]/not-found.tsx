import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'

export default function InstitutionNotFound() {
  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-900">
            <BrandLogo />
          </Link>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-6 py-24 text-center">
        <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 font-manrope">Institution not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          We couldn&rsquo;t find an institution at that URL. It may not be listed on Plexus yet, or the slug may have changed.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
          >
            Back home
          </Link>
          <Link
            href="/contact-institutions"
            className="px-4 py-2 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Bring my institution to Plexus
          </Link>
        </div>
      </main>
    </div>
  )
}
