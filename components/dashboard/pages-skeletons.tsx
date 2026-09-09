import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { BackRowSkeleton } from '@/components/dashboard/agent-detail-skeletons'

/**
 * Route skeletons for the remaining user-dashboard pages: integrations,
 * instagram (manager + forms), services, settings, menu, vigento,
 * onboarding, contact/conversation detail, products detail + orders +
 * categories + new. Exact mirrors of each page's wrappers and cards,
 * sharing the mobile-style shimmer primitive.
 */

/* ── Integrations page ── */

/** Mirrors a channel tile on /integrations: icon + status + name + desc. */
export function ChannelTileSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface group flex flex-col gap-3 rounded-[1.5rem] p-5">
      <div className="flex items-center justify-between">
        <Skeleton delay={delay} className="h-10 w-10 rounded-xl" />
        <Skeleton delay={delay} className="h-4 w-20 rounded-md" />
      </div>
      <div className="space-y-1.5">
        <Skeleton delay={delay} className="h-4 w-24 max-w-full rounded-md" />
        <Skeleton delay={delay} className="h-3.5 w-40 max-w-full rounded-md" />
      </div>
    </div>
  )
}

/** Mirrors the empty-state card of StoreIntegrationsSection. */
export function StoreEmptyCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 text-center sm:p-6">
      <Skeleton delay={delay} className="mx-auto h-11 w-11 rounded-2xl" />
      <Skeleton delay={delay} className="mx-auto mt-4 h-5 w-44 max-w-full rounded-md" />
      <Skeleton delay={delay} className="mx-auto mt-2 h-3.5 w-64 max-w-full rounded-md" />
      <Skeleton delay={delay} className="mx-auto mt-4 h-11 w-32 rounded-xl" />
    </section>
  )
}

/** Mirrors the store-section footer help row. */
export function StoreFooterSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton delay={delay} className="h-3.5 w-56 max-w-full rounded-md" />
        <Skeleton delay={delay} className="h-3.5 w-12 shrink-0 rounded-md" />
      </div>
    </div>
  )
}

/** Mirrors the "کانال‌ها" section heading row with its management link. */
export function SectionHeadingRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Skeleton delay={delay} className="h-4 w-20 rounded-md" />
      <div className="flex items-center gap-1">
        <Skeleton delay={delay} className="h-3.5 w-24 rounded-md" />
        <Skeleton delay={delay} className="h-3.5 w-3.5 rounded-md" />
      </div>
    </div>
  )
}

/** Mirrors the connected IntegrationCard (top row + nav links + recent logs). */
export function IntegrationCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0">
            <Skeleton delay={delay} className="h-5 w-44 max-w-full rounded-md" />
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Skeleton delay={delay} className="h-5 w-20 rounded-full" />
              <Skeleton delay={delay} className="h-3.5 w-32 rounded-md" />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Skeleton delay={delay} className="h-11 w-24 rounded-xl" />
          <Skeleton delay={delay - 80} className="h-11 w-20 rounded-xl" />
          <Skeleton delay={delay - 160} className="h-11 w-20 rounded-xl" />
        </div>
      </div>
      {/* Store management links (products / orders) */}
      <nav className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
        <Skeleton delay={delay - 80} className="h-11 w-36 rounded-xl" />
        <Skeleton delay={delay - 140} className="h-11 w-36 rounded-xl" />
      </nav>
      {/* Recent sync events (last 3 days) */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <Skeleton delay={delay - 120} className="h-3.5 w-32 rounded-md" />
          <Skeleton delay={delay - 120} className="h-3.5 w-16 rounded-md" />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2">
              <Skeleton delay={delay - 120 - index * 60} className="h-3.5 w-3.5 shrink-0 rounded-full" />
              <Skeleton delay={delay - 120 - index * 60} className="h-3.5 w-20 rounded-md" />
              <Skeleton delay={delay - 120 - index * 60} className="h-3.5 w-12 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Mirrors the whole store-integrations section (header + card + footer). */
export function StoreSectionSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton delay={delay} className="h-4 w-40 rounded-md" />
        <div className="flex items-center gap-1">
          <Skeleton delay={delay} className="h-3.5 w-3.5 rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-24 rounded-md" />
        </div>
      </div>
      <IntegrationCardSkeleton delay={delay - 80} />
      <StoreFooterSkeleton delay={delay - 160} />
    </div>
  )
}

/* ── Instagram manager ── */

