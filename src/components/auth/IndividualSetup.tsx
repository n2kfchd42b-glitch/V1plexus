"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, MapPin, Loader2, CheckCircle2 } from 'lucide-react'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { LanguageSelector } from '@/components/i18n/LanguageSelector'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from '@/i18n/useTranslations'
import { toast } from 'sonner'

const RESEARCH_AREAS = [
  'Global Health', 'Epidemiology', 'Biostatistics', 'Public Health',
  'Clinical Research', 'Social Science', 'Environmental Health', 'Health Policy',
  'Infectious Disease', 'Non-communicable Disease', 'Maternal & Child Health',
  'Mental Health', 'Other',
]

const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bangladesh', 'Belgium', 'Benin', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
  'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Congo', 'Costa Rica',
  "Côte d'Ivoire", 'Croatia', 'Cuba', 'Czech Republic', 'DR Congo', 'Denmark', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Eritrea', 'Ethiopia', 'Finland', 'France', 'Gabon',
  'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guatemala', 'Guinea', 'Guinea-Bissau',
  'Haiti', 'Honduras', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel',
  'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kosovo', 'Laos', 'Lebanon',
  'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Malaysia', 'Mali', 'Mauritania',
  'Mexico', 'Moldova', 'Mongolia', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nepal',
  'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'Norway',
  'Pakistan', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Senegal', 'Sierra Leone',
  'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan',
  'Sweden', 'Switzerland', 'Syria', 'Tanzania', 'Thailand', 'Togo', 'Tunisia', 'Turkey',
  'Uganda', 'Ukraine', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
]

