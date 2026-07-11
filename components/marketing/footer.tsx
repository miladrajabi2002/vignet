'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowUpLeft } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { SocialLinks } from '@/components/marketing/social-links'

const COPY = {
	fa: {
		desc: 'ایجنت فارسی برای فروش، پشتیبانی و ارتباط با مشتری در تمام کانال‌ها.',
		productTitle: 'محصول', solutionsTitle: 'راهکارها', resourcesTitle: 'یادگیری',
		productLinks: ['اتصالات', 'دموی زنده', 'قابلیت‌ها', 'تعرفه‌ها'],
		solutionLinks: ['پیج‌های اینستاگرام', 'فروشگاه‌های آنلاین', 'خدمات و رزرو', 'آموزش و دوره', 'پشتیبانی پیام‌رسان'],
		resourceLinks: ['مستندات', 'بلاگ', 'وضعیت سرویس'],
		status: 'همه سرویس‌ها فعال', made: 'ساخته‌شده برای کسب‌وکارهای ایرانی',
	},
	en: {
		desc: 'Persian AI agents for sales, support and customer conversations across every channel.',
		productTitle: 'Product', solutionsTitle: 'Solutions', resourcesTitle: 'Learn',
		productLinks: ['Connections', 'Live demo', 'Capabilities', 'Pricing'],
		solutionLinks: ['Instagram sellers', 'Online stores', 'Services and booking', 'Education and courses', 'Messaging support'],
		resourceLinks: ['Documentation', 'Blog', 'Service status'],
		status: 'All services operational', made: 'Built for Iranian businesses',
	},
} as const

export function Footer() {
	const locale = useLocale() === 'en' ? 'en' : 'fa'
	const copy = COPY[locale]
	const t = useTranslations('marketing.footer')
	const productHrefs = ['/#product', '/#demo', '/#features', '/#pricing']
	const solutionHrefs = ['/solutions/instagram', '/solutions/ecommerce-ai', '/solutions/customer-support-ai', '/solutions/persian-ai-chatbot', '/solutions/telegram']
	const resourceHrefs = ['/docs', '/blog', '/status']

	return (
		<footer className="border-t border-black/10 bg-white">
			<div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
				<div className="grid gap-12 lg:grid-cols-[1.2fr_1.8fr]">
					<div>
						<Logo className="h-10 w-40" />
						<p className="mt-4 max-w-sm text-sm leading-7 text-black/50">{copy.desc}</p>
						<SocialLinks variant="default" className="mt-5" />
					</div>
					<div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
						<FooterColumn title={copy.productTitle} labels={copy.productLinks} hrefs={productHrefs} />
						<FooterColumn title={copy.solutionsTitle} labels={copy.solutionLinks} hrefs={solutionHrefs} />
						<FooterColumn title={copy.resourcesTitle} labels={copy.resourceLinks} hrefs={resourceHrefs} className="col-span-2 sm:col-span-1" />
					</div>
				</div>
				<div className="mt-12 flex flex-col gap-4 border-t border-black/10 pt-6 text-[10px] text-black/40 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2"><span>{t('rights')}</span><span>{copy.made}</span></div>
					<Link href="/status" className="inline-flex min-h-9 items-center gap-2 self-start rounded-full border border-black/10 px-3 text-black/50 transition-colors hover:text-black sm:self-auto"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{copy.status}</Link>
				</div>
			</div>
		</footer>
	)
}

function FooterColumn({ title, labels, hrefs, className = '' }: { title: string; labels: readonly string[]; hrefs: string[]; className?: string }) {
	return <nav className={className} aria-label={title}><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-black/50 rtl:tracking-normal">{title}</p><ul>{labels.map((label, index) => <li key={label}><Link href={hrefs[index]} className="group inline-flex min-h-11 items-center gap-1.5 text-xs text-black/60 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">{label}<ArrowUpLeft className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-90 ltr:-rotate-90" /></Link></li>)}</ul></nav>
}
