'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	ArrowDownLeft,
	Bot,
	Check,
	Database,
	FileText,
	MessageSquareMore,
	Mic2,
	Package,
	Sparkles,
	UserRoundCheck,
	Webhook,
} from 'lucide-react'
import { InstagramIcon } from './social-links'

const COPY = {
	fa: {
		eyebrow: 'از پیام تا نتیجه',
		title: 'پاسخ خودکار کافی نیست. پاسخ باید به کار برسد.',
		subtitle: 'ویجنت اطلاعات واقعی شما را می‌خواند، در همان گفتگو اقدام می‌کند و هرجا تصمیم انسانی لازم باشد، درست کنار می‌رود.',
		groups: [
			{
				label: 'می‌داند',
				title: 'دانش کسب‌وکار، نه جواب عمومی اینترنت',
				desc: 'فایل‌ها، سؤال‌های پرتکرار، صفحات سایت و کاتالوگ محصول به یک منبع پاسخ قابل‌کنترل تبدیل می‌شوند.',
				points: ['پایگاه دانش و جست‌وجوی دقیق', 'قیمت و موجودی به‌روز', 'لحن و قوانین پاسخ‌گویی شما'],
			},
			{
				label: 'انجام می‌دهد',
				title: 'در دل گفتگو، مشتری را یک قدم جلو می‌برد',
				desc: 'محصول پیشنهاد می‌دهد، اطلاعات سرنخ را می‌گیرد، پیام صوتی را می‌فهمد و در اینستاگرام مسیرهای خودکار می‌سازد.',
				points: ['کارت محصول و دکمه اقدام', 'دایرکت، کامنت و استوری اینستاگرام', 'درک و پاسخ به پیام صوتی'],
			},
			{
				label: 'کنترل می‌کند',
				title: 'انسان همیشه در حلقه می‌ماند',
				desc: 'موضوع حساس با خلاصه گفتگو به اپراتور می‌رسد، سؤال بی‌پاسخ ثبت می‌شود و با یک تأیید به دانش ایجنت اضافه می‌شود.',
				points: ['تحویل هوشمند به اپراتور', 'مرکز یادگیری با تأیید شما', 'CRM، برچسب و گزارش مکالمات'],
			},
		],
		knowledge: 'منابع پاسخ',
		answer: 'پاسخ مستند آماده شد',
		instagram: 'سناریوی دایرکت',
		trigger: 'کامنت شامل «قیمت»',
		action: 'ارسال محصول در دایرکت',
		handoff: 'نیاز به بررسی همکار',
		summary: 'خلاصه و اطلاعات مشتری آماده است',
		learning: 'پیشنهاد یادگیری',
		approved: 'تأیید و اضافه شد',
	},
	en: {
		eyebrow: 'From message to outcome',
		title: 'An auto-reply is not enough. The answer needs to do work.',
		subtitle: 'Vigent reads your real information, acts inside the conversation, and steps aside cleanly whenever a human decision is needed.',
		groups: [
			{ label: 'Knows', title: 'Business knowledge, not generic internet answers', desc: 'Files, FAQs, website pages and your product catalog become one controlled source of truth.', points: ['Grounded knowledge search', 'Live prices and stock', 'Your tone and reply rules'] },
			{ label: 'Acts', title: 'Moves every customer one step forward', desc: 'Recommends products, captures leads, understands voice notes and runs Instagram automation paths.', points: ['Product cards and action buttons', 'Instagram DMs, comments and stories', 'Voice note understanding and replies'] },
			{ label: 'Controls', title: 'Humans stay in the loop', desc: 'Sensitive cases reach an operator with context, unanswered questions are captured, and one approval improves the agent.', points: ['Smart operator handoff', 'Approval-based learning center', 'CRM, labels and conversation reporting'] },
		],
		knowledge: 'Answer sources', answer: 'Grounded answer ready', instagram: 'DM automation', trigger: 'Comment contains “price”', action: 'Send product in DM', handoff: 'Teammate review needed', summary: 'Summary and customer details are ready', learning: 'Learning suggestion', approved: 'Approved and added',
	},
} as const

