'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import { ArrowLeft, ArrowRight, Bot, Check, Database, Plug, SlidersHorizontal } from 'lucide-react'

const COPY = {
	fa: {
		eyebrow: 'اولین گفتگو را امروز بسازید',
		title: 'ایجنت‌تان را بسازید؛ ویجنت بقیهٔ مسیر را ساده می‌کند.',
		desc: 'اطلاعات کسب‌وکار را اضافه کنید، لحن را انتخاب کنید و اولین کانال را وصل کنید. هوش مصنوعی و زیرساخت از قبل آماده است.',
		button: 'شروع رایگان — ۱۴ روز',
		note: 'بدون دانش فنی · هوش مصنوعی آماده · فقط با شماره موبایل',
		ready: 'ایجنت آماده پاسخ‌گویی است',
		steps: ['اطلاعات کسب‌وکار اضافه شد', 'لحن و قوانین تنظیم شد', 'اولین کانال متصل شد'],
	},
	en: {
		eyebrow: 'Build your first conversation today',
		title: 'Every message should not have to wait for you.',
		desc: 'Choose a starting point, add your real business information and go live on your first channel the same day.',
		button: 'Start free — 14 days',
		note: 'AI included · No technical skills · Just your phone number',
		ready: 'Your agent is ready to answer',
		steps: ['Business knowledge added', 'Voice and rules configured', 'First channel connected'],
	},
} as const

export function CtaSection() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight

	return (
		<section className="marketing-story-section bg-white px-5 py-16 sm:px-8 sm:py-20 lg:py-24">
			<div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-black px-6 py-14 text-white sm:px-10 sm:py-16 lg:px-16 lg:py-20">
				<div aria-hidden className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-70" />
				<div className="relative grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
					<div>
						<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/55 rtl:tracking-normal">{copy.eyebrow}</p>
						<h2 className="marketing-heading mt-5 max-w-3xl !text-white">{copy.title}</h2>
						<p className="marketing-subtitle mt-5 max-w-xl !text-white/60">{copy.desc}</p>
						<div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
							<Link href="/login?next=/onboarding" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black">{copy.button}<Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" /></Link>
							<span className="text-xs leading-5 text-white/60">{copy.note}</span>
						</div>
					</div>

					<div className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm sm:p-5">
						<div className="flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black"><Bot className="h-4 w-4" /></span><span className="text-xs font-medium text-white/80">Vigent Agent</span></div><span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{copy.ready}</span></div>
						<div className="mt-4 space-y-2.5">
							{[
								{ Icon: Database, label: copy.steps[0] },
								{ Icon: SlidersHorizontal, label: copy.steps[1] },
								{ Icon: Plug, label: copy.steps[2] },
							].map(({ Icon, label }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10"><Icon className="h-3.5 w-3.5 text-white/65" /></span><span className="text-[11px] text-white/70">{label}</span><span className="ms-auto flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-black"><Check className="h-3 w-3" /></span></div>)}
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
