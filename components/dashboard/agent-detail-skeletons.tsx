import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Agent-detail route skeletons — exact mirrors of the pages under
 * `/agents/[agentId]` (layout stays mounted during tab switches, so these
 * mirror ONLY the page content below the agent header + tabs):
 * overview playground/setup grid, analytics, channels, settings, improve.
 * Same mobile-style shimmer (staggered per card) as the rest of the dashboard.
 */

/* ── BackButton pill ── */

/** Mirrors BackButton: frosted pill with chevron + label. */
export function BackRowSkeleton({ delay = 0, className }: { delay?: number; className?: string }) {
  return (
    <div className={cn('flex', className)}>
      <Skeleton delay={delay} className="h-9 w-32 rounded-full" />
    </div>
  )
}

/* ── Chat playground (agent overview) ── */

/** Mirrors TestPlayground: h-[540px] window + header + bubbles + composer. */
export function ChatPlaygroundSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex h-[540px] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <Skeleton delay={delay} className="absolute inset-0 rounded-full" />
          </span>
          <div className="min-w-0">
            <Skeleton delay={delay} className="h-3.5 w-24 max-w-full rounded-md" />
            <Skeleton delay={delay} className="mt-1 h-3 w-36 max-w-full rounded-md" />
          </div>
        </div>
        <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={index % 2 === 0 ? 'flex justify-start' : 'flex justify-end'}>
            <Skeleton
              delay={delay - index * 110}
              className={index % 2 === 0 ? 'h-14 w-[70%] rounded-2xl rounded-bl-md' : 'h-10 w-[55%] rounded-2xl rounded-br-md'}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
        <Skeleton delay={delay} className="h-11 min-w-0 flex-1 rounded-xl" />
        <Skeleton delay={delay - 90} className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors the "instant response test" card that wraps the playground. */
export function PlaygroundCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface flex flex-col overflow-hidden rounded-[1.5rem]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
        <div className="min-w-0 space-y-1.5">
          <Skeleton delay={delay} className="h-3 w-24 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-5 w-32 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-52 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-7 w-20 shrink-0 rounded-full" />
      </div>
      <div className="flex-1 p-4 sm:p-5">
        <ChatPlaygroundSkeleton delay={delay - 60} />
      </div>
    </section>
  )
}

/* ── Setup / growth right panel (agent overview) ── */

/** Mirrors AgentSetupPanel: black readiness header + checklist rows. */
export function AgentSetupPanelSkeleton({ delay = 0, steps = 5 }: { delay?: number; steps?: number }) {
  return (
    <section className="spatial-surface overflow-hidden rounded-[1.5rem]">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-black p-5 text-white sm:p-6">
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-5 w-40 rounded-md" />
          <Skeleton delay={delay} className="h-3 w-48 rounded-md" />
        </div>
        <div className="text-start sm:text-end">
          <Skeleton delay={delay} className="h-8 w-16 rounded-lg" />
          <Skeleton delay={delay} className="mt-1.5 h-3 w-20 rounded-md" />
        </div>
      </div>
      <div className="space-y-2.5 border-t border-black/10 p-4 sm:p-5">
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <Skeleton delay={delay} className="h-full w-[62%] rounded-full" />
        </div>
        {Array.from({ length: steps }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 rounded-2xl border border-black/[0.05] bg-[var(--bg-base)] p-3">
            <Skeleton delay={delay - index * 90} className="mt-0.5 h-8 w-8 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton delay={delay - index * 90} className="h-4 w-40 max-w-full rounded-md" />
              <Skeleton delay={delay - index * 90} className="h-3 w-full rounded-md" />
            </div>
            <Skeleton delay={delay - index * 90} className="h-9 w-24 shrink-0 rounded-xl" />
          </div>
        ))}
      </div>
    </section>
  )
}

