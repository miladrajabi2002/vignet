import type { CSSProperties } from 'react'
import Image from 'next/image'
import { Check, Globe2, Inbox, Link2, MessageCircle, Sparkles, Workflow, type LucideIcon } from 'lucide-react'
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
	{ id: 'instagram', d: 'M 96 104 C 96 210, 380 214, 600 292' },
	{ id: 'telegram', d: 'M 298 104 C 298 206, 446 226, 600 292' },
	{ id: 'bale', d: 'M 500 104 C 500 206, 540 246, 600 292' },
	{ id: 'rubika', d: 'M 700 104 C 700 206, 660 246, 600 292' },
	{ id: 'web', d: 'M 902 104 C 902 206, 754 226, 600 292' },
	{ id: 'link', d: 'M 1104 104 C 1104 210, 820 214, 600 292' },
]

const mobileConnectorPaths: ConnectorPath[] = [
	{ id: 'instagram-mobile', d: 'M 87 100 C 87 268, 140 372, 180 456' },
	{ id: 'telegram-mobile', d: 'M 273 100 C 273 268, 220 372, 180 456' },
	{ id: 'bale-mobile', d: 'M 87 216 C 87 322, 142 398, 180 456' },
	{ id: 'rubika-mobile', d: 'M 273 216 C 273 322, 218 398, 180 456' },
	{ id: 'web-mobile', d: 'M 87 332 C 94 388, 148 430, 180 456' },
	{ id: 'link-mobile', d: 'M 273 332 C 266 388, 212 430, 180 456' },
]

const COPY = {
	fa: {
		eyebrow: 'همهٔ پیام‌ها، یک‌جا',
		title: 'صندوق پیام یکپارچه',
		subtitle: 'پیام‌ها از هر برنامه‌ای که شروع شوند، با تاریخچهٔ کامل مشتری در یک فضای مشترک قرار می‌گیرند تا تیم شما هیچ گفتگویی را از دست ندهد.',
		connected: 'متصل',
		flowLabel: 'اتصال برنامه‌ها به صندوق پیام یکپارچه',
		hubEyebrow: 'مرکز پاسخ‌گویی تیم',
		hubTitle: 'صندوق پیام یکپارچه',
		hubSubtitle: 'همهٔ گفتگوها با تاریخچهٔ کامل مشتری',
		active: '۳۲ گفتگوی فعال',
		connectedApps: '۶ برنامه متصل',
		live: 'همگام‌سازی لحظه‌ای',
		liveShort: 'آنلاین',
		previewLabel: 'پیام‌ها اینجا جمع می‌شوند',
		previewMessages: [
			{ channel: 'instagram', message: 'سلام، برای انتخاب محصول راهنمایی می‌خواستم', time: 'اکنون' },
			{ channel: 'telegram', message: 'سفارش من چه زمانی ارسال می‌شود؟', time: '۱ دقیقه پیش' },
		],
		ariaLabel: 'شش برنامهٔ متصل که همهٔ پیام‌هایشان وارد صندوق پیام یکپارچه ویگنت می‌شود',
	},
	en: {
		eyebrow: 'Every message, in one place',
		title: 'Unified message inbox',
		subtitle: 'No matter which app a message starts in, it arrives with the customer’s full history in one shared workspace so your team never loses a conversation.',
		connected: 'Connected',
		flowLabel: 'Connected apps, one unified message inbox',
		hubEyebrow: 'Team response center',
		hubTitle: 'Unified message inbox',
		hubSubtitle: 'Every conversation with the full customer history',
		active: '32 active conversations',
		connectedApps: '6 connected apps',
		live: 'Real-time sync',
		liveShort: 'Online',
		previewLabel: 'Messages arrive here',
		previewMessages: [
			{ channel: 'instagram', message: 'Hi, I need help choosing the right product', time: 'Now' },
			{ channel: 'telegram', message: 'When will my order be shipped?', time: '1 min ago' },
		],
		ariaLabel: 'Six connected apps whose messages all flow into the Vigent unified message inbox',
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
				loading="lazy"
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

function ConnectionPort() {
	return (
		<span aria-hidden="true" className="absolute -bottom-1 left-1/2 z-20 size-2 -translate-x-1/2 rounded-full border-2 border-white bg-violet-600 shadow-[0_2px_8px_rgba(124,58,237,0.26)]" />
	)
}

function ChannelCard({ channel, locale, index }: { channel: ChannelDefinition; locale: Locale; index: number }) {
	const copy = COPY[locale]
	return (
		<li data-scroll-reveal="up" style={{ '--reveal-order': index } as CSSProperties} className="relative z-10 flex h-[100px] min-w-0 flex-col items-center justify-center rounded-[18px] border border-white bg-white px-2 py-2.5 text-center shadow-[0_10px_28px_rgba(15,23,42,0.07),0_2px_6px_rgba(15,23,42,0.035)] ring-1 ring-black/[0.035] lg:h-auto lg:min-h-[104px] lg:rounded-[22px] lg:px-2.5 lg:py-3 lg:shadow-[0_14px_42px_rgba(15,23,42,0.075),0_2px_8px_rgba(15,23,42,0.04)]">
			<span className={`grid size-10 place-items-center rounded-[13px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] lg:size-11 lg:rounded-[15px] ${channel.iconSurface}`}>
				<ChannelLogo channel={channel} />
			</span>
			<p className="mt-1.5 text-[11px] font-black text-neutral-950 lg:mt-2 lg:text-[13px]">{locale === 'fa' ? channel.fa : channel.en}</p>
			<p className="mt-0.5 hidden text-[9px] font-semibold text-neutral-400 lg:block">{locale === 'fa' ? channel.descriptionFa : channel.descriptionEn}</p>
			<span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-extrabold text-emerald-700 lg:mt-1.5 lg:bg-transparent lg:px-0 lg:py-0 lg:text-[9px]">
				<Check className="size-2.5" />
				{copy.connected}
			</span>
			<ConnectionPort />
		</li>
	)
}

function ConnectionLines({
	connectorPaths,
	viewBox,
	gradientId,
}: {
	connectorPaths: ConnectorPath[]
	viewBox: string
	gradientId: string
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
					<path d={path.d} fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 18" opacity="0.55" className="marketing-channel-signal">
						<animate attributeName="stroke-dashoffset" values="0;-100" begin={`${index * 0.22}s`} dur={`${4.8 + index * 0.16}s`} repeatCount="indefinite" />
						<animate attributeName="opacity" values="0.28;0.9;0.28" begin={`${index * 0.22}s`} dur={`${4.8 + index * 0.16}s`} repeatCount="indefinite" />
					</path>
				</g>
			))}
		</svg>
	)
}

