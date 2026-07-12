'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { BusinessTypeValue } from '@/lib/verticals/registry'

/**
 * IntelligenceCore — a calm, luxury diagram showing how Vigent connects
 * the business's key modules around a central AI core.
 *
 * The nodes shown are business-specific (based on the selected vertical's
 * optional modules + core capabilities). Only renders after onboarding is
 * complete (the parent page controls this).
 */
type Props = {
  locale: 'fa' | 'en'
  businessLabel?: string | null
  businessType?: BusinessTypeValue | null
  /** Modules active for this workspace (from getDashboardModules) */
  modules?: readonly string[]
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
          ? `هسته هوشمند ویجنت برای ${businessLabel || 'کسب‌وکار شما'}`
          : `Vigent intelligence core for ${businessLabel || 'your business'}`
      }
      className={`relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-white ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--text-primary)] text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
              <path d="M12 2a4 4 0 0 1 4 4v1h1a4 4 0 0 1 4 4 4 4 0 0 1-4 4h-1v1a4 4 0 0 1-8 0v-1H7a4 4 0 0 1-4-4 4 4 0 0 1 4-4h1V6a4 4 0 0 1 4-4z" />
              <circle cx="12" cy="11" r="2" fill="currentColor" />
            </svg>
          </span>
          <div>
            <p className="text-[13px] font-semibold text-[var(--text-primary)]">
              {fa ? 'هسته هوشمند ویجنت' : 'Vigent intelligence core'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {businessLabel || (fa ? 'فضای کاری شما' : 'Your workspace')}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-muted)]">
          <span className="relative flex h-1.5 w-1.5">
            {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--text-primary)] opacity-30" />}
            <span className="relative h-1.5 w-1.5 rounded-full bg-[var(--text-primary)]" />
          </span>
          {fa ? 'فعال' : 'Active'}
        </span>
      </div>

      {/* Diagram area */}
      <div className="relative h-[200px] px-5 py-6">
        {/* SVG connection lines */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]">
          {/* 4 lines from corners to center */}
          {[
            { x1: 12, y1: 18, x2: 50, y2: 50 },
            { x1: 88, y1: 18, x2: 50, y2: 50 },
            { x1: 12, y1: 82, x2: 50, y2: 50 },
            { x1: 88, y1: 82, x2: 50, y2: 50 },
          ].map((line, i) => (
            <motion.line
              key={i}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="var(--border-default)"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
            />
          ))}
          {/* Subtle pulse along each line */}
          {!reduce && [0, 1, 2, 3].map((i) => {
            const lines = [
              { x1: 12, y1: 18 },
              { x1: 88, y1: 18 },
              { x1: 12, y1: 82 },
              { x1: 88, y1: 82 },
            ]
            return (
              <motion.circle
                key={`pulse-${i}`}
                r="0.8"
                fill="var(--text-primary)"
                initial={{ cx: lines[i].x1, cy: lines[i].y1, opacity: 0 }}
                animate={{ cx: [lines[i].x1, 50], cy: [lines[i].y1, 50], opacity: [0, 0.5, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.6, ease: 'easeInOut' }}
              />
            )
          })}
        </svg>

        {/* 4 corner nodes */}
        {[
          { x: '8%', y: '12%', labelFa: 'مشتری‌ها', labelEn: 'Customers' },
          { x: '72%', y: '12%', labelFa: 'گفتگوها', labelEn: 'Conversations' },
          { x: '8%', y: '76%', labelFa: 'دانش', labelEn: 'Knowledge' },
          { x: '72%', y: '76%', labelFa: 'کانال‌ها', labelEn: 'Channels' },
        ].map((node, i) => (
          <motion.div
            key={node.labelEn}
            style={{ left: node.x, top: node.y }}
            initial={reduce ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2, delay: 0.2 + i * 0.05 }}
            className="absolute flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-white px-2 py-1"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-secondary)]" />
            <span className="whitespace-nowrap text-[10px] font-medium text-[var(--text-secondary)]">
              {fa ? node.labelFa : node.labelEn}
            </span>
          </motion.div>
        ))}

        {/* Central core */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.25, delay: 0.15 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <motion.div
            animate={reduce ? undefined : { scale: [1, 1.03, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="grid h-16 w-16 place-items-center rounded-full bg-[var(--text-primary)] text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
              <path d="M12 2a4 4 0 0 1 4 4v1h1a4 4 0 0 1 4 4 4 4 0 0 1-4 4h-1v1a4 4 0 0 1-8 0v-1H7a4 4 0 0 1-4-4 4 4 0 0 1 4-4h1V6a4 4 0 0 1 4-4z" />
              <circle cx="12" cy="11" r="2" fill="currentColor" />
            </svg>
          </motion.div>
          <p className="mt-2 text-center text-[10px] font-medium text-[var(--text-muted)]">
            {fa ? 'هسته AI' : 'AI core'}
          </p>
        </motion.div>
      </div>
    </div>
  )
}
