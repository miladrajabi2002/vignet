import { prisma } from '@/lib/prisma'

type Locale = 'fa' | 'en'

const COPY = {
	fa: {
		title: 'اعتماد بهترین‌های صنعت',
		aria: 'برندهایی که به ویجنت اعتماد کرده‌اند',
	},
	en: {
		title: 'Trusted by the best in the industry',
		aria: 'Brands that trust Vigent',
	},
} as const

export type TrustedLogoCard = {
	id: string
	name: string
	imageUrl: string | null
	url: string | null
}

/**
 * "Trusted by" logo bar — writora.xyz's trust section, adapted to Vigent's
 * light theme. Fully managed from the admin panel (/admin/showcase → لوگوهای
 * اعتماد). Renders nothing until the first active logo exists, so the
 * homepage stays clean until real brand logos are uploaded.
 */
export async function TrustedBySection({ locale }: { locale: Locale }) {
	let logos: TrustedLogoCard[] = []
	try {
		logos = await prisma.trustedLogo.findMany({
			where: { active: true },
			orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
			take: 12,
			select: {
				id: true,
				name: true,
				imageUrl: true,
				url: true,
			},
		})
	} catch {
		// Marketing must never fail because of a DB hiccup — hide the section.
		return null
	}

	if (logos.length === 0) return null

	const copy = COPY[locale]

	return (
		<section aria-label={copy.aria} className="bg-[var(--bg-base)] py-9 sm:py-14">
			<div className="mx-auto px-4 md:px-8">
				<h2 className="text-center text-[11px] font-medium uppercase tracking-[0.14em] text-black/35 rtl:tracking-normal sm:text-sm">{copy.title}</h2>
				<div className="mt-8">
					<ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-6 md:gap-x-16">
						{logos.map((logo) => {
							const image = logo.imageUrl ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									src={logo.imageUrl}
									alt={logo.name}
									loading="lazy"
									width={112}
									height={56}
									decoding="async"
									className="h-auto w-28 grayscale opacity-60 transition-opacity duration-300 hover:opacity-100"
								/>
							) : (
								<span className="max-w-28 text-sm font-semibold text-black/45">{logo.name}</span>
							)

							return (
								<li key={logo.id}>
									{logo.url ? (
										<a
											href={logo.url}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-4"
										>
											{image}
										</a>
									) : (
										image
									)}
								</li>
							)
						})}
					</ul>
				</div>
			</div>
		</section>
	)
}
