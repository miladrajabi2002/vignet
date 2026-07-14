import type { ReactNode } from 'react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { computeOnboarding } from '@/lib/onboarding'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { OnboardingShell } from '@/components/onboarding/onboarding-shell'
import { VerticalChangeNotice } from '@/components/dashboard/vertical-change-notice'
import { getEffectivePlanDefs } from '@/lib/billing/plans'

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
      createdAt: true,
      businessProfile: true,
      subscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { currentPeriodEnd: 'desc' },
        take: 1,
        select: { createdAt: true, currentPeriodEnd: true },
      },
    },
  })

  const onboardingDone = workspace?.onboardingCompleted ?? false
  const businessProfile = readBusinessProfile(workspace?.businessProfile)

  // During onboarding: hide sidebar + header entirely. The user sees ONLY
  // the onboarding flow, full-screen, with its own progress indicator.
  // No menu, no "شروع به کار" link — just the step-by-step setup.
  if (!onboardingDone) {
    const state = await computeOnboarding(user.workspaceId)
    return (
      <OnboardingShell
        profileComplete={!!businessProfile}
        hasAgent={state.checks.hasAgent}
        hasKnowledge={state.checks.hasKnowledge}
        hasChannel={state.checks.hasChannel}
      >
        {children}
      </OnboardingShell>
    )
  }

  const plan = workspace?.plan ?? 'TRIAL'
  const planEnd = plan === 'TRIAL'
    ? workspace?.trialEndsAt
    : workspace?.subscriptions[0]?.currentPeriodEnd
  const subscriptionCreatedAt = workspace?.subscriptions[0]?.createdAt
  const paidCycleStart = planEnd
    ? new Date(planEnd.getTime() - 30 * 86_400_000)
    : null
  const planStart = plan === 'TRIAL'
    ? workspace?.createdAt
    : subscriptionCreatedAt && paidCycleStart
      ? new Date(Math.max(subscriptionCreatedAt.getTime(), paidCycleStart.getTime()))
      : paidCycleStart
  const daysLeft = planEnd
    ? Math.max(0, Math.ceil((planEnd.getTime() - Date.now()) / 86_400_000))
    : null
  // Credit percentage: how much of the plan's included credit remains.
  // (Was time-based; now reflects actual AI credit balance so the progress
  // bar in the header tracks real spending, not the billing cycle.)
  const planDefs = getEffectivePlanDefs()
  const includedCreditIRR = planDefs[plan]?.includedCreditIRR ?? 100_000
  const creditBalanceIRR = workspace?.aiCreditBalanceIRR ?? 0
  const remainingPercent = includedCreditIRR > 0
    ? Math.max(0, Math.min(100, Math.round((creditBalanceIRR / includedCreditIRR) * 100)))
    : 0

  // Normal dashboard with sidebar + header
  return (
    <div className="dashboard-canvas flex min-h-dvh bg-[var(--bg-base)]">
      <Sidebar businessType={workspace?.businessType} services={businessProfile?.services} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          name={user.name}
          businessType={workspace?.businessType}
          services={businessProfile?.services}
          plan={plan}
          creditIRR={workspace?.aiCreditBalanceIRR ?? 0}
          remainingPercent={remainingPercent}
          daysLeft={daysLeft}
        />
        <VerticalChangeNotice
          businessType={workspace?.businessType}
          services={businessProfile?.services ?? []}
        />
        <main className="flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pt-5 md:pb-10 lg:px-8 xl:px-10">
          <div className="dashboard-main">{children}</div>
        </main>
      </div>
    </div>
  )
}
