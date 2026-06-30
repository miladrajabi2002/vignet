'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import {
  Send,
  MessageCircle,
  Camera,
  Radio,
  MessageSquare,
  Globe,
  type LucideIcon,
} from 'lucide-react'

const CHANNELS: { name: string; icon: LucideIcon }[] = [
  { name: 'Telegram', icon: Send },
  { name: 'WhatsApp', icon: MessageCircle },
  { name: 'Instagram', icon: Camera },
  { name: 'Rubika', icon: Radio },
  { name: 'Bale', icon: MessageSquare },
  { name: 'Web Widget', icon: Globe },
]

export function ChannelsSection() {
  const t = useTranslations('marketing.channels')

  return (
    <section className="border-y border-[var(--border-default)] bg-[var(--bg-base)] py-28">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-4xl font-light tracking-tight text-[var(--text-primary)] md:text-5xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--text-secondary)]">{t('subtitle')}</p>
        </motion.div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {CHANNELS.map(({ name, icon: Icon }, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 transition-all hover:-translate-y-1 hover:border-[var(--border-strong)] hover:bg-[var(--white-05)]"
            >
              <Icon className="h-7 w-7 text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]" />
              <span className="text-xs text-[var(--text-muted)] transition-colors group-hover:text-[var(--text-secondary)]">
                {name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
