import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/rateLimit'
import { getInquiryNotifyEmail } from '@/lib/admin/platformAdmin'
import { EMAIL_REGEX, escapeHtml } from '@/lib/utils'

const inquirySchema = z.object({
  contact_name: z.string().trim().min(1).max(200),
  contact_email: z.string().trim().toLowerCase().regex(EMAIL_REGEX, 'Invalid email'),
  contact_role: z.string().trim().max(200).optional().or(z.literal('')),
  institution_name: z.string().trim().min(1).max(300),
  country: z.string().trim().max(120).optional().or(z.literal('')),
  estimated_seats: z.coerce.number().int().positive().max(1_000_000).optional(),
  message: z.string().trim().max(5000).optional().or(z.literal('')),
})

export async function POST(request: NextRequest) {
  // 5 inquiries per hour per IP — institutions don't submit many.
  const rateLimitResponse = checkRateLimit(request, { limit: 5, windowMs: 60 * 60 * 1000 })
  if (rateLimitResponse) return rateLimitResponse

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = inquirySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  const normalized = {
    contact_name: data.contact_name,
    contact_email: data.contact_email,
    contact_role: data.contact_role?.trim() || null,
    institution_name: data.institution_name,
    country: data.country?.trim() || null,
    estimated_seats: data.estimated_seats ?? null,
    message: data.message?.trim() || null,
  }

  const supabase = createServiceClient()
  const { data: inserted, error: insertError } = await supabase
    .from('institution_inquiries')
    .insert(normalized)
    .select('id')
    .single()

  if (insertError || !inserted) {
    console.error('[INSTITUTION_INQUIRY] Insert failed:', insertError)
    return NextResponse.json({ error: 'Could not record your inquiry. Please try again.' }, { status: 500 })
  }

  // Best-effort notification email — do not fail the request if email fails.
  const notifyTo = getInquiryNotifyEmail()
  if (notifyTo && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const lines = [
        `<strong>Institution:</strong> ${escapeHtml(normalized.institution_name)}`,
        `<strong>Contact:</strong> ${escapeHtml(normalized.contact_name)} &lt;${escapeHtml(normalized.contact_email)}&gt;`,
        normalized.contact_role ? `<strong>Role:</strong> ${escapeHtml(normalized.contact_role)}` : null,
        normalized.country ? `<strong>Country:</strong> ${escapeHtml(normalized.country)}` : null,
        normalized.estimated_seats ? `<strong>Estimated seats:</strong> ${normalized.estimated_seats}` : null,
      ].filter(Boolean) as string[]

      const resp = await resend.emails.send({
        from: 'Plexus <invitations@plexus.science>',
        to: notifyTo,
        replyTo: normalized.contact_email,
        subject: `[Plexus] Institution inquiry — ${normalized.institution_name}`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111827;">
            <h2 style="font-size:18px;margin:0 0 12px;">New institution inquiry</h2>
            <div style="font-size:14px;color:#374151;line-height:1.8;">
              ${lines.join('<br/>')}
            </div>
            ${
              normalized.message
                ? `<div style="margin-top:20px;padding:14px 16px;background:#F0F7FF;border-left:3px solid #3B82F6;border-radius:4px;font-size:14px;color:#374151;white-space:pre-wrap;">${escapeHtml(normalized.message)}</div>`
                : ''
            }
            <p style="margin-top:24px;font-size:12px;color:#6B7280;">
              Inquiry ID: ${inserted.id}<br/>
              Review and provision at <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://plexus.science'}/admin/institutions">/admin/institutions</a>.
            </p>
          </div>
        `,
      })
      if (resp.error) {
        console.error('[INSTITUTION_INQUIRY] Resend returned error:', resp.error)
      } else {
        console.log('[INSTITUTION_INQUIRY] Notification sent to', notifyTo, 'id=', resp.data?.id)
      }
    } catch (emailError) {
      console.error('[INSTITUTION_INQUIRY] Notification email threw:', emailError)
    }
  }

  return NextResponse.json({ success: true })
}
