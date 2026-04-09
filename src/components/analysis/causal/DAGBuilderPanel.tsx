'use client'

/**
 * DAGBuilderPanel — collapsible DAG builder section for the analysis panel.
 *
 * Flow:
 *   1. Researcher selects exposure + outcome from dataset variables
 *   2. "Run Causal Discovery" → PC algorithm runs in background
 *   3. Suggested DAG appears in canvas — researcher reviews edges
 *   4. "Confirm DAG" → adjustment set computed and displayed
 *
 * Integrates with useCausalDAG for all state and API calls.
 * Fully additive — does not modify any existing analysis components.
 */

import { useState, useMemo, useEffect } from 'react'
import { ChevronDown, ChevronRight, GitBranch, Loader2, AlertTriangle, BarChart2, Shield, FileText } from 'lucide-react'
import { useCausalDAG } from '@/hooks/useCausalDAG'
import { useCausalEstimation } from '@/hooks/useCausalEstimation'
import { DAGCanvas } from './DAGCanvas'
import { AdjustmentSetPanel } from './AdjustmentSetPanel'
import { EstimationPanel } from './EstimationPanel'
import { EValuePanel } from './EValuePanel'
import { CausalNarrativePanel } from './CausalNarrativePanel'
import type { DAGEdge, DAGNode, AdjustmentSetResult } from '@/types/causal'

interface DAGBuilderPanelProps {
  projectId: string
  datasetId: string
  versionId: string
  availableVariables: string[]
}

