'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('marketing.footer')
  const tNav = useTranslations('nav')

  const links = [
    { label: tNav('features'), href: '/#features' },
    { label: tNav('how'), href: '/#how' },
    { label: tNav('pricing'), href: '/#pricing' },
    { label: tNav('docs'), href: '/docs' },
    { label: tNav('login'), href: '/login' },
  ]

  return (
    <footer className="relative bg-[var(--bg-base)]">
      {/* Soft gradient hairline instead of a hard border */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-hover)] to-transparent"
      />

      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-start justify-between gap-10 md:flex-row md:items-center">
          <div>
            <span className="font-mono text-xl font-medium tracking-widest text-[var(--text-primary)]">
              VIGENT
            </span>
            <p className="mt-3 max-w-xs text-sm text-[var(--text-secondary)]">{t('tagline')}</p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[var(--border-default)] pt-6 text-xs text-[var(--text-muted)] sm:flex-row">
          <span>{t('rights')}</span>
          <div className="flex items-center gap-5">
            <Link
              href="/status"
              className="inline-flex items-center gap-2 transition-colors hover:text-[var(--text-secondary)]"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Status
            </Link>
            <span>{t('madeIn')}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
