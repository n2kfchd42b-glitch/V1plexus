import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }

  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Plexus Research Platform (plexus.health)' },
    next: { revalidate: 86400 },
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Reverse geocoding failed' }, { status: 502 })
  }

  const data = await res.json() as {
    address?: {
      city?: string
      town?: string
      village?: string
      county?: string
      country?: string
    }
  }

  const city =
    data.address?.city ??
    data.address?.town ??
    data.address?.village ??
    data.address?.county ??
    null

  const country = data.address?.country ?? null

  return NextResponse.json({ city, country })
}
