'use client'

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
	BookOpenCheck,
	Bot,
	Check,
	CheckCircle2,
	Database,
	MessageCircleMore,
	Route,
	Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import styles from '../home-variants.module.css'
import { COMMON_COPY, VARIANT_COPY, type ProductScenario } from '../shared/content'
import {
	CapabilitySection,
	ClosingCta,
	FaqSection,
	HeroActions,
	OnboardingStory,
	PricingPreview,
	ProductIcon,
	Reveal,
	RevealBlock,
	SectionHeading,
	TrialBadge,
	TrustRail,
	VariantSwitcher,
} from '../shared/primitives'
import type { HomeLocale, HomeVariantPageProps } from '../shared/types'

type ScenarioId = 'store' | 'food' | 'booking' | 'service' | 'education'

type ScenarioDetail = Omit<ProductScenario, 'id' | 'label' | 'icon' | 'channel' | 'person'> & {
	headline: string
	summary: string
}

type ScenarioExperience = ProductScenario & ScenarioDetail & { id: ScenarioId }

const PAGE_COPY = {
	fa: {
		fiveLabel: 'پنج کسب‌وکار · پنج نتیجهٔ روشن',
		selectorQuestion: 'کسب‌وکار شما به کدام مسیر نزدیک‌تر است؟',
		selectorHint: 'یک گزینه را انتخاب کنید؛ دمو و نتیجه همان لحظه تغییر می‌کند.',
		selectorAria: 'انتخاب نوع کسب‌وکار برای دموی ویجنت',
		demoLabel: 'دموی تعاملی محصول',
		demoState: 'سناریوی نمایشی',
		incoming: 'پیام مشتری',
		agentAnswer: 'پاسخ مبتنی بر منبع',
		outcome: 'نتیجه در عملیات',
		storyEyebrow: 'داستان محصول؛ از پیام تا نتیجه',
		storyTitle: 'ببینید پاسخ از کجا می‌آید و بعد کجا ثبت می‌شود',
		storySubtitle:
			'این یک سناریوی نمایشی بر پایه قابلیت‌های پیاده‌سازی‌شده است؛ بدون آمار ساختگی، لوگوی مشتری یا وعدهٔ نتیجهٔ تضمینی.',
		storyAria: 'مراحل سناریوی انتخاب‌شده از پیام ورودی تا نتیجه',
		trace: ['پیام ورودی', 'منبع معتبر', 'پاسخ ایجنت', 'اقدام بعدی', 'نتیجه ثبت‌شده'],
		wooNote: 'در این مسیر، ووکامرس منبع کاتالوگ و موجودی است؛ کانال گفتگو اینستاگرام است.',
		productNote: 'سناریوی فعال در بخش بالا انتخاب شده و همهٔ مراحل زیر با همان انتخاب هماهنگ‌اند.',
	},
	en: {
		fiveLabel: 'Five businesses · five clear outcomes',
		selectorQuestion: 'Which path is closest to your business?',
		selectorHint: 'Choose one. The product demo and outcome update immediately.',
		selectorAria: 'Choose a business type for the Vigent demo',
		demoLabel: 'Interactive product demo',
		demoState: 'Illustrative scenario',
		incoming: 'Customer message',
		agentAnswer: 'Source-grounded answer',
		outcome: 'Operational outcome',
		storyEyebrow: 'Product story · message to outcome',
		storyTitle: 'See where the answer comes from and where the outcome goes',
		storySubtitle:
			'This illustrative flow uses shipped product capabilities—without invented metrics, customer logos or guaranteed results.',
		storyAria: 'Selected scenario stages from incoming message to recorded outcome',
		trace: ['Incoming message', 'Trusted source', 'Agent answer', 'Next action', 'Recorded outcome'],
		wooNote: 'Here, WooCommerce supplies catalog and stock data; Instagram is the conversation channel.',
		productNote: 'The choice made above stays active, so every stage below follows the same business path.',
	},
} satisfies Record<HomeLocale, Record<string, string | string[]>>

