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
