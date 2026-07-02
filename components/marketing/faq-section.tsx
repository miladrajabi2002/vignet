'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, MessagesSquare, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type FaqItem = { q: string; a: string }

function FaqCard({
  item,
  isOpen,
  onToggle,
  index,
}: {
  item: FaqItem
  isOpen: boolean
  onToggle: () => void
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: (index % 5) * 0.06 }}
      className={cn(
        'overflow-hidden rounded-2xl border transition-colors duration-300',
        isOpen
          ? 'border-[var(--border-hover)] bg-[var(--white-05)]'
          : 'border-[var(--border-default)] bg-transparent hover:border-[var(--border-hover)]',
      )}
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start"
      >
        <span className="text-[15px] font-medium text-[var(--text-primary)]">{item.q}</span>
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
            isOpen
              ? 'rotate-45 border-[var(--border-strong)] bg-[var(--white-10)]'
              : 'border-[var(--border-default)]',
          )}
        >
          <Plus className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
        </span>
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
            <p className="px-5 pb-5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {item.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FaqSection() {
  const t = useTranslations('marketing.faq')
  const items = t.raw('items') as FaqItem[]
  const [open, setOpen] = useState<number | null>(0)

  // Split into two balanced columns so opening one card only pushes
  // its own column, keeping the layout calm.
  const mid = Math.ceil(items.length / 2)
  const columns = [items.slice(0, mid), items.slice(mid)]

  return (
    <section className="bg-[var(--bg-base)] py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
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
          <p className="mx-auto mt-4 max-w-lg text-[var(--text-secondary)]">{t('subtitle')}</p>
        </motion.div>

        <div className="mt-14 grid grid-cols-1 items-start gap-3 lg:grid-cols-2 lg:gap-4">
          {columns.map((col, c) => (
            <div key={c} className="space-y-3 lg:space-y-4">
              {col.map((item, i) => {
                const index = c * mid + i
                return (
                  <FaqCard
                    key={index}
                    item={item}
                    index={index}
                    isOpen={open === index}
                    onToggle={() => setOpen(open === index ? null : index)}
                  />
                )
              })}
            </div>
          ))}
        </div>

        {/* Still-have-questions hint */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 flex flex-col items-center justify-center gap-3 text-center sm:flex-row"
        >
          <span className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <MessagesSquare className="h-4 w-4" />
            {t('moreQuestion')}
          </span>
          <Link
            href="/docs"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--text-secondary)]"
          >
            {t('contact')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
