'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CopyButton({
  value,
  label,
  copiedLabel,
  showLabel = false,
  className,
}: {
  value: string
  label: string
  copiedLabel: string
  showLabel?: boolean
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timer)
  }, [copied])

  async function copyValue() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const input = document.createElement('textarea')
      input.value = value
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      // Only claim success when a copy actually happened — never announce
      // "copied" if the fallback silently failed (screen-reader honesty).
      const copiedViaFallback = document.execCommand('copy')
      input.remove()
      if (!copiedViaFallback) return
    }
    setCopied(true)
  }

  const accessibleLabel = copied ? copiedLabel : label

  return (
    <button
      type="button"
      onClick={copyValue}
      aria-label={accessibleLabel}
      title={accessibleLabel}
      className={cn(
        'spatial-press inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50',
        className,
      )}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <Copy className="h-4 w-4" aria-hidden="true" />
      )}
      {showLabel && <span>{accessibleLabel}</span>}
      {/* Announce the copy result to assistive tech; icon swaps alone are silent. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? copiedLabel : ''}
      </span>
    </button>
  )
}
