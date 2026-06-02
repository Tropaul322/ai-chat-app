import type { PendingMessageAttachment } from "@/lib/db/chats"

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
const MAX_ATTACHMENT_COUNT = 5
const MAX_TOTAL_ATTACHMENT_SIZE = 20 * 1024 * 1024

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/json",
  "application/pdf",
  "text/csv",
  "text/markdown",
  "text/plain",
])

function getAttachmentType(mimeType: string) {
  return mimeType.startsWith("image/") ? "image" : "document"
}

function inferMimeType(file: File) {
  if (file.type) {
    return file.type
  }

  const extension = file.name.split(".").pop()?.toLowerCase()

  switch (extension) {
    case "csv":
      return "text/csv"
    case "gif":
      return "image/gif"
    case "jpeg":
    case "jpg":
      return "image/jpeg"
    case "json":
      return "application/json"
    case "md":
    case "markdown":
      return "text/markdown"
    case "pdf":
      return "application/pdf"
    case "png":
      return "image/png"
    case "txt":
      return "text/plain"
    case "webp":
      return "image/webp"
    default:
      return "application/octet-stream"
  }
}

function isAllowedAttachment(mimeType: string) {
  return (
    ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType) ||
    (mimeType.startsWith("text/") && !mimeType.includes("html"))
  )
}

function validateAttachmentBatch(files: File[]) {
  if (files.length > MAX_ATTACHMENT_COUNT) {
    throw new Error(`You can attach up to ${MAX_ATTACHMENT_COUNT} files`)
  }

  const totalSize = files.reduce((total, file) => total + file.size, 0)
  if (totalSize > MAX_TOTAL_ATTACHMENT_SIZE) {
    throw new Error("Attachments cannot exceed 20 MB total")
  }
}

async function toPendingAttachment(file: File): Promise<PendingMessageAttachment> {
  const mimeType = inferMimeType(file)

  if (!isAllowedAttachment(mimeType)) {
    throw new Error(`${file.name} is not a supported attachment type`)
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error(`${file.name} is larger than 10 MB`)
  }

  return {
    attachmentType: getAttachmentType(mimeType),
    data: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
    fileSize: file.size,
    mimeType,
  }
}

export async function parseChatRequest(request: Request): Promise<{
  attachments: PendingMessageAttachment[]
  content: string
}> {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData()
    const contentValue = formData.get("content") ?? formData.get("message")
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File)

    validateAttachmentBatch(files)

    return {
      attachments: await Promise.all(files.map(toPendingAttachment)),
      content: typeof contentValue === "string" ? contentValue.trim() : "",
    }
  }

  const body = (await request.json().catch(() => ({}))) as {
    content?: string
    message?: string
  }

  return {
    attachments: [],
    content: (body.message ?? body.content ?? "").trim(),
  }
}
