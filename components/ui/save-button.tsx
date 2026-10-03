'use client'

import { forwardRef, useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * The one way a form commits its changes — every in-place "save" in the
 * user panel and the admin panel uses this button, so saving looks and
 * feels the same everywhere:
 *
 *   idle   → the label (and an optional leading icon)
 *   saving → a spinner, label "در حال ذخیره…", button disabled
 *   saved  → a check that draws itself, label "ذخیره شد", one soft ring;
 *            after ~1.8s it settles back to idle on its own
 *
 * All three labels share one grid cell, so the button keeps the width of
 * its longest label and never jumps while the text changes. Motion lives in
 * app/ui-system.css (`.ui-save*`) and is skipped under reduced motion.
 */

export type SaveState = 'idle' | 'saving' | 'saved'

/** How long a form that leaves the page after saving lets the "saved" check show first. */
export const SAVED_BEAT_MS = 650

/** Drives a SaveButton: `start()` before the request, `done()` on success, `fail()` on error. */
export function useSaveState(holdMs = 1800) {
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const start = useCallback(() => {
    window.clearTimeout(timer.current)
    setState('saving')
  }, [])
  const done = useCallback(() => {
    window.clearTimeout(timer.current)
    setState('saved')
    timer.current = window.setTimeout(() => setState('idle'), holdMs)
  }, [holdMs])
  const fail = useCallback(() => {
    window.clearTimeout(timer.current)
    setState('idle')
  }, [])

  return { state, start, done, fail, saving: state === 'saving', saved: state === 'saved' }
}

const VARIANTS = {
  primary: 'bg-[#111] text-white shadow-[var(--shadow-control)] hover:bg-[#2a2a2e]',
  secondary:
    'border border-[var(--border-default)] bg-white text-[var(--text-primary)] shadow-[var(--shadow-xs)] hover:border-[var(--border-hover)]',
} as const

const SIZES = {
  sm: 'min-h-9 px-3.5 text-[13px]',
  md: 'min-h-11 px-5 text-sm',
} as const

export interface SaveButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  state: SaveState
  /** False when nothing has changed: the button rests disabled. Omit for forms that don't track it. */
  dirty?: boolean
  label?: ReactNode
  savingLabel?: ReactNode
  savedLabel?: ReactNode
  /** Leading icon in the idle state. */
  icon?: ReactNode
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
}

export const SaveButton = forwardRef<HTMLButtonElement, SaveButtonProps>(function SaveButton(
  { state, dirty, label, savingLabel, savedLabel, icon, variant = 'primary', size = 'md', disabled, className, type, ...rest },
  ref,
) {
  const fa = useLocale() !== 'en'
  const labels: Record<SaveState, ReactNode> = {
    idle: label ?? (fa ? 'ذخیره' : 'Save'),
    saving: savingLabel ?? (fa ? 'در حال ذخیره…' : 'Saving…'),
    saved: savedLabel ?? (fa ? 'ذخیره شد' : 'Saved'),
  }
  const lead = state === 'saving'
    ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
    : state === 'saved'
      ? <SavedCheck />
      : icon ?? null

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      data-save-state={state}
      // While "saved" the button shows the confirmation, so it stays inked even though there is nothing left to save.
      disabled={disabled || state !== 'idle' || dirty === false}
      aria-busy={state === 'saving' || undefined}
      className={cn(
        'ui-save spatial-press inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-[background-color,border-color,box-shadow] duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {lead ? <span key={state} className="ui-save-icon inline-flex shrink-0">{lead}</span> : null}
      <span className="ui-save-label">
        {(Object.keys(labels) as SaveState[]).map((key) => (
          <span key={key} data-on={key === state || undefined} aria-hidden={key !== state || undefined}>{labels[key]}</span>
        ))}
      </span>
      <span className="sr-only" role="status" aria-live="polite">{state === 'saved' ? labels.saved : ''}</span>
    </button>
  )
})

function SavedCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path className="ui-save-check" d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
    </svg>
  )
}
