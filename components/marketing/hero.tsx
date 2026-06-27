'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { ParticleGrid } from './particle-grid'
import { Spotlight } from './spotlight'
import { BeamLines } from './beam-lines'

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

export function Hero() {
  const t = useTranslations('marketing.hero')
  const words = t.raw('rotate') as string[]
  const typed = useTypewriter(words)

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      {/* Dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <ParticleGrid />
      <Spotlight />

      <BeamLines />

      {/* Bottom vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-64 bg-gradient-to-b from-transparent to-black"
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-20 mx-auto max-w-3xl px-6 text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] px-4 py-1.5 text-xs tracking-wide text-white/60">
          {t('badge')}
        </span>

        <h1 className="mt-8 text-5xl font-light leading-tight md:text-6xl">
          <span className="gradient-text block">{t('title')}</span>
          <span className="mt-2 block min-h-[1.2em] text-white">
            {typed}
            <span className="ms-1 inline-block w-[2px] animate-blink bg-white align-middle" style={{ height: '0.9em' }} />
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-md text-base text-white/45">
          {t('subtitle')}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded-xl bg-white px-7 py-3 font-medium text-black shadow-[0_0_40px_rgba(255,255,255,0.15)] transition-transform hover:scale-[1.02]"
          >
            {t('ctaPrimary')}
          </Link>
          <Link
            href="#features"
            className="rounded-xl border border-white/20 px-7 py-3 font-medium text-white/80 transition-colors hover:border-white/40 hover:text-white"
          >
            {t('ctaSecondary')}
          </Link>
        </div>
      </motion.div>

      <motion.div
        aria-hidden
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 z-20 text-white/30"
      >
        <ChevronDown className="h-6 w-6" />
      </motion.div>
    </section>
  )
}
