"use client";

import { marked } from "marked";
import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChatNavigation } from "@/components/chat-navigation-context";
import {
  ChatComposer,
  type ComposerAttachment,
} from "@/components/chat-composer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtimeChats } from "@/hooks/use-realtime-chats";
import type { MessageWithAttachments } from "@/lib/database.types";
import type { RealtimeChatEvent } from "@/lib/realtime/broadcast";
import { cn } from "@/lib/utils";

type ChatViewProps =
  | {
      chatId: string;
      initialMessages: MessageWithAttachments[];
      userId: string;
    }
  | {
      chatId?: undefined;
      initialMessages?: MessageWithAttachments[];
      userId?: string;
    };

function createOptimisticUserMessage(
  chatId: string,
  content: string,
): MessageWithAttachments {
  const now = new Date().toISOString();
  return {
    id: `pending-${crypto.randomUUID()}`,
    chat_id: chatId,
    role: "user",
    content,
    created_at: now,
    updated_at: now,
    metadata: {},
    parent_message_id: null,
    token_count: null,
    attachments: [],
  };
}

function mergeServerMessages(
  current: MessageWithAttachments[],
  optimisticId: string,
  userMessage: MessageWithAttachments,
  assistantMessage: MessageWithAttachments,
) {
  const withoutOptimistic = current.filter(
    (message) => message.id !== optimisticId,
  );
  const next = [...withoutOptimistic];

  for (const message of [userMessage, assistantMessage]) {
    if (!next.some((existing) => existing.id === message.id)) {
      next.push(message);
    }
  }

  return next;
}

