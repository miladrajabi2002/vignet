import { Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level skeleton loader for the products page.
 *
 * Next.js shows this automatically while the server is rendering
 * `app/(dashboard)/products/page.tsx`. The structure mirrors the real
 * page (header → setup card → trend charts → toolbar → grid →
 * pagination) so the perceived loading feels smooth instead of a blank
 * screen.
 *
 * Uses the shared Skeleton primitive — the same mobile-style shimmer
 * sweep (staggered per block) as «تحلیل و بهبود» and the admin panel,
 * direction-agnostic and disabled for reduced-motion users via the
 * `.skeleton-shimmer` class in globals.css.
 */
export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 rounded-lg" />
            <Skeleton delay={-90} className="h-3 w-48 rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton delay={-90} className="h-9 w-32 rounded-xl" />
          <Skeleton delay={-180} className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* WooSetupCard placeholder */}
      <div className="spatial-surface rounded-[1.5rem] p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton delay={-90} className="h-4 w-40 rounded-md" />
            <Skeleton delay={-180} className="h-3 w-56 max-w-full rounded-md" />
          </div>
        </div>
      </div>

      {/* Trend chart + bar list placeholders */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-44 max-w-full rounded-md" />
              <Skeleton delay={-90} className="h-3 w-32 max-w-full rounded-md" />
            </div>
            <Skeleton delay={-90} className="h-5 w-16 rounded-md" />
          </div>
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
        <div className="spatial-surface rounded-[1.5rem] p-4 sm:p-6">
          <div className="mb-4 space-y-2">
            <Skeleton delay={-60} className="h-4 w-36 max-w-full rounded-md" />
            <Skeleton delay={-150} className="h-3 w-28 max-w-full rounded-md" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, row) => (
              <div key={row} className="flex items-center justify-between gap-3">
                <Skeleton delay={-row * 90} className="h-3.5 w-24 rounded-md" />
                <Skeleton delay={-row * 90} className="h-3.5 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar skeleton */}
      <div className="spatial-surface flex flex-wrap items-center gap-2 rounded-[1.5rem] p-3 sm:p-4">
        <Skeleton className="h-9 min-w-[12rem] flex-1 rounded-xl" />
        <Skeleton delay={-90} className="h-9 w-40 rounded-xl" />
        <Skeleton delay={-180} className="h-9 w-40 rounded-xl" />
      </div>

      {/* Product grid skeleton — 6 cards in a 3-column layout */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="spatial-surface flex flex-col overflow-hidden rounded-[1.5rem]"
          >
            {/* Image area */}
            <Skeleton delay={-i * 120} className="aspect-video w-full rounded-none" />
            {/* Body */}
            <div className="flex flex-1 flex-col p-4">
              <Skeleton delay={-i * 120} className="h-4 w-3/4 rounded-lg" />
              <Skeleton delay={-i * 120} className="mt-2 h-3 w-1/2 rounded-md" />
              <Skeleton delay={-i * 120} className="mt-3 h-4 w-1/3 rounded-lg" />
              <div className="mt-auto flex items-center justify-between pt-4">
                <Skeleton delay={-i * 120} className="h-3 w-16 rounded-md" />
                <div className="flex items-center gap-2">
                  <Skeleton delay={-i * 120} className="h-7 w-16 rounded-xl" />
                  <Skeleton delay={-i * 120} className="h-7 w-7 rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton delay={-80} className="h-9 w-9 rounded-xl" />
        <Skeleton delay={-160} className="h-9 w-9 rounded-xl" />
        <Skeleton delay={-240} className="h-9 w-9 rounded-xl" />
        <Skeleton delay={-320} className="h-9 w-24 rounded-xl" />
      </div>
    </div>
  )
}
