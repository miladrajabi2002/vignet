import type { ComponentType, ReactNode, SVGProps } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Globe, Link2, Sparkles } from 'lucide-react'
import { BaleIcon, InstagramIcon, RubikaIcon, TelegramIcon } from '@/components/marketing/social-links'
import { SUPPORT_PHONE_E164 } from '@/lib/marketing/contact'
import { cn } from '@/lib/utils'

export type SiteLocale = 'fa' | 'en'
export type IconType = ComponentType<SVGProps<SVGSVGElement> & { className?: string; strokeWidth?: number | string }>

export const toSiteLocale = (value: string | undefined | null): SiteLocale => (value === 'en' ? 'en' : 'fa')

/** The forward arrow for the reading direction (← in Persian, → in English). */
export function ForwardArrow({ locale, className }: { locale: SiteLocale; className?: string }) {
	const Icon = locale === 'fa' ? ArrowLeft : ArrowRight
	return <Icon aria-hidden className={cn('size-4 shrink-0', className)} strokeWidth={2} />
}

export const SIGNUP_HREF = '/login?next=/onboarding'
/** "Call support" dials the support line directly (lib/marketing/contact). */
export const SUPPORT_TEL = `tel:${SUPPORT_PHONE_E164}`

export function Container({ className, children }: { className?: string; children: ReactNode }) {
	return <div className={cn('mx-auto w-full max-w-[1200px] px-4 sm:px-6 xl:px-0', className)}>{children}</div>
}

const BTN_BASE = 'vg-press inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vg-signal focus-visible:ring-offset-2'
// Same fill, shadow and weight as the app's <Button variant="primary">; the
// pill shape is kept only for the large site CTAs (btnLg).
export const btnDark = cn(BTN_BASE, 'vg-btn-dark bg-vg-ink text-white shadow-[var(--shadow-control)]')
export const btnGhost = cn(BTN_BASE, 'vg-btn-ghost border border-black/[0.12] bg-white/70 text-vg-ink')
export const btnLg = 'h-[52px] rounded-full px-7 text-[15px] lg:h-14 lg:text-base'

/** Dark announcement pill above an H1 (orbiting spark ring). */
export function HeroPill({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span className={cn('vg-hp', className)}>
			<span aria-hidden className="vg-hp-spark" />
			<span aria-hidden className="vg-hp-surface" />
			<span className="relative inline-flex min-h-9 items-center gap-2 whitespace-nowrap px-4 text-[12px] font-medium text-white lg:min-h-[42px] lg:px-5 lg:text-[13px]">
				<Sparkles aria-hidden className="size-3.5 text-[#c7bdf0]" strokeWidth={1.8} />
				{children}
			</span>
		</span>
	)
}

/** Light label above a section title (thin rotating violet outline). */
export function SectionPill({ children, icon: Icon, iconClassName, dark = false, className }: { children: ReactNode; icon?: IconType; iconClassName?: string; dark?: boolean; className?: string }) {
	return (
		<span className={cn('vg-sp', dark && 'vg-sp-dark', className)}>
			<span aria-hidden className="vg-sp-spin" />
			<span aria-hidden className="vg-sp-surface" />
			<span className={cn('inline-flex h-8 items-center gap-[7px] px-3.5 text-[12px] font-medium lg:h-[34px] lg:text-[13px]', dark ? 'text-white' : 'text-vg-ink')}>
				{Icon ? <Icon aria-hidden className={cn('size-3.5 lg:size-[15px]', iconClassName ?? 'text-vg-signal')} strokeWidth={1.8} /> : null}
				{children}
			</span>
		</span>
	)
}

/** Standard section header: pill → H2 → optional lead. */
export function SectionHead({
	pill,
	icon,
	iconClassName,
	title,
	lead,
	align = 'center',
	dark = false,
	className,
	titleClassName,
	id,
}: {
	pill: ReactNode
	icon?: IconType
	iconClassName?: string
	title: ReactNode
	lead?: ReactNode
	align?: 'center' | 'start'
	dark?: boolean
	className?: string
	titleClassName?: string
	id?: string
}) {
	return (
		<div className={cn('flex flex-col', align === 'center' ? 'items-center text-center' : 'items-center text-center lg:items-start lg:text-start', className)}>
			<SectionPill icon={icon} iconClassName={iconClassName} dark={dark}>{pill}</SectionPill>
			<h2 id={id} className={cn('mt-3 text-balance text-[26px] font-bold leading-[1.5] lg:mt-4 lg:text-[44px] lg:leading-[1.38]', titleClassName)}>{title}</h2>
			{lead ? <p className={cn('mt-2 max-w-[660px] text-[14.5px] leading-[1.95] lg:mt-3.5 lg:text-[17px] lg:leading-[1.9]', dark ? 'text-[#a1a1aa]' : 'text-vg-sub')}>{lead}</p> : null}
		</div>
	)
}

