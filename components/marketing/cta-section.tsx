'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import {
  Send,
  MessageCircle,
  Camera,
  Radio,
  MessageSquare,
  Globe,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MagneticButton } from '@/components/ui/magnetic-button'

// Same connection set as the channels section — the page closes on the
// promise it opened with: one agent, everywhere.
const CHANNEL_ICONS: LucideIcon[] = [
  Send,
  MessageCircle,
  Camera,
  Radio,
  MessageSquare,
  Globe,
  ShoppingBag,
]

export function CtaSection() {
  const t = useTranslations('marketing.cta')

  return (
    <section className="relative overflow-hidden bg-[var(--bg-base)] py-24 md:py-32">
      {/* Faint dot grid — bookends the hero so the page ends where it began */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(var(--ink-rgb),0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(ellipse 70% 65% at 50% 50%, black, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 65% at 50% 50%, black, transparent 75%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--white-05)] blur-3xl"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        {/* All connections, one line — quiet echo of the channels hub */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-center"
          dir="ltr"
        >
          {CHANNEL_ICONS.map((Icon, i) => (
            <div key={i} className="flex items-center">
              {i > 0 && <span className="h-px w-3 bg-[var(--border-hover)] sm:w-4" />}
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border sm:h-9 sm:w-9',
                  i === 3
                    ? 'border-transparent bg-[var(--white)] text-[var(--bg-base)]'
                    : 'border-[var(--border-hover)] bg-[var(--bg-surface)] text-[var(--text-secondary)]',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
          ))}
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="gradient-text mt-10 text-4xl font-light leading-tight tracking-tight md:text-5xl"
        >
          {t('title')}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-10 flex justify-center"
        >
          <MagneticButton>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-[var(--white)] px-8 py-3.5 text-sm font-medium text-[var(--bg-base)] shadow-[0_8px_30px_rgba(var(--ink-rgb),0.12)] transition-all duration-300 ease-smooth hover:shadow-[0_12px_40px_rgba(var(--ink-rgb),0.2)]"
            >
              {t('button')}
            </Link>
          </MagneticButton>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-6 text-sm text-[var(--text-muted)]"
        >
          {t('note')}
        </motion.p>
      </div>
    </section>
  )
}
