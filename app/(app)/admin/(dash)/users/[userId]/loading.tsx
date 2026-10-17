import { Skeleton } from '@/components/ui/skeleton'
import { AdminLoadingShell, PageHeaderSkeleton, PanelSkeleton, StatGridSkeleton } from '../../admin-skeletons'

/** Skeleton for /admin/users/[id] — header → tab bar → the dark journey
 *  card with its step grid → KPI cards → panels. */
export default function AdminUserDetailLoading() {
  return (
    <AdminLoadingShell>
      <PageHeaderSkeleton />
      <div className="ui-seg ui-seg-solid flex max-w-full overflow-hidden md:w-fit md:shadow-none">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} delay={-index * 60} className="h-10 w-24 shrink-0 rounded-chip" />
        ))}
      </div>
      <div className="admin-panel overflow-hidden rounded-card">
        <div className="grid lg:grid-cols-[.34fr_.66fr]">
          <div className="space-y-3 bg-[#111] p-4 sm:p-6">
            <div className="h-3 w-24 rounded-md bg-white/10" />
            <div className="h-6 w-40 rounded-md bg-white/10" />
            <div className="h-24 rounded-control bg-white/[0.07]" />
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} delay={-index * 70} className="h-[5.5rem] rounded-control" />
            ))}
          </div>
        </div>
      </div>
      <StatGridSkeleton count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton delay={-120} rows={4} />
        <PanelSkeleton delay={-240} rows={4} />
      </div>
    </AdminLoadingShell>
  )
}
