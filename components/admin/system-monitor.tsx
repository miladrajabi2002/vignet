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
import { Cpu, MemoryStick, HardDrive, Clock } from 'lucide-react'
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
  if (d > 0) return `${d.toLocaleString('fa-IR')} روز و ${h.toLocaleString('fa-IR')} ساعت`
  if (h > 0) return `${h.toLocaleString('fa-IR')} ساعت و ${m.toLocaleString('fa-IR')} دقیقه`
  return `${m.toLocaleString('fa-IR')} دقیقه`
}

export function SystemMonitor() {
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card
          icon={<Cpu className="h-4 w-4" />}
          label="بار پردازنده"
          value={metrics ? `${Math.round(metrics.loadPct).toLocaleString('fa-IR')}٪` : '—'}
          sub={metrics ? `${metrics.cpuCount.toLocaleString('fa-IR')} هسته · load ${metrics.load1.toFixed(2)}` : ''}
          danger={!!metrics && metrics.loadPct > 85}
          tone="info"
        />
        <Card
          icon={<MemoryStick className="h-4 w-4" />}
          label="حافظه"
          value={metrics ? `${Math.round(metrics.memPct).toLocaleString('fa-IR')}٪` : '—'}
          sub={metrics ? `${fmtBytes(metrics.memUsed)} / ${fmtBytes(metrics.memTotal)}` : ''}
          danger={!!metrics && metrics.memPct > 85}
          tone="success"
        />
        <Card
          icon={<HardDrive className="h-4 w-4" />}
          label="دیسک"
          value={metrics?.disk ? `${Math.round(metrics.disk.pct).toLocaleString('fa-IR')}٪` : '—'}
          sub={metrics?.disk ? `${fmtBytes(metrics.disk.used)} / ${fmtBytes(metrics.disk.total)}` : 'نامشخص'}
          danger={!!metrics?.disk && metrics.disk.pct > 90}
          tone="warning"
        />
        <Card
          icon={<Clock className="h-4 w-4" />}
          label="آپ‌تایم سرور"
          value={metrics ? fmtUptime(metrics.uptime) : '—'}
          sub=""
          tone="default"
        />
      </div>

      {offline && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          اتصال به سرور برقرار نشد — در حال تلاش مجدد…
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="بار پردازنده (٪)" data={history} dataKey="cpu" color="#3b82f6" />
        <Chart title="مصرف حافظه (٪)" data={history} dataKey="mem" color="#22c55e" />
      </div>
    </div>
  )
}

const TONES = {
  default: 'bg-zinc-100 text-zinc-700',
  info: 'bg-blue-50 text-blue-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-red-50 text-red-600',
}

function Card({
  icon,
  label,
  value,
  sub,
  danger = false,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  danger?: boolean
  tone?: keyof typeof TONES
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p
            className={cn(
              'mt-2 text-3xl font-semibold tracking-tight',
              danger ? 'text-red-600' : 'text-zinc-900',
            )}
          >
            {value}
          </p>
          {sub && <p className="mt-1 text-[11px] text-zinc-500">{sub}</p>}
        </div>
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', TONES[tone])}>
          {icon}
        </span>
      </div>
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-zinc-900">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
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
              formatter={(v) => [`${Number(v).toLocaleString('fa-IR')}٪`, title]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#g-${dataKey})`}
              isAnimationActive={false}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
