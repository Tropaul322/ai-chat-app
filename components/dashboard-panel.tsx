import { HomeChat } from "@/components/home-chat"

export function DashboardPanel() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            What can I help you with?
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a chat from the sidebar or start a new one.
          </p>
        </div>
        <HomeChat />
      </div>
    </div>
  )
}
