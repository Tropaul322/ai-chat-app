import { jsonError } from "@/lib/api/response"
import { createAuthRouteClient } from "@/lib/supabase/auth-route"

export async function POST() {
  const { supabase, jsonWithSession } = await createAuthRouteClient()
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    return jsonError(error.message, 400)
  }

  if (!data.session) {
    return jsonError("Anonymous sign in failed", 400)
  }

  return jsonWithSession({ ok: true, userId: data.user?.id })
}
