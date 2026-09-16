import type { ComponentType } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Bot, Check, Inbox, PackageSearch, Send, ShoppingBag, UserRoundCheck } from 'lucide-react'
import { getLocale } from 'next-intl/server'
import { getLocalizedSolutions } from '@/lib/marketing/solutions'
import { InstagramIcon } from '@/components/marketing/social-links'
import { Spotlight } from '@/components/marketing/spotlight'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')

// Per-request rendering: /solutions and /en/solutions share this route via the
// middleware rewrite, so copy and metadata must resolve per request.
export const dynamic = 'force-dynamic'

const SOLUTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
	'unified-inbox': Inbox,
	'persian-ai-chatbot': Bot,
	'ecommerce-ai': ShoppingBag,
	'customer-support-ai': UserRoundCheck,
	telegram: Send,
	instagram: InstagramIcon,
	woocommerce: PackageSearch,
}

const PAGE_COPY = {
	fa: {
		breadcrumb: 'مسیر صفحه', brand: 'ویجنت', solutions: 'راهکارها',
		eyebrow: 'VIGENT SOLUTIONS',
		h1: 'مشکلاتی که کسب‌وکارها دارند و ویجنت حل می‌کند',
		subtitle: 'به‌جای فهرست امکانات، مسائل واقعی را مرور می‌کنیم: پیام‌های پخش‌شده، مشتری‌ای که جواب نمی‌گیرد، اطلاعاتی که جایی جمع نیست — و برای هر کدام دقیقاً می‌گوییم با ویجنت چه حل می‌شود.',
		start: 'شروع رایگان — یک ماه',
		pricing: 'دیدن تعرفه‌ها',
		trust: 'یک ماه دورهٔ آزمایشی · اتوماسیون اینستاگرام بدون کسر اعتبار · هزینهٔ شفاف هر درخواست موفق AI',
		problemsEyebrow: 'مسئله واقعی',
		problemsTitle: 'این مشکلات را هر روز می‌بینید',
		problemsIntro: 'اگر کسب‌وکار آنلاین دارید، این جمله‌ها آشنا هستند. هر مورد را با کاری که ویجنت انجام می‌دهد جواب داده‌ایم.',
		solutionsEyebrow: 'راهکارهای ویجنت',
		solutionsTitle: 'هر راهکار، یک مسئله مشخص',
		solutionsIntro: 'صفحه هر راهکار دقیقاً می‌گوید چه چیزی وصل می‌شود، چه چیزی خودکار می‌شود و از کجا شروع کنید.',
		view: 'دیدن راهکار',
		problemTag: 'مسئله',
		answerTag: 'با ویجنت',
		finalEyebrow: 'Vigent AI | هوش مصنوعی ویجنت',
		finalTitle: 'از همین امروز، همه پیام‌ها یکجا و پاسخ‌ها هوشمند',
		finalDesc: 'یک ماه فرصت دارید ایجنت را بسازید، محصولات و دانش را اضافه کنید و کانال واقعی خودتان را وصل کنید.',
		finalCta: 'شروع دوره یک‌ماهه',
	},
	en: {
		breadcrumb: 'Breadcrumb', brand: 'Vigent', solutions: 'Solutions',
		eyebrow: 'VIGENT SOLUTIONS',
		h1: 'The problems businesses face — and how Vigent solves them',
		subtitle: 'Instead of a feature list, we start from the real issues: messages scattered across apps, customers waiting for answers, information that lives nowhere — and state exactly what changes with Vigent.',
		start: 'Start free — one month',
		pricing: 'See pricing',
		trust: 'One-month trial · Instagram automation uses no AI credit · Transparent pricing per successful AI request',
		problemsEyebrow: 'The real problem',
		problemsTitle: 'You see these every day',
		problemsIntro: 'If you run an online business, these will sound familiar. Each one is answered with what Vigent actually does about it.',
		solutionsEyebrow: 'Vigent solutions',
		solutionsTitle: 'One solution per concrete problem',
		solutionsIntro: 'Each solution page states exactly what connects, what becomes automated, and where to start.',
		view: 'View solution',
		problemTag: 'Problem',
		answerTag: 'With Vigent',
		finalEyebrow: 'Vigent AI | Vigent intelligence',
		finalTitle: 'Every message in one place, every answer intelligent',
		finalDesc: 'Use the free month to build your agent, add products and knowledge, and connect a real customer channel.',
		finalCta: 'Start your free month',
	},
} as const