/** Mirrors ChannelSettingsCard (open by default): header + settings tabs +
 *  reply-policy cards + stop-words field. */
export function CollapsibleSettingsCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-black/[0.06] bg-white/75 shadow-[0_22px_60px_-44px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="flex min-h-[4.75rem] w-full items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3">
          <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-2xl" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton delay={delay} className="h-4 w-32 max-w-full rounded-md" />
              <Skeleton delay={delay} className="h-3.5 w-20 rounded-md" />
            </div>
            <Skeleton delay={delay} className="h-3.5 w-48 max-w-full rounded-md" />
          </div>
        </div>
        <Skeleton delay={delay} className="h-8 w-8 shrink-0 rounded-full" />
      </div>
      <div className="space-y-5 border-t border-black/[0.05] bg-[linear-gradient(180deg,rgba(250,250,251,0.7),rgba(255,255,255,0.92))] px-5 py-5 sm:px-6 sm:py-6">
        {/* Settings tabs (grid-cols-2 → sm:4) */}
        <div className="grid grid-cols-2 gap-1.5 rounded-[1.2rem] border border-black/[0.05] bg-black/[0.035] p-1.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex min-h-[3.75rem] items-center gap-2.5 rounded-[0.95rem] bg-white px-3 py-2.5">
              <Skeleton delay={delay - index * 80} className="h-4 w-4 shrink-0 rounded-md" />
              <div className="min-w-0 space-y-1">
                <Skeleton delay={delay - index * 80} className="h-3.5 w-16 max-w-full rounded-md" />
                <Skeleton delay={delay - index * 80} className="h-3 w-20 max-w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
        {/* Reply policy cards (sm:grid-cols-3) */}
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-3.5 w-28 rounded-md" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex min-h-[8.5rem] flex-col items-start gap-2 rounded-2xl border border-black/[0.07] bg-white p-4">
                <Skeleton delay={delay - index * 90} className="h-8 w-8 rounded-lg" />
                <div className="space-y-1.5">
                  <Skeleton delay={delay - index * 90} className="h-3.5 w-20 max-w-full rounded-md" />
                  <Skeleton delay={delay - index * 90} className="h-3 w-28 max-w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Stop words */}
        <div className="space-y-1.5">
          <Skeleton delay={delay} className="h-3.5 w-20 rounded-md" />
          <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white px-3 py-2.5">
            {[0, 1].map((index) => (
              <Skeleton key={index} delay={delay - index * 70} className="h-6 w-16 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Mirrors the scenarios section: header row + 3-tab bar + 2 scenario cards. */
export function ScenariosSectionSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface space-y-4 rounded-[1.5rem] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Skeleton delay={delay} className="h-4 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-44 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-11 w-36 shrink-0 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-1.5 rounded-[1.35rem] border border-black/[0.06] bg-black/[0.035] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5">
            <Skeleton delay={delay - index * 80} className="h-4 w-4 rounded-md" />
            <Skeleton delay={delay - index * 80} className="h-4 w-16 max-w-full rounded-md" />
          </div>
        ))}
      </div>
      {/* Scenario card list (xl:grid-cols-2) — mirrors the loaded DM list. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="rounded-[1.25rem] border border-black/[0.06] bg-white/80 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton delay={delay - 120} className="h-10 w-10 rounded-xl" />
              <div className="space-y-1.5">
                <Skeleton delay={delay - 120} className="h-4 w-28 max-w-full rounded-md" />
                <Skeleton delay={delay - 120} className="h-3 w-36 max-w-full rounded-md" />
              </div>
            </div>
            <Skeleton delay={delay - 120} className="h-6 w-11 shrink-0 rounded-full" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton delay={delay - 120} className="h-3 w-full rounded-md" />
            <Skeleton delay={delay - 120} className="h-3 w-3/4 rounded-md" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton delay={delay - 120} className="h-9 w-24 rounded-xl" />
            <Skeleton delay={delay - 120} className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Instagram automation form (new / edit) ── */

/** Mirrors AutomationForm: header + 2-column grid (fields + sticky side card). */
export function AutomationFormSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-2xl" />
        <div className="space-y-1.5">
          <Skeleton delay={delay} className="h-6 w-48 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-64 max-w-full rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="spatial-surface space-y-5 rounded-[1.5rem] p-5 sm:p-6">
            <div className="space-y-1.5">
              <Skeleton delay={delay} className="h-4 w-28 rounded-md" />
              <Skeleton delay={delay} className="h-11 w-full rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Skeleton delay={delay - 90} className="h-4 w-24 rounded-md" />
              <Skeleton delay={delay - 90} className="h-11 w-full rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Skeleton delay={delay - 180} className="h-4 w-32 rounded-md" />
              <Skeleton delay={delay - 180} className="h-24 w-full rounded-xl" />
            </div>
          </div>
          <div className="spatial-surface space-y-5 rounded-[1.5rem] p-5 sm:p-6">
            <div className="space-y-1.5">
              <Skeleton delay={delay - 240} className="h-4 w-36 rounded-md" />
              <Skeleton delay={delay - 240} className="h-11 w-full rounded-xl" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-black/[0.05] p-3">
              <div className="space-y-1.5">
                <Skeleton delay={delay - 240} className="h-4 w-28 rounded-md" />
                <Skeleton delay={delay - 240} className="h-3 w-40 rounded-md" />
              </div>
              <Skeleton delay={delay - 240} className="h-6 w-11 rounded-full" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="spatial-surface space-y-4 rounded-[1.5rem] p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <Skeleton delay={delay - 120} className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton delay={delay - 120} className="h-4 w-24 rounded-md" />
                <Skeleton delay={delay - 120} className="h-3 w-32 rounded-md" />
              </div>
            </div>
            <div className="space-y-2">
              <Skeleton delay={delay - 120} className="h-3 w-full rounded-md" />
              <Skeleton delay={delay - 120} className="h-3 w-5/6 rounded-md" />
              <Skeleton delay={delay - 120} className="h-3 w-2/3 rounded-md" />
            </div>
          </div>
          <div className="spatial-surface space-y-4 rounded-[1.5rem] p-5 sm:p-6">
            <Skeleton delay={delay - 200} className="h-4 w-32 rounded-md" />
            <Skeleton delay={delay - 200} className="h-11 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Instagram connect flow (not connected) ── */

/** Mirrors the /instagram not-connected state: header + connect card. */
export function InstagramConnectSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2.5">
        <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-2xl" />
        <div className="space-y-1.5">
          <Skeleton delay={delay} className="h-5 w-32 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-64 max-w-full rounded-md" />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-white shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border-subtle)] bg-[linear-gradient(135deg,#fff_0%,#fff_58%,rgba(221,42,123,0.06)_100%)] p-5 sm:p-6">
            <div className="space-y-2">
              <Skeleton delay={delay - 80} className="h-5 w-40 max-w-full rounded-md" />
              <Skeleton delay={delay - 80} className="h-3.5 w-56 max-w-full rounded-md" />
            </div>
          </div>
          <div className="space-y-2.5 p-5 sm:p-6">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-start gap-3">
                <Skeleton delay={delay - 80 - index * 90} className="h-6 w-6 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton delay={delay - 80 - index * 90} className="h-4 w-36 max-w-full rounded-md" />
                  <Skeleton delay={delay - 80 - index * 90} className="h-3 w-full rounded-md" />
                </div>
              </div>
            ))}
            <Skeleton delay={delay - 80} className="mt-3 h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Vigento workspace ── */

