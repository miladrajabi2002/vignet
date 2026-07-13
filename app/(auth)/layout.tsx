import Link from 'next/link'
import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { Check, Sparkles } from 'lucide-react'
import { Logo } from '@/components/ui/logo'

export default async function AuthLayout({ children }: { children: ReactNode }) {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const fa = locale === 'fa'
	const points = fa
		? ['یک ماه استفاده رایگان', 'اتوماسیون ثابت اینستاگرام رایگان', 'هزینه فقط برای پاسخ موفق AI']
		: ['One month free', 'Free deterministic Instagram automation', 'Credit only for successful AI replies']

	return (
		<div className="marketing-page-shell min-h-dvh p-2.5 sm:p-4">
			<div className="mx-auto grid min-h-[calc(100dvh-1.25rem)] max-w-[1440px] overflow-hidden rounded-[2rem] border border-black/[0.07] bg-white shadow-[0_30px_100px_rgba(0,0,0,0.12)] sm:min-h-[calc(100dvh-2rem)] lg:grid-cols-[1.05fr_0.95fr]">
				<aside className="marketing-grid-dark relative hidden overflow-hidden bg-black p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
					<div className="relative z-10">
						<span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-[10px] text-white/50"><Sparkles className="h-3.5 w-3.5" />Vigento AI | {fa ? 'هوش مصنوعی ویجنتو' : 'Business intelligence core'}</span>
						<h1 className="mt-8 max-w-xl text-balance text-4xl font-semibold leading-[1.25] tracking-[-0.04em] rtl:tracking-normal xl:text-5xl">{fa ? 'از اولین ورود، همه‌چیز برای کسب‌وکار شما آماده می‌شود' : 'From the first sign-in, Vigent shapes itself around your business'}</h1>
						<p className="mt-5 max-w-xl text-sm leading-7 text-white/45">{fa ? 'نوع کسب‌وکارتان را انتخاب کنید؛ پنل، ایجنت، CRM، اتوماسیون و گزارش‌های مناسب همان مسیر آماده می‌شوند' : 'Choose how your business operates. Vigent prepares the right workspace, agent, CRM, automations and reports.'}</p>
					</div>
					<div className="relative z-10 grid gap-3">
						{points.map((point) => <div key={point} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs text-white/60 backdrop-blur"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-black"><Check className="h-3.5 w-3.5" /></span>{point}</div>)}
					</div>
				</aside>

				<section className="relative flex min-h-[720px] flex-col items-center justify-center px-4 py-24 sm:px-8 lg:min-h-0">
					<Link href="/" className="absolute top-7 text-black" aria-label="Vigent"><Logo priority className="h-10 w-40" /></Link>
					<div className="relative z-10 w-full max-w-sm">{children}</div>
					<p className="absolute bottom-7 text-center text-[10px] text-black/30">Vigent · Vigento AI</p>
				</section>
			</div>
		</div>
	)
}
