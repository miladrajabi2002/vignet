import type { ChannelType } from '@prisma/client'
import type { ComponentType } from 'react'
import {
  Globe,
  Hexagon,
  Link2,
  MessageCircleCheck,
  Webhook,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'

// Single-colour outline glyphs (Tabler brand set, MIT) so every channel badge
// reads the same weight as the lucide icons beside it; the full-colour logos
// in social-links are for the marketing site.
function OutlineGlyph({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <OutlineGlyph className={className}>
      <path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
      <path d="M16.5 7.5v.01" />
    </OutlineGlyph>
  )
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <OutlineGlyph className={className}>
      <path d="M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4" />
    </OutlineGlyph>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <OutlineGlyph className={className}>
      <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
      <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
    </OutlineGlyph>
  )
}

type ChannelIcon = ComponentType<{ className?: string }>

const ICONS: Record<ChannelType, ChannelIcon> = {
  WEB_WIDGET: Globe,
  TELEGRAM: TelegramIcon,
  BALE: MessageCircleCheck,
  RUBIKA: Hexagon,
  WHATSAPP: WhatsAppIcon,
  INSTAGRAM: InstagramIcon,
  API: Webhook,
  CHAT_LINK: Link2,
}

// Only the icon carries the app's colour; the badge itself stays a quiet
// outline so a list of conversations never turns into a wall of colour.
const ICON_TONES: Record<ChannelType, string> = {
  TELEGRAM: 'text-sky-500',
  WHATSAPP: 'text-emerald-500',
  INSTAGRAM: 'text-fuchsia-500',
  BALE: 'text-[#047857]',
  RUBIKA: 'text-orange-500',
  WEB_WIDGET: 'text-violet-600',
  API: 'text-zinc-500',
  CHAT_LINK: 'text-zinc-500',
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

export const CHANNEL_LABELS_FA: Record<ChannelType, string> = {
  WEB_WIDGET: 'ویجت سایت',
  TELEGRAM: 'تلگرام',
  BALE: 'بله',
  RUBIKA: 'روبیکا',
  WHATSAPP: 'واتساپ',
  INSTAGRAM: 'اینستاگرام',
  API: 'اتصال مستقیم',
  CHAT_LINK: 'لینک چت',
}

/** Channel name in the panel's language; unknown values fall back to the raw key. */
export function channelLabel(type: string, locale: string): string {
  const labels: Record<string, string> = locale === 'en' ? CHANNEL_LABELS : CHANNEL_LABELS_FA
  return labels[type] ?? type
}

/** The app as a bare icon, for dense rows where a labelled chip is noise. */
export function ChannelGlyph({ type, className }: { type: ChannelType; className?: string }) {
  const Icon = ICONS[type]
  const locale = useLocale()
  const label = channelLabel(type, locale)
  return (
    <span role="img" aria-label={label} title={label} className={cn('inline-flex shrink-0', className)}>
      <Icon aria-hidden="true" className={cn('h-3.5 w-3.5', ICON_TONES[type])} />
    </span>
  )
}

export function ChannelBadge({ type }: { type: ChannelType }) {
  const Icon = ICONS[type]
  const locale = useLocale()
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-[var(--border-default)] bg-white px-1.5 text-[12px] font-medium leading-none text-[var(--text-secondary)]">
      <Icon aria-hidden="true" className={cn('h-3.5 w-3.5 shrink-0', ICON_TONES[type])} />
      {channelLabel(type, locale)}
    </span>
  )
}

/**
 * WooCommerce "plugin" badge — shown on contacts that were imported from a
 * WooCommerce store (via the WordPress plugin sync). Distinct from the
 * ChannelBadge because WooCommerce is not a real-time messenger channel;
 * it's a source/import provenance marker.
 *
 * Matches the WOO_SOURCE_TAG constant in lib/integrations/woocommerce.ts.
 * Keep the tag value in sync.
 */
export const WOO_SOURCE_TAG = 'افزونه ووکامرس'

function WooCommerceIcon({ className }: { className?: string }) {
  // Simplified WooCommerce logo mark (the "W" bubble).
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M3.6 3h16.8c.99 0 1.8.81 1.8 1.8v9c0 .99-.81 1.8-1.8 1.8h-9.18l-3.06 3.06c-.36.36-.96.12-.96-.36V15.6H3.6c-.99 0-1.8-.81-1.8-1.8v-9C1.8 3.81 2.61 3 3.6 3zm.36 2.16c-.18 0-.36.18-.36.36v8.28c0 .18.18.36.36.36h1.44c.18 0 .36-.18.36-.36V9.6l3.06 4.32c.06.12.18.18.3.18h.78c.18 0 .36-.18.36-.36V5.52c0-.18-.18-.36-.36-.36H9.78c-.18 0-.36.18-.36.36v3.84L6.36 5.04c-.06-.12-.18-.18-.3-.18H3.96zm9.6 0c-.18 0-.36.18-.36.36v8.28c0 .18.18.36.36.36h1.44c.18 0 .36-.18.36-.36V9.6l3.06 4.32c.06.12.18.18.3.18h.78c.18 0 .36-.18.36-.36V5.52c0-.18-.18-.36-.36-.36h-1.44c-.18 0-.36.18-.36.36v3.84l-3.06-4.32c-.06-.12-.18-.18-.3-.18h-1.44z" />
    </svg>
  )
}

export function WooCommerceBadge() {
  const fa = useLocale() !== 'en'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-black/10 bg-black/[0.04] px-1.5 py-0.5 text-[12px] font-medium text-[var(--text-secondary)]"
      title={fa ? 'مشتری از طریق افزونه ووکامرس وارد شده است' : 'This customer came in through the WooCommerce plugin'}
    >
      <WooCommerceIcon className="h-3 w-3" />
      {fa ? 'افزونه' : 'Plugin'}
    </span>
  )
}

/**
 * Render provenance badges for a contact's tags. Currently recognizes only
 * the WooCommerce source tag; safe to extend for other plugin/import sources
 * (e.g. Shopify, Excel import) by adding more tag → badge mappings here.
 */
export function SourceTagBadges({ tags }: { tags?: string[] | null }) {
  if (!tags || tags.length === 0) return null
  const out: React.ReactNode[] = []
  if (tags.includes(WOO_SOURCE_TAG)) {
    out.push(<WooCommerceBadge key="woo" />)
  }
  return out.length ? <>{out}</> : null
}
