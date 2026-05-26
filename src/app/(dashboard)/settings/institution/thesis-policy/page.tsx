'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, Loader2, Save, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { THESIS_WORKFLOW_V2 } from '@/lib/flags'

interface PolicyRow {
  institution_id: string
  policy_version: number
  require_ethics_gate: boolean
  allow_co_supervisors: boolean
  max_co_supervisors: number
  require_oral_defense: boolean
  require_proposal_defense: boolean
  min_chapters: number
  default_chapter_titles: string[]
  reminder_offsets_days: number[]
  escalation_delay_hours: number
}

export default function ThesisPolicyPage() {
  const router = useRouter()
  const [policy, setPolicy] = useState<PolicyRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chapterTitlesText, setChapterTitlesText] = useState('')
  const [remindersText, setRemindersText] = useState('')

  useEffect(() => {
    if (!THESIS_WORKFLOW_V2) { router.push('/settings'); return }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/institution/thesis-policy')
    if (res.status === 401) { router.push('/login'); return }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Could not load policy')
      setLoading(false)
      return
    }
    const data = await res.json() as PolicyRow
    setPolicy(data)
    setChapterTitlesText((data.default_chapter_titles ?? []).join('\n'))
    setRemindersText((data.reminder_offsets_days ?? []).join(', '))
    setLoading(false)
  }

  async function save() {
    if (!policy) return
    setSaving(true)

    const reminderOffsets = remindersText
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n) && n > 0)

    const chapterTitles = chapterTitlesText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    const res = await fetch('/api/institution/thesis-policy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        require_ethics_gate:      policy.require_ethics_gate,
        allow_co_supervisors:     policy.allow_co_supervisors,
        max_co_supervisors:       policy.max_co_supervisors,
        require_oral_defense:     policy.require_oral_defense,
        require_proposal_defense: policy.require_proposal_defense,
        min_chapters:             policy.min_chapters,
        default_chapter_titles:   chapterTitles,
        reminder_offsets_days:    reminderOffsets,
        escalation_delay_hours:   policy.escalation_delay_hours,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error?.formErrors?.join(', ') ?? body.error ?? 'Save failed')
      return
    }

    const updated = await res.json() as PolicyRow
    setPolicy(updated)
    toast.success(`Saved — policy is now v${updated.policy_version}`)
  }

  function patch<K extends keyof PolicyRow>(key: K, value: PolicyRow[K]) {
    setPolicy(prev => prev ? { ...prev, [key]: value } : prev)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (error || !policy) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] px-4 py-10">
        <div className="max-w-xl mx-auto text-center text-[var(--text-tertiary)]">
          {error ?? 'Policy unavailable'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Thesis Policy</h1>
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
              Workflow rules applied to every new thesis at your institution.
              Theses in progress keep the policy version they started with.
            </p>
          </div>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/5 p-3">
          <Info className="h-3.5 w-3.5 mt-0.5 text-[var(--accent-blue)] flex-shrink-0" />
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Currently on <span className="font-semibold text-[var(--text-primary)]">version {policy.policy_version}</span>.
            Saving creates a new version automatically. In-progress theses are unaffected.
          </p>
        </div>

        <div className="space-y-6">
          <Section title="Gates">
            <ToggleRow
              label="Require approved ethics gate"
              help="Block proposal-review → active until the project has an approved ethics gate."
              checked={policy.require_ethics_gate}
              onChange={v => patch('require_ethics_gate', v)}
            />
            <ToggleRow
              label="Require oral defense"
              help="Block submitted → approved until a thesis_defenses row has outcome pass or pass_with_corrections."
              checked={policy.require_oral_defense}
              onChange={v => patch('require_oral_defense', v)}
            />
            <ToggleRow
              label="Require proposal defense"
              help="Reserved — used by future proposal-defense step."
              checked={policy.require_proposal_defense}
              onChange={v => patch('require_proposal_defense', v)}
            />
          </Section>

          <Section title="Supervision">
            <ToggleRow
              label="Allow co-supervisors"
              help="When off, students may only request a single primary supervisor."
              checked={policy.allow_co_supervisors}
              onChange={v => patch('allow_co_supervisors', v)}
            />
            <FieldRow
              label="Max co-supervisors per thesis"
              help="How many co-supervisors a thesis may have on top of the primary."
            >
              <Input
                type="number"
                min={0}
                max={10}
                value={policy.max_co_supervisors}
                onChange={e => patch('max_co_supervisors', Number(e.target.value))}
                disabled={!policy.allow_co_supervisors}
                className="w-20"
              />
            </FieldRow>
          </Section>

          <Section title="Chapter structure">
            <FieldRow label="Minimum chapters" help="Theses must contain at least this many chapters.">
              <Input
                type="number"
                min={1}
                max={50}
                value={policy.min_chapters}
                onChange={e => patch('min_chapters', Number(e.target.value))}
                className="w-20"
              />
            </FieldRow>
            <FieldColumn
              label="Default chapter titles"
              help="One per line. Used to pre-fill the chapter list in the thesis creation wizard."
            >
              <textarea
                rows={6}
                value={chapterTitlesText}
                onChange={e => setChapterTitlesText(e.target.value)}
                placeholder={'Introduction\nLiterature Review\nMethodology\nResults\nDiscussion\nConclusion'}
                className="w-full px-3 py-2 text-sm font-mono border border-[var(--border-default)] rounded-md bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] text-[var(--text-primary)]"
              />
            </FieldColumn>
          </Section>

          <Section title="Deadlines & reminders">
            <FieldRow
              label="Reminder offsets (days before)"
              help="Comma-separated days at which to send deadline reminders. Example: 7, 2"
            >
              <Input
                type="text"
                value={remindersText}
                onChange={e => setRemindersText(e.target.value)}
                placeholder="7, 2"
                className="w-40"
              />
            </FieldRow>
            <FieldRow
              label="Coordinator escalation delay (hours)"
              help="Hours after a missed deadline before coordinators are notified."
            >
              <Input
                type="number"
                min={1}
                max={720}
                value={policy.escalation_delay_hours}
                onChange={e => patch('escalation_delay_hours', Number(e.target.value))}
                className="w-20"
              />
            </FieldRow>
          </Section>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={load} disabled={saving}>Reset</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              {saving ? 'Saving…' : 'Save policy'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
      <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function ToggleRow({
  label, help, checked, onChange,
}: { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <Label className="text-sm font-medium text-[var(--text-primary)]">{label}</Label>
        {help && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{help}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function FieldRow({
  label, help, children,
}: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <Label className="text-sm font-medium text-[var(--text-primary)]">{label}</Label>
        {help && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{help}</p>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function FieldColumn({
  label, help, children,
}: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-medium text-[var(--text-primary)]">{label}</Label>
      {help && <p className="text-xs text-[var(--text-tertiary)] mt-0.5 mb-2">{help}</p>}
      {children}
    </div>
  )
}
