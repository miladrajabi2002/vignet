'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	ArrowLeft,
	ArrowRight,
	Check,
	Database,
	Globe2,
	Layers,
	MessageCircleMore,
	MessagesSquare,
	Radio,
	Rocket,
	ShieldCheck,
	Sparkles,
	TestTube2,
	Wand2,
} from 'lucide-react'
import { InstagramIcon, TelegramIcon } from './social-links'

const COPY = {
	fa: {
		eyebrow: 'Vigento AI | هوش مصنوعی ویجنتو',
		title: 'فقط ایجنت نمی‌سازد؛ هسته‌ای است که کسب‌وکارتان را مدیریت می‌کند',
		subtitle: 'ویجنتو هدف کسب‌وکار را از زبان خودتان می‌فهمد، ایجنت شش‌لایه را می‌سازد و بعد از راه‌اندازی کنار CRM، محصول، رزرو، گفتگوها و کانال‌ها می‌ماند تا هم پاسخ بدهد و هم کار انجام دهد.',
		cta: 'شروع کار با Vigento AI',
		trust: 'هر پیشنهاد قابل ویرایش است · انتشار فقط با تأیید شما',
		demoAria: 'دموی ویجنتو که از یک درخواست ساده، نقشه کامل ایجنت شامل هدف، موتور پرامپت شش‌لایه، پایگاه دانش، کانال‌ها، تست و انتشار می‌سازد.',
		workspace: 'استودیوی ساخت ایجنت',
		status: 'Vigento AI آنلاین است',
		promptLabel: 'درخواست شما',
		prompt: 'برای فروشگاه پوشاکم یک مشاور فروش می‌خواهم؛ موجودی را بداند، محصول مقایسه کند و در اینستاگرام و واتساپ پاسخ بدهد.',
		building: 'ویجنتو دارد نقشهٔ ایجنت را می‌سازد',
		blueprint: 'نقشهٔ پیشنهادی',
		agentName: 'مشاور فروش پوشاک',
		agentDesc: 'فروشنده‌ای دقیق و خوش‌لحن که از دادهٔ واقعی فروشگاه پاسخ می‌دهد.',
		engineLabel: 'موتور پرامپت ۶ لایه‌ای',
		layers: [
			{ n: '۱', label: 'شخصیت', value: 'مشاور حرفه‌ای پوشاک' },
			{ n: '۲', label: 'لحن', value: 'صمیمی، مودب، فارسی' },
			{ n: '۳', label: 'قلمرو', value: 'معرفی، موجودی، مقایسه' },
			{ n: '۴', label: 'عدم آگاهی', value: 'ارجاع به اپراتور' },
			{ n: '۵', label: 'فرمت', value: 'بولت، لینک، متوسط' },
			{ n: '۶', label: 'پرسش و پاسخ', value: '۳ نمونه ثبت شد' },
		],
		steps: [
			{ label: 'دانش و RAG', value: 'کاتالوگ، موجودی و قوانین فروش' },
			{ label: 'کانال‌ها', value: 'اینستاگرام، واتساپ و وب' },
			{ label: 'تست سناریوها', value: 'مقایسه، موجودی و پیگیری سفارش' },
			{ label: 'انتشار', value: 'آمادهٔ بازبینی نهایی' },
		],
		knowledge: ['کاتالوگ محصول', 'قوانین ارسال', 'سؤالات پرتکرار'],
		ready: 'نقشه آماده شد',
		review: 'بازبینی و ساخت ایجنت',
	},
	en: {
		eyebrow: 'Vigento AI | Business intelligence core',
		title: 'It does not just build an agent. It helps operate the business around it.',
		subtitle: 'Vigento understands the goal, builds the six-layer agent, then stays connected to CRM, products, bookings, conversations and channels to answer questions and carry out approved actions.',
		cta: 'Start with Vigento AI',
		trust: 'Every suggestion is editable · Nothing goes live without approval',
		demoAria: 'A Vigento demo turning one plain-language request into a complete agent blueprint with a goal, six-layer prompt engine, knowledge base, channels, tests and launch review.',
		workspace: 'Agent build studio',
		status: 'Vigento AI is online',
		promptLabel: 'Your request',
		prompt: 'I need a sales advisor for my clothing store. It should know stock, compare products, and reply on Instagram and WhatsApp.',
		building: 'Vigento is mapping your agent',
		blueprint: 'Suggested blueprint',
		agentName: 'Fashion sales advisor',
		agentDesc: 'A precise, warm sales agent grounded in live store data.',
		engineLabel: 'Six-layer prompt engine',
		layers: [
			{ n: '1', label: 'Personality', value: 'Professional fashion advisor' },
			{ n: '2', label: 'Tone', value: 'Warm, polite, English' },
			{ n: '3', label: 'Scope', value: 'Recommend, stock, compare' },
			{ n: '4', label: 'Fallback', value: 'Hand off to operator' },
			{ n: '5', label: 'Format', value: 'Bullets, links, medium' },
			{ n: '6', label: 'Q&A pairs', value: '3 samples added' },
		],
		steps: [
			{ label: 'Knowledge & RAG', value: 'Catalog, stock and store policies' },
			{ label: 'Channels', value: 'Instagram, WhatsApp and web' },
			{ label: 'Scenario tests', value: 'Compare, stock and order follow-up' },
			{ label: 'Launch', value: 'Ready for final review' },
		],
		knowledge: ['Product catalog', 'Shipping rules', 'Frequently asked questions'],
		ready: 'Blueprint ready',
		review: 'Review and create agent',
	},
} as const