/** Mirrors AgentGrowthPanel: black header + connections + growth actions. */
export function AgentGrowthPanelSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface overflow-hidden rounded-[1.5rem]">
      <div className="relative overflow-hidden bg-black p-5 text-white sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-md space-y-2">
            <Skeleton delay={delay} className="h-5 w-40 rounded-md" />
            <Skeleton delay={delay} className="h-3.5 w-64 max-w-full rounded-md" />
          </div>
          <Skeleton delay={delay} className="h-9 w-32 shrink-0 rounded-xl" />
        </div>
      </div>
      <div className="space-y-6 p-4 sm:p-5">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Skeleton delay={delay} className="h-4 w-4 rounded-md" />
            <Skeleton delay={delay} className="h-3.5 w-28 rounded-md" />
          </div>
          <div className="space-y-2.5">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-start gap-3 rounded-xl bg-[var(--bg-base)] p-3">
                <Skeleton delay={delay - index * 90} className="h-9 w-9 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton delay={delay - index * 90} className="h-4 w-24 rounded-md" />
                    <Skeleton delay={delay - index * 90} className="h-3 w-32 max-w-full rounded-md" />
                  </div>
                  <Skeleton delay={delay - index * 90} className="h-3 w-40 max-w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <Skeleton delay={delay} className="h-3.5 w-24 rounded-md" />
            <Skeleton delay={delay} className="h-3.5 w-16 rounded-md" />
          </div>
          <div className="space-y-2">
            {[0, 1].map((index) => (
              <div key={index} className="flex items-start gap-3 rounded-xl border border-black/[0.05] p-3">
                <Skeleton delay={delay - index * 120} className="h-9 w-9 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton delay={delay - index * 120} className="h-4 w-44 max-w-full rounded-md" />
                  <Skeleton delay={delay - index * 120} className="h-3 w-full rounded-md" />
                </div>
                <Skeleton delay={delay - index * 120} className="h-8 w-20 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Agent analytics ── */

/** Mirrors the agent analytics StatsCard (section p-5, icon + label + value). */
export function AgentStatCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface rounded-[1.5rem] p-5">
      <div className="flex items-center gap-2 text-xs">
        <Skeleton delay={delay} className="h-4 w-4 rounded-md" />
        <Skeleton delay={delay} className="h-3.5 w-20 max-w-full rounded-md" />
      </div>
      <Skeleton delay={delay} className="mt-2 h-8 w-24 max-w-full rounded-lg" />
    </section>
  )
}

/* ── Agent channels ── */

/** Mirrors the channel-quota card (title/hint + usage + progress bar). */
export function QuotaCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-4 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-56 max-w-full rounded-md" />
        </div>
        <div className="shrink-0 space-y-1.5 text-start sm:text-end">
          <Skeleton delay={delay} className="h-6 w-24 rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-32 rounded-md" />
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
        <Skeleton delay={delay} className="h-full w-[38%] rounded-full" />
      </div>
    </section>
  )
}

/** Mirrors a channel card (WebWidget/ChatLink/Messenger): icon + label + actions. */
export function ChannelCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton delay={delay} className="h-5 w-24 max-w-full rounded-md" />
            <Skeleton delay={delay} className="h-4 w-4 shrink-0 rounded-full" />
          </div>
          <Skeleton delay={delay} className="h-4 w-40 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-11 w-36 rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors ChannelMobileSections: 6 accordion rows (first open) on mobile. */
