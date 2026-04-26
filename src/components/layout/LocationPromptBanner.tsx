"use client"

import { useState } from 'react'
import { MapPin, Loader2, CheckCircle2, X, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

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

interface Props {
  userId: string
  onSaved?: () => void
}

type State = 'prompt' | 'detecting' | 'detected' | 'manual' | 'saving' | 'done'

export function LocationPromptBanner({ userId, onSaved }: Props) {
  const [state, setState] = useState<State>('prompt')
  const [dismissed, setDismissed] = useState(false)
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)

  if (dismissed || state === 'done') return null

  const detect = () => {
    if (!navigator.geolocation) { setState('manual'); return }
    setState('detecting')
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
        setState('detected')
      },
      () => setState('manual'),
      { timeout: 8000 }
    )
  }

  const save = async () => {
    setState('saving')
    const supabase = createClient()

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

    const { error } = await supabase
      .from('profiles')
      .update({
        city: city || null,
        country: country || null,
        lat: finalLat,
        lng: finalLng,
        show_on_globe: true,
      })
      .eq('id', userId)

    if (error) {
      toast.error('Could not save location.')
      setState(lat ? 'detected' : 'manual')
      return
    }

    // Verify the write actually landed (RLS silent-fail check)
    const { data: verify } = await supabase
      .from('profiles')
      .select('lat')
      .eq('id', userId)
      .maybeSingle()

    if (!verify?.lat) {
      toast.error('Location could not be saved. Please try from Settings.')
      setState(lat ? 'detected' : 'manual')
      return
    }

    toast.success('Your location has been added to the global map.')
    setState('done')
    onSaved?.()
  }

  return (
    <div className="mx-4 mt-4 rounded-xl border border-clinical-blue/20 bg-clinical-blue/5 px-4 py-3 flex items-start gap-3">
      <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-full bg-clinical-blue/10 flex items-center justify-center">
        <MapPin className="h-4 w-4 text-clinical-blue" />
      </div>

      <div className="flex-1 min-w-0">
        {state === 'prompt' && (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-medium text-slate-800">Add your country to the global researcher map</p>
              <p className="text-xs text-slate-500 mt-0.5">Only your country is shown — your exact address is never shared. You can opt out anytime.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={detect}
                className="flex items-center gap-1.5 rounded-lg bg-clinical-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-clinical-deep transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" />
                Detect my country
              </button>
              <button
                onClick={() => setState('manual')}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Select manually
              </button>
            </div>
          </div>
        )}

        {state === 'detecting' && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-clinical-blue" />
            Detecting your country…
          </div>
        )}

        {state === 'detected' && (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-teal-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>Located: <strong>{city}{city && country ? ', ' : ''}{country}</strong></span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={save}
                className="rounded-lg bg-clinical-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-clinical-deep transition-colors"
              >
                Add to map
              </button>
              <button
                onClick={() => setState('manual')}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Not right?
              </button>
            </div>
          </div>
        )}

        {state === 'manual' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">Select your country</p>
            <div className="flex items-end gap-2 flex-wrap">
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-36 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue"
              />
              <div className="relative">
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-44 appearance-none rounded-lg border border-slate-200 px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-clinical-blue bg-white"
                >
                  <option value="">Country…</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              </div>
              <button
                onClick={save}
                disabled={!city || !country}
                className="rounded-lg bg-clinical-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-clinical-deep disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {state === 'saving' && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin text-clinical-blue" />
            Saving…
          </div>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors mt-0.5"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