export function CheckLine({ children, className, iconClassName }: { children: ReactNode; className?: string; iconClassName?: string }) {
	return (
		<span className={cn('inline-flex items-center gap-1.5', className)}>
			<Check aria-hidden className={cn('size-3.5 shrink-0 text-vg-ok lg:size-4', iconClassName)} strokeWidth={2.4} />
			{children}
		</span>
	)
}

/** Primary / secondary CTA pair used by heroes and the closing lamp. */
export function CtaPair({
	locale,
	primary,
	secondary,
	secondaryHref,
	secondaryIcon: SecondaryIcon,
	secondaryAria,
	className,
}: {
	locale: SiteLocale
	primary: string
	secondary: string
	secondaryHref: string
	secondaryIcon?: IconType
	secondaryAria?: string
	className?: string
}) {
	const external = /^(https?:|tel:)/.test(secondaryHref)
	const ghostClass = cn(btnGhost, btnLg, 'w-full sm:w-auto')
	const ghostInner = (
		<>
			{SecondaryIcon ? <SecondaryIcon aria-hidden className="size-[17px]" strokeWidth={1.8} /> : null}
			{secondary}
		</>
	)
	return (
		<div className={cn('flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3', className)}>
			<Link href={SIGNUP_HREF} className={cn(btnDark, btnLg, 'vg-sheen w-full sm:w-auto')}>
				{primary}
				<ForwardArrow locale={locale} className="size-[18px]" />
			</Link>
			{external ? (
				<a href={secondaryHref} aria-label={secondaryAria} className={ghostClass} {...(secondaryHref.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{ghostInner}</a>
			) : (
				<Link href={secondaryHref} aria-label={secondaryAria} className={ghostClass}>{ghostInner}</Link>
			)}
		</div>
	)
}

/* ── Channels ────────────────────────────────────────────────────────── */

export type ChannelId = 'instagram' | 'telegram' | 'bale' | 'rubika' | 'site' | 'link'

export const CHANNELS: { id: ChannelId; icon: IconType; tint: string; color: string; label: Record<SiteLocale, string>; short: Record<SiteLocale, string> }[] = [
	{ id: 'instagram', icon: InstagramIcon as IconType, tint: '#fdf2f8', color: '#be185d', label: { fa: 'اینستاگرام', en: 'Instagram' }, short: { fa: 'اینستاگرام', en: 'Instagram' } },
	{ id: 'telegram', icon: TelegramIcon as IconType, tint: '#eff6ff', color: '#0369a1', label: { fa: 'تلگرام', en: 'Telegram' }, short: { fa: 'تلگرام', en: 'Telegram' } },
	{ id: 'bale', icon: BaleIcon as IconType, tint: '#e6f7f1', color: '#00a37a', label: { fa: 'بله', en: 'Bale' }, short: { fa: 'بله', en: 'Bale' } },
	{ id: 'rubika', icon: RubikaIcon as IconType, tint: '#fff7ed', color: '#c2410c', label: { fa: 'روبیکا', en: 'Rubika' }, short: { fa: 'روبیکا', en: 'Rubika' } },
	{ id: 'site', icon: Globe, tint: '#f5f3fd', color: '#6e56cf', label: { fa: 'ویجت سایت', en: 'Website widget' }, short: { fa: 'سایت', en: 'Website' } },
	{ id: 'link', icon: Link2, tint: '#f4f4f5', color: '#3f3f46', label: { fa: 'لینک چت بیو', en: 'Bio chat link' }, short: { fa: 'لینک چت', en: 'Chat link' } },
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

export function faNum(locale: SiteLocale, value: number | string) {
	const text = String(value)
	return locale === 'fa' ? text.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : text
}