/** Mirrors VigentoWorkspace: chat section + capability sidebar cards
 *  (19rem aside beside the chat at xl, matching the source typo class). */
export function VigentoWorkspaceSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="spatial-surface overflow-hidden rounded-[1.75rem]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
            <div className="min-w-0 space-y-1.5">
              <Skeleton delay={delay} className="h-4 w-48 max-w-full rounded-md" />
              <Skeleton delay={delay} className="h-3 w-40 max-w-full rounded-md" />
            </div>
          </div>
          <Skeleton delay={delay} className="h-8 w-24 shrink-0 rounded-full" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto border-b border-[var(--border-subtle)] px-4 py-2.5 sm:px-6">
          <Skeleton delay={delay} className="h-3 w-14 shrink-0 rounded-md" />
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} delay={delay - index * 70} className="h-7 w-20 shrink-0 rounded-lg" />
          ))}
        </div>
        <div dir="ltr" className="h-[29rem] space-y-4 overflow-y-auto p-4 sm:p-6">
          {[0, 1, 2].map((index) => (
            <div key={index} className={index === 0 ? 'flex justify-start' : 'flex justify-end'}>
              <Skeleton
                delay={delay - index * 140}
                className={index === 0 ? 'h-16 w-[86%] rounded-[1.25rem] rounded-bl-md' : 'h-12 w-[60%] rounded-[1.25rem] rounded-br-md'}
              />
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--border-subtle)] p-3 sm:p-4">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} delay={delay - index * 80} className="h-9 w-36 shrink-0 rounded-full" />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Skeleton delay={delay} className="h-11 min-w-0 flex-1 rounded-2xl" />
            <Skeleton delay={delay - 90} className="h-11 w-11 shrink-0 rounded-2xl" />
          </div>
        </div>
      </section>
      <aside className="space-y-4">
        <div className="spatial-surface rounded-[1.5rem] p-5">
          <div className="flex items-center gap-2">
            <Skeleton delay={delay} className="h-4 w-4 rounded-md" />
            <Skeleton delay={delay} className="h-3.5 w-24 rounded-md" />
          </div>
          <div className="mt-3 space-y-2">
            <Skeleton delay={delay} className="h-3 w-full rounded-md" />
            <Skeleton delay={delay} className="h-3 w-4/5 rounded-md" />
          </div>
        </div>
        <div className="spatial-surface rounded-[1.5rem] p-5">
          <Skeleton delay={delay - 100} className="h-3.5 w-28 rounded-md" />
          <div className="mt-3 space-y-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="flex items-center gap-2.5 rounded-xl bg-[var(--bg-base)] p-2.5">
                <Skeleton delay={delay - 100 - index * 80} className="h-8 w-8 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1">
                  <Skeleton delay={delay - 100 - index * 80} className="h-3.5 w-20 rounded-md" />
                  <Skeleton delay={delay - 100 - index * 80} className="h-3 w-28 max-w-full rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}

/* ── Services ── */

/** Mirrors the horizontal stat tile on /services (h-12 icon + big number). */
export function ServiceStatTileSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface flex items-center gap-4 rounded-[1.5rem] p-4 sm:p-5">
      <Skeleton delay={delay} className="h-12 w-12 shrink-0 rounded-2xl" />
      <div className="min-w-0 space-y-1">
        <Skeleton delay={delay} className="h-7 w-16 max-w-full rounded-lg" />
        <Skeleton delay={delay} className="h-3.5 w-20 max-w-full rounded-md" />
      </div>
    </div>
  )
}

