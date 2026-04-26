import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get('city')?.trim()
  const country = searchParams.get('country')?.trim()

  if (!city || !country) {
    return NextResponse.json({ error: 'city and country are required' }, { status: 400 })
  }

  const query = encodeURIComponent(`${city}, ${country}`)
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Plexus Research Platform (plexus.health)' },
    next: { revalidate: 86400 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }

  const results = await res.json() as Array<{ lat: string; lon: string }>

  if (!results.length) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  return NextResponse.json({
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
  })
}
