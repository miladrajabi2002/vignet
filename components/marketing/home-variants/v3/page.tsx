'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	Check,
	ChevronLeft,
	ChevronRight,
	MessageCircleMore,
	Sparkles,
} from 'lucide-react'
import { COMMON_COPY, VARIANT_COPY, type ProductScenario } from '../shared/content'
import type { HomeLocale, HomeVariantPageProps } from '../shared/types'
import {
	CapabilitySection,
	ChannelPills,
	ClosingCta,
	EASE_OUT,
	FaqSection,
	OnboardingStory,
	PricingPreview,
	ProductFlowDemo,
	ProductIcon,
	Reveal,
	RevealBlock,
	SectionHeading,
	TrialBadge,
	TrustRail,
	VariantSwitcher,
} from '../shared/primitives'
import styles from '../home-variants.module.css'

const V3_COPY = {
	fa: {
		selectorLabel: 'اول مدل کسب‌وکارتان را انتخاب کنید',
		selectorHint: 'دمو و پیشنهاد ایجنت همان لحظه با انتخاب شما هماهنگ می‌شود.',
		previewLabel: 'پیش‌نمایش راه‌اندازی',
		previewStep: 'مرحله ۱ از ۴',
		ready: 'آماده برای شخصی‌سازی',
		agentFor: 'ایجنت پیشنهادی برای',
		agentDescription: 'این پیشنهاد از مسیر واقعی محصول ساخته شده و در مرحلهٔ بعد قابل ویرایش است.',
		source: 'منبع پاسخ',
		action: 'اقدام پیشنهادی',
		outcome: 'نتیجهٔ ثبت‌شده',
		buildCta: 'ساخت همین ایجنت',
		continueHint: 'انتخاب شما در شروع مسیر قابل تغییر است.',
		productEyebrow: 'قبل از ثبت‌نام، نتیجه را ببینید',
		productTitle: 'یک پیام واقعی چطور به یک اقدام قابل‌پیگیری تبدیل می‌شود؟',
		productSubtitle:
			'سناریوی کسب‌وکارتان را انتخاب کنید و مسیر پیام، منبع، پاسخ، اقدام و ثبت نتیجه را بدون ادعای مبهم ببینید.',
		resultLabel: 'نتیجهٔ این سناریو',
		messageLabel: 'پیام مشتری',
		answerLabel: 'پاسخ ایجنت',
		channelLabel: 'کانال پیشنهادی برای دمو',
	},
	en: {
		selectorLabel: 'Start by choosing your business model',
		selectorHint: 'The demo and suggested agent update immediately with your choice.',
		previewLabel: 'Setup preview',
		previewStep: 'Step 1 of 4',
		ready: 'Ready to personalize',
		agentFor: 'Suggested agent for',
		agentDescription: 'This suggestion follows the real product setup and remains editable in the next step.',
		source: 'Answer source',
		action: 'Suggested action',
		outcome: 'Recorded outcome',
		buildCta: 'Build this agent',
		continueHint: 'You can change this choice during setup.',
		productEyebrow: 'See the outcome before signing up',
		productTitle: 'How does one real message become a trackable action?',
		productSubtitle:
			'Choose your business scenario and inspect the message, source, answer, action and recorded outcome without vague promises.',
		resultLabel: 'Outcome for this scenario',
		messageLabel: 'Customer message',
		answerLabel: 'Agent reply',
		channelLabel: 'Suggested demo channel',
	},
} satisfies Record<HomeLocale, Record<string, string>>

