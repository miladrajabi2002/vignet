'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { cn } from '@/lib/utils'

// In-page section anchors (homepage) plus the docs route.
const SECTION_IDS = ['features', 'how', 'pricing'] as const

export function Navbar() {
  const t = useTranslations('nav')
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll-spy: highlight the nav item for the section currently in view.
  useEffect(() => {
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const links = [
    { href: '/#features', id: 'features', label: t('features') },
    { href: '/#how', id: 'how', label: t('how') },
    { href: '/#pricing', id: 'pricing', label: t('pricing') },
    { href: '/docs', id: 'docs', label: t('docs') },
  ]

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled
          ? 'border-b border-white/[0.06] bg-black/70 backdrop-blur-xl'
          : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-mono text-lg font-medium tracking-widest text-white transition-opacity hover:opacity-70"
        >
          VIGENT
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm transition-colors',
                active === l.id
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="text-sm text-white/70 transition-colors hover:text-white"
          >
            {t('login')}
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black shadow-[0_0_0_0_rgba(255,255,255,0)] transition-all hover:scale-[1.03] hover:shadow-[0_0_24px_rgba(255,255,255,0.18)]"
          >
            {t('getStarted')}
          </Link>
        </div>

        <button
          className="text-white md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/[0.06] bg-black px-6 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm transition-colors',
                  active === l.id
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/70 hover:bg-white/[0.04] hover:text-white',
                )}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex items-center gap-3 pt-3">
              <LanguageSwitcher />
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg bg-white px-4 py-2 text-center text-sm font-medium text-black"
              >
                {t('getStarted')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
