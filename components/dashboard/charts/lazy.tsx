'use client'

import dynamic from 'next/dynamic'

/**
 * Client-side-only chart wrappers. Recharts is one of the heaviest client
 * libraries in the bundle; loading it lazily (no SSR) shrinks the initial JS
 * for /overview and /agents/[id]/analytics and paints a skeleton while the
 * chunk arrives.
 */

function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div
      className="w-full animate-pulse rounded-xl bg-[var(--bg-muted)]"
      style={{ height }}
      aria-hidden="true"
    />
  )
}

export const ConversationChart = dynamic(
  () => import('./conversation-chart').then((m) => m.ConversationChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const ChannelDonut = dynamic(
  () => import('./channel-donut').then((m) => m.ChannelDonut),
  { ssr: false, loading: () => <ChartSkeleton /> },
)

export const SatisfactionGauge = dynamic(
  () => import('./satisfaction-gauge').then((m) => m.SatisfactionGauge),
  { ssr: false, loading: () => <ChartSkeleton height={160} /> },
)

export const AgentSparkline = dynamic(
  () => import('./agent-sparkline').then((m) => m.AgentSparkline),
  { ssr: false, loading: () => <ChartSkeleton height={48} /> },
)
