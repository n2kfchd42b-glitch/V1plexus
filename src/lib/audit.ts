import { createClient } from '@/lib/supabase/client'

export async function logAudit(
  action: string,
  resourceType: string,
  resourceId: string,
  details?: Record<string, unknown>,
  projectId?: string,
  institutionId?: string
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        actor_id: user.id,
        details: details ?? {},
        project_id: projectId ?? null,
        institution_id: institutionId ?? null,
      }),
    })
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}
