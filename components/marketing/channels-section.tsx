'use client'

import Image from 'next/image'
import { m, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import { Check, Globe2, Inbox, Link2, Sparkles, Workflow, type LucideIcon } from 'lucide-react'
import { InstagramIcon, TelegramIcon } from './social-links'

type Locale = 'fa' | 'en'
type BrandIcon = typeof InstagramIcon | LucideIcon

type ChannelDefinition = {
	key: string
	fa: string
	en: string
	descriptionFa: string
	descriptionEn: string
	icon?: BrandIcon
	logoSrc?: string
	iconClass: string
	iconSurface: string
}

type ConnectorPath = {
	id: string
	d: string
}

const CHANNELS: ChannelDefinition[] = [
	{
		key: 'instagram',
		fa: 'اینستاگرام',
		en: 'Instagram',
		descriptionFa: 'دایرکت و کامنت',
		descriptionEn: 'DMs and comments',
		icon: InstagramIcon,
		iconClass: 'text-fuchsia-600',
		iconSurface: 'border-fuchsia-200/80 bg-gradient-to-br from-fuchsia-50 to-rose-50',
	},
	{
		key: 'telegram',
		fa: 'تلگرام',
		en: 'Telegram',
		descriptionFa: 'ربات و پیام',
		descriptionEn: 'Bots and messages',
		icon: TelegramIcon,
		iconClass: 'text-sky-500',
		iconSurface: 'border-sky-200/80 bg-sky-50',
	},
	{
		key: 'bale',
		fa: 'بله',
		en: 'Bale',
		descriptionFa: 'بازو و پیام',
		descriptionEn: 'Bots and messages',
		logoSrc: '/brands/bale-logo.svg',
		iconClass: 'text-[#00B894]',
		iconSurface: 'border-emerald-200/80 bg-emerald-50',
	},
	{
		key: 'rubika',
		fa: 'روبیکا',
		en: 'Rubika',
		descriptionFa: 'پیام‌رسان روبیکا',
		descriptionEn: 'Rubika messenger',
		logoSrc: '/brands/rubika-logo.svg',
		iconClass: '',
		iconSurface: 'border-neutral-200/80 bg-white',
	},
	{
		key: 'web',
		fa: 'ویجت سایت',
		en: 'Web widget',
		descriptionFa: 'گفتگو داخل سایت',
		descriptionEn: 'On-site conversations',
		icon: Globe2,
		iconClass: 'text-blue-600',
		iconSurface: 'border-blue-200/80 bg-blue-50',
	},
	{
		key: 'link',
		fa: 'لینک چت',
		en: 'Chat link',
		descriptionFa: 'لینک اختصاصی گفتگو',
		descriptionEn: 'Dedicated chat link',
		icon: Link2,
		iconClass: 'text-amber-600',
		iconSurface: 'border-amber-200/80 bg-amber-50',
	},
]

const connectorPaths: ConnectorPath[] = [
	{ id: 'instagram', d: 'M 96 104 C 96 210, 380 214, 600 338' },
	{ id: 'telegram', d: 'M 298 104 C 298 206, 446 226, 600 338' },
	{ id: 'bale', d: 'M 500 104 C 500 206, 540 246, 600 338' },
	{ id: 'rubika', d: 'M 700 104 C 700 206, 660 246, 600 338' },
	{ id: 'web', d: 'M 902 104 C 902 206, 754 226, 600 338' },
	{ id: 'link', d: 'M 1104 104 C 1104 210, 820 214, 600 338' },
]

const mobileConnectorPaths: ConnectorPath[] = [
	{ id: 'instagram-mobile', d: 'M 82 106 C 82 280, 138 374, 180 486' },
	{ id: 'telegram-mobile', d: 'M 278 106 C 278 280, 222 374, 180 486' },
	{ id: 'bale-mobile', d: 'M 82 237 C 82 340, 142 396, 180 486' },
	{ id: 'rubika-mobile', d: 'M 278 237 C 278 340, 218 396, 180 486' },
	{ id: 'web-mobile', d: 'M 82 368 C 92 424, 146 444, 180 486' },
	{ id: 'link-mobile', d: 'M 278 368 C 268 424, 214 444, 180 486' },
]

const COPY = {
	fa: {
		eyebrow: 'یک ورودی مشترک',
		title: 'صندوق پیام یکپارچه',
		subtitle: 'پیام‌ها از هر کانالی که شروع شوند، با تاریخچهٔ کامل مشتری در یک فضای مشترک قرار می‌گیرند تا تیم شما هیچ گفتگویی را از دست ندهد.',
		connected: 'متصل',
		hubEyebrow: 'مقصد مشترک همهٔ پیام‌ها',
		hubTitle: 'صندوق یکپارچه',
		hubSubtitle: 'یک تیم، یک تاریخچه و یک پاسخ هماهنگ',
		active: '۳۲ گفتگوی فعال',
		live: 'زنده و همگام',
		notifications: [
			{ channel: 'instagram', text: 'پیام جدید از اینستاگرام' },
			{ channel: 'telegram', text: 'پیام جدید از تلگرام' },
			{ channel: 'web', text: 'گفتگوی تازه از سایت' },
		],
		ariaLabel: 'شش کانال متصل که همه پیام‌هایشان وارد صندوق یکپارچه ویگنت می‌شود',
	},
	en: {
		eyebrow: 'One shared entry point',
		title: 'Every channel flows into one unified inbox',
		subtitle: 'No matter where a message starts, it arrives with the customer’s full history in one shared workspace so your team never loses a conversation.',
		connected: 'Connected',
		hubEyebrow: 'The shared destination for every message',
		hubTitle: 'Unified inbox',
		hubSubtitle: 'One team, one history and one consistent response',
		active: '32 active conversations',
		live: 'Live and synced',
		notifications: [
			{ channel: 'instagram', text: 'New Instagram message' },
			{ channel: 'telegram', text: 'New Telegram message' },
			{ channel: 'web', text: 'New website conversation' },
		],
		ariaLabel: 'Six connected channels whose messages all flow into the Vigent unified inbox',
	},
} as const

function ChannelLogo({ channel, small = false }: { channel: ChannelDefinition; small?: boolean }) {
	if (channel.logoSrc) {
		const isRubika = channel.key === 'rubika'
		return (
			<Image
				src={channel.logoSrc}
				alt=""
				width={90}
				height={40}
				className={isRubika
					? (small ? 'size-4 object-contain' : 'size-6 object-contain')
					: (small ? 'h-auto w-5' : 'h-auto w-9')}
			/>
		)
	}

	const Icon = channel.icon
	if (!Icon) return null
	return <Icon className={`${small ? 'size-3.5' : 'size-5'} ${channel.iconClass}`} />
}

function NodePulse({ reducedMotion }: { reducedMotion: boolean }) {
	return (
		<span aria-hidden="true" className="absolute -bottom-[7px] start-1/2 z-20 grid size-3 -translate-x-1/2 place-items-center rounded-full border border-white bg-violet-100 shadow-[0_2px_8px_rgba(124,58,237,0.22)]">
			<m.span
				className="absolute size-3 rounded-full border border-violet-400"
				initial={false}
				animate={reducedMotion ? { opacity: 0 } : { opacity: [0.5, 0], transform: ['scale(1)', 'scale(2.4)'] }}
				transition={reducedMotion ? { duration: 0 } : { duration: 2.8, repeat: Infinity, ease: [0.23, 1, 0.32, 1] }}
			/>
			<span className="relative size-1.5 rounded-full bg-violet-600" />
		</span>
	)
}

function ChannelCard({ channel, locale, reducedMotion }: { channel: ChannelDefinition; locale: Locale; reducedMotion: boolean }) {
	const copy = COPY[locale]
	return (
		<li className="relative z-10 flex min-h-[106px] min-w-0 flex-col items-center justify-center rounded-[22px] border border-white bg-white/95 px-2.5 py-3 text-center shadow-[0_14px_42px_rgba(15,23,42,0.075),0_2px_8px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.035] backdrop-blur-sm lg:min-h-[104px]">
			<span className={`grid size-11 place-items-center rounded-[15px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${channel.iconSurface}`}>
				<ChannelLogo channel={channel} />
			</span>
			<p className="mt-2 text-xs font-black text-neutral-950 sm:text-[13px]">{locale === 'fa' ? channel.fa : channel.en}</p>
			<p className="mt-0.5 hidden text-[9px] font-semibold text-neutral-400 min-[390px]:block">{locale === 'fa' ? channel.descriptionFa : channel.descriptionEn}</p>
			<span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700">
				<Check className="size-2.5" />
				{copy.connected}
			</span>
			<NodePulse reducedMotion={reducedMotion} />
		</li>
	)
}

function ConnectionLines({
	connectorPaths,
	viewBox,
	gradientId,
	reducedMotion,
}: {
	connectorPaths: ConnectorPath[]
	viewBox: string
	gradientId: string
	reducedMotion: boolean
}) {
	return (
		<svg aria-hidden="true" viewBox={viewBox} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible">
			<defs>
				<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stopColor="#c4b5fd" stopOpacity="0.42" />
					<stop offset="0.55" stopColor="#8b5cf6" stopOpacity="0.72" />
					<stop offset="1" stopColor="#111827" stopOpacity="0.68" />
				</linearGradient>
			</defs>
			{connectorPaths.map((path, index) => (
				<g key={path.id}>
					<path d={path.d} fill="none" stroke="#d9dbe3" strokeWidth="1.45" strokeLinecap="round" opacity="0.92" />
					<path d={path.d} fill="none" stroke={`url(#${gradientId})`} strokeWidth="4.5" strokeLinecap="round" opacity="0.1" />
					{!reducedMotion && (
						<m.path
							d={path.d}
							fill="none"
							stroke="#8b5cf6"
							strokeWidth="2.2"
							strokeLinecap="round"
							strokeDasharray="2 18"
							initial={false}
							animate={{ strokeDashoffset: [0, -100], opacity: [0.28, 0.9, 0.28] }}
							transition={{ duration: 4.8 + index * 0.16, delay: index * 0.22, repeat: Infinity, ease: 'linear' }}
						/>
					)}
				</g>
			))}
		</svg>
	)
}

function InboxHub({ locale, reducedMotion }: { locale: Locale; reducedMotion: boolean }) {
	const copy = COPY[locale]
	return (
		<div className="relative mx-auto w-full max-w-[540px]">
			<m.div
				aria-hidden="true"
				className="absolute -inset-5 rounded-[38px] bg-gradient-to-r from-violet-500/25 via-fuchsia-400/18 to-sky-400/20 blur-2xl"
				initial={false}
				animate={reducedMotion ? { opacity: 0.42 } : { opacity: [0.28, 0.58, 0.28], transform: ['scale(0.97)', 'scale(1.035)', 'scale(0.97)'] }}
				transition={reducedMotion ? { duration: 0 } : { duration: 5.2, repeat: Infinity, ease: [0.77, 0, 0.175, 1] }}
			/>
			<div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-[#0b0b0e] px-4 py-5 text-white shadow-[0_30px_80px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-6">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(139,92,246,0.32),transparent_42%),radial-gradient(circle_at_90%_100%,rgba(56,189,248,0.14),transparent_36%)]" />
				<span aria-hidden="true" className="absolute start-1/2 top-0 grid size-3 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-[#0b0b0e] bg-violet-400 shadow-[0_0_18px_#a78bfa]">
					<m.span
						className="absolute size-3 rounded-full border border-violet-300"
						initial={false}
						animate={reducedMotion ? { opacity: 0 } : { opacity: [0.7, 0], transform: ['scale(1)', 'scale(3)'] }}
						transition={reducedMotion ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: [0.23, 1, 0.32, 1] }}
					/>
				</span>

				<div className="relative hidden w-full grid-cols-[18%_38%_18%] items-center justify-between sm:grid">
					<div className="flex justify-start">
						<span className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.07] text-violet-200 shadow-inner">
							<Inbox className="size-5" />
						</span>
					</div>
					<div className="text-center">
						<p className="text-[9px] font-black uppercase tracking-[0.12em] text-violet-300">{copy.hubEyebrow}</p>
						<h3 className="mt-1.5 text-xl font-black tracking-[-0.025em]">{copy.hubTitle}</h3>
						<p className="mt-1 text-[10px] font-semibold text-white/45">{copy.hubSubtitle}</p>
					</div>
					<div className="flex justify-end">
						<div className="text-end">
							<p className="text-[10px] font-black text-white">{copy.active}</p>
							<p className="mt-1 flex items-center justify-end gap-1.5 text-[9px] font-extrabold text-emerald-300">
								<span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
								{copy.live}
							</p>
						</div>
					</div>
				</div>

				<div className="relative flex items-center gap-3 sm:hidden">
					<span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.07] text-violet-200">
						<Inbox className="size-5" />
					</span>
					<div className="min-w-0 flex-1">
						<p className="text-[9px] font-black text-violet-300">{copy.hubEyebrow}</p>
						<h3 className="mt-1 text-base font-black">{copy.hubTitle}</h3>
						<p className="mt-1 truncate text-[9px] font-semibold text-white/45">{copy.hubSubtitle}</p>
					</div>
					<span className="size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
				</div>
			</div>
		</div>
	)
}

