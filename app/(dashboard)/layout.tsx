import type { ReactNode } from 'react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { OnboardingRail } from '@/components/dashboard/onboarding-rail'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireUser()

  // Persisted onboarding progress (kept fresh by syncOnboarding) — one cheap
  // indexed read, deliberately NOT the live recompute.
  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { onboardingStep: true, onboardingCompleted: true, businessType: true },
  })
  const showRail = workspace ? !workspace.onboardingCompleted : false

  // NOTE: We intentionally do NOT force-redirect new users to /onboarding here.
  // A layout-level redirect() fires on every navigation — including soft
  // navigations and router.refresh() — which renders a blank page (the bug seen
  // after login and after onboarding mutations) and bounced users off the
  // very onboarding step pages they needed to visit. New users instead land on
  // /overview, which already shows the onboarding checklist inline, and the
  // full /onboarding page stays reachable from there.

  return (
    <div className="dashboard-canvas flex min-h-dvh bg-[var(--bg-base)]">
      <Sidebar businessType={workspace?.businessType} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header name={user.name} businessType={workspace?.businessType} />
        {showRail && <OnboardingRail step={workspace?.onboardingStep ?? 0} />}
        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-7 md:pb-10 lg:px-10">
          <div className="dashboard-main">{children}</div>
        </main>
      </div>
    </div>
  )
}
