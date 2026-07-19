'use client'

import type { ComponentType } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	BarChart3,
	BookOpenCheck,
	Bot,
	CalendarCheck2,
	Check,
	Megaphone,
	MessageSquareMore,
	Package,
	QrCode,
	Sparkles,
	UserRoundCheck,
	UsersRound,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

type Pillar = {
	title: string
	desc: string
	icon: ComponentType<{ className?: string }>
	items: { label: string; icon: ComponentType<{ className?: string }> }[]
}

const COPY: Record<'fa' | 'en', {
	eyebrow: string
	title: string
	subtitle: string
	controlTitle: string
	controlDesc: string
	controlLabel: string
	layers: string[]
	guardrail: string
	pillars: Pillar[]
}> = {
	fa: {
		eyebrow: 'یک سیستم، نه چند ابزار پراکنده',
		title: 'از اولین پیام تا نتیجه‌ای که در کسب‌وکار ثبت می‌شود',
		subtitle: 'ویجنت فقط جواب نمی‌دهد؛ دانش، فروش، رزرو، مشتری و کار تیم را در یک جریان قابل‌کنترل به هم وصل می‌کند.',
		controlTitle: 'ایجنتی که با قواعد شما کار می‌کند',
		controlDesc: 'لحن، دانش، محدوده پاسخ و زمان تحویل به انسان را مشخص کنید؛ هیچ چیز بدون منبع معتبر یا تأیید شما یاد گرفته نمی‌شود.',
		controlLabel: 'موتور ۶ لایه',
		layers: ['نقش و هدف', 'لحن برند', 'دانش معتبر', 'قواعد پاسخ', 'اقدام بعدی', 'تحویل به انسان'],
		guardrail: 'بدون حدس · با منبع · قابل بازبینی',
		pillars: [
			{ title: 'پاسخ دقیق و قابل اعتماد', desc: 'پاسخ از فایل، سایت، سؤال‌های تأییدشده و داده واقعی کسب‌وکار؛ همراه یادگیری تحت نظارت و پیام صوتی فارسی.', icon: BookOpenCheck, items: [{ label: 'پایگاه دانش', icon: BookOpenCheck }, { label: 'یادگیری با تأیید', icon: Check }, { label: 'صدای فارسی', icon: Sparkles }] },
			{ title: 'فروش، سفارش و رزرو', desc: 'قیمت و موجودی، پیشنهاد محصول، ووکامرس، منوی QR و زمان‌های آزاد را مستقیم وارد گفتگو کنید.', icon: Package, items: [{ label: 'محصول و موجودی', icon: Package }, { label: 'رزرو بدون تداخل', icon: CalendarCheck2 }, { label: 'منوی دیجیتال', icon: QrCode }] },
			{ title: 'همه کانال‌ها، یک عملیات', desc: 'پیام‌های اینستاگرام و پیام‌رسان‌ها در یک صندوق؛ اتوماسیون ثابت، لینک چت و ویجت سایت با همان دانش مشترک.', icon: MessageSquareMore, items: [{ label: 'اتوماسیون اینستاگرام', icon: InstagramIcon }, { label: 'صندوق چندکاناله', icon: MessageSquareMore }, { label: 'کمپین هدفمند', icon: Megaphone }] },
			{ title: 'مشتری، تیم و تصمیم', desc: 'پرونده مشتری، سرنخ و رضایت را نگه دارید؛ موارد حساس را با خلاصه تحویل دهید و نتیجه را در گزارش ببینید.', icon: UsersRound, items: [{ label: 'CRM مشتری', icon: UsersRound }, { label: 'تحویل به همکار', icon: UserRoundCheck }, { label: 'گزارش عملکرد', icon: BarChart3 }] },
		],
	},
	en: {
		eyebrow: 'One system, not scattered tools',
		title: 'From the first message to an outcome recorded in your business',
		subtitle: 'Vigent does more than answer. It connects knowledge, sales, bookings, customers and team work in one controllable flow.',
		controlTitle: 'An agent that works by your rules',
		controlDesc: 'Set its voice, knowledge, response boundaries and human handoff. Nothing is learned without a reliable source or your approval.',
		controlLabel: 'Six-layer engine',
		layers: ['Role and goal', 'Brand voice', 'Trusted knowledge', 'Reply rules', 'Next action', 'Human handoff'],
		guardrail: 'No guessing · Grounded · Reviewable',
		pillars: [
			{ title: 'Accurate, trusted answers', desc: 'Answer from files, websites, approved Q&A and real business data, with supervised learning and Persian voice.', icon: BookOpenCheck, items: [{ label: 'Knowledge base', icon: BookOpenCheck }, { label: 'Approved learning', icon: Check }, { label: 'Persian voice', icon: Sparkles }] },
			{ title: 'Sales, orders and booking', desc: 'Bring price, stock, product advice, WooCommerce, QR menus and live availability into the conversation.', icon: Package, items: [{ label: 'Products and stock', icon: Package }, { label: 'Conflict-free booking', icon: CalendarCheck2 }, { label: 'Digital menu', icon: QrCode }] },
			{ title: 'Every channel, one operation', desc: 'Bring Instagram and messaging into one inbox, with deterministic automation, chat links and the web widget.', icon: MessageSquareMore, items: [{ label: 'Instagram automation', icon: InstagramIcon }, { label: 'Omnichannel inbox', icon: MessageSquareMore }, { label: 'Targeted campaigns', icon: Megaphone }] },
			{ title: 'Customers, team and decisions', desc: 'Keep customer context, leads and satisfaction; hand sensitive cases to people and track the outcome.', icon: UsersRound, items: [{ label: 'Customer CRM', icon: UsersRound }, { label: 'Human handoff', icon: UserRoundCheck }, { label: 'Performance reports', icon: BarChart3 }] },
		],
	},
}

