'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Plus, MessagesSquare, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type FaqItem = { q: string; a: string }

function FaqCard({
  item,
  isOpen,
  onToggle,
  index,
  reduce,
}: {
  item: FaqItem
  isOpen: boolean
  onToggle: () => void
  index: number
  reduce: boolean | null
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={reduce ? { duration: 0 } : { duration: 0.45, delay: (index % 5) * 0.06 }}
      className={cn(
        'overflow-hidden rounded-2xl border transition-colors duration-300',
        isOpen
          ? 'border-[var(--border-hover)] bg-[var(--white-05)]'
          : 'border-[var(--border-default)] bg-transparent hover:border-[var(--border-hover)]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`marketing-faq-${index}`}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start"
      >
        <span className="text-[15px] font-medium text-[var(--text-primary)]">{item.q}</span>
        <span
          aria-hidden="true"
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
            isOpen
              ? 'rotate-45 border-transparent bg-[var(--white)]'
              : 'border-[var(--border-default)]',
          )}
        >
          <Plus
            className={cn(
              'h-3.5 w-3.5 transition-colors duration-300',
              isOpen ? 'text-[var(--bg-base)]' : 'text-[var(--text-secondary)]',
            )}
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`marketing-faq-${index}`}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <p className="mx-5 mb-5 border-s-2 border-[var(--border-hover)] ps-4 text-sm leading-relaxed text-[var(--text-secondary)]">
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
  const reduce = useReducedMotion()

  // Split into two balanced columns so opening one card only pushes
  // its own column, keeping the layout calm.
  const mid = Math.ceil(items.length / 2)
  const columns = [items.slice(0, mid), items.slice(mid)]

  return (
    <section className="marketing-story-section bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={reduce ? { duration: 0 } : { duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="marketing-eyebrow">
            {t('eyebrow')}
          </span>
          <h2 className="marketing-heading mx-auto mt-4">
            {t('title')}
          </h2>
          <p className="marketing-subtitle mx-auto mt-4">{t('subtitle')}</p>
        </motion.div>

        <div className="mt-10 grid grid-cols-1 items-start gap-3 lg:grid-cols-2 lg:gap-4">
          {columns.map((col, c) => (
            <div key={c} className="space-y-3 lg:space-y-4">
              {col.map((item, i) => {
                const index = c * mid + i
                return (
                  <FaqCard
                    key={index}
                    item={item}
                    index={index}
                    reduce={reduce}
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
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
          className="mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--white-05)] px-6 py-5 text-center sm:flex-row sm:text-start"
        >
          <span className="inline-flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
            <MessagesSquare aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            {t('moreQuestion')}
          </span>
          <Link
            href="/docs"
            className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[var(--border-hover)] px-5 text-sm font-medium text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--white-05)]"
          >
            {t('contact')}
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