// Real business problems, each mapped to the solution page that solves it.
// Deliberately concrete and practical — the exact pain owners describe.
const PROBLEMS: Record<'fa' | 'en', { problem: string; answer: string; href: string }[]> = {
	fa: [
		{
			problem: 'پیام‌ها همه‌جا پخش شده‌اند: دایرکت اینستاگرام یک‌جا، تلگرام یک‌جا، بله و روبیکا جدا و فرم سایت هم جدا. نتیجه‌اش پیام گم‌شده و پاسخ دیر است.',
			answer: 'همه کانال‌ها به یک ایجنت وصل می‌شوند و پیام‌ها در یک صندوق واحد می‌آیند؛ همان‌جا می‌خوانید، پاسخ می‌دهید و مشخصات مخاطب را می‌بینید.',
			href: '/solutions/unified-inbox',
		},
		{
			problem: 'مشتری خارج از ساعت کاری پیام می‌دهد و تا فردا صبر می‌کند — یا اصلاً برنمی‌گردد.',
			answer: 'ایجنت هوش مصنوعی ۲۴ ساعته با اطلاعات واقعی کسب‌وکار شما پاسخ می‌دهد؛ فارسی روان و با لحن برند خودتان.',
			href: '/solutions/persian-ai-chatbot',
		},
		{
			problem: 'قیمت و موجودی محصول جاهای مختلف پراکنده است: اکسل یک‌جا، سایت یک‌جا و ذهن همکار جای دیگر. مشتری عدد قدیمی می‌شنود.',
			answer: 'فروشگاه وردپرس و ووکامرس با افزونه رسمی همگام می‌شود و ایجنت همیشه از آخرین قیمت و موجودی جواب می‌دهد.',
			href: '/solutions/woocommerce',
		},
		{
			problem: 'هیچ‌کس تاریخچه مشتری را ندارد؛ مشخصات، خریدهای قبلی و درخواست‌هایش جایی جمع نیست.',
			answer: 'از اولین پیام، پرونده مخاطب ساخته می‌شود: راه ارتباطی، کانال‌ها، تاریخچه گفتگوها و سفارش‌ها — کنار همان پیام‌ها.',
			href: '/solutions/unified-inbox',
		},
		{
			problem: 'مشتری می‌پرسد «این مدل هست؟ چه قیمتی؟ عکس دارید؟» و اپراتور هر بار همان توضیح را تکرار می‌کند.',
			answer: 'ایجنت مدل موجود را پیدا می‌کند، قیمت را می‌گوید و کارت محصول را داخل همان گفتگو می‌فرستد.',
			href: '/solutions/ecommerce-ai',
		},
		{
			problem: 'گفتگوی حساس — مثل مشکل پرداخت — بین ده‌ها پیام معمولی گم می‌شود و دیر دیده می‌شود.',
			answer: 'ایجنت موضوع را تشخیص می‌دهد، گفتگو را با خلاصه کامل به اپراتور انسانی می‌سپارد و پیگیری قابل ردیابی می‌شود.',
			href: '/solutions/customer-support-ai',
		},
	],
	en: [
		{
			problem: 'Messages are scattered everywhere: Instagram DMs in one place, Telegram in another, Bale and Rubika elsewhere, plus the website form. The result is lost messages and late replies.',
			answer: 'Every channel connects to one agent and the messages land in a single inbox — read, reply, and see the contact\u2019s record without switching apps.',
			href: '/solutions/unified-inbox',
		},
		{
			problem: 'Customers message outside business hours and wait until the next morning — or never come back.',
			answer: 'The AI agent answers around the clock using your real business data, in fluent Persian with your brand\u2019s tone.',
			href: '/solutions/persian-ai-chatbot',
		},
		{
			problem: 'Product prices and stock live in different places: a spreadsheet here, the site there, a teammate\u2019s head everywhere else. Customers hear stale numbers.',
			answer: 'WordPress and WooCommerce sync through the official plugin, so the agent always answers from the latest prices and stock.',
			href: '/solutions/woocommerce',
		},
		{
			problem: 'Nobody has the customer\u2019s history — details, past purchases and requests are collected nowhere.',
			answer: 'From the very first message a contact record builds itself: contact details, channels, conversation history and orders, right beside the messages.',
			href: '/solutions/unified-inbox',
		},
		{
			problem: 'Customers ask "do you have this model? what price? any photos?" and the operator repeats the same answer all day.',
			answer: 'The agent finds the available model, states the price and sends the product card inside the same conversation.',
			href: '/solutions/ecommerce-ai',
		},
		{
			problem: 'A sensitive conversation — like a failed payment — gets buried among dozens of routine messages and is noticed late.',
			answer: 'The agent recognizes the issue, hands the conversation to a human operator with a complete summary, and follow-up becomes trackable.',
			href: '/solutions/customer-support-ai',
		},
	],
}

