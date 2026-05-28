'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, GraduationCap, Loader2, Save, Info, Plus, Trash2, X, ScrollText } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { THESIS_WORKFLOW_V2 } from '@/lib/flags'

interface PolicyRow {
  id: string
  institution_id: string
  programme_id: string | null
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

interface OverrideRow extends PolicyRow {
  programme: { id: string; name: string; short_code: string | null; degree_level: string } | null
}

interface Programme {
  id: string
  name: string
  short_code: string | null
  degree_level: string
  active: boolean
}

type TargetKind = 'default' | { programme_id: string; programme_name: string }

export default function ThesisPolicyPage() {
  const router = useRouter()
  const [defaultPolicy, setDefaultPolicy] = useState<PolicyRow | null>(null)
  const [overrides, setOverrides] = useState<OverrideRow[]>([])
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTarget, setActiveTarget] = useState<TargetKind>('default')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    if (!THESIS_WORKFLOW_V2) { router.push('/institution'); return }
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [defaultRes, overridesRes, progRes] = await Promise.all([
      fetch('/api/institution/thesis-policy'),
      fetch('/api/institution/thesis-policy/overrides'),
      fetch('/api/institution/programmes'),
    ])

    if (defaultRes.status === 401) { router.push('/login'); return }
    if (!defaultRes.ok) {
      const body = await defaultRes.json().catch(() => ({}))
      setError(body.error ?? 'Could not load policy')
      setLoading(false)
      return
    }
    setDefaultPolicy(await defaultRes.json() as PolicyRow)
    setOverrides(overridesRes.ok ? ((await overridesRes.json()).overrides ?? []) : [])
    setProgrammes(progRes.ok ? ((await progRes.json()).programmes ?? []) : [])
    setLoading(false)
  }, [router])

  const programmesWithoutOverride = useMemo(() => {
    const usedIds = new Set(overrides.map((o) => o.programme_id).filter(Boolean))
    return programmes.filter((p) => p.active && !usedIds.has(p.id))
  }, [programmes, overrides])

  const currentPolicy: PolicyRow | OverrideRow | null = useMemo(() => {
    if (activeTarget === 'default') return defaultPolicy
    return overrides.find((o) => o.programme_id === activeTarget.programme_id) ?? null
  }, [activeTarget, defaultPolicy, overrides])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (error || !defaultPolicy) {
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
      <div className="max-w-4xl mx-auto">
        <Link
          href="/institution"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Institution
        </Link>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)]/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Thesis Policy</h1>
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5">
              Workflow rules applied to every new thesis at your institution. Theses in
              progress keep the policy version they started with. Each programme can
              override the institution default for its students.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          {/* Left rail — target picker */}
          <aside className="space-y-4">
            <section>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--text-tertiary)] mb-2 px-2">
                Targets
              </p>
              <button
                type="button"
                onClick={() => setActiveTarget('default')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                  activeTarget === 'default'
                    ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                Institution default
                <span className="block text-[10px] font-normal text-[var(--text-tertiary)] mt-0.5">
                  v{defaultPolicy.policy_version} · applies when no override fits
                </span>
              </button>
            </section>

            <section>
              <div className="flex items-center justify-between px-2 mb-1">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--text-tertiary)]">
                  Programme overrides
                </p>
                {programmesWithoutOverride.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAdd(true)}
                    className="text-[10px] font-semibold text-[var(--accent-blue)] hover:underline inline-flex items-center gap-0.5"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Add
                  </button>
                )}
              </div>
              {overrides.length === 0 ? (
                <p className="px-2 text-[11px] text-[var(--text-tertiary)] italic">
                  None configured. Every thesis uses the institution default.
                </p>
              ) : (
                <ul className="space-y-1">
                  {overrides.map((o) => {
                    const programmeName = o.programme?.name ?? 'Programme'
                    const active = activeTarget !== 'default' && activeTarget.programme_id === o.programme_id
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => setActiveTarget({
                            programme_id: o.programme_id!,
                            programme_name: programmeName,
                          })}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm font-semibold transition-colors ${
                            active
                              ? 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                          }`}
                        >
                          <span className="truncate block">{programmeName}</span>
                          <span className="block text-[10px] font-normal text-[var(--text-tertiary)] mt-0.5 capitalize">
                            {o.programme?.degree_level ?? ''} · v{o.policy_version}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </aside>

          {/* Right pane — editor */}
          <div>
            {activeTarget !== 'default' && !currentPolicy ? (
              <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 text-center text-sm text-[var(--text-tertiary)]">
                Override not found.
                <button
                  type="button"
                  onClick={() => setActiveTarget('default')}
                  className="ml-2 underline text-[var(--accent-blue)]"
                >
                  Back to default
                </button>
              </div>
            ) : (
              currentPolicy && (
                <PolicyEditor
                  key={currentPolicy.id}
                  policy={currentPolicy}
                  target={activeTarget}
                  onSaved={(saved) => {
                    if (saved.programme_id === null) {
                      setDefaultPolicy(saved)
                    } else {
                      // Refetch the overrides list to re-embed the programme name.
                      void loadAll()
                    }
                  }}
                  onDeleted={() => {
                    setActiveTarget('default')
                    void loadAll()
                  }}
                />
              )
            )}
          </div>
        </div>
      </div>

      {showAdd && (
        <AddOverrideModal
          programmes={programmesWithoutOverride}
          onClose={() => setShowAdd(false)}
          onCreated={(newOverride) => {
            setShowAdd(false)
            setActiveTarget({
              programme_id: newOverride.programme_id!,
              programme_name: newOverride.programme?.name ?? 'Programme',
            })
            void loadAll()
          }}
          fallback={defaultPolicy}
        />
      )}
    </div>
  )
}

function PolicyEditor({
  policy,
  target,
  onSaved,
  onDeleted,
}: {
  policy: PolicyRow | OverrideRow
  target: TargetKind
  onSaved: (saved: PolicyRow) => void
  onDeleted: () => void
}) {
  const [draft, setDraft] = useState<PolicyRow>(policy)
  const [chapterTitlesText, setChapterTitlesText] = useState(policy.default_chapter_titles.join('\n'))
  const [remindersText, setRemindersText] = useState(policy.reminder_offsets_days.join(', '))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setDraft(policy)
    setChapterTitlesText(policy.default_chapter_titles.join('\n'))
    setRemindersText(policy.reminder_offsets_days.join(', '))
  }, [policy])

  const isOverride = target !== 'default'
  const targetLabel = isOverride ? `Override · ${target.programme_name}` : 'Institution default'
  const url = isOverride
    ? `/api/institution/thesis-policy?programme_id=${target.programme_id}`
    : '/api/institution/thesis-policy'

  function patch<K extends keyof PolicyRow>(key: K, value: PolicyRow[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    const reminderOffsets = remindersText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
    const chapterTitles = chapterTitlesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)

    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        require_ethics_gate:      draft.require_ethics_gate,
        allow_co_supervisors:     draft.allow_co_supervisors,
        max_co_supervisors:       draft.max_co_supervisors,
        require_oral_defense:     draft.require_oral_defense,
        require_proposal_defense: draft.require_proposal_defense,
        min_chapters:             draft.min_chapters,
        default_chapter_titles:   chapterTitles,
        reminder_offsets_days:    reminderOffsets,
        escalation_delay_hours:   draft.escalation_delay_hours,
      }),
    })

    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error?.formErrors?.join(', ') ?? body.error ?? 'Save failed')
      return
    }
    const saved = await res.json() as PolicyRow
    toast.success(`Saved — ${targetLabel} is now v${saved.policy_version}`)
    onSaved(saved)
  }

  async function deleteOverride() {
    if (!isOverride) return
    const confirmed = window.confirm(
      `Delete the override for ${target.programme_name}? Future theses in this programme will fall back to the institution default.`
    )
    if (!confirmed) return
    setDeleting(true)
    const res = await fetch(`/api/institution/thesis-policy/${target.programme_id}`, {
      method: 'DELETE',
    })
    setDeleting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body.error ?? 'Delete failed')
      return
    }
    toast.success(`Removed override for ${target.programme_name}`)
    onDeleted()
  }

  return (
    <div className="space-y-6">
      <header className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl px-5 py-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--text-tertiary)]">
            {isOverride ? 'Programme override' : 'Institution default'}
          </p>
          <h2 className="text-base font-bold text-[var(--text-primary)] mt-0.5">{targetLabel}</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 flex items-center gap-1">
            <Info className="h-3 w-3" />
            v{policy.policy_version}{' · '}
            {isOverride
              ? 'Applies to theses whose author is actively enrolled in this programme.'
              : 'Applies when the author has no programme override.'}
          </p>
        </div>
        {isOverride && (
          <button
            type="button"
            onClick={deleteOverride}
            disabled={deleting}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[var(--border-default)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--status-error-text)] hover:border-[var(--status-error-text)]/40 disabled:opacity-60 transition-colors"
            title="Remove this override; the programme will fall back to the institution default."
          >
            <Trash2 className="h-3 w-3" />
            {deleting ? 'Removing…' : 'Remove override'}
          </button>
        )}
      </header>

      <Section title="Gates">
        <ToggleRow
          label="Require approved ethics gate"
          help="Block proposal-review → active until the project has an approved ethics gate."
          checked={draft.require_ethics_gate}
          onChange={(v) => patch('require_ethics_gate', v)}
        />
        <ToggleRow
          label="Require oral defense"
          help="Block submitted → approved until a thesis_defenses row has outcome pass or pass_with_corrections."
          checked={draft.require_oral_defense}
          onChange={(v) => patch('require_oral_defense', v)}
        />
        <ToggleRow
          label="Require proposal defense"
          help="Reserved — used by future proposal-defense step."
          checked={draft.require_proposal_defense}
          onChange={(v) => patch('require_proposal_defense', v)}
        />
      </Section>

      <Section title="Supervision">
        <ToggleRow
          label="Allow co-supervisors"
          help="When off, students may only request a single primary supervisor."
          checked={draft.allow_co_supervisors}
          onChange={(v) => patch('allow_co_supervisors', v)}
        />
        <FieldRow
          label="Max co-supervisors per thesis"
          help="How many co-supervisors a thesis may have on top of the primary."
        >
          <Input
            type="number"
            min={0}
            max={10}
            value={draft.max_co_supervisors}
            onChange={(e) => patch('max_co_supervisors', Number(e.target.value))}
            disabled={!draft.allow_co_supervisors}
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
            value={draft.min_chapters}
            onChange={(e) => patch('min_chapters', Number(e.target.value))}
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
            onChange={(e) => setChapterTitlesText(e.target.value)}
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
            onChange={(e) => setRemindersText(e.target.value)}
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
            value={draft.escalation_delay_hours}
            onChange={(e) => patch('escalation_delay_hours', Number(e.target.value))}
            className="w-20"
          />
        </FieldRow>
      </Section>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => { setDraft(policy); setChapterTitlesText(policy.default_chapter_titles.join('\n')); setRemindersText(policy.reminder_offsets_days.join(', ')) }} disabled={saving}>
          Reset
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
          {saving ? 'Saving…' : 'Save policy'}
        </Button>
      </div>
    </div>
  )
}

function AddOverrideModal({
  programmes,
  fallback,
  onClose,
  onCreated,
}: {
  programmes: Programme[]
  fallback: PolicyRow
  onClose: () => void
  onCreated: (created: OverrideRow) => void
}) {
  const [selected, setSelected] = useState<string>(programmes[0]?.id ?? '')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (!selected) return
    setCreating(true)
    setError(null)
    // Seed the override with the current institution-default values so it
    // starts as an exact copy the admin can then tweak.
    const res = await fetch(`/api/institution/thesis-policy?programme_id=${selected}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        require_ethics_gate:      fallback.require_ethics_gate,
        allow_co_supervisors:     fallback.allow_co_supervisors,
        max_co_supervisors:       fallback.max_co_supervisors,
        require_oral_defense:     fallback.require_oral_defense,
        require_proposal_defense: fallback.require_proposal_defense,
        min_chapters:             fallback.min_chapters,
        default_chapter_titles:   fallback.default_chapter_titles,
        reminder_offsets_days:    fallback.reminder_offsets_days,
        escalation_delay_hours:   fallback.escalation_delay_hours,
      }),
    })
    setCreating(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error?.formErrors?.join(', ') ?? body.error ?? 'Could not create override')
      return
    }
    const created = await res.json() as PolicyRow
    const programme = programmes.find((p) => p.id === selected) ?? null
    onCreated({
      ...created,
      programme: programme ? {
        id: programme.id,
        name: programme.name,
        short_code: programme.short_code,
        degree_level: programme.degree_level,
      } : null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] w-full max-w-md shadow-2xl">
        <header className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[var(--text-tertiary)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">Add programme override</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5 space-y-4">
          {programmes.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">
              Every active programme already has an override. Add a new programme first.
            </p>
          ) : (
            <>
              <p className="text-xs text-[var(--text-tertiary)]">
                The override starts as a copy of the institution default — you can then tweak any field.
                Future theses for students in this programme will use the override instead of the default.
              </p>
              <div>
                <Label className="text-xs font-semibold text-[var(--text-primary)]">Programme</Label>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="mt-1 w-full bg-[var(--bg-app)] border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                >
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.short_code ? ` (${p.short_code})` : ''} · {p.degree_level}
                    </option>
                  ))}
                </select>
              </div>
              {error && <p className="text-xs text-[var(--status-error-text)]">{error}</p>}
            </>
          )}
        </div>
        <footer className="px-5 py-3 border-t border-[var(--border-default)] flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={creating}>Cancel</Button>
          <Button
            onClick={create}
            disabled={creating || programmes.length === 0 || !selected}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Create override
          </Button>
        </footer>
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
