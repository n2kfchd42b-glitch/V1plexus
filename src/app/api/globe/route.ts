import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic' // never cache — globe must always reflect live data

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await supabase
    .from('profiles')
    .select('lat, lng, city, country, last_seen_at, research_discipline')
    .eq('show_on_globe', true)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (error) {
    return NextResponse.json({ researchers: [], total: 0, cities: 0, countries: 0, online: 0 })
  }

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const researchers = (data ?? []).map(r => ({
    lat:        r.lat as number,
    lng:        r.lng as number,
    city:       r.city       as string | null,
    country:    r.country    as string | null,
    discipline: (r.research_discipline ?? null) as string | null,
    active:     r.last_seen_at ? r.last_seen_at > fifteenMinutesAgo : false,
  }))

  const countries = new Set(researchers.map(r => r.country).filter(Boolean)).size
  const cities    = new Set(researchers.map(r => r.city).filter(Boolean)).size

  return NextResponse.json(
    {
      researchers,
      total:    researchers.length,
      cities,
      countries,
      online:   researchers.filter(r => r.active).length,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
