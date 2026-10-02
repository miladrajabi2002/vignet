'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared Button primitive — the single source of truth for button geometry.
 *
 * Standardizes on the dashboard's dominant visual language:
 * --radius-control (14px), a 36 / 44 / 52 height scale, `spatial-press`
 * press affordance, ink primary fill with `--shadow-control` (the same
 * shadow the public site's btnDark uses), and the unified violet
 * `--focus-ring`. Works in RTL out of the box
 * (logical properties only, icon gap via `gap-2`).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'spatial-press inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[#111] text-white shadow-[var(--shadow-control)] hover:bg-[#2a2a2e]',
  secondary:
    'border border-[var(--border-default)] bg-white text-[var(--text-secondary)] shadow-[var(--shadow-xs)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
  outline:
    'border border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
  ghost:
    'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
  danger:
    'bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-600',
}

const SIZES: Record<ButtonSize, string> = {
  // One height scale shared with the public site: 36 / 44 / 52.
  sm: 'min-h-9 px-3.5 text-[13px]',
  md: 'min-h-11 px-[18px] text-[15px]',
  lg: 'min-h-[52px] px-6 text-[15px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner and disables the button. */
  loading?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', loading = false, disabled, className, children, type, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
        {...rest}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        )}
        {children}
      </button>
    )
  },
)
