import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen, Home } from 'lucide-react'
import { getLocale } from 'next-intl/server'
import { Logo } from '@/components/ui/logo'

const COPY = {
	fa: {
		status: 'مسیر پیدا نشد',
		title: 'این گفتگو به جایی نرسید.',
		description: 'صفحه‌ای که دنبالش بودید جابه‌جا شده، حذف شده یا از ابتدا در شبکه‌ی ویجنت وجود نداشته است.',
		home: 'بازگشت به صفحه اصلی',
		docs: 'مشاهده راهنما',
		codeLabel: 'خطای ۴۰۴',
		networkLabel: 'نمایش گرافیکی مسیر قطع‌شده در شبکه',
	},
	en: {
		status: 'Route not found',
		title: 'This conversation went nowhere.',
		description: 'The page you were looking for was moved, removed, or never existed in the Vigent network.',
		home: 'Back to home',
		docs: 'Browse documentation',
		codeLabel: 'Error 404',
		networkLabel: 'A visual representation of a disconnected network route',
	},
} as const

export default async function NotFound() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<main className="relative min-h-dvh overflow-hidden bg-[#f7f7f5] text-[#111]">
			<div className="pointer-events-none absolute inset-0 marketing-grid opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_76%)]" />
			<div className="pointer-events-none absolute left-1/2 top-[-13rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-white blur-3xl" />

			<header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
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

			<section className="relative z-[1] mx-auto flex min-h-[calc(100dvh-92px)] w-full max-w-5xl flex-col items-center justify-center px-5 pb-16 pt-4 text-center sm:px-8 sm:pb-24">
				<div className="relative mb-5 flex h-52 w-full max-w-xl items-center justify-center sm:mb-7 sm:h-64" role="img" aria-label={copy.networkLabel}>
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

					<div className="relative z-10 select-none text-[6.5rem] font-semibold leading-none tracking-[-0.09em] text-black/[0.035] sm:text-[9rem]" aria-hidden="true">
						404
					</div>
				</div>

				<p className="mb-4 text-[11px] font-semibold tracking-[0.14em] text-black/35" dir="ltr">{copy.codeLabel}</p>
				<h1 className="max-w-2xl text-balance text-[2rem] font-semibold leading-[1.45] tracking-tight sm:text-5xl sm:leading-[1.3]">
					{copy.title}
				</h1>
				<p className="mt-4 max-w-xl text-balance text-sm leading-7 text-black/50 sm:mt-5 sm:text-base sm:leading-8">
					{copy.description}
				</p>

				<div className="mt-8 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:items-center">
					<Link
						href="/"
						className="marketing-pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-medium text-white shadow-[0_12px_30px_-16px_rgba(0,0,0,0.75)] transition-colors hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
					>
						<Home className="h-4 w-4" aria-hidden="true" />
						{copy.home}
						<Arrow className="h-4 w-4" aria-hidden="true" />
					</Link>
					<Link
						href="/docs"
						className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white/75 px-5 text-sm font-medium text-black/65 shadow-[0_8px_24px_-20px_rgba(0,0,0,0.5)] backdrop-blur-md transition-[background-color,color,border-color] hover:border-black/15 hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
					>
						<BookOpen className="h-4 w-4" aria-hidden="true" />
						{copy.docs}
					</Link>
				</div>
			</section>
		</main>
	)
}
