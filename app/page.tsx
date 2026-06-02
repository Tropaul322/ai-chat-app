import { AppShell } from "@/components/app-shell";
import { DashboardPanel } from "@/components/dashboard-panel";
import type { AppUser, Chat } from "@/components/chat-sidebar";
import { fetchApiFromServer } from "@/lib/api/server";
import { getSessionUser } from "@/lib/auth/session";
import { formatRelativeTime } from "@/lib/ui/relative-time";

function toAppUser(user: {
  id: string;
  email?: string;
  is_anonymous?: boolean;
  user_metadata?: { full_name?: string; avatar_url?: string };
}): AppUser {
  if (!user.email) {
    return user.is_anonymous
      ? {
          id: user.id,
          name: "Guest",
          email: "3 free questions",
          isAnonymous: true,
        }
      : null;
  }

  return {
    id: user.id,
    name: user.user_metadata?.full_name ?? user.email.split("@")[0],
    email: user.email,
    avatarUrl: user.user_metadata?.avatar_url,
  };
}

function toSidebarChats(
  chats: { id: string; title: string; updated_at: string }[],
): Chat[] {
  return chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    timestamp: formatRelativeTime(chat.updated_at),
  }));
}

export default async function Home() {
  const user = await getSessionUser();
  const chats =
    user
      ? toSidebarChats(
          (
            await fetchApiFromServer<{
              chats: { id: string; title: string; updated_at: string }[];
            }>("/api/chats")
          ).chats,
        )
      : [];

  return (
    <AppShell chats={chats} user={user ? toAppUser(user) : null}>
      <DashboardPanel />
    </AppShell>
  );
}
