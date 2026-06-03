import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/database.types"

/**
 * Browser-only Supabase client for Realtime subscriptions.
 * All database reads/writes go through Next.js API routes using the service role.
 */
export function createRealtimeClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
