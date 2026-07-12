'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import {
  SlidersHorizontal,
  Database,
  Rocket,
  Clock,
  ArrowRight,
  Check,
  Bot,
  FileText,
  Package,
  Send,
  MessageCircle,
  Globe,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ───────────────────────────────────────────────────────────────────────
   Micro-visuals — one tiny monochrome scene per step, same language as
   the features bento: divs + theme tokens, nothing external.
   ─────────────────────────────────────────────────────────────────────── */

/** Step 1 — pick a template: three tiles, the middle one selected. */
function VisPickTemplate() {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden="true" className="flex items-center gap-2.5">
      {[0, 1, 2].map((i) => {
        const selected = i === 1
        return (
          <div
            key={i}
            className={cn(
              'relative flex h-16 w-[52px] flex-col items-center justify-center gap-1.5 rounded-lg border transition-colors',
              selected
                ? 'border-[var(--border-strong)] bg-[var(--bg-base)]'
                : 'border-[var(--border-default)] bg-[var(--bg-elevated)]',
            )}
          >
            <Bot
              aria-hidden="true"
              className={cn(
                'h-4 w-4',
                selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]',
              )}
            />
            <span className="h-1 w-6 rounded-full bg-[var(--white-10)]" />
            <span className="h-1 w-4 rounded-full bg-[var(--white-05)]" />
            {selected && (
              <motion.span
                initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 22, delay: 0.5 }}
                className="absolute -end-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--white)] text-[var(--bg-base)]"
              >
                <Check className="h-2.5 w-2.5" />
              </motion.span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Step 2 — feed it data: docs and catalog chips dropping into a dropzone. */
function VisFeedData() {
  const reduce = useReducedMotion()
  const chip = (Icon: LucideIcon, w: string, delay: number) => (
    <motion.span
      initial={reduce ? false : { opacity: 0, y: -10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={reduce ? { duration: 0 } : { duration: 0.45, delay }}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hover)] bg-[var(--bg-base)] px-2.5 py-1.5"
    >
      <Icon className="h-3 w-3 text-[var(--text-secondary)]" aria-hidden="true" />
      <span className={cn('h-1 rounded-full bg-[var(--white-10)]', w)} />
    </motion.span>
  )
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        {chip(FileText, 'w-7', 0.35)}
        {chip(Package, 'w-9', 0.55)}
      </div>
      <div className="flex h-9 w-36 items-center justify-center rounded-lg border border-dashed border-[var(--border-hover)] bg-[var(--white-05)]">
        <span className="h-1 w-16 rounded-full bg-[var(--white-10)]" />
      </div>
    </div>
  )
}

/** Step 3 — connect & go live: channels flip on, agent comes online. */
function VisGoLive({ label }: { label: string }) {
  const reduce = useReducedMotion()
  const icons: LucideIcon[] = [Send, MessageCircle, Globe]
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <div className="flex items-center" dir="ltr">
        {icons.map((Icon, i) => (
          <div key={i} className="flex items-center">
            {i > 0 && <span className="h-px w-2.5 bg-[var(--border-hover)]" />}
            <motion.span
              initial={reduce ? false : { opacity: 0.4 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.35 + i * 0.18 }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-hover)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </motion.span>
          </div>
        ))}
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--accent-strong)]">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        </span>
        {label}
      </span>
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────────────
   Section — number badges on an animated connector line, and under each
   badge a card that *shows* the step instead of only telling it.
   ─────────────────────────────────────────────────────────────────────── */

const STEPS: {
  icon: LucideIcon
  titleKey: string
  descKey: string
  timeKey: string
}[] = [
  { icon: SlidersHorizontal, titleKey: 'step1Title', descKey: 'step1', timeKey: 'step1Time' },
  { icon: Database, titleKey: 'step2Title', descKey: 'step2', timeKey: 'step2Time' },
  { icon: Rocket, titleKey: 'step3Title', descKey: 'step3', timeKey: 'step3Time' },
]

export function HowItWorks() {
  const t = useTranslations('marketing.how')
  const tDemo = useTranslations('marketing.demo')
  const reduce = useReducedMotion()

  return (
    <section id="how" className="marketing-story-section bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={reduce ? { duration: 0 } : { duration: 0.6 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="marketing-eyebrow">
            {t('eyebrow')}
          </span>
          <h2 className="marketing-heading mx-auto mt-4">
            {t('title')}
          </h2>
          <p className="marketing-subtitle mx-auto mt-4">{t('subtitle')}</p>
        </motion.div>

        <div className="relative mt-10 sm:mt-12">
          {/* Animated connector line that draws as it enters view (LTR & RTL). */}
          <motion.div
            aria-hidden
            initial={reduce ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="absolute inset-x-[16%] top-7 hidden h-px origin-center bg-[var(--border-default)] md:block"
          />

          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">
            {STEPS.map(({ icon: Icon, titleKey, descKey, timeKey }, i) => (
              <motion.div
                key={titleKey}
                initial={reduce ? false : { opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={reduce ? { duration: 0 } : { duration: 0.55, delay: 0.15 + i * 0.15 }}
                className="group relative flex flex-col items-center"
              >
                {/* Number badge with icon on hover */}
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-base)] transition-colors duration-150 group-hover:border-[var(--border-strong)]">
                  <span className="font-mono text-lg text-[var(--text-secondary)] transition-opacity duration-150 group-hover:opacity-0">
                    {i + 1}
                  </span>
                  <Icon aria-hidden="true" className="absolute h-6 w-6 text-[var(--text-primary)] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                </div>

                {/* Step card — visual first, words second */}
                <div className="mt-6 flex w-full flex-1 flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--white-05)] p-5 text-center transition-colors duration-150 group-hover:border-[var(--border-hover)] group-hover:bg-[var(--white-10)]">
                  <div aria-hidden="true" className="flex h-24 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]">
                    {i === 0 && <VisPickTemplate />}
                    {i === 1 && <VisFeedData />}
                    {i === 2 && <VisGoLive label={tDemo('online')} />}
                  </div>

                  <h3 className="mt-5 text-base font-medium text-[var(--text-primary)]">
                    {t(titleKey)}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {t(descKey)}
                  </p>

                  {/* Time-to-complete chip */}
                  <span className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-1 text-[11px] text-[var(--text-muted)]">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {t(timeKey)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Closing CTA line */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, delay: 0.5 }}
          className="mt-14 flex justify-center"
        >
          <Link
            href="/login?next=/onboarding"
            className="group inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border-hover)] px-6 text-sm font-medium text-[var(--text-primary)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--white-05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          >
            {t('cta')}
            <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
