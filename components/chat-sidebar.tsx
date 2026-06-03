"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { LogIn, LogOut, MessageSquare, Plus, Trash2 } from "lucide-react";
import { useChatNavigation } from "@/components/chat-navigation-context";
import { useRealtimeChats } from "@/hooks/use-realtime-chats";
import type { RealtimeChatEvent } from "@/lib/realtime/broadcast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export type Chat = {
  id: string;
  title: string;
  timestamp: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  isAnonymous?: boolean;
} | null;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ChatsEmptyState() {
  return (
    <Empty className="border-0 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageSquare />
        </EmptyMedia>
        <EmptyTitle>No chats yet</EmptyTitle>
        <EmptyDescription>
          Start a new conversation to see your history here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function ChatHistory({
  chats,
  activeChatId,
  deletingChatId,
  onDeleteChat,
}: {
  chats: Chat[];
  activeChatId: string | null;
  deletingChatId: string | null;
  onDeleteChat: (chatId: string) => void;
}) {
  if (chats.length === 0) {
    return <ChatsEmptyState />;
  }

  return (
    <SidebarMenu>
      {chats.map((chat) => (
        <SidebarMenuItem key={chat.id}>
          <SidebarMenuButton
            size="lg"
            className="h-auto py-2"
            isActive={chat.id === activeChatId}
            asChild
          >
            <Link href={`/chat/${chat.id}`}>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span className="truncate font-medium">{chat.title}</span>
                <span className="shrink-0 text-xs text-sidebar-foreground/50 tabular-nums">
                  {chat.timestamp}
                </span>
              </div>
            </Link>
          </SidebarMenuButton>
          <SidebarMenuAction
            showOnHover
            disabled={deletingChatId === chat.id}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDeleteChat(chat.id);
            }}
            aria-label={`Delete ${chat.title}`}
            title="Delete chat"
          >
            <Trash2 />
          </SidebarMenuAction>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function UserFooter({ user }: { user: NonNullable<AppUser> }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const initials = getInitials(user.name);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex w-full items-center gap-0.5">
          <SidebarMenuButton size="lg" className="h-auto min-w-0 flex-1 py-2">
            <Avatar size="sm">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name} />
              ) : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-sidebar-foreground/60">
                {user.email}
              </span>
            </div>
          </SidebarMenuButton>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            aria-label={isLoggingOut ? "Logging out" : "Log out"}
            title="Log out"
          >
            <LogOut />
          </Button>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function LoginFooter() {
  return (
    <Button variant="outline" size="sm" className="w-full" asChild>
      <Link href="/login">
        <LogIn data-icon="inline-start" />
        Log in
      </Link>
    </Button>
  );
}

interface ChatSidebarProps {
  chats: Chat[];
  user: AppUser;
}

function applyRealtimeEvent(chats: Chat[], event: RealtimeChatEvent): Chat[] {
  switch (event.event) {
    case "chat_created":
      return [
        {
          id: event.payload.id,
          title: event.payload.title,
          timestamp: "Just now",
        },
        ...chats.filter((chat) => chat.id !== event.payload.id),
      ];
    case "chat_updated":
      return chats.map((chat) =>
        chat.id === event.payload.id
          ? { ...chat, title: event.payload.title, timestamp: "Just now" }
          : chat,
      );
    case "chat_deleted":
      return chats.filter((chat) => chat.id !== event.payload.id);
    case "message_created":
      return chats.map((chat) =>
        chat.id === event.payload.chat_id
          ? { ...chat, timestamp: "Just now" }
          : chat,
      );
  }
}

export function ChatSidebar({ chats: initialChats, user }: ChatSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { leaveDeletedChat } = useChatNavigation();
  const [chats, setChats] = useState(initialChats);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);

  const activeChatId = pathname?.startsWith("/chat/")
    ? (pathname.split("/")[2] ?? null)
    : null;

  const handleRealtimeEvent = useCallback(
    (event: RealtimeChatEvent) => {
      setChats((current) => applyRealtimeEvent(current, event));

      if (event.event === "chat_created") {
        router.push(`/chat/${event.payload.id}`);
        return;
      }

      if (event.event === "chat_deleted" && event.payload.id === activeChatId) {
        leaveDeletedChat();
      }
    },
    [activeChatId, leaveDeletedChat, router],
  );

  useRealtimeChats(user?.id, handleRealtimeEvent);

  async function handleDeleteChat(chatId: string) {
    const chat = chats.find((item) => item.id === chatId);
    if (
      !chat ||
      !window.confirm(
        `Delete "${chat.title}"? This removes all messages and cannot be undone.`,
      )
    ) {
      return;
    }

    setDeletingChatId(chatId);

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        return;
      }

      setChats((current) => current.filter((item) => item.id !== chatId));

      if (activeChatId === chatId) {
        leaveDeletedChat();
      } else {
        router.refresh();
      }
    } finally {
      setDeletingChatId(null);
    }
  }

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <MessageSquare />
              </div>
              <span className="font-heading font-semibold">AI Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/">
                <Plus />
                New Chat
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="flex min-h-0 flex-1 flex-col">
          <SidebarGroupLabel>History</SidebarGroupLabel>
          <SidebarGroupContent className="min-h-0 flex-1">
            <ChatHistory
              chats={chats}
              activeChatId={activeChatId}
              deletingChatId={deletingChatId}
              onDeleteChat={handleDeleteChat}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {user && !user.isAnonymous ? (
          <UserFooter user={user} />
        ) : (
          <LoginFooter />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
