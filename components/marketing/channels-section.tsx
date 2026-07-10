'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	Globe2,
	Instagram,
	Link2,
	MessageCircleMore,
	Radio,
	Send,
	ShoppingBag,
	Sparkles,
	Webhook,
} from 'lucide-react'

const COPY = {
	fa: {
		eyebrow: 'اتصالات ویجنت',
		title: 'همهٔ اتصالات، یک مغز مشترک.',
		subtitle: 'مشتری کانالش را انتخاب می‌کند؛ شما همان دانش، همان لحن و همان کیفیت پاسخ را همه‌جا حفظ می‌کنید.',
		hubTitle: 'ایجنت ویجنت',
		hubDesc: 'پاسخ از دانش واقعی کسب‌وکار',
		inbox: 'همه پیام‌ها وارد یک صندوق می‌شوند',
		channels: ['اینستاگرام', 'تلگرام', 'واتساپ', 'بله', 'روبیکا', 'ویجت سایت'],
		chatTitle: 'یک لینک چت برای هرجایی که لینک می‌پذیرد',
		chatDesc: 'در بیو اینستاگرام، پیامک، QR یا سایت بگذارید؛ مشتری بدون نصب برنامه وارد گفتگوی اختصاصی شما می‌شود.',
		chatCta: 'دیدن لینک چت',
		storeTitle: 'فروشگاه هم بخشی از گفتگو است',
		storeDesc: 'محصول، قیمت و موجودی ووکامرس همگام می‌شود تا ایجنت فقط حرف نزند؛ دقیق پیشنهاد بدهد و مشتری را به خرید برساند.',
		storeCta: 'راهکار فروشگاه‌ها',
		connected: 'متصل',
		customer: 'سلام، این محصول موجوده؟',
		reply: 'بله، موجوده. چه رنگی مدنظرتونه؟',
	},
	en: {
		eyebrow: 'Vigent connections',
		title: 'Every connection. One shared brain.',
		subtitle: 'Customers pick the channel; you keep the same knowledge, voice and response quality everywhere.',
		hubTitle: 'Vigent agent',
		hubDesc: 'Answers from real business knowledge',
		inbox: 'Every message lands in one inbox',
		channels: ['Instagram', 'Telegram', 'WhatsApp', 'Bale', 'Rubika', 'Website widget'],
		chatTitle: 'One chat link for anywhere a link fits',
		chatDesc: 'Put it in your Instagram bio, SMS, QR code or website. Customers open your branded chat with no app to install.',
		chatCta: 'Explore chat links',
		storeTitle: 'Your store joins the conversation',
		storeDesc: 'WooCommerce products, prices and stock stay synced so the agent can recommend accurately and move customers toward checkout.',
		storeCta: 'For online stores',
		connected: 'Connected',
		customer: 'Hi, is this product in stock?',
		reply: 'Yes, it is. Which color do you prefer?',
	},
} as const

const CHANNEL_ICONS = [Instagram, Send, MessageCircleMore, Radio, MessageCircleMore, Globe2]

