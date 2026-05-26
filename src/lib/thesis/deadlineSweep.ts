/**
 * Deadline sweep worker.
 *
 * Walks every open deadline, sends reminders at the offsets declared on
 * each thesis's policy snapshot, and escalates past-due deadlines to
 * coordinators after the configured grace period.
 *
 * Idempotency is enforced by the (deadline_id, offset_label, recipient_id)
 * unique constraint on deadline_reminders — sweeping twice on the same day
 * never double-sends the same reminder.
 *
 * Scales to a few thousand open deadlines per sweep on a single Vercel
 * invocation. At higher volume, split into batches keyed by `target_at`
 * windows; the design assumes that's a future optimisation, not a v1
 * requirement.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { writeAuditEntry } from '@/lib/audit/auditLogger'
import { sendNotification } from '@/lib/notifications/notificationService'
import type { ThesisPolicySnapshot } from '@/types/thesis-workflow'

const DEFAULT_REMINDER_OFFSETS = [7, 2]
const DEFAULT_ESCALATION_HOURS = 24

export interface SweepResult {
  scanned: number
  reminders_sent: number
  escalations_sent: number
  errors: string[]
}

interface DeadlineRow {
  id: string
  project_id: string
  kind: string
  source_type: string | null
  source_id: string | null
  target_at: string
  owner_id: string
  title: string
}

interface PolicyLite {
  reminder_offsets_days: number[]
  escalation_delay_hours: number
}

export async function runDeadlineSweep(
  supabase: SupabaseClient,
  options: { now?: Date } = {},
): Promise<SweepResult> {
  const now = options.now ?? new Date()
  const result: SweepResult = {
    scanned: 0,
    reminders_sent: 0,
    escalations_sent: 0,
    errors: [],
  }

  // Fetch open deadlines that have *some* chance of needing action
  // (target_at within the next 30 days or already past). Keeps the
  // scan bounded on growing tables.
  const horizonStart = new Date(now)
  horizonStart.setDate(horizonStart.getDate() - 90)
  const horizonEnd = new Date(now)
  horizonEnd.setDate(horizonEnd.getDate() + 30)

  const { data: deadlines, error } = await supabase
    .from('deadlines')
    .select('id, project_id, kind, source_type, source_id, target_at, owner_id, title')
    .is('satisfied_at', null)
    .gte('target_at', horizonStart.toISOString())
    .lte('target_at', horizonEnd.toISOString())

  if (error) {
    result.errors.push(`fetch_deadlines: ${error.message}`)
    return result
  }

  const open = (deadlines ?? []) as DeadlineRow[]
  result.scanned = open.length

  // Group by project_id so we read each thesis's policy snapshot once
  const projectIds = Array.from(new Set(open.map((d) => d.project_id)))
  const policyMap = await loadPolicySnapshots(supabase, projectIds)

  for (const deadline of open) {
    try {
      const policy = policyMap.get(deadline.project_id) ?? {
        reminder_offsets_days: DEFAULT_REMINDER_OFFSETS,
        escalation_delay_hours: DEFAULT_ESCALATION_HOURS,
      }

      // Reminders before the target_at
      for (const offsetDays of policy.reminder_offsets_days) {
        const reminderDue = new Date(deadline.target_at)
        reminderDue.setDate(reminderDue.getDate() - offsetDays)

        if (reminderDue > now) continue

        const sent = await tryRecordReminder(supabase, deadline.id, `${offsetDays}d`, deadline.owner_id)
        if (sent) {
          await sendReminderNotification(supabase, deadline, deadline.owner_id, offsetDays)
          result.reminders_sent++
          void writeAuditEntry({
            actor_id: deadline.owner_id,
            action: 'thesis.deadline.reminder_sent',
            resource_type: 'thesis_deadline',
            resource_id: deadline.id,
            project_id: deadline.project_id,
            details: {
              summary: `${offsetDays}d reminder sent for "${deadline.title}"`,
              operation: { kind: deadline.kind, target_at: deadline.target_at, offset_days: offsetDays },
            },
          })
        }
      }

      // Escalation after the target_at + grace period
      const escalationDue = new Date(deadline.target_at)
      escalationDue.setHours(escalationDue.getHours() + policy.escalation_delay_hours)
      if (escalationDue <= now) {
        const coordinators = await resolveCoordinators(supabase, deadline.project_id)
        for (const coord of coordinators) {
          const sent = await tryRecordReminder(supabase, deadline.id, 'escalation', coord.id)
          if (sent) {
            await sendEscalationNotification(supabase, deadline, coord.id, coord.email)
            result.escalations_sent++
            void writeAuditEntry({
              actor_id: coord.id,
              action: 'thesis.deadline.escalated',
              resource_type: 'thesis_deadline',
              resource_id: deadline.id,
              project_id: deadline.project_id,
              details: {
                summary: `Escalation sent to coordinator for "${deadline.title}"`,
                operation: { coordinator_id: coord.id, target_at: deadline.target_at },
              },
            })
          }
        }
      }
    } catch (err) {
      result.errors.push(`deadline ${deadline.id}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  return result
}

/**
 * Atomically claim a (deadline, offset, recipient) reminder slot.
 * Returns true if this caller is the one that should send; false if it was
 * already claimed by an earlier sweep (the unique constraint won the race).
 */
