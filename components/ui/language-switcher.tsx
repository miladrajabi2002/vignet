'use client'

import { useLocale } from 'next-intl'
import { useTransition } from 'react'
import { Languages } from 'lucide-react'
import { setLocale } from '@/app/actions/locale'
import { cn } from '@/lib/utils'

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()

  const toggle = () => {
    const next = locale === 'fa' ? 'en' : 'fa'
    startTransition(() => {
      setLocale(next)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label="Switch language"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:opacity-50',
        className,
      )}
    >
      <Languages className="h-4 w-4" />
      <span className="font-mono uppercase">{locale === 'fa' ? 'EN' : 'فا'}</span>
    </button>
  )
}
