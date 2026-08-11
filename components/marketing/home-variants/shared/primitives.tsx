'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m, useInView, useReducedMotion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
	ArrowLeft,
	ArrowRight,
	BarChart3,
	BookOpenCheck,
	Bot,
	Box,
	BriefcaseBusiness,
	CalendarCheck2,
	Check,
	CheckCircle2,
	ChevronDown,
	CircleDollarSign,
	GraduationCap,
	MessageCircleMore,
	MessagesSquare,
	PackageCheck,
	Play,
	PlugZap,
	ShoppingBag,
	Sparkles,
	Store,
	UtensilsCrossed,
	UsersRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { InstagramIcon } from '@/components/marketing/social-links'
import styles from '../home-variants.module.css'
import { COMMON_COPY } from './content'
import type { HomeLocale, HomeVariant, HomeVariantPageProps, PlanPreview } from './types'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const

const ICONS: Record<string, LucideIcon> = {
	book: BookOpenCheck,
	box: Box,
	messages: MessagesSquare,
	users: UsersRound,
	store: Store,
	calendar: CalendarCheck2,
	utensils: UtensilsCrossed,
	briefcase: BriefcaseBusiness,
	graduation: GraduationCap,
}

export function ProductIcon({ name, className }: { name: string; className?: string }) {
	const Icon = ICONS[name] ?? Sparkles
	return <Icon aria-hidden className={className} />
}

