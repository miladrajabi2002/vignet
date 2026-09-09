import {
  ContactCardSkeleton,
  DashboardHeaderSkeleton,
  ToolbarSkeleton,
} from '@/components/dashboard/dashboard-skeletons'

/**
 * Route-level skeleton for /contacts.
 *
 * Mirrors the real page shape — PageHeader, search/segment toolbar, then
 * the responsive contact cards grid (1/2/4 columns) — with the staggered
 * mobile-style shimmer.
 */
export default function ContactsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardHeaderSkeleton />
      <ToolbarSkeleton />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <ContactCardSkeleton key={index} delay={-index * 110} />
        ))}
      </div>
    </div>
  )
}
