"use client"

import { useEffect, useRef, useState } from "react"
import { FileText, Paperclip, Send, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"

export type ComposerAttachment = {
  file: File
  id: string
  kind: "image" | "document"
  previewUrl: string | null
}

interface ChatComposerProps extends React.ComponentProps<"div"> {
  disabled?: boolean
  onSend?: (
    message: string,
    attachments: ComposerAttachment[]
  ) => void | Promise<void>
}

export function ChatComposer({
  className,
  disabled = false,
  onSend,
  ...props
}: ChatComposerProps) {
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const attachmentsRef = useRef<ComposerAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(
    () => () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      }
    },
    []
  )

  function addFiles(files: FileList | File[]) {
    const nextAttachments = Array.from(files).map((file) => ({
      file,
      id: crypto.randomUUID(),
      kind: file.type.startsWith("image/") ? ("image" as const) : ("document" as const),
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }))

    setAttachments((current) => [...current, ...nextAttachments])
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const attachment = current.find((item) => item.id === id)
      if (attachment?.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl)
      }
      return current.filter((item) => item.id !== id)
    })
  }

  async function handleSend() {
    const trimmed = message.trim()
    if ((!trimmed && attachments.length === 0) || disabled) {
      return
    }

    const attachmentsToSend = attachments
    setMessage("")
    setAttachments([])
    try {
      await onSend?.(trimmed, attachmentsToSend)
    } finally {
      for (const attachment of attachmentsToSend) {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) {
      return
    }

    addFiles(files)
  }

  return (
    <div className={cn("w-full", className)} {...props}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.txt,.md,.markdown,.csv,.json,application/json,application/pdf,text/*"
        className="sr-only"
        multiple
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          if (event.target.files) {
            addFiles(event.target.files)
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = ""
          }
        }}
      />
      <InputGroup className="h-auto">
        {attachments.length > 0 ? (
          <InputGroupAddon
            align="block-start"
            className="w-full cursor-default flex-wrap justify-start border-b"
          >
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
              >
                {attachment.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.previewUrl}
                    alt=""
                    className="size-5 rounded object-cover"
                  />
                ) : (
                  <FileText />
                )}
                <span className="max-w-36 truncate">{attachment.file.name}</span>
                <InputGroupButton
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Remove ${attachment.file.name}`}
                  onClick={() => removeAttachment(attachment.id)}
                >
                  <X />
                </InputGroupButton>
              </span>
            ))}
          </InputGroupAddon>
        ) : null}
        <InputGroupTextarea
          aria-label="Message"
          placeholder="Ask anything..."
          value={message}
          disabled={disabled}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={3}
        />
        <InputGroupAddon align="block-end" className="w-full justify-between">
          <InputGroupButton
            variant="ghost"
            size="icon-sm"
            aria-label="Attach files"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip />
          </InputGroupButton>
          <InputGroupButton
            size="icon-sm"
            aria-label="Send message"
            disabled={disabled || (!message.trim() && attachments.length === 0)}
            onClick={() => void handleSend()}
          >
            <Send />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
