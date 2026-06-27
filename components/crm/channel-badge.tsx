import type { ChannelType } from '@prisma/client'
import {
  Globe,
  Send,
  MessagesSquare,
  Radio,
  MessageCircle,
  Camera,
  Webhook,
} from 'lucide-react'

const ICONS: Record<ChannelType, typeof Globe> = {
  WEB_WIDGET: Globe,
  TELEGRAM: Send,
  BALE: MessagesSquare,
  RUBIKA: Radio,
  WHATSAPP: MessageCircle,
  INSTAGRAM: Camera,
  API: Webhook,
}

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  WEB_WIDGET: 'Web',
  TELEGRAM: 'Telegram',
  BALE: 'Bale',
  RUBIKA: 'Rubika',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  API: 'API',
}

export function ChannelBadge({ type }: { type: ChannelType }) {
  const Icon = ICONS[type]
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
      <Icon className="h-3 w-3" />
      {CHANNEL_LABELS[type]}
    </span>
  )
}