/** Mirrors a ServiceCatalogManager card: icon + name + chips + 2 buttons. */
export function ServiceCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton delay={delay} className="h-10 w-10 rounded-xl" />
        <Skeleton delay={delay} className="h-6 w-11 rounded-full" />
      </div>
      <Skeleton delay={delay} className="mt-4 h-5 w-32 max-w-full rounded-md" />
      <Skeleton delay={delay} className="mt-2 h-3.5 w-full rounded-md" />
      <div className="mt-4 flex flex-wrap gap-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} delay={delay - index * 70} className="h-5 w-16 rounded-full" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Skeleton delay={delay} className="h-11 w-full rounded-xl" />
        <Skeleton delay={delay - 80} className="h-11 w-full rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors the sticky services search bar (mobile wrapper included). */
export function SearchBarSkeleton({ delay = 0, className }: { delay?: number; className?: string }) {
  return (
    <div className={cn('sticky top-[5.25rem] z-20 -mx-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/95 p-2 shadow-sm backdrop-blur-xl md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none', className)}>
      <Skeleton delay={delay} className="h-11 w-full rounded-xl" />
    </div>
  )
}

/** Mirrors the 0-services catalog state: dashed empty card after the search. */
export function EmptyDashedCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
      <Skeleton delay={delay} className="mx-auto h-10 w-10 rounded-xl" />
      <Skeleton delay={delay} className="mx-auto mt-4 h-4 w-44 max-w-full rounded-md" />
      <Skeleton delay={delay} className="mx-auto mt-2 h-3.5 w-56 max-w-full rounded-md" />
    </div>
  )
}

/* ── Settings page ── */

/** Mirrors SettingsMobileTabs: 3-pill tab bar (mobile only). */
export function SettingsMobileTabsSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="sticky top-[5.25rem] z-30 -mx-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)]/95 p-1.5 shadow-sm backdrop-blur-xl md:hidden">
      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1">
            <Skeleton delay={delay - index * 80} className="h-4 w-4 rounded-md" />
            <Skeleton delay={delay - index * 80} className="h-3 w-12 max-w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mirrors BusinessProfileStep: bordered card with step fields. */
