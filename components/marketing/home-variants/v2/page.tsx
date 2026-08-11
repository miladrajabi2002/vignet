'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m, useInView, useReducedMotion } from 'framer-motion'
import {
	Bot,
	Check,
	CheckCircle2,
	CircleUserRound,
	DatabaseZap,
	MessageCircleMore,
	PackageCheck,
	Sparkles,
} from 'lucide-react'
import { COMMON_COPY, VARIANT_COPY } from '../shared/content'
import { InstagramIcon } from '@/components/marketing/social-links'
import type { HomeLocale, HomeVariantPageProps } from '../shared/types'
import {
	CapabilitySection,
	ClosingCta,
	EASE_IN_OUT,
	EASE_OUT,
	FaqSection,
	HeroActions,
	OnboardingStory,
	PricingPreview,
	Reveal,
	SectionHeading,
	TrialBadge,
	TrustRail,
	VariantSwitcher,
	styles,
} from '../shared/primitives'

type JourneyStep = {
	eyebrow: string
	title: string
	description: string
	result: string
	icon: typeof MessageCircleMore
}

function JourneyChapter({
	step,
	index,
	active,
	onEnter,
}: {
	step: JourneyStep
	index: number
	active: boolean
	onEnter: (index: number) => void
}) {
	const ref = useRef<HTMLDivElement>(null)
	const inView = useInView(ref, { amount: 0.62 })
	const reduce = useReducedMotion()
	useEffect(() => {
		if (inView) onEnter(index)
	}, [inView, index, onEnter])

	return (
		<m.article
			ref={ref}
			initial={reduce ? false : { opacity: 0.35, transform: 'translate3d(0, 18px, 0)' }}
			animate={active ? { opacity: 1, transform: 'translate3d(0, 0, 0)' } : { opacity: 0.4, transform: 'translate3d(0, 0, 0)' }}
			transition={reduce ? { duration: 0 } : { duration: 0.36, ease: EASE_OUT }}
			className="flex min-h-[46vh] items-center border-b border-white/10 py-12 last:border-b-0 lg:min-h-[64vh] lg:py-20"
		>
			<div className="max-w-lg">
				<div className="flex items-center gap-3">
					<span className={`grid h-11 w-11 place-items-center rounded-2xl border ${active ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-white/[0.045] text-white/35'}`}>
						<step.icon className="h-5 w-5" aria-hidden />
					</span>
					<span className="text-[10px] font-semibold text-white/35">{step.eyebrow}</span>
				</div>
				<h3 className="mt-6 text-2xl font-semibold leading-[1.35] text-white sm:text-3xl">{step.title}</h3>
				<p className="mt-3 text-[13px] leading-8 text-white/48 sm:text-sm">{step.description}</p>
				<p className="mt-5 inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-3 text-[10px] font-semibold text-emerald-200"><Check className="h-3.5 w-3.5" />{step.result}</p>
			</div>
		</m.article>
	)
}

function JourneyConsole({ locale, active, steps }: { locale: HomeLocale; active: number; steps: JourneyStep[] }) {
	const reduce = useReducedMotion()
	const scenario = COMMON_COPY[locale].scenarios[0]
	const activeStep = steps[active]
	const Icon = activeStep.icon

	return (
		<div className="relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-[#0b0b0b] p-4 text-white shadow-[0_34px_95px_rgba(0,0,0,0.35)] sm:p-5">
			<div aria-hidden className={`pointer-events-none absolute inset-0 ${styles.darkGrid} opacity-55`} />
			<div aria-hidden className={`pointer-events-none absolute inset-0 ${styles.darkHalo}`} />
			<div className="relative">
				<header className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
					<div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black"><Sparkles className="h-4 w-4" /></span><div><p className="text-[11px] font-semibold">{locale === 'fa' ? 'ردیابی زنده پیام' : 'Live message journey'}</p><p className="mt-0.5 text-[10px] text-white/35">{scenario.person} · {scenario.channel}</p></div></div>
					<span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">{locale === 'fa' ? 'در حال پردازش' : 'Processing'}</span>
				</header>

				<div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
					<p className="text-[10px] font-semibold text-white/35">{scenario.channel}</p>
					<div className="mt-3 flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400"><InstagramIcon className="h-4 w-4" /></span><p className="text-[12px] leading-6 text-white/75">{scenario.message}</p></div>
				</div>

				<div className="relative my-3 h-10">
					<div className="absolute start-5 top-1/2 h-px w-[calc(100%-2.5rem)] bg-white/12" />
					<m.span
						className="absolute start-5 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]"
						animate={reduce ? undefined : { transform: locale === 'fa' ? ['translate3d(0,-50%,0)', 'translate3d(-270px,-50%,0)'] : ['translate3d(0,-50%,0)', 'translate3d(270px,-50%,0)'] }}
						transition={reduce ? undefined : { duration: 2.2, repeat: Infinity, ease: EASE_IN_OUT }}
					/>
				</div>

				<div className="min-h-[215px] rounded-2xl bg-white p-4 text-black sm:p-5">
					<div className="flex items-center justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white"><Icon className="h-4 w-4" /></span><span className="text-[10px] font-semibold tabular-nums text-black/35">{locale === 'fa' ? new Intl.NumberFormat('fa-IR').format(active + 1) : active + 1} / 5</span></div>
					<AnimatePresence mode="wait" initial={false}>
						<m.div key={active} initial={reduce ? false : { opacity: 0, transform: 'translate3d(0,9px,0)', filter: 'blur(2px)' }} animate={{ opacity: 1, transform: 'translate3d(0,0,0)', filter: 'blur(0px)' }} exit={reduce ? { opacity: 0 } : { opacity: 0, transform: 'translate3d(0,-6px,0)', filter: 'blur(2px)' }} transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE_OUT }} className="mt-5">
							<p className="text-[10px] font-semibold text-emerald-700">{activeStep.eyebrow}</p>
							<h4 className="mt-2 text-base font-semibold">{activeStep.title}</h4>
							<p className="mt-2 text-[11px] leading-6 text-black/48">{activeStep.result}</p>
						</m.div>
					</AnimatePresence>
				</div>

				<div className="mt-4 grid grid-cols-5 gap-1.5">
					{steps.map((step, index) => <span key={step.title} className={`h-1.5 rounded-full transition-colors duration-200 ${index <= active ? 'bg-emerald-300' : 'bg-white/10'}`} />)}
				</div>
			</div>
		</div>
	)
}

