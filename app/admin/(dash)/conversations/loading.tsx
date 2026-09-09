import { Skeleton } from '@/components/ui/skeleton'
import { PageHeaderSkeleton, StatCardSkeleton, TableSkeleton } from '../admin-skeletons'

/**
 * Route-level skeleton for /admin/conversations.
 *
 * Mirrors the real page shape — PageHeader, filter card, three stat
 * cards, then the mobile card list / desktop conversation table with
 * pagination — so the force-dynamic page paints its own outline
 * instantly with the same mobile-style shimmer (staggered per card)
 * users know from the rest of the panel.
 */
export default function AdminConversationsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />

      {/* Search + filters card */}
      <div className="spatial-surface rounded-[1.35rem] p-2 shadow-[var(--shadow-soft)] md:p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-11 min-w-[12rem] flex-1 rounded-xl" />
          <Skeleton delay={-90} className="h-11 w-40 rounded-xl" />
          <Skeleton delay={-180} className="h-11 w-36 rounded-xl" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton delay={-130} />
        <StatCardSkeleton delay={-260} />
      </div>

      {/* Mobile conversation cards */}
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <article
            key={index}
            className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Skeleton delay={-index * 110} className="h-4 w-32 rounded-md" />
                <Skeleton delay={-index * 110} className="mt-1.5 h-3 w-24 rounded-md" />
              </div>
              <Skeleton delay={-index * 110} className="h-6 w-20 shrink-0 rounded-md" />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3">
              <div className="space-y-1.5">
                <Skeleton delay={-index * 110} className="h-2.5 w-10 rounded-md" />
                <Skeleton delay={-index * 110} className="h-5 w-16 rounded-md" />
              </div>
              <div className="space-y-1.5">
                <Skeleton delay={-index * 110} className="h-2.5 w-14 rounded-md" />
                <Skeleton delay={-index * 110} className="h-5 w-10 rounded-md" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Skeleton delay={-index * 110} className="h-2.5 w-16 rounded-md" />
                <Skeleton delay={-index * 110} className="h-3.5 w-28 rounded-md" />
              </div>
            </dl>
            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
              <Skeleton delay={-index * 110} className="h-3 w-24 rounded-full" />
              <Skeleton delay={-index * 110} className="h-11 w-32 rounded-xl" />
            </div>
          </article>
        ))}
      </div>

      {/* Desktop conversation table */}
      <div className="hidden md:block">
        <TableSkeleton rows={8} cols={8} minWidth={900} />
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton delay={-80} className="h-9 w-9 rounded-xl" />
        <Skeleton delay={-160} className="h-9 w-9 rounded-xl" />
        <Skeleton delay={-240} className="h-9 w-24 rounded-xl" />
      </div>
    </div>
  )
}
