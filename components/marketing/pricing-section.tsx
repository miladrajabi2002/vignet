'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TrendSpark } from '@/components/blog/trend-spark'

interface Plan {
  name: string
  monthly: number
  featured?: boolean
  features: string[]
}

export function PricingSection() {
  const t = useTranslations('marketing.pricing')
  const tNav = useTranslations('dashboard')
  const locale = useLocale()
  const [annual, setAnnual] = useState(false)

  const fmt = (n: number) =>
    n.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')

  const plans: Plan[] = [
    {
      name: 'Trial',
      monthly: 0,
      features: [`1 ${tNav('agents')}`, `1 ${tNav('integrations')}`],
    },
    {
      name: 'Starter',
      monthly: 290_000,
      features: [`3 ${tNav('agents')}`, `2 ${tNav('integrations')}`, tNav('products')],
    },
    {
      name: 'Pro',
      monthly: 690_000,
      featured: true,
      features: [
        `10 ${tNav('agents')}`,
        `5 ${tNav('integrations')}`,
        tNav('products'),
        tNav('analytics'),
      ],
    },
    {
      name: 'Business',
      monthly: 1_490_000,
      features: [
        `∞ ${tNav('agents')}`,
        `∞ ${tNav('integrations')}`,
        tNav('products'),
        tNav('analytics'),
      ],
    },
  ]

  return (
    <section id="pricing" className="bg-[var(--bg-base)] py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs tracking-wide text-[var(--text-secondary)]">
            {t('eyebrow')}
          </span>
          <h2 className="mt-6 text-4xl font-light tracking-tight text-[var(--text-primary)] md:text-5xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[var(--text-secondary)]">{t('subtitle')}</p>
        </motion.div>

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">{t('monthly')}</span>
          <button
            onClick={() => setAnnual((a) => !a)}
            className="relative h-7 w-12 rounded-full border border-[var(--border-hover)] bg-[var(--white-05)]"
            aria-label="Toggle billing period"
          >
            <span
              className={cn(
                'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--white)] transition-all',
                annual ? 'start-6' : 'start-1',
              )}
            />
          </button>
          <span className="text-sm text-[var(--text-secondary)]">{t('annual')}</span>
          <span className="rounded-full border border-[var(--border-hover)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">
            {t('discount')}
          </span>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => {
            const price = annual
              ? Math.round(plan.monthly * 0.8)
              : plan.monthly
            const isFree = plan.monthly === 0
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={cn(
                  'relative flex flex-col rounded-2xl border p-6 transition-colors duration-300',
                  plan.featured
                    ? 'border-[var(--border-strong)] bg-[var(--white-05)] shadow-[0_0_50px_rgba(var(--ink-rgb),0.08)]'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
                )}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--white)] px-3 py-1 text-[11px] font-medium text-[var(--bg-base)]">
                    {t('popular')}
                  </span>
                )}

                {/* Plan name + a small growth spark — steeper tiers, same idea */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-medium text-[var(--text-primary)]">{plan.name}</h3>
                  <TrendSpark seed={plan.name} width={plan.featured ? 64 : 56} height={20} />
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={price}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="text-3xl font-light tabular-nums text-[var(--text-primary)]"
                    >
                      {isFree ? t('free') : fmt(price)}
                    </motion.span>
                  </AnimatePresence>
                  {!isFree && (
                    <span className="text-sm text-[var(--text-muted)]">{t('perMonth')}</span>
                  )}
                  {!isFree && annual && (
                    <motion.s
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-[var(--text-muted)]"
                    >
                      {fmt(plan.monthly)}
                    </motion.s>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                    >
                      <Check className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/login"
                  className={cn(
                    'mt-8 rounded-xl py-2.5 text-center text-sm font-medium transition-transform hover:scale-[1.02]',
                    plan.featured
                      ? 'bg-[var(--white)] text-[var(--bg-base)]'
                      : 'border border-[var(--border-hover)] text-[var(--text-primary)] hover:border-[var(--border-strong)]',
                  )}
                >
                  {t('cta')}
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