const SAFE_SCENARIO_DETAILS: Record<HomeLocale, Record<ScenarioId, ScenarioDetail>> = {
	fa: {
		store: {
			headline: 'موجودی واقعی؛ پاسخ دقیق‌تر',
			summary: 'وقتی فروشگاه متصل است، ایجنت از کاتالوگ همگام‌شده پاسخ می‌دهد و همان محصول را در گفتگو نشان می‌دهد.',
			message: 'رنگ مشکی این مدل موجوده؟',
			answer: 'بله؛ در موجودی همگام‌شده، رنگ مشکی سایز ۴۲ موجود است. کارت محصول و لینک همان کالا را می‌فرستم.',
			source: 'کاتالوگ و موجودی همگام‌شدهٔ ووکامرس',
			action: 'ارسال کارت محصول و لینک صفحهٔ همان کالا',
			outcome: 'علاقه‌مندی مشتری و محصول موردنظر در CRM باقی می‌ماند',
		},
		food: {
			headline: 'منوی به‌روز؛ انتخاب ساده‌تر',
			summary: 'ایجنت از منوی دیجیتال و کاتالوگ فعال جواب می‌دهد؛ بدون اینکه قابلیت سفارش‌گیری یا زمان تحویل را حدس بزند.',
			message: 'کدام غذای گیاهی امروز موجوده؟',
			answer: 'در منوی به‌روز امروز، پاستا سبزیجات و سالاد فصل موجود است. مواد هرکدام را هم می‌توانم توضیح بدهم.',
			source: 'منوی دیجیتال و موجودی کاتالوگ',
			action: 'نمایش گزینه‌های موجود و پاسخ به جزئیات منو',
			outcome: 'گفتگو برای ادامهٔ پیگیری در صندوق واحد باقی می‌ماند',
		},
		booking: {
			headline: 'زمان آزاد؛ رزرو بدون تداخل',
			summary: 'ایجنت زمان‌های واقعی را از تقویم می‌خواند و فقط بعد از تأیید صریح مشتری نوبت را ثبت می‌کند.',
			message: 'برای جمعه ساعت ۵ وقت خالی دارید؟',
			answer: 'طبق تقویم، ساعت ۵ در دسترس است. بعد از تأیید نام و شماره تماس، رزرو ثبت می‌شود.',
			source: 'تقویم، ظرفیت و استثناهای ثبت‌شده',
			action: 'دریافت تأیید مشتری و ثبت اتمیک نوبت',
			outcome: 'نوبت تأییدشده بدون تداخل در تقویم ثبت می‌شود',
		},
		service: {
			headline: 'درخواست حساس؛ تحویل با زمینهٔ کامل',
			summary: 'وقتی تصمیم انسانی لازم است، ایجنت گفتگو را متوقف می‌کند و خلاصهٔ درخواست را به اپراتور می‌رساند.',
			message: 'قبل از ثبت درخواست باید با کارشناس صحبت کنم.',
			answer: 'حتماً؛ گفتگو را همراه خلاصهٔ درخواست شما به اپراتور منتقل می‌کنم تا از همین‌جا ادامه دهد.',
			source: 'قواعد تحویل انسانی و تاریخچهٔ همین گفتگو',
			action: 'ساخت خلاصه و اعلان در داشبورد یا بات اپراتور',
			outcome: 'اپراتور با همان زمینه، گفتگو را در کانال اصلی ادامه می‌دهد',
		},
		education: {
			headline: 'سؤال دوره؛ پاسخ از سرفصل تأییدشده',
			summary: 'پاسخ از محتوایی می‌آید که آموزشگاه در پایگاه دانش قرار داده است و سابقهٔ گفتگو در پرونده مشتری می‌ماند.',
			message: 'این دوره پیش‌نیاز برنامه‌نویسی دارد؟',
			answer: 'خیر؛ طبق سرفصل ثبت‌شده، دوره از سطح مقدماتی شروع می‌شود و پیش‌نیاز برنامه‌نویسی ندارد.',
			source: 'سرفصل دوره و پاسخ‌های تأییدشده',
			action: 'پاسخ از دانش دوره و ارائهٔ مسیر ادامهٔ گفتگو',
			outcome: 'سؤال و علاقه‌مندی مخاطب در پروندهٔ گفتگو باقی می‌ماند',
		},
	},
	en: {
		store: {
			headline: 'Synced stock, a more precise answer',
			summary: 'With a connected store, the agent answers from the synced catalog and can show the matching product in the conversation.',
			message: 'Is this available in black?',
			answer: 'Yes. The synced catalog shows black in size 42. I can send the product card and its product-page link.',
			source: 'Synced WooCommerce catalog and stock',
			action: 'Send the product card and its product-page link',
			outcome: 'The customer interest and matching product remain in CRM context',
		},
		food: {
			headline: 'A current menu, an easier choice',
			summary: 'The agent answers from the active digital menu without inventing ordering or delivery capabilities.',
			message: 'Which vegetarian dishes are available today?',
			answer: 'Today’s current menu lists vegetable pasta and the seasonal salad. I can also explain the ingredients.',
			source: 'Digital menu and catalog availability',
			action: 'Show available choices and answer menu questions',
			outcome: 'The conversation stays in the unified inbox for follow-up',
		},
		booking: {
			headline: 'Real availability, conflict-free booking',
			summary: 'The agent reads real availability and only creates the appointment after explicit customer confirmation.',
			message: 'Is Friday at 5 available?',
			answer: 'The calendar shows 5 PM as available. I can create the booking after you confirm your name and phone number.',
			source: 'Calendar, capacity and configured exceptions',
			action: 'Collect confirmation and create the booking atomically',
			outcome: 'The confirmed appointment is recorded without a scheduling conflict',
		},
		service: {
			headline: 'A sensitive request, handed over with context',
			summary: 'When human judgment is needed, the agent pauses and sends the operator a useful conversation summary.',
			message: 'I need to speak to an expert before I submit this request.',
			answer: 'Of course. I will hand this over with a summary so the operator can continue from here.',
			source: 'Human-handoff rules and this conversation history',
			action: 'Create a summary and alert the dashboard or operator bot',
			outcome: 'The operator continues in the original channel with the same context',
		},
		education: {
			headline: 'A course question, answered from approved material',
			summary: 'The answer comes from material the school added to its knowledge base, while the conversation stays attached to the customer profile.',
			message: 'Does this course require coding experience?',
			answer: 'No. The approved syllabus starts at an introductory level and lists no coding prerequisite.',
			source: 'Course syllabus and approved answers',
			action: 'Answer from course knowledge and offer the next conversation step',
			outcome: 'The question and interest remain in the conversation record',
		},
	},
}

