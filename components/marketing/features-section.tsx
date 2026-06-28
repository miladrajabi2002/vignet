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
    <section id="features" className="bg-black py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-light text-white md:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/45">{t('subtitle')}</p>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ key, icon: Icon }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.04]"
            >
              {/* Soft glow that fades in on hover */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-white/[0.06] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              />

              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] transition-colors duration-300 group-hover:border-white/25">
                  <Icon className="h-5 w-5 text-white/80 transition-colors group-hover:text-white" />
                </div>
                <span className="font-mono text-sm text-white/20">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>

              <h3 className="mt-5 text-lg font-medium text-white">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/45">
                {t(`items.${key}.desc`)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
