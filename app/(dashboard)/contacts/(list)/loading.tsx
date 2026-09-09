import {
  ContactsListSkeleton,
  ContactsToolbarSkeleton,
  DashboardHeaderSkeleton,
  DashboardPanelSkeleton,
} from '@/components/dashboard/dashboard-skeletons'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton for /contacts — an exact mirror of the page:
 * PageHeader (3 actions), sales-pipeline + channel insights panels,
 * the search/filter toolbar, then the mobile card feed / desktop
 * divide-y customer list.
 */
export default function ContactsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton actions={3} />

      {/* Insights: sales pipeline donut + second panel */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanelSkeleton action={false}>
          <div className="flex items-center gap-4">
            <Skeleton className="h-[11.25rem] w-[11.25rem] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Skeleton delay={-index * 90} className="h-2.5 w-2.5 shrink-0 rounded" />
                  <Skeleton delay={-index * 90} className="h-3.5 w-24 max-w-full rounded-full" />
                  <Skeleton delay={-index * 90} className="ms-auto h-3.5 w-10 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </DashboardPanelSkeleton>
        <DashboardPanelSkeleton delay={-130} rows={4} />
      </div>

      {/* Search + filter + view-toggle toolbar */}
      <ContactsToolbarSkeleton />

      {/* Mobile customer list feed */}
      <div className="space-y-3 md:hidden">
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton delay={-90} className="h-3 w-24 rounded-md" />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="spatial-surface overflow-hidden rounded-[1.35rem]">
            <div className="flex items-start gap-3 p-4">
              <Skeleton delay={-index * 110} className="h-11 w-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton delay={-index * 110} className="h-4 w-28 max-w-full rounded-md" />
                  <Skeleton delay={-index * 110} className="h-6 w-20 shrink-0 rounded-full" />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Skeleton delay={-index * 110} className="h-4 w-12 rounded-full" />
                  <Skeleton delay={-index * 110} className="h-4 w-14 rounded-full" />
                </div>
                <Skeleton delay={-index * 110} className="mt-1.5 h-3 w-36 max-w-full rounded-full" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] bg-black/[0.025] p-3">
              <div className="space-y-1.5">
                <Skeleton delay={-index * 110} className="h-2.5 w-14 rounded-full" />
                <Skeleton delay={-index * 110} className="h-3.5 w-16 rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton delay={-index * 110} className="h-2.5 w-14 rounded-full" />
                <Skeleton delay={-index * 110} className="h-3.5 w-20 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop customer list */}
      <ContactsListSkeleton className="hidden md:block" rows={6} />
    </div>
  )
}
