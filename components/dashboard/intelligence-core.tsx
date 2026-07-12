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
  { x: 12, y: 20 },
  { x: 50, y: 9 },
  { x: 88, y: 20 },
  { x: 12, y: 80 },
  { x: 50, y: 91 },
  { x: 88, y: 80 },
] as const

export function IntelligenceCore({
  locale,
  businessLabel,
  modules = [],
  className = '',
}: Props) {
  const reduce = useReducedMotion()
  const fa = locale === 'fa'
  const Arrow = fa ? ArrowLeft : ArrowRight
  const requested = modules
    .filter((module): module is DashboardModuleKey => module in NODE_META)
    .slice(0, 6)
  const fallback: DashboardModuleKey[] = ['agents', 'conversations', 'contacts', 'integrations']
  const nodeKeys = requested.length >= 4 ? requested : fallback

  return (
    <section className={`spatial-surface relative overflow-hidden rounded-[1.75rem] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold text-[var(--text-primary)]">
              {fa ? 'هسته عملیاتی ویجنتو' : 'Vigento operations core'}
            </h2>
            <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
              {businessLabel || (fa ? 'همه‌چیز در یک مرکز هوشمند' : 'One intelligent center for every operation')}
            </p>
          </div>
        </div>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-white px-2.5 text-[10px] font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-xs)]">
          <span className="relative flex h-1.5 w-1.5">
            {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-35" />}
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          {fa ? 'متصل' : 'Connected'}
        </span>
      </div>

      <div className="spatial-inset relative m-3 h-[238px] overflow-hidden rounded-[1.4rem] sm:m-4">
        <div aria-hidden className="absolute inset-0 opacity-50 [background-image:radial-gradient(rgba(17,17,17,.13)_0.7px,transparent_0.7px)] [background-size:14px_14px]" />

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {nodeKeys.map((key, index) => {
            const point = POSITIONS[index]
            return (
              <motion.line
                key={key}
                x1={point.x}
                y1={point.y}
                x2="50"
                y2="50"
                stroke="rgba(17,17,17,.16)"
                strokeWidth="0.42"
                strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
                initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.38, delay: 0.08 + index * 0.04, ease: [0.23, 1, 0.32, 1] }}
              />
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
              transition={{ duration: 0.2, delay: 0.13 + index * 0.04 }}
              className="absolute flex min-h-9 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-xl border border-white bg-white/95 px-2.5 text-[9px] font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-float)]"
            >
              <Icon className="h-3.5 w-3.5 text-black" />
              <span className="whitespace-nowrap">{fa ? meta.fa : meta.en}</span>
            </motion.div>
          )
        })}

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {!reduce && (
            <motion.span
              className="absolute -inset-5 rounded-full border border-black/10"
              animate={{ scale: [0.88, 1.12], opacity: [0.45, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            />
          )}
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="relative grid h-[5.25rem] w-[5.25rem] place-items-center rounded-full border-[7px] border-white bg-black text-white shadow-[0_18px_44px_-20px_rgba(0,0,0,.72)]"
          >
            <span className="text-xl font-semibold tracking-[-0.08em]">V</span>
            <span className="absolute -bottom-5 whitespace-nowrap text-[9px] font-bold tracking-[0.12em] text-black">VIGENTO</span>
          </motion.div>
        </div>

        <p className="sr-only">
          {fa
            ? `ویجنتو ${nodeKeys.map((key) => NODE_META[key]?.fa ?? key).join('، ')} را به هم متصل می‌کند.`
            : `Vigento connects ${nodeKeys.map((key) => NODE_META[key]?.en ?? key).join(', ')}.`}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pb-4 sm:px-5">
        <p className="text-[10px] leading-5 text-[var(--text-muted)]">
          {fa ? 'ویجنتو ایجنت، داده و عملیات کسب‌وکار را یک‌جا هماهنگ می‌کند.' : 'Vigento coordinates agents, data and business operations in one place.'}
        </p>
        <Link href="/agents/new" className="spatial-press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-black px-3 text-[10px] font-semibold text-white shadow-[var(--shadow-control)]">
          {fa ? 'ساخت با ویجنتو' : 'Build with Vigento'}
          <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </div>
    </section>
  )
}
