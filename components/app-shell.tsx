"use client"

import { usePathname } from "next/navigation"

import { ChatSidebar } from "@/components/chat-sidebar"
import {
  ChatNavigationProvider,
  useChatNavigation,
} from "@/components/chat-navigation-context"
import { DashboardPanel } from "@/components/dashboard-panel"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import type { AppUser, Chat } from "@/lib/ui/sidebar-data"

interface AppShellProps {
  children: React.ReactNode
  chats: Chat[]
  title?: string
  user: AppUser
}

function AppShellMain({
  children,
  title,
}: {
  children: React.ReactNode
  title?: string
}) {
  const pathname = usePathname()
  const { showDashboard } = useChatNavigation()
  const onChatRoute = pathname?.startsWith("/chat/")

  return (
    <SidebarInset>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        {title ? (
          <h1 className="font-heading truncate text-sm font-semibold">
            {title}
          </h1>
        ) : null}
      </header>
      <div className="flex flex-1 flex-col overflow-auto">
        {showDashboard && onChatRoute ? <DashboardPanel /> : children}
      </div>
    </SidebarInset>
  )
}

export function AppShell({ children, chats, title, user }: AppShellProps) {
  const sidebarKey = chats
    .map((chat) => `${chat.id}:${chat.title}:${chat.timestamp}`)
    .join("|")

  return (
    <ChatNavigationProvider>
      <SidebarProvider>
        <ChatSidebar key={sidebarKey} chats={chats} user={user} />
        <AppShellMain title={title}>{children}</AppShellMain>
      </SidebarProvider>
    </ChatNavigationProvider>
  )
}
