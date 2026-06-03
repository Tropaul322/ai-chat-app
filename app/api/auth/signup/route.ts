import { jsonError } from "@/lib/api/response"
import { createAuthRouteClient } from "@/lib/supabase/auth-route"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string
    password?: string
    name?: string
  }

  if (!body.email || !body.password) {
    return jsonError("Email and password are required")
  }

  if (body.password.length < 8) {
    return jsonError("Password must be at least 8 characters long")
  }

  const { supabase, jsonWithSession } = await createAuthRouteClient()
  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
    options: {
      data: {
        full_name: body.name,
      },
    },
  })

  if (error) {
    return jsonError(error.message, 400)
  }

  if (!data.session) {
    return jsonError(
      "Check your email to confirm your account, or use a different email.",
      400
    )
  }

  return jsonWithSession({ ok: true })
}
