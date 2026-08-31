import type { CSSProperties } from 'react'
import { getLocale, getTranslations } from 'next-intl/server'
import type { PublicPlatformStats } from '@/lib/marketing/platform-stats'

const MIN_VISIBLE: PublicPlatformStats = {
	conversations: 100,
	businesses: 10,
	agents: 10,
}

/** Server-rendered trust metrics: stable at first paint, with CSS-only reveal. */
export async function SocialProof({ stats }: { stats: PublicPlatformStats }) {
	const [requestLocale, t] = await Promise.all([
		getLocale(),
		getTranslations('marketing.stats'),
	])
	const locale = requestLocale === 'en' ? 'en' : 'fa'
	const formatter = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
	const visible = (Object.entries(stats) as [keyof PublicPlatformStats, number][])
		.map(([key, value]) => ({ key, value }))
		.filter(({ key, value }) => Number.isFinite(value) && value >= MIN_VISIBLE[key])

	if (visible.length < 2) return null

	return (
		<section aria-label={locale === 'fa' ? 'آمار ویجنت' : 'Vigent statistics'} className="border-y border-[var(--border-default)] bg-[var(--bg-base)]">
			<div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-y-6 px-5 py-9 sm:px-6 sm:py-10">
				{visible.map(({ key, value }, index) => (
					<div
						key={key}
						data-scroll-reveal="up"
						style={{ '--reveal-order': index } as CSSProperties}
						className={index > 0
							? 'flex flex-col items-center border-s border-[var(--border-default)] px-6 sm:px-14'
							: 'flex flex-col items-center px-6 sm:px-14'}
					>
						<span className="text-3xl font-light tabular-nums text-[var(--text-primary)] md:text-4xl">{formatter.format(value)}+</span>
						<span className="mt-1.5 text-xs text-[var(--text-muted)]">{t(key)}</span>
					</div>
				))}
			</div>
		</section>
	)
}
