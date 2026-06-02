import { createAuthRouteClient } from "@/lib/supabase/auth-route"

export async function POST() {
  const { supabase, jsonWithSession } = await createAuthRouteClient()
  await supabase.auth.signOut()
  return jsonWithSession({ ok: true })
}
