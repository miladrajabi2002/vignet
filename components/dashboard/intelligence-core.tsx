'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarDays,
  Camera,
  Database,
  MessagesSquare,
  Package,
  Plug,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { BusinessTypeValue, DashboardModuleKey } from '@/lib/verticals/registry'

type Props = {
  locale: 'fa' | 'en'
  businessLabel?: string | null
  businessType?: BusinessTypeValue | null
  modules?: readonly string[]
  className?: string
}

const NODE_META: Partial<Record<DashboardModuleKey, { fa: string; en: string; icon: LucideIcon }>> = {
  agents: { fa: 'ایجنت‌ها', en: 'Agents', icon: Bot },
  products: { fa: 'کاتالوگ', en: 'Catalog', icon: Package },
  appointments: { fa: 'رزروها', en: 'Bookings', icon: CalendarDays },
  conversations: { fa: 'گفتگوها', en: 'Conversations', icon: MessagesSquare },
  contacts: { fa: 'مشتری‌ها', en: 'Customers', icon: Users },
  integrations: { fa: 'کانال‌ها', en: 'Channels', icon: Plug },
  instagram: { fa: 'اینستاگرام', en: 'Instagram', icon: Camera },
}

const POSITIONS = [
  { x: 16, y: 20 },
  { x: 84, y: 20 },
  { x: 9, y: 50 },
  { x: 91, y: 50 },
  { x: 16, y: 80 },
  { x: 84, y: 80 },
] as const

export function IntelligenceCore({ locale, businessLabel, modules = [], className = '' }: Props) {
  const reduce = useReducedMotion()
  const fa = locale === 'fa'
  const Arrow = fa ? ArrowLeft : ArrowRight
  const requested = modules
    .filter((module): module is DashboardModuleKey => module in NODE_META)
    .slice(0, 6)
  const nodeKeys = requested.length >= 4
    ? requested
    : (['agents', 'conversations', 'contacts', 'integrations'] as DashboardModuleKey[])

  return (
    <section className={`spatial-surface min-w-0 overflow-hidden rounded-[1.75rem] ${className}`}>
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold text-[var(--text-primary)]">Vigento AI | هوش مصنوعی ویجنتو</h2>
            <p className="mt-1 truncate text-[10px] text-[var(--text-muted)]">
              {businessLabel || (fa ? 'مرکز هماهنگی کسب‌وکار' : 'Business orchestration center')}
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[10px] font-bold text-emerald-700">
          <span className="relative flex h-1.5 w-1.5">
            {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-40" />}
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          {fa ? 'همه‌چیز متصل' : 'All connected'}
        </span>
      </header>

      <div className="relative mx-3 h-[282px] overflow-hidden rounded-[1.55rem] bg-[#080808] shadow-[0_24px_60px_-32px_rgba(0,0,0,.85)] sm:mx-4">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,.12),transparent_32%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:auto,28px_28px,28px_28px]" />

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {nodeKeys.map((key, index) => {
            const point = POSITIONS[index]
            return (
              <g key={key}>
                <motion.line
                  x1={point.x}
                  y1={point.y}
                  x2="50"
                  y2="50"
                  stroke="rgba(255,255,255,.20)"
                  strokeWidth="0.5"
                  vectorEffect="non-scaling-stroke"
                  initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.42, delay: 0.06 + index * 0.04, ease: [0.23, 1, 0.32, 1] }}
                />
                {!reduce && (
                  <motion.circle
                    r="0.85"
                    fill="white"
                    initial={{ cx: point.x, cy: point.y, opacity: 0 }}
                    animate={{ cx: [point.x, 50], cy: [point.y, 50], opacity: [0, 0.85, 0] }}
                    transition={{ duration: 2.6, delay: index * 0.36, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {nodeKeys.map((key, index) => {
          const meta = NODE_META[key] ?? { fa: key, en: key, icon: Database }
          const Icon = meta.icon
          const point = POSITIONS[index]
          return (
            <motion.div
              key={key}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              initial={reduce ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: 0.12 + index * 0.04 }}
              className="absolute flex min-h-10 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.075] px-2.5 text-[9px] font-semibold text-white shadow-[0_12px_32px_-20px_rgba(0,0,0,.9)] backdrop-blur-md"
            >
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-white text-black"><Icon className="h-3.5 w-3.5" /></span>
              <span className="hidden whitespace-nowrap sm:inline">{fa ? meta.fa : meta.en}</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </motion.div>
          )
        })}

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.12, ease: [0.23, 1, 0.32, 1] }}
          className="absolute left-1/2 top-1/2 w-[12.5rem] -translate-x-1/2 -translate-y-1/2 rounded-[1.4rem] border border-white bg-white p-3.5 text-black shadow-[0_28px_70px_-28px_rgba(255,255,255,.45)]"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black text-white"><Sparkles className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black">Vigento AI</p>
              <p className="mt-0.5 text-[8px] text-black/50">هوش مصنوعی ویجنتو</p>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-[#f1f1ef] px-3 py-2.5">
            <p className="text-[9px] font-bold">{fa ? 'امروز چه چیزی را مدیریت کنیم؟' : 'What should we manage today?'}</p>
            <div className="mt-2 flex items-center gap-1">
              {[0, 1, 2].map((item) => <span key={item} className="h-1 flex-1 rounded-full bg-black/10"><motion.span className="block h-full rounded-full bg-black" initial={{ width: 0 }} animate={{ width: `${82 - item * 18}%` }} transition={{ duration: 0.5, delay: 0.28 + item * 0.08 }} /></span>)}
            </div>
          </div>
        </motion.div>

        <p className="sr-only">{fa ? `ویجنتو به ${nodeKeys.map((key) => NODE_META[key]?.fa ?? key).join('، ')} متصل است.` : `Vigento is connected to ${nodeKeys.map((key) => NODE_META[key]?.en ?? key).join(', ')}.`}</p>
      </div>

      <footer className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-[var(--text-primary)]">{fa ? 'یک ورودی برای تمام عملیات' : 'One entry point for every operation'}</p>
          <p className="mt-1 truncate text-[9px] text-[var(--text-muted)]">{fa ? 'داده، ایجنت و کانال‌ها زیر نظر ویجنتو' : 'Data, agents and channels under Vigento'}</p>
        </div>
        <Link href="/vigento" className="spatial-press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-black px-3 text-[10px] font-bold text-white shadow-[var(--shadow-control)]">
          {fa ? 'باز کردن مرکز هوش مصنوعی' : 'Open AI center'}
          <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </footer>
    </section>
  )
}
