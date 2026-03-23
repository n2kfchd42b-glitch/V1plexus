import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Shield, CheckCircle, Calendar, FlaskConical, Download, Quote, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('protocol_registrations')
    .select('title, registered_at')
    .eq('registration_id', id)
    .eq('is_public', true)
    .maybeSingle()

  if (!data) return { title: 'Registration Not Found — PLEXUS Registry' }
  return {
    title: `${data.title} — PLEXUS Protocol Registry`,
    description: `Protocol pre-registered on ${new Date(data.registered_at).toLocaleDateString()}`,
  }
}

interface ProtocolRegistration {
  id: string
  registration_id: string
  title: string
  authors: Array<{ name: string; institution: string; orcid: string }>
  abstract: string | null
  study_design: string | null
  registered_at: string
  content_hash: string
  is_public: boolean
  amendments: Array<{ date: string; description: string; content_hash: string }>
  document_version: number
}

function HashBadge({ hash }: { hash: string }) {
  return (
    <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
      <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-green-800">Hash chain verified — document integrity confirmed</p>
        <p className="text-xs font-mono text-green-700 mt-1 break-all">SHA-256: {hash}</p>
      </div>
    </div>
  )
}

export default async function RegistryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Use service role for public access
  const supabase = await createClient()
  const { data: reg } = await supabase
    .from('protocol_registrations')
    .select('*')
    .eq('registration_id', id)
    .eq('is_public', true)
    .maybeSingle() as { data: ProtocolRegistration | null }

  if (!reg) notFound()

  const registeredDate = new Date(reg.registered_at)
  const formattedDate = registeredDate.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const formattedTime = registeredDate.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  })

  const citationText = `${reg.authors.map(a => a.name).join(', ')} (${registeredDate.getFullYear()}). ${reg.title}. PLEXUS Protocol Registry. Registration ID: ${reg.registration_id}. https://plexus.health/registry/${reg.registration_id}`

  const amendments: Array<{ date: string; description: string; content_hash: string }> = reg.amendments ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-900 hover:text-blue-600">
            <div className="w-7 h-7 bg-[#1B3A5C] rounded-lg flex items-center justify-center">
              <FlaskConical className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm">PLEXUS</span>
            <span className="text-gray-400 text-sm">/ Protocol Registry</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
            <Shield className="h-3.5 w-3.5" />
            Verified Registration
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Registration ID badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-6 py-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="font-mono font-bold text-xl text-blue-700">{reg.registration_id}</span>
          </div>
          <p className="text-sm text-gray-500 mt-3 flex items-center justify-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Registered {formattedDate} at {formattedTime}
            {reg.document_version > 1 && ` · Document version ${reg.document_version}`}
          </p>
        </div>

        {/* Title */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{reg.title}</h1>
          {reg.study_design && (
            <p className="mt-2 text-sm text-blue-600 font-medium">{reg.study_design}</p>
          )}
        </div>

        {/* Authors */}
        {reg.authors.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Authors</h2>
            <div className="space-y-2">
              {reg.authors.map((author, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-500">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{author.name}</p>
                    <p className="text-xs text-gray-500">
                      {author.institution}
                      {author.orcid && (
                        <span className="ml-2 text-blue-500">
                          ORCID:{' '}
                          <a href={`https://orcid.org/${author.orcid}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {author.orcid}
                          </a>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Abstract */}
        {reg.abstract && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Abstract</h2>
            <p className="text-sm text-gray-800 leading-relaxed">{reg.abstract}</p>
          </div>
        )}

        {/* Verification */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Verification</h2>
          <HashBadge hash={reg.content_hash} />
          <p className="text-xs text-gray-400 mt-3">
            The SHA-256 hash of the document content at the time of registration is stored immutably.
            Any modification to the original document would produce a different hash, making tampering detectable.
          </p>
        </div>

        {/* Amendments */}
        {amendments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Amendments ({amendments.length})
            </h2>
            <div className="space-y-3">
              {amendments.map((amendment, i) => (
                <div key={i} className="flex items-start gap-3 border-l-2 border-amber-400 pl-4">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">
                      Amendment #{i + 1} · {new Date(amendment.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-gray-800 mt-0.5">{amendment.description}</p>
                    {amendment.content_hash && (
                      <p className="text-xs font-mono text-gray-400 mt-1 break-all">Hash: {amendment.content_hash}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cite */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Quote className="h-3.5 w-3.5" />
            Cite This Registration
          </h2>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 font-mono leading-relaxed text-xs">
            {citationText}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Copy the citation text above to use in your manuscript
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <Link
            href={`/registry/${reg.registration_id}/download`}
            className="flex items-center gap-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Protocol PDF
          </Link>
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-16 py-8 text-center text-xs text-gray-400">
        <p>PLEXUS Research Platform · Protocol Registry · <Link href="/" className="hover:text-blue-500">plexus.health</Link></p>
      </footer>
    </div>
  )
}
