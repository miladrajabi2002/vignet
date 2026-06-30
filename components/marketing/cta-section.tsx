'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { MagneticButton } from '@/components/ui/magnetic-button'

export function CtaSection() {
  const t = useTranslations('marketing.cta')

  return (
    <section className="relative overflow-hidden bg-[var(--bg-base)] py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--white-05)] blur-3xl"
      />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
          className="gradient-text text-4xl font-light leading-tight tracking-tight md:text-5xl"
        >
          {t('title')}
        </motion.h2>

        <div className="mt-10 flex justify-center">
          <MagneticButton>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-[var(--white)] px-8 py-3.5 text-sm font-medium text-[var(--bg-base)] shadow-[0_8px_30px_rgba(var(--ink-rgb),0.12)] transition-all duration-300 ease-smooth hover:shadow-[0_12px_40px_rgba(var(--ink-rgb),0.2)]"
            >
              {t('button')}
            </Link>
          </MagneticButton>
        </div>

        <p className="mt-6 text-sm text-[var(--text-muted)]">{t('note')}</p>
      </div>
    </section>
  )
}