export async function generateMetadata(): Promise<Metadata> {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const isFa = locale === 'fa'
	const canonical = isFa ? `${SITE_URL}/solutions` : `${SITE_URL}/en/solutions`
	return {
		title: isFa
			? 'مشکلات کسب‌وکارها و راه‌حل‌های هوش مصنوعی'
			: 'Business Problems and AI Answers',
		description: isFa
			? 'مرور مشکلات واقعی کسب‌وکارهای آنلاین — پیام‌های پخش‌شده، پاسخ دیر، اطلاعات پراکنده — و راهکارهای دقیق ویجنت برای هر کدام با صندوق پیام یکپارچه، ایجنت هوش مصنوعی و CRM.'
			: 'A tour of the real problems online businesses face — scattered messages, late replies, dispersed data — and Vigent\u2019s concrete answers: unified inbox, AI agent and CRM.',
		alternates: {
			canonical,
			languages: {
				fa: `${SITE_URL}/solutions`,
				en: `${SITE_URL}/en/solutions`,
				'x-default': `${SITE_URL}/solutions`,
			},
		},
		robots: {
			index: true,
			follow: true,
			googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
		},
		openGraph: {
			type: 'website',
			url: canonical,
			locale: isFa ? 'fa_IR' : 'en_US',
			siteName: 'Vigent',
		},
	}
}

