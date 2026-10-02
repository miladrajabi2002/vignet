import { cn } from '@/lib/utils'

/**
 * A conversation's state as one dot: amber blinks while it waits for an
 * operator, violet is open, nothing once resolved. The blink replaces the
 * old «نیاز به اپراتور» chip, so a waiting row stands out without a label.
 */
export function ConversationStatusDot({
  attention,
  open,
  label,
  className,
}: {
  attention: boolean
  open: boolean
  label: string
  className?: string
}) {
  return (
    <span role="img" aria-label={label} title={label} className={cn('relative inline-flex h-2 w-2 shrink-0', className)}>
      {attention && (
        <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-75 motion-reduce:hidden" />
      )}
      <span
        aria-hidden="true"
        className={cn('relative h-2 w-2 rounded-full', attention ? 'bg-amber-500' : open ? 'bg-[var(--signal)]' : 'bg-transparent')}
      />
    </span>
  )
}