function BusinessTabs({
	locale,
	scenarios,
	activeIndex,
	onChange,
	idPrefix,
}: {
	locale: HomeLocale
	scenarios: ProductScenario[]
	activeIndex: number
	onChange: (index: number) => void
	idPrefix: string
}) {
	const rootRef = useRef<HTMLDivElement>(null)

	function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
		let delta = 0
		if (event.key === 'ArrowDown') delta = 1
		if (event.key === 'ArrowUp') delta = -1
		if (event.key === 'ArrowRight') delta = locale === 'fa' ? -1 : 1
		if (event.key === 'ArrowLeft') delta = locale === 'fa' ? 1 : -1
		if (!delta) return

		event.preventDefault()
		const next = (activeIndex + delta + scenarios.length) % scenarios.length
		onChange(next)
		requestAnimationFrame(() => {
			rootRef.current
				?.querySelector<HTMLButtonElement>(`[data-business-index="${next}"]`)
				?.focus()
		})
	}

	return (
		<div
			ref={rootRef}
			role="tablist"
			aria-label={locale === 'fa' ? 'انتخاب نوع کسب‌وکار' : 'Choose a business type'}
			onKeyDown={moveFocus}
			className="grid grid-cols-2 gap-2 sm:grid-cols-5"
		>
			{scenarios.map((scenario, index) => {
				const selected = index === activeIndex
				return (
					<button
						key={scenario.id}
						id={`${idPrefix}-tab-${scenario.id}`}
						type="button"
						role="tab"
						aria-selected={selected}
						aria-controls={`${idPrefix}-panel`}
						tabIndex={selected ? 0 : -1}
						data-business-index={index}
						onClick={() => onChange(index)}
						className={`group relative min-h-14 rounded-2xl border px-2 py-2.5 text-center transition-[background-color,color,border-color,transform,box-shadow] duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2 ${
							selected
								? 'border-black bg-black text-white shadow-[0_12px_28px_rgba(0,0,0,0.13)]'
								: 'border-black/[0.075] bg-white text-black/48 hover:border-black/15 hover:text-black'
						}`}
					>
						<ProductIcon name={scenario.icon} className="mx-auto h-4 w-4" />
						<span className="mt-1.5 block truncate text-[10px] font-semibold">{scenario.label}</span>
						{selected ? <span aria-hidden className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-emerald-400" /> : null}
					</button>
				)
			})}
		</div>
	)
}

function SuggestedAgentPreview({
	locale,
	scenario,
}: {
	locale: HomeLocale
	scenario: ProductScenario
}) {
	const copy = V3_COPY[locale]
	const reduce = useReducedMotion()
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<div className="mt-3 overflow-hidden rounded-[1.55rem] bg-[#070707] p-3 text-white shadow-[0_24px_65px_rgba(0,0,0,0.18)] sm:p-4">
			<div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-black">
						<Bot className="h-4 w-4" aria-hidden />
					</span>
					<div className="min-w-0">
						<p className="truncate text-[11px] font-semibold">{copy.previewLabel}</p>
						<p className="mt-0.5 text-[9px] text-white/38">{copy.previewStep}</p>
					</div>
				</div>
				<span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-emerald-300/10 px-2.5 text-[9px] font-semibold text-emerald-200">
					<span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
					{copy.ready}
				</span>
			</div>

			<AnimatePresence mode="wait" initial={false}>
				<m.div
					key={scenario.id}
					id="v3-hero-panel"
					role="tabpanel"
					aria-labelledby={`v3-hero-tab-${scenario.id}`}
					aria-live="polite"
					initial={reduce ? false : { opacity: 0, transform: 'translate3d(0, 9px, 0)' }}
					animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
					exit={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, -6px, 0)' }}
					transition={reduce ? { duration: 0 } : { duration: 0.34, ease: EASE_OUT }}
					className="pt-4"
				>
					<div className="flex items-start gap-3">
						<span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.07] text-white">
							<ProductIcon name={scenario.icon} className="h-5 w-5" />
						</span>
						<div>
							<p className="text-[10px] text-white/38">{copy.agentFor}</p>
							<h2 className="mt-1 text-base font-semibold text-white">{scenario.label}</h2>
							<p className="mt-1.5 max-w-xl text-[10px] leading-5 text-white/42">{copy.agentDescription}</p>
						</div>
					</div>

					<div className="mt-4 grid gap-2 sm:grid-cols-3">
						{[
							{ label: copy.source, value: scenario.source },
							{ label: copy.action, value: scenario.action },
							{ label: copy.outcome, value: scenario.outcome },
						].map((item) => (
							<div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
								<div className="flex items-center justify-between gap-2">
									<span className="text-[9px] font-medium text-white/35">{item.label}</span>
									<Check className="h-3 w-3 text-emerald-300" aria-hidden />
								</div>
								<p className="mt-2 text-[10px] leading-5 text-white/68">{item.value}</p>
							</div>
						))}
					</div>

					<div className="mt-4 flex flex-col items-stretch justify-between gap-3 rounded-2xl bg-white p-3 text-black sm:flex-row sm:items-center">
						<div className="flex items-center gap-2">
							<span className="grid h-8 w-8 place-items-center rounded-xl bg-black text-white">
								<MessageCircleMore className="h-3.5 w-3.5" aria-hidden />
							</span>
							<div>
								<p className="text-[9px] text-black/38">{copy.channelLabel}</p>
								<p className="mt-0.5 text-[10px] font-semibold text-black">{scenario.channel}</p>
							</div>
						</div>
						<Link
							href="/login?next=/onboarding"
							className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-black px-5 text-[11px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-black/85 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2"
						>
							{copy.buildCta}
							<Arrow className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden />
						</Link>
					</div>
					<p className="mt-2 text-center text-[9px] text-white/30">{copy.continueHint}</p>
				</m.div>
			</AnimatePresence>
		</div>
	)
}

