import { createAdminClient } from "@/lib/supabase/admin"
import type { ChatRow, MessageWithAttachments } from "@/lib/database.types"

export type RealtimeChatEvent =
  | { event: "chat_created"; payload: ChatRow }
  | { event: "chat_updated"; payload: ChatRow }
  | { event: "chat_deleted"; payload: { id: string } }
  | {
      event: "message_created"
      payload: Pick<
        MessageWithAttachments,
        "id" | "chat_id" | "role" | "content" | "created_at"
      > & {
        attachments: MessageWithAttachments["attachments"]
      }
    }

async function broadcastToUserChannel(
  userId: string,
  message: RealtimeChatEvent
) {
  const admin = createAdminClient()
  const channel = admin.channel(`user:${userId}`, {
    config: { private: true },
  })

  await channel.subscribe()
  await channel.send({
    type: "broadcast",
    event: message.event,
    payload: message.payload,
  })
  await admin.removeChannel(channel)
}

export async function broadcastChatCreated(userId: string, chat: ChatRow) {
  await broadcastToUserChannel(userId, { event: "chat_created", payload: chat })
}

export async function broadcastChatUpdated(userId: string, chat: ChatRow) {
  await broadcastToUserChannel(userId, { event: "chat_updated", payload: chat })
}

export async function broadcastChatDeleted(userId: string, chatId: string) {
  await broadcastToUserChannel(userId, {
    event: "chat_deleted",
    payload: { id: chatId },
  })
}

export async function broadcastMessageCreated(
  userId: string,
  message: MessageWithAttachments
) {
  await broadcastToUserChannel(userId, {
    event: "message_created",
    payload: {
      id: message.id,
      chat_id: message.chat_id,
      role: message.role,
      content: message.content,
      created_at: message.created_at,
      attachments: message.attachments,
    },
  })
}
