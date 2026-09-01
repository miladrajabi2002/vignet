import type { ConvStatus } from '@prisma/client'
import { cn } from '@/lib/utils'

const STATUS_TONE: Record<ConvStatus, string> = {
  OPEN: 'border-sky-200 bg-sky-50 text-sky-700',
  RESOLVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  HANDED_OFF: 'border-amber-200 bg-amber-50 text-amber-800',
}

const DOT_TONE: Record<ConvStatus, string> = {
  OPEN: 'bg-sky-500',
  RESOLVED: 'bg-emerald-500',
  HANDED_OFF: 'bg-amber-500',
}

export function ConversationStatusBadge({
  status,
  label,
  attention = false,
  className,
}: {
  status: ConvStatus
  label: string
  attention?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-4',
        STATUS_TONE[status],
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
        {attention && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:animate-none',
              DOT_TONE[status],
            )}
          />
        )}
        <span
          className={cn(
            'relative inline-flex h-1.5 w-1.5 rounded-full',
            DOT_TONE[status],
          )}
        />
      </span>
      {label}
    </span>
  )
}
