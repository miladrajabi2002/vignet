import type { ChannelType } from '@prisma/client'
import type { ComponentType } from 'react'
import {
  Globe,
  MessagesSquare,
  Radio,
  Webhook,
  Link2,
} from 'lucide-react'
import {
  InstagramIcon,
  TelegramIcon,
} from '@/components/marketing/social-links'
import { cn } from '@/lib/utils'

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47a8.9 8.9 0 0 1-1.65-2.05c-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35M12.04 21.5h-.01a9.5 9.5 0 0 1-4.84-1.33l-.35-.2-3.6.95.96-3.51-.23-.36A9.46 9.46 0 0 1 2.5 12C2.5 6.76 6.77 2.5 12.02 2.5a9.45 9.45 0 0 1 6.72 2.79A9.43 9.43 0 0 1 21.5 12c0 5.24-4.27 9.5-9.46 9.5m8.08-17.59A11.36 11.36 0 0 0 12.03.56C5.73.56.6 5.69.6 12c0 2.01.52 3.98 1.52 5.71L.5 23.44l5.86-1.54a11.44 11.44 0 0 0 5.67 1.45h.01c6.3 0 11.43-5.13 11.43-11.44 0-3.05-1.19-5.92-3.35-8" />
    </svg>
  )
}

type ChannelIcon = ComponentType<{ className?: string }>

const ICONS: Record<ChannelType, ChannelIcon> = {
  WEB_WIDGET: Globe,
  TELEGRAM: TelegramIcon,
  BALE: MessagesSquare,
  RUBIKA: Radio,
  WHATSAPP: WhatsAppIcon,
  INSTAGRAM: InstagramIcon,
  API: Webhook,
  CHAT_LINK: Link2,
}

const ICON_TONES: Partial<Record<ChannelType, string>> = {
  TELEGRAM: 'text-sky-500',
  WHATSAPP: 'text-emerald-500',
  INSTAGRAM: 'text-fuchsia-500',
}

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  WEB_WIDGET: 'Widget',
  TELEGRAM: 'Telegram',
  BALE: 'Bale',
  RUBIKA: 'Rubika',
  WHATSAPP: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  API: 'API',
  CHAT_LINK: 'Link',
}

export function ChannelBadge({ type }: { type: ChannelType }) {
  const Icon = ICONS[type]
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
      <Icon className={cn('h-3 w-3', ICON_TONES[type])} />
      {CHANNEL_LABELS[type]}
    </span>
  )
}
