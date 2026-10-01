import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { Activity, BookOpen, CircleHelp, CircleDollarSign, Globe, House, Layers, Sparkles } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { DOCS_NAV } from '@/lib/docs/nav'
import { SOLUTION_CARDS, SOLUTION_ORDER } from '@/components/marketing/site/solution-meta'
import { ForwardArrow, SIGNUP_HREF, faNum, toSiteLocale, type IconType, type SiteLocale } from '@/components/marketing/site/ui'
import { NotFoundSearch, type SearchEntry } from '@/components/marketing/site/not-found-search'
import { MotionPauser } from '@/components/marketing/site/motion-pauser'
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164 } from '@/lib/marketing/contact'
import { cn } from '@/lib/utils'
import '@/components/marketing/site/site.css'

const COPY = {
	fa: {
		homeAria: 'صفحه اصلی ویجنت',
		start: 'شروع رایگان',
		badge: 'خطای ۴۰۴ · صفحه پیدا نشد',
		h1: 'این صفحه گم شده،',
		h1Tail: 'ولی پیام شما گم نمی‌شود.',
		lead: 'آدرسی که باز کردید جابه‌جا یا حذف شده است. از جست‌وجو استفاده کنید یا یکی از مسیرهای پیشنهادی را انتخاب کنید.',
		you: 'شما',
		search: { label: 'جست‌وجو در ویجنت', placeholder: 'دنبال چه بودید؟ مثلاً «اتصال اینستاگرام»', submit: 'جست‌وجو', empty: 'چیزی پیدا نشد؛ با «جست‌وجو» به راهنما می‌روید.', results: 'نتایج جست‌وجو' },
		assistant: 'دستیار ویجنت',
		assistantSub: 'همین ایجنتی که برای کسب‌وکار شما می‌سازیم',
		assistantSays: 'این آدرس دیگر وجود ندارد. احتمالاً دنبال یکی از این‌ها بودید:',
		assistantMobile: 'دستیار ویجنت پیشنهاد می‌کند',
		suggestions: [
			{ href: '/#pricing', title: 'قیمت‌ها و پلن‌ها',hint: 'پلن‌ها، اعتبار هوش مصنوعی و شروع رایگان' },
			{ href: '/solutions', title: 'راهکارها', hint: 'اینستاگرام، تلگرام، ووکامرس و…' },
			{ href: '/docs/getting-started', title: 'راهنمای راه‌اندازی', hint: 'اتصال برنامه‌ها قدم‌به‌قدم' },
		],
		home: 'بازگشت به خانه',
		status: 'وضعیت سرویس',
		copyright: '© ۱۴۰۵ ویجنت',
		pages: [
			{ href: '/', title: 'صفحه اصلی', hint: 'ویجنت چیست' },
			{ href: '/#pricing', title: 'قیمت‌ها', hint: 'تعرفه پلن اشتراک هزینه' },
			{ href: '/solutions', title: 'راهکارها', hint: 'مشکلات کسب‌وکار' },
			{ href: '/blog', title: 'بلاگ', hint: 'مقاله آموزش' },
			{ href: '/docs', title: 'راهنما', hint: 'مستندات آموزش' },
			{ href: '/status', title: 'وضعیت سرویس', hint: 'اختلال قطعی' },
			{ href: '/privacy', title: 'حریم خصوصی', hint: 'قوانین داده' },
			{ href: '/terms', title: 'شرایط استفاده', hint: 'قوانین' },
			{ href: SIGNUP_HREF, title: 'ثبت‌نام و شروع رایگان', hint: 'ورود ساخت حساب' },
		],
	},
	en: {
		homeAria: 'Vigent home',
		start: 'Start free',
		badge: 'Error 404 · page not found',
		h1: 'This page is lost,',
		h1Tail: 'but your messages never are.',
		lead: 'The address you opened was moved or removed. Search below or pick one of the suggested routes.',
		you: 'You',
		search: { label: 'Search Vigent', placeholder: 'What were you looking for? e.g. “connect Instagram”', submit: 'Search', empty: 'Nothing found — Search takes you to the docs.', results: 'Search results' },
		assistant: 'Vigent assistant',
		assistantSub: 'The same agent we build for your business',
		assistantSays: 'That address no longer exists. You were probably looking for one of these:',
		assistantMobile: 'The Vigent assistant suggests',
		suggestions: [
			{ href: '/#pricing', title: 'Pricing & plans', hint: 'Plans, AI credit and free start' },
			{ href: '/solutions', title: 'Solutions', hint: 'Instagram, Telegram, WooCommerce…' },
			{ href: '/docs/getting-started', title: 'Setup guide', hint: 'Connect channels step by step' },
		],
		home: 'Back to home',
		status: 'Service status',
		copyright: '© 2026 Vigent',
		pages: [
			{ href: '/', title: 'Home', hint: 'what is vigent' },
			{ href: '/#pricing', title: 'Pricing', hint: 'plans subscription cost' },
			{ href: '/solutions', title: 'Solutions', hint: 'business problems' },
			{ href: '/blog', title: 'Blog', hint: 'articles guides' },
			{ href: '/docs', title: 'Documentation', hint: 'docs help' },
			{ href: '/status', title: 'Service status', hint: 'outage uptime' },
			{ href: '/privacy', title: 'Privacy', hint: 'data policy' },
			{ href: '/terms', title: 'Terms of use', hint: 'legal' },
			{ href: SIGNUP_HREF, title: 'Sign up & start free', hint: 'login account' },
		],
	},
} as const

