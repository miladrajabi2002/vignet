'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { PartyPopper } from 'lucide-react'

export function OnboardingCelebrate() {
  const t = useTranslations('onboarding')

  // Simple white particle burst (B&W — no color).
  const particles = Array.from({ length: 24 })

  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-12 text-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {particles.map((_, i) => {
          const angle = (i / particles.length) * Math.PI * 2
          return (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-[var(--white)]"
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{
                opacity: 0,
                x: Math.cos(angle) * 220,
                y: Math.sin(angle) * 220,
                scale: 0,
              }}
              transition={{ duration: 1.4, ease: 'easeOut', delay: 0.1 }}
            />
          )
        })}
      </div>

      <PartyPopper className="h-10 w-10 text-[var(--text-primary)]" />
      <h2 className="mt-4 text-2xl font-light text-[var(--text-primary)]">
        {t('completedTitle')}
      </h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        {t('completedSubtitle')}
      </p>
      <Link
        href="/overview"
        className="mt-6 rounded-xl bg-[var(--white)] px-6 py-2.5 font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
      >
        {t('steps.test.cta')}
      </Link>
    </div>
  )
}