export function IndividualSetup() {
  const [researchArea, setResearchArea] = useState('')
  const [orcid, setOrcid] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [showOnGlobe, setShowOnGlobe] = useState(false)
  const [geoState, setGeoState] = useState<'idle' | 'detecting' | 'detected' | 'denied' | 'manual'>('idle')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { t } = useTranslations()

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGeoState('manual')
      return
    }
    setGeoState('detecting')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setLat(latitude)
        setLng(longitude)
        try {
          const res = await fetch(`/api/reverse-geocode?lat=${latitude}&lng=${longitude}`)
          if (res.ok) {
            const data = await res.json() as { city: string | null; country: string | null }
            setCity(data.city ?? '')
            setCountry(data.country ?? '')
          }
        } catch { /* non-fatal */ }
        setGeoState('detected')
      },
      () => {
        setGeoState('denied')
      },
      { timeout: 8000 }
    )
  }

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let finalLat = lat
    let finalLng = lng
    if ((!finalLat || !finalLng) && city && country) {
      try {
        const res = await fetch(`/api/geocode?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`)
        if (res.ok) {
          const geo = await res.json() as { lat: number; lng: number }
          finalLat = geo.lat
          finalLng = geo.lng
        }
      } catch { /* non-fatal */ }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const workspaceName = (profile?.full_name ?? user.email ?? 'My') + "'s Workspace"
    const slug = `personal-${user.id}`

    const { data: existing } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .eq('type', 'personal')
      .maybeSingle()

    let wsId = existing?.id

    if (!wsId) {
      const { data: ws, error: wsErr } = await supabase
        .from('workspaces')
        .insert({ type: 'personal', name: workspaceName, slug, owner_id: user.id })
        .select('id')
        .single()

      if (wsErr) {
        toast.error(t('setup.workspaceFailed', 'Failed to create workspace'))
        setLoading(false)
        return
      }
      wsId = ws.id

      await supabase.from('workspace_memberships').insert({
        workspace_id: wsId,
        user_id: user.id,
        role: 'owner',
        status: 'active',
      })
    }

    const normalizedOrcid = orcid.trim()
      .replace(/^https?:\/\/orcid\.org\//i, '')
      .replace(/\s/g, '')
      || null

    await supabase
      .from('profiles')
      .update({
        workspace_setup_completed: true,
        onboarding_completed: true,
        city: city || null,
        country: country || null,
        lat: finalLat,
        lng: finalLng,
        show_on_globe: showOnGlobe,
        research_discipline: researchArea || null,
        orcid_id: normalizedOrcid,
      })
      .eq('id', user.id)

    toast.success(t('setup.workspaceCreated', 'Workspace created!'))
    router.push('/dashboard')
    setLoading(false)
  }

  const showManual = geoState === 'denied' || geoState === 'manual' || geoState === 'detected'

  return (
    <div className="min-h-screen bg-[#060d1c] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-white/10 p-8">
          {/* Header with logo and language selector */}
          <div className="text-center mb-8">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1" />
              <BrandLogo variant="standalone" href="/dashboard" />
              <div className="flex-1 flex justify-end">
                <LanguageSelector compact />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t('setup.title', 'Set up your workspace')}</h2>
            <p className="text-gray-500 mt-1 text-sm">
              {t('setup.subtitle', 'This is your private research space. You own everything here.')}
            </p>
          </div>

          <form onSubmit={handleSetup} className="space-y-4">
            {/* Location */}
            <div>
              <Label>{t('setup.location', 'Location')}</Label>
              {geoState === 'idle' && (
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    onClick={detectLocation}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-clinical-blue/30 bg-clinical-blue/5 px-4 py-2.5 text-sm font-medium text-clinical-blue hover:bg-clinical-blue/10 transition-colors"
                  >
                    <MapPin className="h-4 w-4" />
                    {t('setup.detectLocation', 'Detect my location automatically')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeoState('manual')}
                    className="w-full text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
                  >
                    {t('setup.enterManually', 'Enter manually instead')}
                  </button>
                </div>
              )}

              {geoState === 'detecting' && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin text-clinical-blue" />
                  {t('setup.detecting', 'Detecting your location…')}
                </div>
              )}

              {geoState === 'detected' && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-700">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span>
                      {t('setup.located', 'Located:')} <strong>{city}{city && country ? ', ' : ''}{country}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGeoState('manual')}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {t('setup.notRight', 'Not right? Enter manually')}
                  </button>
                </div>
              )}

              {geoState === 'denied' && (
                <p className="mt-1 text-xs text-amber-600">
                  {t('setup.locationDenied', 'Location access denied — please enter manually below.')}
                </p>
              )}

              {showManual && geoState !== 'detected' && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label htmlFor="city" className="text-xs text-gray-500">{t('setup.city', 'City')}</Label>
                    <Input
                      id="city"
                      placeholder="Accra"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="country" className="text-xs text-gray-500">{t('setup.country', 'Country')}</Label>
                    <div className="relative mt-1">
                      <select
                        id="country"
                        value={country}
                        onChange={e => setCountry(e.target.value)}
                        className="w-full rounded-md border border-gray-200 px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-clinical-blue bg-white"
                      >
                        <option value="">{t('setup.selectCountry', 'Select…')}</option>
                        {COUNTRIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="researchArea">
                {t('setup.researchArea', 'Research Area')}{' '}
                <span className="text-gray-400 text-xs">{t('common.optional', '(optional)')}</span>
              </Label>
              <div className="relative mt-1">
                <select
                  id="researchArea"
                  value={researchArea}
                  onChange={e => setResearchArea(e.target.value)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-clinical-blue bg-white"
                >
                  <option value="">{t('setup.selectResearchArea', 'Select research area…')}</option>
                  {RESEARCH_AREAS.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <Label htmlFor="orcid">
                {t('setup.orcid', 'ORCID iD')}{' '}
                <span className="text-gray-400 text-xs">{t('common.optional', '(optional)')}</span>
              </Label>
              <Input
                id="orcid"
                placeholder="0000-0000-0000-0000"
                value={orcid}
                onChange={e => setOrcid(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
              <input
                id="showOnGlobe"
                type="checkbox"
                checked={showOnGlobe}
                onChange={e => setShowOnGlobe(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-clinical-blue focus:ring-clinical-blue flex-shrink-0 cursor-pointer"
              />
              <label htmlFor="showOnGlobe" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                {t('setup.showOnGlobe', 'Show my city as a dot on the global researcher map. You can change this anytime in profile settings.')}
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('setup.setting', 'Setting up…') : t('setup.setupBtn', 'Set Up My Workspace →')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
