'use client'

import { useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { ArrowUp } from 'lucide-react'

/**
 * Floating "back to top" button.
 * Appears after the user scrolls past the first viewport (one screen height)
 * and smoothly scrolls back to the very top of the page — i.e. the Hero /
 * first section — when clicked. Respects reduced-motion preferences.
 */
export function BackToTop() {
        const [visible, setVisible] = useState(false)
		const locale = useLocale() === 'en' ? 'en' : 'fa'

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
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                        window.scrollTo(0, 0)
                } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                }
        }

        return (
			<button
                                        type="button"
                                        onClick={scrollToTop}
				aria-label={locale === 'fa' ? 'بازگشت به بالا' : 'Back to top'}
				aria-hidden={!visible}
				tabIndex={visible ? 0 : -1}
				className={`fixed bottom-6 end-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-hover)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition-[opacity,transform,background-color,border-color] duration-200 ease-[var(--ease-spatial)] motion-reduce:transform-none motion-reduce:transition-none ${
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
