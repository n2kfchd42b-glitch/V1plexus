"use client"

import React, { useState, useEffect } from 'react'
import { FlaskConical } from 'lucide-react'
import type { StudyDesign, ResearchContext } from '@/types/analysisIntegrity'

const STUDY_DESIGNS: { value: StudyDesign; label: string }[] = [
  { value: 'cross_sectional', label: 'Cross-Sectional Survey' },
  { value: 'cohort',          label: 'Cohort Study' },
  { value: 'case_control',    label: 'Case-Control Study' },
  { value: 'rct',             label: 'Randomised Controlled Trial' },
  { value: 'time_series',     label: 'Time-Series / Longitudinal' },
  { value: 'meta_analysis',   label: 'Meta-Analysis / Systematic Review' },
  { value: 'other',           label: 'Other / Not sure' },
]

interface Props {
  isOpen: boolean
  columns: string[]
  onConfirm: (ctx: ResearchContext) => void
  onSkip: () => void
  initialValues?: ResearchContext | null
}

const CHEVRON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`

const selectStyle: React.CSSProperties = {
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  backgroundImage: CHEVRON_SVG,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: '32px',
  cursor: 'pointer',
}

export function ResearchDesignModal({ isOpen, columns, onConfirm, onSkip, initialValues }: Props) {
  const [design, setDesign] = useState<StudyDesign | ''>(initialValues?.study_design ?? '')
  const [question, setQuestion] = useState(initialValues?.research_question ?? '')
  const [outcome, setOutcome] = useState(initialValues?.outcome_variable ?? '')
  const [exposure, setExposure] = useState(initialValues?.exposure_variable ?? '')

  // Sync when initialValues change (e.g. opening to edit a different context)
  useEffect(() => {
    setDesign(initialValues?.study_design ?? '')
    setQuestion(initialValues?.research_question ?? '')
    setOutcome(initialValues?.outcome_variable ?? '')
    setExposure(initialValues?.exposure_variable ?? '')
  }, [initialValues])

  if (!isOpen) return null

  const canConfirm = design !== ''

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({
      study_design: design as StudyDesign,
      research_question: question.trim(),
      outcome_variable: outcome || null,
      exposure_variable: exposure || null,
    })
  }

  const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(24,24,27,0.45)' }}
    >
      <div
        className="rounded-xl overflow-hidden animate-scale-in"
        style={{
          width: '380px',
          maxWidth: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-default)',
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--accent-blue-subtle)',
              border: '1px solid var(--border-status-info)',
            }}
          >
            <FlaskConical className="h-3.5 w-3.5" style={{ color: 'var(--accent-blue)' }} />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {initialValues ? 'Edit Research Context' : 'Research Context'}
            </p>
            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
              Tailors assumption checks and sensitivity analysis
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 space-y-3.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {/* Study design */}
          <div className="pt-4">
            <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>
              Study design <span style={{ color: 'var(--status-error)' }}>*</span>
            </label>
            <select
              value={design}
              onChange={e => setDesign(e.target.value as StudyDesign)}
              className="w-full text-xs px-3 py-2.5 rounded-lg appearance-none transition-colors"
              style={{
                ...selectStyle,
                color: design ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
            >
              <option value="" disabled>Select a design…</option>
              {STUDY_DESIGNS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Outcome variable */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>
              Outcome variable{' '}
              <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            {columns.length > 0 ? (
              <select
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-lg appearance-none transition-colors"
                style={{ ...selectStyle, color: outcome ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
              >
                <option value="">None selected</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={outcome}
                onChange={e => setOutcome(e.target.value)}
                placeholder="e.g. malaria_infection"
                className="w-full text-xs px-3 py-2.5 rounded-lg"
                style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-sans)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
              />
            )}
          </div>

          {/* Exposure variable */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>
              Exposure / predictor{' '}
              <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            {columns.length > 0 ? (
              <select
                value={exposure}
                onChange={e => setExposure(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-lg appearance-none transition-colors"
                style={{ ...selectStyle, color: exposure ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
              >
                <option value="">None selected</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={exposure}
                onChange={e => setExposure(e.target.value)}
                placeholder="e.g. bednet_use"
                className="w-full text-xs px-3 py-2.5 rounded-lg"
                style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-sans)' }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
              />
            )}
          </div>

          {/* Research question */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={labelStyle}>
              Research question{' '}
              <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>(optional)</span>
            </label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={2}
              placeholder="e.g. Does bed net use reduce malaria infection in children under 5?"
              className="w-full text-xs px-3 py-2.5 rounded-lg resize-none"
              style={{
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                lineHeight: '1.5',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)' }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onSkip}
              className="text-xs font-medium transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              Skip for now
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white active:scale-[0.98] transition-all"
              style={{
                background: canConfirm ? 'var(--accent-blue)' : 'var(--border-strong)',
                cursor: canConfirm ? 'pointer' : 'not-allowed',
                opacity: canConfirm ? 1 : 0.6,
              }}
              onMouseEnter={e => { if (canConfirm) e.currentTarget.style.background = 'var(--accent-blue-hover)' }}
              onMouseLeave={e => { if (canConfirm) e.currentTarget.style.background = 'var(--accent-blue)' }}
            >
              {initialValues ? 'Save changes' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
