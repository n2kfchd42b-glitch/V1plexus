"use client"

import { useEffect, useState, useMemo, useRef } from 'react'
import { ComposableMap, Geographies, Geography, Graticule, Marker, Sphere } from 'react-simple-maps'

interface Researcher {
  lat: number
  lng: number
  city: string | null
  country: string | null
  active: boolean
}

interface GlobeData {
  researchers: Researcher[]
  total: number
  cities: number
  countries: number
  online: number
}

interface Cluster {
  lat: number
  lng: number
  city: string | null
  country: string | null
  count: number
  onlineCount: number
}

interface Tooltip {
  cluster: Cluster
  x: number
  y: number
}

const ONLINE_COLOR  = '#22c55e'
const OFFLINE_COLOR = '#ef4444'

function buildClusters(researchers: Researcher[]): Cluster[] {
  const map = new Map<string, Cluster>()
  for (const r of researchers) {
    const key = r.city && r.country
      ? `${r.city}||${r.country}`
      : `${r.lat.toFixed(1)}||${r.lng.toFixed(1)}`
    if (!map.has(key)) {
      map.set(key, { lat: r.lat, lng: r.lng, city: r.city, country: r.country, count: 0, onlineCount: 0 })
    }
    const c = map.get(key)!
    c.count++
    if (r.active) c.onlineCount++
  }
  return Array.from(map.values())
}

export function LandingGlobe() {
  const [data, setData] = useState<GlobeData>({ researchers: [], total: 0, cities: 0, countries: 0, online: 0 })
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/globe')
      .then(r => r.json())
      .then((d: GlobeData) => setData(d))
      .catch(() => {})
  }, [])

  const { researchers, total, countries, online } = data
  const clusters = useMemo(() => buildClusters(researchers), [researchers])

  return (
    <div className="relative h-full bg-[#060d1c] overflow-hidden" ref={mapRef}>
      <style>{`
        @keyframes ping-landing {
          0%   { r: 5; opacity: 0.6; }
          70%  { r: 13; opacity: 0; }
          100% { r: 5; opacity: 0; }
        }
        .land-ring { animation: ping-landing 2.4s ease-out infinite; }
      `}</style>

      {/* LIVE badge */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/8 border border-white/12 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
        <span className="text-[10px] font-semibold text-white/70 uppercase tracking-widest">Live</span>
      </div>

      {/* Map — absolute fill for cross-browser height */}
      <div className="absolute inset-0">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 165, center: [10, 10] }}
          style={{ width: '100%', height: '100%' }}
        >
          <Sphere id="landing-sphere" fill="#060d1c" stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
          <Graticule stroke="rgba(255,255,255,0.04)" strokeWidth={0.4} />
          <Geographies geography="/countries-110m.json">
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#0e2040"
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover:   { outline: 'none', fill: '#122a50' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {clusters.map((cluster, i) => {
            const isOnline = cluster.onlineCount > 0
            const color    = isOnline ? ONLINE_COLOR : OFFLINE_COLOR
            const radius   = Math.min(2.5 + cluster.count * 0.6, 8)

            return (
              <Marker
                key={i}
                coordinates={[cluster.lng, cluster.lat]}
                onMouseEnter={(e: React.MouseEvent) => {
                  const rect = mapRef.current?.getBoundingClientRect()
                  if (rect) setTooltip({ cluster, x: e.clientX - rect.left, y: e.clientY - rect.top })
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {isOnline && (
                  <circle
                    className="land-ring"
                    cx={0} cy={0} r={radius}
                    fill="none"
                    stroke={ONLINE_COLOR}
                    strokeWidth={0.8}
                  />
                )}
                <circle cx={0} cy={0} r={radius} fill={color} opacity={isOnline ? 1 : 0.55} />
                {cluster.count > 1 && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={radius > 5 ? 4 : 3}
                    fill="white"
                    fontWeight="bold"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {cluster.count > 9 ? '9+' : cluster.count}
                  </text>
                )}
              </Marker>
            )
          })}
        </ComposableMap>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none px-3 py-2 rounded-lg bg-[#0e2040] border border-white/15 shadow-lg text-white"
          style={{ left: tooltip.x + 12, top: tooltip.y - 36, transform: 'translateY(-50%)' }}
        >
          <p className="text-xs font-semibold leading-tight">
            {tooltip.cluster.count} researcher{tooltip.cluster.count !== 1 ? 's' : ''}
            {tooltip.cluster.onlineCount > 0 && (
              <span className="text-[#22c55e] ml-1">· {tooltip.cluster.onlineCount} online</span>
            )}
          </p>
          {(tooltip.cluster.city || tooltip.cluster.country) && (
            <p className="text-[10px] text-white/50 mt-0.5">
              {[tooltip.cluster.city, tooltip.cluster.country].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Bottom stats */}
      <div className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-[#060d1c] via-[#060d1c]/80 to-transparent">
        {total > 0 ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-white/60 text-[11px] font-medium">
              {total.toLocaleString()} researcher{total !== 1 ? 's' : ''}
            </span>
            <span className="text-white/20 text-[10px]">·</span>
            <span className="text-white/60 text-[11px] font-medium">
              {countries} countr{countries !== 1 ? 'ies' : 'y'}
            </span>
            {online > 0 && (
              <>
                <span className="text-white/20 text-[10px]">·</span>
                <span className="flex items-center gap-1 text-[#86efac] text-[11px] font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                  {online} online now
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="h-4" />
        )}
      </div>
    </div>
  )
}
