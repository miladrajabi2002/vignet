'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('marketing.footer')
  const tNav = useTranslations('nav')

  const columns = [
    {
      title: t('product'),
      links: [
        { label: tNav('features'), href: '/features' },
        { label: tNav('pricing'), href: '/pricing' },
      ],
    },
    {
      title: t('resources'),
      links: [
        { label: tNav('docs'), href: '/docs' },
        { label: 'Blog', href: '/blog' },
      ],
    },
    {
      title: t('company'),
      links: [
        { label: tNav('login'), href: '/login' },
        { label: tNav('getStarted'), href: '/login' },
      ],
    },
  ]

  return (
    <footer className="border-t border-white/[0.06] bg-black">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <span className="font-mono text-lg font-medium tracking-widest text-white">
              VIGENT
            </span>
            <p className="mt-3 max-w-xs text-sm text-white/40">
              {t('tagline')}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-medium text-white/70">{col.title}</h4>
              <ul className="mt-4 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-white/40 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-white/30 sm:flex-row">
          <span>{t('rights')}</span>
          <span>{t('madeIn')}</span>
        </div>
      </div>
    </footer>
  )
}
