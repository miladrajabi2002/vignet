import { Fragment, type CSSProperties } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COMMON_COPY, type PillarItem } from './home-variants/shared/content'
import type { HomeLocale } from './home-variants/shared/types'
import { ProductIcon } from './product-icon'
import styles from './home-variants/home-variants.module.css'

const ROW_CLASSES = ['lg:row-start-1', 'lg:row-start-2', 'lg:row-start-3', 'lg:row-start-4'] as const

function formatStep(index: number, locale: HomeLocale) {
	return new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US', {
		minimumIntegerDigits: 2,
		useGrouping: false,
	}).format(index + 1)
}

function revealOrder(index: number) {
	return { '--reveal-order': index } as CSSProperties
}

function CapabilityCard({
	pillar,
	index,
	locale,
	className,
}: {
	pillar: PillarItem
	index: number
	locale: HomeLocale
	className?: string
}) {
	return (
		<article
			dir={locale === 'fa' ? 'rtl' : 'ltr'}
			data-scroll-reveal={index % 2 === 0 ? 'side' : 'side-reverse'}
			style={revealOrder(index % 4)}
			className={cn(
				styles.capabilityCard,
				'relative min-w-0 rounded-[1.35rem] border p-4 sm:p-5 lg:min-h-[13rem] lg:rounded-[1.55rem] lg:p-6',
				className,
			)}
		>
			<span aria-hidden className="absolute -start-[1.65rem] top-7 z-10 size-3 rounded-full border-[3px] border-[#f6faf8] bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.24),0_0_16px_rgba(16,185,129,0.25)] lg:hidden" />
			<div className="flex items-start gap-3.5 sm:gap-4">
				<span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#101514] text-white shadow-[0_10px_28px_rgba(5,20,16,0.15)] sm:size-12">
					<ProductIcon name={pillar.icon} className="size-[1.15rem] sm:size-5" />
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-3">
						<h3 className="text-[14px] font-semibold leading-6 text-[#101817] sm:text-[15px] sm:leading-7">{pillar.title}</h3>
						<span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-emerald-600">{formatStep(index, locale)}</span>
					</div>
					<p className="mt-1.5 text-[12px] leading-6 text-[#42504d] sm:mt-2 sm:leading-7">{pillar.description}</p>
				</div>
			</div>

			<div className="mt-4 hidden flex-wrap gap-1.5 sm:flex sm:gap-2">
				{pillar.tags.map((tag) => (
					<span key={tag} className="inline-flex min-h-7 items-center rounded-full border border-emerald-950/[0.08] bg-white/80 px-2.5 text-[10px] font-medium text-[#52605d]">
						{tag}
					</span>
				))}
			</div>
		</article>
	)
}

function CapabilityMap({ locale }: { locale: HomeLocale }) {
	const pillars = COMMON_COPY[locale].pillars
	return (
		<div className="relative mx-auto mt-9 max-w-[1180px] lg:mt-16">
			<div aria-hidden className="marketing-capability-rail absolute bottom-5 start-[1.15rem] top-5 w-[2px] rounded-full lg:bottom-6 lg:left-1/2 lg:start-auto lg:top-6 lg:-translate-x-1/2" />
			<div className="grid gap-3 ps-10 lg:grid-cols-[minmax(0,1fr)_6.75rem_minmax(0,1fr)] lg:grid-rows-4 lg:gap-y-5 lg:ps-0 lg:[direction:ltr]">
				{Array.from({ length: 4 }, (_, row) => {
					const leftIndex = row * 2
					const rightIndex = leftIndex + 1
					return (
						<Fragment key={row}>
							<CapabilityCard pillar={pillars[leftIndex]} index={leftIndex} locale={locale} className={cn('lg:col-start-1', ROW_CLASSES[row])} />
							<div aria-hidden className={cn('relative z-20 hidden min-h-[13rem] items-center justify-center lg:col-start-2 lg:flex', ROW_CLASSES[row])}>
								<span className={cn(styles.capabilityConnector, 'absolute inset-x-0 top-1/2 h-px')} />
								<span className="relative grid size-8 place-items-center rounded-xl border border-emerald-500/20 bg-white text-[10px] font-bold text-emerald-700 shadow-[0_8px_24px_rgba(16,185,129,0.16)]">{row + 1}</span>
							</div>
							<CapabilityCard pillar={pillars[rightIndex]} index={rightIndex} locale={locale} className={cn('lg:col-start-3', ROW_CLASSES[row])} />
						</Fragment>
					)
				})}
			</div>
		</div>
	)
}