async function tryRecordReminder(
  supabase: SupabaseClient,
  deadlineId: string,
  offsetLabel: string,
  recipientId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('deadline_reminders')
    .insert({
      deadline_id:  deadlineId,
      offset_label: offsetLabel,
      recipient_id: recipientId,
    })

  if (!error) return true
  if (error.code === '23505') return false // already claimed
  // Surface other errors so they show up in the sweep result
  throw new Error(error.message)
}

async function loadPolicySnapshots(
  supabase: SupabaseClient,
  projectIds: string[],
): Promise<Map<string, PolicyLite>> {
  if (projectIds.length === 0) return new Map()

  const { data } = await supabase
    .from('thesis_metadata')
    .select('project_id, policy_snapshot')
    .in('project_id', projectIds)

  const map = new Map<string, PolicyLite>()
  for (const row of (data ?? []) as Array<{ project_id: string; policy_snapshot: ThesisPolicySnapshot | null }>) {
    if (row.policy_snapshot) {
      map.set(row.project_id, {
        reminder_offsets_days:  row.policy_snapshot.reminder_offsets_days  ?? DEFAULT_REMINDER_OFFSETS,
        escalation_delay_hours: row.policy_snapshot.escalation_delay_hours ?? DEFAULT_ESCALATION_HOURS,
      })
    }
  }
  return map
}

async function resolveCoordinators(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Array<{ id: string; email: string | null }>> {
  // Resolve from the project's workspace memberships
  const { data: project } = await supabase
    .from('projects')
    .select('workspace_id, institution_id')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) return []

  const candidates: Array<{ id: string; email: string | null }> = []

  if (project.workspace_id) {
    const { data: members } = await supabase
      .from('workspace_memberships')
      .select('user_id, profile:profiles!user_id(email)')
      .eq('workspace_id', project.workspace_id)
      .eq('status', 'active')
      .in('role', ['coordinator', 'department_head', 'admin', 'owner'])
    for (const m of (members ?? []) as Array<{ user_id: string; profile: { email: string | null } | { email: string | null }[] | null }>) {
      const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile
      candidates.push({ id: m.user_id, email: profile?.email ?? null })
    }
  }

  if (candidates.length === 0 && project.institution_id) {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('institution_id', project.institution_id)
      .in('role', ['coordinator', 'admin'])
    for (const a of (admins ?? []) as Array<{ id: string; email: string | null }>) {
      candidates.push({ id: a.id, email: a.email })
    }
  }

  // De-duplicate
  return Array.from(new Map(candidates.map((c) => [c.id, c])).values())
}

async function sendReminderNotification(
  supabase: SupabaseClient,
  deadline: DeadlineRow,
  ownerId: string,
  offsetDays: number,
): Promise<void> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', ownerId)
    .maybeSingle()

  const dueLabel = offsetDays === 1 ? 'tomorrow' : `in ${offsetDays} days`
  await sendNotification(
    ownerId,
    'deadline_reminder',
    `Reminder: ${deadline.title}`,
    `This is due ${dueLabel}.`,
    deadlineLink(deadline),
    {
      resource_type: 'thesis_deadline',
      resource_id:   deadline.id,
      kind:          deadline.kind,
      offset_days:   offsetDays,
    },
    supabase,
    profile?.email ?? undefined,
  )
}

async function sendEscalationNotification(
  supabase: SupabaseClient,
  deadline: DeadlineRow,
  coordinatorId: string,
  coordinatorEmail: string | null,
): Promise<void> {
  await sendNotification(
    coordinatorId,
    'deadline_escalation',
    `Overdue: ${deadline.title}`,
    `A thesis deadline has passed and was not completed in time. Please follow up.`,
    deadlineLink(deadline),
    {
      resource_type: 'thesis_deadline',
      resource_id:   deadline.id,
      kind:          deadline.kind,
      project_id:    deadline.project_id,
    },
    supabase,
    coordinatorEmail ?? undefined,
  )
}

function deadlineLink(deadline: DeadlineRow): string {
  switch (deadline.kind) {
    case 'chapter_due':
    case 'thesis_completion':
      return `/projects/${deadline.project_id}/chapters`
    case 'milestone_due':
      return '/student/milestones'
    default:
      return `/projects/${deadline.project_id}`
  }
}
