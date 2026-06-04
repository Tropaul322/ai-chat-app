"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react"
import { usePathname, useRouter } from "next/navigation"

type ChatNavigationContextValue = {
  leaveDeletedChat: () => void
}

const ChatNavigationContext =
  createContext<ChatNavigationContextValue | null>(null)

export function ChatNavigationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const leaveDeletedChat = useCallback(() => {
    if (!pathname?.startsWith("/chat/")) {
      return
    }

    router.replace("/")
  }, [pathname, router])

  const value = useMemo(
    () => ({
      leaveDeletedChat,
    }),
    [leaveDeletedChat]
  )

  return (
    <ChatNavigationContext.Provider value={value}>
      {children}
    </ChatNavigationContext.Provider>
  )
}

export function useChatNavigation() {
  const context = useContext(ChatNavigationContext)
  if (!context) {
    throw new Error(
      "useChatNavigation must be used within ChatNavigationProvider"
    )
  }
  return context
}
