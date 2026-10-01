import type { ConvStatus } from '@prisma/client'
import { StatusChip, type ChipTone } from '@/components/ui/status-chip'

/** Open = live work in progress (violet), resolved = green, handoff = amber. */
const STATUS_TONE: Record<ConvStatus, ChipTone> = {
  OPEN: 'signal',
  RESOLVED: 'ok',
  HANDED_OFF: 'warn',
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
    <StatusChip tone={STATUS_TONE[status]} dot pulse={attention} className={className}>
      {label}
    </StatusChip>
  )
}
