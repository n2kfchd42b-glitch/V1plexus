'use client'

import { useEffect, useRef } from 'react'

interface CollaborationNode {
  id: string
  name: string
  department: string
  projectCount: number
}

interface CollaborationLink {
  source: string
  target: string
  sharedProjects: number
}

interface CollaborationGraphProps {
  nodes?: CollaborationNode[]
  links?: CollaborationLink[]
}

const DEPT_COLORS: Record<string, string> = {
  'Epidemiology': '#3B82F6',
  'Biostatistics': '#10B981',
  'Pop & Family': '#8B5CF6',
  'default': '#94A3B8',
}

const SAMPLE_NODES: CollaborationNode[] = [
  { id: '1', name: 'Ama Mensah',    department: 'Epidemiology', projectCount: 5 },
  { id: '2', name: 'Kofi Asante',  department: 'Biostatistics', projectCount: 4 },
  { id: '3', name: 'Seth Abrokwa', department: 'Epidemiology', projectCount: 3 },
  { id: '4', name: 'Esi Owusu',    department: 'Pop & Family', projectCount: 3 },
  { id: '5', name: 'John Boateng', department: 'Biostatistics', projectCount: 2 },
  { id: '6', name: 'Abena Kumi',   department: 'Epidemiology', projectCount: 2 },
]

const SAMPLE_LINKS: CollaborationLink[] = [
  { source: '1', target: '2', sharedProjects: 3 },
  { source: '1', target: '3', sharedProjects: 2 },
  { source: '2', target: '4', sharedProjects: 2 },
  { source: '3', target: '5', sharedProjects: 1 },
  { source: '4', target: '6', sharedProjects: 1 },
  { source: '1', target: '4', sharedProjects: 1 },
]

export function CollaborationGraph({ nodes, links }: CollaborationGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const graphNodes = nodes ?? SAMPLE_NODES
  const graphLinks = links ?? SAMPLE_LINKS

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width = W
    canvas.height = H

    // Simple static layout: arrange nodes in a circle
    const cx = W / 2
    const cy = H / 2
    const radius = Math.min(W, H) * 0.35
    const angleStep = (2 * Math.PI) / graphNodes.length

    const positions: Record<string, { x: number; y: number }> = {}
    graphNodes.forEach((node, i) => {
      const angle = i * angleStep - Math.PI / 2
      positions[node.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      }
    })

    ctx.clearRect(0, 0, W, H)

    // Draw links
    graphLinks.forEach(link => {
      const s = positions[link.source]
      const t = positions[link.target]
      if (!s || !t) return
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = `rgba(148, 163, 184, ${0.2 + link.sharedProjects * 0.15})`
      ctx.lineWidth = link.sharedProjects
      ctx.stroke()
    })

    // Draw nodes
    graphNodes.forEach(node => {
      const pos = positions[node.id]
      if (!pos) return
      const r = 8 + node.projectCount * 3
      const color = DEPT_COLORS[node.department] ?? DEPT_COLORS.default

      ctx.beginPath()
      ctx.arc(pos.x, pos.y, r, 0, 2 * Math.PI)
      ctx.fillStyle = color + '33'
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      ctx.fillStyle = 'var(--text-primary)'
      ctx.font = '11px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const name = node.name.split(' ')[0]
      ctx.fillText(name, pos.x, pos.y + r + 4)
    })
  }, [graphNodes, graphLinks])

  // Legend
  const depts = [...new Set(graphNodes.map(n => n.department))]

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="w-full" style={{ height: 260 }} />
      <div className="flex flex-wrap gap-3 mt-2 px-2">
        {depts.map(dept => (
          <div key={dept} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: DEPT_COLORS[dept] ?? DEPT_COLORS.default }}
            />
            <span className="text-xs text-[var(--text-tertiary)]">{dept}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
