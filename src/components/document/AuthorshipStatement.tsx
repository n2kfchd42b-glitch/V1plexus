'use client'

import { useMemo } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCreditLabel, type CreditRole } from '@/lib/credit-taxonomy'
import { toast } from 'sonner'

interface Author {
  id: string
  displayName: string
  creditRoles: CreditRole[]
  contributionOrder: number
}

interface AuthorshipStatementProps {
  authors: Author[]
  documentTitle?: string
  format?: 'paragraph' | 'list'
}

/**
 * AuthorshipStatement formats author contributions per CRediT taxonomy
 * for journal submission and institutional records.
 */
export function AuthorshipStatement({
  authors,
  documentTitle,
  format = 'paragraph',
}: AuthorshipStatementProps) {
  // Sort by contribution order
  const sortedAuthors = useMemo(
    () => [...authors].sort((a, b) => a.contributionOrder - b.contributionOrder),
    [authors]
  )

  // Generate CRediT statement per author
  const authorStatements = useMemo(() => {
    return sortedAuthors.map((author) => {
      const initials = author.displayName
        .split(' ')
        .map((n) => n[0]?.toUpperCase())
        .join('')

      const roles = author.creditRoles
        .map((role) => getCreditLabel(role))
        .join(', ')

      return { initials, name: author.displayName, roles }
    })
  }, [sortedAuthors])

  // Generate paragraph format (CRediT standard)
  const paragraphStatement = useMemo(() => {
    return authorStatements
      .map((s) => `${s.name}: ${s.roles || '(role not specified)'}`)
      .join('. ')
      .concat('.')
  }, [authorStatements])

  // Generate list format
  const listStatement = useMemo(() => {
    return authorStatements.map((s) => `• ${s.name}: ${s.roles || '(role not specified)'}`).join('\n')
  }, [authorStatements])

  const statement = format === 'paragraph' ? paragraphStatement : listStatement

  const handleCopy = () => {
    navigator.clipboard.writeText(statement)
    toast.success('Authorship statement copied')
  }

  if (sortedAuthors.length === 0) {
    return (
      <div className="p-4 border border-dashed border-border-default rounded bg-surface-2">
        <p className="text-xs text-text-tertiary text-center">
          No authors yet. Add authors to generate authorship statement.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {documentTitle && (
        <div>
          <p className="text-xs font-semibold text-text-secondary mb-1">
            Document: {documentTitle}
          </p>
        </div>
      )}

      <div className="relative">
        <div className="p-4 bg-surface-1 border border-border-default rounded text-sm text-text-primary whitespace-pre-wrap break-words">
          {statement}
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 h-7 w-7"
          onClick={handleCopy}
          title="Copy to clipboard"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Format info */}
      <p className="text-xs text-text-tertiary">
        Format: CRediT Taxonomy • {sortedAuthors.length} author(s)
      </p>

      {/* Export instructions */}
      <div className="p-3 bg-info-light border border-info rounded text-xs text-info-dark space-y-1">
        <p className="font-semibold">💡 How to use:</p>
        <ul className="list-disc list-inside space-y-0.5 text-xs">
          <li>Copy this statement into your manuscript's "Author Contributions" section</li>
          <li>Add this to supplementary materials for full transparency</li>
          <li>Include in journal submissions with CRediT support</li>
        </ul>
      </div>
    </div>
  )
}
