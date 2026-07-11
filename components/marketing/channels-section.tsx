'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
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
		channels: ['اینستاگرام', 'تلگرام', 'واتساپ', 'بله', 'روبیکا', 'ویجت وب', 'لینک چت', 'ووکامرس'],
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
		channels: ['Instagram', 'Telegram', 'WhatsApp', 'Bale', 'Rubika', 'Web widget', 'Chat link', 'WooCommerce'],
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

	return (
		<div className="relative mx-auto mt-10 max-w-6xl overflow-hidden rounded-[1.5rem] border border-black/10 bg-[#f5f6f3] p-4 sm:p-7 lg:min-h-[500px] lg:p-9">
			<div aria-hidden className="marketing-grid pointer-events-none absolute inset-0 opacity-50" />
			<svg aria-hidden viewBox="0 0 1000 460" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block" preserveAspectRatio="none">
				{[72, 176, 284, 388].map((y, index) => (
					<path key={`in-${y}`} d={`M 168 ${y} C 260 ${y}, 274 ${118 + index * 70}, 355 ${118 + index * 70} S 414 230, 450 230`} fill="none" stroke="rgba(0,0,0,.14)" strokeWidth="1.2" />
				))}
				{[72, 176, 284, 388].map((y, index) => (
					<path key={`out-${y}`} d={`M 550 230 C 586 230, 588 ${118 + index * 70}, 645 ${118 + index * 70} S 740 ${y}, 832 ${y}`} fill="none" stroke="rgba(0,0,0,.14)" strokeWidth="1.2" />
				))}
				{[118, 188, 258, 328].map((y) => (
					<g key={`neuron-${y}`}>
						<circle cx="355" cy={y} r="5" fill="#f5f6f3" stroke="rgba(0,0,0,.3)" strokeWidth="1.2" />
						<circle cx="645" cy={y} r="5" fill="#f5f6f3" stroke="rgba(0,0,0,.3)" strokeWidth="1.2" />
					</g>
				))}
				{!reduce && (
					<>
						<circle r="3.2" fill="#111">
							<animateMotion dur="3.2s" repeatCount="indefinite" path="M 168 176 C 260 176, 274 188, 355 188 S 414 230, 450 230" />
						</circle>
						<circle r="3.2" fill="#111">
							<animateMotion dur="3.7s" begin=".75s" repeatCount="indefinite" path="M 550 230 C 586 230, 588 258, 645 258 S 740 284, 832 284" />
						</circle>
						<circle r="3.2" fill="#111">
							<animateMotion dur="4s" begin="1.45s" repeatCount="indefinite" path="M 168 388 C 260 388, 274 328, 355 328 S 414 230, 450 230" />
						</circle>
					</>
				)}
			</svg>

			<div className="relative grid gap-4 lg:grid-cols-[1fr_1.08fr_1fr] lg:items-center lg:gap-5">
				<div className="order-3 grid grid-cols-2 gap-2 lg:order-none lg:grid-cols-1 lg:gap-4">
					{copy.channels.slice(0, 4).map((label, index) => {
						const Icon = CHANNEL_ICONS[index]
						return <ChannelNode key={label} label={label} Icon={Icon} delay={index * 0.08} />
					})}
				</div>

				<motion.div
					initial={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
					whileInView={{ opacity: 1, scale: 1 }}
					viewport={{ once: true, margin: '-80px' }}
					transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
					className="relative z-10 order-1 rounded-[1.4rem] bg-black p-5 text-white shadow-[0_22px_50px_rgba(0,0,0,0.2)] sm:p-6 lg:order-none"
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
						<div className="ms-auto max-w-[88%] rounded-xl rounded-ee-sm bg-white px-3 py-2 text-[11px] leading-5 text-black">{copy.customer}</div>
						<div className="max-w-[92%] rounded-xl rounded-es-sm border border-white/10 px-3 py-2 text-[11px] leading-5 text-white/80">{copy.reply}</div>
					</div>
					<p className="mt-4 flex items-center gap-2 text-[11px] text-white/60">
						<Sparkles className="h-3 w-3" />
						{copy.inbox}
					</p>
				</motion.div>

				<div aria-hidden className="relative order-2 mx-auto h-12 w-4/5 lg:hidden">
					<span className="absolute left-1/2 top-0 h-6 w-px -translate-x-1/2 bg-black/20" />
					<span className="absolute inset-x-0 top-6 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent" />
					{[18, 38, 62, 82].map((left) => <span key={left} className="absolute top-[21px] h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-black/25 bg-[#f5f6f3]" style={{ left: `${left}%` }} />)}
				</div>

				<div className="order-4 grid grid-cols-2 gap-2 lg:order-none lg:grid-cols-1 lg:gap-4">
					{copy.channels.slice(4).map((label, index) => {
						const Icon = CHANNEL_ICONS[index + 4]
						return <ChannelNode key={label} label={label} Icon={Icon} delay={(index + 4) * 0.08} />
					})}
				</div>
			</div>
		</div>
	)
}

