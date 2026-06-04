import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

type CookieOptions = Parameters<
  Awaited<ReturnType<typeof cookies>>["set"]
>[2]

type PendingCookie = {
  name: string
  value: string
  options?: CookieOptions
}

/**
 * Supabase client for auth API routes. Writes session cookies onto the
 * returned NextResponse so the browser receives them (cookieStore.set alone
 * is not enough in route handlers).
 */
export async function createAuthRouteClient() {
  const cookieStore = await cookies()
  const pendingCookies: PendingCookie[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            pendingCookies.push({ name, value, options })
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Route handler still applies cookies via jsonWithSession below.
            }
          }
        },
      },
    }
  )

  function jsonWithSession(body: unknown, init?: ResponseInit) {
    const response = NextResponse.json(body, init)
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options)
    }
    return response
  }

  function redirectWithSession(url: URL | string) {
    const response = NextResponse.redirect(url)
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options)
    }
    return response
  }

  return { supabase, jsonWithSession, redirectWithSession }
}
