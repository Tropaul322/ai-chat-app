"use client"

import { useEffect } from "react"

import { createRealtimeClient } from "@/lib/supabase/realtime-client"
import type { RealtimeChatEvent } from "@/lib/realtime/broadcast"

export function useRealtimeChats(
  userId: string | undefined,
  onEvent: (event: RealtimeChatEvent) => void
) {
  useEffect(() => {
    if (!userId) {
      return
    }

    const supabase = createRealtimeClient()
    const channel = supabase
      .channel(`user:${userId}`, { config: { private: true } })
      .on("broadcast", { event: "chat_created" }, ({ payload }) => {
        onEvent({ event: "chat_created", payload });
      })
      .on("broadcast", { event: "chat_updated" }, ({ payload }) => {
        onEvent({ event: "chat_updated", payload })
      })
      .on("broadcast", { event: "chat_deleted" }, ({ payload }) => {
        onEvent({ event: "chat_deleted", payload })
      })
      .on("broadcast", { event: "message_created" }, ({ payload }) => {
        onEvent({ event: "message_created", payload })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, onEvent])
}
