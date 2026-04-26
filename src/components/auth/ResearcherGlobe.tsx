"use client"

import { useEffect, useState, useMemo, useRef } from 'react'
import { ComposableMap, Geographies, Geography, Graticule, Marker, Sphere } from 'react-simple-maps'
import { BrandLogo } from '@/components/layout/BrandLogo'

interface Researcher {
  lat: number
  lng: number
  city: string | null
  country: string | null
  discipline: string | null
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
  disciplines: string[]
}

interface Tooltip {
  cluster: Cluster
  x: number
  y: number
}

const ONLINE_COLOR  = '#22c55e'
const OFFLINE_COLOR = '#ef4444'
const DIMMED_OPACITY = 0.1

function buildClusters(researchers: Researcher[]): Cluster[] {
  const map = new Map<string, Cluster>()
  for (const r of researchers) {
    const key = r.city && r.country
      ? `${r.city}||${r.country}`
      : `${r.lat.toFixed(1)}||${r.lng.toFixed(1)}`
    if (!map.has(key)) {
      map.set(key, {
        lat: r.lat, lng: r.lng,
        city: r.city, country: r.country,
        count: 0, onlineCount: 0, disciplines: [],
      })
    }
    const c = map.get(key)!
    c.count++
    if (r.active) c.onlineCount++
    if (r.discipline && !c.disciplines.includes(r.discipline)) c.disciplines.push(r.discipline)
  }
  return Array.from(map.values())
}

export function ResearcherGlobe() {
  const [data, setData]           = useState<GlobeData>({ researchers: [], total: 0, cities: 0, countries: 0, online: 0 })
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null)
  const [countryFilter, setCountryFilter]       = useState<string>('')
  const [tooltip, setTooltip]     = useState<Tooltip | null>(null)
  const mapRef                    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/globe')
      .then(r => r.json())
      .then((d: GlobeData) => setData(d))
      .catch(() => {})
  }, [])

  const { researchers, total, cities, countries, online } = data

  const clusters = useMemo(() => buildClusters(researchers), [researchers])

  const presentDisciplines = useMemo(() =>
    Array.from(new Set(researchers.map(r => r.discipline).filter((d): d is string => !!d))).sort(),
    [researchers]
  )

  const presentCountries = useMemo(() =>
    Array.from(new Set(researchers.map(r => r.country).filter((c): c is string => !!c))).sort(),
    [researchers]
  )

  return (
    <div className="relative flex flex-col h-screen bg-[#060d1c] overflow-hidden" ref={mapRef}>
      <style>{`
        @keyframes ping-online {
          0%   { r: 5; opacity: 0.6; }
          70%  { r: 13; opacity: 0; }
          100% { r: 5; opacity: 0; }
        }
        .dot-ring { animation: ping-online 2.4s ease-out infinite; }
      `}</style>

      {/* Logo */}
      <div className="absolute top-6 left-6 z-10">
        <BrandLogo variant="standalone" href="/" />
      </div>

      {/* Filters — top right: legend + two dropdowns on one row */}
      <div className="absolute top-6 right-6 z-10 flex flex-col items-end gap-2">
        {/* Legend */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/6 border border-white/10">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/70">
            <span className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse" /> Online
          </span>
          <span className="text-white/20">·</span>
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/50">
            <span className="h-2 w-2 rounded-full bg-[#ef4444]" /> Offline
          </span>
        </div>

        {/* Discipline + Country dropdowns — side by side */}
        <div className="flex items-center gap-2">
          {presentDisciplines.length > 0 && (
            <select
              value={disciplineFilter ?? ''}
              onChange={e => setDisciplineFilter(e.target.value || null)}
              className="px-2.5 py-1 rounded-full text-[10px] font-medium border bg-white/5 border-white/10 text-white/60 appearance-none focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
            >
              <option value="">All disciplines</option>
              {presentDisciplines.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          {presentCountries.length > 0 && (
            <select
              value={countryFilter}
              onChange={e => setCountryFilter(e.target.value)}
              className="px-2.5 py-1 rounded-full text-[10px] font-medium border bg-white/5 border-white/10 text-white/60 appearance-none focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all"
            >
              <option value="">All countries</option>
              {presentCountries.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Map — absolute fill so Safari doesn't collapse the SVG height to zero */}
      <div className="absolute inset-0">
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 165, center: [10, 10] }}
          style={{ width: '100%', height: '100%' }}
        >
          <Sphere id="rsm-sphere" fill="#060d1c" stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
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
            const isOnline  = cluster.onlineCount > 0
            const color     = isOnline ? ONLINE_COLOR : OFFLINE_COLOR
            const radius    = Math.min(2.5 + cluster.count * 0.6, 8)

            const disciplineDimmed = disciplineFilter !== null && !cluster.disciplines.includes(disciplineFilter)
            const countryDimmed    = countryFilter !== '' && cluster.country !== countryFilter
            const dimmed           = disciplineDimmed || countryDimmed
            const opacity          = dimmed ? DIMMED_OPACITY : (isOnline ? 1 : 0.55)

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
                {isOnline && !dimmed && (
                  <circle
                    className="dot-ring"
                    cx={0} cy={0} r={radius}
                    fill="none"
                    stroke={ONLINE_COLOR}
                    strokeWidth={0.8}
                  />
                )}
                <circle
                  cx={0} cy={0}
                  r={radius}
                  fill={color}
                  opacity={opacity}
                />
                {/* Count badge for clusters with 2+ researchers */}
                {cluster.count > 1 && !dimmed && (
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
          style={{
            left: tooltip.x + 12,
            top:  tooltip.y - 36,
            transform: 'translateY(-50%)',
          }}
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
          {tooltip.cluster.disciplines.length > 0 && (
            <p className="text-[10px] text-white/40 mt-0.5">
              {tooltip.cluster.disciplines.join(' · ')}
            </p>
          )}
        </div>
      )}

      {/* Bottom branding + stats */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#060d1c] via-[#060d1c]/80 to-transparent">
        <p className="text-white/90 text-xl font-semibold leading-snug mb-1">
          PLEXUS RESEARCH LAB&#8482;
        </p>
        <p className="text-white/45 text-sm mb-3">
          The Global Research Plexus
        </p>

        {total > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-white/50" />
              <span className="text-white/70 text-xs font-medium">
                {total.toLocaleString()} researcher{total !== 1 ? 's' : ''}
              </span>
            </div>
            {cities > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/10">
                <span className="text-white/70 text-xs font-medium">
                  {cities} cit{cities !== 1 ? 'ies' : 'y'}
                </span>
              </div>
            )}
            {countries > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/8 border border-white/10">
                <span className="text-white/70 text-xs font-medium">
                  🌍 {countries} countr{countries !== 1 ? 'ies' : 'y'}
                </span>
              </div>
            )}
            {online > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/25">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                <span className="text-[#86efac] text-xs font-medium">
                  {online} online now
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
