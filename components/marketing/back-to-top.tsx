'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { ArrowUp } from 'lucide-react'

/**
 * Floating "back to top" button. Uses an interruptible RAF animation instead
 * of native smooth scrolling so iOS and in-app browsers behave consistently.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false)
  const locale = useLocale() === 'en' ? 'en' : 'fa'
  const cancelAnimationRef = useRef<() => void>(() => {})

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => () => cancelAnimationRef.current(), [])

  const scrollToTop = () => {
    cancelAnimationRef.current()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, 0)
      return
    }

    const startY = window.scrollY || document.documentElement.scrollTop
    if (startY <= 0) return

    const duration = Math.min(520, Math.max(320, startY * 0.12))
    const startedAt = performance.now()
    let frameId = 0
    let finished = false

    const cleanup = () => {
      if (finished) return
      finished = true
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('wheel', interrupt)
      window.removeEventListener('touchstart', interrupt)
      window.removeEventListener('pointerdown', interrupt)
      document.removeEventListener('keydown', interrupt)
      cancelAnimationRef.current = () => {}
    }
    const interrupt = () => cleanup()
    const tick = (now: number) => {
      if (finished) return
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 4)
      window.scrollTo(0, Math.round(startY * (1 - eased)))

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick)
        return
      }
      window.scrollTo(0, 0)
      cleanup()
    }

    window.addEventListener('wheel', interrupt, { passive: true })
    window.addEventListener('touchstart', interrupt, { passive: true })
    window.addEventListener('pointerdown', interrupt, { passive: true })
    document.addEventListener('keydown', interrupt)
    cancelAnimationRef.current = cleanup
    frameId = window.requestAnimationFrame(tick)
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label={locale === 'fa' ? 'بازگشت به بالا' : 'Back to top'}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed end-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-hover)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-[opacity,transform,background-color,border-color] duration-200 ease-[var(--ease-spatial)] [bottom:calc(6rem+env(safe-area-inset-bottom))] motion-reduce:transform-none motion-reduce:transition-none lg:bottom-6 ${
        visible
          ? 'pointer-events-auto translate-y-0 scale-100 opacity-100 hover:-translate-y-0.5 active:scale-95'
          : 'pointer-events-none translate-y-2 scale-95 opacity-0'
      }`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
