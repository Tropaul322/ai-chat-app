import { NextResponse } from "next/server"

import { sendMessageAndGetReply } from "@/lib/ai/send-message"
import { parseChatRequest } from "@/lib/api/chat-request"
import { jsonError, jsonUnauthorized } from "@/lib/api/response"
import { getSessionUser } from "@/lib/auth/session"

type RouteContext = {
  params: Promise<{ chatId: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) {
    return jsonUnauthorized()
  }

  const { chatId } = await context.params
  const isAnonymous = user.is_anonymous ?? false

  try {
    const { attachments, content } = await parseChatRequest(request)

    if (!content && attachments.length === 0) {
      return jsonError("Message content or an attachment is required")
    }

    const result = await sendMessageAndGetReply(chatId, user.id, content, {
      attachments,
      isAnonymous,
    })

    if (!result) {
      return jsonError("Chat not found", 404)
    }

    return NextResponse.json(
      {
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
      },
      { status: 201 }
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send message"
    return jsonError(message, 500)
  }
}