function IncomingNotifications({ locale, reducedMotion, className }: { locale: Locale; reducedMotion: boolean; className: string }) {
	const notifications = COPY[locale].notifications
	if (reducedMotion) return null

	return (
		<div aria-hidden="true" className={`pointer-events-none absolute start-1/2 z-30 ${className}`}>
			{notifications.map((notification, index) => {
				const channel = CHANNELS.find((item) => item.key === notification.channel) ?? CHANNELS[0]
				return (
					<m.div
						key={notification.channel}
						className="absolute start-0 top-0 flex w-max max-w-[220px] items-center gap-2 rounded-full border border-black/[0.07] bg-white/95 py-1.5 pe-3 ps-1.5 text-[10px] font-extrabold text-neutral-700 opacity-0 shadow-[0_12px_32px_rgba(15,23,42,0.14)] backdrop-blur"
						initial={false}
						animate={{
							opacity: [0, 0, 1, 1, 0, 0],
							transform: [
								'translate3d(-50%,-10px,0) scale(0.96)',
								'translate3d(-50%,-10px,0) scale(0.96)',
								'translate3d(-50%,0,0) scale(1)',
								'translate3d(-50%,34px,0) scale(1)',
								'translate3d(-50%,96px,0) scale(0.97)',
								'translate3d(-50%,96px,0) scale(0.97)',
							],
						}}
						transition={{ duration: 18, delay: 1.2 + index * 6, repeat: Infinity, times: [0, 0.02, 0.075, 0.17, 0.23, 1], ease: 'linear' }}
					>
						<span className={`grid size-7 shrink-0 place-items-center rounded-full border ${channel.iconSurface}`}>
							<ChannelLogo channel={channel} small />
						</span>
						<span>{notification.text}</span>
						<span className="size-1.5 shrink-0 rounded-full bg-violet-500" />
					</m.div>
				)
			})}
		</div>
	)
}