const SUGGESTION_ICONS: IconType[] = [CircleDollarSign, Layers, BookOpen]

/**
 * 404: no dead end. A search over the site's own pages, solutions and docs,
 * plus the three routes most lost visitors actually want, suggested the way
 * the product's own agent would.
 */
export default async function NotFound() {
	const locale = toSiteLocale(await getLocale())
	const c = COPY[locale]
	const entries: SearchEntry[] = [
		...c.pages,
		...SOLUTION_ORDER.map((slug) => ({ href: `/solutions/${slug}`, title: SOLUTION_CARDS[slug].name[locale], hint: SOLUTION_CARDS[slug].pitch[locale] })),
		...DOCS_NAV.map((doc) => ({ href: doc.href, title: doc.title[locale], hint: locale === 'fa' ? 'راهنما' : 'Docs' })),
	]

	return (
		<div className="vg-motion flex min-h-dvh flex-col overflow-x-clip bg-vg-bg text-vg-ink">
			<header className="px-3 pt-2 lg:px-5 lg:pt-3.5">
				<nav className="vg-glass mx-auto flex h-[58px] max-w-[1200px] items-center justify-between rounded-card border border-black/[0.07] px-2 shadow-[var(--elev-1)] lg:h-16 lg:rounded-card lg:px-2.5">
					<Link href="/" aria-label={c.homeAria} className="inline-flex min-h-11 items-center px-2"><Logo priority className="h-7 w-28 lg:h-[26px] lg:w-[116px]" /></Link>
					<Link href={SIGNUP_HREF} className="vg-press vg-btn-dark inline-flex h-11 items-center gap-2 rounded-control bg-vg-ink px-4 text-[14px] font-medium text-white">
						{c.start}
						<ForwardArrow locale={locale} />
					</Link>
				</nav>
			</header>

			<main className="flex grow justify-center px-4 pb-10 pt-[26px] lg:pt-12">
				<div className="flex w-full max-w-[1200px] flex-col gap-4 lg:flex-row lg:gap-12">
					<section className="flex grow flex-col items-center text-center lg:items-start lg:text-start">
						<span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#fde68a] bg-[#fffbeb] px-3 text-[12.5px] font-medium text-[#92400e] lg:text-[13px]">
							<CircleHelp aria-hidden className="size-3.5 text-[#b45309]" strokeWidth={1.8} />
							{c.badge}
						</span>
						<h1 className="mt-4 text-[30px] font-bold leading-[1.5] lg:mt-[18px] lg:text-[50px] lg:leading-[1.4]">
							{c.h1}
							<span className="block text-[22px] font-medium text-vg-dim lg:text-[50px]">{c.h1Tail}</span>
						</h1>
						<p className="mt-3 max-w-[580px] text-[14.5px] leading-[1.95] text-vg-sub lg:mt-3.5 lg:text-[17px]">{c.lead}</p>

						<div className="vg-anim mt-[18px] w-full lg:mt-[26px]">
							<RouteBox locale={locale} width={684} desktop />
							<RouteBox locale={locale} width={358} />
						</div>
						<div className="mt-3.5 w-full lg:mt-4">
							<NotFoundSearch entries={entries} labels={c.search} />
						</div>
					</section>

					<aside className="flex w-full flex-col gap-3.5 lg:w-[460px] lg:shrink-0">
						<div className="flex grow flex-col gap-3 rounded-card border border-vg-line bg-white p-4 text-start shadow-[var(--elev-2)] lg:p-[22px]">
							<div className="hidden items-center gap-2.5 lg:flex">
								<span aria-hidden className="inline-flex size-10 items-center justify-center rounded-full bg-vg-ink text-[#c7bdf0]"><Sparkles className="size-[18px]" strokeWidth={1.8} /></span>
								<div><p className="text-[15px] font-bold">{c.assistant}</p><p className="text-[12.5px] text-vg-cap">{c.assistantSub}</p></div>
							</div>
							<p className="flex items-center gap-2 text-[13px] font-bold text-vg-sub lg:hidden"><Sparkles aria-hidden className="size-4 text-vg-signal" strokeWidth={1.8} />{c.assistantMobile}</p>
							<p className="vg-pop hidden max-w-[90%] self-start rounded-[18px_18px_18px_6px] bg-vg-ink px-3.5 py-3 text-[14px] leading-[1.9] text-white rtl:rounded-[18px_18px_6px_18px] lg:block">{c.assistantSays}</p>
							<ul className="vg-pop flex flex-col gap-2 [animation-delay:80ms]">
								{c.suggestions.map((item, i) => {
									const Icon = SUGGESTION_ICONS[i]
									return (
										<li key={item.href}>
											<Link href={item.href} className="vg-press vg-lift flex min-h-[60px] items-center gap-3 rounded-2xl border border-black/[0.05] bg-vg-bg px-3.5 py-3">
												<span aria-hidden className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-xl bg-white text-vg-signal"><Icon className="size-[18px]" strokeWidth={1.8} /></span>
												<span className="grow">
													<span className="block text-[14.5px] font-bold">{item.title}</span>
													<span className="text-[12.5px] text-vg-cap">{item.hint}</span>
												</span>
												<ForwardArrow locale={locale} className="text-vg-cap" />
											</Link>
										</li>
									)
								})}
							</ul>
						</div>
						<div className="flex gap-2">
							<Link href="/" className="vg-press vg-btn-dark inline-flex h-[52px] grow items-center justify-center gap-2.5 rounded-2xl bg-vg-ink px-5 text-[15px] font-medium text-white shadow-[var(--shadow-control)]">
								<House aria-hidden className="size-4" strokeWidth={2} />
								{c.home}
							</Link>
							<Link href="/status" className="vg-press vg-btn-ghost inline-flex h-[52px] grow items-center justify-center gap-2 rounded-2xl border border-black/[0.12] bg-white/70 px-5 text-[15px] font-medium">
								<Activity aria-hidden className="size-4" strokeWidth={1.8} />
								{c.status}
							</Link>
						</div>
					</aside>
				</div>
			</main>

			<footer className="flex justify-center px-4 pb-6">
				<div className="flex w-full max-w-[1200px] justify-between border-t border-black/[0.08] pt-[18px] text-[12.5px] text-vg-cap">
					<span>{c.copyright}</span>
					<a href={`tel:${SUPPORT_PHONE_E164}`} className="hover:text-vg-ink"><bdi dir="ltr">{faNum(locale, SUPPORT_PHONE_DISPLAY)}</bdi></a>
				</div>
			</footer>
			<MotionPauser />
		</div>
	)
}

