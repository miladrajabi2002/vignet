'use client'

import { useState, type ComponentType } from 'react'
import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	Globe2,
	Link2,
	MessageCircleMore,
	Radio,
	ShoppingBag,
	Sparkles,
	Webhook,
} from 'lucide-react'
import { InstagramIcon, TelegramIcon } from './social-links'

const COPY = {
	fa: {
		eyebrow: 'اتصالات ویجنت',
		title: 'همهٔ اتصالات، یک مغز مشترک',
		subtitle: 'مشتری کانالش را انتخاب می‌کند؛ شما همان دانش، همان لحن و همان کیفیت پاسخ را همه‌جا حفظ می‌کنید.',
		hubTitle: 'ایجنت ویجنت',
		hubDesc: 'پاسخ از دانش واقعی کسب‌وکار',
		inbox: 'همه پیام‌ها وارد یک صندوق می‌شوند',
		channels: ['اینستاگرام', 'تلگرام', 'بله', 'روبیکا', 'ویجت وب', 'لینک چت', 'ووکامرس'],
		chatTitle: 'یک لینک چت برای هرجایی که لینک می‌پذیرد',
		chatDesc: 'در بیو اینستاگرام، پیامک، QR یا سایت بگذارید؛ مشتری بدون نصب برنامه وارد گفتگوی اختصاصی شما می‌شود.',
		chatCta: 'دیدن لینک چت',
		storeTitle: 'فروشگاه هم بخشی از گفتگو است',
		storeDesc: 'محصول، قیمت و موجودی ووکامرس همگام می‌شود تا ایجنت فقط حرف نزند؛ دقیق پیشنهاد بدهد و مشتری را به خرید برساند.',
		storeCta: 'راهکار فروشگاه‌ها',
		connected: 'متصل',
		customer: 'سلام، این محصول موجوده؟',
		reply: 'بله، موجوده. چه رنگی مدنظرتونه؟',
		syncTitle: 'کاتالوگ فروشگاه',
		updated: 'همگام‌سازی همین حالا',
		inStock: 'موجود',
		productCount: '۱۲۸ محصول به‌روز',
	},
	en: {
		eyebrow: 'Vigent connections',
		title: 'Every connection, one shared brain',
		subtitle: 'Customers pick the channel; you keep the same knowledge, voice and response quality everywhere.',
		hubTitle: 'Vigent agent',
		hubDesc: 'Answers from real business knowledge',
		inbox: 'Every message lands in one inbox',
		channels: ['Instagram', 'Telegram', 'Bale', 'Rubika', 'Web widget', 'Chat link', 'WooCommerce'],
		chatTitle: 'One chat link for anywhere a link fits',
		chatDesc: 'Put it in your Instagram bio, SMS, QR code or website. Customers open your branded chat with no app to install.',
		chatCta: 'Explore chat links',
		storeTitle: 'Your store joins the conversation',
		storeDesc: 'WooCommerce products, prices and stock stay synced so the agent can recommend accurately and move customers toward checkout.',
		storeCta: 'For online stores',
		connected: 'Connected',
		customer: 'Hi, is this product in stock?',
		reply: 'Yes, it is. Which color do you prefer?',
		syncTitle: 'Store catalog',
		updated: 'Synced just now',
		inStock: 'In stock',
		productCount: '128 products up to date',
	},
} as const

const CHANNEL_ICONS = [InstagramIcon, TelegramIcon, MessageCircleMore, Radio, MessageCircleMore, Globe2, Link2, ShoppingBag]