export function ChannelAccordionSkeleton({ delay = 0, sections = 6 }: { delay?: number; sections?: number }) {
  return (
    <div className="space-y-2 md:hidden" aria-hidden="true">
      {Array.from({ length: sections }).map((_, index) => (
        <section key={index} className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <Skeleton delay={delay - index * 80} className="block h-4 w-28 max-w-full rounded-md" />
              <Skeleton delay={delay - index * 80} className="mt-1.5 block h-3 w-36 max-w-full rounded-md" />
            </span>
            <Skeleton delay={delay - index * 80} className="h-5 w-5 shrink-0 rounded-md" />
          </div>
          {index === 0 && (
            <div className="space-y-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
              <div className="spatial-surface rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Skeleton delay={delay} className="h-9 w-9 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton delay={delay} className="h-4 w-24 rounded-md" />
                    <Skeleton delay={delay} className="h-3.5 w-36 rounded-md" />
                  </div>
                </div>
                <Skeleton delay={delay - 80} className="mt-3 h-11 w-full rounded-xl" />
              </div>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

/** Mirrors the dashed "store integrations" link card at the bottom. */
export function DashedStoreLinkSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-start gap-4 rounded-[1.5rem] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-5 sm:p-6">
      <Skeleton delay={delay} className="mt-0.5 h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton delay={delay} className="h-4 w-28 max-w-full rounded-md" />
        <Skeleton delay={delay} className="h-3.5 w-56 max-w-full rounded-md" />
      </div>
      <Skeleton delay={delay} className="mt-0.5 h-5 w-20 shrink-0 rounded-md" />
    </div>
  )
}

/* ── Agent settings (general) ── */

/** Mirrors a settings form card: title + label/input rows (+ optional switch). */
export function SettingsFormCardSkeleton({
  delay = 0,
  rows = 2,
  title = true,
  switchRow = false,
}: {
  delay?: number
  rows?: number
  title?: boolean
  switchRow?: boolean
}) {
  return (
    <div className="spatial-surface space-y-4 rounded-[1.5rem] p-5 sm:p-6">
      {title && (
        <div className="space-y-1.5">
          <Skeleton delay={delay} className="h-5 w-36 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-64 max-w-full rounded-md" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-1.5">
          <Skeleton delay={delay - index * 90} className="h-3.5 w-20 rounded-md" />
          <Skeleton delay={delay - index * 90} className="h-11 w-full rounded-xl" />
        </div>
      ))}
      {switchRow && (
        <div className="flex items-center justify-between rounded-xl border border-black/[0.05] p-3">
          <div className="space-y-1.5">
            <Skeleton delay={delay} className="h-4 w-32 rounded-md" />
            <Skeleton delay={delay} className="h-3 w-44 rounded-md" />
          </div>
          <Skeleton delay={delay} className="h-6 w-11 rounded-full" />
        </div>
      )}
    </div>
  )
}

/** Mirrors the danger-zone card: icon + title + delete button. */
export function DangerZoneCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Skeleton delay={delay} className="h-9 w-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton delay={delay} className="h-4 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-48 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-11 w-28 shrink-0 rounded-xl" />
      </div>
    </div>
  )
}

/* ── Improve tab ── */

/** Mirrors ImprovementTabs: pill tab bar with a pending badge. */
export function TabPillsBarSkeleton({ delay = 0, tabs = 3 }: { delay?: number; tabs?: number }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 rounded-[1.35rem] border border-black/[0.06] bg-black/[0.035] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:grid-cols-3">
      {Array.from({ length: tabs }).map((_, index) => (
        <div key={index} className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5">
          <Skeleton delay={delay - index * 80} className="h-4 w-4 rounded-md" />
          <Skeleton delay={delay - index * 80} className="h-4 w-20 max-w-full rounded-md" />
          {index === 0 && <Skeleton delay={delay - index * 80} className="h-5 w-6 rounded-full" />}
        </div>
      ))}
    </div>
  )
}

/** Mirrors the improve "behavior" panel: intro card + prompt-engine card. */
export function ImproveBehaviorSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="space-y-6">
      <div className="spatial-surface space-y-5 rounded-[1.5rem] p-5 sm:p-6">
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-5 w-40 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-4/5 rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-2/3 rounded-md" />
        </div>
      </div>
      <div className="spatial-surface space-y-5 rounded-[1.5rem] p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Skeleton delay={delay} className="h-5 w-36 rounded-md" />
          <div className="flex gap-2">
            <Skeleton delay={delay} className="h-11 w-24 rounded-xl" />
            <Skeleton delay={delay - 80} className="h-11 w-28 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 border-b border-[var(--border-subtle)] pb-2 sm:flex sm:flex-wrap">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5">
              <Skeleton delay={delay - index * 70} className="h-3.5 w-3.5 rounded-md" />
              <Skeleton delay={delay - index * 70} className="h-3.5 w-16 max-w-full rounded-md" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Skeleton delay={delay} className="h-3.5 w-24 rounded-md" />
            <Skeleton delay={delay} className="h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton delay={delay - 90} className="h-3.5 w-20 rounded-md" />
            <Skeleton delay={delay - 90} className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Agent wizard (/agents/new) ── */

/** Mirrors AgentWizard: step label + progress + card with fields + nav. */
export function AgentWizardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="mx-auto max-w-4xl">
      <Skeleton delay={delay} className="h-4 w-48 max-w-full rounded-md" />
      <div className="mb-8 mt-2 h-1 overflow-hidden rounded-full bg-black/[0.06]">
        <Skeleton delay={delay} className="h-full w-1/3 rounded-full" />
      </div>
      <div className="spatial-surface space-y-5 rounded-[1.75rem] p-5 sm:p-7">
        <div className="space-y-1.5">
          <Skeleton delay={delay} className="h-3.5 w-20 rounded-md" />
          <Skeleton delay={delay} className="h-11 w-full rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Skeleton delay={delay - 90} className="h-3.5 w-24 rounded-md" />
          <Skeleton delay={delay - 90} className="h-11 w-full rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Skeleton delay={delay - 180} className="h-3.5 w-16 rounded-md" />
          <Skeleton delay={delay - 180} className="h-24 w-full rounded-xl" />
        </div>
        <div className="flex items-center justify-between border-t border-black/[0.05] pt-4">
          <Skeleton delay={delay} className="h-11 w-24 rounded-xl" />
          <Skeleton delay={delay - 80} className="h-11 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