/** "You → 404 gap → home": a lost packet stalls at the gap, a found one reroutes home. */
function RouteBox({ locale, width, desktop = false }: { locale: SiteLocale; width: number; desktop?: boolean }) {
	const m = locale === 'en'
	const x = (v: number) => (m ? width - v : v)
	const left = (v: number, w: number) => (m ? width - v - w : v)
	const g = desktop
		? { you: 630, lostEnd: 390, deadStart: 330, end: 70, c1: 550, c2: 540, bend: 460, row2: 138, youBox: 608, gap: 336, home: 48, homeTop: 116, height: 180 }
		: { you: 318, lostEnd: 210, deadStart: 150, end: 40, c1: 238, c2: 228, bend: 148, row2: 136, youBox: 296, gap: 156, home: 18, homeTop: 114, height: 176 }
	const lost = `M${x(g.you)} 70 L ${x(g.lostEnd)} 70`
	const found = `M${x(g.you)} 70 C ${x(g.c1)} 70, ${x(g.c2)} ${g.row2}, ${x(g.bend)} ${g.row2} L ${x(g.end)} ${g.row2}`
	return (
		<div aria-hidden className={cn('justify-center', desktop ? 'hidden lg:flex' : 'flex lg:hidden')}>
			<div className={cn('vg-dots relative shrink-0 overflow-hidden rounded-3xl border border-vg-line bg-white', !desktop && 'vg-mstage')} style={{ width, height: g.height }}>
				<svg width={width} height={g.height} viewBox={`0 0 ${width} ${g.height}`} fill="none" className="absolute inset-0">
					<path className="vg-flow" d={lost} stroke="#6e56cf" strokeOpacity={0.4} strokeWidth={1.5} />
					<path d={`M${x(g.deadStart)} 70 L ${x(g.end)} 70`} stroke="#111111" strokeOpacity={0.12} strokeWidth={1.5} strokeDasharray="3 9" />
					<path className="vg-flow" d={found} stroke="#15803d" strokeOpacity={0.45} strokeWidth={1.5} />
				</svg>
				<div className="vg-pkt-l" style={{ offsetPath: `path('${lost}')` }} />
				<div className="vg-pkt-f" style={{ offsetPath: `path('${found}')` }} />
				<div className="absolute top-12 flex w-11 flex-col items-center gap-1" style={{ left: left(g.youBox, 44) }}>
					<span className="inline-flex size-11 items-center justify-center rounded-control bg-vg-ink text-white"><Globe className="size-[18px]" strokeWidth={1.8} /></span>
					<span className="text-[12px] text-vg-cap">{COPY[locale].you}</span>
				</div>
				<div className="vg-gap absolute top-[46px] flex size-12 items-center justify-center rounded-full border-[1.5px] border-dashed border-[#f59e0b] bg-[#fffbeb] text-[13px] font-bold text-[#b45309]" style={{ left: left(g.gap, 48) }}>{faNum(locale, 404)}</div>
				<div className="absolute inline-flex size-11 items-center justify-center rounded-control bg-[#dcfce7] text-vg-ok" style={{ left: left(g.home, 44), top: g.homeTop }}><House className="size-[18px]" strokeWidth={1.8} /></div>
			</div>
		</div>
	)
}
