import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServiceClient } from "@/lib/supabase/service"
import { validateEmailDomain } from "@/lib/disposable-email-domains"

const schema = z.object({
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  fullName: z.string().min(1, "Full name is required."),
  emailRedirectTo: z.string().url().optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 422 }
    )
  }

  const { email, password, fullName, emailRedirectTo } = parsed.data

  // Server-side email quality check — cannot be bypassed from the browser
  const emailCheck = validateEmailDomain(email)
  if (!emailCheck.valid) {
    return NextResponse.json({ error: emailCheck.reason }, { status: 422 })
  }

  const supabase = createServiceClient()

  // Create the user without auto-confirming — they must verify via email
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name: fullName },
    email_confirm: false,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // admin.createUser does NOT send a confirmation email on its own.
  // generateLink with type "signup" queues the confirmation email through
  // Supabase's mailer, so the user receives the branded verify link.
  const redirectTo = emailRedirectTo ?? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`
  await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo },
  })

  return NextResponse.json({ userId: data.user?.id }, { status: 201 })
}
