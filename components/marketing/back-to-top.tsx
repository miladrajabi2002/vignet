'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'

/**
 * Floating "back to top" button.
 * Appears after the user scrolls past the first viewport (one screen height)
 * and smoothly scrolls back to the very top of the page — i.e. the Hero /
 * first section — when clicked. Respects reduced-motion preferences.
 */
export function BackToTop() {
        const [visible, setVisible] = useState(false)
        const reduce = useReducedMotion()

        useEffect(() => {
                const onScroll = () => {
                        // Show the button once the user has scrolled past roughly one viewport.
                        setVisible(window.scrollY > window.innerHeight * 0.8)
                }
                onScroll()
                window.addEventListener('scroll', onScroll, { passive: true })
                return () => window.removeEventListener('scroll', onScroll)
        }, [])

        const scrollToTop = () => {
                if (reduce) {
                        window.scrollTo(0, 0)
                } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                }
        }

        return (
                <AnimatePresence initial={!reduce}>
                        {visible && (
                                <motion.button
                                        type="button"
                                        onClick={scrollToTop}
                                        aria-label="بازگشت به بالا"
                                        initial={reduce ? false : { opacity: 0, scale: 0.8, y: 12 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.8, y: 12 }}
                                        transition={reduce ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                        whileHover={reduce ? undefined : { y: -2 }}
                                        whileTap={reduce ? undefined : { scale: 0.94 }}
                                        className="fixed bottom-6 end-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-hover)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]"
                                        style={{ boxShadow: 'var(--shadow-card)' }}
                                >
                                        <ArrowUp className="h-5 w-5" aria-hidden="true" />
                                </motion.button>
                        )}
                </AnimatePresence>
        )
}
