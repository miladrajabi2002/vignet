import { ExternalLink, Star } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { HomeLocale } from './home-variants/shared/types'
import { MarketingSectionHeading } from './section-heading'

const CHANNEL_LABELS: Record<HomeLocale, Record<string, string>> = {
	fa: {
		INSTAGRAM: 'اینستاگرام',
		TELEGRAM: 'تلگرام',
		BALE: 'بله',
		RUBIKA: 'روبیکا',
		WEB: 'وب‌سایت',
		WOOCOMMERCE: 'ووکامرس',
	},
	en: {
		INSTAGRAM: 'Instagram',
		TELEGRAM: 'Telegram',
		BALE: 'Bale',
		RUBIKA: 'Rubika',
		WEB: 'Website',
		WOOCOMMERCE: 'WooCommerce',
	},
}

export type ShowcaseCard = {
	id: string
	name: string
	handle: string | null
	url: string | null
	imageUrl: string | null
	channels: string[]
	quote: string | null
	metricValue: string | null
	metricLabel: string | null
	featured: boolean
}

/**
 * Customer showcase — fully managed from the admin panel (/admin/showcase).
 * Renders nothing until the first active entry exists, so the homepage stays
 * clean until real customer stories are ready to publish.
 */
export async function ShowcaseSection({ locale }: { locale: HomeLocale }) {
	let entries: ShowcaseCard[] = []
	try {
		entries = await prisma.showcaseEntry.findMany({
			where: { active: true },
			orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
			take: 12,
			select: {
				id: true,
				name: true,
				handle: true,
				url: true,
				imageUrl: true,
				channels: true,
				quote: true,
				metricValue: true,
				metricLabel: true,
				featured: true,
			},
		})
	} catch {
		// Marketing must never fail because of a DB hiccup — hide the section.
		return null
	}

	if (entries.length === 0) return null

	const fa = locale === 'fa'
	const labels = CHANNEL_LABELS[locale]

	return (
		<section id="showcase" className="marketing-story-section scroll-mt-24 bg-[var(--bg-surface)] py-16 sm:py-20">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<MarketingSectionHeading
					align="center"
					eyebrow={fa ? 'ویترین مشتریان' : 'Customer showcase'}
					title={fa ? 'کسب‌وکارهایی که با ویجنت پاسخ می‌دهند' : 'Businesses answering with Vigent'}
					subtitle={fa
						? 'از فروشگاه‌های اینستاگرامی تا خدمات رزرو — این‌ها همین حالا با ایجنت ویجنت به مشتریانشان پاسخ می‌دهند.'
						: 'From Instagram shops to booking services — these businesses answer their customers with a Vigent agent right now.'}
				/>

				<ul className="mx-auto mt-9 grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{entries.map((entry, index) => {
						const link = entry.url || (entry.handle ? `https://instagram.com/${entry.handle}` : null)
						const card = (
							<>
								<div className="flex items-start gap-3">
									{entry.imageUrl ? (
										<img
											src={entry.imageUrl}
											alt={entry.name}
											width={52}
											height={52}
											loading="lazy"
											decoding="async"
											className="h-13 w-13 shrink-0 rounded-2xl border border-black/[0.06] bg-white object-cover"
										/>
									) : (
										<span className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-black/[0.04] text-lg font-bold text-black/40">
											{entry.name.trim().charAt(0)}
										</span>
									)}
									<div className="min-w-0">
										<div className="flex items-center gap-1.5">
											<h3 className="truncate text-sm font-semibold text-black">{entry.name}</h3>
											{entry.featured && <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label={fa ? 'ویژه' : 'Featured'} />}
										</div>
										{entry.handle && (
											<p dir="ltr" className="truncate text-start text-[11px] text-black/40">@{entry.handle}</p>
										)}
									</div>
									{link && <ExternalLink className="ms-auto h-3.5 w-3.5 shrink-0 text-black/25" aria-hidden />}
								</div>

								{entry.quote && (
									<p className="mt-3 line-clamp-2 text-xs leading-6 text-black/55">{entry.quote}</p>
								)}

								<div className="mt-3 flex flex-wrap items-center gap-1.5">
									{entry.channels.slice(0, 4).map((ch) => (
										<span key={ch} className="rounded-full bg-black/[0.045] px-2.5 py-1 text-[10px] font-medium text-black/55">
											{labels[ch] ?? ch}
										</span>
									))}
									{entry.metricValue && (
										<span className="ms-auto text-xs font-bold tabular-nums text-black">
											{entry.metricValue}
											{entry.metricLabel && <span className="ms-1 text-[10px] font-normal text-black/40">{entry.metricLabel}</span>}
										</span>
									)}
								</div>
							</>
						)

						return link ? (
							<li key={entry.id} data-scroll-reveal="up" style={{ '--reveal-order': index } as React.CSSProperties}>
								<a
									href={link}
									target="_blank"
									rel="noreferrer"
									className="spatial-surface flex h-full min-h-40 flex-col justify-between rounded-[1.35rem] p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
								>
									{card}
								</a>
							</li>
						) : (
							<li
								key={entry.id}
								data-scroll-reveal="up"
								style={{ '--reveal-order': index } as React.CSSProperties}
								className="spatial-surface flex h-full min-h-40 flex-col justify-between rounded-[1.35rem] p-4"
							>
								{card}
							</li>
						)
					})}
				</ul>
			</div>
		</section>
	)
}
