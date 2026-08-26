'use client'

import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { AnimatePresence, m, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Play, Sparkles, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COMMON_COPY } from './content'
import type { HomeLocale, HomeVariant, HomeVariantPageProps, PlanPreview } from './types'
import { EASE_OUT, RevealBlock } from './scroll'
import styles from '../home-variants.module.css'

/* ------------------------------------------------------------------ */
/* Headings & buttons                                                  */
/* ------------------------------------------------------------------ */

export function SectionHeading({
	eyebrow,
	title,
	subtitle,
	align = 'center',
	inverse = false,
	className,
}: {
	eyebrow: string
	title: ReactNode
	subtitle?: ReactNode
	align?: 'center' | 'start'
	inverse?: boolean
	className?: string
}) {
	return (
		<header className={cn(align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl text-start', className)}>
			<span
				className={cn(
					'inline-flex min-h-8 items-center gap-2 rounded-full border px-3.5 text-[10px] font-semibold tracking-[0.02em]',
					inverse ? 'border-white/14 bg-white/[0.055] text-white/55' : 'border-black/[0.08] bg-white text-black/50',
				)}
			>
				<span className={cn('h-1.5 w-1.5 rounded-full', inverse ? 'bg-emerald-300' : 'bg-emerald-500')} />
				{eyebrow}
			</span>
			<h2 className={cn('mt-5 text-[clamp(1.75rem,5vw,3.5rem)] font-semibold leading-[1.3] tracking-[-0.035em] rtl:tracking-normal', inverse ? 'text-white' : 'text-black')}>
				{title}
			</h2>
			{subtitle ? (
				<p className={cn('mt-4 text-sm leading-8 sm:text-base', inverse ? 'text-white/50' : 'text-black/50')}>{subtitle}</p>
			) : null}
		</header>
	)
}

export function CtaButton({
	locale,
	inverse = false,
	href = '/login?next=/onboarding',
	size = 'md',
	label,
	className,
}: {
	locale: HomeLocale
	inverse?: boolean
	href?: string
	size?: 'md' | 'lg'
	label?: string
	className?: string
}) {
	const copy = COMMON_COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
	return (
		<Link
			href={href}
			className={cn(
				'group inline-flex items-center justify-center gap-2 rounded-full font-semibold shadow-[0_16px_42px_rgba(0,0,0,0.16)] transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.22)]',
				size === 'lg' ? 'min-h-14 px-8 text-[15px]' : 'min-h-12 px-6 text-sm',
				inverse ? 'bg-white text-black hover:bg-white/90' : 'bg-black text-white hover:bg-black/85',
				className,
			)}
		>
			{label ?? copy.primaryCta}
			<Arrow aria-hidden className="h-4 w-4 transition-transform duration-200 ltr:group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
		</Link>
	)
}

export function SecondaryButton({
	locale,
	inverse = false,
	href = '#product',
	label,
	className,
}: {
	locale: HomeLocale
	inverse?: boolean
	href?: string
	label?: string
	className?: string
}) {
	const copy = COMMON_COPY[locale]
	return (
		<Link
			href={href}
			className={cn(
				'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 text-sm font-medium transition-[background-color,border-color,transform] duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2',
				inverse
					? 'border-white/18 bg-white/[0.06] text-white hover:bg-white/12'
					: 'border-black/10 bg-white text-black hover:bg-black/[0.04]',
				className,
			)}
		>
			<Play aria-hidden className="h-3.5 w-3.5 fill-current" />
			{label ?? copy.secondaryCta}
		</Link>
	)
}

export function HeroActions({ locale, inverse = false, secondaryHref = '#product' }: { locale: HomeLocale; inverse?: boolean; secondaryHref?: string }) {
	return (
		<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
			<CtaButton locale={locale} inverse={inverse} size="lg" />
			<SecondaryButton locale={locale} inverse={inverse} href={secondaryHref} />
		</div>
	)
}

export function TrialBadge({ locale, inverse = false }: { locale: HomeLocale; inverse?: boolean }) {
	return (
		<span
			className={cn(
				'inline-flex min-h-9 items-center gap-2.5 rounded-full border px-4 text-[11px] font-medium shadow-[0_7px_24px_rgba(0,0,0,0.05)]',
				inverse ? 'border-white/15 bg-white/[0.07] text-white/70' : 'border-black/[0.08] bg-white/85 text-black/60',
			)}
		>
			<span className={cn('livePulse h-2 w-2 rounded-full', inverse ? 'bg-emerald-300 text-emerald-300' : 'bg-emerald-500 text-emerald-500')} />
			{COMMON_COPY[locale].trialBadge}
		</span>
	)
}

/* ------------------------------------------------------------------ */
/* Floating variant dock — quick 1..5 comparison                       */
/* ------------------------------------------------------------------ */

export function VariantDock({ variant, locale }: { variant: HomeVariant; locale: HomeLocale }) {
	const copy = COMMON_COPY[locale]
	return (
		<nav
			aria-label={copy.compareLabel}
			className="fixed bottom-4 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-black/10 bg-white/85 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl"
		>
			<div className="flex items-center gap-1">
				<span className="hidden min-[420px]:block ps-2.5 pe-1 text-[10px] font-semibold text-black/40">
					{locale === 'fa' ? 'نسخه' : 'Concept'}
				</span>
				{([1, 2, 3, 4, 5] as HomeVariant[]).map((item) => (
					<Link
						key={item}
						href={`/${item}`}
						aria-current={item === variant ? 'page' : undefined}
						className={cn(
							'grid h-9 w-9 place-items-center rounded-full text-[12px] font-bold transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]',
							item === variant ? 'bg-black text-white shadow-[0_8px_20px_rgba(0,0,0,0.25)]' : 'text-black/45 hover:bg-black/[0.06] hover:text-black',
						)}
					>
						{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(item) : item}
					</Link>
				))}
			</div>
		</nav>
	)
}

/* ------------------------------------------------------------------ */
/* Trust marquee                                                       */
/* ------------------------------------------------------------------ */

export function TrustRail({ locale, inverse = false }: { locale: HomeLocale; inverse?: boolean }) {
	const items = COMMON_COPY[locale].proofs
	const repeated = [...items, ...items]
	return (
		<div
			className={cn(styles.fadeEdges, 'overflow-hidden border-y py-3.5', inverse ? 'border-white/10 bg-white/[0.025]' : 'border-black/[0.07] bg-white/45')}
			aria-label={locale === 'fa' ? 'مزیت‌های شروع ویجنت' : 'Why start with Vigent'}
		>
			<div className={styles.marqueeTrack}>
				{repeated.map((item, index) => (
					<span
						key={`${item}-${index}`}
						aria-hidden={index >= items.length}
						className={cn('flex shrink-0 items-center gap-2 px-7 text-[11.5px] font-medium sm:px-10', inverse ? 'text-white/55' : 'text-black/55')}
					>
						<Check className={cn('h-3.5 w-3.5', inverse ? 'text-emerald-300' : 'text-emerald-600')} aria-hidden />
						{item}
					</span>
				))}
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Onboarding — scroll-scrubbed vertical timeline                       */
/* ------------------------------------------------------------------ */

function OnboardingStep({
	index,
	total,
	progress,
	inverse,
	locale,
	step,
	compact = false,
}: {
	index: number
	total: number
	progress: MotionValue<number>
	inverse: boolean
	locale: HomeLocale
	step: { title: string; description: string; result: string; duration: string }
	compact?: boolean
}) {
	const reduce = useReducedMotion()
	const threshold = index / total
	const gate = useTransform(progress, [Math.max(0, threshold - 0.08), threshold + 0.05], [0, 1])
	const smooth = useSpring(gate, { stiffness: 120, damping: 22 })
	const scale = useTransform(smooth, [0, 1], [0.8, 1])
	const y = useTransform(smooth, [0, 1], reduce ? [0, 0] : [18, 0])
	const fa = locale === 'fa'
	return (
		<div className="relative grid grid-cols-[44px_1fr] gap-4 sm:grid-cols-[56px_1fr] sm:gap-6">
			<div className="relative flex justify-center">
				<m.span
					style={{ scale: reduce ? 1 : scale, opacity: smooth }}
					className={cn(
						'top-1 sticky grid h-11 w-11 place-items-center rounded-2xl text-[13px] font-bold transition-colors sm:h-14 sm:w-14 sm:text-base',
						inverse ? 'bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.45)]' : 'bg-black text-white shadow-[0_14px_36px_rgba(0,0,0,0.22)]',
					)}
				>
					{fa ? new Intl.NumberFormat('fa-IR').format(index + 1) : index + 1}
				</m.span>
			</div>
			<m.div
				style={{ opacity: smooth, y }}
				className={cn(
					'rounded-[1.4rem] border p-5 sm:p-6',
					inverse ? 'border-white/12 bg-white/[0.05]' : 'border-black/[0.08] bg-white shadow-[0_14px_44px_rgba(0,0,0,0.06)]',
				)}
			>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h3 className={cn('text-[15px] font-semibold sm:text-lg', inverse ? 'text-white' : 'text-black')}>{step.title}</h3>
					<span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold', inverse ? 'bg-emerald-300/12 text-emerald-300' : 'bg-emerald-50 text-emerald-700')}>
						<Timer className="h-3 w-3" aria-hidden />
						{step.duration}
					</span>
				</div>
				<p className={cn('mt-2.5 text-[13px] leading-7', inverse ? 'text-white/50' : 'text-black/52')}>{step.description}</p>
				{compact ? null : (
					<p className={cn('mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-semibold', inverse ? 'text-emerald-300' : 'text-emerald-700')}>
						<Check className="h-4 w-4" aria-hidden />
						{step.result}
					</p>
				)}
			</m.div>
		</div>
	)
}

export function OnboardingTimeline({
	locale,
	inverse = false,
	className,
	id = 'vigento',
}: {
	locale: HomeLocale
	inverse?: boolean
	className?: string
	id?: string
}) {
	const copy = COMMON_COPY[locale]
	const ref = useRef<HTMLDivElement>(null)
	const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.55'] })
	const lineScale = useSpring(scrollYProgress, { stiffness: 90, damping: 24 })
	return (
		<section id={id} className={cn('marketing-story-section relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28', inverse ? 'bg-[#070707] text-white' : 'bg-[var(--bg-base)]', className)}>
			<div className="mx-auto max-w-4xl">
				<SectionHeading
					eyebrow={copy.onboardingEyebrow}
					title={copy.onboardingTitle}
					subtitle={copy.onboardingSubtitle}
					inverse={inverse}
				/>
				<div ref={ref} className="relative mt-12 space-y-5 sm:mt-16 sm:space-y-7">
					<div aria-hidden className={cn('absolute bottom-6 start-[22px] top-6 w-[2px] rounded-full sm:start-[27px]', inverse ? 'bg-white/10' : 'bg-black/[0.08]')} />
					<m.div
						aria-hidden
						style={{ scaleY: lineScale }}
						className={cn('absolute bottom-6 start-[22px] top-6 w-[2px] origin-top rounded-full sm:start-[27px]', inverse ? 'bg-emerald-300' : 'bg-emerald-500')}
					/>
					{copy.onboardingSteps.map((step, index) => (
						<OnboardingStep
							key={step.title}
							index={index}
							total={copy.onboardingSteps.length}
							progress={scrollYProgress}
							inverse={inverse}
							locale={locale}
							step={step}
						/>
					))}
				</div>
				<RevealBlock className="mt-10 flex justify-center">
					<HeroActions locale={locale} inverse={inverse} secondaryHref="#pricing" />
				</RevealBlock>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------ */
/* Pricing                                                             */
/* ------------------------------------------------------------------ */

function PlanCard({ plan, locale, inverse }: { plan: PlanPreview; locale: HomeLocale; inverse?: boolean }) {
	const copy = COMMON_COPY[locale]
	const featured = plan.featured
	return (
		<div
			className={cn(
				'relative flex h-full flex-col rounded-[1.55rem] border p-6 transition-transform duration-300 hover:-translate-y-1.5 sm:p-7',
				featured
					? 'border-black bg-black text-white shadow-[0_25px_70px_rgba(0,0,0,0.22)]'
					: inverse
						? 'border-white/12 bg-white/[0.05] text-white'
						: 'border-black/[0.08] bg-white text-black shadow-[0_14px_44px_rgba(0,0,0,0.06)]',
			)}
		>
			{featured ? (
				<span className="absolute -top-3.5 start-6 rounded-full bg-emerald-300 px-3.5 py-1.5 text-[10px] font-bold text-emerald-950 shadow-[0_8px_20px_rgba(52,211,153,0.4)]">
					{locale === 'fa' ? 'پیشنهاد ویجنت' : 'Recommended'}
				</span>
			) : null}
			<p className={cn('text-[15px] font-semibold', featured ? 'text-white' : inverse ? 'text-white' : 'text-black')}>{plan.name}</p>
			<p className={cn('mt-2 min-h-12 text-[11.5px] leading-6', featured || inverse ? 'text-white/48' : 'text-black/48')}>{plan.audience}</p>
			<div className="mt-5 flex items-baseline gap-2">
				<strong className="text-[28px] font-semibold tabular-nums sm:text-[32px]">{plan.price}</strong>
				<span className={cn('text-[11px]', featured || inverse ? 'text-white/45' : 'text-black/45')}>{copy.pricingMonthly}</span>
			</div>
			<ul className={cn('mt-6 flex-1 space-y-3.5 text-[12px] leading-6', featured || inverse ? 'text-white/80' : 'text-black/75')}>
				<li className="flex items-start gap-2.5">
					<Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
					{plan.maxChannels} {copy.pricingChannels}
				</li>
				<li className="flex items-start gap-2.5">
					<Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
					{plan.includedCredit} {copy.pricingCredit}
				</li>
				<li className="flex items-start gap-2.5">
					<Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
					{plan.replyPrice} {copy.pricingReplyPrice}
				</li>
				<li className="flex items-start gap-2.5">
					<Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
					{copy.pricingAllFeatures}
				</li>
			</ul>
			<Link
				href={`/login?plan=${plan.key}`}
				className={cn(
					'mt-7 inline-flex min-h-12 items-center justify-center rounded-full px-4 text-[12.5px] font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2',
					featured ? 'bg-white text-black hover:bg-white/90' : inverse ? 'bg-white text-black hover:bg-white/90' : 'bg-black text-white hover:bg-black/85',
				)}
			>
				{copy.pricingPlanCta}
			</Link>
		</div>
	)
}

export function PricingSection({ locale, plans, className, inverse = false, id = 'pricing' }: HomeVariantPageProps & { className?: string; inverse?: boolean; id?: string }) {
	const copy = COMMON_COPY[locale]
	const fa = locale === 'fa'
	return (
		<section id={id} className={cn('marketing-story-section px-5 py-20 sm:px-8 sm:py-28', inverse ? 'bg-[#070707] text-white' : 'bg-white', className)}>
			<div className="mx-auto max-w-7xl">
				<SectionHeading eyebrow={copy.pricingEyebrow} title={copy.pricingTitle} subtitle={copy.pricingSubtitle} inverse={inverse} />
				<RevealBlock className="mx-auto mt-12 max-w-4xl">
					<div className={cn('flex flex-col items-center justify-between gap-5 rounded-[1.6rem] bg-black p-6 text-center text-white shadow-[0_24px_70px_rgba(0,0,0,0.2)] sm:flex-row sm:p-7 sm:text-start', inverse && 'border border-white/10')}>
						<div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
							<span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-black">
								<Sparkles className="h-5 w-5" aria-hidden />
							</span>
							<div>
								<h3 className="text-lg font-semibold">{copy.pricingTrialTitle}</h3>
								<p className="mt-1.5 max-w-xl text-[12px] leading-6 text-white/55">{copy.pricingTrialDescription}</p>
							</div>
						</div>
						<CtaButton locale={locale} inverse />
					</div>
				</RevealBlock>
				<div className="mt-5 grid gap-4 md:grid-cols-3">
					{plans.map((plan, index) => (
						<RevealBlock key={plan.key} delay={index * 0.08} className="h-full">
							<PlanCard plan={plan} locale={locale} inverse={inverse} />
						</RevealBlock>
					))}
				</div>
				<RevealBlock className="mx-auto mt-6 max-w-2xl text-center">
					<p className={cn('text-[11px] leading-7', inverse ? 'text-white/40' : 'text-black/45')}>
						{fa
							? 'اعتبار پاسخ از اشتراک جداست، منقضی نمی‌شود و فقط بعد از پاسخ موفق کم می‌شود. اتوماسیون ثابت اینستاگرام رایگان است.'
							: 'Reply credit is separate from the subscription, never expires and is deducted only after a successful reply. Deterministic Instagram automation is free.'}
					</p>
				</RevealBlock>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------ */
/* FAQ — animated accordion                                            */
/* ------------------------------------------------------------------ */

function FaqItem({ question, answer, inverse, defaultOpen = false }: { question: string; answer: string; inverse: boolean; defaultOpen?: boolean }) {
	const [open, setOpen] = useState(defaultOpen)
	return (
		<div className={cn('rounded-2xl border transition-colors', inverse ? 'border-white/10' : 'border-black/[0.07]', open && (inverse ? 'bg-white/[0.04]' : 'bg-black/[0.02]'))}>
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				aria-expanded={open}
				className={cn(
					'flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 px-5 text-start text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]',
					inverse ? 'text-white' : 'text-black',
				)}
			>
				{question}
				<m.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="shrink-0">
					<ChevronDown className={cn('h-4 w-4', inverse ? 'text-white/50' : 'text-black/45')} aria-hidden />
				</m.span>
			</button>
			<AnimatePresence initial={false}>
				{open ? (
					<m.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.36, ease: EASE_OUT }}
						className="overflow-hidden"
					>
						<p className={cn('px-5 pb-5 text-[12.5px] leading-8', inverse ? 'text-white/50' : 'text-black/52')}>{answer}</p>
					</m.div>
				) : null}
			</AnimatePresence>
		</div>
	)
}

export function FaqSection({ locale, inverse = false, className }: { locale: HomeLocale; inverse?: boolean; className?: string }) {
	const copy = COMMON_COPY[locale]
	return (
		<section className={cn('marketing-story-section px-5 py-20 sm:px-8 sm:py-28', inverse ? 'bg-[#070707] text-white' : 'bg-[var(--bg-base)]', className)}>
			<div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
				<SectionHeading eyebrow={copy.faqEyebrow} title={copy.faqTitle} align="start" inverse={inverse} />
				<div className="space-y-3">
					{copy.faqs.map((item, index) => (
						<RevealBlock key={item.question} delay={index * 0.05}>
							<FaqItem question={item.question} answer={item.answer} inverse={inverse} defaultOpen={index === 0} />
						</RevealBlock>
					))}
				</div>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------ */
/* Closing CTA                                                         */
/* ------------------------------------------------------------------ */

export function ClosingCta({ locale, inverse = true, className }: { locale: HomeLocale; inverse?: boolean; className?: string }) {
	const copy = COMMON_COPY[locale]
	return (
		<section className={cn('px-5 pb-24 pt-8 sm:px-8', className)}>
			<div
				className={cn(
					'relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border px-6 py-16 text-center shadow-[0_28px_90px_rgba(0,0,0,0.18)] sm:px-10 sm:py-24',
					inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/[0.08] bg-white text-black',
				)}
			>
				<div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-65', inverse ? styles.darkGrid : styles.paperGrid)} />
				<div aria-hidden className={cn('pointer-events-none absolute inset-0', inverse ? styles.darkHalo : styles.softHalo)} />
				<m.div
					aria-hidden
					className="pointer-events-none absolute -top-32 start-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[110px]"
					animate={{ opacity: [0.5, 0.9, 0.5] }}
					transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
				/>
				<div className="relative mx-auto max-w-3xl">
					<span className={cn('text-[10px] font-semibold tracking-[0.04em]', inverse ? 'text-emerald-200/80' : 'text-emerald-700')}>{copy.closingEyebrow}</span>
					<h2 className="mt-5 text-[clamp(1.9rem,5vw,4rem)] font-semibold leading-[1.28] tracking-[-0.035em] rtl:tracking-normal">{copy.closingTitle}</h2>
					<p className={cn('mx-auto mt-5 max-w-2xl text-sm leading-8 sm:text-base', inverse ? 'text-white/50' : 'text-black/50')}>{copy.closingDescription}</p>
					<div className="mt-9 flex justify-center">
						<HeroActions locale={locale} inverse={inverse} secondaryHref="#product" />
					</div>
				</div>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------ */
/* Shared section shell                                                */
/* ------------------------------------------------------------------ */

export function StorySection({
	id,
	children,
	inverse = false,
	className,
}: {
	id?: string
	children: ReactNode
	inverse?: boolean
	className?: string
}) {
	return (
		<section
			id={id}
			className={cn('marketing-story-section relative px-5 py-20 sm:px-8 sm:py-28', inverse ? 'bg-[#070707] text-white' : 'bg-[var(--bg-base)]', className)}
		>
			{children}
		</section>
	)
}

export { useMotionValueEvent }
