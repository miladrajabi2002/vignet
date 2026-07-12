'use client'

import type { ComponentType } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  BrainCircuit,
  ChartNoAxesCombined,
  MessagesSquare,
  Radio,
  Users,
  Workflow,
} from 'lucide-react'

type IntelligenceCoreProps = {
  locale: 'fa' | 'en'
  businessLabel?: string | null
  className?: string
}

type Node = {
  x: number
  y: number
  labelFa: string
  labelEn: string
  icon: ComponentType<{ className?: string }>
}

const NODES: Node[] = [
  { x: 16, y: 17, labelFa: 'مشتری‌ها', labelEn: 'Customers', icon: Users },
  { x: 84, y: 17, labelFa: 'گفتگوها', labelEn: 'Conversations', icon: MessagesSquare },
  { x: 8, y: 52, labelFa: 'دانش', labelEn: 'Knowledge', icon: BrainCircuit },
  { x: 92, y: 52, labelFa: 'کانال‌ها', labelEn: 'Channels', icon: Radio },
  { x: 22, y: 84, labelFa: 'اتوماسیون', labelEn: 'Automation', icon: Workflow },
  { x: 78, y: 84, labelFa: 'گزارش‌ها', labelEn: 'Reports', icon: ChartNoAxesCombined },
]

export function IntelligenceCore({ locale, businessLabel, className = '' }: IntelligenceCoreProps) {
  const reduce = useReducedMotion()
  const fa = locale === 'fa'

  return (
    <div
      role="img"
      aria-label={
        fa
          ? 'هسته هوشمند ویجنت که مشتری‌ها، گفتگوها، دانش، کانال‌ها، اتوماسیون و گزارش‌ها را به هم متصل می‌کند.'
          : 'The Vigent intelligence core connecting customers, conversations, knowledge, channels, automations and reports.'
      }
      className={`marketing-grid-dark relative min-h-[300px] overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#101311] text-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] ${className}`}
    >
      <div aria-hidden className="absolute -start-16 -top-20 h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />
      <div aria-hidden className="absolute -bottom-28 -end-16 h-64 w-64 rounded-full bg-white/[0.055] blur-3xl" />

      <div aria-hidden className="absolute inset-0">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
          {NODES.map((node, index) => (
            <g key={node.labelEn}>
              <motion.line
                x1={node.x}
                y1={node.y}
                x2="50"
                y2="51"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="0.28"
                vectorEffect="non-scaling-stroke"
                animate={reduce ? undefined : { opacity: [0.28, 0.78, 0.28] }}
                transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, delay: index * 0.22 }}
              />
              {!reduce && (
                <motion.circle
                  r="0.7"
                  fill="rgb(110 231 183)"
                  initial={{ cx: node.x, cy: node.y, opacity: 0 }}
                  animate={{ cx: [node.x, 50], cy: [node.y, 51], opacity: [0, 1, 1, 0] }}
                  transition={{ duration: 2.1, repeat: Infinity, delay: index * 0.4, ease: 'easeInOut' }}
                />
              )}
            </g>
          ))}
        </svg>

        {NODES.map((node, index) => {
          const Icon = node.icon
          return (
            <motion.div
              key={node.labelEn}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              initial={reduce ? false : { opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduce ? { duration: 0 } : { duration: 0.32, delay: 0.12 + index * 0.06 }}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.07] px-2 py-1.5 backdrop-blur-sm sm:px-2.5"
            >
              <Icon className="h-3 w-3 shrink-0 text-emerald-200" />
              <span className="whitespace-nowrap text-[8px] font-medium text-white/55 sm:text-[9px]">
                {fa ? node.labelFa : node.labelEn}
              </span>
            </motion.div>
          )
        })}

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.86 }}
          animate={
            reduce
              ? { opacity: 1, scale: 1 }
              : {
                  opacity: 1,
                  scale: [1, 1.025, 1],
                  boxShadow: [
                    '0 0 0 0 rgba(52,211,153,0.06)',
                    '0 0 44px 5px rgba(52,211,153,0.18)',
                    '0 0 0 0 rgba(52,211,153,0.06)',
                  ],
                }
          }
          transition={reduce ? { duration: 0 } : { scale: { duration: 3.2, repeat: Infinity }, boxShadow: { duration: 3.2, repeat: Infinity }, opacity: { duration: 0.4 } }}
          className="absolute left-1/2 top-[51%] grid h-[6.6rem] w-[6.6rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-emerald-200/25 bg-[#14251f] sm:h-28 sm:w-28"
        >
          <span className={`absolute inset-[-10px] rounded-full border border-dashed border-emerald-200/20 ${reduce ? '' : 'animate-[spin_14s_linear_infinite]'}`} />
          <span className={`absolute inset-[-20px] rounded-full border border-white/[0.07] ${reduce ? '' : 'animate-[spin_20s_linear_infinite_reverse]'}`} />
          <div className="relative text-center">
            <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-emerald-300 text-black shadow-[0_0_22px_rgba(110,231,183,0.35)]">
              <BrainCircuit className="h-[18px] w-[18px]" />
            </span>
            <p className="mt-2 text-[10px] font-semibold text-white sm:text-[11px]">
              {fa ? 'هسته هوشمند' : 'AI core'}
            </p>
            <p className="mt-0.5 max-w-[5.5rem] truncate text-[7px] text-emerald-200/65 sm:text-[8px]">
              {businessLabel || (fa ? 'فضای کاری ویجنت' : 'Vigent workspace')}
            </p>
          </div>
        </motion.div>

        <div className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/15 bg-emerald-300/[0.08] px-2.5 py-1 text-[8px] font-medium text-emerald-200 sm:text-[9px]">
          <span className="relative flex h-1.5 w-1.5">
            {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300 opacity-50" />}
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-300" />
          </span>
          {fa ? 'همه سیستم‌ها متصل' : 'All systems connected'}
        </div>
      </div>
    </div>
  )
}