function DesktopFlow({ locale, reducedMotion }: { locale: Locale; reducedMotion: boolean }) {
	return (
		<div className="hidden lg:block">
			<div className="relative min-h-[430px]">
				<ConnectionLines connectorPaths={connectorPaths} viewBox="0 0 1200 430" gradientId="desktop-channel-flow" reducedMotion={reducedMotion} />
				<ul className="relative grid grid-cols-6 gap-3">
					{CHANNELS.map((channel) => <ChannelCard key={channel.key} channel={channel} locale={locale} reducedMotion={reducedMotion} />)}
				</ul>
				<IncomingNotifications locale={locale} reducedMotion={reducedMotion} className="top-[205px]" />
				<div className="absolute inset-x-0 bottom-2"><InboxHub locale={locale} reducedMotion={reducedMotion} /></div>
			</div>
		</div>
	)
}

function MobileFlow({ locale, reducedMotion }: { locale: Locale; reducedMotion: boolean }) {
	const channelPairs = [0, 2, 4, 6]
	return (
		<div className="relative min-h-[580px] lg:hidden">
			<ConnectionLines connectorPaths={mobileConnectorPaths} viewBox="0 0 360 580" gradientId="mobile-channel-flow" reducedMotion={reducedMotion} />
			<div className="relative space-y-5">
				{channelPairs.map((start) => {
					const pair = CHANNELS.slice(start, start + 2)
					if (pair.length === 0) return null
					return (
						<ul key={start} className="relative grid grid-cols-2 gap-7">
							{pair.map((channel) => <ChannelCard key={channel.key} channel={channel} locale={locale} reducedMotion={reducedMotion} />)}
						</ul>
					)
				})}
			</div>
			<IncomingNotifications locale={locale} reducedMotion={reducedMotion} className="top-[382px]" />
			<div className="absolute inset-x-0 bottom-1"><InboxHub locale={locale} reducedMotion={reducedMotion} /></div>
		</div>
	)
}

