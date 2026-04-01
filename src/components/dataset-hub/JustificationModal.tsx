/**
 * Justification Modal for Data Mutations
 * Captures researcher justification before dataset operations execute
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertCircle, Lock } from 'lucide-react'
import type { JustificationCategory } from '@/types/audit'

interface JustificationModalProps {
  isOpen: boolean
  onClose: () => void
  operation: {
    type: string
    impact: string
  }
  onConfirm: (justification: {
    text: string
    category: JustificationCategory
  }) => void
}

const CATEGORIES: Array<{
  value: JustificationCategory
  label: string
}> = [
  { value: 'equipment_failure', label: 'Equipment failure' },
  { value: 'enumerator_error', label: 'Enumerator error' },
  { value: 'exclusion_criteria', label: 'Exclusion criteria' },
  { value: 'protocol_amendment', label: 'Protocol amendment' },
  { value: 'data_entry_error', label: 'Data entry error' },
  { value: 'missing_data_handling', label: 'Missing data handling' },
  { value: 'duplicate_resolution', label: 'Duplicate resolution' },
  { value: 'merge_operation', label: 'Merge operation' },
  { value: 'other', label: 'Other' },
]

const SUGGESTED_TEXT: Record<JustificationCategory, string> = {
  equipment_failure:
    'Variable missingness was attributed to equipment failure during data collection.',
  enumerator_error:
    'Values were identified as likely enumerator error based on implausible value distribution.',
  exclusion_criteria:
    'Rows excluded per pre-specified exclusion criteria defined in the study protocol.',
  protocol_amendment:
    'This change aligns with a protocol amendment approved by the research team.',
  data_entry_error:
    'Data entry error identified and corrected per field quality assurance procedures.',
  missing_data_handling:
    'Missing data handled using multiple imputation as specified in the analysis plan.',
  duplicate_resolution:
    'Duplicate participant entry resolved by retaining the first recorded entry.',
  merge_operation:
    'Files merged to create unified analysis dataset per study data management protocol.',
  other: '',
}

export function JustificationModal({
  isOpen,
  onClose,
  operation,
  onConfirm,
}: JustificationModalProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<JustificationCategory | null>(null)
  const [justificationText, setJustificationText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleUseSuggestedText = () => {
    if (selectedCategory) {
      setJustificationText(SUGGESTED_TEXT[selectedCategory])
    }
  }

  const handleConfirm = async () => {
    if (!selectedCategory || justificationText.length < 20) {
      return
    }
    setLoading(true)
    try {
      await onConfirm({
        text: justificationText,
        category: selectedCategory,
      })
    } finally {
      setLoading(false)
      setJustificationText('')
      setSelectedCategory(null)
    }
  }

  const handleClose = () => {
    if (
      justificationText.length > 0 &&
      !window.confirm(
        'Are you sure? Your operation will not be recorded if you cancel.'
      )
    ) {
      return
    }
    setJustificationText('')
    setSelectedCategory(null)
    onClose()
  }

  const charCount = justificationText.length
  const isValid = selectedCategory && charCount >= 20

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Record Decision
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Operation Summary */}
          <div className="rounded-xl bg-surface-container-low p-4">
            <div className="text-sm font-semibold text-on-surface">
              {operation.type}
            </div>
            <div className="mt-2 font-mono text-sm text-amber-600">
              {operation.impact}
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-3">
              Decision category
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                    selectedCategory === cat.value
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                      : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Justification Text */}
          <div>
            <label className="block text-xs font-bold uppercase text-on-surface-variant mb-2">
              Justification
            </label>
            <textarea
              value={justificationText}
              onChange={(e) => setJustificationText(e.target.value)}
              placeholder="Explain why this decision was made. This will be permanently recorded in the audit trail and will appear in the Data Lineage Certificate."
              className="w-full min-h-24 max-h-48 resize-vertical rounded-lg border border-outline bg-surface p-3 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />

            <div className="mt-2 flex items-center justify-between">
              <div className="text-xs text-on-surface-variant">
                {charCount}/500 characters
                {charCount < 20 && charCount > 0 && (
                  <span className="ml-2 text-error">
                    Minimum 20 characters required
                  </span>
                )}
              </div>

              {selectedCategory && charCount === 0 && (
                <button
                  onClick={handleUseSuggestedText}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Use suggested text →
                </button>
              )}
            </div>
          </div>

          {/* Audit Notice */}
          <div className="flex gap-3 rounded-lg bg-surface-container-low p-3">
            <Lock className="h-4 w-4 flex-shrink-0 text-on-surface-variant mt-0.5" />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              This justification will be permanently recorded and cannot be
              edited after confirmation. It will appear in the Data Lineage
              Certificate for this dataset.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="gap-2"
          >
            {loading ? 'Recording...' : 'Confirm & Record Decision'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