export function BusinessProfileSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-6 w-44 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-64 max-w-full rounded-md" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton delay={delay - index * 80} className="h-3.5 w-20 rounded-md" />
              <Skeleton delay={delay - index * 80} className="h-11 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Mirrors OperatorChannelSetup: black header + stats + 2 panels. */
export function OperatorSetupSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface scroll-mt-28 overflow-hidden rounded-[1.75rem]">
      <div className="relative overflow-hidden bg-[#0b0b0d] px-5 py-6 text-white sm:px-7 sm:py-7">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Skeleton delay={delay} className="h-12 w-12 shrink-0 rounded-2xl" />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton delay={delay} className="h-5 w-40 max-w-full rounded-md" />
                <Skeleton delay={delay} className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton delay={delay} className="h-3 w-56 max-w-full rounded-md" />
              <Skeleton delay={delay} className="h-3 w-32 rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton delay={delay} className="h-11 w-32 rounded-xl" />
            <Skeleton delay={delay - 90} className="h-11 w-28 rounded-xl" />
          </div>
        </div>
      </div>
      <div className="space-y-5 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <Skeleton delay={delay - index * 90} className="h-3 w-16 rounded-md" />
              <Skeleton delay={delay - index * 90} className="mt-2 h-7 w-12 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-black/[0.06] p-4">
            <Skeleton delay={delay - 120} className="h-4 w-32 rounded-md" />
            <div className="mt-3 space-y-2.5">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex min-h-14 items-center gap-3 border-b border-black/[0.055] pb-2.5">
                  <Skeleton delay={delay - 120 - index * 80} className="h-8 w-8 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton delay={delay - 120 - index * 80} className="h-3.5 w-32 max-w-full rounded-md" />
                    <Skeleton delay={delay - 120 - index * 80} className="h-3 w-40 max-w-full rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-black/[0.06] p-4">
            <Skeleton delay={delay - 160} className="h-4 w-28 rounded-md" />
            <div className="mt-3 space-y-2">
              <Skeleton delay={delay - 160} className="h-11 w-full rounded-xl" />
              <Skeleton delay={delay - 160} className="h-11 w-full rounded-xl" />
              <Skeleton delay={delay - 160} className="h-11 w-24 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Mirrors WeeklyReportCard: form side + black stats side. */
export function WeeklyReportSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <section className="spatial-surface overflow-hidden rounded-[1.75rem]">
      <div className="grid lg:grid-cols-[1fr_17rem]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton delay={delay} className="h-4 w-36 max-w-full rounded-md" />
                <Skeleton delay={delay} className="h-4 w-14 rounded-full" />
              </div>
              <Skeleton delay={delay} className="h-3 w-full max-w-xl rounded-md" />
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Skeleton delay={delay} className="h-12 min-w-0 flex-1 rounded-xl" />
            <Skeleton delay={delay - 90} className="h-12 w-32 shrink-0 rounded-xl" />
          </div>
        </div>
        <div className="relative overflow-hidden border-t border-[var(--border-default)] bg-black p-5 text-white lg:border-s lg:border-t-0">
          <div className="flex items-center justify-between">
            <Skeleton delay={delay} className="h-3 w-24 rounded-md" />
            <Skeleton delay={delay} className="h-4 w-4 rounded-md" />
          </div>
          <Skeleton delay={delay - 80} className="mt-4 h-14 w-full rounded-xl" />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[0, 1].map((index) => (
              <Skeleton key={index} delay={delay - 80 - index * 70} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Menu page ── */

/** Mirrors MenuShareCard: main info section + QR aside. */
export function MenuShareSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
      <section className="spatial-surface rounded-[1.75rem] p-5 sm:p-7">
        <Skeleton delay={delay} className="h-6 w-32 rounded-full" />
        <Skeleton delay={delay} className="mt-5 h-7 w-72 max-w-full rounded-lg" />
        <Skeleton delay={delay} className="mt-2 h-3.5 w-64 max-w-full rounded-md" />
        <div dir="ltr" className="mt-6 flex min-h-12 items-center gap-2 rounded-2xl border border-black/10 bg-black/[0.025] p-1.5 ps-4">
          <Skeleton delay={delay - 90} className="h-3.5 w-48 rounded-md" />
          <Skeleton delay={delay - 90} className="ms-auto h-9 w-9 shrink-0 rounded-xl" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Skeleton delay={delay - 120} className="h-11 w-36 rounded-xl" />
          <Skeleton delay={delay - 120} className="h-11 w-28 rounded-xl" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[0, 1].map((index) => (
            <div key={index} className="rounded-2xl bg-black/[0.025] p-4">
              <Skeleton delay={delay - 120 - index * 90} className="h-8 w-12 rounded-lg" />
              <Skeleton delay={delay - 120 - index * 90} className="mt-2 h-3 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </section>
      <aside className="spatial-surface rounded-[1.75rem] p-5">
        <div className="rounded-[1.4rem] border border-black/8 bg-white p-4 shadow-[0_22px_60px_-38px_rgba(0,0,0,.5)]">
          <Skeleton delay={delay - 160} className="aspect-square w-full rounded-xl" />
          <Skeleton delay={delay - 160} className="mx-auto mt-3 h-4 w-32 rounded-md" />
          <Skeleton delay={delay - 160} className="mx-auto mt-1.5 h-3 w-20 rounded-md" />
        </div>
      </aside>
    </div>
  )
}

/* ── Onboarding ── */

/** Mirrors OnboardingFlow's done step: centered circle + title + CTA. */
export function OnboardingFlowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-6xl flex-col justify-center px-4 py-5 sm:px-8">
      <div className="mx-auto max-w-lg text-center">
        <Skeleton delay={delay} className="mx-auto h-24 w-24 rounded-full" />
        <Skeleton delay={delay} className="mx-auto mt-6 h-8 w-52 max-w-full rounded-lg" />
        <Skeleton delay={delay} className="mx-auto mt-3 h-3.5 w-72 max-w-full rounded-md" />
        <Skeleton delay={delay} className="mx-auto mt-3 h-3.5 w-56 max-w-full rounded-md" />
        <Skeleton delay={delay} className="mx-auto mt-8 h-12 w-44 rounded-xl" />
      </div>
    </div>
  )
}

