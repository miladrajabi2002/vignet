import { AgentCardSkeleton, PageHeaderSkeleton, StatCardSkeleton } from '../admin-skeletons'

/** Skeleton Screen for /admin/agents — mirrors its real layout:
 *  header → 4 stat cards → two-column grid of agent cards. */
export default function AdminAgentsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only" role="status">
        در حال بارگذاری اطلاعات…Loading…
      </span>
      <PageHeaderSkeleton />

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton delay={-120} />
        <StatCardSkeleton delay={-240} />
        <StatCardSkeleton delay={-360} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AgentCardSkeleton />
        <AgentCardSkeleton delay={-140} />
        <AgentCardSkeleton delay={-280} />
        <AgentCardSkeleton delay={-420} />
      </div>
    </div>
  )
}