const STEP_ICONS = [Database, MessageCircleMore, TestTube2, Rocket]
const CHANNEL_ICONS: ComponentType<{ className?: string }>[] = [
	InstagramIcon,
	MessageCircleMore,
	TelegramIcon,
	MessagesSquare,
	Radio,
	Globe2,
]

function VigentoDemo() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()

	return (
		<m.div
			initial={reduce ? false : { opacity: 0, y: 20, scale: 0.985 }}
			whileInView={{ opacity: 1, y: 0, scale: 1 }}
			viewport={{ once: true, margin: '-70px' }}
			transition={reduce ? { duration: 0 } : { duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
			className="relative mx-auto w-full max-w-[690px]"
			role="img"
			aria-label={copy.demoAria}
		>
			{/* Light flat panel */}
			<div className="relative overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-white" style={{ boxShadow: 'var(--shadow-card)' }}>
				{/* Top bar */}
				<div className="relative flex min-h-12 items-center justify-between border-b border-[var(--border-default)] px-4 sm:px-5">
					<div className="flex items-center gap-2.5">
						<span className="relative grid h-7 w-7 place-items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]">
							<Wand2 className="h-3.5 w-3.5" />
							{!reduce && <span className="absolute -inset-1 rounded-lg border border-[var(--accent)]/30 animate-ping" />}
						</span>
						<span className="text-[10px] font-medium text-[var(--text-secondary)] sm:text-[11px]">{copy.workspace}</span>
					</div>
					<span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-[var(--text-secondary)] sm:text-[10px]">
						<span className="relative flex h-1.5 w-1.5">
							<span className="absolute h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-50 motion-reduce:animate-none" />
							<span className="relative h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
						</span>
						{copy.status}
					</span>
				</div>

				<div className="relative grid gap-3 p-3 sm:p-4 lg:grid-cols-[0.82fr_1.18fr]">
					{/* Left: prompt + building animation */}
					<div className="flex flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 sm:p-4">
						<p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">{copy.promptLabel}</p>
						<m.div
							initial={reduce ? false : { opacity: 0, y: 8 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={reduce ? { duration: 0 } : { duration: 0.45, delay: 0.25 }}
							className="mt-3 rounded-2xl rounded-ee-md border border-[var(--border-default)] bg-white px-3.5 py-3 text-[10px] leading-5 text-[var(--text-secondary)] sm:text-[11px]"
						>
							{copy.prompt}
						</m.div>

						{/* Neural processing line */}
						<div className="relative my-3 h-9">
							<span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--border-hover)]" />
							{!reduce && (
								<m.span
									className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--accent)]"
									animate={{ y: [0, 28], opacity: [0, 1, 1, 0] }}
									transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 0.9, ease: [0.4, 0, 0.2, 1] }}
								/>
							)}
						</div>

						<m.div
							initial={reduce ? false : { opacity: 0, y: 7 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={reduce ? { duration: 0 } : { duration: 0.42, delay: 0.55 }}
							className="rounded-2xl border border-[var(--border-default)] bg-white p-3"
						>
							<p className="flex items-center gap-2 text-[10px] font-medium text-[var(--text-primary)]">
								<Sparkles className="h-3.5 w-3.5" />
								{copy.building}
							</p>
							<div className="mt-3 flex flex-wrap gap-1.5">
								{copy.knowledge.map((item) => (
									<span key={item} className="rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2 py-1 text-[8px] text-[var(--text-muted)] sm:text-[9px]">{item}</span>
								))}
							</div>
							<div className="mt-3 flex items-center gap-1.5">
								{CHANNEL_ICONS.map((Icon, index) => (
									<span key={index} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
										<Icon className="h-3 w-3" />
									</span>
								))}
							</div>
						</m.div>
					</div>

					{/* Right: blueprint with 6-layer engine */}
					<div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 text-[var(--text-primary)] sm:p-4">
						<div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] pb-3">
							<div className="min-w-0">
								<p className="text-[9px] font-medium text-[var(--text-muted)]">{copy.blueprint}</p>
								<h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)] sm:text-base">{copy.agentName}</h3>
								<p className="mt-1 text-[9px] leading-4 text-[var(--text-muted)] sm:text-[10px]">{copy.agentDesc}</p>
							</div>
							<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--text-primary)] text-white">
								<ShieldCheck className="h-4 w-4" />
							</span>
						</div>

						{/* 6-layer prompt engine — the star of the show */}
						<m.div
							initial={reduce ? false : { opacity: 0, y: 6 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.5 }}
							className="mt-3 rounded-xl border border-[var(--border-default)] bg-white p-2.5"
						>
							<p className="flex items-center gap-1.5 text-[9px] font-semibold text-[var(--text-primary)]">
								<Layers className="h-3.5 w-3.5" />
								{copy.engineLabel}
							</p>
							<div className="mt-2 grid grid-cols-2 gap-1">
								{copy.layers.map((layer, index) => (
									<m.div
										key={layer.n}
										initial={reduce ? false : { opacity: 0, scale: 0.95 }}
										whileInView={{ opacity: 1, scale: 1 }}
										viewport={{ once: true }}
										transition={reduce ? { duration: 0 } : { duration: 0.25, delay: 0.6 + index * 0.06 }}
										className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5"
									>
										<span className="grid h-4 w-4 shrink-0 place-items-center rounded bg-[var(--text-primary)] text-[8px] font-bold text-white">{layer.n}</span>
										<div className="min-w-0 flex-1">
											<p className="text-[8px] font-medium text-[var(--text-secondary)]">{layer.label}</p>
											<p className="truncate text-[7px] text-[var(--text-muted)] sm:text-[8px]">{layer.value}</p>
										</div>
									</m.div>
								))}
							</div>
						</m.div>

						{/* Build steps */}
						<div className="mt-2.5 space-y-1">
							{copy.steps.map((step, index) => {
								const Icon = STEP_ICONS[index]
								return (
									<m.div
										key={step.label}
										initial={reduce ? false : { opacity: 0, x: locale === 'fa' ? 8 : -8 }}
										whileInView={{ opacity: 1, x: 0 }}
										viewport={{ once: true }}
										transition={reduce ? { duration: 0 } : { duration: 0.3, delay: 0.9 + index * 0.08 }}
										className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-white px-2.5 py-1.5"
									>
										<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)]">
											<Icon className="h-3 w-3" />
										</span>
										<div className="min-w-0 flex-1">
											<p className="text-[8px] font-semibold text-[var(--text-secondary)] sm:text-[9px]">{step.label}</p>
											<p className="truncate text-[7px] text-[var(--text-muted)] sm:text-[8px]">{step.value}</p>
										</div>
										<span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white">
											<Check className="h-2.5 w-2.5" />
										</span>
									</m.div>
								)
							})}
						</div>

						<m.div
							initial={reduce ? false : { opacity: 0, scale: 0.98 }}
							whileInView={{ opacity: 1, scale: 1 }}
							viewport={{ once: true }}
							transition={reduce ? { duration: 0 } : { duration: 0.35, delay: 1.3 }}
							className="mt-2.5 flex items-center justify-between gap-3 rounded-xl bg-[var(--text-primary)] px-3 py-2 text-white"
						>
							<span className="inline-flex items-center gap-1.5 text-[9px] font-medium text-[var(--success)] sm:text-[10px]">
								<span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
								{copy.ready}
							</span>
							<span className="text-[9px] font-medium text-white/65">{copy.review}</span>
						</m.div>
					</div>
				</div>
			</div>
		</m.div>
	)
}

