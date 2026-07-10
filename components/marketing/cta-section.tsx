'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import { ArrowLeft, ArrowRight, Bot, Check, Send, ShoppingBag } from 'lucide-react'
import { InstagramIcon } from './social-links'

const COPY = {
	fa: {
		eyebrow: 'اولین گفتگو را امروز بسازید',
		title: 'قرار نیست هر پیام منتظر شما بماند.',
		desc: 'یک نمونه آماده انتخاب کنید، اطلاعات واقعی کسب‌وکارتان را بدهید و همان روز روی اولین کانال آنلاین شوید.',
		button: 'شروع رایگان — ۱۴ روز',
		note: 'بدون کارت بانکی · بدون دانش فنی · فقط با شماره موبایل',
		ready: 'ایجنت آماده پاسخ‌گویی است',
	},
	en: {
		eyebrow: 'Build your first conversation today',
		title: 'Every message should not have to wait for you.',
		desc: 'Choose a starting point, add your real business information and go live on your first channel the same day.',
		button: 'Start free — 14 days',
		note: 'No card · No technical skills · Just your phone number',
		ready: 'Your agent is ready to answer',
	},
} as const

export function CtaSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section className="bg-white px-5 py-20 sm:px-8 sm:py-24 lg:py-32">
			<div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-black px-6 py-14 text-white sm:px-10 sm:py-16 lg:px-16 lg:py-20">
				<div aria-hidden className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-70" />
				<div className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
					<div>
						<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/40">{copy.eyebrow}</p>
						<h2 className="mt-5 max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-[-0.045em] sm:text-5xl lg:text-6xl">{copy.title}</h2>
						<p className="mt-5 max-w-xl text-sm leading-7 text-white/50 sm:text-[15px]">{copy.desc}</p>
						<div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
							<Link href="/login?next=/onboarding" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black">{copy.button}<Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" /></Link>
							<span className="text-[10px] leading-5 text-white/35">{copy.note}</span>
						</div>
					</div>

					<div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm sm:p-5">
						<div className="flex items-center justify-between border-b border-white/10 pb-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black"><Bot className="h-4 w-4" /></span><span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{copy.ready}</span></div>
						<div className="mt-5 flex items-center" dir="ltr">
							{[
								{ Icon: InstagramIcon, label: 'Instagram' },
								{ Icon: Send, label: 'Telegram' },
								{ Icon: ShoppingBag, label: 'Store' },
							].map(({ Icon, label }, index) => <div key={label} className="flex min-w-0 flex-1 items-center"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/20"><Icon className="h-4 w-4 text-white/65" /></span>{index < 2 && <span className="h-px flex-1 bg-white/15" />}</div>)}
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-black"><Check className="h-4 w-4" /></span>
						</div>
						<div className="mt-5 rounded-xl bg-black/25 p-3"><div className="h-1.5 w-4/5 rounded-full bg-white/10" /><div className="mt-2 h-1.5 w-3/5 rounded-full bg-white/[0.06]" /></div>
					</div>
				</div>
			</div>
		</section>
	)
}
