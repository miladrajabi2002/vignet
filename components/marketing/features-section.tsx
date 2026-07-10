'use client'

import type { ComponentType } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Database,
  Package,
  Share2,
  AudioLines,
  Inbox,
  GraduationCap,
  Sparkles,
  Mic,
  Check,
  ArrowRight,
  Send,
  MessageCircle,
  Camera,
  Radio,
  MessageSquare,
  Globe,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ───────────────────────────────────────────────────────────────────────
   Micro-visuals — tiny monochrome illustrations, one per card. Built from
   plain divs/SVG so they inherit the theme tokens and cost nothing.
   ─────────────────────────────────────────────────────────────────────── */

/** The learning loop: unanswered question → suggested answer → approved. */
function VisLearning({ labels }: { labels: { q: string; a: string; ok: string } }) {
  const reduce = useReducedMotion()
  const step = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.45, delay: 0.3 + i * 0.35 },
  })
  return (
    <div className="flex h-full w-full flex-wrap items-center justify-center gap-2 px-3">
      <motion.span
        {...step(0)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hover)] bg-[var(--bg-elevated)] px-3 py-1.5 text-[10px] text-[var(--text-secondary)]"
      >
        «{labels.q}»
      </motion.span>
      <motion.span {...step(1)}>
        <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] rtl:rotate-180" />
      </motion.span>
      <motion.span
        {...step(1)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--white-05)] px-3 py-1.5 text-[10px] text-[var(--text-secondary)]"
      >
        <Sparkles className="h-3 w-3" />
        {labels.a}
      </motion.span>
      <motion.span {...step(2)}>
        <ArrowRight className="h-3.5 w-3.5 text-[var(--text-muted)] rtl:rotate-180" />
      </motion.span>
      <motion.span
        initial={{ opacity: 0, scale: 0.85 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, delay: 1.35, type: 'spring', stiffness: 320, damping: 20 }}
        className="relative inline-flex items-center gap-1.5 rounded-full bg-[var(--white)] px-3 py-1.5 text-[10px] font-medium text-[var(--bg-base)]"
      >
        {!reduce && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[var(--white)]"
            animate={{ opacity: [0, 0.25, 0], scale: [1, 1.25, 1.4] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, delay: 2 }}
          />
        )}
        <Check className="relative h-3 w-3" />
        <span className="relative">{labels.ok}</span>
      </motion.span>
    </div>
  )
}

/** Knowledge base: a fanned stack of documents. */
function VisDocs() {
  return (
    <div className="relative h-16 w-20">
      <div className="absolute inset-x-1 top-1 h-14 -rotate-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)]" />
      <div className="absolute inset-x-1 top-0.5 h-14 rotate-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)]" />
      <div className="absolute inset-x-0 top-0 flex h-14 flex-col justify-center gap-1.5 rounded-lg border border-[var(--border-hover)] bg-[var(--bg-base)] px-3">
        <FileText className="h-3.5 w-3.5 text-[var(--text-muted)]" />
        <span className="h-1 w-10 rounded-full bg-[var(--white-10)]" />
        <span className="h-1 w-7 rounded-full bg-[var(--white-10)]" />
      </div>
    </div>
  )
}

/** Product catalog: a miniature product card with a price chip. */
function VisProduct() {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-[var(--border-hover)] bg-[var(--bg-base)] p-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-[var(--bg-base)]"
        style={{ background: 'linear-gradient(135deg, var(--white) 0%, var(--white-60) 100%)' }}
      >
        و
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="h-1.5 w-16 rounded-full bg-[var(--white-10)]" />
        <span className="h-1.5 w-10 rounded-full bg-[var(--white-05)]" />
      </div>
      <span className="ms-1 rounded-full bg-[var(--white)] px-2 py-0.5 text-[9px] font-medium text-[var(--bg-base)]">
        ٪
      </span>
    </div>
  )
}

/** Voice: a mic and a living waveform. */
function VisVoice() {
  const reduce = useReducedMotion()
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-hover)] bg-[var(--bg-elevated)]">
        <Mic className="h-4 w-4 text-[var(--text-secondary)]" />
      </span>
      <span className="flex items-end gap-[3px]">
        {[8, 14, 10, 18, 12, 7, 16, 11, 14, 8, 17, 10].map((h, j) => (
          <motion.span
            key={j}
            className="w-[2.5px] rounded-full bg-[var(--white-30)]"
            style={{ height: h }}
            animate={reduce ? undefined : { scaleY: [1, 0.5, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: j * 0.09 }}
          />
        ))}
      </span>
    </div>
  )
}

/** Channels: six connection nodes on one line — one agent behind all. */
function VisChannels() {
  const icons: LucideIcon[] = [Send, MessageCircle, Camera, Radio, MessageSquare, Globe]
  return (
    <div className="flex items-center" dir="ltr">
      {icons.map((Icon, i) => (
        <div key={i} className="flex items-center">
          {i > 0 && <span className="h-px w-2 bg-[var(--border-hover)]" />}
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border',
              i === 2
                ? 'border-transparent bg-[var(--white)] text-[var(--bg-base)]'
                : 'border-[var(--border-hover)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        </div>
      ))}
    </div>
  )
}

