"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"
import { usePathname, useRouter } from "next/navigation"

type ChatNavigationContextValue = {
  showDashboard: boolean
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
  const [showDashboardOnChatRoute, setShowDashboardOnChatRoute] =
    useState(false)
  const showDashboard = pathname?.startsWith("/chat/")
    ? showDashboardOnChatRoute
    : false

  const leaveDeletedChat = useCallback(() => {
    if (!pathname?.startsWith("/chat/")) {
      return
    }

    setShowDashboardOnChatRoute(true)
    router.replace("/")
  }, [pathname, router])

  const value = useMemo(
    () => ({
      showDashboard,
      leaveDeletedChat,
    }),
    [showDashboard, leaveDeletedChat]
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
