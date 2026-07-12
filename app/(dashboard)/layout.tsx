import type { ReactNode } from 'react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireUser()

  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: { onboardingStep: true, onboardingCompleted: true, businessType: true },
  })

  const onboardingDone = workspace?.onboardingCompleted ?? false

  // During onboarding: hide sidebar + header entirely. The user sees ONLY
  // the onboarding flow, full-screen, with its own progress indicator.
  // No menu, no "شروع به کار" link — just the step-by-step setup.
  if (!onboardingDone) {
    return (
      <div className="min-h-dvh bg-[var(--bg-base)]">
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>
    )
  }

  // Normal dashboard with sidebar + header
  return (
    <div className="dashboard-canvas flex min-h-dvh bg-[var(--bg-base)]">
      <Sidebar businessType={workspace?.businessType} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header name={user.name} businessType={workspace?.businessType} />
        <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-7 md:pb-10 lg:px-10">
          <div className="dashboard-main">{children}</div>
        </main>
      </div>
    </div>
  )
}
