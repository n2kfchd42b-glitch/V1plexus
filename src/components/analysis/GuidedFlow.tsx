"use client"

import { useState } from 'react'
import { ArrowLeft, Zap } from 'lucide-react'
import { IntentSelector } from './IntentSelector'
import { DecisionVariableSelector } from './DecisionVariableSelector'
import { RecommendationCard } from './RecommendationCard'
import { getRecommendation, buildExecutableWorkflow, ANALYSIS_TYPE_MAPPING, buildBackendConfig } from '@/lib/decision-engine/index'
import type {
  ResearchIntent,
  EngineColumnSchema,
  VariableSelection,
  DatasetContext,
  AnalysisRecommendation,
  AnalysisTypeId,
} from '@/lib/decision-engine/types'
import type { ExecutableWorkflowStep } from '@/lib/decision-engine/index'

type Step = 1 | 2 | 3

const STAGE_LABELS: Record<Step, string> = {
  1: 'Research Question',
  2: 'Variables',
  3: 'Recommendation',
}

interface Props {
  dataset: DatasetContext
  schema: EngineColumnSchema[]
  onRunWorkflow: (steps: ExecutableWorkflowStep[]) => void
  onSwitchToDirect: (preselectedType?: AnalysisTypeId) => void
  onBack: () => void
}

