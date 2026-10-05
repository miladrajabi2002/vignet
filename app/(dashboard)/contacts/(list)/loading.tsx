import {
  ContactCardSkeleton,
  ContactsListSkeleton,
  ContactsToolbarSkeleton,
  DashboardHeaderSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /contacts — an exact mirror of the page:
 * PageHeader (4 compact actions), the right-aligned list/pipeline toggle,
 * the ui-fbar search bar, the result-count strip, then the mobile card feed
 * or the desktop divide-y list, pagination, the collapsed charts disclosure
 * and the collapsed metrics explainer.
 */
export default function ContactsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton actions={4} compactOnMobile />

      {/* List / pipeline view toggle — right-aligned segmented control */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="ui-seg grid-flow-col" role="group">
          <span className="ui-seg-tab gap-1.5 px-3" data-active="true">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton delay={-90} className="h-3.5 w-12 rounded-full" />
          </span>
          <span className="ui-seg-tab gap-1.5 px-3">
            <Skeleton delay={-180} className="h-4 w-4 rounded" />
            <Skeleton delay={-270} className="h-3.5 w-16 rounded-full" />
          </span>
        </div>
      </div>

      {/* Search + filters bar */}
      <ContactsToolbarSkeleton delay={-60} />

      {/* Result count + live status + select-all */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton delay={-90} className="h-3 w-16 rounded-full" />
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton delay={-130} className="h-7 w-24 rounded-full" />
          <Skeleton delay={-190} className="h-11 w-44 rounded-xl" />
        </div>
      </div>

      {/* Mobile: section header + customer card feed */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton delay={-90} className="h-3 w-24 rounded-md" />
          </div>
          <Skeleton delay={-90} className="h-3 w-20 shrink-0 rounded-full" />
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <ContactCardSkeleton key={index} delay={-120 - index * 110} />
        ))}
      </div>

      {/* Desktop: customer list panel */}
      <ContactsListSkeleton className="hidden md:block" rows={6} delay={-160} />

      {/* Pagination (list view) */}
      <div className="flex items-center justify-center gap-1.5 pt-2 sm:gap-2">
        <Skeleton className="h-9 w-9 rounded-control" />
        <Skeleton delay={-90} className="h-9 min-w-9 rounded-control" />
        <Skeleton delay={-180} className="h-9 min-w-9 rounded-control" />
        <Skeleton delay={-270} className="h-9 min-w-9 rounded-control" />
        <Skeleton delay={-360} className="h-9 w-9 rounded-control" />
      </div>

      {/* Collapsed charts disclosure («نمودار قیف فروش و مشتریان جدید») */}
      <div className="flex min-h-11 items-center gap-1.5 px-2">
        <Skeleton className="h-4 w-4 shrink-0 rounded" />
        <Skeleton delay={-90} className="h-3.5 w-72 max-w-full rounded-full" />
      </div>

      {/* Collapsed metrics explainer («این مشتریان از کجا می‌آیند؟») */}
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-5">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <Skeleton className="h-3.5 w-52 max-w-full rounded-full" />
          <Skeleton delay={-90} className="h-4 w-4 shrink-0 rounded" />
        </div>
      </div>
    </div>
  )
}