export function Reveal({
	children,
	className,
	id,
	delay = 0,
	dark = false,
	amount = 0.12,
}: {
	children: ReactNode
	className?: string
	id?: string
	delay?: number
	dark?: boolean
	amount?: number
}) {
	const reduce = useReducedMotion()
	return (
		<m.section
			id={id}
			className={cn('marketing-story-section scroll-mt-24', className)}
			initial={reduce ? false : { opacity: 0, transform: 'translate3d(0, 26px, 0)' }}
			whileInView={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
			viewport={{ once: true, amount }}
			transition={reduce ? { duration: 0 } : { duration: 0.58, delay, ease: EASE_OUT }}
			data-theme={dark ? 'dark' : 'light'}
		>
			{children}
		</m.section>
	)
}

export function RevealBlock({
	children,
	className,
	delay = 0,
}: {
	children: ReactNode
	className?: string
	delay?: number
}) {
	const reduce = useReducedMotion()
	return (
		<m.div
			className={className}
			initial={reduce ? false : { opacity: 0, transform: 'translate3d(0, 18px, 0)' }}
			whileInView={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
			viewport={{ once: true, amount: 0.22 }}
			transition={reduce ? { duration: 0 } : { duration: 0.46, delay, ease: EASE_OUT }}
		>
			{children}
		</m.div>
	)
}

export function VariantSwitcher({
	variant,
	locale,
	inverse = false,
}: {
	variant: HomeVariant
	locale: HomeLocale
	inverse?: boolean
}) {
	const copy = COMMON_COPY[locale]
	return (
		<nav aria-label={copy.compareLabel} className="inline-flex flex-wrap items-center justify-center gap-1.5">
			<span className={cn('me-1 hidden text-[11px] font-medium min-[360px]:inline', inverse ? 'text-white/45' : 'text-black/45')}>
				{locale === 'fa' ? 'نسخه' : 'Concept'}
			</span>
			{([1, 2, 3, 4, 5] as HomeVariant[]).map((item) => (
				<Link
					key={item}
					href={`/${item}`}
					aria-current={item === variant ? 'page' : undefined}
					className={cn(
						'inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-[11px] font-semibold transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2',
						item === variant
							? inverse
								? 'border-white bg-white text-black'
								: 'border-black bg-black text-white'
							: inverse
								? 'border-white/15 bg-white/[0.055] text-white/55 hover:bg-white/10 hover:text-white'
								: 'border-black/10 bg-white/75 text-black/45 hover:bg-white hover:text-black',
					)}
				>
					{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(item) : item}
				</Link>
			))}
		</nav>
	)
}

export function HeroActions({
	locale,
	inverse = false,
	secondaryHref = '#product',
}: {
	locale: HomeLocale
	inverse?: boolean
	secondaryHref?: string
}) {
	const copy = COMMON_COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
	return (
		<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
			<Link
				href="/login?next=/onboarding"
				className={cn(
					'group inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold shadow-[0_16px_42px_rgba(0,0,0,0.15)] transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2',
					inverse ? 'bg-white text-black hover:bg-white/90' : 'bg-black text-white hover:bg-black/85',
				)}
			>
				{copy.primaryCta}
				<Arrow aria-hidden className="h-4 w-4 transition-transform duration-150 group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
			</Link>
			<Link
				href={secondaryHref}
				className={cn(
					'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 text-sm font-medium transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2',
					inverse
						? 'border-white/18 bg-white/[0.06] text-white hover:bg-white/10'
						: 'border-black/10 bg-white text-black hover:bg-black/[0.035]',
				)}
			>
				<Play aria-hidden className="h-3.5 w-3.5 fill-current" />
				{copy.secondaryCta}
			</Link>
		</div>
	)
}

export function TrialBadge({ locale, inverse = false }: { locale: HomeLocale; inverse?: boolean }) {
	return (
		<span
			className={cn(
				'inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[11px] font-medium shadow-[0_7px_24px_rgba(0,0,0,0.045)]',
				inverse ? 'border-white/15 bg-white/[0.07] text-white/65' : 'border-black/[0.08] bg-white/85 text-black/55',
			)}
		>
			<span className={cn('h-2 w-2 rounded-full', styles.livePulse, inverse ? 'bg-emerald-300 text-emerald-300' : 'bg-emerald-500 text-emerald-500')} />
			{COMMON_COPY[locale].trialBadge}
		</span>
	)
}

export function TrustRail({ locale, inverse = false }: { locale: HomeLocale; inverse?: boolean }) {
	const items = COMMON_COPY[locale].proofs
	const repeated = [...items, ...items]
	return (
		<div
			className={cn(
				styles.fadeEdges,
				'overflow-hidden border-y py-3',
				inverse ? 'border-white/10 bg-white/[0.025]' : 'border-black/[0.07] bg-white/45',
			)}
			aria-label={locale === 'fa' ? 'مزیت‌های شروع ویجنت' : 'Why start with Vigent'}
		>
			<div className={styles.marqueeTrack}>
				{repeated.map((item, index) => (
					<span
						key={`${item}-${index}`}
						aria-hidden={index >= items.length}
						className={cn(
							'flex shrink-0 items-center gap-2 px-6 text-[11px] font-medium sm:px-9',
							inverse ? 'text-white/55' : 'text-black/50',
						)}
					>
						<Check className={cn('h-3.5 w-3.5', inverse ? 'text-emerald-300' : 'text-emerald-600')} aria-hidden />
						{item}
					</span>
				))}
			</div>
		</div>
	)
}

export function SectionHeading({
	eyebrow,
	title,
	subtitle,
	align = 'center',
	inverse = false,
	className,
}: {
	eyebrow: string
	title: string
	subtitle?: string
	align?: 'center' | 'start'
	inverse?: boolean
	className?: string
}) {
	return (
		<header className={cn(align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl text-start', className)}>
			<span
				className={cn(
					'inline-flex min-h-8 items-center rounded-full border px-3 text-[10px] font-semibold tracking-[0.02em]',
					inverse ? 'border-white/14 bg-white/[0.055] text-white/48' : 'border-black/[0.08] bg-white text-black/45',
				)}
			>
				{eyebrow}
			</span>
			<h2 className={cn('mt-4 text-[clamp(1.65rem,5vw,3.45rem)] font-semibold leading-[1.25] tracking-[-0.035em] rtl:tracking-normal', inverse ? 'text-white' : 'text-black')}>
				{title}
			</h2>
			{subtitle ? (
				<p className={cn('mt-4 text-sm leading-7 sm:text-base sm:leading-8', inverse ? 'text-white/48' : 'text-black/50')}>
					{subtitle}
				</p>
			) : null}
		</header>
	)
}

type FlowDemoProps = {
	locale: HomeLocale
	initialScenario?: number
	compact?: boolean
	inverse?: boolean
	showScenarioTabs?: boolean
	className?: string
}

export function ProductFlowDemo({
	locale,
	initialScenario = 0,
	compact = false,
	inverse = true,
	showScenarioTabs = true,
	className,
}: FlowDemoProps) {
	const copy = COMMON_COPY[locale]
	const [scenarioIndex, setScenarioIndex] = useState(initialScenario)
	const [stage, setStage] = useState(0)
	const [paused, setPaused] = useState(false)
	const reduce = useReducedMotion()
	const rootRef = useRef<HTMLDivElement>(null)
	const inView = useInView(rootRef, { amount: 0.28 })
	const scenario = copy.scenarios[scenarioIndex]
	const stepLabels = locale === 'fa'
		? ['پیام', 'منبع', 'پاسخ', 'اقدام', 'نتیجه']
		: ['Message', 'Source', 'Answer', 'Action', 'Outcome']

	useEffect(() => {
		if (reduce || paused || !inView || document.visibilityState === 'hidden') return
		const timer = window.setInterval(() => {
			setStage((current) => {
				if (current < 4) return current + 1
				setScenarioIndex((value) => (value + 1) % copy.scenarios.length)
				return 0
			})
		}, 1900)
		return () => window.clearInterval(timer)
	}, [copy.scenarios.length, inView, paused, reduce])

	const stageContent = useMemo(
		() => [
			{ label: scenario.channel, value: scenario.message, icon: MessageCircleMore },
			{ label: locale === 'fa' ? 'منبع معتبر پیدا شد' : 'Trusted source found', value: scenario.source, icon: BookOpenCheck },
			{ label: locale === 'fa' ? 'پاسخ ایجنت' : 'Agent reply', value: scenario.answer, icon: Bot },
			{ label: locale === 'fa' ? 'اقدام بعدی' : 'Next action', value: scenario.action, icon: PackageCheck },
			{ label: locale === 'fa' ? 'ثبت در عملیات' : 'Recorded outcome', value: scenario.outcome, icon: CheckCircle2 },
		],
		[locale, scenario],
	)
	const active = stageContent[stage]
	const ActiveIcon = active.icon

	return (
		<div
			ref={rootRef}
			className={cn(
				'relative min-w-0 w-full overflow-hidden rounded-[1.75rem] border p-3 shadow-[0_28px_85px_rgba(0,0,0,0.18)] sm:p-4',
				inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/10 bg-white text-black',
				className,
			)}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocusCapture={() => setPaused(true)}
			onBlurCapture={() => setPaused(false)}
			dir={locale === 'fa' ? 'rtl' : 'ltr'}
		>
			<div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-60', inverse ? styles.darkGrid : styles.paperGrid)} />
			{inverse ? <div aria-hidden className={cn('pointer-events-none absolute inset-0', styles.darkHalo)} /> : null}
			<div className="relative">
				<div className={cn('flex items-center justify-between gap-3 border-b pb-3', inverse ? 'border-white/10' : 'border-black/[0.07]')}>
					<div className="flex min-w-0 items-center gap-2.5">
						<span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', inverse ? 'bg-white text-black' : 'bg-black text-white')}>
							<Bot className="h-4 w-4" aria-hidden />
						</span>
						<div className="min-w-0">
							<p className={cn('truncate text-[11px] font-semibold', inverse ? 'text-white' : 'text-black')}>
								{locale === 'fa' ? 'مسیر زندهٔ یک پیام' : 'Live message trace'}
							</p>
							<p className={cn('mt-0.5 truncate text-[10px]', inverse ? 'text-white/40' : 'text-black/40')}>
								{scenario.person} · {scenario.channel}
							</p>
						</div>
					</div>
					<span className={cn('inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium', inverse ? 'bg-emerald-300/10 text-emerald-200' : 'bg-emerald-50 text-emerald-700')}>
						<span className={cn('h-1.5 w-1.5 rounded-full bg-current', styles.livePulse)} />
						{locale === 'fa' ? 'زنده' : 'Live'}
					</span>
				</div>

				{showScenarioTabs ? (
					<div className="mt-3 grid grid-cols-5 gap-1.5" role="tablist" aria-label={locale === 'fa' ? 'سناریوی دمو' : 'Demo scenario'}>
						{copy.scenarios.map((item, index) => (
							<button
								key={item.id}
								type="button"
								role="tab"
								aria-selected={index === scenarioIndex}
								onClick={() => {
									setScenarioIndex(index)
									setStage(0)
								}}
								className={cn(
									'min-h-12 rounded-xl border px-1 py-1.5 text-center transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]',
									index === scenarioIndex
										? inverse
											? 'border-white bg-white text-black'
											: 'border-black bg-black text-white'
										: inverse
											? 'border-white/10 bg-white/[0.04] text-white/45 hover:bg-white/[0.075] hover:text-white/75'
											: 'border-black/[0.08] bg-black/[0.025] text-black/45 hover:bg-black/[0.05] hover:text-black',
								)}
							>
								<ProductIcon name={item.icon} className="mx-auto h-3.5 w-3.5" />
								<span className="mt-1 block truncate text-[10px] font-medium">{item.label}</span>
							</button>
						))}
					</div>
				) : null}

				<div className={cn('mt-3 grid gap-3', compact ? '' : 'sm:grid-cols-[0.72fr_1.28fr]')}>
					<div className={cn('rounded-2xl border p-3.5', inverse ? 'border-white/10 bg-white/[0.045]' : 'border-black/[0.07] bg-black/[0.025]')}>
						<p className={cn('text-[10px] font-medium', inverse ? 'text-white/35' : 'text-black/38')}>
							{locale === 'fa' ? 'پیام ورودی' : 'Incoming message'}
						</p>
						<div className="mt-3 flex items-start gap-2.5">
							<span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-bold', inverse ? 'bg-white/10 text-white' : 'bg-black/10 text-black')}>
								{scenario.person.slice(0, 1)}
							</span>
							<div>
								<p className={cn('text-[10px] font-semibold', inverse ? 'text-white/70' : 'text-black/65')}>{scenario.person}</p>
								<p className={cn('mt-1.5 text-[11px] leading-6', inverse ? 'text-white/82' : 'text-black/75')}>{scenario.message}</p>
							</div>
						</div>
					</div>

					<div className={cn('relative min-h-[164px] overflow-hidden rounded-2xl border p-4', inverse ? 'border-white/12 bg-white text-black' : 'border-black/[0.08] bg-black text-white')}>
						<div className="flex items-center justify-between gap-3">
							<span className={cn('grid h-9 w-9 place-items-center rounded-xl', inverse ? 'bg-black text-white' : 'bg-white text-black')}>
								<ActiveIcon className="h-4 w-4" aria-hidden />
							</span>
							<span className={cn('text-[10px] font-semibold tabular-nums', inverse ? 'text-black/35' : 'text-white/42')}>
								{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(stage + 1) : stage + 1} / 5
							</span>
						</div>
						<AnimatePresence mode="wait" initial={false}>
							<m.div
								key={`${scenario.id}-${stage}`}
								initial={reduce ? false : { opacity: 0, transform: 'translate3d(0, 8px, 0)', filter: 'blur(2px)' }}
								animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)', filter: 'blur(0px)' }}
								exit={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, -5px, 0)', filter: 'blur(2px)' }}
								transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE_OUT }}
								className="mt-4"
							>
								<p className={cn('text-[10px] font-semibold', inverse ? 'text-black/40' : 'text-white/45')}>{active.label}</p>
								<p className={cn('mt-1.5 text-[12px] font-medium leading-6 sm:text-[13px]', inverse ? 'text-black/78' : 'text-white/82')}>{active.value}</p>
							</m.div>
						</AnimatePresence>
					</div>
				</div>

				<div className="mt-3 grid grid-cols-5 gap-1.5" aria-label={locale === 'fa' ? 'مراحل پردازش پیام' : 'Message processing stages'}>
					{stepLabels.map((label, index) => (
						<button
							key={label}
							type="button"
							onClick={() => setStage(index)}
							aria-current={index === stage ? 'step' : undefined}
							className={cn(
								'relative min-h-10 overflow-hidden rounded-lg px-1 text-[10px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]',
								index <= stage
									? inverse ? 'bg-emerald-300/12 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
									: inverse ? 'bg-white/[0.04] text-white/30' : 'bg-black/[0.035] text-black/32',
							)}
						>
							{label}
							{index === stage && !reduce ? <span className={cn('absolute inset-x-0 bottom-0 h-0.5 bg-emerald-400', styles.progressSweep)} /> : null}
						</button>
					))}
				</div>
			</div>
		</div>
	)
}

export function CapabilitySection({
	locale,
	mode = 'bento',
	inverse = false,
	className,
}: {
	locale: HomeLocale
	mode?: 'bento' | 'stack' | 'matrix'
	inverse?: boolean
	className?: string
}) {
	const copy = COMMON_COPY[locale]
	return (
		<Reveal id="solutions" className={cn('px-5 py-20 sm:px-8 sm:py-24 lg:py-28', inverse ? 'bg-[#070707] text-white' : 'bg-[var(--bg-base)]', className)} dark={inverse}>
			<div className="mx-auto max-w-7xl">
				<SectionHeading eyebrow={copy.pillarsEyebrow} title={copy.pillarsTitle} subtitle={copy.pillarsSubtitle} inverse={inverse} />
				<div className={cn('mt-10 grid gap-3 sm:mt-14', mode === 'stack' ? 'lg:grid-cols-2' : mode === 'matrix' ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-12')}>
					{copy.pillars.map((pillar, index) => (
						<RevealBlock
							key={pillar.title}
							delay={index * 0.055}
							className={cn(
								'group relative overflow-hidden rounded-[1.65rem] border p-5 sm:p-6',
								inverse ? 'border-white/10 bg-white/[0.045]' : 'border-black/[0.075] bg-white shadow-[0_12px_42px_rgba(0,0,0,0.045)]',
								mode === 'bento' && (index === 0 || index === 3 ? 'lg:col-span-7' : 'lg:col-span-5'),
							)}
						>
							<div className="flex items-start justify-between gap-4">
								<span className={cn('grid h-11 w-11 place-items-center rounded-2xl', inverse ? 'bg-white text-black' : 'bg-black text-white')}>
									<ProductIcon name={pillar.icon} className="h-5 w-5" />
								</span>
								<span className={cn('text-[10px] font-semibold tabular-nums', inverse ? 'text-white/25' : 'text-black/25')}>
									{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(index + 1) : `0${index + 1}`}
								</span>
							</div>
							<h3 className={cn('mt-6 text-lg font-semibold sm:text-xl', inverse ? 'text-white' : 'text-black')}>{pillar.title}</h3>
							<p className={cn('mt-2 text-[13px] leading-7', inverse ? 'text-white/45' : 'text-black/48')}>{pillar.description}</p>
							<div className="mt-5 flex flex-wrap gap-2">
								{pillar.tags.map((tag) => (
									<span key={tag} className={cn('inline-flex min-h-8 items-center rounded-full border px-3 text-[10px] font-medium', inverse ? 'border-white/10 bg-white/[0.045] text-white/45' : 'border-black/[0.07] bg-black/[0.025] text-black/48')}>
										{tag}
									</span>
								))}
							</div>
						</RevealBlock>
					))}
				</div>
			</div>
		</Reveal>
	)
}

export function OnboardingStory({
	locale,
	mode = 'cards',
	inverse = false,
	className,
}: {
	locale: HomeLocale
	mode?: 'cards' | 'timeline' | 'console'
	inverse?: boolean
	className?: string
}) {
	const copy = COMMON_COPY[locale]
	return (
		<Reveal id="vigento" className={cn('px-5 py-20 sm:px-8 sm:py-24 lg:py-28', inverse ? 'bg-[#070707] text-white' : 'bg-white', className)} dark={inverse}>
			<div className="mx-auto max-w-7xl">
				<SectionHeading eyebrow={copy.onboardingEyebrow} title={copy.onboardingTitle} subtitle={copy.onboardingSubtitle} inverse={inverse} />
				<div className={cn('relative mt-10 sm:mt-14', mode === 'cards' && 'grid gap-3 md:grid-cols-2 lg:grid-cols-4', mode === 'console' && 'mx-auto max-w-5xl rounded-[2rem] border p-4 sm:p-6', mode === 'console' && (inverse ? 'border-white/10 bg-white/[0.04]' : 'border-black/[0.075] bg-[var(--bg-base)]'))}>
					{mode === 'timeline' ? <div aria-hidden className={cn('absolute bottom-8 start-[19px] top-8 w-px sm:start-1/2', styles.routeRail)} /> : null}
					{copy.onboardingSteps.map((step, index) => (
						<RevealBlock
							key={step.title}
							delay={index * 0.06}
							className={cn(
								'relative',
								mode === 'cards' && 'rounded-[1.5rem] border p-5',
								mode === 'cards' && (inverse ? 'border-white/10 bg-white/[0.045]' : 'border-black/[0.075] bg-[var(--bg-base)]'),
								mode === 'timeline' && 'mb-5 grid grid-cols-[40px_1fr] gap-3 sm:grid-cols-2 sm:gap-16',
								mode === 'timeline' && index % 2 === 1 && 'sm:[&>div:last-child]:col-start-2',
								mode === 'console' && 'grid gap-3 border-b py-4 last:border-b-0 sm:grid-cols-[44px_1fr_auto] sm:items-center',
								mode === 'console' && (inverse ? 'border-white/10' : 'border-black/[0.07]'),
							)}
						>
							{mode === 'timeline' ? (
								<>
									<span className={cn('relative z-10 grid h-10 w-10 place-items-center rounded-full border text-[11px] font-bold sm:absolute sm:start-1/2 sm:-translate-x-1/2 rtl:sm:translate-x-1/2', styles.routeMarker, inverse ? 'border-emerald-300/30 bg-[#070707] text-emerald-200' : 'border-emerald-300 bg-white text-emerald-700')}>
										{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(index + 1) : index + 1}
									</span>
									<div className={cn('rounded-[1.5rem] border p-5 sm:max-w-md', index % 2 === 0 ? 'sm:me-auto sm:text-end' : 'sm:ms-auto sm:col-start-2', inverse ? 'border-white/10 bg-white/[0.045]' : 'border-black/[0.075] bg-white')}>
										<h3 className={cn('text-base font-semibold', inverse ? 'text-white' : 'text-black')}>{step.title}</h3>
										<p className={cn('mt-2 text-[12px] leading-6', inverse ? 'text-white/45' : 'text-black/45')}>{step.description}</p>
										<p className={cn('mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold', inverse ? 'text-emerald-200' : 'text-emerald-700')}><Check className="h-3.5 w-3.5" />{step.result}</p>
									</div>
								</>
							) : (
								<>
									<span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold', inverse ? 'bg-white text-black' : 'bg-black text-white')}>
										{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(index + 1) : index + 1}
									</span>
									<div className={cn(mode === 'cards' && 'mt-5')}>
										<h3 className={cn('text-sm font-semibold', inverse ? 'text-white' : 'text-black')}>{step.title}</h3>
										<p className={cn('mt-2 text-[11px] leading-6', inverse ? 'text-white/42' : 'text-black/44')}>{step.description}</p>
									</div>
									<p className={cn('mt-4 flex items-start gap-1.5 text-[10px] font-semibold sm:mt-0', inverse ? 'text-emerald-200' : 'text-emerald-700')}><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />{step.result}</p>
								</>
							)}
						</RevealBlock>
					))}
				</div>
				<div className="mt-9 flex justify-center"><HeroActions locale={locale} inverse={inverse} secondaryHref="#pricing" /></div>
			</div>
		</Reveal>
	)
}

function PlanCard({ plan, locale }: { plan: PlanPreview; locale: HomeLocale }) {
	const copy = COMMON_COPY[locale]
	return (
		<div className={cn('relative flex h-full flex-col rounded-[1.55rem] border p-5 sm:p-6', plan.featured ? 'border-black bg-black text-white shadow-[0_25px_70px_rgba(0,0,0,0.18)]' : 'border-black/[0.075] bg-white text-black')}>
			{plan.featured ? <span className="absolute -top-3 start-5 rounded-full bg-emerald-300 px-3 py-1 text-[10px] font-bold text-emerald-950">{locale === 'fa' ? 'پیشنهاد ویجنت' : 'Recommended'}</span> : null}
			<p className={cn('text-sm font-semibold', plan.featured ? 'text-white' : 'text-black')}>{plan.name}</p>
			<p className={cn('mt-2 min-h-12 text-[11px] leading-6', plan.featured ? 'text-white/45' : 'text-black/45')}>{plan.audience}</p>
			<div className="mt-5 flex items-baseline gap-2">
				<strong className="text-2xl font-semibold tabular-nums sm:text-3xl">{plan.price}</strong>
				<span className={cn('text-[10px]', plan.featured ? 'text-white/40' : 'text-black/40')}>{copy.pricingMonthly}</span>
			</div>
			<ul className="mt-6 space-y-3 text-[11px] leading-5">
				<li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{plan.maxChannels} {copy.pricingChannels}</li>
				<li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{plan.includedCredit} {copy.pricingCredit}</li>
				<li className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />{copy.pricingAllFeatures}</li>
			</ul>
			<Link href={`/login?plan=${plan.key}`} className={cn('mt-7 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-[11px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2', plan.featured ? 'bg-white text-black hover:bg-white/90' : 'bg-black text-white hover:bg-black/85')}>
				{copy.pricingPlanCta}
			</Link>
		</div>
	)
}

export function PricingPreview({ locale, plans, className }: HomeVariantPageProps & { className?: string }) {
	const copy = COMMON_COPY[locale]
	return (
		<Reveal id="pricing" className={cn('bg-[var(--bg-surface)] px-5 py-20 sm:px-8 sm:py-24 lg:py-28', className)}>
			<div className="mx-auto max-w-7xl">
				<SectionHeading eyebrow={copy.pricingEyebrow} title={copy.pricingTitle} subtitle={copy.pricingSubtitle} />
				<div className="mx-auto mt-10 flex max-w-4xl flex-col items-center justify-between gap-5 rounded-[1.6rem] bg-black p-5 text-center text-white shadow-[0_24px_70px_rgba(0,0,0,0.16)] sm:flex-row sm:p-6 sm:text-start">
					<div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
						<span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-black"><Sparkles className="h-5 w-5" /></span>
						<div><h3 className="text-base font-semibold">{copy.pricingTrialTitle}</h3><p className="mt-1.5 max-w-xl text-[11px] leading-6 text-white/48">{copy.pricingTrialDescription}</p></div>
					</div>
					<Link href="/login?next=/onboarding" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-5 text-[11px] font-semibold text-black transition-[background-color,transform] duration-150 hover:bg-white/90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2 focus-visible:ring-offset-black">{copy.primaryCta}</Link>
				</div>
				<div className="mt-4 grid gap-3 md:grid-cols-3">{plans.map((plan) => <RevealBlock key={plan.key} delay={plan.featured ? 0.04 : 0.08}><PlanCard plan={plan} locale={locale} /></RevealBlock>)}</div>
				<p className="mx-auto mt-6 max-w-2xl text-center text-[10px] leading-6 text-black/40">
					{locale === 'fa' ? 'اعتبار پاسخ از اشتراک جداست، منقضی نمی‌شود و فقط بعد از پاسخ موفق کم می‌شود. قیمت‌های بالا از همان کاتالوگ فعال پرداخت خوانده شده‌اند.' : 'Reply credit is separate from the subscription, does not expire and is deducted only after a successful reply. Prices come from the active checkout catalog.'}
				</p>
			</div>
		</Reveal>
	)
}

export function FaqSection({ locale, inverse = false }: { locale: HomeLocale; inverse?: boolean }) {
	const copy = COMMON_COPY[locale]
	return (
		<Reveal className={cn('px-5 py-20 sm:px-8 sm:py-24', inverse ? 'bg-[#070707] text-white' : 'bg-white')} dark={inverse}>
			<div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
				<SectionHeading eyebrow={copy.faqEyebrow} title={copy.faqTitle} align="start" inverse={inverse} />
				<div className={cn('divide-y rounded-[1.6rem] border px-5 sm:px-6', inverse ? 'divide-white/10 border-white/10 bg-white/[0.04]' : 'divide-black/[0.07] border-black/[0.075] bg-[var(--bg-base)]')}>
					{copy.faqs.map((item) => (
						<details key={item.question} className="group py-4 open:pb-5">
							<summary className={cn('flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]', inverse ? 'text-white' : 'text-black')}>
								{item.question}<ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" aria-hidden />
							</summary>
							<p className={cn('pe-8 text-[11px] leading-7', inverse ? 'text-white/45' : 'text-black/48')}>{item.answer}</p>
						</details>
					))}
				</div>
			</div>
		</Reveal>
	)
}

export function ClosingCta({ locale, inverse = true }: { locale: HomeLocale; inverse?: boolean }) {
	const copy = COMMON_COPY[locale]
	return (
		<Reveal className="px-5 pb-20 pt-8 sm:px-8 sm:pb-24">
			<div className={cn('relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] border px-5 py-14 text-center shadow-[0_28px_90px_rgba(0,0,0,0.16)] sm:px-8 sm:py-20', inverse ? 'border-white/10 bg-[#070707] text-white' : 'border-black/[0.08] bg-white text-black')}>
				<div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-65', inverse ? styles.darkGrid : styles.paperGrid)} />
				<div aria-hidden className={cn('pointer-events-none absolute inset-0', inverse ? styles.darkHalo : styles.softHalo)} />
				<div className="relative mx-auto max-w-3xl">
					<span className={cn('text-[10px] font-semibold', inverse ? 'text-emerald-200/70' : 'text-emerald-700')}>{copy.closingEyebrow}</span>
					<h2 className="mt-4 text-[clamp(1.8rem,5vw,3.7rem)] font-semibold leading-[1.25] tracking-[-0.035em] rtl:tracking-normal">{copy.closingTitle}</h2>
					<p className={cn('mx-auto mt-4 max-w-2xl text-sm leading-7 sm:text-base sm:leading-8', inverse ? 'text-white/48' : 'text-black/48')}>{copy.closingDescription}</p>
					<div className="mt-8 flex justify-center"><HeroActions locale={locale} inverse={inverse} secondaryHref="#product" /></div>
				</div>
			</div>
		</Reveal>
	)
}

export function ChannelPills({ locale, inverse = false }: { locale: HomeLocale; inverse?: boolean }) {
	const channels = locale === 'fa'
		? ['اینستاگرام', 'تلگرام', 'بله', 'روبیکا', 'ویجت وب', 'افزونه ووکامرس']
		: ['Instagram', 'Telegram', 'Bale', 'Rubika', 'Web widget', 'WooCommerce plugin']
	const channelIcons = [InstagramIcon, MessageCircleMore, MessagesSquare, MessagesSquare, PlugZap, ShoppingBag]
	return (
		<div className="flex flex-wrap items-center justify-center gap-2">
			{channels.map((channel, index) => {
				const Icon = channelIcons[index]
				return <span key={channel} className={cn('inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-[10px] font-medium', inverse ? 'border-white/10 bg-white/[0.045] text-white/48' : 'border-black/[0.075] bg-white text-black/48')}><Icon className="h-3.5 w-3.5" />{channel}</span>
			})}
		</div>
	)
}

export function OutcomeStats({ locale, inverse = false }: { locale: HomeLocale; inverse?: boolean }) {
	const stats = locale === 'fa'
		? [
			{ value: '۲۴/۷', label: 'پاسخ‌گویی پیوسته', icon: Bot },
			{ value: '۱', label: 'صندوق برای همه کانال‌ها', icon: MessagesSquare },
			{ value: '۳۰ روز', label: 'فرصت آزمایش رایگان', icon: CircleDollarSign },
			{ value: '۰', label: 'نیاز به کدنویسی', icon: BarChart3 },
		]
		: [
			{ value: '24/7', label: 'Continuous replies', icon: Bot },
			{ value: '1', label: 'Inbox for every channel', icon: MessagesSquare },
			{ value: '30 days', label: 'Free hands-on trial', icon: CircleDollarSign },
			{ value: '0', label: 'Code required', icon: BarChart3 },
		]
	return (
		<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
			{stats.map((stat) => <div key={stat.label} className={cn('rounded-2xl border p-4', inverse ? 'border-white/10 bg-white/[0.04]' : 'border-black/[0.075] bg-white')}><stat.icon className={cn('h-4 w-4', inverse ? 'text-white/38' : 'text-black/38')} /><strong className={cn('mt-5 block text-xl font-semibold tabular-nums', inverse ? 'text-white' : 'text-black')}>{stat.value}</strong><span className={cn('mt-1 block text-[10px] leading-5', inverse ? 'text-white/40' : 'text-black/42')}>{stat.label}</span></div>)}
		</div>
	)
}

export { EASE_IN_OUT, EASE_OUT, styles }
