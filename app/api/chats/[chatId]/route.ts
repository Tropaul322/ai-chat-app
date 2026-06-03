import { NextResponse } from "next/server"

import { jsonError, jsonUnauthorized } from "@/lib/api/response"
import { getSessionUser } from "@/lib/auth/session"
import {
  deleteChatForUser,
  getChatForUser,
  listMessagesForChat,
  updateChatForUser,
} from "@/lib/db/chats"

type RouteContext = {
  params: Promise<{ chatId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) {
    return jsonUnauthorized()
  }

  const { chatId } = await context.params

  try {
    const chat = await getChatForUser(chatId, user.id)
    if (!chat) {
      return jsonError("Chat not found", 404)
    }

    const messages = await listMessagesForChat(chatId, user.id)
    return NextResponse.json({ chat, messages })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load chat"
    return jsonError(message, 500)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) {
    return jsonUnauthorized()
  }

  const { chatId } = await context.params
  const body = (await request.json()) as { title?: string }

  if (!body.title?.trim()) {
    return jsonError("Title is required")
  }

  try {
    const chat = await updateChatForUser(chatId, user.id, {
      title: body.title.trim(),
    })

    if (!chat) {
      return jsonError("Chat not found", 404)
    }

    return NextResponse.json({ chat })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update chat"
    return jsonError(message, 500)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser()
  if (!user) {
    return jsonUnauthorized()
  }

  const { chatId } = await context.params

  try {
    const deleted = await deleteChatForUser(chatId, user.id)
    if (!deleted) {
      return jsonError("Chat not found", 404)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete chat"
    return jsonError(message, 500)
  }
}
