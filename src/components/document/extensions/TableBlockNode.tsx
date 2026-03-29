'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { Table2 } from 'lucide-react'
import { formatContValue, type GeneratedTableSpec, type ContVar, type CatVar } from '@/lib/tableGeneratorUtils'

// ─── Journal table renderer ───────────────────────────────────────────────────

function JournalTable({ spec }: { spec: GeneratedTableSpec }) {
  const contVars = spec.variables.filter((v): v is ContVar => v.type === 'continuous')
  const catVars = spec.variables.filter((v): v is CatVar => v.type === 'categorical')
  const hasCont = contVars.length > 0
  const hasCat = catVars.length > 0

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
      <thead>
        <tr style={{ borderTop: '2px solid #18181B' }}>
          <th
            style={{
              textAlign: 'left',
              padding: '6px 16px 6px 0',
              fontWeight: 700,
              borderBottom: '1px solid #18181B',
              fontFamily: 'var(--font-manrope)',
              fontSize: '0.75rem',
            }}
          >
            Characteristic
          </th>
          <th
            style={{
              textAlign: 'right',
              padding: '6px 0 6px 16px',
              fontWeight: 700,
              borderBottom: '1px solid #18181B',
              fontFamily: 'var(--font-manrope)',
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
            }}
          >
            Overall (N={spec.totalN.toLocaleString()})
          </th>
        </tr>
      </thead>
      <tbody>
        {hasCont && (
          <>
            <tr style={{ background: 'rgba(241,245,249,0.5)' }}>
              <td
                colSpan={2}
                style={{
                  padding: '5px 0',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#52525B',
                  fontFamily: 'var(--font-manrope)',
                }}
              >
                Continuous Variables
              </td>
            </tr>
            {contVars.map(v => (
              <tr key={v.name} style={{ borderBottom: '1px solid rgba(228,228,231,0.6)' }}>
                <td style={{ padding: '5px 16px 5px 12px', color: '#18181B' }}>
                  {v.name}
                </td>
                <td
                  style={{
                    padding: '5px 0 5px 16px',
                    textAlign: 'right',
                    color: '#18181B',
                    fontFamily: 'var(--font-geist-mono)',
                  }}
                >
                  {formatContValue(v, spec.format)}
                </td>
              </tr>
            ))}
          </>
        )}

        {hasCat && (
          <>
            <tr style={{ background: 'rgba(241,245,249,0.5)' }}>
              <td
                colSpan={2}
                style={{
                  padding: '5px 0',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#52525B',
                  fontFamily: 'var(--font-manrope)',
                }}
              >
                Categorical Variables
              </td>
            </tr>
            {catVars.map(v => (
              <>
                <tr key={v.name} style={{ background: 'rgba(241,245,249,0.3)' }}>
                  <td
                    colSpan={2}
                    style={{ padding: '4px 0 4px 0', fontWeight: 600, color: '#18181B' }}
                  >
                    {v.name}
                  </td>
                </tr>
                {v.categories.length > 0 ? (
                  v.categories.map(cat => (
                    <tr key={cat.label} style={{ borderBottom: '1px solid rgba(228,228,231,0.6)' }}>
                      <td style={{ padding: '4px 16px 4px 28px', color: '#52525B' }}>
                        {cat.label}
                      </td>
                      <td
                        style={{
                          padding: '4px 0 4px 16px',
                          textAlign: 'right',
                          color: '#18181B',
                          fontFamily: 'var(--font-geist-mono)',
                        }}
                      >
                        {cat.count} ({cat.pct}%)
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr style={{ borderBottom: '1px solid rgba(228,228,231,0.6)' }}>
                    <td colSpan={2} style={{ padding: '4px 0 4px 28px', color: '#A1A1AA' }}>
                      Category data unavailable
                    </td>
                  </tr>
                )}
              </>
            ))}
          </>
        )}
      </tbody>
      {spec.footnote && (
        <tfoot>
          <tr style={{ borderTop: '1px solid #18181B' }}>
            <td
              colSpan={2}
              style={{
                paddingTop: '6px',
                fontSize: '0.6875rem',
                color: '#52525B',
                fontStyle: 'italic',
              }}
            >
              {spec.footnote}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

// ─── NodeView component ───────────────────────────────────────────────────────

function TableBlockView({ node }: { node: { attrs: Record<string, unknown> } }) {
  const { tableSpec } = node.attrs as { tableSpec: string }

  let spec: GeneratedTableSpec | null = null
  try {
    spec = JSON.parse(tableSpec) as GeneratedTableSpec
  } catch {
    // ignore
  }

  if (!spec) {
    return (
      <NodeViewWrapper className="my-4">
        <div className="border border-red-200 rounded-lg p-4 bg-red-50 text-sm text-red-600">
          Failed to load table data.
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper className="my-5">
      <div
        className="border rounded-xl overflow-hidden bg-white"
        contentEditable={false}
        style={{ boxShadow: '0 4px 16px rgba(0,24,72,0.06)' }}
      >
        {/* Header bar */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 border-b"
          style={{ background: 'rgba(0,64,162,0.04)', borderColor: 'rgba(0,82,204,0.12)' }}
        >
          <Table2 className="h-3.5 w-3.5 text-[#0052cc] shrink-0" />
          <span
            className="text-sm font-semibold text-[#003d9b] truncate flex-1"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            {spec.title}
          </span>
          <span
            className="text-[10px] text-[#0040a2] font-bold uppercase tracking-wide"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            N={spec.totalN.toLocaleString()}
          </span>
        </div>

        {/* Table content */}
        <div className="px-5 py-4 overflow-x-auto">
          <JournalTable spec={spec} />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

// ─── TipTap Node Extension ────────────────────────────────────────────────────

export const TableBlockNodeExtension = Node.create({
  name: 'tableBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      tableSpec: { default: '{}' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="table-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'table-block' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableBlockView)
  },
})
