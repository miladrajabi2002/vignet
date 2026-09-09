import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Admin-panel Skeleton Screen building blocks.
 *
 * Each skeleton mirrors its real counterpart in `app/admin/(dash)/ui.tsx`
 * (PageHeader, StatCard, Panel, TableShell) so a slow force-dynamic page
 * paints its own shape instantly instead of a blank canvas. Used by the
 * `loading.tsx` route files in this segment.
 */

/** Mirrors PageHeader: icon square + title + subtitle + action control. */
export function PageHeaderSkeleton() {
  return (
    <div className="dashboard-page-header spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-44 max-w-full rounded-lg" />
            <Skeleton className="h-4 w-64 max-w-full rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-11 w-44 rounded-2xl" />
      </div>
    </div>
  )
}

/** Mirrors StatCard: label + big value + sub + tone icon + sparkline strip. */
export function StatCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="admin-card spatial-surface min-h-[8.25rem] rounded-[1.5rem] p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <Skeleton delay={delay} className="h-3.5 w-24 rounded-md" />
          <Skeleton delay={delay} className="mt-2.5 h-7 w-32 max-w-full rounded-lg" />
          <Skeleton delay={delay} className="mt-2 h-3 w-28 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-9 w-9 shrink-0 rounded-xl" />
      </div>
      <Skeleton delay={delay} className="mt-3 h-8 w-full rounded-lg" />
    </div>
  )
}

/** Mirrors a chart Panel (TrendChart / DonutChart / MonthlyBarChart). */
export function ChartSkeleton({
  delay = 0,
  height = 210,
  className,
}: {
  delay?: number
  height?: number
  className?: string
}) {
  const style: CSSProperties = { height }
  return (
    <div className={cn('admin-card spatial-surface rounded-[1.5rem] p-4 sm:p-6', className)}>
      <div className="mb-4 flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-4 w-52 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-64 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-5 w-20 rounded-md" />
      </div>
      <Skeleton delay={delay} className="w-full rounded-xl" style={style} />
    </div>
  )
}

/** Mirrors a generic Panel with a few content rows. */
export function PanelSkeleton({ delay = 0, rows = 4 }: { delay?: number; rows?: number }) {
  return (
    <div className="admin-card spatial-surface rounded-[1.5rem] p-4 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton delay={delay} className="h-4 w-44 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-60 max-w-full rounded-md" />
        </div>
        <Skeleton delay={delay} className="h-6 w-24 shrink-0 rounded-md" />
      </div>
      <div className="space-y-3.5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton delay={delay - index * 60} className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton delay={delay - index * 60} className="h-3.5 w-2/5 rounded-md" />
              <Skeleton delay={delay - index * 60} className="h-3 w-3/5 rounded-md" />
            </div>
            <Skeleton delay={delay - index * 60} className="h-4 w-16 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mirrors TableShell: header row + N body rows with cell-shaped blocks. */
export function TableSkeleton({
  delay = 0,
  rows = 6,
  cols = 5,
  minWidth = 640,
}: {
  delay?: number
  rows?: number
  cols?: number
  minWidth?: number
}) {
  return (
    <div className="admin-table-shell spatial-surface overflow-x-auto rounded-[1.5rem] [scrollbar-width:thin]">
      <table className="w-full" style={{ minWidth }}>
        <thead className="border-b border-zinc-200 bg-zinc-50/70">
          <tr>
            {Array.from({ length: cols }).map((_, index) => (
              <th key={index} className="px-4 py-3.5">
                <Skeleton delay={delay} className="h-3 w-20 max-w-full rounded-md" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="transition-colors hover:bg-zinc-50">
              {Array.from({ length: cols }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3.5">
                  <Skeleton
                    delay={delay - rowIndex * 60}
                    className={cn(
                      'h-4 rounded-md',
                      colIndex === 0 ? 'w-36 max-w-full' : colIndex === cols - 1 ? 'w-20' : 'w-24',
                    )}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Mirrors the agent cards grid on /admin/agents. */
export function AgentCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="admin-card spatial-surface group relative overflow-hidden rounded-[1.5rem] transition-[border-color,box-shadow]">
      <div className="relative space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Skeleton delay={delay} className="h-11 w-11 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton delay={delay} className="h-4 w-32 max-w-full rounded-md" />
              <Skeleton delay={delay} className="h-5 w-14 shrink-0 rounded-md" />
            </div>
            <Skeleton delay={delay} className="h-3 w-40 max-w-full rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-zinc-100 rounded-2xl border border-zinc-100 bg-zinc-50/70 py-3 text-center">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2 px-2">
              <Skeleton delay={delay - index * 60} className="mx-auto h-3 w-10 rounded-md" />
              <Skeleton delay={delay - index * 60} className="mx-auto h-5 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Mirrors the managed-model cards on /admin/ai. */
export function ModelCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50/70 p-3">
      <div className="flex items-start gap-3">
        <Skeleton delay={delay} className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton delay={delay} className="h-3.5 w-28 max-w-full rounded-md" />
          <Skeleton delay={delay} className="h-3 w-20 rounded-md" />
        </div>
      </div>
      <Skeleton delay={delay} className="mt-3 h-3 w-full rounded-md" />
      <Skeleton delay={delay} className="mt-1.5 h-3 w-2/3 rounded-md" />
      <div className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
        <Skeleton delay={delay} className="h-2.5 w-24 rounded-md" />
        <Skeleton delay={delay} className="h-3.5 w-full rounded-md" />
      </div>
    </div>
  )
}
