import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { ChatView } from "@/components/chat-view"
import type { AppUser, Chat } from "@/components/chat-sidebar"
import { fetchApiFromServer } from "@/lib/api/server"
import { getSessionUser } from "@/lib/auth/session"
import type { MessageWithAttachments } from "@/lib/database.types"
import { formatRelativeTime } from "@/lib/ui/relative-time"

function toAppUser(user: {
  id: string
  email?: string
  is_anonymous?: boolean
  user_metadata?: { full_name?: string; avatar_url?: string }
}): AppUser {
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

type PageProps = {
  params: Promise<{ chatId: string }>
}

export default async function ChatPage({ params }: PageProps) {
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }

  const { chatId } = await params
  const { chats } = await fetchApiFromServer<{
    chats: { id: string; title: string; updated_at: string }[]
  }>("/api/chats")

  let chatPayload: {
    chat: { id: string; title: string }
    messages: MessageWithAttachments[]
  } | null = null

  try {
    chatPayload = await fetchApiFromServer<{
      chat: { id: string; title: string }
      messages: MessageWithAttachments[]
    }>(`/api/chats/${chatId}`)
  } catch {
    redirect("/")
  }

  if (!chatPayload) {
    redirect("/")
  }

  const sidebarChats: Chat[] = chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    timestamp: formatRelativeTime(chat.updated_at),
  }))

  const activeChat = chats.find((chat) => chat.id === chatId)

  return (
    <AppShell chats={sidebarChats} title={activeChat?.title} user={toAppUser(user)}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <ChatView
            key={chatId}
            chatId={chatId}
            initialMessages={chatPayload.messages}
            userId={user.id}
          />
        </div>
      </div>
    </AppShell>
  )
}
