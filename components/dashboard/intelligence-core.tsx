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

export type IntelligenceCoreProps = {
  locale: 'fa' | 'en'
  businessName?: string | null
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
  { x: 20, y: 18 },
  { x: 80, y: 18 },
  { x: 12, y: 50 },
  { x: 88, y: 50 },
  { x: 20, y: 82 },
  { x: 80, y: 82 },
] as const

type FlowParticleProps = {
  path: string
  delay: number
  duration: number
}

function FlowParticle({ path, delay, duration }: FlowParticleProps) {
  const begin = `${delay}s`
  const cycle = `${duration}s`

  return (
    <>
      <path
        d={path}
        pathLength="100"
        fill="none"
        stroke="#34d399"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="0.24 99.76"
        strokeDashoffset="0"
        vectorEffect="non-scaling-stroke"
        opacity="0"
        style={{ filter: 'blur(1.8px)' }}
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0;-100"
          dur={cycle}
          begin={begin}
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;.36;.16;.4;0"
          keyTimes="0;.07;.5;.93;1"
          dur={cycle}
          begin={begin}
          repeatCount="indefinite"
        />
      </path>
      <path
        d={path}
        pathLength="100"
        fill="none"
        stroke="#6ee7b7"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeDasharray="0.24 99.76"
        strokeDashoffset="0"
        vectorEffect="non-scaling-stroke"
        opacity="0"
        style={{ filter: 'drop-shadow(0 0 3px rgba(52, 211, 153, .8))' }}
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0;-100"
          dur={cycle}
          begin={begin}
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;1;.82;1;0"
          keyTimes="0;.07;.5;.93;1"
          dur={cycle}
          begin={begin}
          repeatCount="indefinite"
        />
      </path>
    </>
  )
}