/* ── Detail pages (contact / conversation / product) ── */

/** Mirrors the contact/conversation detail header card. */
export function DetailHeaderCardSkeleton({
  delay = 0,
  avatar = 'md',
  actions = 1,
}: {
  delay?: number
  avatar?: 'md' | 'lg'
  actions?: 0 | 1
}) {
  const size = avatar === 'lg' ? 'h-12 w-12' : 'h-10 w-10'
  return (
    <div className="spatial-surface flex shrink-0 flex-col gap-4 rounded-[1.5rem] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton delay={delay} className={cn(size, 'shrink-0 rounded-full')} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton delay={delay} className="h-6 w-36 max-w-full rounded-lg" />
            <Skeleton delay={delay} className="h-5 w-16 rounded-full" />
            <Skeleton delay={delay} className="h-5 w-14 rounded-full" />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Skeleton delay={delay} className="h-3.5 w-24 rounded-md" />
            <Skeleton delay={delay} className="h-3.5 w-32 max-w-full rounded-md" />
          </div>
        </div>
      </div>
      {actions > 0 && <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-xl" />}
    </div>
  )
}

/** Mirrors the contact "channel identities" card: chips + last activity. */
export function IdentityChipsCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-5">
      <Skeleton delay={delay} className="mb-3 h-4 w-24 rounded-md" />
      <div className="flex flex-wrap gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-1.5">
            <Skeleton delay={delay - index * 80} className="h-6 w-6 rounded-full" />
            <Skeleton delay={delay - index * 80} className="h-4 w-14 rounded-md" />
            <Skeleton delay={delay - index * 80} className="h-3.5 w-20 rounded-md" />
          </div>
        ))}
      </div>
      <Skeleton delay={delay} className="mt-2 h-3.5 w-40 rounded-md" />
    </div>
  )
}

/** Mirrors ContactDetailEditor: labeled fields + save button. */
export function ContactEditorSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-5">
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton delay={delay - index * 90} className="h-3.5 w-20 rounded-md" />
            <Skeleton delay={delay - index * 90} className="h-11 w-full rounded-xl" />
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl border border-black/[0.05] p-3">
          <Skeleton delay={delay} className="h-4 w-32 rounded-md" />
          <Skeleton delay={delay} className="h-6 w-11 rounded-full" />
        </div>
        <Skeleton delay={delay - 180} className="h-12 w-full rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors the conversation-history panel: header + dated rows. */
