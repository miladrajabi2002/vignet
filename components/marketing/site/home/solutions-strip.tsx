import Link from 'next/link'
import { Target } from 'lucide-react'
import { Container, ForwardArrow, SectionPill, type SiteLocale } from '../ui'
import { SOLUTION_CARDS, SOLUTION_ORDER } from '../solution-meta'

const COPY = {
	fa: { pill: 'راهکار برای مسئلهٔ شما', title: 'دنبال چه چیزی آمده‌اید؟', all: 'همهٔ راهکارها', compare: 'مقایسه و همه' },
	en: { pill: 'A solution for your problem', title: 'What are you looking for?', all: 'All solutions', compare: 'Compare all' },
} as const

export function SolutionsStrip({ locale }: { locale: SiteLocale }) {
	const c = COPY[locale]
	return (
		<section aria-labelledby="solutions-strip-title" className="vg-cv pt-[52px] lg:pb-[110px] lg:pt-0">
			<Container>
				<div className="vg-rv flex flex-col items-center text-center lg:flex-row lg:items-end lg:justify-between lg:text-start">
					<div className="flex flex-col items-center lg:items-start">
						<SectionPill icon={Target}>{c.pill}</SectionPill>
						<h2 id="solutions-strip-title" className="mt-3 text-[26px] font-bold leading-[1.5] lg:mt-3.5 lg:text-[36px] lg:leading-[1.4]">{c.title}</h2>
					</div>
					<Link href="/solutions" className="hidden items-center gap-1.5 text-[15px] font-medium text-vg-signal lg:inline-flex">
						{c.all}
						<ForwardArrow locale={locale} />
					</Link>
				</div>
				<ul className="vg-rv-group mt-4 grid grid-cols-2 gap-2.5 lg:mt-8 lg:grid-cols-4 lg:gap-3">
					{SOLUTION_ORDER.map((slug) => {
						const meta = SOLUTION_CARDS[slug]
						const Icon = meta.icon
						return (
							<li key={slug}>
								<Link
									href={`/solutions/${slug}`}
									className="vg-press vg-lift group flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-card border border-vg-line bg-white px-2 py-3 text-center text-vg-ink lg:items-start lg:justify-start lg:gap-0 lg:p-5 lg:text-start"
								>
									<span aria-hidden className="inline-flex size-5 text-vg-signal lg:hidden"><Icon className="size-full" strokeWidth={1.8} /></span>
									{/* Desktop: icon tile + a forward arrow, so the card reads as a door, not a label. */}
									<span aria-hidden className="mb-3 hidden w-full items-center justify-between lg:flex">
										<span className="inline-flex size-10 items-center justify-center rounded-control bg-vg-tint text-vg-signal"><Icon className="size-5" strokeWidth={1.8} /></span>
										<ForwardArrow locale={locale} className="text-vg-dim transition-[color,transform] duration-200 group-hover:text-vg-ink rtl:group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
									</span>
									<span className="text-[13.5px] font-bold lg:text-[16px]">{meta.name[locale]}</span>
									<span className="mt-1.5 hidden text-[13px] leading-[1.8] text-vg-cap lg:block">{meta.pitch[locale]}</span>
								</Link>
							</li>
						)
					})}
					<li>
						<Link href="/solutions" className="vg-press vg-lift flex h-full min-h-24 flex-col items-center justify-center gap-2 rounded-card border border-vg-ink bg-vg-ink px-2 text-[13.5px] font-bold text-white lg:flex-row-reverse lg:justify-between lg:p-5 lg:text-[16px]">
							<ForwardArrow locale={locale} className="size-5" />
							<span><span className="lg:hidden">{c.all}</span><span className="hidden lg:inline">{c.compare}</span></span>
						</Link>
					</li>
				</ul>
			</Container>
		</section>
	)
}