export function IntelligenceCore({
  locale,
  businessName,
  businessLabel,
  modules = [],
  className = '',
}: IntelligenceCoreProps) {
  const reduce = useReducedMotion()
  const fa = locale === 'fa'
  const Arrow = fa ? ArrowLeft : ArrowRight
  const requested = modules
    .filter((module): module is DashboardModuleKey => module in NODE_META)
    .slice(0, 6)
  const nodeKeys = requested.length >= 4
    ? requested
    : (['agents', 'conversations', 'contacts', 'integrations'] as DashboardModuleKey[])
  const coreName = businessName?.trim() || businessLabel || (fa ? 'کسب‌وکار شما' : 'Your business')

  return (
    <section className={`spatial-surface relative min-w-0 overflow-hidden rounded-[1.75rem] ${className}`}>
      <header className="flex items-center justify-between gap-2.5 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[12px] font-black text-[var(--text-primary)] sm:text-[13px]">
              Vigento AI <span className="font-medium text-[var(--text-muted)]">| {fa ? 'هوش مصنوعی ویجنتو' : 'Vigento intelligence'}</span>
            </h2>
            <p className="mt-1 truncate text-[11px] text-[var(--text-muted)] sm:text-[11px]">
              {businessLabel || (fa ? 'مرکز هماهنگی کسب‌وکار' : 'Business orchestration center')}
            </p>
          </div>
        </div>
        <span
          aria-label={fa ? 'همه بخش‌ها متصل هستند' : 'All systems are connected'}
          className="core-connected-pill inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-700 sm:text-[11px]"
        >
          <span className="relative flex h-1.5 w-1.5">
            {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-40" />}
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="sm:hidden">{fa ? 'متصل' : 'Online'}</span>
          <span className="hidden sm:inline">{fa ? 'همه‌چیز متصل' : 'All connected'}</span>
        </span>
      </header>

      <div className="intelligence-stage relative mx-3 h-[18rem] overflow-hidden rounded-[1.5rem] bg-[#080808] sm:mx-4 sm:h-[20rem] sm:rounded-[1.65rem]">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,.14),transparent_30%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[size:auto,24px_24px,24px_24px] sm:bg-[size:auto,28px_28px,28px_28px]" />
        <div aria-hidden className="absolute inset-x-[18%] top-1/2 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div aria-hidden className="absolute inset-y-[18%] left-1/2 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {nodeKeys.map((key, index) => {
            const point = POSITIONS[index]
            const controlX = (point.x + 50) / 2
            const controlY = (point.y + 50) / 2 + (index % 2 === 0 ? -4 : 4)
            const inwardPath = `M ${point.x} ${point.y} Q ${controlX} ${controlY} 50 50`
            const outwardPath = `M 50 50 Q ${controlX} ${controlY} ${point.x} ${point.y}`
            const inwardDuration = 3.05 + (index % 3) * 0.28
            const inwardDelay = 0.18 + index * 0.22
            return (
              <g key={key}>
                <motion.path
                  d={inwardPath}
                  fill="none"
                  stroke="rgba(52,211,153,.16)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ filter: 'blur(2px)' }}
                  initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.38, delay: 0.03 + index * 0.035, ease: [0.23, 1, 0.32, 1] }}
                />
                <motion.path
                  d={inwardPath}
                  fill="none"
                  stroke="rgba(209,250,229,.42)"
                  strokeWidth="1.1"
                  strokeLinecap="round"
                  strokeDasharray="1.8 3.15"
                  vectorEffect="non-scaling-stroke"
                  initial={reduce ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.05 + index * 0.04, ease: [0.23, 1, 0.32, 1] }}
                />
                {!reduce && (
                  <>
                    <path
                      d={inwardPath}
                      pathLength="100"
                      fill="none"
                      stroke="rgba(110,231,183,.58)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="5 95"
                      strokeDashoffset="0"
                      vectorEffect="non-scaling-stroke"
                      opacity="0"
                      style={{ filter: 'drop-shadow(0 0 3px rgba(52, 211, 153, .45))' }}
                    >
                      <animate
                        attributeName="stroke-dashoffset"
                        values="0;-100"
                        dur={`${3.45 + (index % 3) * 0.24}s`}
                        begin={`${0.08 + index * 0.17}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0;.34;.18;.38;0"
                        keyTimes="0;.08;.5;.92;1"
                        dur={`${3.45 + (index % 3) * 0.24}s`}
                        begin={`${0.08 + index * 0.17}s`}
                        repeatCount="indefinite"
                      />
                    </path>
                    <FlowParticle path={inwardPath} delay={inwardDelay} duration={inwardDuration} />
                    {index % 2 === 1 && (
                      <FlowParticle
                        path={outwardPath}
                        delay={0.85 + index * 0.28}
                        duration={3.45 + (index % 3) * 0.25}
                      />
                    )}
                  </>
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
            <div
              key={key}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              {!reduce && (
                <motion.span
                  aria-hidden
                  className="absolute -inset-1.5 rounded-2xl bg-emerald-400/25 blur-md"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: [0, 0.2, 0], scale: [0.97, 1.035, 1.07] }}
                  transition={{
                    duration: 0.65,
                    delay: 0.18 + index * 0.22,
                    repeat: Infinity,
                    repeatDelay: 2.4 + (index % 3) * 0.28,
                    ease: [0.23, 1, 0.32, 1],
                  }}
                />
              )}
              <motion.div
                initial={reduce ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.22, delay: 0.1 + index * 0.045, ease: [0.23, 1, 0.32, 1] }}
                className="flex min-h-10 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.075] p-1.5 text-[11px] font-semibold text-white shadow-[0_12px_32px_-20px_rgba(0,0,0,.9)] backdrop-blur-md sm:gap-2 sm:px-2.5"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-black sm:h-6 sm:w-6"><Icon className="h-3.5 w-3.5" /></span>
                <span className="hidden whitespace-nowrap sm:inline">{fa ? meta.fa : meta.en}</span>
                <span className="hidden h-1.5 w-1.5 rounded-full bg-emerald-400 sm:block" />
              </motion.div>
            </div>
          )
        })}

        <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
          {!reduce && (
            <>
              <motion.span
                aria-hidden
                className="absolute h-36 w-36 rounded-full border border-emerald-300/15 shadow-[0_0_28px_rgba(52,211,153,.08)] sm:h-44 sm:w-44"
                animate={{ scale: [0.92, 1.11], opacity: [0, 0.24, 0] }}
                transition={{ duration: 2.3, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.span
                aria-hidden
                className="absolute h-36 w-36 rounded-full border border-emerald-300/10 shadow-[0_0_24px_rgba(52,211,153,.06)] sm:h-44 sm:w-44"
                animate={{ scale: [0.92, 1.11], opacity: [0, 0.17, 0] }}
                transition={{ duration: 2.3, delay: 1.15, repeat: Infinity, ease: 'easeOut' }}
              />
            </>
          )}
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.42, delay: 0.1 }}
            className="relative w-[min(11rem,50vw)] rounded-[1.35rem] border border-white bg-white p-3 text-center text-black shadow-[0_28px_70px_-28px_rgba(255,255,255,.52)] sm:w-[13.5rem] sm:rounded-[1.55rem] sm:p-4"
          >
            <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-black text-white shadow-[var(--shadow-control)] sm:h-10 sm:w-10"><Sparkles className="h-4 w-4" /></span>
            <p dir="auto" title={coreName} className="mt-2 truncate text-[11px] font-black sm:text-[13px]">{coreName}</p>
            <p className="mt-0.5 text-[11px] font-medium text-black/45 sm:text-[11px]">{fa ? 'با هسته هوش مصنوعی ویجنتو' : 'Powered by Vigento AI core'}</p>
            <div className="mt-2.5 rounded-xl bg-[#f1f1ef] px-2.5 py-2 sm:mt-3 sm:px-3 sm:py-2.5">
              <p className="text-[11px] font-bold sm:text-[11px]">{fa ? 'همه عملیات، یک مرکز هوشمند' : 'One intelligent operating center'}</p>
              <div className="mt-2 flex items-center gap-1">
                {[0, 1, 2].map((item) => (
                  <span key={item} className="h-1 flex-1 overflow-hidden rounded-full bg-black/10">
                    <motion.span className="block h-full rounded-full bg-black" initial={reduce ? false : { transform: 'scaleX(0)' }} animate={{ transform: 'scaleX(1)' }} style={{ transformOrigin: fa ? 'right' : 'left' }} transition={{ duration: 0.45, delay: 0.25 + item * 0.07, ease: [0.23, 1, 0.32, 1] }} />
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <p className="sr-only">{fa ? `ویجنتو به ${nodeKeys.map((key) => NODE_META[key]?.fa ?? key).join('، ')} متصل است.` : `Vigento is connected to ${nodeKeys.map((key) => NODE_META[key]?.en ?? key).join(', ')}.`}</p>
      </div>

      <footer className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0 text-center sm:text-start">
          <p className="text-[11px] font-bold text-[var(--text-primary)]">{fa ? 'یک ورودی برای تمام عملیات' : 'One entry point for every operation'}</p>
          <p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{fa ? 'داده، ایجنت و کانال‌ها زیر نظر ویجنتو' : 'Data, agents and channels under Vigento'}</p>
        </div>
        <Link href="/vigento" className="spatial-press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-black px-4 text-[11px] font-bold text-white shadow-[var(--shadow-control)]">
          {fa ? 'باز کردن مرکز هوش مصنوعی' : 'Open AI center'}
          <Arrow className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </footer>
    </section>
  )
}