function AgentControl({ locale }: { locale: 'fa' | 'en' }) {
	const copy = COPY[locale]
	const reduce = useReducedMotion()

	return (
		<div className="relative overflow-hidden rounded-[1.8rem] bg-black p-5 text-white shadow-[0_28px_80px_rgba(0,0,0,0.2)] sm:p-6">
			<div aria-hidden className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-55" />
			<div className="relative flex items-start justify-between gap-5 border-b border-white/10 pb-5">
				<div className="flex items-start gap-3">
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-black"><Bot className="h-4 w-4" /></span>
					<div><p className="text-sm font-semibold">{copy.controlTitle}</p><p className="mt-1 text-[10px] text-white/40">{copy.controlLabel}</p></div>
				</div>
				<span className="mt-1 flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[9px] text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />{locale === 'fa' ? 'فعال' : 'Live'}</span>
			</div>

			<p className="relative mt-5 max-w-xl text-xs leading-6 text-white/55">{copy.controlDesc}</p>
			<div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
				{copy.layers.map((layer, index) => (
					<m.div key={layer} initial={reduce ? false : { opacity: 0, y: 7 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={reduce ? { duration: 0 } : { duration: 0.34, delay: index * 0.045 }} className="rounded-xl border border-white/10 bg-white/[0.055] p-3">
						<div className="flex items-center justify-between gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-white text-black"><Check className="h-3 w-3" /></span><span className="font-mono text-[9px] text-white/30">0{index + 1}</span></div>
						<p className="mt-3 text-[10px] leading-4 text-white/65">{layer}</p>
					</m.div>
				))}
			</div>
			<p className="relative mt-4 flex items-center gap-2 text-[9px] text-white/35"><Sparkles className="h-3 w-3" />{copy.guardrail}</p>
		</div>
	)
}

export function FeaturesSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()

	return (
		<section id="features" className="marketing-story-section bg-white py-16 text-[var(--text-primary)] sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="grid gap-8 lg:grid-cols-[0.76fr_1.24fr] lg:items-end lg:gap-14">
					<div>
						<p className="marketing-eyebrow">{copy.eyebrow}</p>
						<h2 className="marketing-heading mt-4 max-w-2xl">{copy.title}</h2>
						<p className="marketing-subtitle mt-4 max-w-xl">{copy.subtitle}</p>
					</div>
					<AgentControl locale={locale} />
				</div>

				<div className="mt-5 grid gap-3 sm:grid-cols-2">
					{copy.pillars.map(({ title, desc, icon: Icon, items }, index) => (
						<m.article key={title} initial={reduce ? false : { opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={reduce ? { duration: 0 } : { duration: 0.4, delay: (index % 2) * 0.06 }} className="spatial-surface rounded-[1.45rem] p-5 sm:p-6">
							<div className="flex items-start gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white"><Icon className="h-4 w-4" /></span><div><h3 className="text-base font-semibold text-black">{title}</h3><p className="mt-2 text-xs leading-6 text-black/50">{desc}</p></div></div>
							<div className="mt-5 flex flex-wrap gap-2">{items.map(({ label, icon: ItemIcon }) => <span key={label} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-black/[0.07] bg-white px-3 text-[10px] text-black/55"><ItemIcon className="h-3 w-3" />{label}</span>)}</div>
						</m.article>
					))}
				</div>
			</div>
		</section>
	)
}
