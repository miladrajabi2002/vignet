'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shared Button primitive — the single source of truth for button geometry.
 *
 * Standardizes on the dashboard's dominant visual language:
 * rounded-xl radius, min-h-11 default height, `spatial-press` press
 * affordance, black-ink primary fill with `--shadow-control`, and the
 * unified `--text-primary` focus ring. Works in RTL out of the box
 * (logical properties only, icon gap via `gap-2`).
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'spatial-press inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-black text-white shadow-[var(--shadow-control)] hover:opacity-90',
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
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-sm',
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

/**
 * Class builder for link-shaped buttons (`<Link>` / `<a>` styled as buttons)
 * so anchors share the exact same geometry without a wrapper component.
 */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}