export function VigentoSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section id="vigento" className="marketing-story-section bg-white py-16 sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="marketing-grid-dark relative overflow-hidden rounded-[2rem] bg-black px-4 py-6 text-white shadow-[0_32px_100px_rgba(0,0,0,0.2)] sm:px-7 sm:py-8 lg:px-10 lg:py-10">
					<div className="relative grid items-center gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-10 xl:gap-14">
						<m.div
							initial={reduce ? false : { opacity: 0, y: 18 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: '-70px' }}
							transition={reduce ? { duration: 0 } : { duration: 0.6 }}
							className="text-center lg:text-start"
						>
							<span className="inline-flex items-center gap-2 text-[11px] font-semibold text-white/60">
								<span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-black">
									<Wand2 className="h-3.5 w-3.5" aria-hidden />
								</span>
								{copy.eyebrow}
							</span>
							<h2 className="mt-5 text-[clamp(1.7rem,4.8vw,3.1rem)] font-semibold leading-[1.25] tracking-[-0.035em] text-white rtl:tracking-normal">
								{copy.title}
							</h2>
							<p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/55 sm:text-[15px] sm:leading-8 lg:mx-0">
								{copy.subtitle}
							</p>
							<Link
								href="/login?next=/onboarding"
								className="marketing-pressable group mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
							>
								{copy.cta}
								<Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden />
							</Link>
							<p className="mt-4 flex items-center justify-center gap-2 text-[10px] leading-5 text-white/35 lg:justify-start">
								<ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
								{copy.trust}
							</p>
						</m.div>

						<VigentoDemo />
					</div>
				</div>
			</div>
		</section>
	)
}