export function VariantTwoPage({ locale, plans }: HomeVariantPageProps) {
	const hero = VARIANT_COPY[2][locale]
	const reduce = useReducedMotion()
	const [active, setActive] = useState(0)
	const steps: JourneyStep[] = locale === 'fa'
		? [
			{ eyebrow: '۱ · ورود', title: 'پیام و هویت مشتری کنار هم وارد می‌شوند', description: 'کانال، متن پیام و سابقه قبلی در یک صندوق دیده می‌شوند؛ اپراتور لازم نیست بین چند ابزار دنبال زمینه بگردد.', result: 'یک ورودی یکپارچه با زمینه مشتری', icon: MessageCircleMore },
			{ eyebrow: '۲ · فهم', title: 'هدف پیام و مسیر درست تشخیص داده می‌شود', description: 'ایجنت می‌فهمد مشتری سؤال دارد، قصد خرید دارد، زمان رزرو می‌خواهد یا باید به انسان تحویل داده شود.', result: 'قصد مشتری و قاعده پاسخ مشخص شد', icon: CircleUserRound },
			{ eyebrow: '۳ · منبع', title: 'پاسخ از داده تنظیم‌شده پیدا می‌شود', description: 'کاتالوگ، فایل، FAQ، وضعیت سفارش یا تقویم بررسی می‌شود و پاسخ مرکز یادگیری فقط پس از تأیید به دانش اضافه می‌شود.', result: 'منبع پاسخ برای بازبینی روشن است', icon: DatabaseZap },
			{ eyebrow: '۴ · اقدام', title: 'گفتگو به قدم بعدی واقعی می‌رسد', description: 'محصول پیشنهاد می‌شود، زمان آزاد نشان داده می‌شود، وضعیت سفارش می‌آید یا گفتگو همراه خلاصه به اپراتور می‌رسد.', result: 'اقدام بعدی بدون قطع گفتگو', icon: PackageCheck },
			{ eyebrow: '۵ · نتیجه', title: 'نتیجه در پرونده مشتری باقی می‌ماند', description: 'وضعیت گفتگو، علاقه‌مندی و نتیجه ثبت می‌شوند تا پیگیری بعدی با زمینه کامل انجام شود.', result: 'CRM و گزارش به‌روز شدند', icon: CheckCircle2 },
		]
		: [
			{ eyebrow: '1 · Intake', title: 'The message and customer context arrive together', description: 'Channel, message and previous context land in one inbox, so nobody searches across tools.', result: 'One customer-aware intake', icon: MessageCircleMore },
			{ eyebrow: '2 · Understand', title: 'The intent and the right path are identified', description: 'The agent distinguishes a question, purchase intent, a booking request or a case that needs a person.', result: 'Intent and response rule selected', icon: CircleUserRound },
			{ eyebrow: '3 · Ground', title: 'The answer comes from configured data', description: 'Catalog, files, FAQs, order status or availability are checked. Suggested learning still needs approval.', result: 'The answer source stays visible', icon: DatabaseZap },
			{ eyebrow: '4 · Act', title: 'The conversation reaches a real next step', description: 'Recommend a product, show an available time, surface order status or hand over with a summary.', result: 'The next action stays in the conversation', icon: PackageCheck },
			{ eyebrow: '5 · Record', title: 'The outcome remains on the customer profile', description: 'Conversation state, interest and result are saved so the next follow-up begins with context.', result: 'CRM and reporting are updated', icon: CheckCircle2 },
		]

	return (
		<div className={styles.page}>
			<section className="relative overflow-hidden px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32">
				<div aria-hidden className={`pointer-events-none absolute inset-0 ${styles.paperGrid} opacity-60`} />
				<div aria-hidden className={`pointer-events-none absolute inset-0 ${styles.softHalo}`} />
				<div className="relative mx-auto max-w-6xl text-center">
					<m.div initial={reduce ? false : { opacity: 0, transform: 'translate3d(0,12px,0)' }} animate={{ opacity: 1, transform: 'translate3d(0,0,0)' }} transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_OUT }}><TrialBadge locale={locale} /></m.div>
					<p className="mt-6 text-[11px] font-semibold text-black/42">{hero.kicker}</p>
					<m.h1 initial={reduce ? false : { opacity: 0, transform: 'translate3d(0,20px,0)' }} animate={{ opacity: 1, transform: 'translate3d(0,0,0)' }} transition={reduce ? { duration: 0 } : { delay: 0.08, duration: 0.64, ease: EASE_OUT }} className="mx-auto mt-4 max-w-5xl text-[clamp(2.25rem,7.4vw,6.1rem)] font-semibold leading-[1.13] tracking-[-0.052em] text-black rtl:tracking-normal"><span className="block">{hero.title}</span><span className="block text-black/38">{hero.accent}</span></m.h1>
					<p className="mx-auto mt-6 max-w-2xl text-[15px] leading-8 text-black/50">{hero.subtitle}</p>
					<div className="mt-8 flex justify-center"><HeroActions locale={locale} /></div>
					<div className="mt-7"><VariantSwitcher variant={2} locale={locale} /></div>

					<m.div initial={reduce ? false : { opacity: 0, transform: 'translate3d(0,24px,0)' }} animate={{ opacity: 1, transform: 'translate3d(0,0,0)' }} transition={reduce ? { duration: 0 } : { delay: 0.2, duration: 0.68, ease: EASE_OUT }} className="mx-auto mt-14 grid max-w-5xl items-center gap-3 rounded-[1.7rem] border border-black/[0.08] bg-white/88 p-3 shadow-[0_22px_70px_rgba(0,0,0,0.09)] sm:grid-cols-[1fr_auto_1fr] sm:p-4">
						<div className="rounded-2xl bg-[var(--bg-base)] p-4 text-start"><p className="text-[10px] font-semibold text-black/35">{locale === 'fa' ? 'پیام مشتری · اینستاگرام' : 'Customer message · Instagram'}</p><p className="mt-2 text-[12px] font-medium leading-6 text-black/72">{COMMON_COPY[locale].scenarios[0].message}</p></div>
						<div className="relative mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-black text-white shadow-[0_12px_30px_rgba(0,0,0,0.2)]"><Bot className="h-5 w-5" /><span className={`absolute -end-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 ${styles.livePulse}`} /></div>
						<div className="rounded-2xl bg-black p-4 text-start text-white"><p className="text-[10px] font-semibold text-emerald-200">{locale === 'fa' ? 'نتیجه ثبت‌شده' : 'Recorded outcome'}</p><p className="mt-2 text-[12px] font-medium leading-6 text-white/78">{COMMON_COPY[locale].scenarios[0].outcome}</p></div>
					</m.div>
				</div>
			</section>

			<TrustRail locale={locale} />

			<Reveal id="product" className="relative overflow-visible bg-[#070707] px-5 py-20 text-white sm:px-8 sm:py-24 lg:py-28" dark amount={0.05}>
				<div aria-hidden className={`pointer-events-none absolute inset-0 ${styles.darkGrid} opacity-35`} />
				<div className="relative mx-auto max-w-7xl">
					<SectionHeading eyebrow={locale === 'fa' ? 'پنج ایستگاه روشن' : 'Five visible stations'} title={locale === 'fa' ? 'مسیر یک پیام را از ورود تا نتیجه دنبال کنید' : 'Follow one message from arrival to outcome'} subtitle={locale === 'fa' ? 'این روایت با اسکرول طبیعی جلو می‌رود؛ هیچ حرکت اجباری یا اسکرول‌جکینگی در کار نیست.' : 'The story advances with native scrolling. There is no scroll hijacking.'} inverse />
					<div className="mt-12 grid items-start gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
						<div className="lg:sticky lg:top-24"><JourneyConsole locale={locale} active={active} steps={steps} /></div>
						<div>{steps.map((step, index) => <JourneyChapter key={step.title} step={step} index={index} active={active === index} onEnter={setActive} />)}</div>
					</div>
				</div>
			</Reveal>

			<CapabilitySection locale={locale} mode="stack" />
			<OnboardingStory locale={locale} mode="timeline" />
			<PricingPreview locale={locale} plans={plans} />
			<FaqSection locale={locale} />
			<ClosingCta locale={locale} />
		</div>
	)
}