function ConnectionBoard() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()
	const sideY = [109, 179, 249, 319]
	const hubY = [135, 195, 255, 315]
	const incomingPaths = sideY.map(
		(y, index) => `M 180 ${y} C 232 ${y}, 258 ${hubY[index]}, 310 ${hubY[index]}`,
	)
	const outgoingPaths = sideY.map(
		(y, index) => `M 690 ${hubY[index]} C 742 ${hubY[index]}, 768 ${y}, 820 ${y}`,
	)
	const connectorPaths = [...incomingPaths, ...outgoingPaths]

	return (
		<div className="relative mx-auto mt-10 max-w-6xl overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-surface)] p-7 lg:p-9">
			<div className="relative mx-auto h-[428px] max-w-[1040px]">
				<svg aria-hidden viewBox="0 0 1000 428" className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
					{connectorPaths.map((path, index) => (
						<m.path
							key={path}
							d={path}
							fill="none"
							stroke="rgba(0,0,0,.2)"
							strokeWidth="1.35"
							strokeLinecap="round"
							initial={reduce ? false : { pathLength: 0, opacity: 0.18 }}
							whileInView={{ pathLength: 1, opacity: 1 }}
							viewport={{ once: true, margin: '-80px' }}
							transition={reduce ? { duration: 0 } : { duration: 0.48, delay: (index % 4) * 0.045, ease: [0.16, 1, 0.3, 1] }}
						/>
					))}

					{sideY.map((y, index) => (
						<g key={`connector-nodes-${y}`}>
							<circle cx="180" cy={y} r="3" fill="#fff" stroke="rgba(0,0,0,.34)" strokeWidth="1.2" />
							<circle cx="310" cy={hubY[index]} r="3" fill="#fff" stroke="rgba(0,0,0,.34)" strokeWidth="1.2" />
							<circle cx="690" cy={hubY[index]} r="3" fill="#fff" stroke="rgba(0,0,0,.34)" strokeWidth="1.2" />
							<circle cx="820" cy={y} r="3" fill="#fff" stroke="rgba(0,0,0,.34)" strokeWidth="1.2" />
						</g>
					))}

					{!reduce && [incomingPaths[0], incomingPaths[2], outgoingPaths[1], outgoingPaths[3]].map((path, index) => (
						<circle key={`signal-${path}`} r="3.1" fill="#111" opacity="0.82">
							<animateMotion dur={`${2.7 + index * 0.22}s`} begin={`${index * 0.48}s`} repeatCount="indefinite" path={path} />
							<animate attributeName="opacity" values="0;0.85;0.85;0" keyTimes="0;0.12;0.82;1" dur={`${2.7 + index * 0.22}s`} begin={`${index * 0.48}s`} repeatCount="indefinite" />
						</circle>
					))}
				</svg>

				<div className="absolute inset-0 grid grid-cols-[18%_38%_18%] items-center justify-between">
				<div className="grid gap-[18px]">
					{copy.channels.slice(0, 4).map((label, index) => {
						const Icon = CHANNEL_ICONS[index]
						return <ChannelNode key={label} label={label} Icon={Icon} delay={index * 0.055} side="left" />
					})}
				</div>

				<m.div
					initial={reduce ? false : { opacity: 0, scale: 0.97 }}
					whileInView={{ opacity: 1, scale: 1 }}
					viewport={{ once: true, margin: '-80px' }}
					transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
					className="relative z-10 rounded-[1.4rem] border border-[var(--border-default)] bg-white p-5 text-[var(--text-primary)] sm:p-6"
					style={{ boxShadow: 'var(--shadow-card)' }}
				>
					<div className="flex items-center justify-between">
						<span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
							<Bot className="h-5 w-5" />
						</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-white px-2.5 py-1 text-[11px] text-[var(--text-secondary)]">
							<span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
							{copy.connected}
						</span>
					</div>
					<h3 className="mt-6 text-xl font-medium">{copy.hubTitle}</h3>
					<p className="mt-1 text-[13px] leading-5 text-[var(--text-muted)]">{copy.hubDesc}</p>
					<div className="mt-5 space-y-2.5 rounded-2xl bg-[var(--bg-surface)] p-3">
						<div className="ms-auto max-w-[88%] rounded-xl rounded-ee-sm bg-[var(--text-primary)] px-3 py-2 text-xs leading-5 text-white">{copy.customer}</div>
						<div className="max-w-[92%] rounded-xl rounded-es-sm border border-[var(--border-default)] bg-white px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">{copy.reply}</div>
					</div>
					<p className="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
						<Sparkles className="h-3 w-3" aria-hidden />
						{copy.inbox}
					</p>
				</m.div>

				<div className="grid gap-[18px]">
					{copy.channels.slice(4).map((label, index) => {
						const Icon = CHANNEL_ICONS[index + 4]
						return <ChannelNode key={label} label={label} Icon={Icon} delay={(index + 4) * 0.055} side="right" />
					})}
				</div>
				</div>
			</div>
		</div>
	)
}

