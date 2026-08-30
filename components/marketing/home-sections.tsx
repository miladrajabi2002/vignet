'use client'

import { Fragment, useRef, useState, type ReactNode } from 'react'
import { m, AnimatePresence, useInView, useReducedMotion, useScroll, useSpring } from 'framer-motion'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COMMON_COPY, type PillarItem } from './home-variants/shared/content'
import type { HomeLocale } from './home-variants/shared/types'
import { SectionHeading, StorySection } from './home-variants/shared/chrome'
import { EASE_OUT, RevealBlock } from './home-variants/shared/scroll'
import { BookingMock, ChatThread, InstagramMock, ProductIcon } from './home-variants/shared/mocks'
import styles from './home-variants/home-variants.module.css'

/* ------------------------------------------------------------------ */
/* Capabilities bento — "یک سیستم، نه چند ابزار پراکنده"              */
/* ------------------------------------------------------------------ */

const CAPABILITY_ROW_CLASSES = [
	'lg:row-start-1',
	'lg:row-start-2',
	'lg:row-start-3',
	'lg:row-start-4',
] as const

function formatStep(index: number, locale: HomeLocale) {
	return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
		minimumIntegerDigits: 2,
		useGrouping: false,
	}).format(index + 1)
}

function CapabilityCard({
	pillar,
	index,
	side,
	locale,
	className,
}: {
	pillar: PillarItem
	index: number
	side: 'left' | 'right'
	locale: HomeLocale
	className?: string
}) {
	const reduce = useReducedMotion()
	const fa = locale === 'fa'
	const number = formatStep(index, locale)

	return (
		<m.article
			dir={fa ? 'rtl' : 'ltr'}
			initial={
				reduce
					? false
					: {
							opacity: 0,
							x: side === 'left' ? -28 : 28,
							y: 10,
							scale: 0.985,
						}
			}
			whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
			viewport={{ once: true, amount: 0.36 }}
			transition={
				reduce
					? { duration: 0 }
					: { type: 'spring', bounce: 0, duration: 0.4, delay: side === 'right' ? 0.045 : 0 }
			}
			className={cn(
				styles.capabilityCard,
				'relative z-10 min-w-0 overflow-visible rounded-[1.55rem] p-5 sm:p-6 lg:min-h-[13.5rem]',
				className,
			)}
		>
			<span
				aria-hidden
				className="absolute -start-[2.45rem] top-7 grid h-5 w-5 place-items-center rounded-full border-[5px] border-[#f6faf8] bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.22),0_0_22px_rgba(16,185,129,0.28)] lg:hidden"
		/>

			<div className="flex items-start gap-4">
				<span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1.05rem] bg-[#101514] text-white shadow-[0_10px_28px_rgba(5,20,16,0.18)]">
					<ProductIcon name={pillar.icon} className="h-5 w-5" />
				</span>
				<div className="min-w-0 flex-1 pt-0.5">
					<div className="flex items-center justify-between gap-4">
						<h3 className="text-[15px] font-semibold leading-7 text-[#101817] sm:text-base">{pillar.title}</h3>
						<span className="shrink-0 font-mono text-[13px] font-semibold tabular-nums text-emerald-600">{number}</span>
					</div>
					<p className="mt-2 text-[12px] leading-7 text-[#42504d] sm:text-[12.5px]">{pillar.description}</p>
				</div>
			</div>

			<div className="mt-5 flex flex-wrap gap-2">
				{pillar.tags.map((tag) => (
					<span
						key={tag}
						className="inline-flex min-h-8 items-center rounded-full border border-emerald-950/[0.08] bg-white/75 px-3 text-[10px] font-medium text-[#52605d] shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]"
					>
						{tag}
					</span>
				))}
			</div>
		</m.article>
	)
}

function CapabilityNode({ row, className }: { row: number; className?: string }) {
	const reduce = useReducedMotion()
	return (
		<div
			dir="ltr"
			aria-hidden
			className={cn('relative z-20 hidden min-h-[13.5rem] items-center justify-center lg:flex', className)}
		>
			<m.span
				initial={reduce ? false : { scaleX: 0, opacity: 0 }}
				whileInView={{ scaleX: 1, opacity: 1 }}
				viewport={{ once: true, amount: 0.55 }}
				transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE_OUT }}
				className={cn(styles.capabilityConnector, 'absolute inset-x-0 top-1/2 h-px origin-center')}
			/>
			<m.span
				initial={reduce ? false : { scale: 0.72, opacity: 0 }}
				whileInView={{ scale: 1, opacity: 1 }}
				viewport={{ once: true, amount: 0.55 }}
				transition={reduce ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.4, delay: 0.08 }}
				className="relative grid h-8 w-8 place-items-center rounded-xl border border-emerald-500/20 bg-white text-[10px] font-bold text-emerald-700 shadow-[0_8px_24px_rgba(16,185,129,0.16)]"
			>
				{row + 1}
			</m.span>
		</div>
	)
}

