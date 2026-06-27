'use client'

import { cn } from '@/lib/utils'

/**
 * Card that sweeps a subtle white shimmer across its surface on hover. Uses the
 * `.shimmer` utility + the `shimmer` keyframe animation (B&W only).
 */
export function ShimmerCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]',
        className,
      )}
    >
      <div className="shimmer pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:animate-shimmer group-hover:opacity-100" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
