'use client'

import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import { useLocale } from 'next-intl'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	BrainCircuit,
	Check,
	CircleCheck,
	MessageCircleMore,
	MousePointer2,
	Plug,
	Search,
	ShieldCheck,
	Sparkles,
} from 'lucide-react'

const COPY = {
	fa: {
		eyebrow: 'Vigento AI | هوش مصنوعی ویجنتو',
		title: 'عامل‌های هوش مصنوعی برای کسب‌وکارهای پیشرو',
		subtitle: 'ویجنت پیام مشتری را می‌فهمد، پاسخ را از دانش و داده‌های واقعی کسب‌وکار شما پیدا می‌کند و اقدام بعدی را هوشمندانه انجام می‌دهد.',
		cta: 'شروع کار با ویجنت',
		benefits: [
			{ title: 'هوشمند و قابل اعتماد', icon: ShieldCheck },
			{ title: 'بدون نیاز به کدنویسی', icon: MousePointer2 },
			{ title: 'یکپارچگی آسان', icon: Plug },
		],
		demoAria: 'نمایش ساده‌ای از جریان ویجنت؛ دریافت پیام مشتری، تحلیل با هوش مصنوعی، جستجو در دانش و CRM، سپس پاسخ و انجام اقدام.',
		demoTitle: 'جریان هوشمند ویجنت',
		liveStatus: 'فعال و متصل',
		workflowLabel: 'از پیام تا اقدام',
		workflow: [
			{ number: '۱', title: 'دریافت پیام مشتری', icon: MessageCircleMore },
			{ number: '۲', title: 'درک و تحلیل با هوش مصنوعی', icon: BrainCircuit },
			{ number: '۳', title: 'جستجو در دانش، محصولات و CRM', icon: Search },
			{ number: '۴', title: 'پاسخ هوشمند و انجام اقدام', icon: CircleCheck },
		],
		chatTitle: 'گفت‌وگوی زنده',
		chatStatus: 'Vigent AI آنلاین',
		customerOne: 'سلام، کت مشکی مدل آریا سایز ۴۰ موجوده؟',
		vigentReply: 'بله، ۲ عدد موجود است. می‌خواهید برایتان رزرو کنم؟',
		customerTwo: 'بله، لطفاً.',
		actionDone: 'رزرو برای ۱۵ دقیقه انجام شد',
	},
	en: {
		eyebrow: 'Vigento AI | Business intelligence',
		title: 'AI agents for forward-thinking businesses',
		subtitle: 'Vigent understands every customer message, finds the right answer in your live business data, and intelligently completes the next action.',
		cta: 'Get started with Vigent',
		benefits: [
			{ title: 'Smart and reliable', icon: ShieldCheck },
			{ title: 'No code required', icon: MousePointer2 },
			{ title: 'Easy integration', icon: Plug },
		],
		demoAria: 'A simple Vigent workflow that receives a customer message, analyzes it with AI, searches business knowledge and CRM, then replies and takes action.',
		demoTitle: 'Vigent intelligent workflow',
		liveStatus: 'Live and connected',
		workflowLabel: 'From message to action',
		workflow: [
			{ number: '1', title: 'Receive the customer message', icon: MessageCircleMore },
			{ number: '2', title: 'Understand and analyze with AI', icon: BrainCircuit },
			{ number: '3', title: 'Search knowledge, products and CRM', icon: Search },
			{ number: '4', title: 'Reply intelligently and take action', icon: CircleCheck },
		],
		chatTitle: 'Live conversation',
		chatStatus: 'Vigent AI online',
		customerOne: 'Hi, is the black Aria jacket available in size 40?',
		vigentReply: 'Yes, there are 2 in stock. Would you like me to reserve one?',
		customerTwo: 'Yes, please.',
		actionDone: 'Reserved for 15 minutes',
	},
} as const

type VigentoCopy = (typeof COPY)[keyof typeof COPY]