export function GuidedFlow({ dataset, schema, onRunWorkflow, onSwitchToDirect, onBack }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [intent, setIntent] = useState<ResearchIntent | null>(null)
  const [outcome, setOutcome] = useState<EngineColumnSchema | null>(null)
  const [exposure, setExposure] = useState<EngineColumnSchema | null>(null)
  const [covariates, setCovariates] = useState<EngineColumnSchema[]>([])
  const [timeVar, setTimeVar] = useState<EngineColumnSchema | null>(null)
  const [eventVar, setEventVar] = useState<EngineColumnSchema | null>(null)
  const [groupVar, setGroupVar] = useState<EngineColumnSchema | null>(null)
  const [recommendation, setRecommendation] = useState<AnalysisRecommendation | null>(null)
  const [thinking, setThinking] = useState(false)

  const isSurvivalIntent = intent === 'survive'
  const isDescribeIntent = intent === 'describe'
  const isCompareIntent = intent === 'compare'

  const canAnalyse = !!intent && (
    isDescribeIntent ? true :
    isSurvivalIntent ? (!!timeVar && !!eventVar) :
    !!outcome
  )

  const excluded = [outcome, exposure, ...covariates, timeVar, eventVar, groupVar]
    .filter(Boolean)
    .map(v => v!.name)

  const handleFindApproach = async () => {
    if (!intent || !canAnalyse) return

    const variables: VariableSelection = {
      outcome,
      exposure,
      covariates,
      time_variable: timeVar,
      event_variable: eventVar,
      group_variable: groupVar,
    }

    setThinking(true)
    // Intentional 800ms "thinking" animation — signals analysis is happening
    await new Promise(r => setTimeout(r, 800))
    const rec = getRecommendation(intent, variables, dataset)
    setRecommendation(rec)
    setThinking(false)
    setStep(3)
  }

  const handleRun = () => {
    if (!recommendation) return
    const steps = buildExecutableWorkflow(recommendation)
    onRunWorkflow(steps)
  }

  const handleConfigureManually = () => {
    onSwitchToDirect(recommendation?.primary)
  }

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
            Guided Analysis
          </span>
        </div>
        <button
          onClick={() => onSwitchToDirect()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-row-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '' }}
        >
          <Zap className="h-3.5 w-3.5" />
          Choose directly
        </button>
      </div>

      {/* Stage strip */}
      <div
        className="flex items-center gap-0 px-4 py-2 flex-shrink-0 overflow-x-auto"
        style={{ borderBottom: '1px solid var(--border-row)', background: 'var(--bg-app)' }}
      >
        {([1, 2, 3] as Step[]).map((s, idx) => {
          const isDone = step > s
          const isActive = step === s
          return (
            <div key={s} className="flex items-center">
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                style={{
                  background: isActive
                    ? 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))'
                    : isDone
                      ? 'var(--status-success-bg)'
                      : 'transparent',
                  color: isActive
                    ? '#fff'
                    : isDone
                      ? 'var(--status-success-text)'
                      : 'var(--text-tertiary)',
                }}
              >
                {isDone && <span>✓</span>}
                <span>{s}</span>
                <span className="hidden sm:inline">{STAGE_LABELS[s]}</span>
              </div>
              {idx < 2 && (
                <div className="w-6 h-px mx-1" style={{ background: 'var(--border-default)' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Steps 1 + 2 — shown together */}
        {step < 3 && (
          <>
            {/* Intent */}
            <div>
              <p className="subsection-label mb-2">
                1. What is your research question?
              </p>
              <IntentSelector value={intent} onChange={v => { setIntent(v); setStep(1) }} />
            </div>

            {/* Variables — shown once intent is selected */}
            {intent && (
              <div>
                <p className="subsection-label mb-2">
                  2. Select your variables
                </p>
                <div className="space-y-3">

                  {/* Survival intent */}
                  {isSurvivalIntent ? (
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
                      <DecisionVariableSelector
                        label="Exposure / Group Variable (optional)"
                        schema={schema}
                        allowedTypes={['binary', 'categorical']}
                        value={exposure}
                        onChange={setExposure}
                        placeholder="Leave empty for single curve"
                        row_count={dataset.row_count}
                        excludeNames={excluded.filter(n => n !== exposure?.name)}
                      />
                    </>
                  ) : isDescribeIntent ? (
                    <>
                      <DecisionVariableSelector
                        label="Primary Variable (optional)"
                        schema={schema}
                        value={outcome}
                        onChange={setOutcome}
                        placeholder="All variables will be described"
                        row_count={dataset.row_count}
                        excludeNames={excluded.filter(n => n !== outcome?.name)}
                      />
                    </>
                  ) : (
                    <>
                      <DecisionVariableSelector
                        label="Outcome Variable (dependent)"
                        required
                        schema={schema}
                        value={outcome}
                        onChange={setOutcome}
                        row_count={dataset.row_count}
                        excludeNames={excluded.filter(n => n !== outcome?.name)}
                      />
                      <DecisionVariableSelector
                        label={isCompareIntent ? 'Group Variable' : 'Exposure / Predictor (independent)'}
                        schema={schema}
                        value={exposure}
                        onChange={setExposure}
                        row_count={dataset.row_count}
                        excludeNames={excluded.filter(n => n !== exposure?.name)}
                      />
                      {/* Covariates */}
                      {(intent === 'predict' || intent === 'associate') && (
                        <div>
                          <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            Covariates (optional — for adjustment)
                          </p>
                          <div className="space-y-2">
                            {covariates.map((cov, i) => (
                              <DecisionVariableSelector
                                key={cov.name}
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
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const next = schema.find(
                                  col => !excluded.includes(col.name) && col.type !== 'id' && col.type !== 'text',
                                )
                                if (next) setCovariates(prev => [...prev, next])
                              }}
                              className="text-xs px-2.5 py-1.5 rounded-md"
                              style={{ color: 'var(--accent-blue)', background: 'var(--accent-blue-subtle)', border: '1px solid var(--border-status-info)' }}
                            >
                              + Add covariate
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Find approach button */}
            {intent && (
              <button
                onClick={handleFindApproach}
                disabled={!canAnalyse || thinking}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
              >
                {thinking ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"
                    />
                    Finding best statistical approach…
                  </span>
                ) : (
                  'Find Best Statistical Approach →'
                )}
              </button>
            )}
          </>
        )}

        {/* Step 3 — Recommendation */}
        {step === 3 && recommendation && (
          <>
            <div>
              <p className="subsection-label mb-3">3. PLEXUS Recommendation</p>
              <RecommendationCard
                recommendation={recommendation}
                onRun={handleRun}
                onConfigureManually={handleConfigureManually}
              />
            </div>

            {/* Edit selections */}
            <button
              onClick={() => setStep(1)}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              ← Change variable selections
            </button>
          </>
        )}
      </div>
    </div>
  )
}
