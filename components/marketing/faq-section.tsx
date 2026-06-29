'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FaqSection() {
  const t = useTranslations('marketing.faq')
  const items = t.raw('items') as { q: string; a: string }[]
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="bg-[var(--bg-base)] py-28">
      <div className="mx-auto max-w-3xl px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="text-center text-3xl font-light text-[var(--text-primary)] md:text-4xl"
        >
          {t('title')}
        </motion.h2>

        <div className="mt-12 divide-y divide-[var(--border-default)] border-y border-[var(--border-default)]">
          {items.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-start"
                >
                  <span className="text-base text-[var(--text-primary)]">{item.q}</span>
                  <Plus
                    className={cn(
                      'h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform',
                      isOpen && 'rotate-45',
                    )}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-sm leading-relaxed text-[var(--text-secondary)]">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
