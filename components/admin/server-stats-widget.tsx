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
import { Cpu, MemoryStick, Activity } from 'lucide-react'
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
 * every 5s. Light-themed to match the admin panel.
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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* CPU chart */}
      <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Cpu className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">بار پردازنده</h3>
              <p className="text-[11px] text-zinc-500">
                {metrics ? `${metrics.cpuCount.toLocaleString('fa-IR')} هسته · load ${metrics.load1.toFixed(2)}` : 'در حال بارگذاری…'}
              </p>
            </div>
          </div>
          <div className="text-end">
            <p className={cn('text-2xl font-bold tabular-nums', cpuDanger ? 'text-red-600' : 'text-zinc-900')}>
              {metrics ? `${Math.round(metrics.loadPct).toLocaleString('fa-IR')}٪` : '—'}
            </p>
          </div>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <defs>
                <linearGradient id="g-cpu-widget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
                labelStyle={{ color: '#71717a', fontWeight: 600 }}
                formatter={(v) => [`${Number(v).toLocaleString('fa-IR')}٪`, 'بار پردازنده']}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#g-cpu-widget)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, fill: '#3b82f6' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RAM chart */}
      <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <MemoryStick className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">مصرف حافظه</h3>
              <p className="text-[11px] text-zinc-500">
                {metrics ? `${fmtBytes(metrics.memUsed)} / ${fmtBytes(metrics.memTotal)}` : 'در حال بارگذاری…'}
              </p>
            </div>
          </div>
          <div className="text-end">
            <p className={cn('text-2xl font-bold tabular-nums', memDanger ? 'text-red-600' : 'text-zinc-900')}>
              {metrics ? `${Math.round(metrics.memPct).toLocaleString('fa-IR')}٪` : '—'}
            </p>
          </div>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <defs>
                <linearGradient id="g-mem-widget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#a1a1aa', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                contentStyle={{
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
                labelStyle={{ color: '#71717a', fontWeight: 600 }}
                formatter={(v) => [`${Number(v).toLocaleString('fa-IR')}٪`, 'مصرف حافظه']}
              />
              <Area
                type="monotone"
                dataKey="mem"
                stroke="#22c55e"
                strokeWidth={2.5}
                fill="url(#g-mem-widget)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, fill: '#22c55e' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {offline && (
        <div className="lg:col-span-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <Activity className="h-3.5 w-3.5" />
          اتصال به سرور برقرار نشد — در حال تلاش مجدد…
        </div>
      )}
    </div>
  )
}