function InboxHub({ locale }: { locale: Locale }) {
	const copy = COPY[locale]
	return (
		<div className="relative mx-auto h-[260px] w-full max-w-[580px]">
			<div
				aria-hidden="true"
				className="absolute -inset-5 rounded-[38px] bg-gradient-to-r from-violet-500/18 via-fuchsia-400/10 to-sky-400/14 opacity-70 blur-2xl"
			/>
			<div aria-hidden="true" className="absolute -top-3 left-1/2 z-20 h-3 w-px -translate-x-1/2 bg-gradient-to-b from-violet-400/20 to-violet-400" />
			<span aria-hidden="true" className="absolute left-1/2 top-0 z-30 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[#0b0b0e] bg-violet-400 shadow-[0_0_0_4px_rgba(167,139,250,0.16),0_0_18px_rgba(167,139,250,0.7)]" />

			<div className="relative h-full overflow-hidden rounded-[24px] border border-white/15 bg-[#0b0b0e] p-3.5 text-white shadow-[0_24px_64px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-[30px] sm:p-5 sm:shadow-[0_30px_80px_rgba(15,23,42,0.30),inset_0_1px_0_rgba(255,255,255,0.08)]">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(139,92,246,0.32),transparent_42%),radial-gradient(circle_at_90%_100%,rgba(56,189,248,0.14),transparent_36%)]" />
				<div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/70 to-transparent" />

				<div className="relative flex w-full items-center gap-2.5 sm:gap-3.5">
					<div className="flex shrink-0">
						<span className="grid size-11 place-items-center rounded-[15px] border border-violet-300/20 bg-gradient-to-br from-violet-500/30 to-violet-400/[0.08] text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_24px_rgba(124,58,237,0.16)] sm:size-14 sm:rounded-[17px]">
							<Inbox className="size-5 sm:size-6" />
						</span>
					</div>
					<div className="min-w-0 flex-1">
						<p className="text-[9px] font-black text-violet-300 sm:text-[10px] sm:uppercase sm:tracking-[0.12em] rtl:tracking-normal">{copy.hubEyebrow}</p>
						<h3 className="mt-0.5 text-[15px] font-black sm:mt-1 sm:text-xl sm:tracking-[-0.025em] rtl:tracking-normal">{copy.hubTitle}</h3>
						<p className="mt-0.5 hidden text-[9px] font-semibold leading-4 text-white/50 min-[360px]:block sm:mt-1 sm:text-[10px]">{copy.hubSubtitle}</p>
					</div>
					<div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-400/[0.08] px-2 py-1.5 text-[8px] font-extrabold text-emerald-300 sm:px-2.5 sm:text-[9px]">
						<span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
						<span className="sm:hidden">{copy.liveShort}</span>
						<span className="hidden sm:inline">{copy.live}</span>
					</div>
				</div>

				<div className="relative mt-3 rounded-[17px] border border-white/[0.09] bg-white/[0.055] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:mt-4 sm:rounded-[19px] sm:p-3">
					<div className="mb-2 flex items-center justify-between gap-3 px-1">
						<div className="flex items-center gap-1.5 text-[9px] font-black text-white/70 sm:text-[10px]">
							<MessageCircle className="size-3.5 text-violet-300" />
							{copy.previewLabel}
						</div>
						<span className="hidden text-[8px] font-bold text-white/35 sm:inline sm:text-[9px]">{copy.active}</span>
					</div>

					<div className="space-y-1.5">
						{copy.previewMessages.map((preview) => {
							const channel = CHANNELS.find((item) => item.key === preview.channel) ?? CHANNELS[0]
							return (
								<div key={preview.channel} className="flex min-w-0 items-center gap-2 rounded-[12px] border border-white/[0.07] bg-black/20 px-2 py-2 sm:gap-2.5 sm:rounded-[13px] sm:px-2.5">
									<span className={`grid size-8 shrink-0 place-items-center rounded-[11px] border ${channel.iconSurface}`}>
										<ChannelLogo channel={channel} small />
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex items-center justify-between gap-2">
											<p className="text-[9px] font-black text-white/85 sm:text-[10px]">{locale === 'fa' ? channel.fa : channel.en}</p>
											<span className="hidden shrink-0 text-[8px] font-semibold text-white/35 min-[390px]:inline">{preview.time}</span>
										</div>
										<p className="mt-0.5 truncate text-[8px] font-medium text-white/45 sm:text-[9px]">{preview.message}</p>
									</div>
									<span className="size-1.5 shrink-0 rounded-full bg-violet-400" />
								</div>
							)
						})}
					</div>
				</div>
			</div>
		</div>
	)
}

