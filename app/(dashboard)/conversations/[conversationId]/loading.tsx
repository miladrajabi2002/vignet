import { BackRowSkeleton } from '@/components/dashboard/agent-detail-skeletons'
import {
  AsideCardsSkeleton,
  DetailHeaderCardSkeleton,
  MobileTabBar2Skeleton,
  ThreadCardSkeleton,
} from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /conversations/[conversationId] — an exact
 * mirror of the page: back button, contact header card, the mobile
 * 2-tab bar (گفتگو / جزئیات) and the thread + details grid. The source
 * grid class carries an `inmax` typo whose rule arrives with the page's
 * CSS chunk, so the loading file uses the equivalent well-formed class —
 * same 21rem aside beside the thread at lg+.
 */
export default function ConversationDetailLoading() {
  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4">
      <BackRowSkeleton delay={-40} className="w-fit self-start shrink-0" />

      {/* Contact header card */}
      <DetailHeaderCardSkeleton delay={-80} />

      {/* Mobile thread/details tabs */}
      <MobileTabBar2Skeleton delay={-120} />

      {/* Thread + details (2 columns at lg, mirrors the real grid) */}
      <div className="grid min-h-[calc(100dvh-11rem)] gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <ThreadCardSkeleton delay={-160} />
        <AsideCardsSkeleton delay={-220} cards={3} />
      </div>
    </div>
  )
}