function ChannelNode({ label, Icon, delay }: { label: string; Icon: ComponentType<{ className?: string }>; delay: number }) {
	const reduce = useReducedMotion()
	return (
		<motion.div
			initial={{ opacity: 0, y: reduce ? 0 : 10 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: '-40px' }}
			transition={{ duration: 0.45, delay }}
			className="relative z-10 flex min-h-14 min-w-0 items-center gap-2 rounded-xl border border-black/10 bg-white p-2.5 shadow-[0_4px_14px_rgba(0,0,0,0.04)] sm:gap-2.5 sm:px-3.5"
		>
			<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.05]">
				<Icon className="h-3.5 w-3.5 text-black/65" />
			</span>
			<span className="min-w-0 text-[10px] font-medium leading-4 text-black/70 sm:text-[11px]">{label}</span>
			<span className="ms-auto hidden h-1.5 w-1.5 rounded-full bg-emerald-500 sm:block" />
		</motion.div>
	)
}

function ChatLinkPreview() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	return (
		<div className="relative mx-auto h-[304px] w-[184px] rounded-[2rem] border-[5px] border-black bg-black p-1 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
			<div className="absolute left-1/2 top-2 z-10 h-3 w-14 -translate-x-1/2 rounded-full bg-black" />
			<div className="h-full overflow-hidden rounded-[1.55rem] bg-white px-3 pb-3 pt-7">
				<div className="flex items-center gap-2 border-b border-black/10 pb-2.5">
					<span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white"><Bot className="h-3.5 w-3.5" /></span>
					<div><p className="text-[10px] font-medium text-black">Vigent</p><p className="text-[9px] text-emerald-700">{copy.connected}</p></div>
				</div>
				<div className="mt-4 rounded-xl rounded-es-sm bg-black/[0.06] p-2 text-[10px] leading-4 text-black/65">{copy.reply}</div>
				<div className="ms-auto mt-2 max-w-[88%] rounded-xl rounded-ee-sm bg-black p-2 text-[10px] leading-4 text-white">{copy.customer}</div>
				<div className="absolute inset-x-4 bottom-4 h-8 rounded-full border border-black/10 bg-[#f7f7f5]" />
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
		<div className="w-full max-w-[360px] rounded-2xl border border-black/10 bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.1)]">
			<div className="flex items-center justify-between border-b border-black/10 pb-3">
				<div>
					<p className="text-xs font-semibold text-black">{copy.syncTitle}</p>
					<p className="mt-0.5 text-[10px] text-black/55">{copy.productCount}</p>
				</div>
				<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white"><Webhook className="h-3.5 w-3.5" aria-hidden /></span>
			</div>
			<div className="divide-y divide-black/5">
				{products.map(([name, price]) => (
					<div key={name} className="flex items-center gap-3 py-2.5">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f1f2ef]"><ShoppingBag className="h-3.5 w-3.5 text-black/45" aria-hidden /></span>
						<div className="min-w-0"><p className="truncate text-[11px] font-medium text-black/75">{name}</p><p className="mt-0.5 text-[10px] text-black/50">{price}</p></div>
						<span className="ms-auto rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800">{copy.inStock}</span>
					</div>
				))}
			</div>
			<p className="mt-2 flex items-center gap-1.5 text-[10px] text-black/50"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{copy.updated}</p>
		</div>
	)
}

export function ChannelsSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section id="product" className="marketing-story-section bg-white py-16 sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="mx-auto max-w-4xl border-t border-black/10 pt-6 text-center">
					<p className="marketing-eyebrow">{copy.eyebrow}</p>
					<h2 className="mx-auto mt-4 whitespace-nowrap text-[clamp(1.22rem,6vw,3.35rem)] font-semibold leading-[1.2] text-black sm:text-[clamp(2rem,4vw,3.35rem)]">{copy.title}</h2>
					<p className="marketing-subtitle mx-auto mt-4">{copy.subtitle}</p>
				</div>

				<ConnectionBoard />

				<div className="mt-5 grid items-stretch gap-5 lg:grid-cols-2">
					<article className="group relative flex min-h-[560px] flex-col overflow-hidden rounded-[1.5rem] border border-black/10 bg-[#f5f6f3] p-6 sm:p-8 lg:min-h-[620px]">
						<div className="relative z-10">
							<span className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white"><Link2 className="h-4 w-4" /></span>
							<h3 className="mt-6 max-w-[32rem] text-[clamp(1.35rem,2.15vw,1.8rem)] font-medium leading-[1.45] text-black text-balance">{copy.chatTitle}</h3>
							<p className="mt-3 max-w-[34rem] text-sm leading-7 text-black/60">{copy.chatDesc}</p>
							<Link href="/solutions/persian-ai-chatbot" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
								{copy.chatCta}<Arrow className="h-4 w-4" />
							</Link>
						</div>
						<div className="mx-auto mt-8 flex flex-1 items-end rotate-[-3deg] transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-0 ltr:rotate-[3deg]">
							<ChatLinkPreview />
						</div>
					</article>

					<article className="relative flex min-h-[560px] flex-col overflow-hidden rounded-[1.5rem] border border-black/10 bg-[#f5f6f3] p-6 sm:p-8 lg:min-h-[620px]">
						<div className="relative z-10">
							<span className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white"><ShoppingBag className="h-4 w-4" /></span>
							<h3 className="mt-6 whitespace-nowrap text-[clamp(1.2rem,2.15vw,1.8rem)] font-medium leading-[1.45] text-black">{copy.storeTitle}</h3>
							<p className="mt-3 max-w-[34rem] text-sm leading-7 text-black/55">{copy.storeDesc}</p>
							<Link href="/solutions/ecommerce-ai" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">
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