function Hero({
	locale,
	activeIndex,
	onChange,
}: {
	locale: HomeLocale
	activeIndex: number
	onChange: (index: number) => void
}) {
	const common = COMMON_COPY[locale]
	const variant = VARIANT_COPY[3][locale]
	const copy = V3_COPY[locale]
	const scenario = common.scenarios[activeIndex]

	return (
		<section className="relative overflow-hidden px-5 pb-16 pt-[104px] sm:px-8 sm:pb-20 sm:pt-28 lg:pb-24 lg:pt-32">
			<div aria-hidden className={`pointer-events-none absolute inset-0 opacity-75 ${styles.paperGrid}`} />
			<div aria-hidden className={`pointer-events-none absolute inset-0 ${styles.softHalo}`} />
			<div className="relative mx-auto max-w-7xl">
				<div className="mb-8 flex justify-center lg:justify-start">
					<VariantSwitcher variant={3} locale={locale} />
				</div>
				<div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:gap-12 xl:gap-16">
					<div className="text-center lg:text-start">
						<TrialBadge locale={locale} />
						<p className="mt-6 inline-flex items-center gap-2 text-[11px] font-semibold text-black/48">
							<Sparkles className="h-3.5 w-3.5" aria-hidden />
							{variant.kicker}
						</p>
						<h1 className="mt-4 text-[clamp(2rem,6vw,4.65rem)] font-semibold leading-[1.16] tracking-[-0.045em] text-black rtl:tracking-normal">
							<span className="block">{variant.title}</span>
							<span className="mt-1 block text-black/42">{variant.accent}</span>
						</h1>
						<p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-black/50 sm:text-base sm:leading-8 lg:mx-0">{variant.subtitle}</p>
						<div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row lg:justify-start">
							<Link
								href="/login?next=/onboarding"
								className="inline-flex min-h-12 items-center justify-center rounded-full bg-black px-6 text-sm font-semibold text-white shadow-[0_16px_42px_rgba(0,0,0,0.15)] transition-[background-color,transform] duration-150 hover:bg-black/85 active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2"
							>
								{common.primaryCta}
							</Link>
							<Link
								href="#product"
								className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-sm font-medium text-black transition-[background-color,transform] duration-150 hover:bg-black/[0.035] active:scale-[0.97] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2"
							>
								{common.secondaryCta}
							</Link>
						</div>
					</div>

					<div className="rounded-[2rem] border border-black/[0.08] bg-white/90 p-3 shadow-[0_30px_90px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:p-5">
						<div className="flex flex-col justify-between gap-2 px-1 pb-4 sm:flex-row sm:items-end">
							<div>
								<p className="text-[12px] font-semibold text-black">{copy.selectorLabel}</p>
								<p className="mt-1 text-[10px] leading-5 text-black/42">{copy.selectorHint}</p>
							</div>
							<span className="text-[9px] font-semibold text-emerald-700">{scenario.channel}</span>
						</div>
						<BusinessTabs locale={locale} scenarios={common.scenarios} activeIndex={activeIndex} onChange={onChange} idPrefix="v3-hero" />
						<SuggestedAgentPreview locale={locale} scenario={scenario} />
					</div>
				</div>
			</div>
		</section>
	)
}

