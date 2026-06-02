import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ChatRow,
  MessageAttachmentView,
  MessageRow,
  MessageWithAttachments,
} from "@/lib/database.types"
import {
  broadcastChatCreated,
  broadcastChatDeleted,
  broadcastChatUpdated,
  broadcastMessageCreated,
} from "@/lib/realtime/broadcast"

export type ChatSummary = Pick<ChatRow, "id" | "title" | "updated_at">

export type PendingMessageAttachment = {
  attachmentType: "image" | "document"
  data: Buffer
  fileName: string
  fileSize: number
  mimeType: string
}

const CHAT_ATTACHMENTS_BUCKET = "chat-attachments"

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
}

async function createSignedAttachmentUrl(storagePath: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(CHAT_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  if (error) {
    throw error
  }

  return data.signedUrl
}

async function withAttachmentUrls(
  attachments: Omit<MessageAttachmentView, "signed_url">[]
): Promise<MessageAttachmentView[]> {
  return Promise.all(
    attachments.map(async (attachment) => ({
      ...attachment,
      signed_url: await createSignedAttachmentUrl(attachment.storage_path),
    }))
  )
}

async function getAttachmentsForMessages(messageIds: string[]) {
  if (messageIds.length === 0) {
    return new Map<string, MessageAttachmentView[]>()
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("message_attachments")
    .select("*")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  const attachments = await withAttachmentUrls(data ?? [])
  const byMessageId = new Map<string, MessageAttachmentView[]>()

  for (const attachment of attachments) {
    byMessageId.set(attachment.message_id, [
      ...(byMessageId.get(attachment.message_id) ?? []),
      attachment,
    ])
  }

  return byMessageId
}

async function attachFilesToMessage(
  messageId: string,
  chatId: string,
  userId: string,
  attachments: PendingMessageAttachment[]
) {
  if (attachments.length === 0) {
    return []
  }

  const admin = createAdminClient()
  const rows = []

  for (const attachment of attachments) {
    const fileName = sanitizeFileName(attachment.fileName) || "attachment"
    const storagePath = `${userId}/${chatId}/${messageId}/${crypto.randomUUID()}-${fileName}`

    const { error: uploadError } = await admin.storage
      .from(CHAT_ATTACHMENTS_BUCKET)
      .upload(storagePath, attachment.data, {
        contentType: attachment.mimeType,
        upsert: false,
      })

    if (uploadError) {
      throw uploadError
    }

    rows.push({
      attachment_type: attachment.attachmentType,
      file_name: attachment.fileName,
      file_size: attachment.fileSize,
      message_id: messageId,
      mime_type: attachment.mimeType,
      storage_path: storagePath,
    })
  }

  const { data, error } = await admin
    .from("message_attachments")
    .insert(rows)
    .select("*")

  if (error) {
    throw error
  }

  return withAttachmentUrls(data ?? [])
}

export async function listChatsForUser(userId: string): Promise<ChatSummary[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("chats")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

export async function getChatForUser(chatId: string, userId: string) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function createChatForUser(userId: string, title = "New chat") {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("chats")
    .insert({ user_id: userId, title })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  await broadcastChatCreated(userId, data)

  return data
}

export async function updateChatForUser(
  chatId: string,
  userId: string,
  updates: Pick<ChatRow, "title">
) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from("chats")
    .update(updates)
    .eq("id", chatId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data) {
    await broadcastChatUpdated(userId, data)
  }

  return data
}

export async function deleteChatForUser(chatId: string, userId: string) {
  const chat = await getChatForUser(chatId, userId)
  if (!chat) {
    return false
  }

  const admin = createAdminClient()

  const { data: messages, error: messagesError } = await admin
    .from("messages")
    .select("id")
    .eq("chat_id", chatId)

  if (messagesError) {
    throw messagesError
  }

  const messageIds = (messages ?? []).map((message) => message.id)
  if (messageIds.length > 0) {
    const { data: attachments, error: attachmentsError } = await admin
      .from("message_attachments")
      .select("storage_path")
      .in("message_id", messageIds)

    if (attachmentsError) {
      throw attachmentsError
    }

    const storagePaths = (attachments ?? [])
      .map((attachment) => attachment.storage_path)
      .filter(Boolean)

    if (storagePaths.length > 0) {
      const { error: storageError } = await admin.storage
        .from(CHAT_ATTACHMENTS_BUCKET)
        .remove(storagePaths)

      if (storageError) {
        throw storageError
      }
    }
  }

  const { error } = await admin
    .from("chats")
    .delete()
    .eq("id", chatId)
    .eq("user_id", userId)

  if (error) {
    throw error
  }

  await broadcastChatDeleted(userId, chatId)

  return true
}

export async function listMessagesForChat(
  chatId: string,
  userId: string
): Promise<MessageWithAttachments[] | null> {
  const chat = await getChatForUser(chatId, userId)
  if (!chat) {
    return null
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })

  if (error) {
    throw error
  }

  const messages = data ?? []
  const attachmentsByMessage = await getAttachmentsForMessages(
    messages.map((message) => message.id)
  )

  return messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessage.get(message.id) ?? [],
  }))
}

export async function createMessageForChat(
  chatId: string,
  userId: string,
  message: Pick<MessageRow, "role" | "content">,
  attachments: PendingMessageAttachment[] = []
) {
  const chat = await getChatForUser(chatId, userId)
  if (!chat) {
    return null
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from("messages")
    .insert({
      chat_id: chatId,
      role: message.role,
      content: message.content,
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  const messageAttachments = await attachFilesToMessage(
    data.id,
    chatId,
    userId,
    attachments
  )
  const messageWithAttachments = {
    ...data,
    attachments: messageAttachments,
  }

  await broadcastMessageCreated(userId, messageWithAttachments)

  return messageWithAttachments
}

export async function incrementQuestionCount(userId: string, isAnonymous: boolean) {
  const admin = createAdminClient()

  const { data, error } = await admin
    .rpc("increment_question_count_for_user", {
      p_is_anonymous: isAnonymous,
      p_user_id: userId,
    })
    .select("question_count, max_free_questions")
    .single()

  if (error) {
    throw error
  }

  return data
}

export function formatRelativeTime(isoDate: string) {
  const date = new Date(isoDate)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) {
    return "Just now"
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) {
    return "Yesterday"
  }

  return `${diffDays}d ago`
}