export function HistoryPanelSkeleton({ delay = 0, rows = 3 }: { delay?: number; rows?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-5">
      <Skeleton delay={delay} className="mb-3 h-4 w-28 rounded-md" />
      <div className="divide-y divide-[var(--border-subtle)]">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-start gap-3 py-3">
            <Skeleton delay={delay - index * 100} className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton delay={delay - index * 100} className="h-3.5 w-20 rounded-md" />
              <Skeleton delay={delay - index * 100} className="h-3 w-full rounded-md" />
              <Skeleton delay={delay - index * 100} className="h-3 w-2/3 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mirrors the conversation-detail thread card (min-h-[36rem]). */
export function ThreadCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface flex min-h-[36rem] min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]">
      <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-4 py-3">
        <div className="space-y-1">
          <Skeleton delay={delay} className="h-3.5 w-20 rounded-md" />
          <Skeleton delay={delay} className="h-3 w-40 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-6 w-16 shrink-0 rounded-full" />
      </div>
      <div dir="ltr" className="min-h-0 flex-1 space-y-3 p-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={index % 2 === 0 ? 'flex justify-start' : 'flex justify-end'}>
            <Skeleton
              delay={delay - index * 110}
              className={index % 2 === 0 ? 'h-14 w-[72%] rounded-[1.35rem] rounded-bl-md' : 'h-10 w-[52%] rounded-[1.35rem] rounded-br-md'}
            />
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-black/[0.06] p-3">
        <Skeleton delay={delay} className="h-11 min-w-0 flex-1 rounded-2xl" />
        <Skeleton delay={delay - 90} className="h-11 w-11 shrink-0 rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors the mobile 2-tab bar on the conversation detail page. */
export function MobileTabBar2Skeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="sticky top-[5.35rem] z-20 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border-default)] bg-white/95 p-1 shadow-[0_12px_34px_rgba(0,0,0,0.08)] backdrop-blur-xl lg:hidden">
      {[0, 1].map((index) => (
        <div key={index} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3">
          <Skeleton delay={delay - index * 80} className="h-4 w-4 rounded-md" />
          <Skeleton delay={delay - index * 80} className="h-4 w-20 max-w-full rounded-md" />
        </div>
      ))}
    </div>
  )
}

/** Mirrors the conversation-detail aside cards (actions + summary). */
export function AsideCardsSkeleton({ delay = 0, cards = 3 }: { delay?: number; cards?: number }) {
  return (
    <aside className="space-y-3">
      {Array.from({ length: cards }).map((_, index) => (
        <div key={index} className="spatial-surface shrink-0 rounded-[1.5rem] p-4">
          <div className="flex items-center gap-2">
            <Skeleton delay={delay - index * 110} className="h-4 w-4 rounded-md" />
            <Skeleton delay={delay - index * 110} className="h-4 w-24 max-w-full rounded-md" />
          </div>
          <div className="mt-2.5 space-y-2">
            <Skeleton delay={delay - index * 110} className="h-3 w-full rounded-md" />
            <Skeleton delay={delay - index * 110} className="h-3 w-2/3 rounded-md" />
          </div>
        </div>
      ))}
    </aside>
  )
}

/* ── Products ── */

/** Mirrors the product-detail header card (image + name/price/tags). */
export function ProductHeaderCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface flex flex-col gap-5 rounded-[1.5rem] p-5 sm:flex-row">
      <Skeleton delay={delay} className="aspect-video w-full overflow-hidden rounded-xl sm:w-56" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Skeleton delay={delay} className="h-7 w-40 max-w-full rounded-lg" />
          <Skeleton delay={delay} className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton delay={delay} className="mt-1.5 h-3.5 w-24 rounded-md" />
        <Skeleton delay={delay} className="mt-3 h-6 w-28 rounded-lg" />
        <div className="mt-3 flex flex-wrap gap-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} delay={delay - index * 70} className="h-6 w-16 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Mirrors the product-detail stat cards (sm:grid-cols-3). */
export function ProductStatCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-5">
      <div className="flex items-center gap-2">
        <Skeleton delay={delay} className="h-4 w-4 rounded-md" />
        <Skeleton delay={delay} className="h-3.5 w-24 max-w-full rounded-md" />
      </div>
      <Skeleton delay={delay} className="mt-2 h-8 w-16 max-w-full rounded-lg" />
    </div>
  )
}

