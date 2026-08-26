'use client'

import { useState, type ReactNode } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COMMON_COPY } from './home-variants/shared/content'
import type { HomeLocale } from './home-variants/shared/types'
import { SectionHeading, StorySection } from './home-variants/shared/chrome'
import { EASE_OUT, RevealBlock } from './home-variants/shared/scroll'
import { BookingMock, ChatThread, InstagramMock, ProductIcon } from './home-variants/shared/mocks'
import styles from './home-variants/home-variants.module.css'

/* ------------------------------------------------------------------ */
/* Capabilities bento — "یک سیستم، نه چند ابزار پراکنده"              */
/* ------------------------------------------------------------------ */

export function CapabilitiesBento({ locale }: { locale: HomeLocale }) {
	const copy = COMMON_COPY[locale]
	return (
		<StorySection id="solutions" className="bg-white">
			<div className="mx-auto max-w-7xl">
				<SectionHeading eyebrow={copy.pillarsEyebrow} title={copy.pillarsTitle} subtitle={copy.pillarsSubtitle} />
				<div className="mt-12 grid gap-4 md:grid-cols-2">
					{copy.pillars.map((pillar, index) => (
						<RevealBlock
							key={pillar.title}
							delay={(index % 2) * 0.06}
							className="group flex gap-5 rounded-[1.5rem] border border-black/[0.075] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.07)] sm:p-7"
						>
							<span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black text-white transition-transform duration-300 group-hover:scale-110">
								<ProductIcon name={pillar.icon} className="h-5 w-5" />
							</span>
							<div className="min-w-0">
								<h3 className="text-[15.5px] font-semibold">{pillar.title}</h3>
								<p className="mt-2 text-[12.5px] leading-7 text-black/50">{pillar.description}</p>
								<div className="mt-4 flex flex-wrap gap-2">
									{pillar.tags.map((tag) => (
										<span key={tag} className="inline-flex min-h-7 items-center rounded-full border border-black/[0.07] bg-black/[0.025] px-2.5 text-[10px] font-medium text-black/50">
											{tag}
										</span>
									))}
								</div>
							</div>
						</RevealBlock>
					))}
				</div>
			</div>
		</StorySection>
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
				<InstagramMock locale={locale} inverse />
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