function KnowledgeVisual() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()
	return (
		<div className="relative h-full min-h-[290px] overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.055] p-4 sm:p-5">
			<div className="flex items-center justify-between"><p className="text-[10px] font-medium text-white/45">{copy.knowledge}</p><Database className="h-3.5 w-3.5 text-white/35" /></div>
			<div className="mt-5 grid grid-cols-2 gap-2">
				{[
					{ Icon: FileText, label: locale === 'fa' ? 'راهنمای ارسال.pdf' : 'Shipping guide.pdf' },
					{ Icon: Package, label: locale === 'fa' ? '۱۲۸ محصول' : '128 products' },
					{ Icon: Webhook, label: locale === 'fa' ? 'سایت فروشگاه' : 'Store website' },
					{ Icon: MessageSquareMore, label: locale === 'fa' ? 'سؤالات پرتکرار' : 'Common questions' },
				].map(({ Icon, label }, index) => (
					<motion.div key={label} initial={{ opacity: 0, y: reduce ? 0 : 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5">
						<Icon className="h-3.5 w-3.5 text-white/50" /><span className="truncate text-[9px] text-white/55">{label}</span>
					</motion.div>
				))}
			</div>
			<motion.div initial={{ opacity: 0, y: reduce ? 0 : 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.35, duration: 0.45 }} className="absolute inset-x-4 bottom-4 rounded-xl bg-white p-3 text-black shadow-lg sm:inset-x-5">
				<div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-black text-white"><Bot className="h-3 w-3" /></span><p className="text-[10px] font-medium">{copy.answer}</p><Check className="ms-auto h-3.5 w-3.5 text-emerald-600" /></div>
				<div className="mt-2 h-1.5 w-full rounded-full bg-black/10" /><div className="mt-1.5 h-1.5 w-3/4 rounded-full bg-black/[0.06]" />
			</motion.div>
		</div>
	)
}

function ActionVisual() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	return (
		<div className="relative h-full min-h-[290px] overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.055] p-4 sm:p-5">
			<div className="flex items-center justify-between"><p className="text-[10px] font-medium text-white/45">{copy.instagram}</p><InstagramIcon className="h-3.5 w-3.5 text-white/35" /></div>
			<div className="mt-5 space-y-3">
				<div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><MessageSquareMore className="h-3.5 w-3.5" /></span><div><p className="text-[9px] text-white/35">Trigger</p><p className="mt-0.5 text-[10px] text-white/70">{copy.trigger}</p></div></div>
				<div className="ms-7 h-5 border-s border-dashed border-white/20" />
				<div className="flex items-center gap-3 rounded-xl bg-white p-3 text-black"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white"><Package className="h-3.5 w-3.5" /></span><div><p className="text-[9px] text-black/35">Action</p><p className="mt-0.5 text-[10px] font-medium">{copy.action}</p></div><ArrowDownLeft className="ms-auto h-3.5 w-3.5 text-black/35" /></div>
			</div>
			<div className="absolute bottom-4 end-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2 text-[9px] text-white/55"><Mic2 className="h-3 w-3" />{locale === 'fa' ? 'پیام صوتی هم فهمیده می‌شود' : 'Voice notes understood too'}</div>
		</div>
	)
}

function ControlVisual() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	return (
		<div className="relative h-full min-h-[290px] overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.055] p-4 sm:p-5">
			<div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3.5">
				<div className="flex items-center gap-2"><UserRoundCheck className="h-4 w-4 text-amber-200" /><p className="text-[10px] font-medium text-white/75">{copy.handoff}</p><span className="ms-auto h-2 w-2 rounded-full bg-amber-300" /></div>
				<p className="mt-2 text-[9px] leading-4 text-white/40">{copy.summary}</p>
			</div>
			<div className="my-3 flex items-center gap-2 px-2"><span className="h-px flex-1 bg-white/10" /><Sparkles className="h-3 w-3 text-white/25" /><span className="h-px flex-1 bg-white/10" /></div>
			<div className="rounded-xl border border-white/10 bg-black/20 p-3.5">
				<div className="flex items-center gap-2"><Bot className="h-4 w-4 text-white/45" /><p className="text-[10px] font-medium text-white/75">{copy.learning}</p></div>
				<div className="mt-3 rounded-lg bg-white/[0.06] p-2.5"><div className="h-1.5 w-full rounded-full bg-white/10" /><div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-white/[0.06]" /></div>
				<div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-[9px] font-medium text-black"><Check className="h-3 w-3" />{copy.approved}</div>
			</div>
		</div>
	)
}

const VISUALS = [KnowledgeVisual, ActionVisual, ControlVisual]

export function FeaturesSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()

	return (
		<section id="features" className="bg-black py-20 text-white sm:py-24 lg:py-32">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="grid gap-6 border-t border-white/15 pt-7 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
					<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/35">{copy.eyebrow}</p>
					<div>
						<h2 className="max-w-4xl text-balance text-4xl font-semibold leading-[1.12] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">{copy.title}</h2>
						<p className="mt-5 max-w-2xl text-[15px] leading-8 text-white/50">{copy.subtitle}</p>
					</div>
				</div>

				<div className="mt-12 divide-y divide-white/10 border-y border-white/10">
					{copy.groups.map((group, index) => {
						const Visual = VISUALS[index]
						return (
							<motion.article key={group.label} initial={{ opacity: 0, y: reduce ? 0 : 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.55 }} className="grid gap-8 py-10 lg:grid-cols-[0.72fr_1fr] lg:items-center lg:gap-16 lg:py-14">
								<div>
									<span className="inline-flex items-center gap-2 text-[11px] font-medium text-white/35"><span className="h-px w-8 bg-white/25" />{group.label}</span>
									<h3 className="mt-5 max-w-xl text-2xl font-medium leading-tight sm:text-3xl">{group.title}</h3>
									<p className="mt-4 max-w-xl text-sm leading-7 text-white/50">{group.desc}</p>
									<ul className="mt-6 space-y-3">
										{group.points.map((point) => <li key={point} className="flex items-center gap-3 text-xs text-white/65"><span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/15"><Check className="h-3 w-3" /></span>{point}</li>)}
									</ul>
								</div>
								<Visual />
							</motion.article>
						)
					})}
				</div>
			</div>
		</section>
	)
}
