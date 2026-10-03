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
  const label = CHANNEL_LABELS[type]
  return (
    <span role="img" aria-label={label} title={label} className={cn('inline-flex shrink-0', className)}>
      <Icon aria-hidden="true" className={cn('h-3.5 w-3.5', ICON_TONES[type])} />
    </span>
  )
}

// App names are brand names, so the badge keeps them in English in both
// panel languages, the way they appear on the customer's phone.
export function ChannelBadge({ type, label }: { type: ChannelType; label?: string | null }) {
  const Icon = ICONS[type]
  return (
    <span className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-[var(--border-default)] bg-white px-1.5 text-[12px] font-medium leading-none text-[var(--text-secondary)]">
      <Icon aria-hidden="true" className={cn('h-3.5 w-3.5 shrink-0', ICON_TONES[type])} />
      {label || CHANNEL_LABELS[type]}
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

// Outline "Woo" speech bubble, drawn on the same 24px grid and stroke as the
// channel glyphs above so it sits beside them at the same weight.
function WooCommerceIcon({ className }: { className?: string }) {
  return (
    <OutlineGlyph className={className}>
      <path d="M3.5 5.5h17a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1 -1.5 1.5h-5.5l-3.5 3l-.5 -3h-8a1.5 1.5 0 0 1 -1.5 -1.5v-8a1.5 1.5 0 0 1 1.5 -1.5z" />
      <path d="M5 9l1.25 4.5l1.75 -3l1.75 3l1.25 -4.5" />
      <path d="M13 11.25a1.25 1.5 0 1 0 2.5 0a1.25 1.5 0 1 0 -2.5 0" />
      <path d="M17 11.25a1.25 1.5 0 1 0 2.5 0a1.25 1.5 0 1 0 -2.5 0" />
    </OutlineGlyph>
  )
}

/** Same chip as ChannelBadge, so the source sits in line with the channels. */
export function WooCommerceBadge() {
  const fa = useLocale() !== 'en'
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-[var(--border-default)] bg-white px-1.5 text-[12px] font-medium leading-none text-[var(--text-secondary)]"
      title={fa ? 'مشتری از طریق افزونه ووکامرس وارد شده است' : 'This customer came in through the WooCommerce plugin'}
    >
      <WooCommerceIcon className="h-3.5 w-3.5 shrink-0 text-[#7f54b3]" />
      {fa ? WOO_SOURCE_TAG : 'WooCommerce'}
    </span>
  )
}

/** Tags a provenance badge already shows, so tag lists can skip them. */
export function isSourceTag(tag: string): boolean {
  return tag === WOO_SOURCE_TAG
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
