import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AssumptionCheckResult, AssumptionCheck } from '@/types/analysisIntegrity'

interface AssumptionCheckModalProps {
  isOpen: boolean
  onClose: () => void
  checkResult: AssumptionCheckResult
  analysisType: string
  onProceed: (notes: Record<string, string>) => Promise<void>
  onCancel: () => void
}

export function AssumptionCheckModal({
  isOpen,
  onClose,
  checkResult,
  analysisType,
  onProceed,
  onCancel,
}: AssumptionCheckModalProps) {
  const [acknowledgementNotes, setAcknowledgementNotes] = useState<
    Record<string, string>
  >({})
  const [acknowledged, setAcknowledged] = useState(false)
  const [loading, setLoading] = useState(false)

  // useMemo before conditional return (Rules of Hooks)
  const sortedChecks = useMemo(() => {
    const checks = Array.isArray(checkResult.checks) ? checkResult.checks : []
    const priorityMap: Record<string, number> = {
      violated_critical: 0,
      violated_moderate: 1,
      violated_minor: 2,
      warning_critical: 3,
      warning_moderate: 3,
      warning_minor: 3,
      not_applicable_critical: 4,
      not_applicable_moderate: 4,
      not_applicable_minor: 4,
      passed_critical: 5,
      passed_moderate: 5,
      passed_minor: 5,
    }
    return [...checks].sort((a, b) => {
      const aKey = `${a.status}_${a.severity}`
      const bKey = `${b.status}_${b.severity}`
      return (priorityMap[aKey] ?? 99) - (priorityMap[bKey] ?? 99)
    })
  }, [checkResult.checks])

  if (!isOpen) return null

  // Python backend may return null/omit checks on error paths — normalize to safe array
  const safeChecks: AssumptionCheck[] = Array.isArray(checkResult.checks) ? checkResult.checks : []

  // Determine recommendation color
  const recommendationStyles = {
    proceed: {
      bg: 'bg-green-50',
      text: 'text-green-900',
      icon: '✓',
      title: 'All assumptions satisfied — ready to proceed',
    },
    proceed_with_caution: {
      bg: 'bg-amber-50',
      text: 'text-amber-900',
      icon: '⚠',
      title: 'Assumption violations detected — review before proceeding',
    },
    consider_alternatives: {
      bg: 'bg-red-50',
      text: 'text-red-900',
      icon: '✗',
      title: 'Critical violations detected — consider alternative tests',
    },
  }

  const styles = recommendationStyles[checkResult.run_recommendation]

  // Use backend counts as fallback — checks array may be empty even when violations exist
  const hasViolations =
    checkResult.critical_violations > 0 ||
    checkResult.moderate_violations > 0 ||
    checkResult.minor_violations > 0 ||
    safeChecks.some((c) => c.status === 'violated' || c.status === 'warning')
  const canProceed = !hasViolations || acknowledged

  const handleProceed = async () => {
    setLoading(true)
    try {
      await onProceed(acknowledgementNotes)
    } finally {
      setLoading(false)
    }
  }

  // PASSED STATE: simplified view
  if (checkResult.all_passed && !checkResult.requires_acknowledgement) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-[520px] mx-4 rounded-2xl">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-2xl text-green-600">✓</span>
              </div>
            </div>
            {safeChecks.length === 0 ? (
              <>
                <h2 className="font-bold text-xl mb-2">Assumption checks unavailable</h2>
                <p className="text-sm text-gray-600 mb-6">
                  No assumption checks were run for this analysis. You may proceed, but statistical assumptions have not been verified.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-bold text-xl mb-2">All assumptions satisfied</h2>
                <p className="text-sm text-gray-600 mb-6">
                  Your analysis configuration passed all assumption checks.
                </p>
              </>
            )}

            {/* Brief passed checks list */}
            {safeChecks.length > 0 && (
              <div className="mb-8 space-y-2 max-h-24 overflow-y-auto">
                {safeChecks.slice(0, 3).map((check, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="text-green-600">✓</span>
                    <span className="text-gray-700">{check.assumption_name}</span>
                  </div>
                ))}
                {safeChecks.length > 3 && (
                  <div className="text-xs text-gray-500 pt-2">
                    + {safeChecks.length - 3} more
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleProceed}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Running...' : 'Run Analysis →'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // VIOLATION REVIEW STATE: full modal
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-[680px] mx-4 rounded-2xl max-h-[88vh] flex flex-col">
        {/* HEADER */}
        <CardHeader className="pb-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm text-primary-600">◇</span>
                </div>
                <CardTitle className="text-base">
                  Statistical Assumption Check
                </CardTitle>
              </div>
              <p className="text-xs text-gray-600">
                {analysisType.replace(/_/g, ' ')} · {safeChecks.length}{' '}
                checks
              </p>
            </div>
            <button
              onClick={() => {
                onCancel()
                onClose()
              }}
              className="text-2xl text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </CardHeader>

        {/* RECOMMENDATION BANNER */}
        <div className={`${styles.bg} px-8 py-4 border-none`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={styles.text}>{styles.icon}</span>
            <p className={`font-semibold text-sm ${styles.text}`}>
              {styles.title}
            </p>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {checkResult.critical_violations > 0 && (
              <Badge variant="destructive" className="text-xs">
                {checkResult.critical_violations} Critical
              </Badge>
            )}
            {checkResult.moderate_violations > 0 && (
              <Badge variant="warning" className="text-xs">
                {checkResult.moderate_violations} Moderate
              </Badge>
            )}
            {checkResult.minor_violations > 0 && (
              <Badge variant="outline" className="text-xs">
                {checkResult.minor_violations} Minor
              </Badge>
            )}
            <Badge
              variant="success"
              className="text-xs"
            >
              {safeChecks.length - checkResult.critical_violations - checkResult.moderate_violations - checkResult.minor_violations - checkResult.not_applicable_count}{' '}
              Passed
            </Badge>
            {checkResult.not_applicable_count > 0 && (
              <Badge variant="default" className="text-xs">
                {checkResult.not_applicable_count} Not Applicable
              </Badge>
            )}
          </div>
        </div>

        {/* CHECKS LIST */}
        <CardContent className="flex-1 overflow-y-auto py-6">
          <div className="space-y-3">
            {sortedChecks.map((check, idx) => (
              <AssumptionCheckCard
                key={idx}
                check={check}
              />
            ))}
          </div>
        </CardContent>

        {/* FOOTER */}
        <div className="border-t border-gray-200 bg-gray-50 rounded-0 rounded-b-2xl px-8 py-5">
          {hasViolations && (
            <label className="flex items-start gap-3 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded flex-shrink-0"
              />
              <span className="text-xs text-gray-700 leading-relaxed">
                I have reviewed the assumption check results and understand the implications for my analysis.
              </span>
            </label>
          )}
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => {
                  onCancel()
                  onClose()
                }}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Analysis will not run
              </p>
            </div>

            <Button
              onClick={handleProceed}
              disabled={!canProceed || loading}
              variant={
                checkResult.run_recommendation === 'consider_alternatives'
                  ? 'secondary'
                  : 'default'
              }
              className="ml-3"
            >
              {loading
                ? 'Processing...'
                : checkResult.run_recommendation === 'consider_alternatives'
                  ? 'Proceed Anyway'
                  : 'Run Analysis →'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

// Individual assumption check card component
interface AssumptionCheckCardProps {
  check: AssumptionCheck
}

function AssumptionCheckCard({ check }: AssumptionCheckCardProps) {
  const statusIcon = {
    passed: <span className="w-5 h-5 rounded-full bg-green-100 border border-green-600 flex items-center justify-center text-xs text-green-600">✓</span>,
    violated: {
      critical: <span className="w-5 h-5 rounded-full bg-red-100 border border-red-600 flex items-center justify-center text-xs text-red-600">✗</span>,
      moderate: <span className="w-5 h-5 text-amber-600 text-lg">⚠</span>,
      minor: <span className="w-5 h-5 text-gray-600 text-lg">⚠</span>,
    },
    warning: <span className="w-5 h-5 text-amber-600 text-lg">◐</span>,
    not_applicable: <span className="w-5 h-5 rounded-full bg-blue-100 border border-blue-600 flex items-center justify-center text-xs text-blue-600">ℹ</span>,
  }

  const getStatusIcon = () => {
    if (check.status === 'passed') return statusIcon.passed
    if (check.status === 'violated')
      return statusIcon.violated[check.severity as 'critical' | 'moderate' | 'minor']
    if (check.status === 'warning') return statusIcon.warning
    return statusIcon.not_applicable
  }

  const severityColor = {
    critical: 'bg-red-50 text-red-600',
    moderate: 'bg-amber-50 text-amber-600',
    minor: 'bg-gray-100 text-gray-600',
  }

  return (
    <Card className="bg-white border border-gray-200">
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-3 flex-1">
            {getStatusIcon()}
            <div className="flex-1">
              <h3 className="font-bold text-sm text-gray-900">
                {check.assumption_name}
              </h3>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge
              variant={
                check.severity === 'critical'
                  ? 'destructive'
                  : check.severity === 'moderate'
                    ? 'warning'
                    : 'default'
              }
              className="text-xs"
            >
              {check.severity.toUpperCase()}
            </Badge>
            {check.test_used && (
              <Badge variant="outline" className="text-xs font-mono">
                {check.test_used}
              </Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
          {check.description}
        </p>

        {/* Finding box (for violations) */}
        {check.status !== 'passed' && (
          <div className="bg-gray-50 rounded border border-gray-200 p-3 mt-3">
            <div className="text-xs font-bold uppercase text-gray-600 mb-1">
              Finding
            </div>
            <p className="text-xs text-gray-900">{check.finding}</p>
            {check.statistic !== null && check.p_value !== null && (
              <p className="text-xs font-mono text-gray-600 mt-1">
                Statistic: {check.statistic.toFixed(4)} · p-value:{' '}
                {check.p_value.toFixed(4)}
              </p>
            )}
          </div>
        )}

        {/* Implication */}
        {check.implication && check.status !== 'passed' && (
          <div className="mt-2 flex items-start gap-2">
            <span className="text-amber-600 text-lg">⚠</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              {check.implication}
            </p>
          </div>
        )}

        {/* Suggested action */}
        {check.suggested_action && (
          <div className="mt-2 flex items-start gap-2">
            <span className="text-primary-600">→</span>
            <p className="text-xs text-primary-600 leading-relaxed">
              {check.suggested_action}
            </p>
          </div>
        )}

        {/* Alternative tests */}
        {check.alternative_tests && check.alternative_tests.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-gray-600 mb-2">
              Consider instead:
            </p>
            <div className="flex flex-wrap gap-2">
              {check.alternative_tests.map((test, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs rounded-full"
                >
                  {test}
                </Badge>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  )
}
