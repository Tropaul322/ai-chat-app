import { jsonError } from "@/lib/api/response"
import { createAuthRouteClient } from "@/lib/supabase/auth-route"

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string
    password?: string
  }

  if (!body.email || !body.password) {
    return jsonError("Email and password are required")
  }

  const { supabase, jsonWithSession } = await createAuthRouteClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  })

  if (error) {
    return jsonError(error.message, 401)
  }

  return jsonWithSession({ ok: true })
}
