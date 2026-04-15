"use client"

import { useState } from 'react'
import { ArrowLeft, Compass, Play } from 'lucide-react'
import { AnalysisTypeGrid } from './AnalysisTypeGrid'
import { DecisionVariableSelector } from './DecisionVariableSelector'
import { ANALYSIS_REGISTRY } from '@/lib/decision-engine/analysisRegistry'
import { buildBackendConfig, ANALYSIS_TYPE_MAPPING } from '@/lib/decision-engine/index'
import type { AnalysisTypeId, EngineColumnSchema, AnalysisConfig, DatasetContext } from '@/lib/decision-engine/types'

interface Props {
  dataset: DatasetContext
  schema: EngineColumnSchema[]
  preselectedType?: AnalysisTypeId
  onRunAnalysis: (backendType: string, backendConfig: Record<string, unknown>) => void
  onSwitchToGuided: () => void
  onBack: () => void
}

export function DirectFlow({ dataset, schema, preselectedType, onRunAnalysis, onSwitchToGuided, onBack }: Props) {
  const [selectedType, setSelectedType] = useState<AnalysisTypeId | null>(preselectedType ?? null)
  const [outcome, setOutcome] = useState<EngineColumnSchema | null>(null)
  const [exposure, setExposure] = useState<EngineColumnSchema | null>(null)
  const [covariates, setCovariates] = useState<EngineColumnSchema[]>([])
  const [timeVar, setTimeVar] = useState<EngineColumnSchema | null>(null)
  const [eventVar, setEventVar] = useState<EngineColumnSchema | null>(null)
  const [groupVar, setGroupVar] = useState<EngineColumnSchema | null>(null)
  const [confidenceLevel, setConfidenceLevel] = useState<0.90 | 0.95 | 0.99>(0.95)

  const meta = selectedType ? ANALYSIS_REGISTRY[selectedType] : null
  const isSurvival = selectedType === 'kaplan_meier' || selectedType === 'cox_ph'
  const isCorrelation = selectedType === 'pearson_correlation' || selectedType === 'spearman_correlation'
  const isCategorical = selectedType === 'chi_square' || selectedType === 'fisher_exact'
  const needsGrouping = meta?.requires_grouping ?? false

  // Determine if run button should be enabled
  const canRun = (() => {
    if (!selectedType) return false
    if (selectedType === 'descriptive_statistics') return true
    if (selectedType === 'prevalence_estimation') return !!outcome
    if (isSurvival) return !!timeVar && !!eventVar
    if (isCorrelation || isCategorical) return !!outcome && !!exposure
    if (needsGrouping) return !!outcome && !!(exposure ?? groupVar)
    return !!outcome
  })()

  const handleRun = () => {
    if (!selectedType) return

    const config: AnalysisConfig = {
      analysis_type: selectedType,
      dataset_id: dataset.dataset_id,
      version_id: dataset.version_id,
      outcome_variable: outcome?.name ?? null,
      exposure_variable: exposure?.name ?? null,
      covariate_variables: covariates.map(c => c.name),
      time_variable: timeVar?.name ?? null,
      event_variable: eventVar?.name ?? null,
      group_variable: groupVar?.name ?? null,
      confidence_level: confidenceLevel,
      reference_category: 'first',
    }

    const backendType = ANALYSIS_TYPE_MAPPING[selectedType]
    const backendConfig = buildBackendConfig(config)
    onRunAnalysis(backendType, backendConfig)
  }

  const excluded = [outcome, exposure, ...covariates, timeVar, eventVar, groupVar]
    .filter(Boolean)
    .map(v => v!.name)

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-row)', background: 'var(--bg-surface)' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="h-7 w-7 flex items-center justify-center rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-row-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Choose Analysis
          </span>
        </div>
        <button
          onClick={onSwitchToGuided}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-row-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '' }}
        >
          <Compass className="h-3.5 w-3.5" />
          Guide me instead
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Analysis type grid */}
        <div>
          <p className="subsection-label mb-2">Analysis Type</p>
          <AnalysisTypeGrid selectedType={selectedType} onSelect={setSelectedType} />
        </div>

        {/* Configuration panel — shown when a type is selected */}
        {selectedType && meta && (
          <div
            className="rounded-xl p-4 space-y-4"
            style={{
              background: 'var(--bg-app)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                {meta.icon} {meta.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {meta.when_to_use}
              </p>
            </div>

            {/* Survival variables */}
            {isSurvival && (
              <>
                <DecisionVariableSelector
                  label="Time Variable"
                  required
                  schema={schema}
                  allowedTypes={['continuous', 'date']}
                  value={timeVar}
                  onChange={setTimeVar}
                  row_count={dataset.row_count}
                  excludeNames={excluded.filter(n => n !== timeVar?.name)}
                />
                <DecisionVariableSelector
                  label="Event Indicator (1=event, 0=censored)"
                  required
                  schema={schema}
                  allowedTypes={['binary', 'continuous']}
                  value={eventVar}
                  onChange={setEventVar}
                  row_count={dataset.row_count}
                  excludeNames={excluded.filter(n => n !== eventVar?.name)}
                />
                {selectedType === 'kaplan_meier' && (
                  <DecisionVariableSelector
                    label="Group Variable (optional)"
                    schema={schema}
                    allowedTypes={['binary', 'categorical']}
                    value={groupVar}
                    onChange={setGroupVar}
                    placeholder="Leave empty for single curve"
                    row_count={dataset.row_count}
                    excludeNames={excluded.filter(n => n !== groupVar?.name)}
                  />
                )}
                {selectedType === 'cox_ph' && (
                  <DecisionVariableSelector
                    label="Exposure / Primary Predictor"
                    schema={schema}
                    allowedTypes={['binary', 'categorical', 'continuous']}
                    value={exposure}
                    onChange={setExposure}
                    row_count={dataset.row_count}
                    excludeNames={excluded.filter(n => n !== exposure?.name)}
                  />
                )}
              </>
            )}

            {/* Correlation + categorical pair */}
            {(isCorrelation || isCategorical) && (
              <>
                <DecisionVariableSelector
                  label={isCategorical ? 'Variable 1 (Outcome)' : 'Variable 1'}
                  required
                  schema={schema}
                  allowedTypes={meta.outcome_types.length > 0 ? meta.outcome_types : undefined}
                  value={outcome}
                  onChange={setOutcome}
                  row_count={dataset.row_count}
                  excludeNames={excluded.filter(n => n !== outcome?.name)}
                />
                <DecisionVariableSelector
                  label={isCategorical ? 'Variable 2 (Exposure)' : 'Variable 2'}
                  required
                  schema={schema}
                  allowedTypes={meta.predictor_types.length > 0 ? meta.predictor_types : undefined}
                  value={exposure}
                  onChange={setExposure}
                  row_count={dataset.row_count}
                  excludeNames={excluded.filter(n => n !== exposure?.name)}
                />
              </>
            )}

            {/* Standard outcome + exposure */}
            {!isSurvival && !isCorrelation && !isCategorical && (
              <>
                {selectedType !== 'descriptive_statistics' && (
                  <DecisionVariableSelector
                    label="Outcome Variable"
                    required
                    schema={schema}
                    allowedTypes={meta.outcome_types.length > 0 ? meta.outcome_types : undefined}
                    value={outcome}
                    onChange={setOutcome}
                    row_count={dataset.row_count}
                    excludeNames={excluded.filter(n => n !== outcome?.name)}
                  />
                )}
                {selectedType !== 'prevalence_estimation' && selectedType !== 'descriptive_statistics' && (
                  <DecisionVariableSelector
                    label={needsGrouping ? 'Group Variable' : 'Exposure / Predictor'}
                    required={needsGrouping}
                    schema={schema}
                    allowedTypes={meta.predictor_types.length > 0 ? meta.predictor_types : undefined}
                    value={exposure}
                    onChange={setExposure}
                    row_count={dataset.row_count}
                    excludeNames={excluded.filter(n => n !== exposure?.name)}
                  />
                )}
                {/* Covariates — only for regression types */}
                {(['logistic_regression', 'linear_regression', 'poisson_regression'] as AnalysisTypeId[]).includes(selectedType) && (
                  <div>
                    <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      Covariates (optional)
                    </p>
                    <div className="space-y-2">
                      {covariates.map((cov, i) => (
                        <div key={cov.name} className="flex items-center gap-2">
                          <div className="flex-1">
                            <DecisionVariableSelector
                              label={`Covariate ${i + 1}`}
                              schema={schema}
                              value={cov}
                              onChange={v => {
                                const next = [...covariates]
                                if (v) next[i] = v
                                else next.splice(i, 1)
                                setCovariates(next)
                              }}
                              row_count={dataset.row_count}
                              excludeNames={excluded.filter(n => n !== cov.name)}
                            />
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const next = schema.find(
                            col => !excluded.includes(col.name) && col.type !== 'id' && col.type !== 'text',
                          )
                          if (next) setCovariates(prev => [...prev, next])
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-md transition-colors"
                        style={{ color: 'var(--accent-blue)', background: 'var(--accent-blue-subtle)', border: '1px solid var(--border-status-info)' }}
                      >
                        + Add covariate
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Confidence level */}
            {!isCategorical && selectedType !== 'descriptive_statistics' && (
              <div>
                <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Confidence Level
                </p>
                <div className="flex gap-2">
                  {([0.90, 0.95, 0.99] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setConfidenceLevel(lvl)}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                      style={{
                        background: confidenceLevel === lvl ? 'var(--accent-blue)' : 'var(--bg-surface)',
                        color: confidenceLevel === lvl ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${confidenceLevel === lvl ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                      }}
                    >
                      {Math.round(lvl * 100)}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STROBE note */}
            <p className="text-[11px] rounded-md px-3 py-2" style={{ background: 'var(--accent-blue-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-status-info)' }}>
              STROBE items {meta.reporting_guideline} will be auto-populated in the results.
            </p>
          </div>
        )}
      </div>

      {/* Footer run bar */}
      {selectedType && (
        <div
          className="flex-shrink-0 px-4 py-3 border-t flex items-center gap-3"
          style={{ borderColor: 'var(--border-row)', background: 'var(--bg-surface)' }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
              {meta?.name} · {dataset.dataset_name}
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
          >
            <Play className="h-3 w-3" />
            Run Analysis
          </button>
        </div>
      )}
    </div>
  )
}
