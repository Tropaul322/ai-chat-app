import { NextResponse } from "next/server"

import { sendMessageAndGetReply } from "@/lib/ai/send-message"
import { parseChatRequest } from "@/lib/api/chat-request"
import { jsonError, jsonUnauthorized } from "@/lib/api/response"
import { getSessionUser } from "@/lib/auth/session"
import {
  createChatForUser,
  deleteChatForUser,
  listChatsForUser,
} from "@/lib/db/chats"
import { isFreeQuestionLimitExceededError } from "@/lib/errors"

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return jsonUnauthorized()
  }

  try {
    const chats = await listChatsForUser(user.id)
    return NextResponse.json({ chats })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load chats"
    return jsonError(message, 500)
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) {
    return jsonUnauthorized()
  }

  let createdChatId: string | null = null

  try {
    const { attachments, content } = await parseChatRequest(request)
    const chat = await createChatForUser(user.id, content || "New chat")
    createdChatId = chat.id

    if (!content && attachments.length === 0) {
      return NextResponse.json({ chat }, { status: 201 })
    }

    const result = await sendMessageAndGetReply(chat.id, user.id, content, {
      attachments,
      isAnonymous: user.is_anonymous ?? false,
    })

    if (!result) {
      throw new Error("Failed to send initial message")
    }

    return NextResponse.json(
      {
        chat: result.updatedChat ?? chat,
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
      },
      { status: 201 }
    )
  } catch (error) {
    if (isFreeQuestionLimitExceededError(error)) {
      if (createdChatId) {
        try {
          await deleteChatForUser(createdChatId, user.id)
        } catch {
          // Keep the limit response visible even if best-effort cleanup fails.
        }
      }

      return jsonError(error.message, 429)
    }

    const message =
      error instanceof Error ? error.message : "Failed to create chat"
    return jsonError(message, 500)
  }
}
