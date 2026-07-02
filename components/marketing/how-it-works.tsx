'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { KeyRound, Database, Rocket, Clock, ArrowRight, type LucideIcon } from 'lucide-react'

const STEPS: { icon: LucideIcon; titleKey: string; descKey: string; timeKey: string }[] = [
  { icon: KeyRound, titleKey: 'step1Title', descKey: 'step1', timeKey: 'step1Time' },
  { icon: Database, titleKey: 'step2Title', descKey: 'step2', timeKey: 'step2Time' },
  { icon: Rocket, titleKey: 'step3Title', descKey: 'step3', timeKey: 'step3Time' },
]

export function HowItWorks() {
  const t = useTranslations('marketing.how')

  return (
    <section id="how" className="bg-[var(--bg-base)] py-20 md:py-28">
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
          <p className="mx-auto mt-4 max-w-md text-[var(--text-secondary)]">{t('subtitle')}</p>
        </motion.div>

        <div className="relative mt-20">
          {/* Animated connector line that draws as it enters view (LTR & RTL). */}
          <motion.div
            aria-hidden
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="absolute inset-x-[16%] top-7 hidden h-px origin-center bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent md:block"
          />

          <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-6">
            {STEPS.map(({ icon: Icon, titleKey, descKey, timeKey }, i) => (
              <motion.div
                key={titleKey}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.55, delay: 0.15 + i * 0.15 }}
                className="group relative flex flex-col items-center text-center"
              >
                {/* Number badge with icon on hover */}
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-hover)] bg-[var(--bg-base)] transition-all duration-300 group-hover:scale-105 group-hover:border-[var(--border-strong)]">
                  <span className="font-mono text-lg text-[var(--text-secondary)] transition-opacity duration-300 group-hover:opacity-0">
                    {i + 1}
                  </span>
                  <Icon className="absolute h-6 w-6 text-[var(--text-primary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>

                <h3 className="mt-6 text-base font-medium text-[var(--text-primary)]">
                  {t(titleKey)}
                </h3>
                <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-[var(--text-secondary)]">
                  {t(descKey)}
                </p>

                {/* Time-to-complete chip */}
                <motion.span
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, delay: 0.45 + i * 0.15 }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--white-05)] px-3 py-1 text-[11px] text-[var(--text-muted)]"
                >
                  <Clock className="h-3 w-3" />
                  {t(timeKey)}
                </motion.span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Closing CTA line */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-16 flex justify-center"
        >
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-full border border-[var(--border-hover)] px-6 py-3 text-sm font-medium text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--white-05)]"
          >
            {t('cta')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
