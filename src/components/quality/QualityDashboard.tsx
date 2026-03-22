'use client'

import { useState, useEffect } from 'react'
import { Plus, Shield, ToggleLeft, ToggleRight, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { QualityScoreCard } from './QualityScoreCard'
import { QualityTrendChart } from './QualityTrendChart'
import { QualityIssueList } from './QualityIssueList'
import { QualityRuleEditor } from './QualityRuleEditor'
import type { DataQualityRule, DataQualityResult, DataQualityScore } from '@/types/database'

interface QualityDashboardProps {
  datasetId: string
  versionId: string
  projectId: string
  columns: string[]
}

export function QualityDashboard({ datasetId, versionId, projectId, columns }: QualityDashboardProps) {
  const supabase = createClient()
  const [rules, setRules] = useState<DataQualityRule[]>([])
  const [results, setResults] = useState<DataQualityResult[]>([])
  const [scores, setScores] = useState<DataQualityScore[]>([])
  const [latestScore, setLatestScore] = useState<DataQualityScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRuleEditor, setShowRuleEditor] = useState(false)
  const [editingRule, setEditingRule] = useState<DataQualityRule | null>(null)

  const load = async () => {
    setLoading(true)
    const [rulesRes, resultsRes, scoresRes] = await Promise.all([
      supabase.from('data_quality_rules').select('*').eq('dataset_id', datasetId).order('created_at'),
      supabase.from('data_quality_results').select('*, rule:data_quality_rules(*)').eq('version_id', versionId),
      supabase.from('data_quality_scores').select('*').eq('dataset_id', datasetId).order('created_at', { ascending: false }).limit(10),
    ])
    setRules((rulesRes.data ?? []) as DataQualityRule[])
    setResults((resultsRes.data ?? []) as DataQualityResult[])
    const allScores = (scoresRes.data ?? []) as DataQualityScore[]
    setScores(allScores)
    setLatestScore(allScores[0] ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [datasetId, versionId])

  const handleToggleRule = async (rule: DataQualityRule) => {
    const { error } = await supabase
      .from('data_quality_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id)
    if (error) { toast.error('Failed to update rule'); return }
    load()
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Delete this rule?')) return
    const { error } = await supabase.from('data_quality_rules').delete().eq('id', ruleId)
    if (error) { toast.error('Failed to delete rule'); return }
    toast.success('Rule deleted')
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-gray-200 border-t-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Score card */}
      {latestScore ? (
        <QualityScoreCard score={latestScore} />
      ) : (
        <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Shield className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No quality checks run yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add rules below and run a quality check to see your score.</p>
        </div>
      )}

      {/* Trend chart */}
      {scores.length >= 2 && <QualityTrendChart scores={scores.slice().reverse()} />}

      {/* Active issues */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Issues</h3>
        <QualityIssueList
          results={results}
          projectId={projectId}
          datasetId={datasetId}
          onUpdated={load}
        />
      </div>

      {/* Rules list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Rules ({rules.length} total, {rules.filter(r => r.is_active).length} active)</h3>
          <Button size="sm" variant="outline" onClick={() => { setEditingRule(null); setShowRuleEditor(true) }} className="text-xs h-7">
            <Plus className="h-3 w-3 mr-1" />Add Rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="text-sm text-gray-400 py-4 text-center">No rules configured. Add rules to start monitoring quality.</div>
        ) : (
          <div className="space-y-1">
            {rules.map(rule => (
              <div key={rule.id} className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-sm">
                <button onClick={() => handleToggleRule(rule)} className="flex-shrink-0">
                  {rule.is_active
                    ? <ToggleRight className="h-4 w-4 text-emerald-500" />
                    : <ToggleLeft className="h-4 w-4 text-gray-300" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <span className={rule.is_active ? 'text-gray-800' : 'text-gray-400'}>{rule.name}</span>
                  {rule.column_name && <span className="text-gray-400 text-xs ml-2">({rule.column_name})</span>}
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  rule.severity === 'error' ? 'bg-red-100 text-red-700' :
                  rule.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {rule.severity}
                </span>
                {rule.auto_generated && (
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Auto</span>
                )}
                <button onClick={() => { setEditingRule(rule); setShowRuleEditor(true) }} className="text-gray-400 hover:text-gray-600 ml-1">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rule editor dialog */}
      <Dialog open={showRuleEditor} onOpenChange={setShowRuleEditor}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Quality Rule'}</DialogTitle>
          </DialogHeader>
          <QualityRuleEditor
            datasetId={datasetId}
            columns={columns}
            existingRule={editingRule ?? undefined}
            onSaved={() => { setShowRuleEditor(false); load() }}
            onCancel={() => setShowRuleEditor(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
