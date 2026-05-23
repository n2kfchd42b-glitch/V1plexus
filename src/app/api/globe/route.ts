import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic' // never cache — globe must always reflect live data

// Reads from the public.globe_researchers view (created in
// 20260523000003_globe_public_view.sql) using the anon key. The view exposes
// only opt-in, non-PII columns, so we no longer need SUPABASE_SERVICE_ROLE_KEY
// on a public endpoint.

// Demo seed researchers for campaign launch.
// Weighted toward Africa and the Americas; no Caribbean islands, no Australia.
// ~10 marked offline (active: false) for realism.
const DEMO_RESEARCHERS = [
  // ── Africa ───────────────────────────────────────────────────────────────
  { lat:  6.5244, lng:   3.3792, city: 'Lagos',          country: 'Nigeria',                  discipline: 'Public Health',         active: true  },
  { lat:  5.6037, lng:  -0.1870, city: 'Accra',          country: 'Ghana',                    discipline: 'Medicine',               active: true  },
  { lat:  5.3599, lng:  -4.0083, city: 'Abidjan',        country: 'Côte d\'Ivoire',           discipline: 'Social Sciences',        active: false },
  { lat: -1.2921, lng:  36.8219, city: 'Nairobi',        country: 'Kenya',                    discipline: 'Environmental Science',  active: true  },
  { lat:  9.1450, lng:  40.4897, city: 'Addis Ababa',    country: 'Ethiopia',                 discipline: 'Public Health',          active: true  },
  { lat: -6.7924, lng:  39.2083, city: 'Dar es Salaam',  country: 'Tanzania',                 discipline: 'Medicine',               active: false },
  { lat: -1.9403, lng:  29.8739, city: 'Kigali',         country: 'Rwanda',                   discipline: 'Public Health',          active: true  },
  { lat:  0.3476, lng:  32.5825, city: 'Kampala',        country: 'Uganda',                   discipline: 'Agriculture',            active: true  },
  { lat: 14.7167, lng: -17.4677, city: 'Dakar',          country: 'Senegal',                  discipline: 'Economics',              active: true  },
  { lat: 12.3714, lng:  -1.5197, city: 'Ouagadougou',    country: 'Burkina Faso',             discipline: 'Education',              active: false },
  { lat: 12.6392, lng:  -8.0029, city: 'Bamako',         country: 'Mali',                     discipline: 'Social Sciences',        active: true  },
  { lat: 30.0444, lng:  31.2357, city: 'Cairo',          country: 'Egypt',                    discipline: 'Engineering',            active: true  },
  { lat: 33.5731, lng:  -7.5898, city: 'Casablanca',     country: 'Morocco',                  discipline: 'Economics',              active: false },
  { lat: -26.2041,lng:  28.0473, city: 'Johannesburg',   country: 'South Africa',             discipline: 'Computer Science',       active: true  },
  { lat: -15.3875,lng:  28.3228, city: 'Lusaka',         country: 'Zambia',                   discipline: 'Public Health',          active: true  },
  { lat: -17.8252,lng:  31.0335, city: 'Harare',         country: 'Zimbabwe',                 discipline: 'Agriculture',            active: false },
  { lat:  4.3612, lng:  18.5550, city: 'Bangui',         country: 'Central African Republic', discipline: 'Medicine',               active: true  },
  { lat: 15.5517, lng:  32.5324, city: 'Khartoum',       country: 'Sudan',                    discipline: 'Environmental Science',  active: true  },

  // ── North America ────────────────────────────────────────────────────────
  { lat: 40.7128, lng: -74.0060, city: 'New York',       country: 'United States',            discipline: 'Computer Science',       active: true  },
  { lat: 34.0522, lng:-118.2437, city: 'Los Angeles',    country: 'United States',            discipline: 'Psychology',             active: true  },
  { lat: 41.8781, lng: -87.6298, city: 'Chicago',        country: 'United States',            discipline: 'Public Health',          active: false },
  { lat: 29.7604, lng: -95.3698, city: 'Houston',        country: 'United States',            discipline: 'Medicine',               active: true  },
  { lat: 38.9072, lng: -77.0369, city: 'Washington DC',  country: 'United States',            discipline: 'Social Sciences',        active: true  },
  { lat: 42.3601, lng: -71.0589, city: 'Boston',         country: 'United States',            discipline: 'Medicine',               active: true  },
  { lat: 33.7490, lng: -84.3880, city: 'Atlanta',        country: 'United States',            discipline: 'Public Health',          active: false },
  { lat: 37.7749, lng:-122.4194, city: 'San Francisco',  country: 'United States',            discipline: 'Computer Science',       active: true  },
  { lat: 43.6532, lng: -79.3832, city: 'Toronto',        country: 'Canada',                   discipline: 'Environmental Science',  active: true  },
  { lat: 45.5017, lng: -73.5673, city: 'Montreal',       country: 'Canada',                   discipline: 'Economics',              active: false },
  { lat: 49.2827, lng:-123.1207, city: 'Vancouver',      country: 'Canada',                   discipline: 'Computer Science',       active: true  },
  { lat: 19.4326, lng: -99.1332, city: 'Mexico City',    country: 'Mexico',                   discipline: 'Social Sciences',        active: true  },
  { lat: 20.9674, lng: -89.5926, city: 'Mérida',         country: 'Mexico',                   discipline: 'Agriculture',            active: true  },

  // ── South America ────────────────────────────────────────────────────────
  { lat: -23.5505,lng: -46.6333, city: 'São Paulo',      country: 'Brazil',                   discipline: 'Engineering',            active: true  },
  { lat:  -3.7172,lng: -38.5433, city: 'Fortaleza',      country: 'Brazil',                   discipline: 'Public Health',          active: true  },
  { lat: -34.6037,lng: -58.3816, city: 'Buenos Aires',   country: 'Argentina',                discipline: 'Economics',              active: false },
  { lat:   4.7110,lng: -74.0721, city: 'Bogotá',         country: 'Colombia',                 discipline: 'Medicine',               active: true  },
  { lat: -12.0464,lng: -77.0428, city: 'Lima',           country: 'Peru',                     discipline: 'Environmental Science',  active: true  },
  { lat: -33.4489,lng: -70.6693, city: 'Santiago',       country: 'Chile',                    discipline: 'Computer Science',       active: true  },
  { lat: -34.9011,lng: -56.1645, city: 'Montevideo',     country: 'Uruguay',                  discipline: 'Social Sciences',        active: false },
  { lat: -16.5000,lng: -68.1500, city: 'La Paz',         country: 'Bolivia',                  discipline: 'Agriculture',            active: true  },

  // ── Europe (light presence) ──────────────────────────────────────────────
  { lat: 51.5074, lng:  -0.1278, city: 'London',         country: 'United Kingdom',           discipline: 'Public Health',          active: true  },
  { lat: 48.8566, lng:   2.3522, city: 'Paris',          country: 'France',                   discipline: 'Social Sciences',        active: true  },
  { lat: 52.5200, lng:  13.4050, city: 'Berlin',         country: 'Germany',                  discipline: 'Computer Science',       active: false },
  { lat: 52.3676, lng:   4.9041, city: 'Amsterdam',      country: 'Netherlands',              discipline: 'Medicine',               active: true  },

  // ── Asia (light presence) ────────────────────────────────────────────────
  { lat: 19.0760, lng:  72.8777, city: 'Mumbai',         country: 'India',                    discipline: 'Medicine',               active: true  },
  { lat: 28.6139, lng:  77.2090, city: 'New Delhi',      country: 'India',                    discipline: 'Public Health',          active: true  },
  { lat:  1.3521, lng: 103.8198, city: 'Singapore',      country: 'Singapore',                discipline: 'Computer Science',       active: false },
  { lat: 35.6762, lng: 139.6503, city: 'Tokyo',          country: 'Japan',                    discipline: 'Engineering',            active: true  },
]

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    return NextResponse.json({ researchers: DEMO_RESEARCHERS, total: DEMO_RESEARCHERS.length, cities: 0, countries: 0, online: 0 })
  }

  const supabase = createClient(url, anonKey)

  const { data, error } = await supabase
    .from('globe_researchers')
    .select('lat, lng, city, country, last_seen_at, research_discipline')

  if (error) {
    return NextResponse.json({ researchers: [], total: 0, cities: 0, countries: 0, online: 0 })
  }

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const realResearchers = (data ?? []).map(r => ({
    lat:        r.lat as number,
    lng:        r.lng as number,
    city:       r.city       as string | null,
    country:    r.country    as string | null,
    discipline: (r.research_discipline ?? null) as string | null,
    active:     r.last_seen_at ? r.last_seen_at > fifteenMinutesAgo : false,
  }))

  const researchers = [...realResearchers, ...DEMO_RESEARCHERS]

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
