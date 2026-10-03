'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { Cpu, MemoryStick, Activity, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Metrics {
  t: number
  cpuCount: number
  loadPct: number
  load1: number
  memTotal: number
  memUsed: number
  memPct: number
  uptime: number
  disk: { total: number; used: number; pct: number } | null
}

interface Sample {
  time: string
  cpu: number
  mem: number
}

const POLL_MS = 5000
const MAX_SAMPLES = 48

function fmtBytes(n: number): string {
  const gb = n / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} گیگ`
  return `${(n / 1024 ** 2).toFixed(0)} مگ`
}

/**
 * Compact live CPU + RAM widget for the admin dashboard.
 * Renders two side-by-side area charts that poll /api/admin/metrics
 * every 5s: processor in ink, memory in the console accent.
 */
export function ServerStatsWidget() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [history, setHistory] = useState<Sample[]>([])
  const [offline, setOffline] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/admin/metrics', { cache: 'no-store' })
        if (!res.ok) {
          setOffline(true)
          return
        }
        const m: Metrics = await res.json()
        setOffline(false)
        setMetrics(m)
        setHistory((prev) => {
          const next = [
            ...prev,
            {
              time: new Date(m.t).toLocaleTimeString('fa-IR'),
              cpu: Math.round(m.loadPct),
              mem: Math.round(m.memPct),
            },
          ]
          return next.slice(-MAX_SAMPLES)
        })
      } catch {
        setOffline(true)
      }
    }
    poll()
    timer.current = setInterval(poll, POLL_MS)
    return () => clearInterval(timer.current)
  }, [])

  const cpuDanger = !!metrics && metrics.loadPct > 85
  const memDanger = !!metrics && metrics.memPct > 85
  // One sample draws no line; repeat it so the first poll already shows a level.
  const samples = history.length === 1 ? [history[0], history[0]] : history

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Meter
        icon={Cpu}
        title="بار پردازنده"
        detail={metrics ? `${metrics.cpuCount.toLocaleString('fa-IR')} هسته · load ${metrics.load1.toFixed(2)}` : 'در حال بارگذاری…'}
        percent={metrics ? metrics.loadPct : null}
        danger={cpuDanger}
        samples={samples}
        dataKey="cpu"
        color="#111111"
      />
      <Meter
        icon={MemoryStick}
        title="مصرف حافظه"
        detail={metrics ? `${fmtBytes(metrics.memUsed)} / ${fmtBytes(metrics.memTotal)}` : 'در حال بارگذاری…'}
        percent={metrics ? metrics.memPct : null}
        danger={memDanger}
        samples={samples}
        dataKey="mem"
        color="#5b3de8"
      />

      {offline && (
        <div className="flex items-center gap-2 rounded-control border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 lg:col-span-2">
          <Activity className="h-3.5 w-3.5 shrink-0" />
          اتصال به سرور برقرار نشد — در حال تلاش مجدد…
        </div>
      )}
    </div>
  )
}

/** One live gauge: current percentage + its recent history. */
function Meter({
  icon: Icon,
  title,
  detail,
  percent,
  danger,
  samples,
  dataKey,
  color,
}: {
  icon: LucideIcon
  title: string
  detail: string
  percent: number | null
  danger: boolean
  samples: Sample[]
  dataKey: 'cpu' | 'mem'
  color: string
}) {
  const stroke = danger ? '#dc2626' : color
  const gradientId = `g-${dataKey}-widget`
  return (
    <div className="spatial-surface min-w-0 rounded-card p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-[var(--bg-muted)] text-[var(--text-secondary)]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="ui-h3 !leading-6">{title}</h3>
            <p dir="auto" className="truncate text-[12px] text-[var(--text-muted)]">{detail}</p>
          </div>
        </div>
        <p className={cn('shrink-0 text-2xl font-bold tabular-nums', danger ? 'text-[var(--danger-ink)]' : 'text-[var(--text-primary)]')}>
          {percent === null ? '—' : `${Math.round(percent).toLocaleString('fa-IR')}٪`}
        </p>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={samples} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.2} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 5" stroke="rgba(17, 17, 17, 0.07)" vertical={false} />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tick={{ fill: '#6f6a64', fontSize: 12, fontFamily: 'IRANSansWeb' }}
              tickFormatter={(v: number) => `${v.toLocaleString('fa-IR')}٪`}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid rgba(17, 17, 17, 0.09)',
                borderRadius: 10,
                fontSize: 12,
                fontFamily: 'IRANSansWeb',
                direction: 'rtl',
                boxShadow: '0 4px 8px -2px rgba(17, 17, 17, 0.05), 0 16px 32px -8px rgba(17, 17, 17, 0.12)',
              }}
              labelStyle={{ color: '#6f6a64', fontWeight: 500 }}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.time ?? ''}
              formatter={(v) => [`${Number(v).toLocaleString('fa-IR')}٪`, title]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: stroke, strokeWidth: 2, stroke: '#ffffff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
