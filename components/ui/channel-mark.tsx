import type { ComponentType } from 'react'
import { Globe, Link2, MessagesSquare, Webhook } from 'lucide-react'
import { BaleIcon, InstagramIcon, RubikaIcon, TelegramIcon } from '@/components/marketing/social-links'
import { cn } from '@/lib/utils'

/**
 * Channel identity (ط۶): every app keeps the same tint and colour everywhere
 * — public site, integrations, channel setup, inbox and CRM — instead of a
 * row of identical black tiles. Values mirror the public site's CHANNELS.
 */
export type ChannelKey = 'INSTAGRAM' | 'TELEGRAM' | 'BALE' | 'RUBIKA' | 'WEB_WIDGET' | 'CHAT_LINK' | 'WHATSAPP' | 'API'

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>

export const CHANNEL_TONES: Record<ChannelKey, { tint: string; color: string; icon: Icon }> = {
	INSTAGRAM: { tint: '#fdf2f8', color: '#be185d', icon: InstagramIcon },
	TELEGRAM: { tint: '#eff6ff', color: '#0369a1', icon: TelegramIcon },
	BALE: { tint: '#e6f7f1', color: '#047857', icon: BaleIcon },
	RUBIKA: { tint: '#fff7ed', color: '#c2410c', icon: RubikaIcon },
	WEB_WIDGET: { tint: '#f3f1ff', color: '#5b3de8', icon: Globe },
	CHAT_LINK: { tint: '#f4f4f5', color: '#3f3f46', icon: Link2 },
	WHATSAPP: { tint: '#ecfdf5', color: '#15803d', icon: MessagesSquare },
	API: { tint: '#f4f4f5', color: '#3f3f46', icon: Webhook },
}

export function ChannelMark({
	channel,
	size = 'md',
	className,
}: {
	channel: ChannelKey
	size?: 'sm' | 'md' | 'lg'
	className?: string
}) {
	const tone = CHANNEL_TONES[channel] ?? CHANNEL_TONES.API
	const Icon = tone.icon
	const box = size === 'sm' ? 'h-7 w-7 rounded-lg' : size === 'lg' ? 'h-12 w-12 rounded-2xl' : 'h-10 w-10 rounded-xl'
	const glyph = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
	return (
		<span
			aria-hidden
			className={cn('inline-grid shrink-0 place-items-center', box, className)}
			style={{ background: tone.tint, color: tone.color }}
		>
			<Icon className={glyph} strokeWidth={1.8} />
		</span>
	)
}
