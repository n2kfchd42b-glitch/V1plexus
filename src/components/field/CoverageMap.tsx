'use client'

import { useEffect, useRef } from 'react'

interface CoverageMapProps {
  projectId: string
}

export function CoverageMap({ projectId }: CoverageMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamic import of Leaflet to avoid SSR
    import('leaflet').then(L => {
      // Fix default marker icons
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, {
        center: [7.9465, -1.0232], // Ghana center
        zoom: 7,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Add sample markers (in production, fetch from dataset gps columns)
      const samplePoints = [
        [7.9465, -1.0232],
        [7.8, -1.5],
        [8.1, -0.8],
        [7.5, -1.2],
        [8.3, -1.4],
      ] as [number, number][]

      samplePoints.forEach(([lat, lng]) => {
        L.circleMarker([lat, lng], {
          radius: 6,
          fillColor: '#3B82F6',
          color: '#1D4ED8',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map).bindPopup('Submission location')
      })

      mapInstanceRef.current = map
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [projectId])

  return (
    <div className="relative w-full h-full">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} className="w-full h-full" />
    </div>
  )
}
