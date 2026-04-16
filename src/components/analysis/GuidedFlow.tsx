"use client"

import { useState } from 'react'
import { ArrowLeft, Zap } from 'lucide-react'
import { IntentSelector } from './IntentSelector'
import { RecommendationCard } from './RecommendationCard'
import { getRecommendation, buildExecutableWorkflow } from '@/lib/decision-engine/index'
import type {
  ResearchIntent,
  EngineColumnSchema,
  VariableSelection,
  DatasetContext,
  AnalysisRecommendation,
  AnalysisTypeId,
} from '@/lib/decision-engine/types'
import type { ExecutableWorkflowStep } from '@/lib/decision-engine/index'

interface Props {
  dataset: DatasetContext
  intent: ResearchIntent | null
  onIntentChange: (v: ResearchIntent | null) => void
  outcome: EngineColumnSchema | null
  exposure: EngineColumnSchema | null
  covariates: EngineColumnSchema[]
  timeVar: EngineColumnSchema | null
  eventVar: EngineColumnSchema | null
  groupVar: EngineColumnSchema | null
  stratVar: EngineColumnSchema | null
  canAnalyse: boolean
  recommendation: AnalysisRecommendation | null
  onRecommendation: (rec: AnalysisRecommendation | null) => void
  onRunWorkflow: (steps: ExecutableWorkflowStep[]) => void
  onSwitchToDirect: (preselectedType?: AnalysisTypeId) => void
  onBack: () => void
}

export function GuidedFlow({
  dataset,
  intent, onIntentChange,
  outcome, exposure, covariates, timeVar, eventVar, groupVar, stratVar,
  canAnalyse,
  recommendation, onRecommendation,
  onRunWorkflow, onSwitchToDirect, onBack,
}: Props) {
  const [thinking, setThinking] = useState(false)

  const handleFindApproach = async () => {
    if (!intent || !canAnalyse) return
    const variables: VariableSelection = {
      outcome, exposure, covariates,
      time_variable: timeVar,
      event_variable: eventVar,
      group_variable: groupVar,
      strat_variable: stratVar,
    }
    setThinking(true)
    await new Promise(r => setTimeout(r, 800))
    const rec = getRecommendation(intent, variables, dataset)
    onRecommendation(rec)
    setThinking(false)
  }

  const handleRun = () => {
    if (!recommendation) return
    onRunWorkflow(buildExecutableWorkflow(recommendation))
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
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Guided Analysis</span>
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {!recommendation ? (
          <>
            <div>
              <p className="subsection-label mb-2">What is your research question?</p>
              <IntentSelector
                value={intent}
                onChange={v => { onIntentChange(v); onRecommendation(null) }}
              />
            </div>

            {intent && (
              <>
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
                  style={{ background: 'var(--accent-blue-subtle)', border: '1px solid var(--border-status-info)', color: 'var(--text-secondary)' }}
                >
                  <span className="flex-shrink-0 mt-0.5">←</span>
                  <span>Select your variables in the panel on the left, then find the best approach.</span>
                </div>

                <button
                  onClick={handleFindApproach}
                  disabled={!canAnalyse || thinking}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,var(--color-clinical-deep),var(--color-clinical-blue))' }}
                >
                  {thinking ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Finding best statistical approach…
                    </span>
                  ) : (
                    'Find Best Statistical Approach →'
                  )}
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <div>
              <p className="subsection-label mb-3">PLEXUS Recommendation</p>
              <RecommendationCard
                recommendation={recommendation}
                onRun={handleRun}
                onConfigureManually={() => onSwitchToDirect(recommendation.primary)}
              />
            </div>
            <button
              onClick={() => onRecommendation(null)}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              ← Change selections
            </button>
          </>
        )}
      </div>
    </div>
  )
}
