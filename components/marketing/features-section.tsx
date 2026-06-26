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
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center text-3xl font-light text-white md:text-4xl"
        >
          {t('title')}
        </motion.h2>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ key, icon: Icon }, i) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
              className="group relative bg-black p-8 transition-colors hover:bg-[#0a0a0a]"
            >
              <span className="font-mono text-sm text-white/25">
                {String(i + 1).padStart(2, '0')}
              </span>
              <Icon className="mt-4 h-7 w-7 text-white/80" />
              <h3 className="mt-4 text-lg font-medium text-white">
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
