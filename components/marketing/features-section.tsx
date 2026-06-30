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
    <section id="features" className="bg-[var(--bg-base)] py-28">
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

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
