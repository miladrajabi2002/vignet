import { InstagramIcon } from '@/components/marketing/social-links'
import { BaleIcon, Globe, Link2, RubikaIcon, TelegramIcon } from './sprite-icons'
import type { IconType, SiteLocale } from './ui'

// The channel logos repeat across the homepage (hero, quick facts) and the
// solution scenes, so they draw from the sprite. Kept out of ui.tsx, which
// client components (navbar, closing CTA) also import.

export type ChannelId = 'instagram' | 'telegram' | 'bale' | 'rubika' | 'site' | 'link'

export const CHANNELS: { id: ChannelId; icon: IconType; tint: string; color: string; label: Record<SiteLocale, string>; short: Record<SiteLocale, string> }[] = [
	{ id: 'instagram', icon: InstagramIcon as IconType, tint: '#fdf2f8', color: '#be185d', label: { fa: 'اینستاگرام', en: 'Instagram' }, short: { fa: 'اینستاگرام', en: 'Instagram' } },
	{ id: 'telegram', icon: TelegramIcon as IconType, tint: '#eff6ff', color: '#0369a1', label: { fa: 'تلگرام', en: 'Telegram' }, short: { fa: 'تلگرام', en: 'Telegram' } },
	{ id: 'bale', icon: BaleIcon as IconType, tint: '#e6f7f1', color: '#047857', label: { fa: 'بله', en: 'Bale' }, short: { fa: 'بله', en: 'Bale' } },
	{ id: 'rubika', icon: RubikaIcon as IconType, tint: '#fff7ed', color: '#c2410c', label: { fa: 'روبیکا', en: 'Rubika' }, short: { fa: 'روبیکا', en: 'Rubika' } },
	{ id: 'site', icon: Globe, tint: '#f3f1ff', color: '#5b3de8', label: { fa: 'ویجت سایت', en: 'Website widget' }, short: { fa: 'سایت', en: 'Website' } },
	{ id: 'link', icon: Link2, tint: '#f4f4f5', color: '#3f3f46', label: { fa: 'چت لینک بیو', en: 'Bio chat link' }, short: { fa: 'چت لینک', en: 'Chat link' } },
]

export function ChannelBadge({ channel, size = 34, iconSize = 18, radius = 10 }: { channel: (typeof CHANNELS)[number]; size?: number; iconSize?: number; radius?: number }) {
	const Icon = channel.icon
	return (
		<span
			aria-hidden
			className="inline-flex shrink-0 items-center justify-center"
			style={{ width: size, height: size, borderRadius: radius, background: channel.tint, color: channel.color }}
		>
			<span className="inline-flex" style={{ width: iconSize, height: iconSize }}>
				<Icon className="size-full" strokeWidth={1.8} />
			</span>
		</span>
	)
}