function ConnectionBoard() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()

	return (
		<div className="relative mx-auto mt-12 max-w-6xl overflow-hidden rounded-[1.75rem] border border-black/10 bg-[#f7f7f5] p-4 sm:p-7 lg:min-h-[520px] lg:p-10">
			<div aria-hidden className="marketing-grid pointer-events-none absolute inset-0 opacity-50" />
			<svg aria-hidden viewBox="0 0 1000 430" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" preserveAspectRatio="none">
				{[75, 145, 215, 285, 355].map((y) => (
					<path key={`a-${y}`} d={`M 165 ${y} C 310 ${y}, 300 215, 430 215`} fill="none" stroke="rgba(0,0,0,.14)" strokeWidth="1.25" />
				))}
				{[92, 160, 228, 296, 364].map((y) => (
					<path key={`b-${y}`} d={`M 570 215 C 700 215, 690 ${y}, 835 ${y}`} fill="none" stroke="rgba(0,0,0,.14)" strokeWidth="1.25" />
				))}
				{!reduce && (
					<>
						<circle r="3" fill="#111">
							<animateMotion dur="3.2s" repeatCount="indefinite" path="M 165 145 C 310 145, 300 215, 430 215" />
						</circle>
						<circle r="3" fill="#111">
							<animateMotion dur="3.8s" begin=".9s" repeatCount="indefinite" path="M 570 215 C 700 215, 690 296, 835 296" />
						</circle>
						<circle r="3" fill="#111">
							<animateMotion dur="4.1s" begin="1.6s" repeatCount="indefinite" path="M 165 355 C 310 355, 300 215, 430 215" />
						</circle>
					</>
				)}
			</svg>

			<div className="relative grid gap-5 lg:grid-cols-[1fr_1.05fr_1fr] lg:items-center">
				<div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-3">
					{copy.channels.slice(0, 3).map((label, index) => {
						const Icon = CHANNEL_ICONS[index]
						return <ChannelNode key={label} label={label} Icon={Icon} delay={index * 0.08} />
					})}
				</div>

				<motion.div
					initial={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
					whileInView={{ opacity: 1, scale: 1 }}
					viewport={{ once: true, margin: '-80px' }}
					transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
					className="relative z-10 rounded-[1.5rem] bg-black p-5 text-white shadow-[0_22px_50px_rgba(0,0,0,0.22)] sm:p-6"
				>
					<div className="flex items-center justify-between">
						<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black">
							<Bot className="h-5 w-5" />
						</span>
						<span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[10px] text-white/65">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
							{copy.connected}
						</span>
					</div>
					<h3 className="mt-6 text-xl font-medium">{copy.hubTitle}</h3>
					<p className="mt-1 text-xs leading-5 text-white/50">{copy.hubDesc}</p>
					<div className="mt-5 space-y-2.5 rounded-2xl bg-white/[0.07] p-3">
						<div className="ms-auto max-w-[88%] rounded-xl rounded-ee-sm bg-white px-3 py-2 text-[10px] leading-5 text-black">{copy.customer}</div>
						<div className="max-w-[92%] rounded-xl rounded-es-sm border border-white/10 px-3 py-2 text-[10px] leading-5 text-white/75">{copy.reply}</div>
					</div>
					<p className="mt-4 flex items-center gap-2 text-[10px] text-white/45">
						<Sparkles className="h-3 w-3" />
						{copy.inbox}
					</p>
				</motion.div>

				<div className="grid grid-cols-2 gap-2 lg:grid-cols-1 lg:gap-3">
					{copy.channels.slice(3).map((label, index) => {
						const Icon = CHANNEL_ICONS[index + 3]
						return <ChannelNode key={label} label={label} Icon={Icon} delay={(index + 3) * 0.08} />
					})}
				</div>
			</div>
		</div>
	)
}

function ChannelNode({ label, Icon, delay }: { label: string; Icon: typeof Instagram; delay: number }) {
	const reduce = useReducedMotion()
	return (
		<motion.div
			initial={{ opacity: 0, y: reduce ? 0 : 10 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: '-40px' }}
			transition={{ duration: 0.45, delay }}
			className="relative z-10 flex min-h-14 items-center gap-2.5 rounded-xl border border-black/10 bg-white p-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.04)] sm:px-3.5"
		>
			<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.05]">
				<Icon className="h-3.5 w-3.5 text-black/65" />
			</span>
			<span className="truncate text-[11px] font-medium text-black/65">{label}</span>
			<span className="ms-auto hidden h-1.5 w-1.5 rounded-full bg-emerald-500 sm:block" />
		</motion.div>
	)
}

