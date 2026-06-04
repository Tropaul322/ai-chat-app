import type { User } from "@supabase/supabase-js"

import { formatRelativeTime } from "@/lib/ui/relative-time"

export type Chat = {
  id: string
  title: string
  timestamp: string
}

export type AppUser = {
  id: string
  name: string
  email: string
  avatarUrl?: string
  isAnonymous?: boolean
} | null

type SidebarChatSource = {
  id: string
  title: string
  updated_at: string
}

export function toAppUser(user: User): AppUser {
  if (!user.email) {
    return user.is_anonymous
      ? {
          id: user.id,
          name: "Guest",
          email: "3 free questions",
          isAnonymous: true,
        }
      : null
  }

  return {
    id: user.id,
    name: user.user_metadata?.full_name ?? user.email.split("@")[0],
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url,
  }
}

export function toSidebarChats(chats: SidebarChatSource[]): Chat[] {
  return chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    timestamp: formatRelativeTime(chat.updated_at),
  }))
}
