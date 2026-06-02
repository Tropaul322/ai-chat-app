import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai"

import type { MessageRow } from "@/lib/database.types"
import type { PendingMessageAttachment } from "@/lib/db/chats"

const MODEL = "gemini-3.1-flash-lite"

function getClient() {
  const apiKey = process.env.GENAI_API_KEY
  if (!apiKey) {
    throw new Error("GENAI_API_KEY is not configured")
  }

  return new GoogleGenerativeAI(apiKey)
}

function toGeminiHistory(
  messages: Pick<MessageRow, "role" | "content">[]
): Content[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: message.content }],
    }))
}

export async function generateGeminiReply(
  history: Pick<MessageRow, "role" | "content">[],
  userMessage: string,
  attachments: PendingMessageAttachment[] = []
): Promise<string> {
  const genAI = getClient()
  const model = genAI.getGenerativeModel({ model: MODEL })
  const chat = model.startChat({ history: toGeminiHistory(history) })
  const parts: Part[] = [
    {
      text:
        attachments.length > 0
          ? `${userMessage || "Please use the attached files as context."}\n\nUse any attached images or documents as context for your answer.`
          : userMessage,
    },
    ...attachments.map((attachment) => ({
      inlineData: {
        data: attachment.data.toString("base64"),
        mimeType: attachment.mimeType,
      },
    })),
  ]
  const result = await chat.sendMessage(parts)
  const text = result.response.text()

  if (!text.trim()) {
    throw new Error("Gemini returned an empty response")
  }

  return text
}
