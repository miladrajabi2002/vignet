import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  ArrowRight,
  Bot,
  Check,
  MessagesSquare,
  Plug,
  BookOpen,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { syncOnboarding } from '@/lib/onboarding'
import { ONBOARDING_STEPS, ONBOARDING_TOTAL } from '@/lib/onboarding-steps'
import { OnboardingCelebrate } from '@/components/dashboard/onboarding-celebrate'
import { BusinessProfileStep } from '@/components/onboarding/business-profile-step'
import { cn } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { readBusinessProfile } from '@/lib/verticals/profile'
import type { BusinessTypeValue } from '@/lib/verticals/registry'

const STEP_ICONS = [Bot, BookOpen, MessagesSquare, Plug] as const

export default async function OnboardingPage() {
  const user = await requireUser()
  const t = await getTranslations('onboarding')

  const state = await syncOnboarding(user.workspaceId)
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: user.workspaceId },
    select: { name: true, businessType: true, businessProfile: true },
  })
  const businessProfile = readBusinessProfile(workspace.businessProfile)
  const progress = Math.round((state.step / ONBOARDING_TOTAL) * 100)

  // The step we want the user to do NEXT (0-indexed). If business profile isn't
  // set yet, that takes priority and we don't render a step card at all.
  const needProfile = !state.checks.hasAgent || !businessProfile
  const currentStepIndex = Math.min(state.step, ONBOARDING_TOTAL - 1)
  const currentStep = ONBOARDING_STEPS[currentStepIndex]
  const CurrentIcon = STEP_ICONS[currentStepIndex] ?? Bot

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
          {t('title')}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
        <div className="mx-auto mt-5 h-1.5 max-w-sm overflow-hidden rounded-full bg-[var(--white-05)]">
          <div
            className="h-full rounded-full bg-[var(--white)] transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {t('progress', { done: state.step, total: ONBOARDING_TOTAL })}
        </p>
      </div>

      {state.completed ? (
        <OnboardingCelebrate />
      ) : (
        <>
          {needProfile && (
            <BusinessProfileStep
              workspaceName={workspace.name}
              initialType={workspace.businessType as BusinessTypeValue}
              initialProfile={businessProfile}
            />
          )}

          {/* Current step — one prominent card, NOT all four at once */}
          {!needProfile && (
            <section className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-white shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-4 border-b border-[var(--border-subtle)] bg-[linear-gradient(135deg,var(--accent-soft),white_60%)] px-6 py-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-white shadow-[0_8px_20px_rgba(16,185,129,0.28)]">
                  <CurrentIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent-strong)]">
                    {t('railStep', { n: currentStepIndex + 1, total: ONBOARDING_TOTAL })}
                  </p>
                  <h2 className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">
                    {t(`steps.${currentStep.key}.title`)}
                  </h2>
                </div>
              </div>

              <div className="px-6 py-5">
                <p className="text-sm leading-6 text-[var(--text-secondary)]">
                  {t(`steps.${currentStep.key}.desc`)}
                </p>

                {/* Mini progress dots */}
                <div className="mt-5 flex items-center gap-1.5">
                  {ONBOARDING_STEPS.map((s, i) => {
                    const done = state.checks[s.check]
                    const isCurrent = i === currentStepIndex
                    return (
                      <span
                        key={s.key}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-colors',
                          done ? 'bg-success' : isCurrent ? 'bg-[var(--accent)]' : 'bg-[var(--bg-muted)]',
                        )}
                      />
                    )
                  })}
                </div>

                <Link
                  href={currentStep.href}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--white)] px-5 text-sm font-semibold text-[var(--bg-base)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(10,10,10,0.16)] sm:w-auto"
                >
                  {t(`steps.${currentStep.key}.cta`)}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </div>
            </section>
          )}

          {/* Compact summary of completed steps — keeps a sense of progress without the wall of cards */}
          {state.step > 0 && !needProfile && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-[var(--text-muted)]">
              {ONBOARDING_STEPS.map((s) => {
                const done = state.checks[s.check]
                if (!done) return null
                return (
                  <span key={s.key} className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-white px-2.5 py-1">
                    <Check className="h-3 w-3 text-success" />
                    {t(`steps.${s.key}.title`)}
                  </span>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
