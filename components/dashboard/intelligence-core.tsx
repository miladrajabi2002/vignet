'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  BrainCircuit,
  MessagesSquare,
  BookOpen,
  Radio,
  Users,
  Workflow,
} from 'lucide-react'
import type { BusinessTypeValue } from '@/lib/verticals/registry'

/**
 * Intelligence Core — a calm, minimal diagram showing how Vigent connects
 * customers, conversations, knowledge, channels and automation around a
 * central AI core. OpenAI-style: monochrome, thin lines, no flashy effects.
 */
const NODES = [
  { x: 15, y: 20, labelFa: 'مشتری‌ها', labelEn: 'Customers', icon: Users },
  { x: 85, y: 20, labelFa: 'گفتگوها', labelEn: 'Conversations', icon: MessagesSquare },
  { x: 8, y: 55, labelFa: 'دانش', labelEn: 'Knowledge', icon: BookOpen },
  { x: 92, y: 55, labelFa: 'کانال‌ها', labelEn: 'Channels', icon: Radio },
  { x: 50, y: 88, labelFa: 'اتوماسیون', labelEn: 'Automation', icon: Workflow },
] as const

type Props = {
  locale: 'fa' | 'en'
  businessLabel?: string | null
  businessType?: BusinessTypeValue | null
  className?: string
}

export function IntelligenceCore({ locale, businessLabel, className = '' }: Props) {
  const reduce = useReducedMotion()
  const fa = locale === 'fa'

  return (
    <div
      role="img"
      aria-label={
        fa
          ? 'هسته هوشمند ویجنت که مشتری‌ها، گفتگوها، دانش، کانال‌ها و اتوماسیون را به هم متصل می‌کند.'
          : 'The Vigent intelligence core connecting customers, conversations, knowledge, channels and automation.'
      }
      className={`relative min-h-[280px] overflow-hidden rounded-xl border border-[var(--border-default)] bg-white ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--text-primary)] text-white">
            <BrainCircuit className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">
              {fa ? 'هسته هوشمند ویجنت' : 'Vigent intelligence core'}
            </p>
            <p className="text-[10px] text-[var(--text-muted)]">
              {businessLabel || (fa ? 'فضای کاری شما' : 'Your workspace')}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]">
          <span className="relative flex h-1.5 w-1.5">
            {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)] opacity-40" />}
            <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
          {fa ? 'همه سیستم‌ها متصل' : 'All systems connected'}
        </span>
      </div>

      {/* Diagram */}
      <div className="relative h-[220px]">
        {/* Connection lines */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {NODES.map((node) => (
            <line
              key={node.labelEn}
              x1={node.x}
              y1={node.y}
              x2="50"
              y2="50"
              stroke="var(--border-default)"
              strokeWidth="0.3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* Nodes */}
        {NODES.map((node, index) => {
          const Icon = node.icon
          return (
            <motion.div
              key={node.labelEn}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduce ? { duration: 0 } : { duration: 0.2, delay: 0.1 + index * 0.05 }}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-2 py-1"
            >
              <Icon className="h-3 w-3 text-[var(--text-muted)]" />
              <span className="whitespace-nowrap text-[9px] font-medium text-[var(--text-secondary)]">
                {fa ? node.labelFa : node.labelEn}
              </span>
            </motion.div>
          )
        })}

        {/* Central core */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2, delay: 0.05 }}
          className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--text-primary)] text-white"
        >
          <BrainCircuit className="h-5 w-5" />
        </motion.div>
      </div>
    </div>
  )
}
