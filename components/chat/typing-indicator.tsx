import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

type TypingIndicatorProps = {
  label: string
  accentColor?: string
  className?: string
  variant?: 'light' | 'app'
}

/** A compact, accessible typing bubble shared by first-party chat surfaces. */
export function TypingIndicator({
  label,
  accentColor,
  className,
  variant = 'light',
}: TypingIndicatorProps) {
  const style = accentColor
    ? ({ '--chat-typing-accent': accentColor } as CSSProperties)
    : undefined

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        'chat-typing-indicator flex w-fit max-w-[min(85%,20rem)] items-center gap-2.5 rounded-3xl rounded-ss-lg border px-3.5 py-3 shadow-sm',
        variant === 'app'
          ? 'border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-muted)]'
          : 'border-black/[0.07] bg-white text-neutral-500',
        className,
      )}
      style={style}
    >
      <span aria-hidden="true" className="chat-typing-dots flex shrink-0 items-center gap-1">
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
        <span className="chat-typing-dot" />
      </span>
      <span aria-hidden="true" className="truncate text-[11px] font-medium leading-5">
        {label}
      </span>
    </div>
  )
}