function ChannelNode({ label, Icon, delay, side }: { label: string; Icon: ComponentType<{ className?: string }>; delay: number; side: 'left' | 'right' }) {
	const reduce = useReducedMotion()
	return (
		<m.div
			initial={reduce ? false : { opacity: 0, x: side === 'left' ? -8 : 8 }}
			whileInView={{ opacity: 1, x: 0 }}
			viewport={{ once: true, margin: '-40px' }}
			transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.36, delay }}
			className="relative z-10 flex min-h-[52px] min-w-0 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-2.5 py-2"
			style={{ boxShadow: 'var(--shadow-sm)' }}
		>
			<span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]">
				<Icon className="h-4 w-4 text-[var(--text-secondary)]" />
			</span>
			<span className="min-w-0 truncate text-[11px] font-medium leading-4 text-[var(--text-secondary)] xl:text-xs">{label}</span>
			<span className="ms-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
		</m.div>
	)
}

function ChatLinkPreview() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	return (
		<div className="relative mx-auto h-[304px] w-[184px] rounded-[2rem] border-[5px] border-[var(--text-primary)] bg-[var(--text-primary)] p-1" style={{ boxShadow: 'var(--shadow-card)' }}>
			<div className="absolute left-1/2 top-2 z-10 h-3 w-14 -translate-x-1/2 rounded-full bg-[var(--text-primary)]" />
			<div className="h-full overflow-hidden rounded-[1.55rem] bg-white px-3 pb-3 pt-7">
				<div className="flex items-center gap-2 border-b border-[var(--border-default)] pb-2.5">
					<span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--text-primary)] text-white"><Bot className="h-3.5 w-3.5" /></span>
					<div><p className="text-[10px] font-medium text-[var(--text-primary)]">Vigent</p><p className="text-[9px] text-[var(--text-secondary)]">{copy.connected}</p></div>
				</div>
				<div className="mt-4 rounded-xl rounded-es-sm bg-[var(--bg-surface)] p-2 text-[10px] leading-4 text-[var(--text-secondary)]">{copy.reply}</div>
				<div className="ms-auto mt-2 max-w-[88%] rounded-xl rounded-ee-sm bg-[var(--text-primary)] p-2 text-[10px] leading-4 text-white">{copy.customer}</div>
				<div className="absolute inset-x-4 bottom-4 h-8 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]" />
			</div>
		</div>
	)
}

function StorePreview() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const products = locale === 'fa'
		? [
					['کفش راه‌رو ۲', '۱٬۸۹۰٬۰۰۰ تومان'],
					['کتانی روزمره', '۲٬۱۵۰٬۰۰۰ تومان'],
					['کفش رانینگ پرو', '۲٬۸۹۰٬۰۰۰ تومان'],
				]
		: [
					['Walker 2', '1,890,000 toman'],
					['Everyday sneaker', '2,150,000 toman'],
					['Running Pro', '2,890,000 toman'],
				]

	return (
		<div className="w-full max-w-[360px] rounded-2xl border border-[var(--border-default)] bg-white p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
			<div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
				<div>
					<p className="text-xs font-semibold text-[var(--text-primary)]">{copy.syncTitle}</p>
					<p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{copy.productCount}</p>
				</div>
				<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--text-primary)] text-white"><Webhook className="h-3.5 w-3.5" aria-hidden /></span>
			</div>
			<div className="divide-y divide-[var(--border-subtle)]">
				{products.map(([name, price]) => (
					<div key={name} className="flex items-center gap-3 py-2.5">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]"><ShoppingBag className="h-3.5 w-3.5 text-[var(--text-muted)]" aria-hidden /></span>
						<div className="min-w-0"><p className="truncate text-[11px] font-medium text-[var(--text-secondary)]">{name}</p><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{price}</p></div>
						<span className="ms-auto rounded-full bg-green-50 px-2 py-1 text-[10px] font-medium text-[var(--success)]">{copy.inStock}</span>
					</div>
				))}
			</div>
			<p className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />{copy.updated}</p>
		</div>
	)
}

type MobileChannelTab = 'messaging' | 'chat' | 'store'