function Workflow({ copy }: { copy: VigentoCopy }) {
	return (
		<div className="rounded-[1.25rem] border border-black/[0.07] bg-[#fafaf9] p-4 sm:p-5">
			<p className="text-[12px] font-semibold text-black/60">{copy.workflowLabel}</p>
			<div className="relative mt-4 space-y-2.5">
				<span aria-hidden className="absolute bottom-5 start-[1.1rem] top-5 w-px bg-black/[0.08]" />
				{copy.workflow.map((step, index) => {
					const Icon = step.icon
					const finalStep = index === copy.workflow.length - 1

					return (
						<div key={step.title} className="relative flex min-h-[3.4rem] items-center gap-3 rounded-2xl border border-black/[0.065] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.025)]">
							<span className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${finalStep ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-black/[0.07] bg-white text-black/60'}`}>
								<Icon className="h-4 w-4" aria-hidden />
							</span>
							<div className="min-w-0 flex-1">
								<span className="block text-[11px] font-semibold tabular-nums text-black/50">{step.number}</span>
								<p className="mt-0.5 text-[12px] font-medium leading-5 text-[#202320]">{step.title}</p>
							</div>
						</div>
					)
				})}
			</div>
		</div>
	)
}

function ChatPreview({ copy, locale }: { copy: VigentoCopy; locale: 'fa' | 'en' }) {
	return (
		<div className="flex min-h-full flex-col overflow-hidden rounded-[1.25rem] border border-black/[0.07] bg-white">
			<div className="flex min-h-14 items-center justify-between border-b border-black/[0.065] px-4">
				<div className="flex items-center gap-2.5">
					<span className="grid h-8 w-8 place-items-center rounded-xl bg-black text-white">
						<Bot className="h-4 w-4" aria-hidden />
					</span>
					<div>
						<p className="text-xs font-semibold text-black/80">{copy.chatTitle}</p>
						<p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
							{copy.chatStatus}
						</p>
					</div>
				</div>
				<span className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.07] text-black/35">
					<Sparkles className="h-3.5 w-3.5" aria-hidden />
				</span>
			</div>

			<div className="flex flex-1 flex-col justify-end gap-3 bg-[#fafaf9] p-4">
				<div className="max-w-[88%] self-start rounded-[1rem] rounded-es-sm border border-black/[0.07] bg-white px-3 py-2.5 text-[12px] leading-5 text-black/65 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ltr:self-end ltr:rounded-es-[1rem] ltr:rounded-ee-sm">
					{copy.customerOne}
				</div>
				<div className="max-w-[92%] self-end rounded-[1rem] rounded-ee-sm bg-black px-3 py-2.5 text-[12px] leading-5 text-white/90 ltr:self-start ltr:rounded-ee-[1rem] ltr:rounded-es-sm">
					{copy.vigentReply}
				</div>
				<div className="max-w-[70%] self-start rounded-[1rem] rounded-es-sm border border-black/[0.07] bg-white px-3 py-2 text-[12px] leading-5 text-black/65 ltr:self-end ltr:rounded-es-[1rem] ltr:rounded-ee-sm">
					{copy.customerTwo}
				</div>
				<div className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-[11px] font-medium leading-5 text-emerald-800">
					<Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
					{copy.actionDone}
				</div>
			</div>

			<div className="flex min-h-12 items-center gap-2 border-t border-black/[0.06] bg-white px-3" aria-hidden>
				<div className="h-2 flex-1 rounded-full bg-black/[0.055]" />
				<span className="grid h-7 w-7 place-items-center rounded-lg bg-black text-white">
					<Arrow className="h-3.5 w-3.5" locale={locale} />
				</span>
			</div>
		</div>
	)
}

function Arrow({ className, locale }: { className?: string; locale: 'fa' | 'en' }) {
	const DirectionArrow = locale === 'fa' ? ArrowLeft : ArrowRight
	return <DirectionArrow className={className} aria-hidden />
}