/** Instagram automation: comment or story trigger to DM and captured lead. */
function VisInstagramAutomation() {
  return (
    <div className="flex items-center" dir="ltr">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-hover)] bg-[var(--bg-elevated)]">
        <Camera className="h-4 w-4 text-[var(--text-secondary)]" />
      </span>
      <span className="h-px w-5 bg-[var(--border-hover)]" />
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-hover)] bg-[var(--bg-elevated)]">
        <Send className="h-4 w-4 text-[var(--text-secondary)]" />
      </span>
      <span className="h-px w-5 bg-[var(--border-hover)]" />
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--white)] text-[var(--bg-base)]">
        <Check className="h-4 w-4" />
      </span>
    </div>
  )
}

/** CRM inbox: two conversation rows with channel dots and a tag. */
function VisInbox() {
  const rows = [
    { dot: 'bg-sky-500', w1: 'w-14', w2: 'w-9' },
    { dot: 'bg-pink-500', w1: 'w-11', w2: 'w-12' },
  ]
  return (
    <div className="flex w-full max-w-[190px] flex-col gap-2">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-2"
        >
          <span className={cn('h-2 w-2 shrink-0 rounded-full', r.dot)} />
          <span className="flex flex-col gap-1">
            <span className={cn('h-1 rounded-full bg-[var(--white-10)]', r.w1)} />
            <span className={cn('h-1 rounded-full bg-[var(--white-05)]', r.w2)} />
          </span>
          <span className="ms-auto rounded-full bg-[var(--white-10)] px-1.5 py-0.5 text-[8px] text-[var(--text-secondary)]">
            AI
          </span>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────────────────────────────────────────────────────
   Bento grid — the self-learning agent leads, every other capability gets
   a card with its own micro-visual instead of a bare icon.
   ─────────────────────────────────────────────────────────────────────── */

const CARDS: { key: string; icon: LucideIcon; span?: string; vis: 'instagram' | 'docs' | 'product' | 'voice' | 'channels' | 'inbox' }[] = [
  { key: 'instagramAutomation', icon: Camera, vis: 'instagram' },
  { key: 'knowledge', icon: Database, vis: 'docs' },
  { key: 'products', icon: Package, vis: 'product' },
  { key: 'voice', icon: AudioLines, vis: 'voice' },
  { key: 'channels', icon: Share2, vis: 'channels' },
  { key: 'crm', icon: Inbox, vis: 'inbox' },
]

const VIS: Record<string, ComponentType> = {
  instagram: VisInstagramAutomation,
  docs: VisDocs,
  product: VisProduct,
  voice: VisVoice,
  channels: VisChannels,
  inbox: VisInbox,
}

export function FeaturesSection() {
  const t = useTranslations('marketing.features')

  return (
    <section id="features" className="bg-[var(--bg-base)] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs tracking-wide text-[var(--text-secondary)]">
            {t('eyebrow')}
          </span>
          <h2 className="mt-6 text-4xl font-light tracking-tight text-[var(--text-primary)] md:text-5xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--text-secondary)]">{t('subtitle')}</p>
        </motion.div>

        {/* Featured card — the self-learning agent is the differentiator */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55 }}
          className="group relative mt-14 overflow-hidden rounded-2xl border border-[var(--border-hover)] bg-[var(--white-05)] p-7 transition-all duration-300 hover:border-[var(--border-strong)] hover:bg-[var(--white-10)] md:p-9"
        >
          {/* Soft glow, always faintly on for the hero card */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[var(--white-10)] opacity-60 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          />

          <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:gap-10">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-hover)] bg-[var(--white-05)] transition-colors duration-300 group-hover:border-[var(--border-strong)]">
                  <GraduationCap className="h-6 w-6 text-[var(--text-primary)]" />
                </div>
                <h3 className="text-xl font-medium text-[var(--text-primary)] md:text-2xl">
                  {t('items.learning.title')}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hover)] bg-[var(--white-05)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)]">
                  <Sparkles className="h-3 w-3" />
                  {t('learningBadge')}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)] md:text-[15px]">
                {t('items.learning.desc')}
              </p>
            </div>

            {/* Live learning-loop visual */}
            <div className="flex min-h-[72px] items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] py-4 md:w-[340px] md:shrink-0">
              <VisLearning
                labels={{
                  q: t('visLearning.q'),
                  a: t('visLearning.a'),
                  ok: t('visLearning.ok'),
                }}
              />
            </div>
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map(({ key, icon: Icon, span, vis }, i) => {
            const Vis = VIS[vis]
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--white-05)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-hover)] hover:bg-[var(--white-10)]',
                  span,
                )}
              >
                {/* Soft glow that fades in on hover */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--white-10)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                />

                {/* Micro-visual */}
                <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]">
                  <Vis />
                </div>

                <div className="relative mt-5 flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]" />
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">
                    {t(`items.${key}.title`)}
                  </h3>
                </div>
                <p className="relative mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {t(`items.${key}.desc`)}
                </p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
