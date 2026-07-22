import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen, Home } from 'lucide-react'
import { getLocale } from 'next-intl/server'
import { Logo } from '@/components/ui/logo'

const COPY = {
	fa: {
		status: 'مسیر پیدا نشد',
		description: 'صفحه‌ای که دنبالش بودید جابه‌جا شده، حذف شده یا از ابتدا در شبکه‌ی ویجنت وجود نداشته است.',
		home: 'بازگشت به صفحه اصلی',
		docs: 'مشاهده راهنما',
		codeLabel: 'خطای ۴۰۴',
	},
	en: {
		status: 'Route not found',
		description: 'The page you were looking for was moved, removed, or never existed in the Vigent network.',
		home: 'Back to home',
		docs: 'Browse documentation',
		codeLabel: 'Error 404',
	},
} as const

export default async function NotFound() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<main className="relative grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-[#f7f7f5] text-[#111]">
			<div className="pointer-events-none absolute inset-0 marketing-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_76%)]" />
			<div className="pointer-events-none absolute left-1/2 top-[-13rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-white blur-3xl" />

			<header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8 sm:py-5">
				<Link
					href="/"
					aria-label={locale === 'fa' ? 'صفحه اصلی ویجنت' : 'Vigent home'}
					className="inline-flex min-h-11 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
				>
					<Logo priority className="h-8 w-28 sm:w-32" />
				</Link>
				<div className="inline-flex min-h-9 items-center gap-2 rounded-full border border-black/[0.07] bg-white/70 px-3 text-[11px] font-medium text-black/50 shadow-[0_1px_2px_rgba(0,0,0,0.03)] backdrop-blur-md">
					<span className="relative flex h-2 w-2" aria-hidden="true">
						<span className="absolute inset-0 animate-ping rounded-full bg-amber-400/45" />
						<span className="relative h-2 w-2 rounded-full bg-amber-500" />
					</span>
					{copy.status}
				</div>
			</header>

			<section className="relative z-[1] mx-auto flex min-h-0 w-full max-w-5xl flex-col items-center justify-center overflow-hidden px-5 pb-5 text-center sm:px-8 sm:pb-8">
				<div className="relative mb-2 flex h-[clamp(8rem,28dvh,16rem)] w-full max-w-xl shrink items-center justify-center sm:mb-3">
					<div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 blur-2xl sm:h-56 sm:w-56" />
					<svg viewBox="0 0 600 260" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
						<defs>
							<linearGradient id="route-fade" x1="70" y1="130" x2="530" y2="130" gradientUnits="userSpaceOnUse">
								<stop stopColor="#111111" stopOpacity="0" />
								<stop offset=".28" stopColor="#111111" stopOpacity=".16" />
								<stop offset=".47" stopColor="#111111" stopOpacity=".32" />
								<stop offset=".53" stopColor="#111111" stopOpacity=".08" />
								<stop offset=".72" stopColor="#111111" stopOpacity=".16" />
								<stop offset="1" stopColor="#111111" stopOpacity="0" />
							</linearGradient>
							<filter id="soft-shadow" x="-100%" y="-100%" width="300%" height="300%">
								<feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#000" floodOpacity=".08" />
							</filter>
						</defs>
						<path d="M40 130H222C246 130 252 104 276 104" stroke="url(#route-fade)" strokeWidth="1.5" strokeDasharray="3 5" />
						<path d="M324 156C348 156 354 130 378 130H560" stroke="url(#route-fade)" strokeWidth="1.5" strokeDasharray="3 5" />
						<path d="M111 130C145 130 148 60 184 60H230" stroke="#111" strokeOpacity=".08" />
						<path d="M370 200H416C452 200 455 130 489 130" stroke="#111" strokeOpacity=".08" />
						<circle cx="111" cy="130" r="4" fill="white" stroke="#111" strokeOpacity=".18" />
						<circle cx="184" cy="60" r="4" fill="white" stroke="#111" strokeOpacity=".18" />
						<circle cx="416" cy="200" r="4" fill="white" stroke="#111" strokeOpacity=".18" />
						<circle cx="489" cy="130" r="4" fill="white" stroke="#111" strokeOpacity=".18" />
						<g filter="url(#soft-shadow)">
							<circle cx="300" cy="130" r="43" fill="white" />
							<circle cx="300" cy="130" r="42.5" stroke="#111" strokeOpacity=".09" />
							<path d="M288 118L312 142M312 118L288 142" stroke="#111" strokeWidth="2" strokeLinecap="round" />
						</g>
						<circle cx="300" cy="130" r="54" stroke="#111" strokeOpacity=".055" strokeDasharray="2 7" className="origin-center animate-[spin_18s_linear_infinite]" />
					</svg>

					<h1 className="relative z-10 select-none text-[clamp(5.5rem,18dvh,9rem)] font-semibold leading-none tracking-[-0.09em] text-black/30" aria-label={copy.codeLabel}>
						404
					</h1>
				</div>

				<p className="max-w-xl text-balance text-sm leading-6 text-black/55 sm:text-base sm:leading-7">
					{copy.description}
				</p>

				<div className="mt-5 flex w-full max-w-md items-stretch justify-center gap-3 sm:mt-7 sm:items-center">
					<Link
						href="/"
						className="marketing-pressable inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-black px-3 text-xs font-medium text-white shadow-[0_12px_30px_-16px_rgba(0,0,0,0.75)] transition-colors hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:px-5 sm:text-sm"
					>
						<Home className="h-4 w-4" aria-hidden="true" />
						{copy.home}
						<Arrow className="h-4 w-4" aria-hidden="true" />
					</Link>
					<Link
						href="/docs"
						className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white/75 px-3 text-xs font-medium text-black/65 shadow-[0_8px_24px_-20px_rgba(0,0,0,0.5)] backdrop-blur-md transition-[background-color,color,border-color] hover:border-black/15 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black sm:px-5 sm:text-sm"
					>
						<BookOpen className="h-4 w-4" aria-hidden="true" />
						{copy.docs}
					</Link>
				</div>
			</section>
		</main>
	)
}
