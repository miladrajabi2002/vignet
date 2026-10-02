import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { Logo } from '@/components/ui/logo'
import { ForwardArrow, faNum, toSiteLocale } from '@/components/marketing/site/ui'
import '@/components/marketing/site/site.css'

const COPY = {
	fa: {
		homeAria: 'صفحه اصلی ویجنت',
		h1: 'این صفحه پیدا نشد',
		lead: 'آدرسی که باز کردید جابه‌جا یا حذف شده است.',
		home: 'بازگشت به صفحهٔ اصلی',
	},
	en: {
		homeAria: 'Vigent home',
		h1: 'This page was not found',
		lead: 'The address you opened was moved or removed.',
		home: 'Back to the home page',
	},
} as const

/**
 * 404: one quiet screen. The mark carries the page (two orbits around the
 * number, a slow sheen across it), the copy is two lines, and the only way
 * forward is home, which works the same for visitors and signed-in owners.
 */
export default async function NotFound() {
	const locale = toSiteLocale(await getLocale())
	const c = COPY[locale]

	return (
		<div className="vg-motion flex min-h-dvh flex-col items-center overflow-x-clip bg-vg-bg px-4 text-vg-ink">
			<header className="flex h-20 items-center lg:h-24">
				<Link href="/" aria-label={c.homeAria} className="inline-flex min-h-11 items-center px-2">
					<Logo priority className="h-7 w-28 lg:h-[26px] lg:w-[116px]" />
				</Link>
			</header>

			<main className="flex grow flex-col items-center justify-center pb-24 text-center">
				<div aria-hidden className="vg-nf">
					<span className="vg-nf-glow" />
					<span className="vg-nf-ring" />
					<span className="vg-nf-ring vg-nf-ring--mid" />
					<span className="vg-nf-ring vg-nf-ring--core" />
					<span className="vg-nf-orbit" />
					<span className="vg-nf-orbit vg-nf-orbit--inner" />
					<span className="vg-nf-num">{faNum(locale, 404)}</span>
				</div>

				<h1 className="mt-8 text-[28px] font-bold leading-[1.5] lg:text-[36px]">{c.h1}</h1>
				<p className="mt-2 max-w-sm text-[15px] leading-8 text-vg-sub">{c.lead}</p>

				<Link href="/" className="vg-press vg-btn-dark mt-8 inline-flex h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-vg-ink px-7 text-[15px] font-medium text-white shadow-[var(--shadow-control)]">
					{c.home}
					<ForwardArrow locale={locale} />
				</Link>
			</main>
		</div>
	)
}
