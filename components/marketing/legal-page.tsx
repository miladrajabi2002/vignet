import { ShieldCheck } from 'lucide-react'
import { LegalMobileNavigation } from '@/components/marketing/legal-mobile-navigation'

export type LegalSection = {
	title: string
	paragraphs?: string[]
	items?: string[]
}

export function LegalPage({
	eyebrow,
	title,
	description,
	updatedAt,
	sections,
}: {
	eyebrow: string
	title: string
	description: string
	updatedAt: string
	sections: LegalSection[]
}) {
	return (
		<div className="marketing-page-shell min-h-screen px-3 pb-20 pt-24 sm:px-5 sm:pt-28">
			<div className="mx-auto max-w-6xl">
				<header className="marketing-page-hero marketing-grid-dark px-6 py-10 text-white sm:px-9 sm:py-14">
					<div className="relative z-10 max-w-3xl">
						<p className="inline-flex items-center gap-2 text-[10px] font-medium text-white/45">
							<ShieldCheck className="h-3.5 w-3.5" />
							{eyebrow}
						</p>
						<h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.25] tracking-[-0.04em] sm:text-5xl rtl:tracking-normal">
							{title}
						</h1>
						<p className="mt-4 max-w-2xl text-sm leading-7 text-white/55">{description}</p>
						<p className="mt-6 text-[11px] text-white/35">{updatedAt}</p>
					</div>
				</header>

				<div className="relative z-10 -mt-5 grid gap-4 px-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
					<LegalMobileNavigation sections={sections.map((section) => section.title)} />

					<article className="spatial-surface rounded-[1.75rem] bg-white p-6 sm:p-9">
						<div className="mx-auto max-w-3xl space-y-10">
							{sections.map((section, index) => (
								<LegalSectionBlock key={section.title} index={index + 1} section={section} />
							))}
						</div>
					</article>

					<aside className="spatial-surface hidden rounded-[1.5rem] bg-white p-5 lg:sticky lg:top-24 lg:block">
						<p className="text-xs font-semibold text-black">خلاصه سند</p>
						<nav className="mt-3" aria-label="فهرست سند">
							<ol className="space-y-1">
								{sections.map((section, index) => (
									<li key={section.title}>
										<a
											href={`#section-${index + 1}`}
											className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-[11px] leading-5 text-black/50 transition-colors hover:bg-black/[0.035] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
										>
										<span className="font-mono text-xs text-black/35">{String(index + 1).padStart(2, '0')}</span>
											{section.title}
										</a>
									</li>
								))}
							</ol>
						</nav>
					</aside>
				</div>
			</div>
		</div>
	)
}

function LegalSectionBlock({
	index,
	section,
}: {
	index: number
	section: LegalSection
}) {
	return (
		<section id={`section-${index}`} className="scroll-mt-28">
			<div className="flex items-start gap-3">
				<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black font-mono text-xs text-white">
					{String(index).padStart(2, '0')}
				</span>
				<div className="min-w-0 flex-1">
					<h2 className="text-lg font-semibold text-black sm:text-xl">{section.title}</h2>
					{section.paragraphs?.map((paragraph) => (
						<p key={paragraph} className="mt-4 text-sm leading-8 text-black/60">
							{paragraph}
						</p>
					))}
					{section.items && (
						<ul className="mt-4 space-y-3 text-sm leading-7 text-black/60">
							{section.items.map((item) => (
								<li key={item} className="flex items-start gap-3">
									<span aria-hidden className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-black/35" />
									<span>{item}</span>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</section>
	)
}