export function CapabilitiesSection({ locale }: { locale: HomeLocale }) {
	const copy = COMMON_COPY[locale]
	const fa = locale === 'fa'
	const titleStart = fa ? 'از اولین پیام مشتری تا نتیجه‌ای که در کسب‌وکار' : 'From the first customer message to an outcome'
	const titleAccent = fa ? 'ثبت می‌شود' : 'recorded in your business'
	const resultLabel = fa ? 'یک جریان یکپارچه و قابل پیگیری' : 'One connected, traceable flow'
	const resultSteps = fa
		? ['همهٔ کانال‌ها', 'دانش معتبر', 'اقدام خودکار', 'نتیجهٔ ثبت‌شده']
		: ['Every channel', 'Trusted knowledge', 'Automated action', 'Recorded outcome']

	return (
		<section id="solutions" className="marketing-story-section marketing-section-capabilities scroll-mt-24 overflow-hidden bg-white px-3 py-14 sm:px-5 sm:py-20 lg:px-8">
			<div className={cn(styles.capabilityCanvas, 'relative mx-auto max-w-[1380px] overflow-hidden rounded-[2rem] border border-emerald-950/[0.06] px-4 py-12 sm:rounded-[2.75rem] sm:px-8 sm:py-20 lg:px-12 lg:py-24')}>
				<div aria-hidden className={cn(styles.capabilityGrid, 'pointer-events-none absolute inset-0')} />
				<div aria-hidden className="pointer-events-none absolute -end-20 top-20 size-72 rounded-full bg-emerald-300/15 blur-[90px]" />
				<div aria-hidden className="pointer-events-none absolute -start-24 top-1/3 size-80 rounded-full bg-indigo-200/20 blur-[110px]" />

				<div className="relative mx-auto max-w-7xl">
					<header data-scroll-reveal="up" className="mx-auto max-w-4xl text-center">
						<span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-950/[0.08] bg-white/85 px-4 text-[11px] font-semibold text-[#40504c] shadow-[0_8px_28px_rgba(15,80,60,0.07)]">
							<span className="relative flex size-2">
								<span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40 motion-reduce:animate-none" />
								<span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
							</span>
							{copy.pillarsEyebrow}
						</span>
						<h2 aria-label={copy.pillarsTitle} className="mx-auto mt-5 max-w-4xl text-balance text-[clamp(1.8rem,5.4vw,4.15rem)] font-semibold leading-[1.24] tracking-[-0.035em] text-[#0c1715] rtl:tracking-normal">
							<span aria-hidden>{titleStart} </span>
							<span aria-hidden className="text-emerald-600">{titleAccent}</span>
						</h2>
						<p className="mx-auto mt-5 max-w-3xl text-pretty text-[13px] leading-7 text-[#4d5b58] sm:text-[15px] sm:leading-8">{copy.pillarsSubtitle}</p>
					</header>

					<CapabilityMap locale={locale} />

					<div data-scroll-reveal="scale" className="mx-auto mt-9 max-w-4xl sm:mt-14">
						<div className="flex flex-col items-center justify-between gap-4 rounded-[1.35rem] border border-emerald-950/[0.07] bg-white/90 px-4 py-4 shadow-[0_16px_50px_rgba(15,80,60,0.08)] sm:flex-row sm:px-6">
							<p className="flex items-center gap-2.5 text-center text-[11px] font-semibold text-[#34433f] sm:text-start sm:text-[12px]">
								<span className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Sparkles className="size-4" aria-hidden /></span>
								{resultLabel}
							</p>
							<div className="grid w-full grid-cols-2 gap-1.5 text-[10px] font-medium text-[#64716e] sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center sm:gap-2">
								{resultSteps.map((step) => (
									<span key={step} className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full bg-emerald-950/[0.045] px-2.5 text-center">
										<Check className="size-3 text-emerald-600" aria-hidden />{step}
									</span>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
