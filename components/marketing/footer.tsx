import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { Phone, Send } from 'lucide-react'
import { InstagramGlyph, SOCIAL_URLS } from '@/components/marketing/social-links'
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164 } from '@/lib/marketing/contact'
import { Logo } from '@/components/ui/logo'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { faNum, toSiteLocale } from '@/components/marketing/site/ui'

const COPY = {
	fa: {
tagline: 'ایجنت هوش مصنوعی برای فروش، پشتیبانی و CRM',
		status: 'همهٔ سرویس‌ها فعال',
		statusShort: 'سرویس‌ها فعال',
		nav: 'پیوندهای پایین صفحه',
		links: [
			{ href: '/#capabilities', label: 'قابلیت‌ها' },
			{ href: '/solutions', label: 'راهکارها' },
			{ href: '/#pricing', label: 'قیمت‌ها' },
			{ href: '/blog', label: 'بلاگ' },
{ href: '/docs', label: 'مستندات' },
			{ href: '/solutions/woocommerce', label: 'افزونهٔ وردپرس', desktop: true },
		],
		privacy: 'حریم خصوصی',
		terms: 'شرایط استفاده',
		termsShort: 'شرایط',
		copyright: '© ۱۴۰۵ ویجنت',
		call: 'تماس با پشتیبانی ویجنت به شماره',
		instagram: 'اینستاگرام ویجنت',
		telegram: 'تلگرام ویجنت',
		current: 'فارسی',
		other: 'English',
	},
	en: {
tagline: 'An AI agent for sales, support and CRM',
		status: 'All services operational',
		statusShort: 'All systems go',
		nav: 'Footer links',
		links: [
			{ href: '/en#capabilities', label: 'Features' },
			{ href: '/en/solutions', label: 'Solutions' },
			{ href: '/en#pricing', label: 'Pricing' },
			{ href: '/en/blog', label: 'Blog' },
			{ href: '/en/docs', label: 'Docs' },
			{ href: '/en/solutions/woocommerce', label: 'WordPress plugin', desktop: true },
		],
		privacy: 'Privacy',
		terms: 'Terms of use',
		termsShort: 'Terms',
		copyright: '© 2026 Vigent',
		call: 'Call Vigent support at',
		instagram: 'Vigent on Instagram',
		telegram: 'Vigent on Telegram',
		current: 'English',
		other: 'فارسی',
	},
} as const

const iconBtn = 'vg-press inline-flex size-11 items-center justify-center rounded-full border border-vg-line bg-white text-vg-sub lg:size-10'

/**
 * Minimal public footer: brand line, status + socials, one row of links and
 * the legal strip. Server-rendered with
 * no client JavaScript; content-visibility keeps it out of the first paint.
 */
export async function Footer() {
	const locale = toSiteLocale(await getLocale())
	const c = COPY[locale]
	const prefix = locale === 'en' ? '/en' : ''

	return (
		<footer className="vg-cv overflow-hidden px-4 pb-6 pt-9 text-center lg:px-0 lg:pb-8 lg:pt-0 lg:text-start">
			<div className="vg-rv mx-auto max-w-[1200px] border-t border-black/[0.08] lg:border-t-0">
				<div className="flex flex-col items-center pt-8 lg:flex-row lg:justify-between lg:border-t lg:border-black/[0.08] lg:pb-[30px] lg:pt-11">
					<div className="flex flex-col items-center gap-2.5 lg:flex-row lg:gap-[18px]">
						<Logo className="h-6 w-[104px] lg:h-[26px] lg:w-[116px]" />
						<span aria-hidden className="hidden h-[22px] w-px bg-black/[0.12] lg:block" />
						<p className="text-[13px] leading-[1.9] text-vg-cap lg:text-[15px]">{c.tagline}</p>
					</div>
					<div className="order-last mt-3 flex items-center gap-2 lg:order-none lg:mt-0">
						<Link href={`${prefix}/status`} className="vg-press inline-flex h-11 items-center gap-2 rounded-full border border-vg-line bg-white px-3.5 text-[13px] text-vg-sub lg:h-10 lg:text-[13px]">
							<span aria-hidden className="vg-ping relative inline-flex size-2">
								<span className="vg-ring absolute inset-0 rounded-full bg-[#22c55e]" />
								<span className="relative size-2 rounded-full bg-[#16a34a]" />
							</span>
							<span className="lg:hidden">{c.statusShort}</span>
							<span className="hidden lg:inline">{c.status}</span>
						</Link>
						<a href={SOCIAL_URLS.instagram} target="_blank" rel="noopener noreferrer" aria-label={c.instagram} className={iconBtn}><InstagramGlyph className="size-[18px]" strokeWidth={1.8} /></a>
						<a href={SOCIAL_URLS.telegram} target="_blank" rel="noopener noreferrer" aria-label={c.telegram} className={iconBtn}><Send aria-hidden className="size-[18px]" strokeWidth={1.8} /></a>
					</div>
				</div>

				<nav aria-label={c.nav} className="mt-2.5 flex flex-col items-center lg:mt-0 lg:flex-row lg:justify-between">
					<ul className="flex flex-wrap items-center justify-center gap-x-2.5 text-[13px] lg:gap-x-[30px] lg:text-[15px]">
						{c.links.map((link, i) => (
							<li key={link.href} className={'desktop' in link ? 'hidden lg:block' : 'flex items-center gap-x-2.5'}>
								{i > 0 && !('desktop' in link) ? <span aria-hidden className="text-black/20 lg:hidden">·</span> : null}
								<Link href={link.href} className="vg-flink inline-flex min-h-10 items-center text-vg-sub transition-colors duration-200 lg:min-h-0">{link.label}</Link>
							</li>
						))}
					</ul>
					<a href={`tel:${SUPPORT_PHONE_E164}`} aria-label={`${c.call} ${faNum(locale, SUPPORT_PHONE_DISPLAY)}`} className="mt-3 inline-flex min-h-10 items-center gap-2 text-[15px] font-medium text-vg-ink lg:mt-0">
						<bdi dir="ltr">{faNum(locale, SUPPORT_PHONE_DISPLAY)}</bdi>
						<Phone aria-hidden className="size-4 text-vg-cap" strokeWidth={1.8} />
					</a>
				</nav>

				<div className="mt-1.5 flex flex-wrap justify-center gap-x-3.5 gap-y-1 text-[12px] text-vg-cap lg:mt-[26px] lg:justify-between lg:border-t lg:border-black/[0.06] lg:pt-[18px] lg:text-[13px]">
					<span className="flex flex-wrap items-center justify-center gap-x-3.5 lg:gap-4">
						<span>{c.copyright}</span>
						<Link href={`${prefix}/privacy`} className="vg-flink inline-flex min-h-10 items-center lg:min-h-0">{c.privacy}</Link>
						<Link href={`${prefix}/terms`} className="vg-flink inline-flex min-h-10 items-center lg:min-h-0"><span className="lg:hidden">{c.termsShort}</span><span className="hidden lg:inline">{c.terms}</span></Link>
					</span>
					<span className="flex gap-3.5">
						<span className="hidden font-medium text-vg-ink lg:inline">{c.current}</span>
						<LanguageSwitcher bare className="vg-flink inline-flex min-h-10 cursor-pointer items-center lg:min-h-0">{c.other}</LanguageSwitcher>
					</span>
				</div>

			</div>
		</footer>
	)
}