function VigentoDemo({ copy, locale }: { copy: VigentoCopy; locale: 'fa' | 'en' }) {
	const reduce = useReducedMotion()

	return (
		<m.figure
			initial={reduce ? false : { opacity: 0, y: 22, scale: 0.985 }}
			whileInView={{ opacity: 1, y: 0, scale: 1 }}
			viewport={{ once: true, margin: '-70px' }}
			transition={reduce ? { duration: 0 } : { duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
			className="relative mx-auto w-full max-w-[760px]"
			aria-label={copy.demoAria}
		>
			<div aria-hidden className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_25%_45%,rgba(16,185,129,0.10),transparent_34%),radial-gradient(circle_at_70%_55%,rgba(0,0,0,0.06),transparent_42%)] blur-2xl" />
			<div className="overflow-hidden rounded-[1.75rem] border border-black/[0.08] bg-white shadow-[0_24px_80px_-36px_rgba(0,0,0,0.30),0_2px_12px_rgba(0,0,0,0.04)]">
				<div className="flex min-h-16 items-center justify-between border-b border-black/[0.065] px-4 sm:px-5">
					<div className="flex items-center gap-3">
						<span className="grid h-9 w-9 place-items-center rounded-xl bg-black text-white">
							<BrainCircuit className="h-[18px] w-[18px]" aria-hidden />
						</span>
						<div>
							<p className="text-xs font-semibold text-black/85 sm:text-[13px]">{copy.demoTitle}</p>
							<p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
								<span className="relative flex h-1.5 w-1.5" aria-hidden>
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" />
									<span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
								</span>
								{copy.liveStatus}
							</p>
						</div>
					</div>
					<div className="flex items-center gap-1.5" aria-hidden>
						<span className="h-2 w-2 rounded-full bg-black/[0.12]" />
						<span className="h-2 w-2 rounded-full bg-black/[0.12]" />
						<span className="h-2 w-2 rounded-full bg-black/[0.12]" />
					</div>
				</div>

				<div className="grid gap-3 p-3 sm:grid-cols-[0.92fr_1.08fr] sm:p-4">
					<Workflow copy={copy} />
					<ChatPreview copy={copy} locale={locale} />
				</div>
			</div>
		</m.figure>
	)
}

export function VigentoSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const reduce = useReducedMotion()

	return (
		<section id="vigento" dir={locale === 'fa' ? 'rtl' : 'ltr'} className="marketing-story-section relative scroll-mt-24 overflow-hidden bg-white py-20 sm:py-24 lg:py-32">
			<div aria-hidden className="marketing-grid pointer-events-none absolute inset-0 opacity-45 [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]" />
			<div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-black/[0.06]" />

			<div className="relative mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10">
				<div className="grid items-center gap-14 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 xl:gap-20">
					<m.div
						initial={reduce ? false : { opacity: 0, y: 18 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: '-70px' }}
						transition={reduce ? { duration: 0 } : { duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
						className="mx-auto max-w-[560px] text-center lg:mx-0 lg:text-start"
					>
						<p className="inline-flex items-center gap-2 text-[12px] font-semibold text-black/60 sm:text-[13px]">
							<span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.10)]" aria-hidden />
							{copy.eyebrow}
						</p>
						<h2 className="mt-6 text-[clamp(2.25rem,5vw,4.4rem)] font-semibold leading-[1.2] tracking-[-0.045em] text-[#0b0c0b] rtl:tracking-normal">
							{copy.title}
						</h2>
						<p className="mx-auto mt-6 max-w-[33rem] text-[15px] leading-8 text-black/60 sm:text-base sm:leading-8 lg:mx-0">
							{copy.subtitle}
						</p>

						<div className="mt-8 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
							{copy.benefits.map((benefit) => {
								const Icon = benefit.icon
								return (
									<div key={benefit.title} className="flex min-h-[4.5rem] items-center gap-3 rounded-[1.25rem] border border-black/[0.075] bg-white px-3.5 py-3 text-start shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
										<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f5f5f3] text-black/65">
											<Icon className="h-4 w-4" aria-hidden />
										</span>
										<p className="text-[12px] font-semibold leading-5 text-black/75">{benefit.title}</p>
									</div>
								)
							})}
						</div>

						<Link
							href="/login?next=/onboarding"
							className="marketing-pressable group mt-8 inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-[1.15rem] bg-black px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_14px_30px_-16px_rgba(0,0,0,0.65)] transition-[background-color,box-shadow] duration-200 hover:bg-black/85 hover:shadow-[0_18px_36px_-16px_rgba(0,0,0,0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4"
						>
							{copy.cta}
							<Arrow className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5 motion-reduce:transform-none" locale={locale} />
						</Link>
					</m.div>

					<VigentoDemo copy={copy} locale={locale} />
				</div>
			</div>
		</section>
	)
}
