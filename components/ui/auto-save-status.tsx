'use client'

import type { ReactNode } from 'react'
import { AlertCircle, CloudCheck, Loader2 } from 'lucide-react'
import { useLocale } from 'next-intl'
import type { AutoSaveStatus as Status } from '@/lib/auto-save'
import { cn } from '@/lib/utils'

/**
 * What a form shows where its save button used to be — the companion of
 * useAutoSave, and the same three beats as SaveButton so saving reads the
 * same everywhere:
 *
 *   idle   → a quiet "changes save automatically"
 *   saving → a spinner, "در حال ذخیره…" (from the first keystroke on)
 *   saved  → a check that draws itself, "ذخیره شد"; settles back on its own
 *   error  → "ذخیره نشد" with a retry
 *
 * The pill keeps its padding in every state, so nothing around it shifts.
 * Motion is SaveButton's (`.ui-save-icon`, `.ui-save-check` in
 * app/ui-system.css) and is skipped under reduced motion.
 */
export function AutoSaveStatus({
  status,
  onRetry,
  idleLabel,
  errorLabel,
  className,
}: {
  status: Status
  onRetry?: () => void
  /** Resting text; pass `null` to show nothing until something is saved. */
  idleLabel?: ReactNode
  errorLabel?: ReactNode
  className?: string
}) {
  const fa = useLocale() !== 'en'
  const visual = status === 'pending' ? 'saving' : status

  const label: Record<typeof visual, ReactNode> = {
    idle: idleLabel === undefined ? (fa ? 'تغییرات خودکار ذخیره می‌شود' : 'Changes save automatically') : idleLabel,
    saving: fa ? 'در حال ذخیره…' : 'Saving…',
    saved: fa ? 'ذخیره شد' : 'Saved',
    error: errorLabel ?? (fa ? 'ذخیره نشد' : 'Not saved'),
  }
  const icon: Record<typeof visual, ReactNode> = {
    idle: <CloudCheck className="h-4 w-4" aria-hidden="true" />,
    saving: <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />,
    saved: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
        <path className="ui-save-check" d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
      </svg>
    ),
    error: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  }
  const tone: Record<typeof visual, string> = {
    idle: 'text-[var(--text-muted)]',
    saving: 'text-[var(--text-secondary)]',
    saved: 'bg-emerald-500/10 text-emerald-700',
    error: 'bg-red-500/10 text-red-700',
  }

  if (visual === 'idle' && label.idle === null) {
    return <span role="status" aria-live="polite" className="sr-only" />
  }

  return (
    <span
      data-auto-save={visual}
      className={cn(
        'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium leading-5 transition-colors duration-200',
        tone[visual],
        className,
      )}
    >
      <span key={visual} className="ui-save-icon inline-flex shrink-0">{icon[visual]}</span>
      <span role="status" aria-live="polite" className="min-w-0 truncate">{label[visual]}</span>
      {visual === 'error' && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="-my-1 inline-flex min-h-9 shrink-0 items-center px-1 font-bold underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          {fa ? 'تلاش دوباره' : 'Retry'}
        </button>
      )}
    </span>
  )
}

/**
 * The status as a small dock that stays in view at the bottom of a long
 * form (clear of the phone tab bar) and comes to rest where the save button
 * used to be.
 */
export function AutoSaveDock({ className, ...props }: Parameters<typeof AutoSaveStatus>[0]) {
  return (
    // Sits at the start edge, so the back-to-top button (end corner) stays usable.
    <div className="pointer-events-none sticky z-30 flex [bottom:calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-4">
      <AutoSaveStatus
        {...props}
        className={cn('pointer-events-auto min-h-10 border border-[var(--border-default)] bg-white/95 px-3.5 shadow-[var(--elev-2)] backdrop-blur', className)}
      />
    </div>
  )
}
