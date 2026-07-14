import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { computeOnboarding } from '@/lib/onboarding'
import { readBusinessProfile } from '@/lib/verticals/profile'
import { OnboardingShell } from '@/components/onboarding/onboarding-shell'
import { VerticalChangeNotice } from '@/components/dashboard/vertical-change-notice'
import { getEffectivePlanDefs } from '@/lib/billing/plans'

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
}

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
  const daysLeft = planEnd
    ? Math.max(0, Math.ceil((planEnd.getTime() - Date.now()) / 86_400_000))
    : null
  // Credit percentage: how much of the plan's included credit remains.
  // (Was time-based; now reflects actual AI credit balance so the progress
  // bar in the header tracks real spending, not the billing cycle.)
  const planDefs = await getEffectivePlanDefs()
  const includedCreditIRR = planDefs[plan]?.includedCreditIRR ?? 100_000
  const creditBalanceIRR = workspace?.aiCreditBalanceIRR ?? 0
  const remainingPercent = includedCreditIRR > 0
    ? Math.max(0, Math.min(100, Math.round((creditBalanceIRR / includedCreditIRR) * 100)))
    : 0
  const accessExpired = plan === 'TRIAL'
    ? Boolean(workspace?.trialEndsAt && workspace.trialEndsAt < new Date())
    : Boolean(planEnd && planEnd < new Date())

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
        {accessExpired && (
          <div className="mx-4 mt-3 flex flex-col gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-950 shadow-[var(--shadow-xs)] sm:mx-6 sm:flex-row sm:items-center lg:mx-8 xl:mx-10">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">اطلاعات شما محفوظ است؛ فضای کاری در حالت فقط‌خواندنی قرار دارد.</p>
              <p className="mt-0.5 text-xs leading-6 text-amber-900/75">مشاهده گزارش‌ها و داده‌های قبلی ادامه دارد، اما پاسخ خودکار و تغییرات جدید تا فعال‌سازی پلن متوقف می‌ماند.</p>
            </div>
            <Link href="/billing" className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-black px-4 text-xs font-bold text-white">
              فعال‌سازی دوباره
            </Link>
          </div>
        )}
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