const SCENARIO_TONES: Record<ScenarioId, { dot: string; soft: string; border: string; text: string; ring: string }> = {
	store: { dot: 'bg-violet-500', soft: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', ring: 'ring-violet-500/15' },
	food: { dot: 'bg-rose-500', soft: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', ring: 'ring-rose-500/15' },
	booking: { dot: 'bg-sky-500', soft: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', ring: 'ring-sky-500/15' },
	service: { dot: 'bg-amber-500', soft: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', ring: 'ring-amber-500/15' },
	education: { dot: 'bg-emerald-500', soft: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', ring: 'ring-emerald-500/15' },
}

function getScenarios(locale: HomeLocale): ScenarioExperience[] {
	return COMMON_COPY[locale].scenarios.map((scenario) => {
		const id = scenario.id as ScenarioId
		return { ...scenario, id, ...SAFE_SCENARIO_DETAILS[locale][id] }
	})
}

function ScenarioTabs({
	locale,
	scenarios,
	activeId,
	onSelect,
}: {
	locale: HomeLocale
	scenarios: ScenarioExperience[]
	activeId: ScenarioId
	onSelect: (id: ScenarioId) => void
}) {
	const copy = PAGE_COPY[locale]
	const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

	function moveFocus(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
		let nextIndex: number | null = null
		if (event.key === 'Home') nextIndex = 0
		if (event.key === 'End') nextIndex = scenarios.length - 1
		if (event.key === 'ArrowRight') nextIndex = (index + (locale === 'fa' ? -1 : 1) + scenarios.length) % scenarios.length
		if (event.key === 'ArrowLeft') nextIndex = (index + (locale === 'fa' ? 1 : -1) + scenarios.length) % scenarios.length
		if (nextIndex === null) return
		event.preventDefault()
		const next = scenarios[nextIndex]
		onSelect(next.id)
		tabRefs.current[nextIndex]?.focus()
	}

	return (
		<div>
			<div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
				<p className="text-sm font-semibold text-black">{copy.selectorQuestion}</p>
				<p className="text-[10px] leading-5 text-black/42">{copy.selectorHint}</p>
			</div>
			<div className="-mx-1 mt-3 overflow-x-auto px-1 pb-1">
				<div className="grid min-w-[35rem] grid-cols-5 gap-2 sm:min-w-0" role="tablist" aria-label={copy.selectorAria as string}>
					{scenarios.map((scenario, index) => {
						const active = scenario.id === activeId
						const tone = SCENARIO_TONES[scenario.id]
						return (
							<button
								key={scenario.id}
								ref={(element) => { tabRefs.current[index] = element }}
								id={`v5-tab-${scenario.id}`}
								type="button"
								role="tab"
								aria-controls="v5-scenario-panel"
								aria-selected={active}
								tabIndex={active ? 0 : -1}
								onClick={() => onSelect(scenario.id)}
								onKeyDown={(event) => moveFocus(event, index)}
								className={cn(
									'group relative min-h-16 rounded-2xl border px-2 py-2 text-start transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] focus-visible:ring-offset-2',
									active
										? 'border-black bg-black text-white shadow-[0_14px_35px_rgba(0,0,0,0.16)]'
										: 'border-black/[0.075] bg-white text-black/52 hover:-translate-y-0.5 hover:border-black/15 hover:text-black',
								)}
							>
								<span className="flex items-center gap-2">
									<span className={cn('grid h-7 w-7 place-items-center rounded-xl', active ? 'bg-white/10 text-white' : cn(tone.soft, tone.text))}>
										<ProductIcon name={scenario.icon} className="h-3.5 w-3.5" />
									</span>
									<span className={cn('h-2 w-2 rounded-full', tone.dot)} aria-hidden />
								</span>
								<span className="mt-2 block text-[10px] font-semibold leading-5">{scenario.label}</span>
							</button>
						)
					})}
				</div>
			</div>
		</div>
	)
}

function ScenarioDemo({ locale, scenario }: { locale: HomeLocale; scenario: ScenarioExperience }) {
	const copy = PAGE_COPY[locale]
	const reduce = useReducedMotion()
	const tone = SCENARIO_TONES[scenario.id]

	return (
		<div className="relative mt-3 overflow-hidden rounded-[1.85rem] border border-white/10 bg-[#070707] p-3 text-white shadow-[0_32px_90px_rgba(0,0,0,0.22)] sm:p-4">
			<div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-55', styles.darkGrid)} />
			<div aria-hidden className={cn('pointer-events-none absolute inset-0', styles.darkHalo)} />
			<div className="relative flex items-center justify-between gap-3 border-b border-white/10 pb-3">
				<div className="flex min-w-0 items-center gap-2.5">
					<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-black"><Sparkles className="h-4 w-4" aria-hidden /></span>
					<div className="min-w-0"><p className="truncate text-[11px] font-semibold">{copy.demoLabel}</p><p className="mt-0.5 truncate text-[9px] text-white/38">Vigento AI · {scenario.channel}</p></div>
				</div>
				<span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.055] px-2.5 text-[9px] font-medium text-white/48">
					<span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden />{copy.demoState}
				</span>
			</div>

			<div
				id="v5-scenario-panel"
				role="tabpanel"
				aria-live="polite"
				aria-labelledby={`v5-tab-${scenario.id}`}
				className="relative min-h-[30rem] sm:min-h-[27rem]"
			>
				<AnimatePresence mode="wait" initial={false}>
					<m.div
						key={scenario.id}
						initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 14px, 0) scale(0.992)', filter: 'blur(3px)' }}
						animate={{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)', filter: 'blur(0px)' }}
						exit={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, -9px, 0) scale(0.995)', filter: 'blur(2px)' }}
						transition={reduce ? { duration: 0.16 } : { type: 'spring', bounce: 0, duration: 0.42 }}
						className="absolute inset-0 grid content-start gap-3 pt-3 sm:grid-cols-[0.92fr_1.08fr]"
					>
						<div className="rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-2.5">
									<span className={cn('grid h-10 w-10 place-items-center rounded-2xl bg-white text-black ring-4', tone.ring)}><ProductIcon name={scenario.icon} className="h-4 w-4" /></span>
									<div><p className="text-[10px] font-semibold text-white/75">{scenario.label}</p><p className="mt-0.5 text-[9px] text-white/35">{scenario.person} · {scenario.channel}</p></div>
								</div>
								<span className={cn('mt-1 h-2.5 w-2.5 rounded-full', tone.dot)} aria-hidden />
							</div>
							<p className="mt-6 text-[10px] font-medium text-white/35">{copy.incoming}</p>
							<p className="mt-2 rounded-2xl rounded-es-md border border-white/10 bg-white/[0.07] px-3.5 py-3 text-[12px] leading-6 text-white/80">{scenario.message}</p>
							<div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.055] px-3 py-2.5 text-[10px] leading-5 text-emerald-100/70">
								<BookOpenCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />{scenario.source}
							</div>
						</div>

						<div className="flex flex-col rounded-[1.4rem] bg-white p-4 text-black">
							<div className="flex items-center justify-between gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-black text-white"><Bot className="h-4 w-4" aria-hidden /></span><span className="text-[9px] font-semibold text-black/35">{copy.agentAnswer}</span></div>
							<h2 className="mt-5 text-lg font-semibold leading-7 tracking-[-0.02em] rtl:tracking-normal">{scenario.headline}</h2>
							<p className="mt-3 text-[12px] leading-6 text-black/68">{scenario.answer}</p>
							<div className={cn('mt-auto rounded-2xl border p-3.5', tone.soft, tone.border)}>
								<p className={cn('flex items-center gap-1.5 text-[9px] font-bold', tone.text)}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden />{copy.outcome}</p>
								<p className="mt-2 text-[11px] font-medium leading-6 text-black/65">{scenario.outcome}</p>
							</div>
						</div>
					</m.div>
				</AnimatePresence>
			</div>
		</div>
	)
}

function VariantHero({
	locale,
	scenarios,
	activeId,
	onSelect,
}: {
	locale: HomeLocale
	scenarios: ScenarioExperience[]
	activeId: ScenarioId
	onSelect: (id: ScenarioId) => void
}) {
	const copy = PAGE_COPY[locale]
	const hero = VARIANT_COPY[5][locale]
	const scenario = scenarios.find((item) => item.id === activeId) ?? scenarios[0]!

	return (
		<section className="relative overflow-hidden px-5 pb-16 pt-[102px] sm:px-8 sm:pb-20 sm:pt-28 lg:min-h-[min(920px,100svh)] lg:pb-24 lg:pt-32">
			<div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-75', styles.paperGrid)} />
			<div aria-hidden className={cn('pointer-events-none absolute inset-0', styles.softHalo)} />
			<div className="relative mx-auto max-w-7xl">
				<div className="flex justify-center lg:justify-start"><VariantSwitcher variant={5} locale={locale} /></div>
				<div className="mt-8 grid items-center gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12 xl:gap-16">
					<div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-start">
						<TrialBadge locale={locale} />
						<p className="mt-6 text-[10px] font-semibold text-emerald-700">{copy.fiveLabel}</p>
						<p className="mt-3 text-[11px] font-semibold text-black/42">{hero.kicker}</p>
						<h1 className="mt-4 text-[clamp(2.15rem,7vw,4.85rem)] font-semibold leading-[1.13] tracking-[-0.045em] text-black rtl:tracking-normal">
							{hero.title}{' '}<span className="text-black/36">{hero.accent}</span>
						</h1>
						<p className="mx-auto mt-5 max-w-lg text-[15px] leading-8 text-black/52 sm:text-base lg:mx-0">{hero.subtitle}</p>
						<div className="mt-8 flex justify-center lg:justify-start"><HeroActions locale={locale} secondaryHref="#product" /></div>
						<div className="mt-7 grid gap-2 text-start sm:grid-cols-3">
							{COMMON_COPY[locale].proofs.slice(1).map((proof) => (
								<span key={proof} className="flex min-h-12 items-start gap-2 rounded-2xl border border-black/[0.07] bg-white/75 px-3 py-2.5 text-[10px] leading-5 text-black/48 shadow-[0_8px_25px_rgba(0,0,0,0.035)]">
									<Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />{proof}
								</span>
							))}
						</div>
					</div>

					<div className="min-w-0 rounded-[2rem] border border-black/[0.075] bg-white/72 p-3 shadow-[0_30px_90px_rgba(0,0,0,0.09)] backdrop-blur-xl sm:p-4">
						<ScenarioTabs locale={locale} scenarios={scenarios} activeId={activeId} onSelect={onSelect} />
						<ScenarioDemo locale={locale} scenario={scenario} />
					</div>
				</div>
			</div>
		</section>
	)
}

function ProductStory({ locale, scenario }: { locale: HomeLocale; scenario: ScenarioExperience }) {
	const copy = PAGE_COPY[locale]
	const reduce = useReducedMotion()
	const tone = SCENARIO_TONES[scenario.id]
	const trace: Array<{ label: string; value: string; icon: LucideIcon }> = [
		{ label: copy.trace[0]!, value: `${scenario.person} · ${scenario.channel}\n${scenario.message}`, icon: MessageCircleMore },
		{ label: copy.trace[1]!, value: scenario.source, icon: Database },
		{ label: copy.trace[2]!, value: scenario.answer, icon: Bot },
		{ label: copy.trace[3]!, value: scenario.action, icon: Route },
		{ label: copy.trace[4]!, value: scenario.outcome, icon: CheckCircle2 },
	]

	return (
		<Reveal id="product" className="bg-white px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
			<div className="mx-auto max-w-7xl">
				<SectionHeading eyebrow={copy.storyEyebrow as string} title={copy.storyTitle as string} subtitle={copy.storySubtitle as string} align="start" />
				<div className="mt-10 grid gap-4 lg:grid-cols-[0.74fr_1.26fr] lg:items-start lg:gap-6">
					<AnimatePresence mode="wait" initial={false}>
						<m.article
							key={scenario.id}
							initial={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, 12px, 0)' }}
							animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
							exit={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0, -8px, 0)' }}
							transition={reduce ? { duration: 0.16 } : { type: 'spring', bounce: 0, duration: 0.4 }}
							className="relative overflow-hidden rounded-[1.8rem] bg-black p-5 text-white shadow-[0_28px_80px_rgba(0,0,0,0.18)] sm:p-7 lg:sticky lg:top-24"
						>
							<div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-65', styles.darkGrid)} />
							<div className="relative">
								<div className="flex items-center justify-between gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-black"><ProductIcon name={scenario.icon} className="h-5 w-5" /></span><span className={cn('h-3 w-3 rounded-full', tone.dot)} aria-hidden /></div>
								<p className="mt-8 text-[10px] font-semibold text-white/35">{scenario.label} · {scenario.channel}</p>
								<h3 className="mt-3 text-2xl font-semibold leading-9 tracking-[-0.025em] rtl:tracking-normal">{scenario.headline}</h3>
								<p className="mt-4 text-[13px] leading-7 text-white/50">{scenario.summary}</p>
								<div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
									<p className="text-[10px] font-semibold text-emerald-200/70">{copy.outcome}</p>
									<p className="mt-2 text-[12px] leading-6 text-white/72">{scenario.outcome}</p>
								</div>
								<p className="mt-5 flex items-start gap-2 text-[10px] leading-6 text-white/35"><Sparkles className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden />{scenario.id === 'store' ? copy.wooNote : copy.productNote}</p>
							</div>
						</m.article>
					</AnimatePresence>

					<ol className="grid gap-2" aria-label={copy.storyAria as string}>
						{trace.map((step, index) => {
							const Icon = step.icon
							return (
								<RevealBlock key={`${scenario.id}-${step.label}`} delay={index * 0.045}>
									<li className="grid gap-3 rounded-[1.45rem] border border-black/[0.075] bg-[var(--bg-base)] p-4 sm:grid-cols-[44px_1fr_auto] sm:items-center sm:p-5">
										<span className={cn('grid h-11 w-11 place-items-center rounded-2xl border', index === trace.length - 1 ? cn(tone.soft, tone.border, tone.text) : 'border-black/[0.08] bg-white text-black/55')}><Icon className="h-4 w-4" aria-hidden /></span>
										<div><p className="text-[10px] font-semibold text-black/36">{step.label}</p><p className="mt-1.5 whitespace-pre-line text-[12px] font-medium leading-6 text-black/68">{step.value}</p></div>
										<span className="text-[10px] font-semibold tabular-nums text-black/25">{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(index + 1) : `0${index + 1}`}</span>
									</li>
								</RevealBlock>
							)
						})}
					</ol>
				</div>
			</div>
		</Reveal>
	)
}

export function VariantFivePage({ locale, plans }: HomeVariantPageProps) {
	const scenarios = useMemo(() => getScenarios(locale), [locale])
	const [activeId, setActiveId] = useState<ScenarioId>('store')
	const activeScenario = scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0]!

	return (
		<div className={styles.page} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
			<VariantHero locale={locale} scenarios={scenarios} activeId={activeId} onSelect={setActiveId} />
			<TrustRail locale={locale} />
			<ProductStory locale={locale} scenario={activeScenario} />
			<CapabilitySection locale={locale} mode="bento" inverse />
			<OnboardingStory locale={locale} mode="timeline" />
			<PricingPreview locale={locale} plans={plans} />
			<FaqSection locale={locale} />
			<ClosingCta locale={locale} />
		</div>
	)
}
