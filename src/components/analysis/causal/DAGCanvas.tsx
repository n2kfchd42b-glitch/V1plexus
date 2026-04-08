'use client'

/**
 * DAGCanvas — interactive directed acyclic graph visualisation.
 *
 * Pure SVG, no external graph library. Supports:
 *   - Drag to reposition nodes
 *   - Click edge → action menu (accept / reverse / remove)
 *   - Auto-layout if no positions set
 *
 * Edge confidence communicated via:
 *   - Stroke opacity  (≥0.75 = solid, ≥0.5 = 70%, <0.5 = 40%)
 *   - Stroke style    (direction_certain = solid, uncertain = dashed)
 *   - Badge           (confidence %)
 *
 * Node role communicated via border colour:
 *   exposure = blue, outcome = emerald, covariate = gray
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { DAGEdge, DAGNode } from '@/types/causal'

interface DAGCanvasProps {
  nodes: DAGNode[]
  edges: DAGEdge[]
  exposure: string
  outcome: string
  onEdgeAction: (edge: DAGEdge, action: 'accept' | 'reverse' | 'remove') => void
  onEdgeAdd: (from: string, to: string) => void
  readOnly?: boolean
}

const NODE_R = 40
const W = 800
const H = 500

function opacityForConfidence(c: number): number {
  if (c >= 0.75) return 1.0
  if (c >= 0.5) return 0.7
  return 0.4
}

function nodeStroke(role: DAGNode['role']): string {
  switch (role) {
    case 'exposure': return '#3B82F6'
    case 'outcome':  return '#10B981'
    default:         return '#6B7280'
  }
}

function autoLayout(nodes: DAGNode[], exposure: string, outcome: string): DAGNode[] {
  const cols = Math.max(Math.ceil(Math.sqrt(nodes.length)), 1)
  return nodes.map((n, i) => {
    if (n.x !== undefined && n.y !== undefined) return n
    if (n.id === exposure) return { ...n, x: 100, y: H / 2 }
    if (n.id === outcome)  return { ...n, x: W - 100, y: H / 2 }
    const col = i % cols
    const row = Math.floor(i / cols)
    return { ...n, x: 200 + col * 110, y: 80 + row * 110 }
  })
}

export function DAGCanvas({
  nodes: rawNodes,
  edges,
  exposure,
  outcome,
  onEdgeAction,
  onEdgeAdd,
  readOnly = false,
}: DAGCanvasProps) {
  const [nodes, setNodes] = useState<DAGNode[]>(() =>
    autoLayout(rawNodes, exposure, outcome)
  )
  const [dragging, setDragging] = useState<string | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<DAGEdge | null>(null)
  const [addingEdge, setAddingEdge] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    setNodes(autoLayout(rawNodes, exposure, outcome))
  }, [rawNodes, exposure, outcome])

  const posOf = useCallback(
    (id: string) => nodes.find((n) => n.id === id) ?? { x: 0, y: 0 },
    [nodes]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const scaleX = W / rect.width
      const scaleY = H / rect.height
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragging
            ? {
                ...n,
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
              }
            : n
        )
      )
    },
    [dragging]
  )

  return (
    <div className="relative w-full rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
      {!readOnly && addingEdge && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full border border-blue-200">
          Click a target node to draw an edge from <strong>{addingEdge}</strong>
          <button
            className="ml-2 text-blue-400 hover:text-blue-600"
            onClick={() => setAddingEdge(null)}
          >
            ✕
          </button>
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="cursor-default select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
      >
        <defs>
          <marker id="arrow-gray" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
          </marker>
          <marker id="arrow-amber" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#F59E0B" />
          </marker>
          <marker id="arrow-indigo" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366F1" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, idx) => {
          const from = posOf(edge.from)
          const to = posOf(edge.to)
          if (!from || !to) return null

          const dx = (to.x ?? 0) - (from.x ?? 0)
          const dy = (to.y ?? 0) - (from.y ?? 0)
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const x1 = (from.x ?? 0) + (dx / dist) * NODE_R
          const y1 = (from.y ?? 0) + (dy / dist) * NODE_R
          const x2 = (to.x ?? 0) - (dx / dist) * NODE_R
          const y2 = (to.y ?? 0) - (dy / dist) * NODE_R
          const midX = (x1 + x2) / 2
          const midY = (y1 + y2) / 2

          const isSelected =
            selectedEdge?.from === edge.from && selectedEdge?.to === edge.to
          const uncertain = !edge.direction_certain
          const opacity = opacityForConfidence(edge.confidence)
          const colour = isSelected ? '#6366F1' : uncertain ? '#F59E0B' : '#6B7280'
          const markerId = isSelected ? 'arrow-indigo' : uncertain ? 'arrow-amber' : 'arrow-gray'

          return (
            <g key={`edge-${idx}`}>
              {/* Wider invisible hit area */}
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="transparent"
                strokeWidth={12}
                className={readOnly ? '' : 'cursor-pointer'}
                onClick={() => !readOnly && setSelectedEdge(isSelected ? null : edge)}
              />
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={colour}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeOpacity={opacity}
                strokeDasharray={uncertain ? '6 3' : undefined}
                markerEnd={`url(#${markerId})`}
                pointerEvents="none"
              />
              <text x={midX} y={midY - 7} fontSize="10" fill="#9CA3AF" textAnchor="middle">
                {Math.round(edge.confidence * 100)}%
              </text>
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const stroke = nodeStroke(node.role)
          const isAddingFrom = addingEdge === node.id
          return (
            <g
              key={node.id}
              transform={`translate(${node.x ?? 0},${node.y ?? 0})`}
              style={{ cursor: readOnly ? 'default' : dragging ? 'grabbing' : 'grab' }}
              onMouseDown={(e) => {
                e.stopPropagation()
                if (!readOnly && !addingEdge) setDragging(node.id)
              }}
              onClick={() => {
                if (readOnly) return
                if (addingEdge && addingEdge !== node.id) {
                  onEdgeAdd(addingEdge, node.id)
                  setAddingEdge(null)
                }
              }}
            >
              <circle
                r={NODE_R}
                fill={isAddingFrom ? '#EEF2FF' : 'white'}
                stroke={stroke}
                strokeWidth={
                  node.role === 'exposure' || node.role === 'outcome' ? 2.5 : 1.5
                }
              />
              <text
                fontSize="11"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#111827"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {node.label.length > 10 ? node.label.slice(0, 9) + '…' : node.label}
              </text>
              {(node.role === 'exposure' || node.role === 'outcome') && (
                <text
                  y={NODE_R + 14}
                  fontSize="9"
                  textAnchor="middle"
                  fill={stroke}
                  fontWeight="600"
                  style={{ pointerEvents: 'none', userSelect: 'none', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {node.role}
                </text>
              )}
              {/* Add-edge trigger button */}
              {!readOnly && !addingEdge && (
                <circle
                  r={8}
                  cx={NODE_R - 4}
                  cy={-(NODE_R - 4)}
                  fill="#6366F1"
                  opacity={0}
                  className="hover:opacity-100 transition-opacity cursor-pointer"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setAddingEdge(node.id)
                  }}
                />
              )}
            </g>
          )
        })}
      </svg>

      {/* Edge action menu */}
      {selectedEdge && !readOnly && (
        <div className="absolute top-3 right-3 bg-white rounded-lg shadow border border-gray-100 p-3 space-y-1 text-sm z-10 min-w-[200px]">
          <p className="text-xs text-gray-400 font-medium mb-2 font-mono">
            {selectedEdge.from} → {selectedEdge.to}
          </p>
          <button
            onClick={() => { onEdgeAction(selectedEdge, 'accept'); setSelectedEdge(null) }}
            className="block w-full text-left px-2 py-1.5 rounded hover:bg-green-50 text-green-700"
          >
            ✓ Accept this edge
          </button>
          <button
            onClick={() => { onEdgeAction(selectedEdge, 'reverse'); setSelectedEdge(null) }}
            className="block w-full text-left px-2 py-1.5 rounded hover:bg-blue-50 text-blue-700"
          >
            ⇄ Reverse direction
          </button>
          <button
            onClick={() => { onEdgeAction(selectedEdge, 'remove'); setSelectedEdge(null) }}
            className="block w-full text-left px-2 py-1.5 rounded hover:bg-red-50 text-red-700"
          >
            ✕ Remove this edge
          </button>
          <button
            onClick={() => setSelectedEdge(null)}
            className="block w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 text-gray-400 text-xs"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