export function ChannelsSection() {
	const locale = (useLocale() === 'fa' ? 'fa' : 'en') as Locale
	const copy = COPY[locale]
	const reducedMotion = Boolean(useReducedMotion())

	return (
		<section id="product" dir={locale === 'fa' ? 'rtl' : 'ltr'} className="relative overflow-hidden bg-[#fbfbfd] py-20 sm:py-28">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.10),transparent_36%),radial-gradient(circle_at_8%_72%,rgba(56,189,248,0.07),transparent_26%),radial-gradient(circle_at_92%_68%,rgba(244,114,182,0.065),transparent_24%)]" />
			<div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />

			<div className="relative mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
				<header className="mx-auto max-w-3xl text-center">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/80 px-3 py-1.5 text-[10px] font-black text-violet-700 shadow-[0_6px_22px_rgba(124,58,237,0.08)] backdrop-blur sm:text-[11px]">
						<Sparkles className="size-3.5" />
						{copy.eyebrow}
					</div>
					<h2 className="text-balance text-[clamp(2rem,5vw,4.35rem)] font-black leading-[1.05] tracking-[-0.055em] text-neutral-950">{copy.title}</h2>
					<p className="mx-auto mt-5 max-w-2xl text-pretty text-sm font-medium leading-7 text-neutral-600 sm:text-base sm:leading-8">{copy.subtitle}</p>
				</header>

				<div aria-label={copy.ariaLabel} className="relative mt-10 rounded-[28px] border border-white bg-white/45 p-3 shadow-[0_30px_100px_rgba(15,23,42,0.075)] ring-1 ring-black/[0.035] backdrop-blur-sm sm:mt-14 sm:rounded-[36px] sm:p-5 lg:p-7">
					<div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/70 to-transparent" />
					<div className="mb-4 flex items-center justify-center gap-2 text-[9px] font-extrabold text-neutral-400 sm:text-[10px]">
						<Workflow className="size-3.5 text-violet-500" />
						<span>{locale === 'fa' ? 'جریان زندهٔ پیام‌ها به سمت صندوق مشترک' : 'Live message flow into the shared inbox'}</span>
					</div>
					<DesktopFlow locale={locale} reducedMotion={reducedMotion} />
					<MobileFlow locale={locale} reducedMotion={reducedMotion} />
				</div>
			</div>
		</section>
	)
}
