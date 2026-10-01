import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Header } from '@/components/dashboard/header'
import { computeOnboarding } from '@/lib/onboarding'
import { readBusinessProfile, workspaceCapabilities } from '@/lib/verticals/profile'
import { OnboardingShell } from '@/components/onboarding/onboarding-shell'
import { VerticalChangeNotice } from '@/components/dashboard/vertical-change-notice'
import { ScopedIntlProvider } from '@/components/i18n/scoped-intl-provider'
import { DASHBOARD_CLIENT_MESSAGE_PATHS } from '@/lib/i18n/client-messages'
import { ImpersonationBanner } from '@/components/dashboard/impersonation-banner'
import { GlobalUndoToast } from '@/components/ui/global-undo-toast'
import { ScrollRestoration } from '@/components/dashboard/scroll-restoration'
import { DashboardPageEffects } from '@/components/dashboard/dashboard-page-effects'
import { ModuleAccessBanner } from '@/components/dashboard/module-access-banner'
import { MotionPauser } from '@/components/marketing/site/motion-pauser'

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireUser()
  const t = await getTranslations('dashboard')

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
  const businessProfile = readBusinessProfile(workspace?.businessProfile, workspace?.businessType)
  const capabilities = workspaceCapabilities(workspace)

  // During onboarding: hide sidebar + header entirely. The user sees ONLY
  // the onboarding flow, full-screen, with its own progress indicator.
  // No menu, no "شروع به کار" link — just the step-by-step setup.
  if (!onboardingDone) {
    const state = await computeOnboarding(user.workspaceId)
    return (
      <ScopedIntlProvider messagePaths={DASHBOARD_CLIENT_MESSAGE_PATHS}>
      <OnboardingShell
        profileComplete={!!businessProfile}
        hasAgent={state.checks.hasAgent}
        hasKnowledge={state.checks.hasKnowledge}
        hasChannel={state.checks.hasChannel}
      >
        {user.impersonatedByAdmin && (
          <div className="px-3 pt-3 sm:px-5">
            <div className="mx-auto max-w-6xl">
              <ImpersonationBanner userName={user.name ?? user.phone} />
            </div>
          </div>
        )}
        {children}
      </OnboardingShell>
      </ScopedIntlProvider>
    )
  }

  // Conversations handed to a human — shown as a count on the Conversations
  // nav item (desktop rail + phone bar). Served by @@index([workspaceId, status]).
  // A live Instagram channel promotes Instagram into the phone bar.
  const [handedOffCount, instagramChannel] = await Promise.all([
    prisma.conversation.count({
      where: { workspaceId: user.workspaceId, status: 'HANDED_OFF' },
    }),
    prisma.agentChannel.findFirst({
      where: { type: 'INSTAGRAM', active: true, agent: { workspaceId: user.workspaceId } },
      select: { id: true },
    }),
  ])

  const plan = workspace?.plan ?? 'TRIAL'
  const planEnd = plan === 'TRIAL'
    ? workspace?.trialEndsAt
    : workspace?.subscriptions[0]?.currentPeriodEnd
  const daysLeft = planEnd
    ? Math.max(0, Math.ceil((planEnd.getTime() - Date.now()) / 86_400_000))
    : null
  const accessExpired = plan === 'TRIAL'
    ? Boolean(workspace?.trialEndsAt && workspace.trialEndsAt < new Date())
    : Boolean(planEnd && planEnd < new Date())

  // Normal dashboard with sidebar + header
  return (
    <ScopedIntlProvider messagePaths={DASHBOARD_CLIENT_MESSAGE_PATHS}>
    <div className="dashboard-canvas vg-motion flex min-h-dvh bg-[var(--bg-base)]">
      {/* Keyboard users can jump past the sidebar/header chrome in one Tab. */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:inset-x-0 focus:top-2 focus:z-[80] focus:m-auto focus:block focus:w-fit focus:rounded-xl focus:bg-black focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t('skipToContent')}
      </a>
      <Sidebar businessType={workspace?.businessType} capabilities={capabilities} handedOffCount={handedOffCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          name={user.name}
          businessType={workspace?.businessType}
          capabilities={capabilities}
          plan={plan}
          creditIRR={workspace?.aiCreditBalanceIRR ?? 0}
          daysLeft={daysLeft}
          handedOffCount={handedOffCount}
          instagramConnected={Boolean(instagramChannel)}
          impersonatedUserName={user.impersonatedByAdmin ? (user.name ?? user.phone) : undefined}
        />
        {accessExpired && (
          <div className="dashboard-shell-content mt-3">
            <div className="dashboard-main flex flex-col gap-3 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-950 shadow-[var(--shadow-xs)] sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{t('readOnlyTitle')}</p>
                <p className="mt-0.5 text-xs leading-6 text-amber-900/75">{t('readOnlyBody')}</p>
              </div>
              <Link href="/billing" className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-black px-4 text-xs font-bold text-white">
                {t('readOnlyAction')}
              </Link>
            </div>
          </div>
        )}
        <VerticalChangeNotice
          businessType={workspace?.businessType}
          capabilities={capabilities}
        />
        <main id="dashboard-main" tabIndex={-1} className="dashboard-shell-content flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:pt-5 md:pb-10 focus:outline-none">
          <div className="dashboard-main">
            <ModuleAccessBanner businessType={workspace?.businessType} capabilities={capabilities} />
            {children}
          </div>
        </main>
        <DashboardPageEffects />
        {/* Undo offers for every delete (single + bulk) — lives here so it
            survives navigation. Scroll restore brings list pages back to the
            user's exact position on back navigation. */}
        <GlobalUndoToast />
        <ScrollRestoration />
        {/* Starts the `.vg-anim` demos (overview, empty states) only while on
            screen; without it they sat paused on their first frame. */}
        <MotionPauser />
      </div>
    </div>
    </ScopedIntlProvider>
  )
}
