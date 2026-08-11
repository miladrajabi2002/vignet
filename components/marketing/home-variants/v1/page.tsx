'use client'

import { m, useReducedMotion } from 'framer-motion'
import {
	ArrowDown,
	BookOpenCheck,
	CheckCircle2,
	MessagesSquare,
	PackageCheck,
	ShieldCheck,
} from 'lucide-react'
import { VARIANT_COPY } from '../shared/content'
import type { HomeVariantPageProps } from '../shared/types'
import {
	CapabilitySection,
	ChannelPills,
	ClosingCta,
	EASE_OUT,
	FaqSection,
	HeroActions,
	OnboardingStory,
	OutcomeStats,
	PricingPreview,
	ProductFlowDemo,
	Reveal,
	RevealBlock,
	SectionHeading,
	TrialBadge,
	TrustRail,
	VariantSwitcher,
	styles,
} from '../shared/primitives'

export function VariantOnePage({ locale, plans }: HomeVariantPageProps) {
	const hero = VARIANT_COPY[1][locale]
	const reduce = useReducedMotion()
	const story = locale === 'fa'
		? [
			{
				title: 'پیام از هر کانالی وارد می‌شود',
				description: 'دایرکت اینستاگرام، تلگرام، بله، روبیکا، ویجت یا لینک چت؛ همه در یک صندوق و با پرونده همان مشتری.',
				meta: 'ورودی یکپارچه',
				icon: MessagesSquare,
			},
			{
				title: 'ایجنت منبع و قاعده درست را پیدا می‌کند',
				description: 'محصول، فایل، FAQ، تقویم و قواعد تحویل به انسان بررسی می‌شوند تا پاسخ بر اساس داده تنظیم‌شده ساخته شود.',
				meta: 'قابل بازبینی',
				icon: BookOpenCheck,
			},
			{
				title: 'کار بعدی همان‌جا انجام می‌شود',
				description: 'کارت محصول، زمان خالی، وضعیت سفارش یا تحویل گفتگو به اپراتور؛ کاربر برای قدم بعدی سرگردان نمی‌ماند.',
				meta: 'اقدام در گفتگو',
				icon: PackageCheck,
			},
			{
				title: 'نتیجه در CRM و گزارش می‌ماند',
				description: 'علاقه‌مندی، وضعیت گفتگو و نتیجه اقدام ثبت می‌شوند تا دفعه بعد از صفر شروع نکنید.',
				meta: 'حافظه عملیاتی',
				icon: CheckCircle2,
			},
		]
		: [
			{ title: 'A message arrives from any channel', description: 'Instagram, Telegram, Bale, Rubika, the widget or a chat link all land in one customer-aware inbox.', meta: 'Unified intake', icon: MessagesSquare },
			{ title: 'The agent finds the right source and rule', description: 'Products, files, FAQs, calendars and handoff rules are checked before composing the answer.', meta: 'Reviewable', icon: BookOpenCheck },
			{ title: 'The next action happens in the conversation', description: 'A product card, an available time, order status or a human handoff keeps the customer moving.', meta: 'In-chat action', icon: PackageCheck },
			{ title: 'The outcome stays in CRM and reporting', description: 'Interest, conversation status and the result are recorded so the next interaction starts with context.', meta: 'Operational memory', icon: CheckCircle2 },
		]

	return (
		<div className={styles.page}>
			<section id="product" className="relative scroll-mt-24 overflow-hidden px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32 lg:min-h-[min(900px,100svh)] lg:pt-28">
				<div aria-hidden className={`pointer-events-none absolute inset-0 ${styles.paperGrid} opacity-70`} />
				<div aria-hidden className={`pointer-events-none absolute inset-0 ${styles.softHalo}`} />
				<div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.94fr_1.06fr] lg:gap-12">
					<div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-start">
						<m.div
							initial={reduce ? false : { opacity: 0, transform: 'translate3d(0, 12px, 0)' }}
							animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
							transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_OUT }}
						>
							<TrialBadge locale={locale} />
						</m.div>
						<m.p
							initial={reduce ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={reduce ? { duration: 0 } : { delay: 0.08, duration: 0.4 }}
							className="mt-6 text-[11px] font-semibold text-black/42"
						>
							{hero.kicker}
						</m.p>
						<m.h1
							initial={reduce ? false : { opacity: 0, transform: 'translate3d(0, 18px, 0)' }}
							animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
							transition={reduce ? { duration: 0 } : { delay: 0.12, duration: 0.62, ease: EASE_OUT }}
							className="mt-4 text-[clamp(2rem,4.2vw,3.75rem)] font-semibold leading-[1.2] tracking-[-0.047em] text-black rtl:tracking-normal"
						>
							<span className="block">{hero.title}</span>
							<span className="block text-black/43">{hero.accent}</span>
						</m.h1>
						<m.p
							initial={reduce ? false : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={reduce ? { duration: 0 } : { delay: 0.23, duration: 0.5 }}
							className="mx-auto mt-6 max-w-lg text-[15px] leading-8 text-black/52 lg:mx-0"
						>
							{hero.subtitle}
						</m.p>
						<m.div
							initial={reduce ? false : { opacity: 0, transform: 'translate3d(0, 12px, 0)' }}
							animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
							transition={reduce ? { duration: 0 } : { delay: 0.3, duration: 0.5, ease: EASE_OUT }}
							className="mt-8"
						>
							<HeroActions locale={locale} />
						</m.div>
						<div className="mt-7"><VariantSwitcher variant={1} locale={locale} /></div>
					</div>

					<m.div
						initial={reduce ? false : { opacity: 0, transform: 'translate3d(0, 24px, 0) scale(0.985)' }}
						animate={{ opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }}
						transition={reduce ? { duration: 0 } : { delay: 0.16, duration: 0.72, ease: EASE_OUT }}
						className="relative mx-auto min-w-0 w-full max-w-[760px]"
					>
						<div aria-hidden className="absolute -inset-6 -z-10 rounded-[3rem] bg-black/[0.035] blur-2xl" />
						<ProductFlowDemo locale={locale} />
						<div className="absolute -bottom-5 start-5 hidden items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 py-2 text-[10px] font-semibold text-black/55 shadow-[0_10px_32px_rgba(0,0,0,0.11)] sm:flex">
							<ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
							{locale === 'fa' ? 'پاسخ مبتنی بر منبع · قابل تحویل به انسان' : 'Source-grounded · ready for human handoff'}
						</div>
					</m.div>
				</div>
				<a href="#operations-story" className="relative mx-auto mt-12 hidden h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-black/45 transition-[background-color,color,transform] hover:bg-black hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a84ff] lg:flex" aria-label={locale === 'fa' ? 'رفتن به داستان محصول' : 'Go to product story'}><ArrowDown className="h-4 w-4" /></a>
			</section>

			<TrustRail locale={locale} />

			<Reveal id="operations-story" className="bg-white px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
				<div className="mx-auto max-w-7xl">
					<div className="grid items-start gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
						<div className="lg:sticky lg:top-28">
							<SectionHeading
								eyebrow={locale === 'fa' ? 'داستان هر گفتگو' : 'The story of every conversation'}
								title={locale === 'fa' ? 'پاسخ، پایان کار نیست؛ نتیجه مهم است' : 'The reply is not the finish line. The outcome is.'}
								subtitle={locale === 'fa' ? 'هر مرحله دلیل مرحله بعدی را روشن می‌کند؛ از پیام ورودی تا اتفاقی که برای مشتری و تیم شما افتاده است.' : 'Every stage explains the next, from the incoming message to what changed for the customer and your business.'}
								align="start"
							/>
							<div className="mt-7"><ChannelPills locale={locale} /></div>
							<div className="mt-8"><OutcomeStats locale={locale} /></div>
						</div>

						<div className="relative">
							<div aria-hidden className="absolute bottom-8 start-[23px] top-8 w-px bg-gradient-to-b from-transparent via-black/15 to-transparent sm:start-[31px]" />
							<div className="space-y-3">
								{story.map((item, index) => {
									const Icon = item.icon
									return (
										<RevealBlock key={item.title} delay={index * 0.055} className="relative grid grid-cols-[48px_1fr] gap-3 rounded-[1.65rem] border border-black/[0.075] bg-[var(--bg-base)] p-4 shadow-[0_10px_34px_rgba(0,0,0,0.035)] sm:grid-cols-[64px_1fr_auto] sm:items-center sm:gap-5 sm:p-5">
											<span className="relative z-10 grid h-12 w-12 place-items-center rounded-2xl bg-black text-white sm:h-16 sm:w-16"><Icon className="h-5 w-5 sm:h-6 sm:w-6" /></span>
											<div><p className="text-[10px] font-semibold text-emerald-700">{item.meta}</p><h3 className="mt-1.5 text-sm font-semibold text-black sm:text-base">{item.title}</h3><p className="mt-2 text-[11px] leading-6 text-black/45 sm:text-[12px]">{item.description}</p></div>
											<span className="col-start-2 mt-2 inline-flex min-h-8 items-center gap-1.5 self-center rounded-full border border-black/[0.07] bg-white px-3 text-[10px] font-semibold text-black/38 sm:col-start-auto sm:mt-0"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{locale === 'fa' ? `مرحله ${new Intl.NumberFormat('fa-IR').format(index + 1)}` : `Step ${index + 1}`}</span>
										</RevealBlock>
									)
								})}
							</div>
						</div>
					</div>
				</div>
			</Reveal>

			<CapabilitySection locale={locale} mode="bento" />
			<OnboardingStory locale={locale} mode="console" />
			<PricingPreview locale={locale} plans={plans} />
			<FaqSection locale={locale} />
			<ClosingCta locale={locale} />
		</div>
	)
}
