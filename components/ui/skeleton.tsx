import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * Skeleton Screen primitives — the mobile-style loading pattern.
 *
 * A skeleton mirrors the real card layout with muted placeholder blocks and
 * a soft shimmer sweep (see `.skeleton-shimmer` in globals.css). Showing the
 * *shape* of the content while it loads feels dramatically faster than a
 * spinner, because the layout never jumps when data arrives.
 *
 * All composed skeletons below mirror their real counterparts in
 * `components/agents/improvement-center.tsx`, so the swap is seamless.
 * Every block accepts a `delay` used to phase-shift the shimmer, producing
 * the wave-like stagger users know from native mobile feeds.
 */
export function Skeleton({
  className,
  delay = 0,
  style,
}: {
  className?: string
  /** Phase-shift for the shimmer wave (ms). Negative values start mid-cycle. */
  delay?: number
  style?: CSSProperties
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton-shimmer rounded-lg', className)}
      style={{ ...(delay ? { animationDelay: `${delay}ms` } : null), ...style }}
    />
  )
}

/** Mirrors a pending suggestion card in «تحلیل و بهبود». */
export function SuggestionCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface block overflow-hidden rounded-[1.35rem] p-4 sm:p-5">
      <div className="flex items-start gap-3.5">
        <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton delay={delay} className="h-6 w-20 rounded-full" />
            <Skeleton delay={delay} className="h-6 w-16 rounded-full" />
            <Skeleton delay={delay} className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton delay={delay} className="mt-3 h-5 w-3/4 rounded-md" />
          <Skeleton delay={delay} className="mt-2 h-4 w-full rounded-md" />
          <Skeleton delay={delay} className="mt-1.5 h-4 w-2/3 rounded-md" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
            <Skeleton delay={delay} className="h-3.5 w-28 rounded-full" />
            <Skeleton delay={delay} className="h-3.5 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Mirrors a selectable conversation card in «تحلیل و بهبود». */
export function ConversationCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface overflow-hidden rounded-[1.35rem]">
      <div className="flex min-w-0 items-start gap-3 p-3.5 sm:p-4">
        <Skeleton delay={delay} className="h-5 w-5 shrink-0 rounded" />
        <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Skeleton delay={delay} className="h-4 w-28 rounded-md" />
            <Skeleton delay={delay} className="h-3 w-20 rounded-full" />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Skeleton delay={delay} className="h-5 w-14 rounded-full" />
            <Skeleton delay={delay} className="h-5 w-12 rounded-full" />
            <Skeleton delay={delay} className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton delay={delay} className="mt-2 h-4 w-5/6 rounded-md" />
          <Skeleton delay={delay} className="mt-1.5 h-4 w-2/3 rounded-md" />
        </div>
      </div>
      <div className="flex items-center gap-1 border-t border-[var(--border-subtle)] px-3 py-2">
        <Skeleton delay={delay} className="h-10 w-28 rounded-xl" />
        <Skeleton delay={delay} className="h-10 w-36 rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors an analysis-run history card in «تحلیل و بهبود». */
export function HistoryCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface space-y-3.5 overflow-hidden rounded-[1.35rem] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton delay={delay} className="h-4 w-44 rounded-md" />
            <Skeleton delay={delay} className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton delay={delay} className="mt-2 h-3 w-3/4 rounded-full" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
        <Skeleton delay={delay} className="h-9 w-32 rounded-xl" />
        <Skeleton delay={delay} className="h-9 w-36 rounded-xl" />
      </div>
    </div>
  )
}

/** Mirrors a per-conversation review result card inside the results dialog. */
export function ReviewCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="spatial-surface space-y-3.5 overflow-hidden rounded-[1.35rem] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-4 w-32 rounded-md" />
          <Skeleton delay={delay} className="h-3 w-20 rounded-full" />
        </div>
        <Skeleton delay={delay} className="h-6 w-16 rounded-full" />
      </div>
      <div className="spatial-inset space-y-3 rounded-2xl p-3.5">
        <Skeleton delay={delay} className="h-5 w-24 rounded-full" />
        <Skeleton delay={delay} className="h-4 w-2/3 rounded-md" />
        <Skeleton delay={delay} className="h-3 w-full rounded-md" />
        <Skeleton delay={delay} className="h-3 w-11/12 rounded-md" />
      </div>
    </div>
  )
}
