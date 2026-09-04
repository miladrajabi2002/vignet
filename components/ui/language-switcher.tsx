'use client'

import { useLocale } from 'next-intl'
import { useState } from 'react'
import { Languages } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const [isPending, setIsPending] = useState(false)

  const toggle = async () => {
    const next = locale === 'fa' ? 'en' : 'fa'
    setIsPending(true)

    try {
      const pathname = window.location.pathname
      const onEnPrefix = pathname === '/en' || pathname.startsWith('/en/')

      if (next === 'en' && !onEnPrefix) {
        // English gets a shareable, indexable URL prefix. Middleware rewrites
        // /en/<path> to <path> with an English locale override and persists
        // the locale cookie — no separate API call needed.
        window.location.assign(`/en${pathname === '/' ? '' : pathname}`)
        return
      }

      if (next === 'fa' && onEnPrefix) {
        // Back to Persian: flip the cookie, then drop the URL prefix.
        await fetch('/api/locale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: 'fa' }),
        })
        window.location.assign(pathname.slice(3) || '/')
        return
      }

      // Same-URL toggle (locale-cookie only, unchanged legacy behavior).
      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      })

      if (!response.ok) throw new Error(`Locale update failed (${response.status})`)

      // A full reload applies lang/dir at the document root and also guarantees
      // that a tab left open across a deployment picks up the current client
      // bundle instead of retaining references to old Server Action IDs.
      window.location.reload()
    } catch (error) {
      console.error('[locale] Failed to switch language', error)
      setIsPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label="Switch language"
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-2.5 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:opacity-50',
        className,
      )}
    >
      <Languages className="h-4 w-4" />
      <span className="font-mono uppercase">{locale === 'fa' ? 'EN' : 'فا'}</span>
    </button>
  )
}
