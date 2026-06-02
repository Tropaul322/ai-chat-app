"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ChatComposer,
  type ComposerAttachment,
} from "@/components/chat-composer";

function createChatFormData(
  content: string,
  attachments: ComposerAttachment[],
) {
  const formData = new FormData();
  formData.set("message", content);

  for (const attachment of attachments) {
    formData.append("files", attachment.file);
  }

  return formData;
}

export function HomeChat() {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startAnonymousSession() {
    const response = await fetch("/api/auth/anonymous", { method: "POST" });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(data.error ?? "Failed to start anonymous session");
    }
  }

  async function createChat(
    content: string,
    attachments: ComposerAttachment[],
  ) {
    return fetch("/api/chats", {
      method: "POST",
      body: createChatFormData(content, attachments),
    });
  }

  async function handleSend(
    content: string,
    attachments: ComposerAttachment[],
  ) {
    setIsSending(true);
    setError(null);

    try {
      let chatResponse = await createChat(content, attachments);

      if (chatResponse.status === 401) {
        await startAnonymousSession();
        chatResponse = await createChat(content, attachments);
      }

      const chatData = (await chatResponse.json()) as {
        chat?: { id: string };
        error?: string;
      };

      if (!chatResponse.ok || !chatData.chat) {
        throw new Error(chatData.error ?? "Failed to create chat");
      }

      router.push(`/chat/${chatData.chat.id}`);
      router.refresh();
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Failed to start chat",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="w-full max-w-2xl">
      {error ? (
        <p className="mb-2 text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <ChatComposer disabled={isSending} onSend={handleSend} />
    </div>
  );
}