/** Mirrors the generic "coverage/attributes" cards (title + chips / dl). */
export function CoverageCardSkeleton({ delay = 0, chips = 3 }: { delay?: number; chips?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-5">
      <Skeleton delay={delay} className="h-4 w-32 rounded-md" />
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: chips }).map((_, index) => (
          <div key={index} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5">
            <Skeleton delay={delay - index * 80} className="h-3.5 w-3.5 rounded-md" />
            <Skeleton delay={delay - index * 80} className="h-3.5 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mirrors CategoryTree rows: indent + name + count + actions. */
export function CategoryRowSkeleton({ delay = 0, indent = false }: { delay?: number; indent?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-black/[0.05] bg-white p-3', indent && 'ms-6')}>
      <Skeleton delay={delay} className="h-8 w-8 shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton delay={delay} className="h-4 w-28 max-w-full rounded-md" />
        <Skeleton delay={delay} className="h-3 w-20 rounded-md" />
      </div>
      <div className="flex shrink-0 gap-1">
        <Skeleton delay={delay} className="h-8 w-8 rounded-lg" />
        <Skeleton delay={delay - 70} className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  )
}

/** Mirrors the products form card (name/price/category/description). */
export function ProductFormSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface space-y-5 rounded-[1.5rem] p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Skeleton delay={delay} className="h-3.5 w-20 rounded-md" />
          <Skeleton delay={delay} className="h-11 w-full rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Skeleton delay={delay - 80} className="h-3.5 w-16 rounded-md" />
          <Skeleton delay={delay - 80} className="h-11 w-full rounded-xl" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Skeleton delay={delay - 160} className="h-3.5 w-24 rounded-md" />
        <Skeleton delay={delay - 160} className="h-11 w-full rounded-xl" />
      </div>
      <div className="space-y-1.5">
        <Skeleton delay={delay - 240} className="h-3.5 w-28 rounded-md" />
        <Skeleton delay={delay - 240} className="h-24 w-full rounded-xl" />
      </div>
      <Skeleton delay={delay - 300} className="h-12 w-full rounded-xl" />
    </div>
  )
}

/* ── Orders ── */

/** Mirrors OrdersSearchForm: search input + status select + submit. */
export function OrdersSearchSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Skeleton delay={delay} className="h-11 min-w-0 flex-1 rounded-xl" />
      <Skeleton delay={delay - 90} className="h-11 w-full rounded-xl sm:w-44" />
      <Skeleton delay={delay - 180} className="h-11 w-full rounded-xl sm:w-32" />
    </div>
  )
}

/** Mirrors the desktop orders table (7 columns × N rows). */
export function OrdersTableSkeleton({ delay = 0, rows = 8 }: { delay?: number; rows?: number }) {
  return (
    <section className="spatial-surface hidden overflow-hidden rounded-[1.5rem] !bg-white md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-sm">
          <thead className="bg-[var(--bg-muted)] text-start text-xs">
            <tr>
              {Array.from({ length: 7 }).map((_, col) => (
                <th key={col} scope="col" className="px-4 py-3 text-start font-medium">
                  <Skeleton delay={delay} className="h-3.5 w-20 rounded-md" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row} className="border-t border-[var(--border-subtle)]">
                {Array.from({ length: 7 }).map((_, col) => (
                  <td key={col} className="px-4 py-3">
                    <Skeleton delay={delay - row * 70 - col * 20} className={cn('h-4 rounded-md', col === 0 ? 'w-24' : col === 4 ? 'w-16' : 'w-20')} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Mirrors the mobile order card: header row + 2-col details dl. */
export function MobileOrderCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface rounded-[1.5rem] p-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <Skeleton delay={delay} className="h-4 w-24 rounded-md" />
          <Skeleton delay={delay} className="h-3.5 w-32 max-w-full rounded-md" />
        </div>
        <div className="shrink-0 space-y-1.5 text-end">
          <Skeleton delay={delay} className="h-5 w-20 rounded-full" />
          <Skeleton delay={delay} className="h-4 w-16 rounded-md" />
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4 rounded-[1.35rem] border border-[var(--border-default)] bg-white p-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index}>
            <Skeleton delay={delay - index * 80} className="h-3 w-14 rounded-md" />
            <Skeleton delay={delay - index * 80} className="mt-1.5 h-3.5 w-20 rounded-md" />
          </div>
        ))}
      </dl>
    </div>
  )
}

/* ── Page-level helpers used by several loading files ── */

/** Page title row for pages that use a plain h1 (products/categories etc.). */
export function PlainTitleSkeleton({ delay = 0, width = 'w-40' }: { delay?: number; width?: string }) {
  return <Skeleton delay={delay} className={cn('h-8 rounded-lg', width)} />
}

export { BackRowSkeleton }
