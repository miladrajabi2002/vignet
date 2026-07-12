import type { ReactNode } from 'react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { getMonthlyMessageCount } from '@/lib/billing/entitlements'
import { getPlanDefs } from '@/lib/billing/plans'

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireUser()

  const workspace = await prisma.workspace.findUnique({
    where: { id: user.workspaceId },
    select: {
      onboardingStep: true,
      onboardingCompleted: true,
      businessType: true,
      plan: true,
      trialEndsAt: true,
      aiCreditBalanceIRR: true,
      subscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { currentPeriodEnd: 'desc' },
        take: 1,
        select: { currentPeriodEnd: true },
      },
    },
  })

  const onboardingDone = workspace?.onboardingCompleted ?? false

  // During onboarding: hide sidebar + header entirely. The user sees ONLY
  // the onboarding flow, full-screen, with its own progress indicator.
  // No menu, no "شروع به کار" link — just the step-by-step setup.
  if (!onboardingDone) {
    return (
      <main className="min-h-dvh bg-[var(--bg-base)]">{children}</main>
    )
  }

  const messagesUsed = await getMonthlyMessageCount(user.workspaceId)
  const plan = workspace?.plan ?? 'TRIAL'
  const planDef = getPlanDefs()[plan]
  const planEnd = plan === 'TRIAL'
    ? workspace?.trialEndsAt
    : workspace?.subscriptions[0]?.currentPeriodEnd
  const daysLeft = planEnd
    ? Math.max(0, Math.ceil((planEnd.getTime() - Date.now()) / 86_400_000))
    : null
  const usagePercent = Math.min(100, Math.round((messagesUsed / planDef.monthlyMessages) * 100))

  // Normal dashboard with sidebar + header
  return (
    <div className="dashboard-canvas flex min-h-dvh bg-[var(--bg-base)]">
      <Sidebar businessType={workspace?.businessType} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          name={user.name}
          businessType={workspace?.businessType}
          plan={plan}
          creditIRR={workspace?.aiCreditBalanceIRR ?? 0}
          usagePercent={usagePercent}
          daysLeft={daysLeft}
        />
        <main className="flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pt-5 md:pb-10 lg:px-8 xl:px-10">
          <div className="dashboard-main">{children}</div>
        </main>
      </div>
    </div>
  )
}
