import { generateGeminiReply } from "@/lib/ai/gemini"
import type { ChatRow, MessageWithAttachments } from "@/lib/database.types"
import {
  createMessageForChat,
  getChatForUser,
  incrementQuestionCount,
  listMessagesForChat,
  type PendingMessageAttachment,
  updateChatForUser,
} from "@/lib/db/chats"

function truncateTitle(content: string, maxLength = 60) {
  const trimmed = content.trim()
  if (trimmed.length <= maxLength) {
    return trimmed
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}

function getChatTitle(content: string, attachments: PendingMessageAttachment[]) {
  if (content.trim()) {
    return truncateTitle(content)
  }

  if (attachments.length === 1) {
    return truncateTitle(attachments[0].fileName)
  }

  if (attachments.length > 1) {
    return `${attachments.length} attachments`
  }

  return "New chat"
}

export async function sendMessageAndGetReply(
  chatId: string,
  userId: string,
  content: string,
  options: { attachments?: PendingMessageAttachment[]; isAnonymous: boolean }
): Promise<{
  userMessage: MessageWithAttachments
  assistantMessage: MessageWithAttachments
  updatedChat: ChatRow | null
} | null> {
  const chat = await getChatForUser(chatId, userId)
  if (!chat) {
    return null
  }

  const priorMessages = (await listMessagesForChat(chatId, userId)) ?? []

  await incrementQuestionCount(userId, options.isAnonymous)

  const attachments = options.attachments ?? []
  const userMessage = await createMessageForChat(
    chatId,
    userId,
    {
      role: "user",
      content,
    },
    attachments
  )

  if (!userMessage) {
    return null
  }

  const assistantContent = await generateGeminiReply(
    priorMessages,
    content,
    attachments
  )

  const assistantMessage = await createMessageForChat(chatId, userId, {
    role: "assistant",
    content: assistantContent,
  })

  if (!assistantMessage) {
    throw new Error("Failed to save assistant message")
  }

  let updatedChat: ChatRow | null = null

  if (chat.title === "New chat" && priorMessages.length === 0) {
    updatedChat = await updateChatForUser(chatId, userId, {
      title: getChatTitle(content, attachments),
    })
  }

  return { userMessage, assistantMessage, updatedChat }
}
