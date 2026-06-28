import type { ReactNode } from 'react'
import { requireUser } from '@/lib/session'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireUser()

  // NOTE: We intentionally do NOT force-redirect new users to /onboarding here.
  // A layout-level redirect() fires on every navigation — including soft
  // navigations and router.refresh() — which renders a blank page (the bug seen
  // after login and after saving the OpenRouter key) and bounced users off the
  // very onboarding step pages they needed to visit. New users instead land on
  // /overview, which already shows the onboarding checklist inline, and the
  // full /onboarding page stays reachable from there.

  return (
    <div className="flex min-h-screen bg-[var(--bg-base)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header name={user.name} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
