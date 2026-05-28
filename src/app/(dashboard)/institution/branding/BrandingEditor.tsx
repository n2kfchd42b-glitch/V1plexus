'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Palette, ImagePlus, Loader2, AlertTriangle, ExternalLink, ShieldCheck,
  Building2, Eye, Check, X,
} from 'lucide-react'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { tierLabel } from '@/lib/institutions/tier'

interface BrandingPayload {
  id: string
  name: string
  slug: string
  short_name: string | null
  country: string | null
  logo_url: string | null
  brand_color: string | null
  motto: string | null
  public_bio: string | null
  verification_tier: 'SELF_ATTESTED' | 'DOMAIN_VERIFIED' | 'OFFICIALLY_REGISTERED' | null
}

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
const MAX_LOGO_BYTES = 4 * 1024 * 1024 // 4 MB

export function BrandingEditor() {
  const [data, setData] = useState<BrandingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [slug, setSlug] = useState('')
  const [brandColor, setBrandColor] = useState<string>('#003D9B')
  const [motto, setMotto] = useState('')
  const [publicBio, setPublicBio] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/institution/branding', { cache: 'no-store' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not load branding')
      setLoading(false)
      return
    }
    const json = await res.json()
    const inst: BrandingPayload = json.institution
    setData(inst)
    setSlug(inst.slug)
    setBrandColor(inst.brand_color ?? '#003D9B')
    setMotto(inst.motto ?? '')
    setPublicBio(inst.public_bio ?? '')
    setLogoUrl(inst.logo_url)
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleLogoUpload(file: File) {
    setUploadError(null)
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setUploadError('Logo must be PNG, JPEG, SVG, or WebP.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setUploadError('Logo must be under 4 MB.')
      return
    }
    if (!data) return

    setUploading(true)
    const supabase = createBrowserClient()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
    const path = `${data.id}/logo-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('institution-logos')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })

    if (upErr) {
      setUploadError(upErr.message)
      setUploading(false)
      return
    }

    const { data: pub } = supabase.storage.from('institution-logos').getPublicUrl(path)
    const newUrl = pub.publicUrl

    const res = await fetch('/api/institution/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: newUrl }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setUploadError(body.error ?? 'Could not save logo')
      setUploading(false)
      return
    }

    setLogoUrl(newUrl)
    setSavedAt(Date.now())
    setUploading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!data) return
    setSaving(true)
    setError(null)

    const body: Record<string, unknown> = {
      brand_color: brandColor || null,
      motto: motto.trim() || null,
      public_bio: publicBio.trim() || null,
    }
    if (slug !== data.slug) body.slug = slug.trim().toLowerCase()

    const res = await fetch('/api/institution/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    setSaving(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error ?? 'Save failed')
      // 409 = slug already taken. Revert the slug input to the prior value
      // so the user can't be confused by seeing the disputed slug in the
      // field. Other fields keep their drafted values.
      if (res.status === 409) setSlug(data.slug)
      return
    }
    setSavedAt(Date.now())
    void load()
  }

  async function removeLogo() {
    setUploading(true)
    const res = await fetch('/api/institution/branding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: null }),
    })
    setUploading(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setUploadError(j.error ?? 'Could not remove logo')
      return
    }
    setLogoUrl(null)
    setSavedAt(Date.now())
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="px-8 py-10 text-center">
        <AlertTriangle className="h-6 w-6 text-[var(--status-error-text)] mx-auto mb-2" />
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const publicUrl = `/institutions/${data.slug}`

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-1">
            Institution
          </p>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] font-manrope">Branding</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            How your institution looks on public pages and on verified outputs.
          </p>
        </div>
        <Link
          href={publicUrl}
          target="_blank"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--border-default)] hover:border-[var(--accent-blue)]/40 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          View public page
          <ExternalLink className="h-3 w-3" />
        </Link>
      </header>

      <div className="mb-6 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5 flex items-center gap-4">
        <ShieldCheck className="h-5 w-5 text-[var(--status-success-text)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-widest text-[var(--text-tertiary)] font-semibold mb-0.5">
            Verification tier
          </p>
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {tierLabel(data.verification_tier)}
          </p>
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] max-w-[260px] text-right">
          Only the Plexus team can change this. Contact us if your institution is officially registered with a degree-granting authority.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-[var(--text-tertiary)]" />
            Logo
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-lg border border-[var(--border-default)] bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
              ) : (
                <Building2 className="h-8 w-8 text-[var(--text-tertiary)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <input
                ref={fileRef}
                type="file"
                accept={ALLOWED_LOGO_TYPES.join(',')}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleLogoUpload(f)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-md bg-[var(--accent-blue)] text-white text-xs font-semibold hover:bg-[var(--accent-blue-hover)] disabled:opacity-60"
                >
                  {uploading ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={removeLogo}
                    className="px-3 py-1.5 rounded-md border border-[var(--border-default)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--status-error-text)] hover:border-[var(--status-error-text)]/40 disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
                PNG, JPEG, SVG, or WebP · 4 MB max. Square format works best.
              </p>
              {uploadError && (
                <p className="text-xs text-[var(--status-error-text)] mt-1.5">{uploadError}</p>
              )}
            </div>
          </div>
        </section>

        {/* Identity */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-3">Identity</h2>
          <div className="grid gap-4">
            <Field
              label="Public URL slug"
              hint="Lowercase letters, digits, dashes. Used in /institutions/<slug>."
            >
              <div className="flex items-stretch">
                <span className="inline-flex items-center px-3 bg-[var(--bg-surface-2)] border border-r-0 border-[var(--border-default)] rounded-l-md text-xs font-mono text-[var(--text-tertiary)]">
                  /institutions/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  className="flex-1 bg-[var(--bg-app)] border border-[var(--border-default)] rounded-r-md px-2.5 py-1.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                />
              </div>
            </Field>

            <Field
              label="Brand colour"
              hint="A single accent colour used in headers and tier badges on the public page."
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-9 w-12 rounded-md border border-[var(--border-default)] cursor-pointer"
                  aria-label="Brand colour swatch"
                />
                <input
                  type="text"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  pattern="^#[0-9a-fA-F]{6}$"
                  className="bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm font-mono text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] w-32"
                />
                <Palette className="h-4 w-4 text-[var(--text-tertiary)]" />
              </div>
            </Field>

            <Field label="Motto" hint="One short line. Optional.">
              <input
                type="text"
                value={motto}
                maxLength={280}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="e.g. Integri Procedamus"
                className="w-full bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
              />
            </Field>

            <Field label="Public bio" hint="A paragraph or two for the institution's public page.">
              <textarea
                value={publicBio}
                maxLength={4000}
                onChange={(e) => setPublicBio(e.target.value)}
                rows={5}
                className="w-full bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                placeholder="Founded in 1948, the University of Greenland is a public research university focused on…"
              />
              <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{publicBio.length} / 4000</p>
            </Field>
          </div>
        </section>

        {/* Privacy note: institution-wide default was retired in favour of
            per-user opt-in. The AffiliationPanel toggle in /settings is the
            only control over public visibility now — there's no institution
            override. */}
        <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-5">
          <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">Public directory</h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            Researchers at your institution control their own visibility on the public page from <code className="text-[10px] font-mono">Settings → Affiliation</code>. New profiles default to hidden — they appear once they opt in.
          </p>
        </section>

        {error && (
          <div className="px-3 py-2 bg-[var(--status-error-bg)] border border-[var(--border-status-error)] rounded text-sm text-[var(--status-error-text)]">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-xs text-[var(--text-tertiary)]">
            {savedAt && (
              <span className="inline-flex items-center gap-1 text-[var(--status-success-text)]">
                <Check className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={saving}
              className="px-3 py-1.5 rounded-md border border-[var(--border-default)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-1">
                <X className="h-3 w-3" />
                Discard changes
              </span>
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-md bg-[var(--accent-blue)] text-white text-xs font-semibold hover:bg-[var(--accent-blue-hover)] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{hint}</p>}
    </div>
  )
}
