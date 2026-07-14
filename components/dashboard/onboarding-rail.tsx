import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Rocket, ChevronLeft } from 'lucide-react'

/**
 * Slim persistent activation rail shown at the top of every dashboard page
 * until the 4-step onboarding checklist is complete. Uses the *persisted*
 * workspace step (synced opportunistically by syncOnboarding) so it costs the
 * layout a single indexed read, not the full live recompute.
 */
export async function OnboardingRail({ step }: { step: number }) {
  const t = await getTranslations('onboarding')
  const total = 3
  const pct = Math.min(100, Math.round((step / total) * 100))

  return (
    <Link
      href="/onboarding"
      className="group flex items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-2 transition-colors hover:bg-[var(--bg-hover)]"
    >
      <Rocket className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
      <span className="hidden text-xs text-[var(--text-secondary)] sm:block">
        {t('railTitle')}
      </span>
      <span className="text-xs font-medium text-[var(--text-primary)]">
        {t('railStep', { step, total })}
      </span>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--bg-muted)] sm:w-40">
        <span
          className="block h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="ms-auto inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">
        {t('railCta')}
        <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-0 ltr:rotate-180" />
      </span>
    </Link>
  )
}
