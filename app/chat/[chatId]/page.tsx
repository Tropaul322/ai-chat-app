import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { ChatView } from "@/components/chat-view"
import { fetchApiFromServer } from "@/lib/api/server"
import { getSessionUser } from "@/lib/auth/session"
import type { MessageWithAttachments } from "@/lib/database.types"
import { toAppUser, toSidebarChats } from "@/lib/ui/sidebar-data"

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

  const activeChat = chats.find((chat) => chat.id === chatId)

  return (
    <AppShell
      chats={toSidebarChats(chats)}
      title={activeChat?.title}
      user={toAppUser(user)}
    >
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
