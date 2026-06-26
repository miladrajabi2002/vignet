'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { AnimatedCounter } from '@/components/ui/animated-counter'

export function StatsCounter() {
  const t = useTranslations('marketing.stats')

  const stats = [
    { value: 5000, label: t('conversations') },
    { value: 300, label: t('agents') },
    { value: 100, label: t('businesses') },
  ]

  return (
    <section className="border-y border-white/[0.06] bg-black py-16">
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 px-6 sm:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: i * 0.1 }}
            className="relative text-center"
          >
            {i > 0 && (
              <span className="absolute -start-4 top-1/2 hidden h-12 w-px -translate-y-1/2 bg-white/10 sm:block" />
            )}
            <div className="text-5xl font-light text-white">
              <AnimatedCounter value={s.value} prefix="+" />
            </div>
            <div className="mt-2 text-sm text-white/40">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