function MobileChannelExplorer() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const [active, setActive] = useState<MobileChannelTab>('messaging')
	const reduce = useReducedMotion()
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
	const tabs: { id: MobileChannelTab; label: string; Icon: ComponentType<{ className?: string }> }[] = [
		{ id: 'messaging', label: locale === 'fa' ? 'پیام‌رسان‌ها' : 'Messaging', Icon: MessageCircleMore },
		{ id: 'chat', label: locale === 'fa' ? 'چت سایت' : 'Site chat', Icon: Globe2 },
		{ id: 'store', label: locale === 'fa' ? 'فروشگاه' : 'Store', Icon: ShoppingBag },
	]
	const channelPairs = [0, 2, 4, 6].map((start) =>
		copy.channels.slice(start, start + 2).map((label, offset) => ({
			label,
			Icon: CHANNEL_ICONS[start + offset],
		})),
	)

	return (
		<div className="mt-8 lg:hidden">
			<div className="rounded-[1.4rem] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
				<div className="relative z-10 mx-auto flex min-h-14 max-w-[15rem] items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-white px-3.5" style={{ boxShadow: 'var(--shadow-sm)' }}>
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-white"><Bot className="h-4 w-4" /></span>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-semibold text-[var(--text-primary)]">{copy.hubTitle}</p>
						<p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">{copy.inbox}</p>
					</div>
					<span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
				</div>

				<div aria-hidden className="relative mx-auto h-7 w-px bg-[var(--border-hover)]">
					{!reduce && (
						<m.span
							className="absolute left-1/2 top-0 -ml-1 h-2 w-2 rounded-full bg-black"
							animate={{ y: [0, 20], opacity: [0, 0.8, 0] }}
							transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.8, ease: [0.4, 0, 0.2, 1] }}
						/>
					)}
				</div>

				<div className="relative space-y-2" role="list" aria-label={locale === 'fa' ? 'کانال‌های متصل به ایجنت' : 'Channels connected to the agent'}>
					<span aria-hidden className="absolute bottom-[22px] left-1/2 top-0 w-px -translate-x-1/2 bg-[var(--border-default)]" />
					{channelPairs.map((pair, row) => (
						<div key={row} className="relative grid grid-cols-2 gap-7">
							<span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--border-default)]" />
							<span aria-hidden className="absolute left-1/2 top-1/2 z-[1] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--border-hover)] bg-[var(--bg-surface)]" />
							{pair.map(({ label, Icon }) => (
								<div key={label} role="listitem" className="relative z-10 flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-2.5">
									<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)]"><Icon className="h-3.5 w-3.5 text-[var(--text-secondary)]" /></span>
									<span className="min-w-0 truncate text-[10px] font-medium text-[var(--text-secondary)] min-[375px]:text-[11px]">{label}</span>
								</div>
							))}
						</div>
					))}
				</div>
			</div>

			<div role="tablist" aria-label={locale === 'fa' ? 'جزئیات اتصال‌ها' : 'Connection details'} className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-[var(--bg-surface)] p-1">
				{tabs.map(({ id, label, Icon }) => (
					<button
						key={id}
						type="button"
						role="tab"
						aria-selected={active === id}
						aria-controls={`mobile-channel-${id}`}
						onClick={() => setActive(id)}
						className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${active === id ? 'bg-black text-white shadow-sm' : 'text-[var(--text-secondary)]'}`}
					>
						<Icon className="h-3.5 w-3.5" />{label}
					</button>
				))}
			</div>

			<m.div
				key={active}
				id={`mobile-channel-${active}`}
				role="tabpanel"
				initial={reduce ? false : { opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={reduce ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
				className="mt-3 min-h-[255px] overflow-hidden rounded-[1.4rem] border border-[var(--border-default)] bg-[var(--bg-surface)] p-5"
			>
				{active === 'messaging' && (
					<div>
						<div className="flex items-center justify-between">
							<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white"><Bot className="h-4 w-4" /></span>
							<span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] text-[var(--text-secondary)]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{copy.connected}</span>
						</div>
						<h3 className="mt-5 text-lg font-semibold text-[var(--text-primary)]">{copy.hubTitle}</h3>
						<p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{copy.hubDesc}</p>
						<div className="mt-4 space-y-2 rounded-2xl bg-white p-3">
							<p className="ms-auto max-w-[82%] rounded-xl rounded-ee-sm bg-black px-3 py-2 text-[10px] leading-5 text-white">{copy.customer}</p>
							<p className="max-w-[90%] rounded-xl rounded-es-sm border border-[var(--border-default)] px-3 py-2 text-[10px] leading-5 text-[var(--text-secondary)]">{copy.reply}</p>
						</div>
					</div>
				)}

				{active === 'chat' && (
					<div>
						<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white"><Link2 className="h-4 w-4" /></span>
						<h3 className="mt-5 text-lg font-semibold leading-7 text-[var(--text-primary)]">{copy.chatTitle}</h3>
						<p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{copy.chatDesc}</p>
						<Link href="/solutions/persian-ai-chatbot" className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">{copy.chatCta}<Arrow className="h-4 w-4" /></Link>
					</div>
				)}

				{active === 'store' && (
					<div>
						<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white"><ShoppingBag className="h-4 w-4" /></span>
						<h3 className="mt-5 text-lg font-semibold leading-7 text-[var(--text-primary)]">{copy.storeTitle}</h3>
						<p className="mt-2 text-xs leading-6 text-[var(--text-secondary)]">{copy.storeDesc}</p>
						<Link href="/solutions/ecommerce-ai" className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">{copy.storeCta}<Arrow className="h-4 w-4" /></Link>
					</div>
				)}
			</m.div>
		</div>
	)
}

export function ChannelsSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section id="product" className="marketing-story-section scroll-mt-24 bg-white py-16 sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="mx-auto max-w-4xl border-t border-[var(--border-default)] pt-6 text-center">
					<p className="marketing-eyebrow">{copy.eyebrow}</p>
					<h2 className={`marketing-channels-title mx-auto mt-4 font-semibold leading-[1.2] text-[var(--text-primary)] sm:text-[clamp(2rem,4vw,3.35rem)] ${locale === 'fa' ? 'text-[clamp(1.05rem,min(5.35vw,3.35rem),3.35rem)]' : 'text-[clamp(1.05rem,min(5.1vw,3.35rem),3.35rem)]'}`}>{copy.title}</h2>
					<p className="marketing-subtitle mx-auto mt-4">{copy.subtitle}</p>
				</div>

				<div className="hidden lg:block"><ConnectionBoard /></div>
				<MobileChannelExplorer />

				<div className="mt-5 hidden items-stretch gap-5 lg:grid lg:grid-cols-2">
					<article className="group relative flex min-h-[560px] flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 sm:p-8 lg:min-h-[620px]">
						<div className="relative z-10">
							<span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white"><Link2 className="h-4 w-4" /></span>
							<h3 className="mt-6 max-w-[32rem] text-[clamp(1.35rem,2.15vw,1.8rem)] font-medium leading-[1.45] text-[var(--text-primary)] text-balance">{copy.chatTitle}</h3>
							<p className="mt-3 max-w-[34rem] text-sm leading-7 text-[var(--text-secondary)]">{copy.chatDesc}</p>
							<Link href="/solutions/persian-ai-chatbot" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
								{copy.chatCta}<Arrow className="h-4 w-4" />
							</Link>
						</div>
						<div className="mx-auto mt-8 flex flex-1 items-end rotate-[-3deg] transition-transform duration-150 group-hover:rotate-0 ltr:rotate-[3deg]">
							<ChatLinkPreview />
						</div>
					</article>

					<article className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 sm:p-8 lg:min-h-[620px]">
						<div className="relative z-10">
							<span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white"><ShoppingBag className="h-4 w-4" /></span>
							<h3 className="mt-6 text-balance text-[clamp(1.2rem,2.15vw,1.8rem)] font-medium leading-[1.45] text-[var(--text-primary)] lg:whitespace-nowrap">{copy.storeTitle}</h3>
							<p className="mt-3 max-w-[34rem] text-sm leading-7 text-[var(--text-secondary)]">{copy.storeDesc}</p>
							<Link href="/solutions/ecommerce-ai" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:text-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
								{copy.storeCta}<Arrow className="h-4 w-4" />
							</Link>
						</div>
						<div className="mt-8 flex flex-1 items-end justify-center">
							<StorePreview />
						</div>
					</article>
				</div>
			</div>
		</section>
	)
}
