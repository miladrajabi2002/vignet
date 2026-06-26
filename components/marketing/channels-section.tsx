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
    <section className="border-y border-white/[0.06] bg-black py-28">
      <div className="mx-auto max-w-5xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center text-3xl font-light text-white md:text-4xl"
        >
          {t('title')}
        </motion.h2>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {CHANNELS.map(({ name, icon: Icon }, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-6 transition-all hover:-translate-y-1 hover:border-white/20"
            >
              <Icon className="h-7 w-7 text-white/70" />
              <span className="text-xs text-white/50">{name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
