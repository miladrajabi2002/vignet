'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, ArrowUpLeft, Sparkles } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { SocialLinks } from '@/components/marketing/social-links'

const COPY = {
	fa: {
		eyebrow: 'Vigento AI | هوش مصنوعی ویجنتو',
		title: 'یک ماه فرصت دارید کسب‌وکارتان را هوشمندتر اداره کنید',
		subtitle: 'اتوماسیون ثابت اینستاگرام رایگان است؛ فقط پاسخ موفق AI از اعتبار کم می‌کند',
		button: 'شروع رایگان — یک ماه',
		desc: 'سیستم‌عامل هوشمند کسب‌وکار برای فروش، پشتیبانی، CRM، رزرو و ارتباط با مشتری در همه کانال‌ها',
		productTitle: 'محصول',
		solutionsTitle: 'راهکارها',
		resourcesTitle: 'یادگیری',
		productLinks: ['اتصال‌ها', 'دموی زنده', 'Vigento AI', 'تعرفه‌ها'],
		solutionLinks: ['اینستاگرام', 'فروشگاه آنلاین', 'خدمات و رزرو', 'پشتیبانی مشتری', 'ووکامرس'],
		resourceLinks: ['مستندات', 'بلاگ', 'وضعیت سرویس'],
		status: 'همه سرویس‌ها فعال',
		made: 'ساخته‌شده برای کسب‌وکارهای ایرانی',
	},
	en: {
		eyebrow: 'Vigento AI | Business intelligence core',
		title: 'Take a month to run your business with an intelligent operating layer',
		subtitle: 'Deterministic Instagram automation is free; only successful AI replies use credit',
		button: 'Start free — one month',
		desc: 'An intelligent operating system for sales, support, CRM, booking and customer conversations across every channel.',
		productTitle: 'Product',
		solutionsTitle: 'Solutions',
		resourcesTitle: 'Learn',
		productLinks: ['Connections', 'Live demo', 'Vigento AI', 'Pricing'],
		solutionLinks: ['Instagram', 'Online stores', 'Services and booking', 'Customer support', 'WooCommerce'],
		resourceLinks: ['Documentation', 'Blog', 'Service status'],
		status: 'All services operational',
		made: 'Built for Iranian businesses',
	},
} as const

export function Footer() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const t = useTranslations('marketing.footer')
	const Arrow = locale === 'fa' ? ArrowLeft : ArrowRight
	const productHrefs = ['/#product', '/#demo', '/#vigento', '/#pricing']
	const solutionHrefs = ['/solutions/instagram', '/solutions/ecommerce-ai', '/solutions/customer-support-ai', '/solutions/persian-ai-chatbot', '/solutions/woocommerce']
	const resourceHrefs = ['/docs', '/blog', '/status']

	return (
		<footer className="bg-[var(--bg-base)] px-3 pb-3 sm:px-5 sm:pb-5">
			<div className="marketing-grid-dark relative mx-auto max-w-[1500px] overflow-hidden rounded-[2rem] bg-black text-white shadow-[0_30px_90px_rgba(0,0,0,0.18)]">
				<div className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
					<div className="grid gap-8 border-b border-white/10 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
						<div>
							<span className="inline-flex items-center gap-2 text-[10px] font-medium text-white/40"><Sparkles className="h-3.5 w-3.5" />{copy.eyebrow}</span>
							<h2 className="mt-5 max-w-3xl text-balance text-3xl font-semibold leading-[1.25] tracking-[-0.035em] sm:text-4xl rtl:tracking-normal">{copy.title}</h2>
							<p className="mt-4 max-w-2xl text-sm leading-7 text-white/45">{copy.subtitle}</p>
						</div>
						<Link href="/login?next=/onboarding" className="marketing-pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black">
							{copy.button}<Arrow className="h-4 w-4" />
						</Link>
					</div>

					<div className="grid gap-12 py-10 lg:grid-cols-[1.05fr_1.95fr]">
						<div>
							<Logo variant="white" className="h-8 w-32" />
							<p className="mt-5 max-w-sm text-sm leading-7 text-white/42">{copy.desc}</p>
							<SocialLinks variant="default" className="mt-5 [&_a]:border-white/15 [&_a]:text-white/60 [&_a:hover]:text-white" />
						</div>
						<div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
							<FooterColumn title={copy.productTitle} labels={copy.productLinks} hrefs={productHrefs} />
							<FooterColumn title={copy.solutionsTitle} labels={copy.solutionLinks} hrefs={solutionHrefs} />
							<FooterColumn title={copy.resourcesTitle} labels={copy.resourceLinks} hrefs={resourceHrefs} className="col-span-2 sm:col-span-1" />
						</div>
					</div>

					<div className="flex flex-col gap-4 border-t border-white/10 pt-6 text-[10px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex flex-wrap gap-x-5 gap-y-2"><span>{t('rights')}</span><span>{copy.made}</span></div>
						<Link href="/status" className="inline-flex min-h-9 items-center gap-2 self-start rounded-full border border-white/10 px-3 transition-colors hover:border-white/25 hover:text-white sm:self-auto"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{copy.status}</Link>
					</div>
				</div>
			</div>
		</footer>
	)
}

function FooterColumn({ title, labels, hrefs, className = '' }: { title: string; labels: readonly string[]; hrefs: string[]; className?: string }) {
	return (
		<nav className={className} aria-label={title}>
			<p className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30 rtl:tracking-normal">{title}</p>
			<ul>
				{labels.map((label, index) => (
					<li key={label}>
						<Link href={hrefs[index]} className="group inline-flex min-h-11 items-center gap-1.5 text-xs text-white/48 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
							{label}<ArrowUpLeft className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-90 ltr:-rotate-90" />
						</Link>
					</li>
				))}
			</ul>
		</nav>
	)
}
