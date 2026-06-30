'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Spotlight } from './spotlight'

function useTypewriter(words: string[], typing = 90, deleting = 45, hold = 1600) {
  const [text, setText] = useState('')
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting'>('typing')

  useEffect(() => {
    const word = words[index % words.length]
    let timeout: ReturnType<typeof setTimeout>

    if (phase === 'typing') {
      if (text.length < word.length) {
        timeout = setTimeout(() => setText(word.slice(0, text.length + 1)), typing)
      } else {
        timeout = setTimeout(() => setPhase('holding'), hold)
      }
    } else if (phase === 'holding') {
      timeout = setTimeout(() => setPhase('deleting'), hold)
    } else {
      if (text.length > 0) {
        timeout = setTimeout(() => setText(word.slice(0, text.length - 1)), deleting)
      } else {
        setIndex((i) => i + 1)
        setPhase('typing')
      }
    }
    return () => clearTimeout(timeout)
  }, [text, phase, index, words, typing, deleting, hold])

  return text
}

// A single eased fade-up, staggered by `delay`. Honours reduced-motion.
function rise(delay: number, reduce: boolean | null) {
  return {
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as const },
  }
}

export function Hero() {
  const t = useTranslations('marketing.hero')
  const words = t.raw('rotate') as string[]
  const typed = useTypewriter(words)
  const reduce = useReducedMotion()

  return (
    <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden bg-[var(--bg-base)]">
      {/* Faint dot grid — barely there, just enough to give the white depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(var(--ink-rgb),0.05) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage:
            'radial-gradient(ellipse 75% 70% at 50% 38%, black, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 75% 70% at 50% 38%, black, transparent 75%)',
        }}
      />

      {/* Soft cursor spotlight — the only motion in the backdrop */}
      <Spotlight />

      {/* Bottom fade into the page */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48 bg-gradient-to-b from-transparent to-[var(--bg-base)]"
      />

      <div className="relative z-20 mx-auto max-w-3xl px-6 text-center">
        {/* Eyebrow */}
        <motion.div {...rise(0, reduce)}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-1.5 text-xs tracking-wide text-[var(--text-secondary)]">
            {t('badge')}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          {...rise(0.08, reduce)}
          className="mt-8 text-balance text-4xl font-light leading-[1.1] tracking-tight sm:text-5xl md:text-7xl md:leading-[1.05]"
        >
          <span className="gradient-text block">{t('title')}</span>
          <span className="mt-2 block min-h-[1.15em] text-[var(--text-primary)]">
            {typed}
            <span
              aria-hidden
              className="ms-1 inline-block w-[2px] animate-blink bg-[var(--text-primary)] align-middle"
              style={{ height: '0.82em' }}
            />
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          {...rise(0.16, reduce)}
          className="mx-auto mt-7 max-w-xl text-balance text-base leading-relaxed text-[var(--text-secondary)] md:text-lg"
        >
          {t('subtitle')}
        </motion.p>

        {/* CTAs — one dominant, one quiet */}
        <motion.div
          {...rise(0.24, reduce)}
          className="mt-10 flex w-full flex-col items-center justify-center gap-x-8 gap-y-5 sm:w-auto sm:flex-row"
        >
          <Link
            href="/login"
            className="group inline-flex w-full items-center justify-center rounded-full bg-[var(--white)] px-8 py-3.5 text-sm font-medium text-[var(--bg-base)] shadow-[0_8px_30px_rgba(var(--ink-rgb),0.12)] transition-all duration-300 ease-smooth hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(var(--ink-rgb),0.2)] sm:w-auto"
          >
            {t('ctaPrimary')}
          </Link>
          <Link
            href="#demo"
            className="group relative text-sm font-medium text-[var(--text-secondary)] transition-colors duration-300 hover:text-[var(--text-primary)]"
          >
            {t('ctaSecondary')}
            <span className="absolute inset-x-0 -bottom-1 h-px origin-center scale-x-0 bg-[var(--text-primary)] transition-transform duration-300 ease-smooth group-hover:scale-x-100" />
          </Link>
        </motion.div>

        {/* Trust line */}
        <motion.p
          {...rise(0.32, reduce)}
          className="mt-8 text-xs text-[var(--text-muted)]"
        >
          {t('trust')}
        </motion.p>
      </div>

      {/* Scroll cue */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-8 z-20"
      >
        <motion.div
          animate={reduce ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[var(--text-muted)]"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </motion.div>
    </section>
  )
}
