'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
  Tooltip,
} from 'recharts'
import { Cpu, MemoryStick, HardDrive, Clock } from 'lucide-react'

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
const MAX_SAMPLES = 60 // ~5 minutes of history

function fmtBytes(n: number): string {
  const gb = n / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(n / 1024 ** 2).toFixed(0)} MB`
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function SystemMonitor() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [history, setHistory] = useState<Sample[]>([])
  const [offline, setOffline] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval>>()

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card
          icon={<Cpu className="h-4 w-4" />}
          label="بار پردازنده"
          value={metrics ? `${Math.round(metrics.loadPct)}%` : '—'}
          sub={metrics ? `${metrics.cpuCount} هسته · load ${metrics.load1.toFixed(2)}` : ''}
          danger={!!metrics && metrics.loadPct > 85}
        />
        <Card
          icon={<MemoryStick className="h-4 w-4" />}
          label="حافظه"
          value={metrics ? `${Math.round(metrics.memPct)}%` : '—'}
          sub={metrics ? `${fmtBytes(metrics.memUsed)} / ${fmtBytes(metrics.memTotal)}` : ''}
          danger={!!metrics && metrics.memPct > 85}
        />
        <Card
          icon={<HardDrive className="h-4 w-4" />}
          label="دیسک"
          value={metrics?.disk ? `${Math.round(metrics.disk.pct)}%` : '—'}
          sub={metrics?.disk ? `${fmtBytes(metrics.disk.used)} / ${fmtBytes(metrics.disk.total)}` : 'نامشخص'}
          danger={!!metrics?.disk && metrics.disk.pct > 90}
        />
        <Card
          icon={<Clock className="h-4 w-4" />}
          label="آپ‌تایم سرور"
          value={metrics ? fmtUptime(metrics.uptime) : '—'}
          sub=""
        />
      </div>

      {offline && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400">
          اتصال به سرور برقرار نشد — در حال تلاش مجدد…
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="بار پردازنده (٪)" data={history} dataKey="cpu" color="#34d399" />
        <Chart title="مصرف حافظه (٪)" data={history} dataKey="mem" color="#60a5fa" />
      </div>
    </div>
  )
}

function Card({
  icon,
  label,
  value,
  sub,
  danger = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  danger?: boolean
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-light ${danger ? 'text-red-400' : 'text-zinc-100'}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-zinc-600">{sub}</p>}
    </div>
  )
}

function Chart({
  title,
  data,
  dataKey,
  color,
}: {
  title: string
  data: Sample[]
  dataKey: 'cpu' | 'mem'
  color: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h2 className="mb-3 text-sm font-medium text-zinc-300">{title}</h2>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#71717a', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: 12,
                fontSize: 12,
              }}
              labelStyle={{ color: '#a1a1aa' }}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#g-${dataKey})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
