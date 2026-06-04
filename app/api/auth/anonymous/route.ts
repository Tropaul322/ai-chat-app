import { jsonError } from "@/lib/api/response"
import { createAuthRouteClient } from "@/lib/supabase/auth-route"

function getSafeNextUrl(request: Request) {
  const url = new URL(request.url)
  const nextPath = url.searchParams.get("next") ?? "/"

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return new URL("/", url)
  }

  return new URL(nextPath, url)
}

async function signInAnonymously() {
  const { supabase, jsonWithSession, redirectWithSession } =
    await createAuthRouteClient()
  const { data, error } = await supabase.auth.signInAnonymously()

  if (error) {
    return { error, jsonWithSession, redirectWithSession }
  }

  if (!data.session) {
    return {
      error: new Error("Anonymous sign in failed"),
      jsonWithSession,
      redirectWithSession,
    }
  }

  return { data, jsonWithSession, redirectWithSession }
}

export async function GET(request: Request) {
  const { error, redirectWithSession } = await signInAnonymously()

  if (error) {
    return jsonError(error.message, 400)
  }

  return redirectWithSession(getSafeNextUrl(request))
}

export async function POST() {
  const { data, error, jsonWithSession } = await signInAnonymously()

  if (error) {
    return jsonError(error.message, 400)
  }

  return jsonWithSession({ ok: true, userId: data.user?.id })
}