function escapeHtml(content: string) {
  return content
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(content: string) {
  return escapeHtml(content).replaceAll('"', "&quot;");
}

function getSafeUrl(href: string) {
  try {
    const url = new URL(href, "https://example.invalid");
    const isRelativeUrl = url.origin === "https://example.invalid";
    const isAllowedProtocol =
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "mailto:";

    if (!isRelativeUrl && !isAllowedProtocol) {
      return null;
    }

    return href;
  } catch {
    return null;
  }
}

const markdownRenderer = new marked.Renderer();

markdownRenderer.link = function ({ href, title, tokens }) {
  const text = this.parser.parseInline(tokens);
  const safeHref = getSafeUrl(href);

  if (!safeHref) {
    return text;
  }

  const titleAttribute = title ? ` title="${escapeAttribute(title)}"` : "";

  return `<a href="${escapeAttribute(
    safeHref,
  )}"${titleAttribute} rel="noreferrer">${text}</a>`;
};

markdownRenderer.image = function ({ text }) {
  return escapeHtml(text);
};

function MarkdownMessage({ content }: { content: string }) {
  const html = useMemo(
    () =>
      marked.parse(escapeHtml(content), {
        async: false,
        breaks: true,
        gfm: true,
        renderer: markdownRenderer,
      }),
    [content],
  );

  return (
    <div
      className="space-y-2 whitespace-normal break-words leading-relaxed [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-background/70 [&_code]:px-1 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ol]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-background/70 [&_pre]:p-3 [&_ul]:ml-5 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MessageAttachments({
  attachments,
}: {
  attachments: MessageWithAttachments["attachments"];
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {attachments.map((attachment) =>
        attachment.attachment_type === "image" && attachment.signed_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={attachment.id}
            src={attachment.signed_url}
            alt={attachment.file_name}
            className="max-h-72 rounded-md object-contain"
          />
        ) : (
          <a
            key={attachment.id}
            href={attachment.signed_url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="flex max-w-full items-center gap-2 rounded-md bg-background/60 px-2 py-1 text-xs underline-offset-4 hover:underline"
          >
            <FileText />
            <span className="truncate">{attachment.file_name}</span>
          </a>
        ),
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: MessageWithAttachments }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.content ? <MarkdownMessage content={message.content} /> : null}
        <MessageAttachments attachments={message.attachments} />
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground animate-in fade-in-0 slide-in-from-bottom-2">
        <span>Thinking</span>
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="chat-thinking-dot size-1 rounded-full bg-current opacity-70" />
          <span className="chat-thinking-dot size-1 rounded-full bg-current opacity-70 [animation-delay:150ms]" />
          <span className="chat-thinking-dot size-1 rounded-full bg-current opacity-70 [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}

function createMessageFormData(
  content: string,
  attachments: ComposerAttachment[],
) {
  const formData = new FormData();
  formData.set("content", content);

  for (const attachment of attachments) {
    formData.append("files", attachment.file);
  }

  return formData;
}

function createChatFormData(content: string, attachments: ComposerAttachment[]) {
  const formData = new FormData();
  formData.set("message", content);

  for (const attachment of attachments) {
    formData.append("files", attachment.file);
  }

  return formData;
}

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

export function ChatView({
  chatId,
  initialMessages = [],
  userId,
}: ChatViewProps) {
  const router = useRouter();
  const { leaveDeletedChat } = useChatNavigation();
  const [messages, setMessages] = useState(initialMessages);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isEmptyState = messages.length === 0 && !isSending;

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleRealtimeEvent = useCallback(
    (event: RealtimeChatEvent) => {
      if (event.event === "chat_deleted") {
        if (chatId && event.payload.id === chatId) {
          leaveDeletedChat();
        }
        return;
      }

      if (event.event !== "message_created") {
        return;
      }

      if (!chatId || event.payload.chat_id !== chatId) {
        return;
      }

      setMessages((current) => {
        if (current.some((message) => message.id === event.payload.id)) {
          return current;
        }

        const serverMessage: MessageWithAttachments = {
          id: event.payload.id,
          chat_id: event.payload.chat_id,
          role: event.payload.role,
          content: event.payload.content,
          created_at: event.payload.created_at,
          updated_at: event.payload.created_at,
          metadata: {},
          parent_message_id: null,
          token_count: null,
          attachments: event.payload.attachments,
        };

        const optimisticIndex = current.findIndex(
          (message) =>
            message.id.startsWith("pending-") &&
            message.role === event.payload.role &&
            message.content === event.payload.content,
        );

        if (optimisticIndex !== -1) {
          const next = [...current];
          next[optimisticIndex] = serverMessage;
          return next;
        }

        return [...current, serverMessage];
      });
    },
    [chatId, leaveDeletedChat],
  );

  useRealtimeChats(userId, handleRealtimeEvent);

  const handleSend = useCallback(
    async (content: string, attachments: ComposerAttachment[]) => {
      const optimisticMessage = createOptimisticUserMessage(
        chatId ?? `pending-chat-${crypto.randomUUID()}`,
        content,
      );

      setMessages((current) => [...current, optimisticMessage]);
      setIsSending(true);
      setError(null);

      try {
        if (!chatId) {
          let response = await createChat(content, attachments);

          if (response.status === 401) {
            await startAnonymousSession();
            response = await createChat(content, attachments);
          }

          const data = (await response.json()) as {
            chat?: { id: string };
            userMessage?: MessageWithAttachments;
            assistantMessage?: MessageWithAttachments;
            error?: string;
          };

          if (!response.ok || !data.chat) {
            throw new Error(data.error ?? "Failed to create chat");
          }

          if (data.userMessage && data.assistantMessage) {
            setMessages((current) =>
              mergeServerMessages(
                current,
                optimisticMessage.id,
                data.userMessage!,
                data.assistantMessage!,
              ),
            );
          }

          router.push(`/chat/${data.chat.id}`);
          router.refresh();
          return;
        }

        const response = await fetch(`/api/chats/${chatId}/messages`, {
          method: "POST",
          body: createMessageFormData(content, attachments),
        });

        const data = (await response.json()) as {
          userMessage?: MessageWithAttachments;
          assistantMessage?: MessageWithAttachments;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to send message");
        }

        if (data.userMessage && data.assistantMessage) {
          setMessages((current) =>
            mergeServerMessages(
              current,
              optimisticMessage.id,
              data.userMessage!,
              data.assistantMessage!,
            ),
          );
        }
      } catch (sendError) {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticMessage.id),
        );
        setError(
          sendError instanceof Error
            ? sendError.message
            : "Failed to send message",
        );
      } finally {
        setIsSending(false);
      }
    },
    [chatId, router],
  );

  if (isEmptyState) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4">
        <div className="flex w-full max-w-2xl flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              What can I help you with?
            </h2>
            <p className="text-sm text-muted-foreground">
              Select a chat from the sidebar or start a new one.
            </p>
          </div>
          <div className="w-full">
            {error ? (
              <p
                className="mb-2 text-center text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <ChatComposer disabled={isSending} onSend={handleSend} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
          {messages.length === 0 && !isSending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Send a message to start the conversation.
            </p>
          ) : messages.length > 0 ? (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          ) : null}
          {isSending ? <ThinkingIndicator /> : null}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t p-4">
        <div className="mx-auto w-full max-w-2xl">
          {error ? (
            <p className="mb-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <ChatComposer disabled={isSending} onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
