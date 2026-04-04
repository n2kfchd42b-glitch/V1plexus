import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Database, Download, Calendar, Globe, Lock, Quote, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export async function generateMetadata({ params }: { params: Promise<{ doi: string }> }) {
  const { doi } = await params
  const decodedDoi = decodeURIComponent(doi)
  const supabase = await createClient()
  const { data } = await supabase
    .from('dataset_publications')
    .select('title')
    .or(`doi.eq.${decodedDoi},reserved_doi.eq.${decodedDoi}`)
    .maybeSingle()

  if (!data) return { title: 'Dataset Not Found — PLEXUS Data' }
  return { title: `${data.title} — PLEXUS Data Repository` }
}

interface DatasetPublication {
  id: string
  doi: string | null
  reserved_doi: string | null
  title: string
  authors: Array<{ name: string; orcid: string; affiliation: string }>
  description: string | null
  license: string
  keywords: string[]
  geographic_scope: string | null
  embargo_until: string | null
  citation_text: string | null
  status: 'draft' | 'reserved' | 'published'
  published_at: string | null
  created_at: string
}

const LICENSE_URLS: Record<string, string> = {
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'CC-BY-NC-4.0': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
}

export default async function DatasetLandingPage({ params }: { params: Promise<{ doi: string }> }) {
  const { doi: rawDoi } = await params
  const decodedDoi = decodeURIComponent(rawDoi).replace(/^10\./, '10.')

  const supabase = await createClient()
  const { data: pub } = await supabase
    .from('dataset_publications')
    .select('*')
    .or(`doi.eq.${decodedDoi},reserved_doi.eq.${decodedDoi}`)
    .maybeSingle() as { data: DatasetPublication | null }

  if (!pub) notFound()

  const identifier = pub.doi ?? pub.reserved_doi
  const isReserved = !pub.doi
  const isEmbargoed = pub.embargo_until && new Date(pub.embargo_until) > new Date()
  const createdDate = new Date(pub.created_at)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-900 hover:text-blue-600">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-[#003D9B] flex-shrink-0 shadow-md shadow-[#003D9B]/30 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af] to-[#003D9B]" />
              <span className="relative z-10 text-white font-black text-[11px] tracking-tight leading-none">PX</span>
            </div>
            <span className="font-bold text-sm text-[#003D9B]">PLEXUS</span>
            <span className="text-gray-400 text-sm">/ Data Repository</span>
          </Link>
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border ${
            isReserved
              ? 'text-amber-700 bg-amber-50 border-amber-200'
              : 'text-green-700 bg-green-50 border-green-200'
          }`}>
            <Database className="h-3.5 w-3.5" />
            {isReserved ? 'DOI Reserved' : 'Published'}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* DOI badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-6 py-3">
            <Database className="h-5 w-5 text-blue-600" />
            <span className="font-mono font-bold text-base text-blue-700">
              {isReserved ? 'Reserved: ' : ''}{identifier}
            </span>
          </div>
          {identifier && (
            <p className="text-sm text-gray-500 mt-2">
              <a href={`https://doi.org/${identifier}`} target="_blank" rel="noopener noreferrer"
                className="text-blue-500 hover:underline flex items-center gap-1 justify-center">
                https://doi.org/{identifier}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </p>
          )}
        </div>

        {/* Title */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{pub.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {/* License */}
            <a href={LICENSE_URLS[pub.license]} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full hover:bg-gray-200">
              {pub.license === 'CC0' ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {pub.license}
            </a>
            {/* Published date */}
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Calendar className="h-3.5 w-3.5" />
              {pub.published_at
                ? new Date(pub.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                : createdDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            {pub.geographic_scope && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Globe className="h-3.5 w-3.5" />
                {pub.geographic_scope}
              </span>
            )}
          </div>
          {pub.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {pub.keywords.map(k => (
                <span key={k} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Authors */}
        {pub.authors.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Authors</h2>
            <div className="space-y-2">
              {pub.authors.map((author, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-500">{i + 1}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{author.name}</p>
                    <p className="text-xs text-gray-500">
                      {author.affiliation}
                      {author.orcid && (
                        <a href={`https://orcid.org/${author.orcid}`} target="_blank" rel="noopener noreferrer"
                          className="ml-2 text-blue-500 hover:underline">
                          ORCID: {author.orcid}
                        </a>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {pub.description && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Description</h2>
            <p className="text-sm text-gray-800 leading-relaxed">{pub.description}</p>
          </div>
        )}

        {/* Embargo notice */}
        {isEmbargoed && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Dataset Under Embargo</p>
              <p className="text-xs text-amber-700 mt-1">
                This dataset will be publicly accessible from{' '}
                {new Date(pub.embargo_until!).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>
            </div>
          </div>
        )}

        {/* Citation */}
        {pub.citation_text && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Quote className="h-3.5 w-3.5" />
              Cite This Dataset
            </h2>
            <div className="bg-gray-50 rounded-xl p-4 text-xs font-mono text-gray-700 leading-relaxed">
              {pub.citation_text}
            </div>
          </div>
        )}

        {/* Download */}
        {!isEmbargoed && (
          <div className="flex items-center justify-center gap-4">
            <button
              className="flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl transition-colors"
            >
              <Download className="h-4 w-4" />
              Download Dataset
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 mt-16 py-8 text-center text-xs text-gray-400">
        <p>PLEXUS · Data Repository · <Link href="/" className="hover:text-blue-500">plexus.health</Link></p>
      </footer>
    </div>
  )
}