export default async function SolutionsIndexPage() {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const isFa = locale === 'fa'
	const copy = PAGE_COPY[locale]
	const problems = PROBLEMS[locale]
	const solutions = await getLocalizedSolutions(locale)
	const DirectionArrow = isFa ? ArrowLeft : ArrowRight

	const jsonLd = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebPage',
				'@id': `${SITE_URL}${isFa ? '' : '/en'}/solutions#webpage`,
				url: `${SITE_URL}${isFa ? '' : '/en'}/solutions`,
				name: isFa ? 'راهکارهای ویجنت' : 'Vigent Solutions',
				inLanguage: isFa ? 'fa-IR' : 'en-US',
				breadcrumb: { '@id': `${SITE_URL}/solutions#breadcrumb` },
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${SITE_URL}/solutions#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: copy.brand, item: SITE_URL },
					{ '@type': 'ListItem', position: 2, name: copy.solutions, item: `${SITE_URL}/solutions` },
				],
			},
			{
				'@type': 'ItemList',
				name: isFa ? 'راهکارهای ویجنت' : 'Vigent solutions',
				itemListElement: solutions.map((solution, index) => ({
					'@type': 'ListItem',
					position: index + 1,
					name: solution.title,
					url: `${SITE_URL}/solutions/${solution.slug}`,
				})),
			},
		],
	}

	return (
		<div className="marketing-page-shell bg-white">
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

			<section className="marketing-hero-spatial relative overflow-hidden pb-16 pt-28 sm:pb-20 sm:pt-32 lg:pb-24 lg:pt-36">
				<Spotlight />
				<div className="relative mx-auto max-w-7xl px-5 sm:px-8">
					<nav aria-label={copy.breadcrumb} className="mb-8 flex min-w-0 max-w-full flex-wrap items-center gap-2 text-xs text-black/45 sm:mb-10">
						<Link href="/" className="inline-flex min-h-11 items-center transition-colors hover:text-black">{copy.brand}</Link>
						<span>/</span>
						<span className="text-black/60">{copy.solutions}</span>
					</nav>

					<div className="max-w-4xl">
						<p className="text-[11px] font-medium tracking-[0.18em] text-black/40">{copy.eyebrow}</p>
						<h1 className="marketing-heading mt-6 break-words">{copy.h1}</h1>
						<p className="marketing-subtitle mt-5 max-w-3xl text-pretty sm:text-base">{copy.subtitle}</p>
						<div className="mt-8 flex flex-col gap-3 sm:flex-row">
							<Link href="/login?next=/onboarding" className="marketing-pressable group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
								{copy.start}
								<DirectionArrow className="h-4 w-4 transition-transform group-hover:rtl:-translate-x-0.5 group-hover:ltr:translate-x-0.5" />
							</Link>
							<Link href="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 px-6 text-sm font-medium text-black transition-colors hover:bg-black/[0.04]">
								{copy.pricing}
							</Link>
						</div>
						<p className="mt-5 text-[11px] leading-6 text-black/45">{copy.trust}</p>
					</div>
				</div>
			</section>

			<section className="border-y border-black/10 bg-[#f7f7f5] py-20 sm:py-24">
				<div className="mx-auto max-w-7xl px-5 sm:px-8">
					<div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
						<p className="text-[11px] font-medium text-black/40">{copy.problemsEyebrow}</p>
						<div>
							<h2 className="max-w-3xl text-3xl font-semibold leading-[1.35] tracking-[-0.035em] text-black rtl:tracking-normal sm:text-4xl">{copy.problemsTitle}</h2>
							<p className="mt-5 max-w-3xl text-sm leading-8 text-black/55 sm:text-[15px]">{copy.problemsIntro}</p>
						</div>
					</div>
					<div className="mt-12 grid gap-px overflow-hidden rounded-[1.5rem] border border-black/10 bg-black/10 md:grid-cols-2">
						{problems.map((item) => (
							<article key={item.problem} className="bg-white p-6 sm:p-7">
								<p className="text-[10px] font-medium text-black/35">{copy.problemTag}</p>
								<p className="mt-3 text-sm font-medium leading-7 text-black">{item.problem}</p>
								<p className="mt-6 text-[10px] font-medium text-emerald-700">{copy.answerTag}</p>
								<p className="mt-2 flex items-start gap-2 text-sm leading-7 text-black/55">
									<Check className="mt-1.5 h-4 w-4 shrink-0 text-emerald-600" />
									<span>
										{item.answer}{' '}
										<Link href={item.href} className="whitespace-nowrap font-medium text-black underline decoration-black/20 underline-offset-4 transition-colors hover:decoration-black">
											{copy.view}
										</Link>
									</span>
								</p>
							</article>
						))}
					</div>
				</div>
			</section>

			<section className="bg-white py-20 sm:py-24 lg:py-28">
				<div className="mx-auto max-w-7xl px-5 sm:px-8">
					<div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
						<p className="text-[11px] font-medium text-black/40">{copy.solutionsEyebrow}</p>
						<div>
							<h2 className="max-w-3xl text-3xl font-semibold leading-[1.35] tracking-[-0.035em] text-black rtl:tracking-normal sm:text-4xl">{copy.solutionsTitle}</h2>
							<p className="mt-5 max-w-3xl text-sm leading-8 text-black/55 sm:text-[15px]">{copy.solutionsIntro}</p>
						</div>
					</div>
					<div className="mt-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
						{solutions.map((solution) => {
							const Icon = SOLUTION_ICONS[solution.slug] ?? Bot
							return (
								<Link
									key={solution.slug}
									href={`/solutions/${solution.slug}`}
									className="group flex flex-col rounded-[1.35rem] border border-black/10 bg-white p-6 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_16px_40px_rgba(0,0,0,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
								>
									<div className="flex items-center justify-between">
										<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.05]">
											<Icon className="h-4 w-4 text-black/70" />
										</span>
										<span className="font-mono text-[9px] text-black/25">Vigent</span>
									</div>
									<p className="mt-6 text-[10px] font-medium text-black/35">{solution.serviceType}</p>
									<h3 className="mt-2 text-lg font-semibold leading-8 text-black">{solution.title}</h3>
									<p className="mt-3 line-clamp-3 text-sm leading-7 text-black/50">{solution.subtitle}</p>
									<ul className="mt-5 space-y-2">
										{solution.benefits.slice(0, 3).map((benefit) => (
											<li key={benefit.title} className="flex items-start gap-2 text-xs leading-6 text-black/55">
												<Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-600" />
												<span>{benefit.title}</span>
											</li>
										))}
									</ul>
									<span className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-black/50 transition-colors group-hover:text-black">
										{copy.view}
										<DirectionArrow className="h-3.5 w-3.5 transition-transform group-hover:rtl:-translate-x-0.5 group-hover:ltr:translate-x-0.5" />
									</span>
								</Link>
							)
						})}
					</div>
				</div>
			</section>

			<section className="px-5 pb-24 pt-16 sm:px-8 sm:pt-20 lg:pb-32">
				<div className="marketing-grid-dark relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-black px-6 py-14 text-center text-white shadow-[0_30px_90px_rgba(0,0,0,0.18)] sm:px-10 sm:py-16">
					<div className="relative">
						<p className="text-[10px] font-medium text-white/35">{copy.finalEyebrow}</p>
						<h2 className="mt-5 text-3xl font-semibold leading-[1.35] tracking-[-0.035em] rtl:tracking-normal sm:text-4xl">{copy.finalTitle}</h2>
						<p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/50">{copy.finalDesc}</p>
						<Link href="/login?next=/onboarding" className="marketing-pressable mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black">
							{copy.finalCta}
							<DirectionArrow className="h-4 w-4" />
						</Link>
					</div>
				</div>
			</section>
		</div>
	)
}
