import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import {
  CalendarCheck2,
  Check,
  ArrowRight,
  GraduationCap,
  Instagram,
  MessagesSquare,
  Play,
  ShoppingBag,
} from 'lucide-react'
import { requireUser } from '@/lib/session'
import { syncOnboarding } from '@/lib/onboarding'
import { ONBOARDING_STEPS, ONBOARDING_TOTAL } from '@/lib/onboarding-steps'
import { OnboardingCelebrate } from '@/components/dashboard/onboarding-celebrate'
import { cn } from '@/lib/utils'

export default async function OnboardingPage() {
  const user = await requireUser()
  const t = await getTranslations('onboarding')

  // Recompute + persist on every visit so the stored step is accurate.
  const state = await syncOnboarding(user.workspaceId)
  const progress = Math.round((state.step / ONBOARDING_TOTAL) * 100)

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <div className="text-center">
        <h1 className="text-3xl font-light text-[var(--text-primary)]">
          {t('title')}
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">{t('subtitle')}</p>
        <div className="mx-auto mt-6 h-1.5 max-w-sm overflow-hidden rounded-full bg-[var(--white-05)]">
          <div
            className="h-full bg-[var(--white)] transition-all duration-700"
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
          {!state.checks.hasAgent && (
            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium text-[var(--text-primary)]">{t('goalTitle')}</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{t('goalSubtitle')}</p>
                </div>
                <Link href="/#demo" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
                  <Play className="h-4 w-4" />
                  {t('tryDemo')}
                </Link>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { key: 'instagram', icon: Instagram },
                  { key: 'store', icon: ShoppingBag },
                  { key: 'services', icon: CalendarCheck2 },
                  { key: 'education', icon: GraduationCap },
                  { key: 'messaging', icon: MessagesSquare },
                ].map(({ key, icon: Icon }) => (
                  <Link
                    key={key}
                    href={`/agents/new?business=${key}`}
                    className="group min-h-40 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                  >
                    <Icon className="h-5 w-5 text-[var(--text-secondary)]" />
                    <span className="mt-4 block text-sm font-medium text-[var(--text-primary)]">{t(`goals.${key}.title`)}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{t(`goals.${key}.desc`)}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <ol className="space-y-3">
          {ONBOARDING_STEPS.map((s, i) => {
            const done = state.checks[s.check]
            const isCurrent = !done && state.step === i
            return (
              <li key={s.key}>
                <Link
                  href={s.href}
                  className={cn(
                    'flex items-center gap-4 rounded-2xl border p-5 transition-colors',
                    isCurrent
                      ? 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
                      : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm',
                      done
                        ? 'border-success bg-success/10 text-success'
                        : 'border-[var(--border-hover)] text-[var(--text-secondary)]',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'font-medium',
                        done
                          ? 'text-[var(--text-muted)] line-through'
                          : 'text-[var(--text-primary)]',
                      )}
                    >
                      {t(`steps.${s.key}.title`)}
                    </div>
                    <div className="text-sm text-[var(--text-secondary)]">
                      {t(`steps.${s.key}.desc`)}
                    </div>
                  </div>
                  {!done && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-primary)]">
                      {t(`steps.${s.key}.cta`)}
                      <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
          </ol>
        </>
      )}
    </div>
  )
}
