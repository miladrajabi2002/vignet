'use client'

import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'

export function Testimonials() {
  const t = useTranslations('marketing.testimonials')
  const items = t.raw('items') as { quote: string; name: string; role: string }[]

  return (
    <section className="bg-black py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center text-3xl font-light text-white md:text-4xl"
        >
          {t('title')}
        </motion.h2>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {items.map((item, i) => (
            <motion.figure
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition-colors hover:border-white/20"
            >
              <Quote className="h-6 w-6 text-white/20" />
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-white/70">
                {item.quote}
              </blockquote>
              <figcaption className="mt-6 border-t border-white/[0.06] pt-4">
                <div className="text-sm font-medium text-white">{item.name}</div>
                <div className="text-xs text-white/40">{item.role}</div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  )
}