export function DAGBuilderPanel({
  projectId,
  datasetId,
  versionId,
  availableVariables,
}: DAGBuilderPanelProps) {
  const { dag, loading, error, startDiscovery, confirmDAG, resetDAG } = useCausalDAG(
    projectId,
    datasetId
  )

  const {
    results: estimationResults,
    drResult,
    evalue,
    narrative,
    loading: estLoading,
    error: estError,
    allComplete,
    isRunning: estRunning,
    startEstimation,
    computeEvalue,
    generateNarrative,
    pushNarrativeToDocument,
  } = useCausalEstimation(dag?.id ?? null)

  const [expanded, setExpanded] = useState(false)
  const [phaseBTab, setPhaseBTab] = useState<'estimation' | 'evalue' | 'narrative'>('estimation')
  const [exposure, setExposure] = useState('')
  const [outcome, setOutcome] = useState('')
  const [alpha, setAlpha] = useState(0.05)
  const [localEdges, setLocalEdges] = useState<DAGEdge[]>([])
  const [edgeDecisions, setEdgeDecisions] = useState<
    { from: string; to: string; action: string }[]
  >([])
  const [adjustmentResult, setAdjustmentResult] = useState<AdjustmentSetResult | null>(null)

  // Sync local edges when algorithm returns suggested edges
  useEffect(() => {
    if (dag?.status === 'suggested' && dag.suggested_edges?.length > 0) {
      setLocalEdges(dag.suggested_edges)
    }
  }, [dag?.status, dag?.suggested_edges])

  // Build node list from current edges + exposure/outcome
  const nodes: DAGNode[] = useMemo(() => {
    const seen = new Set<string>()
    const result: DAGNode[] = []
    const addNode = (id: string) => {
      if (!id || seen.has(id)) return
      seen.add(id)
      result.push({
        id,
        label: id,
        role:
          id === exposure ? 'exposure' : id === outcome ? 'outcome' : 'covariate',
      })
    }
    if (exposure) addNode(exposure)
    if (outcome) addNode(outcome)
    localEdges.forEach((e) => { addNode(e.from); addNode(e.to) })
    return result
  }, [localEdges, exposure, outcome])

  const handleEdgeAction = (edge: DAGEdge, action: 'accept' | 'reverse' | 'remove') => {
    setEdgeDecisions((prev) => [...prev, { from: edge.from, to: edge.to, action }])
    if (action === 'remove') {
      setLocalEdges((prev) =>
        prev.filter((e) => !(e.from === edge.from && e.to === edge.to))
      )
    } else if (action === 'reverse') {
      setLocalEdges((prev) =>
        prev.map((e) =>
          e.from === edge.from && e.to === edge.to
            ? { ...e, from: e.to, to: e.from, user_action: 'reversed' as const }
            : e
        )
      )
    } else {
      setLocalEdges((prev) =>
        prev.map((e) =>
          e.from === edge.from && e.to === edge.to
            ? { ...e, user_action: 'accepted' as const }
            : e
        )
      )
    }
  }

  const handleEdgeAdd = (from: string, to: string) => {
    // Prevent duplicate edges
    if (localEdges.some((e) => e.from === from && e.to === to)) return
    const newEdge: DAGEdge = {
      from,
      to,
      confidence: 1.0,
      direction_certain: true,
      involves_exposure: from === exposure || to === exposure,
      involves_outcome: from === outcome || to === outcome,
      user_action: 'added',
    }
    setLocalEdges((prev) => [...prev, newEdge])
    setEdgeDecisions((prev) => [...prev, { from, to, action: 'added' }])
  }

  const handleStart = async () => {
    if (!exposure || !outcome) return
    setAdjustmentResult(null)
    setEdgeDecisions([])
    setLocalEdges([])
    await startDiscovery({
      versionId,
      exposure,
      outcome,
      variableColumns: availableVariables,
      alpha,
    })
  }

  const handleConfirm = async () => {
    const result = await confirmDAG(localEdges, edgeDecisions)
    if (result) setAdjustmentResult(result)
  }

  const handleReset = () => {
    resetDAG()
    setLocalEdges([])
    setEdgeDecisions([])
    setAdjustmentResult(null)
  }

  const algorithmWarnings = dag?.algorithm_params?.warnings ?? []
  const isRunning = dag?.status === 'pending' || (loading && !dag)
  const hasSuggestion = dag?.status === 'suggested' || dag?.status === 'confirmed'
  const isConfirmed = dag?.status === 'confirmed'

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <GitBranch className="w-4 h-4 text-indigo-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Causal Inference</p>
            <p className="text-xs text-gray-400">
              {isConfirmed
                ? `DAG confirmed · ${dag.adjustment_set?.length ?? 0} adjustment variable(s)`
                : hasSuggestion
                ? 'Suggested DAG ready for review'
                : isRunning
                ? 'Running PC algorithm…'
                : 'Build a causal DAG and compute adjustment sets'}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="bg-white border-t border-gray-100 p-5 space-y-5">
          {/* Step 1: Variable selection */}
          {!hasSuggestion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Exposure variable
                  </label>
                  <select
                    value={exposure}
                    onChange={(e) => setExposure(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    disabled={isRunning}
                  >
                    <option value="">Select variable…</option>
                    {availableVariables
                      .filter((v) => v !== outcome)
                      .map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Outcome variable
                  </label>
                  <select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    disabled={isRunning}
                  >
                    <option value="">Select variable…</option>
                    {availableVariables
                      .filter((v) => v !== exposure)
                      .map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                    Alpha (α)
                  </label>
                  <select
                    value={alpha}
                    onChange={(e) => setAlpha(Number(e.target.value))}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    disabled={isRunning}
                  >
                    <option value={0.01}>0.01 (strict)</option>
                    <option value={0.05}>0.05 (standard)</option>
                    <option value={0.10}>0.10 (lenient)</option>
                  </select>
                </div>

                <button
                  onClick={handleStart}
                  disabled={!exposure || !outcome || isRunning}
                  className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Running…
                    </>
                  ) : (
                    'Run Causal Discovery'
                  )}
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Pending state */}
          {isRunning && (
            <div className="flex items-center gap-3 text-sm text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              Running PC algorithm — this may take a moment for large datasets…
            </div>
          )}

          {/* Algorithm warnings */}
          {algorithmWarnings.length > 0 && (
            <div className="space-y-1">
              {algorithmWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2 border border-amber-100">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}

          {/* Step 2 & 3: DAG canvas */}
          {hasSuggestion && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">
                  {isConfirmed ? 'Confirmed DAG' : 'Suggested DAG — review and edit edges below'}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {localEdges.length} edge{localEdges.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={handleReset}
                    className="text-xs text-gray-400 hover:text-gray-600 underline"
                  >
                    Start over
                  </button>
                </div>
              </div>

              <DAGCanvas
                nodes={nodes}
                edges={localEdges}
                exposure={exposure || dag?.exposure_variable || ''}
                outcome={outcome || dag?.outcome_variable || ''}
                onEdgeAction={handleEdgeAction}
                onEdgeAdd={handleEdgeAdd}
                readOnly={isConfirmed}
              />

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-0.5 bg-gray-400" />
                  Directed (certain)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 h-0.5 bg-amber-400" style={{ borderTop: '2px dashed' }} />
                  Undirected (uncertain)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full border-2 border-blue-500 inline-block" />
                  Exposure
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full border-2 border-emerald-500 inline-block" />
                  Outcome
                </span>
                {!isConfirmed && (
                  <span className="text-gray-300">Click an edge to accept / reverse / remove</span>
                )}
              </div>

              {/* Confirm button */}
              {!isConfirmed && (
                <button
                  onClick={handleConfirm}
                  disabled={loading || localEdges.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {loading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Computing…</>
                  ) : (
                    'Confirm DAG & Compute Adjustment Set'
                  )}
                </button>
              )}
            </div>
          )}

          {/* Step 4: Adjustment set */}
          {adjustmentResult && (
            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Adjustment Set Results
              </p>
              <AdjustmentSetPanel
                result={adjustmentResult}
                exposure={dag?.exposure_variable ?? exposure}
                outcome={dag?.outcome_variable ?? outcome}
              />
            </div>
          )}

          {/* Show previously stored adjustment set if already confirmed */}
          {isConfirmed && !adjustmentResult && dag.adjustment_set && (
            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Stored Adjustment Set
              </p>
              <div className="flex flex-wrap gap-2">
                {dag.adjustment_set.map((v) => (
                  <span
                    key={v}
                    className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium font-mono"
                  >
                    {v}
                  </span>
                ))}
                {dag.adjustment_set.length === 0 && (
                  <span className="text-xs text-gray-400 italic">No adjustment needed</span>
                )}
              </div>
            </div>
          )}

          {/* ── Phase B: Estimation, E-value, Narrative ── */}
          {isConfirmed && (
            <div className="border-t border-gray-100 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Causal Estimation</p>
                {!estRunning && estimationResults.length === 0 && (
                  <button
                    onClick={() => startEstimation(datasetId, versionId)}
                    disabled={estLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    {estLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart2 className="w-3.5 h-3.5" />}
                    Run PSM · IPW · Doubly Robust
                  </button>
                )}
              </div>

              {estError && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {estError}
                </div>
              )}

              {estimationResults.length > 0 && (
                <>
                  {/* Phase B tab bar */}
                  <div className="flex items-center gap-0 border-b border-gray-100">
                    {([
                      { key: 'estimation', label: 'Results', icon: <BarChart2 className="w-3.5 h-3.5" /> },
                      { key: 'evalue',     label: 'Sensitivity', icon: <Shield className="w-3.5 h-3.5" /> },
                      { key: 'narrative',  label: 'Narrative', icon: <FileText className="w-3.5 h-3.5" /> },
                    ] as const).map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setPhaseBTab(tab.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                          phaseBTab === tab.key
                            ? 'border-indigo-500 text-indigo-600'
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {tab.icon}{tab.label}
                      </button>
                    ))}
                  </div>

                  {phaseBTab === 'estimation' && (
                    <EstimationPanel
                      results={estimationResults}
                      exposure={dag.exposure_variable}
                      outcome={dag.outcome_variable}
                    />
                  )}

                  {phaseBTab === 'evalue' && (
                    <div className="space-y-3">
                      {!evalue && drResult?.status === 'complete' && (
                        <button
                          onClick={() => computeEvalue(
                            drResult.ate!,
                            drResult.ate_ci_lower,
                            drResult.ate_ci_upper,
                          )}
                          disabled={estLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {estLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                          Compute E-value
                        </button>
                      )}
                      {!drResult || drResult.status !== 'complete' ? (
                        <p className="text-xs text-gray-400 italic">
                          Doubly robust estimation must complete first.
                        </p>
                      ) : evalue ? (
                        <EValuePanel result={evalue} />
                      ) : null}
                    </div>
                  )}

                  {phaseBTab === 'narrative' && (
                    <div className="space-y-3">
                      {!narrative && (
                        <button
                          onClick={generateNarrative}
                          disabled={estLoading || !allComplete}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {estLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                          Generate Results Paragraph
                        </button>
                      )}
                      {!allComplete && !narrative && (
                        <p className="text-xs text-gray-400 italic">
                          All three estimation methods must complete first.
                        </p>
                      )}
                      {narrative && (
                        <CausalNarrativePanel
                          narrative={narrative}
                          projectId={projectId}
                          onPushToDocument={pushNarrativeToDocument}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
