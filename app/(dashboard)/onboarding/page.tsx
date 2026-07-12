import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { syncOnboarding } from '@/lib/onboarding'
import { ONBOARDING_STEPS, ONBOARDING_TOTAL } from '@/lib/onboarding-steps'
import { OnboardingCelebrate } from '@/components/dashboard/onboarding-celebrate'
import { BusinessProfileStep } from '@/components/onboarding/business-profile-step'
import { cn } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { readBusinessProfile } from '@/lib/verticals/profile'
import type { BusinessTypeValue } from '@/lib/verticals/registry'

export default async function OnboardingPage() {
  const user = await requireUser()
  const t = await getTranslations('onboarding')

  const state = await syncOnboarding(user.workspaceId)
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: user.workspaceId },
    select: { name: true, businessType: true, businessProfile: true },
  })
  const businessProfile = readBusinessProfile(workspace.businessProfile)

  // The step we want the user to do NEXT. If business profile isn't set yet,
  // that takes priority and we show the BusinessProfileStep (full-screen,
  // no header per user request).
  const needProfile = !state.checks.hasAgent || !businessProfile
  const currentStepIndex = Math.min(state.step, ONBOARDING_TOTAL - 1)
  const currentStep = ONBOARDING_STEPS[currentStepIndex]

  return (
    <div className="mx-auto max-w-3xl py-6">
      {state.completed ? (
        <OnboardingCelebrate />
      ) : needProfile ? (
        <BusinessProfileStep
          workspaceName={workspace.name}
          initialType={workspace.businessType as BusinessTypeValue}
          initialProfile={businessProfile}
        />
      ) : (
        // Post-profile steps: simple step card without a page header
        <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="px-6 py-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {t('railStep', { n: currentStepIndex + 1, total: ONBOARDING_TOTAL })}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
              {t(`steps.${currentStep.key}.title`)}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">
              {t(`steps.${currentStep.key}.desc`)}
            </p>

            {/* Mini progress dots */}
            <div className="mt-4 flex items-center gap-1.5">
              {ONBOARDING_STEPS.map((s, i) => {
                const done = state.checks[s.check]
                const isCurrent = i === currentStepIndex
                return (
                  <span
                    key={s.key}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors duration-200',
                      done ? 'bg-[var(--text-primary)]' : isCurrent ? 'bg-[var(--text-secondary)]' : 'bg-[var(--bg-muted)]',
                    )}
                  />
                )
              })}
            </div>

            <a
              href={currentStep.href}
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--text-primary)] px-5 text-sm font-medium text-white transition-colors duration-150 hover:bg-black"
            >
              {t(`steps.${currentStep.key}.cta`)}
            </a>
          </div>
        </section>
      )}
    </div>
  )
}