function ChatLinkPreview() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	return (
		<div className="relative mx-auto h-[290px] w-[170px] rounded-[2rem] border-[5px] border-black bg-black p-1 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
			<div className="absolute left-1/2 top-2 z-10 h-3 w-14 -translate-x-1/2 rounded-full bg-black" />
			<div className="h-full overflow-hidden rounded-[1.55rem] bg-white px-3 pb-3 pt-7">
				<div className="flex items-center gap-2 border-b border-black/10 pb-2.5">
					<span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white"><Bot className="h-3.5 w-3.5" /></span>
					<div><p className="text-[9px] font-medium text-black">Vigent</p><p className="text-[7px] text-emerald-600">{copy.connected}</p></div>
				</div>
				<div className="mt-4 rounded-xl rounded-es-sm bg-black/[0.06] p-2 text-[8px] leading-4 text-black/60">{copy.reply}</div>
				<div className="ms-auto mt-2 max-w-[88%] rounded-xl rounded-ee-sm bg-black p-2 text-[8px] leading-4 text-white">{copy.customer}</div>
				<div className="absolute inset-x-4 bottom-4 h-8 rounded-full border border-black/10 bg-[#f7f7f5]" />
			</div>
		</div>
	)
}

export function ChannelsSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section id="product" className="bg-white py-20 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="grid gap-6 border-t border-black/10 pt-7 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
					<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/40">{copy.eyebrow}</p>
					<div>
						<h2 className="max-w-3xl text-balance text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-black sm:text-5xl lg:text-6xl">{copy.title}</h2>
						<p className="mt-5 max-w-2xl text-[15px] leading-8 text-black/55">{copy.subtitle}</p>
					</div>
				</div>

				<ConnectionBoard />

				<div className="mt-5 grid gap-5 lg:grid-cols-2">
					<article className="group relative min-h-[430px] overflow-hidden rounded-[1.75rem] border border-black/10 bg-black p-6 text-white sm:p-8">
						<div className="relative z-10 max-w-sm">
							<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Link2 className="h-4 w-4" /></span>
							<h3 className="mt-6 text-2xl font-medium leading-tight sm:text-3xl">{copy.chatTitle}</h3>
							<p className="mt-3 text-sm leading-7 text-white/55">{copy.chatDesc}</p>
							<Link href="/solutions/persian-ai-chatbot" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
								{copy.chatCta}<Arrow className="h-4 w-4" />
							</Link>
						</div>
						<div className="absolute -bottom-28 -end-1 rotate-[-5deg] transition-transform duration-500 group-hover:-translate-y-3 group-hover:rotate-[-2deg] ltr:rotate-[5deg] ltr:group-hover:rotate-[2deg]">
							<ChatLinkPreview />
						</div>
					</article>

					<article className="relative min-h-[430px] overflow-hidden rounded-[1.75rem] border border-black/10 bg-[#f7f7f5] p-6 sm:p-8">
						<div className="relative z-10 max-w-md">
							<span className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white"><ShoppingBag className="h-4 w-4" /></span>
							<h3 className="mt-6 text-2xl font-medium leading-tight text-black sm:text-3xl">{copy.storeTitle}</h3>
							<p className="mt-3 text-sm leading-7 text-black/55">{copy.storeDesc}</p>
							<Link href="/solutions/ecommerce-ai" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
								{copy.storeCta}<Arrow className="h-4 w-4" />
							</Link>
						</div>
						<div aria-hidden className="absolute -bottom-12 -end-10 h-56 w-72 rotate-[-5deg] rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.1)] ltr:rotate-[5deg]">
							<div className="flex items-center justify-between border-b border-black/10 pb-3"><span className="h-2 w-20 rounded-full bg-black/10" /><Webhook className="h-4 w-4 text-black/35" /></div>
							{[72, 48, 61].map((width, index) => <div key={index} className="mt-3 flex items-center gap-3"><span className="h-9 w-9 rounded-lg bg-black/[0.06]" /><span className="h-2 rounded-full bg-black/10" style={{ width }} /><span className="ms-auto h-5 w-9 rounded-full bg-emerald-100" /></div>)}
						</div>
					</article>
				</div>
			</div>
		</section>
	)
}