export function CapabilitiesBento({ locale }: { locale: HomeLocale }) {
	const copy = COMMON_COPY[locale]
	const fa = locale === 'fa'
	const flowRef = useRef<HTMLDivElement>(null)
	const reduce = useReducedMotion()
	const { scrollYProgress } = useScroll({ target: flowRef, offset: ['start 0.78', 'end 0.38'] })
	const lineScale = useSpring(scrollYProgress, { stiffness: 95, damping: 28, restDelta: 0.001 })
	const titleStart = fa
		? 'از اولین پیام مشتری تا نتیجه‌ای که در کسب‌وکار'
		: 'From the first customer message to an outcome'
	const titleAccent = fa ? 'ثبت می‌شود' : 'recorded in your business'
	const resultLabel = fa ? 'یک جریان یکپارچه و قابل پیگیری' : 'One connected, traceable flow'
	const resultSteps = fa
		? ['همهٔ کانال‌ها', 'دانش معتبر', 'اقدام خودکار', 'نتیجهٔ ثبت‌شده']
		: ['Every channel', 'Trusted knowledge', 'Automated action', 'Recorded outcome']

	return (
		<section id="solutions" className="marketing-story-section scroll-mt-24 overflow-hidden bg-white px-3 py-14 sm:px-5 sm:py-20 lg:px-8">
			<div className={cn(styles.capabilityCanvas, 'relative mx-auto max-w-[1380px] overflow-hidden rounded-[2rem] border border-emerald-950/[0.06] px-4 py-14 sm:rounded-[2.75rem] sm:px-8 sm:py-20 lg:px-12 lg:py-24')}>
				<div aria-hidden className={cn(styles.capabilityGrid, 'pointer-events-none absolute inset-0')} />
				<div aria-hidden className="pointer-events-none absolute -end-20 top-20 h-72 w-72 rounded-full bg-emerald-300/15 blur-[90px]" />
				<div aria-hidden className="pointer-events-none absolute -start-24 top-1/3 h-80 w-80 rounded-full bg-indigo-200/20 blur-[110px]" />

				<div className="relative mx-auto max-w-7xl">
					<RevealBlock className="mx-auto max-w-4xl text-center" translate={16}>
						<span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-950/[0.08] bg-white/75 px-4 text-[11px] font-semibold text-[#40504c] shadow-[0_8px_28px_rgba(15,80,60,0.07)] backdrop-blur-xl">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" />
								<span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
							</span>
							{copy.pillarsEyebrow}
						</span>
						<h2
							aria-label={copy.pillarsTitle}
							className="mx-auto mt-5 max-w-4xl text-[clamp(2rem,5.4vw,4.15rem)] font-semibold leading-[1.23] tracking-[-0.035em] text-[#0c1715] rtl:tracking-normal"
						>
							<span aria-hidden>{titleStart} </span>
							<span aria-hidden className="text-emerald-600">{titleAccent}</span>
						</h2>
						<p className="mx-auto mt-5 max-w-3xl text-[13px] leading-8 text-[#4d5b58] sm:text-[15px] sm:leading-8">{copy.pillarsSubtitle}</p>
					</RevealBlock>

					<div ref={flowRef} className="relative mx-auto mt-12 max-w-[1180px] sm:mt-16 lg:mt-20">
						<div aria-hidden className="absolute bottom-8 start-[1.15rem] top-8 w-px bg-emerald-950/[0.09] lg:hidden" />
						<m.div
							aria-hidden
							style={{ scaleY: reduce ? 1 : lineScale }}
							className="absolute bottom-8 start-[1.15rem] top-8 w-[2px] origin-top rounded-full bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-600 shadow-[0_0_18px_rgba(16,185,129,0.28)] lg:hidden"
						/>

						<div aria-hidden className="absolute bottom-6 left-1/2 top-6 hidden w-px -translate-x-1/2 bg-emerald-950/[0.1] lg:block" />
						<div aria-hidden className="absolute bottom-6 left-1/2 top-6 z-10 hidden w-[2px] -translate-x-1/2 lg:block">
							<m.div
								style={{ scaleY: reduce ? 1 : lineScale }}
								className="h-full w-full origin-top rounded-full bg-gradient-to-b from-emerald-300 via-emerald-500 to-emerald-600 shadow-[0_0_22px_rgba(16,185,129,0.32)]"
							/>
						</div>

						<div className="grid gap-4 ps-12 lg:grid-cols-[minmax(0,1fr)_6.75rem_minmax(0,1fr)] lg:grid-rows-4 lg:gap-x-0 lg:gap-y-5 lg:ps-0 lg:[direction:ltr]">
							{Array.from({ length: 4 }, (_, row) => {
								const leftIndex = row * 2
								const rightIndex = leftIndex + 1
								return (
									<Fragment key={row}>
										<CapabilityCard
											pillar={copy.pillars[leftIndex]}
											index={leftIndex}
											side="left"
											locale={locale}
											className={cn('lg:col-start-1', CAPABILITY_ROW_CLASSES[row])}
										/>
										<CapabilityNode row={row} className={cn('lg:col-start-2', CAPABILITY_ROW_CLASSES[row])} />
										<CapabilityCard
											pillar={copy.pillars[rightIndex]}
											index={rightIndex}
											side="right"
											locale={locale}
											className={cn('lg:col-start-3', CAPABILITY_ROW_CLASSES[row])}
										/>
									</Fragment>
								)
							})}
						</div>
					</div>

					<RevealBlock className="mx-auto mt-10 max-w-4xl sm:mt-14" translate={12}>
						<div className="flex flex-col items-center justify-between gap-4 rounded-[1.4rem] border border-emerald-950/[0.07] bg-white/80 px-5 py-4 shadow-[0_16px_50px_rgba(15,80,60,0.08)] backdrop-blur-xl sm:flex-row sm:px-6">
							<p className="flex items-center gap-2.5 text-[11px] font-semibold text-[#34433f] sm:text-[12px]">
								<span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Sparkles className="h-4 w-4" aria-hidden /></span>
								{resultLabel}
							</p>
							<div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[10px] font-medium text-[#64716e]">
								{resultSteps.map((step, index) => (
									<Fragment key={step}>
										<span className="rounded-full bg-emerald-950/[0.04] px-2.5 py-1.5">{step}</span>
										{index < resultSteps.length - 1 ? <span aria-hidden className="text-emerald-500">{fa ? '←' : '→'}</span> : null}
									</Fragment>
								))}
							</div>
						</div>
					</RevealBlock>
				</div>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------ */
/* Live chat demo — scenario tabs, now with an Instagram tab          */
/* ------------------------------------------------------------------ */

export function LiveChatDemo({ locale }: { locale: HomeLocale }) {
	const fa = locale === 'fa'
	const copy = COMMON_COPY[locale]
	const [index, setIndex] = useState(0)
	const scenario = copy.scenarios[index]
	return (
		<StorySection id="demo" className="bg-[var(--bg-base)]">
			<div className="mx-auto max-w-6xl">
				<SectionHeading
					eyebrow={fa ? 'دموی زندهٔ گفتگو' : 'Live conversation demo'}
					title={fa ? 'همین‌جا، واقعی ببینید' : 'See it happen, right here'}
					subtitle={
						fa
							? 'یک سناریو را انتخاب کنید؛ گفتگوی واقعی بین مشتری و ایجنت را با منبع پاسخ، کارت محصول و ثبت نتیجه ببینید.'
							: 'Pick a scenario and watch the actual conversation — sources, product cards and the recorded outcome.'
					}
				/>
				<div className="mt-10 flex flex-wrap justify-center gap-2" role="tablist" aria-label={fa ? 'سناریوی دمو' : 'Demo scenario'}>
					{copy.scenarios.map((item, itemIndex) => (
						<button
							key={item.id}
							type="button"
							role="tab"
							aria-selected={itemIndex === index}
							onClick={() => setIndex(itemIndex)}
							className={cn(
								'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[11.5px] font-semibold transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff]',
								itemIndex === index
									? 'border-black bg-black text-white shadow-[0_10px_26px_rgba(0,0,0,0.2)]'
									: 'border-black/10 bg-white text-black/55 hover:bg-black/[0.04] hover:text-black',
							)}
						>
							<ProductIcon name={item.icon} className="h-3.5 w-3.5" />
							{item.label}
						</button>
					))}
				</div>
				<div className="mx-auto mt-8 grid max-w-5xl gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-start">
					<AnimatePresence mode="wait" initial={false}>
						<m.div
							key={scenario.id}
							initial={{ opacity: 0, y: 16, scale: 0.985 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: -12, scale: 0.99 }}
							transition={{ duration: 0.4, ease: EASE_OUT }}
						>
							<ChatThread key={scenario.id} scenario={scenario} locale={locale} inverse={false} height="h-[440px]" />
						</m.div>
					</AnimatePresence>
					<div className="space-y-3">
						<div className="rounded-[1.4rem] border border-black/[0.08] bg-white p-5 shadow-[0_14px_44px_rgba(0,0,0,0.05)]">
							<p className="text-[10px] font-bold text-black/40">{fa ? 'در این گفتگو' : 'In this conversation'}</p>
							<ul className="mt-3 space-y-3 text-[12px] leading-6 text-black/70">
								{(scenario.modules ?? []).map((module) => (
									<li key={module} className="flex items-center gap-2.5">
										<span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
											<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
										</span>
										{module}
									</li>
								))}
							</ul>
						</div>
						<div className="rounded-[1.4rem] border border-black/[0.08] bg-[var(--bg-base)] p-5">
							<p className="text-[11px] leading-7 text-black/55">
								{fa
									? 'این دقیقاً همان تجربه‌ای است که مشتری‌های شما می‌بینند — بدون انتظار، بدون «بعداً جواب می‌دم».'
									: 'This is exactly what your customers experience — no waiting, no “I will reply later”.'}
							</p>
						</div>
					</div>
				</div>
			</div>
		</StorySection>
	)
}

/* ------------------------------------------------------------------ */
/* Instagram automation — deterministic + intelligent, real-IG mock   */
/* ------------------------------------------------------------------ */

function DeferredInstagramMock({ locale }: { locale: HomeLocale }) {
	const containerRef = useRef<HTMLDivElement>(null)
	const isInView = useInView(containerRef, { amount: 0.08 })

	return (
		<div ref={containerRef} className="relative min-h-[47rem] md:min-h-[45rem]">
			{isInView ? (
				<m.div
					initial={{ opacity: 0, transform: 'translate3d(0, 16px, 0)' }}
					animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
					transition={{ duration: 0.42, ease: EASE_OUT }}
				>
					<InstagramMock locale={locale} inverse active />
				</m.div>
			) : (
				<div className="grid items-center justify-center gap-4 md:grid-cols-[minmax(300px,370px)_minmax(170px,220px)] md:gap-6" aria-hidden>
					<div className="mx-auto aspect-[393/852] w-full max-w-[320px] rounded-[50px] border border-white/10 bg-white/[0.025]" />
					<div className="hidden space-y-7 ps-8 md:block">
						{[0, 1, 2].map((item) => (
							<div key={item} className="h-11 rounded-xl bg-white/[0.025]" />
						))}
					</div>
				</div>
			)}
		</div>
	)
}

export function InstagramAutomationSection({ locale }: { locale: HomeLocale }) {
	const fa = locale === 'fa'
	const bullets = fa
		? [
				'پاسخ خودکار کامنت + دایرکت خصوصی',
				'قیف فالو: شرط فالو داشتن، پیام برای فالو، سپس پاسخ',
				'پاسخ به منشن و ری‌اکشن استوری',
				'در دایرکت، پاسخ هوشمند و زمینیِ ایجنت',
				'کنترل کامل: کلمات توقف، سیاست پاسخ، لحن',
			]
		: [
				'Auto comment reply + private DM',
				'Follow funnel: follow condition, message to follow, then the reply',
				'Story mention and reaction replies',
				'In DMs, the agent’s intelligent, grounded replies',
				'Full control: stop words, reply policy, tone',
			]
	return (
		<StorySection inverse className="overflow-hidden">
			<div aria-hidden className={cn('pointer-events-none absolute inset-0', styles.darkGrid, styles.gridFade)} />
			<div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
				<div>
					<SectionHeading
						align="start"
						inverse
						eyebrow={fa ? 'اتوماسیون اینستاگرام' : 'Instagram automation'}
						title={fa ? 'دایرکت، کامنت و استوری؛ هم خودکار و هم هوشمند' : 'DMs, comments and stories — automated and intelligent'}
						subtitle={
							fa
								? 'سناریوهای ثابت و دقیق برای هر موقعیت — کامنت، منشن استوری و قیف فالو — بدون مصرف اعتبار AI. و در دایرکت، همان ایجنت هوشمند از دادهٔ شما پاسخ می‌دهد.'
								: 'Deterministic scenarios for every situation — comments, story mentions and the follow funnel — with zero AI credit. And in DMs, the same intelligent agent answers from your data.'
						}
					/>
					<ul className="mt-7 space-y-3.5 text-[12.5px] leading-6 text-white/65">
						{bullets.map((item) => (
							<li key={item} className="flex items-center gap-3">
								<span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-300/12 text-emerald-300">
									<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
								</span>
								{item}
							</li>
						))}
					</ul>
				</div>
				<DeferredInstagramMock locale={locale} />
			</div>
		</StorySection>
	)
}

/* ------------------------------------------------------------------ */
/* Sales, orders and booking — sticky visual + narrative (v2 chapter) */
/* ------------------------------------------------------------------ */

type Point = { icon: ReactNode; title: string; detail: string }

export function SalesBookingChapter({ locale }: { locale: HomeLocale }) {
	const fa = locale === 'fa'
	const copy = COMMON_COPY[locale]
	const bookingScenario = copy.scenarios.find((s) => s.id === 'booking') ?? copy.scenarios[2]
	const points: Point[] = [
		{
			icon: <ProductIcon name="box" className="h-5 w-5" />,
			title: fa ? 'کاتالوگ و ووکامرس' : 'Catalog and WooCommerce',
			detail: fa
				? 'محصول و سفارش‌ها خودکار همگام می‌شوند؛ «سفارشم کی می‌رسه؟» جواب دارد.'
				: 'Products and orders sync automatically; “where is my order?” gets answered.',
		},
		{
			icon: <ProductIcon name="calendar" className="h-5 w-5" />,
			title: fa ? 'رزرو بدون تداخل' : 'Conflict-free booking',
			detail: fa
				? 'ظرفیت، فاصلهٔ بین نوبت‌ها و قواعد هفتگی — همه رعایت می‌شود.'
				: 'Capacity, buffers and weekly rules are always respected.',
		},
		{
			icon: <ProductIcon name="target" className="h-5 w-5" />,
			title: fa ? 'پیشنهاد هوشمند' : 'Smart suggestions',
			detail: fa
				? 'ایجنت محصول مرتبط و مکمل را پیشنهاد می‌کند؛ مثل یک فروشندهٔ خوب.'
				: 'The agent offers relevant and complementary products — like a good salesperson.',
		},
	]
	return (
		<section id="product" className="relative scroll-mt-24 overflow-hidden bg-[var(--bg-base)] px-5 py-20 sm:px-8 sm:py-28">
			<div className="relative mx-auto max-w-7xl">
				<div className="flex items-center gap-4">
					<span className="text-[clamp(3.2rem,9vw,6rem)] font-semibold leading-none tracking-tight rtl:tracking-normal text-black/[0.07]">
						{fa ? 'فروش' : 'Sales'}
					</span>
					<div className="min-w-0 flex-1 border-t border-dashed border-black/15" aria-hidden />
				</div>
				<div className="mt-6 grid gap-12 lg:grid-cols-2 lg:gap-16">
					<div className="lg:sticky lg:top-24 lg:self-start">
						<RevealBlock>
							<SectionHeading
								align="start"
								eyebrow={fa ? 'فروش، سفارش و رزرو' : 'Sales, orders and booking'}
								title={fa ? 'خرید و نوبت، همان‌جا در گفتگو تمام می‌شود' : 'Purchase and booking finish right inside the chat'}
								subtitle={
									fa
										? 'قیمت لحظه‌ای، موجودی، وضعیت سفارش و تقویم — همه در دسترس ایجنت.'
										: 'Live price, stock, order status and the calendar — all at the agent’s fingertips.'
								}
							/>
							<div className="mt-8 space-y-4">
								<ChatThread scenario={bookingScenario} locale={locale} inverse={false} showHeader={false} height="h-[360px]" />
								<BookingMock locale={locale} inverse={false} />
							</div>
						</RevealBlock>
					</div>
					<div className="space-y-5 lg:pt-24">
						{points.map((point, index) => (
							<RevealBlock
								key={point.title}
								delay={index * 0.05}
								className="rounded-[1.5rem] border border-black/[0.08] bg-white p-6 shadow-[0_14px_44px_rgba(0,0,0,0.05)] transition-transform duration-300 hover:-translate-y-1 sm:p-7"
							>
								<span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white">{point.icon}</span>
								<h3 className="mt-5 text-[16px] font-semibold">{point.title}</h3>
								<p className="mt-2 text-[12.5px] leading-7 text-black/50">{point.detail}</p>
							</RevealBlock>
						))}
					</div>
				</div>
			</div>
		</section>
	)
}
