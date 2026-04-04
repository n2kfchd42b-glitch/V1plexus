import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import type { CslCitation } from '@/components/publication/CitationSearch'

function formatInline(attrs: CitationAttrs, style: string): string {
  const year = attrs.issued?.['date-parts']?.[0]?.[0] ?? ''
  const firstAuthor = attrs.author?.[0]?.family ?? 'Unknown'
  const multi = (attrs.author?.length ?? 0) > 1
  if (style === 'vancouver' || style === 'numbered') {
    return `[${attrs.num}]`
  }
  return `(${firstAuthor}${multi ? ' et al.' : ''}, ${year})`
}

interface CitationAttrs {
  num: number
  title: string
  author?: Array<{ family: string; given: string }>
  issued?: { 'date-parts': number[][] }
  DOI?: string
  'container-title'?: string
  style: string
  citationData: string // JSON stringified CslCitation
}

function CitationNodeView({ node }: NodeViewProps) {
  const attrs = node.attrs as CitationAttrs
  const label = formatInline(attrs, attrs.style ?? 'vancouver')

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        contentEditable={false}
        className="inline-flex items-center citation-chip cursor-pointer select-none"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '4px',
          padding: '0 5px',
          fontSize: '0.78em',
          fontFamily: 'var(--font-sans)',
          color: '#1D4ED8',
          fontWeight: 500,
          lineHeight: '1.6',
          margin: '0 1px',
          verticalAlign: 'baseline',
          whiteSpace: 'nowrap',
        }}
        title={attrs.title}
      >
        {label}
      </span>
    </NodeViewWrapper>
  )
}

export interface CitationNodeAttrs extends CitationAttrs {}

export const CitationNodeExtension = Node.create({
  name: 'citation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      num: { default: 1 },
      title: { default: '' },
      author: { default: [] },
      issued: { default: null },
      DOI: { default: null },
      'container-title': { default: null },
      style: { default: 'vancouver' },
      citationData: { default: '{}' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-citation]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-citation': 'true' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationNodeView)
  },
})

export function buildCitationAttrs(
  citation: CslCitation,
  num: number,
  style: string
): CitationNodeAttrs {
  return {
    num,
    title: citation.title,
    author: citation.author,
    issued: citation.issued,
    DOI: citation.DOI,
    'container-title': citation['container-title'],
    style,
    citationData: JSON.stringify(citation),
  }
}
