import { AppShell } from "@/components/app-shell"
import { DashboardPanel } from "@/components/dashboard-panel"
import { fetchApiFromServer } from "@/lib/api/server"
import { getSessionUser } from "@/lib/auth/session"
import { toAppUser, toSidebarChats } from "@/lib/ui/sidebar-data"

export default async function Home() {
  const user = await getSessionUser()
  const chats =
    user
      ? toSidebarChats(
          (
            await fetchApiFromServer<{
              chats: { id: string; title: string; updated_at: string }[];
            }>("/api/chats")
          ).chats,
        )
      : []

  return (
    <AppShell chats={chats} user={user ? toAppUser(user) : null}>
      <DashboardPanel />
    </AppShell>
  )
}
