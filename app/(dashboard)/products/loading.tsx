/**
 * Skeleton loader for the products page.
 *
 * Next.js shows this automatically while the server is rendering
 * `app/(dashboard)/products/page.tsx`. The structure mirrors the real page
 * (header → toolbar → grid → pagination) so the perceived loading feels
 * smooth instead of a blank screen.
 *
 * The skeleton uses `animate-pulse` on muted blocks — matches the rest of the
 * dashboard's spatial-surface design language. Disabled on `prefers-reduced-
 * motion` browsers via the `motion-reduce:animate-none` class.
 */
export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
          <div className="space-y-2">
            <div className="h-5 w-32 rounded-lg bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
            <div className="h-3 w-48 rounded-lg bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-32 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
          <div className="h-9 w-32 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
        </div>
      </div>

      {/* WooSetupCard placeholder */}
      <div className="spatial-surface h-24 rounded-[1.5rem] animate-pulse motion-reduce:animate-none" />

      {/* Trend chart + bar list placeholders (only show when not filtering) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="spatial-surface h-48 rounded-[1.5rem] animate-pulse motion-reduce:animate-none" />
        <div className="spatial-surface h-48 rounded-[1.5rem] animate-pulse motion-reduce:animate-none" />
      </div>

      {/* Toolbar skeleton */}
      <div className="spatial-surface flex flex-wrap items-center gap-2 rounded-[1.5rem] p-3 sm:p-4">
        <div className="h-9 flex-1 min-w-[12rem] rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-40 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-40 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
      </div>

      {/* Product grid skeleton — 6 cards in a 3-column layout */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="spatial-surface flex flex-col overflow-hidden rounded-[1.5rem]"
          >
            {/* Image area */}
            <div className="aspect-video w-full bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
            {/* Body */}
            <div className="flex flex-1 flex-col p-4">
              <div className="h-4 w-3/4 rounded-lg bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
              <div className="mt-2 h-3 w-1/2 rounded-lg bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
              <div className="mt-3 h-4 w-1/3 rounded-lg bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
              <div className="mt-auto flex items-center justify-between pt-4">
                <div className="h-3 w-16 rounded-lg bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
                <div className="flex items-center gap-2">
                  <div className="h-7 w-16 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
                  <div className="h-7 w-7 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <div className="h-9 w-24 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-9 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-9 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-9 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-24 rounded-xl bg-[var(--bg-muted)] animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  )
}
