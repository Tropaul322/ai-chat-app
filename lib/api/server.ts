import { cookies, headers } from "next/headers"

function mergeHeaders(
  incoming: RequestInit["headers"],
  cookieHeader: string
): Headers {
  const merged = new Headers(incoming)
  if (cookieHeader && !merged.has("cookie")) {
    merged.set("cookie", cookieHeader)
  }
  return merged
}

async function getAppOrigin() {
  const headerStore = await headers()
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")

  if (!host) {
    throw new Error("Missing host header for internal API request")
  }

  const protocol = headerStore.get("x-forwarded-proto") ?? "http"
  return `${protocol}://${host}`
}

export async function fetchApiFromServer<T>(
  path: string,
  init?: Omit<RequestInit, "cache">
) {
  const origin = await getAppOrigin()
  const cookieHeader = (await cookies()).toString()

  const response = await fetch(new URL(path, origin), {
    ...init,
    cache: "no-store",
    headers: mergeHeaders(init?.headers, cookieHeader),
  })

  let payload: T | { error?: string } | null = null
  try {
    payload = (await response.json()) as T | { error?: string }
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error
        : null
    throw new Error(message || `Request failed: ${response.status}`)
  }

  return payload as T
}
