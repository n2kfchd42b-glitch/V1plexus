import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
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

  // Use the anon client + signUp() so Supabase creates the user AND sends the
  // confirmation email in one call. The previous flow chained admin.createUser
  // (which never sends a confirmation email) with admin.generateLink (which
  // rejects already-created users with "User already registered"), leaving
  // users in an unconfirmed state with no email — and login then failed.
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ userId: data.user?.id }, { status: 201 })
}
