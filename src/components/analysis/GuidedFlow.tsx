"use client"

import { useMemo } from 'react'
import { useLocale } from '@/i18n/LocaleProvider'
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
  paired: boolean
  confidenceLevel: 0.90 | 0.95 | 0.99
  canAnalyse: boolean
  onRunWorkflow: (steps: ExecutableWorkflowStep[]) => void
  onRunAlternative: (id: AnalysisTypeId) => void
  onSwitchToDirect: (preselectedType?: AnalysisTypeId) => void
  onBack: () => void
}

export function GuidedFlow({
  dataset,
  intent, onIntentChange,
  outcome, exposure, covariates, timeVar, eventVar, groupVar, stratVar,
  paired,
  confidenceLevel,
  canAnalyse,
  onRunWorkflow, onRunAlternative, onSwitchToDirect,
}: Props) {
  const { t } = useLocale()

  // Live recommendation — recomputed automatically as the research question and
  // variable selections change. No "find approach" button, no artificial delay:
  // the engine is deterministic and instant, so guidance is always in sync.
  const recommendation = useMemo<AnalysisRecommendation | null>(() => {
    if (!intent || !canAnalyse) return null
    const variables: VariableSelection = {
      outcome, exposure, covariates,
      time_variable: timeVar,
      event_variable: eventVar,
      group_variable: groupVar,
      strat_variable: stratVar,
    }
    return getRecommendation(intent, variables, dataset, confidenceLevel, paired)
  }, [intent, canAnalyse, outcome, exposure, covariates, timeVar, eventVar, groupVar, stratVar, dataset, confidenceLevel, paired])

  const handleRun = () => {
    if (!recommendation) return
    onRunWorkflow(buildExecutableWorkflow(recommendation))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Body — the unified studio's compose header (Assist/Pick/Code) is owned by the parent */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        <div>
          <p className="subsection-label mb-2">{t('guidedFlow.researchQuestion')}</p>
          <IntentSelector value={intent} onChange={onIntentChange} />
        </div>

        {intent && !canAnalyse && (
          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
            style={{ background: 'var(--accent-blue-subtle)', border: '1px solid var(--border-status-info)', color: 'var(--text-secondary)' }}
          >
            <span className="flex-shrink-0 mt-0.5">←</span>
            <span>{t('guidedFlow.selectVarsHint')}</span>
          </div>
        )}

        {recommendation && (
          <div>
            <p className="subsection-label mb-3">{t('guidedFlow.recommendation')}</p>
            <RecommendationCard
              recommendation={recommendation}
              onRun={handleRun}
              onConfigureManually={() => onSwitchToDirect(recommendation.primary)}
              onRunAlternative={onRunAlternative}
            />
          </div>
        )}
      </div>
    </div>
  )
}
