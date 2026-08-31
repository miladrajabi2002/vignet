import type { CSSProperties } from 'react'
import Link from 'next/link'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	Building2,
	Check,
	Clock3,
	Database,
	MessagesSquare,
	Smartphone,
	type LucideIcon,
} from 'lucide-react'
import { COMMON_COPY } from './home-variants/shared/content'
import type { HomeLocale } from './home-variants/shared/types'
import { MarketingSectionHeading } from './section-heading'

const STEP_ICONS: LucideIcon[] = [Smartphone, Building2, Bot, Database, MessagesSquare]

function orderStyle(index: number) {
	return { '--reveal-order': index } as CSSProperties
}

function StepCard({
	locale,
	step,
	index,
}: {
	locale: HomeLocale
	step: (typeof COMMON_COPY)[HomeLocale]['onboardingSteps'][number]
	index: number
}) {
	const Icon = STEP_ICONS[index]
	const number = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', { minimumIntegerDigits: 2 }).format(index + 1)
	return (
		<article
			data-scroll-reveal="up"
			style={orderStyle(index)}
			className="group relative overflow-hidden rounded-[1.35rem] border border-black/[0.075] bg-white p-4 shadow-[0_16px_48px_-36px_rgba(0,0,0,0.32)] lg:p-6"
		>
			<div aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/45 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
			<div className="flex items-start gap-3.5 sm:gap-4">
				<span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 lg:size-12 lg:rounded-[1.05rem]">
					<Icon className="size-5" strokeWidth={1.8} aria-hidden />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="font-mono text-[10px] font-semibold tabular-nums text-black/35">{number}</span>
						<span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-black/[0.045] px-2.5 text-[10px] font-semibold text-black/55">
							<Clock3 className="size-3" aria-hidden />{step.duration}
						</span>
					</div>
					<h3 className="mt-2 text-[15px] font-semibold leading-7 text-black sm:text-base">{step.title}</h3>
				</div>
			</div>
			<p className="mt-3 text-[12px] leading-6 text-black/55 lg:mt-4 lg:text-[13px] lg:leading-7">{step.description}</p>
			<p className="mt-3 flex items-start gap-2 text-[11px] font-semibold leading-6 text-emerald-700">
				<span className="mt-1 grid size-4 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><Check className="size-2.5" aria-hidden /></span>
				{step.result}
			</p>
		</article>
	)
}

export function HomeOnboarding({ locale }: { locale: HomeLocale }) {
	const copy = COMMON_COPY[locale]
	const fa = locale === 'fa'
	const Arrow = fa ? ArrowLeft : ArrowRight

	return (
		<section id="vigento" className="marketing-story-section marketing-section-onboarding relative scroll-mt-24 overflow-hidden bg-[var(--bg-base)] px-5 py-16 sm:px-8 sm:py-24 lg:py-28">
			<span id="onboarding" className="absolute top-0 scroll-mt-24" aria-hidden />
			<div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.07),transparent_28rem)]" />
			<div className="relative mx-auto max-w-6xl">
				<MarketingSectionHeading eyebrow={copy.onboardingEyebrow} title={copy.onboardingTitle} subtitle={copy.onboardingSubtitle} />

				<div className="mt-10 items-start gap-10 lg:mt-14 lg:grid lg:grid-cols-[0.72fr_1.28fr] xl:gap-14">
					<aside data-scroll-reveal="side" className="sticky top-28 hidden overflow-hidden rounded-[1.75rem] bg-[#090909] p-7 text-white shadow-[0_28px_80px_rgba(0,0,0,0.2)] lg:block">
						<div aria-hidden className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-40" />
						<div className="relative">
							<span className="grid size-12 place-items-center rounded-2xl bg-white text-black"><Clock3 className="size-5" aria-hidden /></span>
							<p className="mt-8 text-[11px] font-semibold text-emerald-300">{fa ? 'زمان تا اولین گفتگوی واقعی' : 'Time to your first real conversation'}</p>
							<p className="mt-2 text-4xl font-semibold tracking-[-0.04em] rtl:tracking-normal">{fa ? 'کمتر از ۷ دقیقه' : 'Under 7 minutes'}</p>
							<p className="mt-4 text-[13px] leading-7 text-white/50">{fa ? 'هر مرحله یک خروجی روشن دارد؛ هرجا خواستید متوقف شوید و بعداً از همان‌جا ادامه دهید.' : 'Every step has a clear outcome. Stop anytime and continue exactly where you left off.'}</p>
							<div className="mt-7 grid grid-cols-5 gap-1.5" aria-hidden>
								{copy.onboardingSteps.map((step, index) => <span key={step.title} className="h-1.5 rounded-full bg-emerald-300" style={{ opacity: 1 - index * 0.12 }} />)}
							</div>
						</div>
					</aside>
					<div className="relative">
						<div aria-hidden className="absolute bottom-6 start-[1.3rem] top-6 w-px bg-gradient-to-b from-emerald-400/50 via-black/10 to-transparent lg:hidden" />
						<ol className="space-y-3 ps-11 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:ps-0">
							{copy.onboardingSteps.map((step, index) => (
								<li key={step.title} className={`relative ${index === copy.onboardingSteps.length - 1 ? 'lg:col-span-2' : ''}`}>
									<span aria-hidden className="absolute -start-[1.72rem] top-6 z-10 size-3 rounded-full border-[3px] border-[var(--bg-base)] bg-emerald-500 lg:hidden" />
									<StepCard locale={locale} step={step} index={index} />
								</li>
							))}
						</ol>
					</div>
				</div>

				<div data-scroll-reveal="up" className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
					<Link href="/login?next=/onboarding" className="marketing-pressable group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(0,0,0,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)] focus-visible:ring-offset-2">
						{copy.primaryCta}<Arrow className="size-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" aria-hidden />
					</Link>
					<Link href="#pricing" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-sm font-medium text-black transition-colors hover:bg-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)]">
						{fa ? 'دیدن هزینه‌ها' : 'See pricing'}
					</Link>
				</div>
			</div>
		</section>
	)
}