function ProductOutcomeSection({
	locale,
	activeIndex,
	onChange,
}: {
	locale: HomeLocale
	activeIndex: number
	onChange: (index: number) => void
}) {
	const common = COMMON_COPY[locale]
	const copy = V3_COPY[locale]
	const scenario = common.scenarios[activeIndex]
	const Forward = locale === 'fa' ? ChevronLeft : ChevronRight

	return (
		<Reveal id="product" className="bg-white px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
			<div className="mx-auto max-w-7xl">
				<SectionHeading eyebrow={copy.productEyebrow} title={copy.productTitle} subtitle={copy.productSubtitle} />
				<div className="mx-auto mt-9 max-w-4xl">
					<BusinessTabs locale={locale} scenarios={common.scenarios} activeIndex={activeIndex} onChange={onChange} idPrefix="v3-product" />
				</div>
				<div
					id="v3-product-panel"
					role="tabpanel"
					aria-labelledby={`v3-product-tab-${scenario.id}`}
					aria-live="polite"
					className="mt-5 grid items-stretch gap-4 lg:grid-cols-[1.22fr_0.78fr]"
				>
					<RevealBlock>
						<ProductFlowDemo key={`v3-flow-${scenario.id}`} locale={locale} initialScenario={activeIndex} showScenarioTabs={false} />
					</RevealBlock>

					<RevealBlock delay={0.06} className="flex h-full flex-col rounded-[1.75rem] border border-black/[0.075] bg-[var(--bg-base)] p-5 sm:p-6">
						<div className="flex items-center justify-between gap-3">
							<span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white">
								<ProductIcon name={scenario.icon} className="h-5 w-5" />
							</span>
							<span className="rounded-full border border-black/[0.075] bg-white px-3 py-1.5 text-[9px] font-semibold text-black/45">{scenario.channel}</span>
						</div>
						<p className="mt-6 text-[10px] font-semibold text-black/38">{copy.resultLabel}</p>
						<h3 className="mt-2 text-xl font-semibold leading-8 text-black">{scenario.outcome}</h3>
						<div className="mt-6 space-y-2">
							<div className="rounded-2xl border border-black/[0.07] bg-white p-4">
								<p className="text-[9px] font-semibold text-black/35">{copy.messageLabel}</p>
								<p className="mt-2 text-[11px] leading-6 text-black/65">{scenario.message}</p>
							</div>
							<div className="rounded-2xl bg-black p-4 text-white">
								<p className="text-[9px] font-semibold text-white/38">{copy.answerLabel}</p>
								<p className="mt-2 text-[11px] leading-6 text-white/72">{scenario.answer}</p>
							</div>
						</div>
						<div className="mt-auto flex items-center gap-2 pt-6 text-[10px] font-semibold text-emerald-700">
							<Check className="h-4 w-4" aria-hidden />
							{scenario.action}
							<Forward className="ms-auto h-4 w-4" aria-hidden />
						</div>
					</RevealBlock>
				</div>
				<div className="mt-8"><ChannelPills locale={locale} /></div>
			</div>
		</Reveal>
	)
}

export function VariantThreePage({ locale, plans }: HomeVariantPageProps) {
	const [activeIndex, setActiveIndex] = useState(0)

	return (
		<div className={styles.page} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
			<Hero locale={locale} activeIndex={activeIndex} onChange={setActiveIndex} />
			<TrustRail locale={locale} />
			<ProductOutcomeSection locale={locale} activeIndex={activeIndex} onChange={setActiveIndex} />
			<CapabilitySection locale={locale} mode="matrix" />
			<OnboardingStory locale={locale} mode="console" className="bg-white" />
			<PricingPreview locale={locale} plans={plans} />
			<FaqSection locale={locale} />
			<ClosingCta locale={locale} />
		</div>
	)
}