function ChannelFlow({ locale }: { locale: Locale }) {
	return (
		<div className="relative min-h-[720px] lg:min-h-[560px]">
			<div aria-hidden className="absolute inset-0 hidden lg:block">
				<ConnectionLines connectorPaths={connectorPaths} viewBox="0 0 1200 560" gradientId="desktop-channel-flow" />
			</div>
			<div aria-hidden className="absolute inset-0 lg:hidden">
				<ConnectionLines connectorPaths={mobileConnectorPaths} viewBox="0 0 360 720" gradientId="mobile-channel-flow" />
			</div>
			<ul className="relative grid grid-cols-2 gap-x-3 gap-y-4 lg:grid-cols-6 lg:gap-3">
				{CHANNELS.map((channel, index) => <ChannelCard key={channel.key} channel={channel} locale={locale} index={index} />)}
			</ul>
			<div className="absolute inset-x-0 bottom-1 lg:bottom-2"><InboxHub locale={locale} /></div>
		</div>
	)
}

export function ChannelsSection({ locale }: { locale: Locale }) {
	const copy = COPY[locale]

	return (
		<section id="unified-system" dir={locale === 'fa' ? 'rtl' : 'ltr'} className="marketing-story-section marketing-section-channels relative scroll-mt-24 overflow-hidden bg-[#fbfbfd] py-16 sm:py-24 lg:py-28">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,0.10),transparent_36%),radial-gradient(circle_at_8%_72%,rgba(56,189,248,0.07),transparent_26%),radial-gradient(circle_at_92%_68%,rgba(244,114,182,0.065),transparent_24%)]" />
			<div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />

			<div className="relative mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8">
				<header data-scroll-reveal="up" className="mx-auto max-w-3xl text-center">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/80 px-3 py-1.5 text-[10px] font-black text-violet-700 shadow-[0_6px_22px_rgba(124,58,237,0.08)] backdrop-blur sm:text-[11px]">
						<Sparkles className="size-3.5" />
						{copy.eyebrow}
					</div>
					<h2 className="text-balance text-[clamp(2rem,5vw,4.35rem)] font-black leading-[1.05] tracking-[-0.055em] text-neutral-950">{copy.title}</h2>
					<p className="mx-auto mt-5 max-w-2xl text-pretty text-sm font-medium leading-7 text-neutral-600 sm:text-base sm:leading-8">{copy.subtitle}</p>
				</header>

				<div aria-label={copy.ariaLabel} className="relative mt-10 rounded-[24px] border border-white bg-white/55 p-2.5 shadow-[0_24px_72px_rgba(15,23,42,0.07)] ring-1 ring-black/[0.035] backdrop-blur-sm sm:mt-14 sm:rounded-[36px] sm:bg-white/45 sm:p-5 sm:shadow-[0_30px_100px_rgba(15,23,42,0.075)] lg:p-7">
					<div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/70 to-transparent" />
					<div className="mb-3 flex items-center justify-center gap-2 px-2 text-center text-[9px] font-extrabold leading-5 text-neutral-500 sm:mb-4 sm:text-[10px] sm:text-neutral-400">
						<Workflow className="size-3.5 text-violet-500" />
						<span>{copy.flowLabel}</span>
					</div>
					<ChannelFlow locale={locale} />
				</div>
			</div>
		</section>
	)
}
