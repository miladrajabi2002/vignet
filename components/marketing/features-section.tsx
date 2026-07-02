'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import {
  Workflow,
  Database,
  Package,
  Share2,
  AudioLines,
  Inbox,
  GraduationCap,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

const ITEMS: { key: string; icon: LucideIcon }[] = [
  { key: 'builder', icon: Workflow },
  { key: 'knowledge', icon: Database },
  { key: 'products', icon: Package },
  { key: 'channels', icon: Share2 },
  { key: 'voice', icon: AudioLines },
  { key: 'crm', icon: Inbox },
]

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
          <h2 className="text-4xl font-light tracking-tight text-[var(--text-primary)] md:text-5xl">
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
          className="group relative mt-16 overflow-hidden rounded-2xl border border-[var(--border-hover)] bg-[var(--white-05)] p-7 transition-all duration-300 hover:border-[var(--border-strong)] hover:bg-[var(--white-10)] md:p-9"
        >
          {/* Soft glow, always faintly on for the hero card */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[var(--white-10)] opacity-60 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:gap-9">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-hover)] bg-[var(--white-05)] transition-colors duration-300 group-hover:border-[var(--border-strong)]">
              <GraduationCap className="h-7 w-7 text-[var(--text-primary)]" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-medium text-[var(--text-primary)] md:text-2xl">
                  {t('items.learning.title')}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hover)] bg-[var(--white-05)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)]">
                  <Sparkles className="h-3 w-3" />
                  {t('learningBadge')}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)] md:text-[15px]">
                {t('items.learning.desc')}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ key, icon: Icon }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--white-05)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-hover)] hover:bg-[var(--white-10)]"
            >
              {/* Soft glow that fades in on hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[var(--white-10)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              />

              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--white-05)] transition-colors duration-300 group-hover:border-[var(--border-strong)]">
                  <Icon className="h-5 w-5 text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]" />
                </div>
                <span className="font-mono text-sm text-[var(--text-muted)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              <h3 className="mt-5 text-lg font-medium text-[var(--text-primary)]">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                {t(`items.${key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
