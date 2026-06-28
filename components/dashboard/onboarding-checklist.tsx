'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, ArrowRight } from 'lucide-react'
import type { OnboardingState } from '@/lib/onboarding'
import { ONBOARDING_STEPS, ONBOARDING_TOTAL } from '@/lib/onboarding-steps'
import { skipOnboarding } from '@/app/actions/auth'
import { cn } from '@/lib/utils'

export function OnboardingChecklist({
  initialState,
}: {
  initialState: OnboardingState
}) {
  const t = useTranslations('onboarding')
  const [open, setOpen] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [, startTransition] = useTransition()

  const { step, checks } = initialState
  const progress = Math.round((step / ONBOARDING_TOTAL) * 100)

  const handleSkip = () => {
    setHidden(true)
    startTransition(() => skipOnboarding())
  }

  if (hidden) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between p-5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-3 text-start"
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 text-[var(--text-muted)] transition-transform',
              !open && '-rotate-90 rtl:rotate-90',
            )}
          />
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {t('title')}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              {t('progress', { done: step, total: ONBOARDING_TOTAL })}
            </div>
          </div>
        </button>
        <button
          onClick={handleSkip}
          className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
        >
          {t('skip')}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-5 h-1 overflow-hidden rounded-full bg-[var(--white-05)]">
        <motion.div
          className="h-full bg-[var(--white)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <ul className="space-y-1 p-3">
              {ONBOARDING_STEPS.map((s, i) => {
                const done = checks[s.check]
                const isCurrent = !done && step === i
                return (
                  <li key={s.key}>
                    <Link
                      href={s.href}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-[var(--bg-hover)]',
                        isCurrent && 'bg-[var(--bg-hover)]',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs',
                          done
                            ? 'border-success bg-success/10 text-success'
                            : 'border-[var(--border-hover)] text-[var(--text-muted)]',
                        )}
                      >
                        {done ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : isCurrent ? (
                          <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--white)]" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            'text-sm',
                            done
                              ? 'text-[var(--text-muted)] line-through'
                              : 'text-[var(--text-primary)]',
                          )}
                        >
                          {t(`steps.${s.key}.title`)}
                        </div>
                        <div className="truncate text-xs text-[var(--text-secondary)]">
                          {t(`steps.${s.key}.desc`)}
                        </div>
                      </div>
                      {!done && (
                        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] rtl:rotate-180" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
