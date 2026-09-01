import type { ComponentType } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
	ArrowLeft,
	ArrowRight,
	Bot,
	Check,
	ChevronDown,
	Clock3,
	Database,
	Globe2,
	PackageSearch,
	Send,
	ShoppingBag,
	Sparkles,
	UserRoundCheck,
} from 'lucide-react'
import { getLocale } from 'next-intl/server'
import { SOLUTIONS, getLocalizedSolution, getLocalizedSolutions } from '@/lib/marketing/solutions'
import { InstagramIcon } from '@/components/marketing/social-links'
import { Spotlight } from '@/components/marketing/spotlight'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')

const SOLUTION_META: Record<string, { icon: ComponentType<{ className?: string }>; channel: string; question: string; answer: string; source: string }> = {
	'persian-ai-chatbot': { icon: Bot, channel: 'لینک چت اختصاصی', question: 'برای نیاز من کدام سرویس مناسب‌تر است؟', answer: 'با توجه به توضیحی که دادید، این گزینه مناسب‌تر است. تفاوت‌ها را هم کوتاه برایتان می‌گویم.', source: 'خدمات و قوانین کسب‌وکار' },
	'ecommerce-ai': { icon: ShoppingBag, channel: 'ویجت فروشگاه', question: 'این محصول رنگ مشکی سایز ۴۲ موجوده؟', answer: 'بله، رنگ مشکی سایز ۴۲ موجود است و امروز می‌توانید سفارش را ثبت کنید.', source: 'کاتالوگ و موجودی محصول' },
	'customer-support-ai': { icon: UserRoundCheck, channel: 'صندوق پشتیبانی', question: 'پرداخت انجام شده ولی سرویس من فعال نیست.', answer: 'اطلاعات را ثبت کردم و گفتگو را با خلاصه کامل برای بررسی فوری به همکار مربوطه می‌سپارم.', source: 'راهنمای پشتیبانی و ارجاع' },
	telegram: { icon: Send, channel: 'ربات تلگرام', question: 'سفارشم امروز تحویل پست می‌شه؟', answer: 'بله، سفارش شما آماده ارسال است و کد پیگیری بعد از تحویل به پست همین‌جا فرستاده می‌شود.', source: 'اطلاعات سفارش و ارسال' },
	instagram: { icon: InstagramIcon, channel: 'دایرکت اینستاگرام', question: 'قیمت این مدل چنده؟ رنگ کرم هم دارید؟', answer: '۲٬۳۹۰٬۰۰۰ تومان است و رنگ کرم موجود است. کارت محصول را همین‌جا می‌فرستم.', source: 'کاتالوگ محصول و موجودی' },
	woocommerce: { icon: PackageSearch, channel: 'فروشگاه ووکامرس', question: 'برای دویدن سبک چه مدلی پیشنهاد می‌دید؟', answer: 'این دو مدل با نیاز و بودجه شما هماهنگ‌اند؛ تفاوت وزن و کفی را هم مقایسه کردم.', source: 'محصولات همگام‌شده ووکامرس' },
}

const SOLUTION_META_EN: typeof SOLUTION_META = {
	'persian-ai-chatbot': { icon: Bot, channel: 'Dedicated chat link', question: 'Which service is the best fit for my needs?', answer: 'Based on what you shared, this is the closest fit. I can also summarize the differences for you.', source: 'Business services and policies' },
	'ecommerce-ai': { icon: ShoppingBag, channel: 'Store widget', question: 'Is this item available in black, size 42?', answer: 'Yes, black in size 42 is currently available and ready to order.', source: 'Product catalog and stock' },
	'customer-support-ai': { icon: UserRoundCheck, channel: 'Support inbox', question: 'My payment went through, but the service is not active.', answer: 'I have captured the details and will hand this conversation to the right teammate with a complete summary.', source: 'Support and escalation guide' },
	telegram: { icon: Send, channel: 'Telegram bot', question: 'Will my order be handed to the carrier today?', answer: 'Your order is ready to ship. The tracking code will be sent here after the carrier receives it.', source: 'Order and delivery data' },
	instagram: { icon: InstagramIcon, channel: 'Instagram DMs', question: 'How much is this model, and is cream available?', answer: 'It is 2,390,000 tomans and cream is in stock. I can send the product card here.', source: 'Product catalog and stock' },
	woocommerce: { icon: PackageSearch, channel: 'WooCommerce store', question: 'Which model would you suggest for light running?', answer: 'These two match your needs and budget. I have also compared their weight and cushioning.', source: 'Synchronized WooCommerce products' },
}

const PAGE_COPY = {
	fa: {
		breadcrumb: 'مسیر صفحه', brand: 'ویجنت', solutions: 'راهکارها', start: 'شروع رایگان — یک ماه', vigento: 'آشنایی با ویجنتو',
		trust: 'یک ماه رایگان · اتوماسیون ثابت اینستاگرام رایگان · هزینه فقط برای پاسخ موفق AI', automation: 'اتوماسیون', automationValue: 'کارهای ثابت اینستاگرام رایگان', aiReplies: 'پاسخ هوشمند', aiRepliesValue: 'کسر اعتبار فقط پس از پاسخ موفق',
		agent: 'ایجنت ویجنت', online: 'آنلاین و آماده پاسخ', result: 'پاسخ دقیق و نتیجه گفتگو ثبت شد', does: 'کاری که برای شما انجام می‌دهد', doesTitle: 'از سؤال تکراری تا کاری که واقعاً باید انجام شود',
		setup: 'راه‌اندازی', setupTitle: 'سه قدم تا اولین پاسخ واقعی', minutes: 'چند دقیقه', faq: 'سؤال‌های متداول', faqTitle: 'قبل از شروع، شفاف بدانید', faqDesc: 'اگر پاسخ دیگری لازم دارید، مستندات را ببینید یا از ویجت همین صفحه بپرسید.',
		related: 'راهکارهای مرتبط ویجنت', relatedTitle: 'مسیر بعدی را بر اساس کانال یا نیازتان انتخاب کنید', all: 'مشاهده همه راهکارها', view: 'مشاهده راهکار',
		finalEyebrow: 'Vigento AI | هوش مصنوعی ویجنتو', finalTitle: 'این راهکار را با اطلاعات خودتان ببینید', finalDesc: 'یک ماه فرصت دارید ایجنت را بسازید، محصولات و دانش را اضافه کنید و کانال واقعی خودتان را وصل کنید', finalCta: 'شروع دوره یک‌ماهه',
	},
	en: {
		breadcrumb: 'Breadcrumb', brand: 'Vigent', solutions: 'Solutions', start: 'Start free — one month', vigento: 'Meet Vigento',
		trust: 'One month free · Fixed Instagram automations are free · Pay only for successful AI replies', automation: 'Automation', automationValue: 'Fixed Instagram actions stay free', aiReplies: 'AI replies', aiRepliesValue: 'Credit is used only after a successful reply',
		agent: 'Vigent agent', online: 'Online and ready', result: 'Accurate reply and conversation outcome recorded', does: 'What it does for you', doesTitle: 'From a repeat question to the next useful action',
		setup: 'Setup', setupTitle: 'Three steps to your first real reply', minutes: 'A few minutes', faq: 'Frequently asked questions', faqTitle: 'Know what to expect before you start', faqDesc: 'For anything else, browse the documentation or ask the widget on this page.',
		related: 'Related Vigent solutions', relatedTitle: 'Choose the next path by channel or business need', all: 'See all solutions', view: 'View solution',
		finalEyebrow: 'Vigento AI | Vigent intelligence', finalTitle: 'See this solution with your own business data', finalDesc: 'Use the free month to build your agent, add products and knowledge, and connect a real customer channel.', finalCta: 'Start your free month',
	},
} as const

export function generateStaticParams() {
	return SOLUTIONS.map((solution) => ({ slug: solution.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	const { slug } = await params
	const locale = await getLocale()
	const solution = await getLocalizedSolution(slug, locale)
	if (!solution) return {}
	const canonical = `${SITE_URL}/solutions/${solution.slug}`
	return {
		title: { absolute: solution.metaTitle },
		description: solution.metaDescription,
		keywords: solution.keywords,
		category: 'technology',
		alternates: { canonical },
		robots: {
			index: true,
			follow: true,
			googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
		},
		openGraph: {
			title: solution.metaTitle,
			description: solution.metaDescription,
			url: canonical,
			type: 'website',
			locale: locale === 'en' ? 'en_US' : 'fa_IR',
			siteName: 'Vigent',
		},
		twitter: { card: 'summary_large_image', title: solution.metaTitle, description: solution.metaDescription },
	}
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params
	const locale = await getLocale()
	const isFa = locale !== 'en'
	const copy = PAGE_COPY[isFa ? 'fa' : 'en']
	const solutions = await getLocalizedSolutions(locale)
	const solution = await getLocalizedSolution(slug, locale)
	if (!solution) notFound()
	const localizedMeta = isFa ? SOLUTION_META : SOLUTION_META_EN
	const meta = localizedMeta[solution.slug] ?? localizedMeta['persian-ai-chatbot']
	const Icon = meta.icon
	const DirectionArrow = isFa ? ArrowLeft : ArrowRight
	const canonical = `${SITE_URL}/solutions/${solution.slug}`
	const relatedSolutions = solutions.filter((item) => item.slug !== solution.slug).slice(0, 3)
	const jsonLd = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebPage',
				'@id': `${canonical}#webpage`,
				url: canonical,
				name: solution.metaTitle,
				description: solution.metaDescription,
				inLanguage: isFa ? 'fa-IR' : 'en-US',
				keywords: solution.keywords.join(isFa ? '، ' : ', '),
				breadcrumb: { '@id': `${canonical}#breadcrumb` },
				mainEntity: { '@id': `${canonical}#service` },
			},
			{
				'@type': 'Service',
				'@id': `${canonical}#service`,
				name: solution.serviceType,
				serviceType: solution.serviceType,
				description: solution.metaDescription,
				url: canonical,
				areaServed: { '@type': 'Country', name: isFa ? 'ایران' : 'Iran' },
				audience: { '@type': 'BusinessAudience', audienceType: isFa ? 'کسب‌وکارهای فارسی‌زبان' : 'Businesses serving Persian and English-speaking customers' },
				provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Vigent', alternateName: isFa ? 'ویجنت' : 'Vigento', url: SITE_URL },
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${canonical}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: copy.brand, item: SITE_URL },
					{ '@type': 'ListItem', position: 2, name: copy.solutions, item: `${SITE_URL}/#solutions` },
					{ '@type': 'ListItem', position: 3, name: solution.title, item: canonical },
				],
			},
			{
				'@type': 'FAQPage',
				'@id': `${canonical}#faq`,
				mainEntity: solution.faq.map((item) => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } })),
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
						<Link href="/" className="inline-flex min-h-11 items-center transition-colors hover:text-black">{copy.brand}</Link><span>/</span><Link href="/#solutions" className="inline-flex min-h-11 items-center transition-colors hover:text-black">{copy.solutions}</Link><span>/</span><span className="text-black/60">{meta.channel}</span>
					</nav>

					<div className="grid min-w-0 grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.88fr)] lg:items-start lg:gap-14 xl:gap-20">
						<div className="min-w-0 w-full max-w-3xl">
							<span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-medium text-black/55 shadow-sm"><Icon className="h-3.5 w-3.5" />{meta.channel}</span>
							<h1 className="marketing-heading mt-6 max-w-3xl break-words">{solution.title}</h1>
							<p className="marketing-subtitle mt-5 max-w-2xl text-pretty sm:text-base">{solution.subtitle}</p>
							<div className="mt-8 flex flex-col gap-3 sm:flex-row">
								<Link href="/login?next=/onboarding" className="marketing-pressable group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">{copy.start}<DirectionArrow className="h-4 w-4 transition-transform group-hover:rtl:-translate-x-0.5 group-hover:ltr:translate-x-0.5" /></Link>
								<Link href="/#vigento" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 px-6 text-sm font-medium text-black transition-colors hover:bg-black/[0.04]">{copy.vigento}</Link>
							</div>
							<p className="mt-5 text-[11px] leading-6 text-black/45">{copy.trust}</p>
							<div className="mt-5 grid max-w-2xl gap-2 sm:grid-cols-2">
								<div className="spatial-surface rounded-2xl px-4 py-3"><p className="text-xs text-black/45">{copy.automation}</p><p className="mt-1 text-sm font-semibold text-black">{copy.automationValue}</p></div>
								<div className="spatial-surface rounded-2xl px-4 py-3"><p className="text-xs text-black/45">{copy.aiReplies}</p><p className="mt-1 text-sm font-semibold text-black">{copy.aiRepliesValue}</p></div>
							</div>
						</div>

						<aside aria-label={`${isFa ? 'نمونه پاسخ' : 'Example reply'} ${solution.serviceType}`} className="relative mx-auto min-w-0 w-full max-w-lg overflow-hidden rounded-[1.8rem] border border-black bg-[#050505] p-4 text-white shadow-[0_32px_90px_rgba(0,0,0,0.22)] sm:p-6 lg:sticky lg:top-28">
							<div aria-hidden className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-45" />
							<div className="relative flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black"><Bot className="h-4 w-4" /></span><div><p className="text-xs font-semibold text-white">{copy.agent}</p><p className="mt-0.5 text-[11px] text-emerald-300">{copy.online}</p></div></div><span className="text-[11px] text-white/50">{meta.channel}</span></div>
							<div className="relative space-y-3 py-6"><div className="ms-auto max-w-[88%] rounded-2xl rounded-ee-sm bg-white px-3.5 py-3 text-[11px] leading-5 text-black">{meta.question}</div><div className="max-w-[92%] rounded-2xl rounded-es-sm border border-white/10 bg-white/[0.07] px-3.5 py-3 text-[11px] leading-5 text-white/70">{meta.answer}<span className="mt-2 flex w-max max-w-full items-center gap-1.5 rounded-full bg-white/[0.08] px-2 py-1 text-[8px] text-white/45"><Database className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{meta.source}</span></span></div></div>
							<div className="flex items-center gap-2 rounded-xl border border-emerald-700/15 bg-emerald-50 px-3 py-2.5 text-[11px] font-medium text-emerald-800"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-3 w-3" /></span>{copy.result}</div>
						</aside>
					</div>
				</div>
			</section>

			<section className="border-y border-black/10 bg-[#f7f7f5] py-20 sm:py-24">
				<div className="mx-auto max-w-7xl px-5 sm:px-8">
					<div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
						<p className="text-[11px] font-medium text-black/40">{copy.does}</p>
						<div>
							<h2 className="max-w-3xl text-3xl font-semibold leading-[1.35] tracking-[-0.035em] text-black rtl:tracking-normal sm:text-4xl">{copy.doesTitle}</h2>
							<p className="mt-5 max-w-3xl text-sm leading-8 text-black/55 sm:text-[15px]">{solution.metaDescription}</p>
						</div>
					</div>
					<div className="mt-12 grid gap-px overflow-hidden rounded-[1.5rem] border border-black/10 bg-black/10 sm:grid-cols-2">
						{solution.benefits.map((benefit) => (
							<article key={benefit.title} className="min-h-56 bg-white p-6 sm:p-7"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/[0.05]"><Check className="h-4 w-4 text-black/55" /></span><span className="font-mono text-[9px] text-black/25">Vigent</span></div><h3 className="mt-7 text-lg font-medium text-black">{benefit.title}</h3><p className="mt-3 text-sm leading-7 text-black/50">{benefit.desc}</p></article>
						))}
					</div>
				</div>
			</section>

			<section className="bg-black py-20 text-white sm:py-24 lg:py-28">
				<div className="mx-auto max-w-6xl px-5 sm:px-8">
					<div className="text-center"><p className="text-[11px] font-medium text-white/35">{copy.setup}</p><h2 className="mt-5 text-3xl font-semibold leading-[1.35] tracking-[-0.035em] rtl:tracking-normal sm:text-4xl">{copy.setupTitle}</h2></div>
					<ol className="relative mt-12 grid gap-4 md:grid-cols-3">
						{solution.steps.map((step, index) => {
							const StepIcon = [Sparkles, Database, Globe2][index] ?? Check
							return <li key={step} className="relative rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-6"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black"><StepIcon className="h-4 w-4" /></span><span className="font-mono text-[10px] text-white/30">{String(index + 1).padStart(2, '0')}</span></div><p className="mt-8 text-sm leading-7 text-white/65">{step}</p><span className="mt-5 flex items-center gap-1.5 text-[9px] text-white/30"><Clock3 className="h-3 w-3" />{copy.minutes}</span></li>
						})}
					</ol>
				</div>
			</section>

			<section className="bg-white py-20 sm:py-24 lg:py-28">
				<div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
					<div><p className="text-[11px] font-medium text-black/40">{copy.faq}</p><h2 className="mt-5 text-3xl font-semibold leading-[1.35] tracking-[-0.035em] text-black rtl:tracking-normal sm:text-4xl">{copy.faqTitle}</h2><p className="mt-4 max-w-sm text-sm leading-7 text-black/50">{copy.faqDesc}</p></div>
					<div className="divide-y divide-black/10 border-y border-black/10">
						{solution.faq.map((item) => <details key={item.q} className="group"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"><span>{item.q}</span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10"><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></span></summary><p className="max-w-2xl pb-5 pe-10 text-sm leading-7 text-black/50">{item.a}</p></details>)}
					</div>
				</div>
			</section>

			<section aria-labelledby="related-solutions-title" className="border-t border-black/10 bg-[#f7f7f5] py-16 sm:py-20">
				<div className="mx-auto max-w-6xl px-5 sm:px-8">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p className="text-[11px] font-medium text-black/40">{copy.related}</p>
							<h2 id="related-solutions-title" className="mt-3 text-2xl font-semibold leading-[1.4] tracking-[-0.025em] text-black rtl:tracking-normal sm:text-3xl">{copy.relatedTitle}</h2>
						</div>
						<Link href="/#solutions" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-black/60 transition-colors hover:text-black">{copy.all}<DirectionArrow className="h-4 w-4" /></Link>
					</div>
					<div className="mt-8 grid gap-3 md:grid-cols-3">
						{relatedSolutions.map((item) => (
							<Link key={item.slug} href={`/solutions/${item.slug}`} className="group rounded-[1.35rem] border border-black/10 bg-white p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_16px_40px_rgba(0,0,0,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
								<p className="text-[10px] font-medium text-black/35">{item.serviceType}</p>
								<h3 className="mt-3 text-base font-semibold leading-7 text-black">{item.title}</h3>
								<span className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-black/50 transition-colors group-hover:text-black">{copy.view}<DirectionArrow className="h-3.5 w-3.5 transition-transform group-hover:rtl:-translate-x-0.5 group-hover:ltr:translate-x-0.5" /></span>
							</Link>
						))}
					</div>
				</div>
			</section>

			<section className="px-5 pb-24 pt-16 sm:px-8 sm:pt-20 lg:pb-32">
				<div className="marketing-grid-dark relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-black px-6 py-14 text-center text-white shadow-[0_30px_90px_rgba(0,0,0,0.18)] sm:px-10 sm:py-16"><div className="relative"><p className="text-[10px] font-medium text-white/35">{copy.finalEyebrow}</p><h2 className="mt-5 text-3xl font-semibold leading-[1.35] tracking-[-0.035em] rtl:tracking-normal sm:text-4xl">{copy.finalTitle}</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/50">{copy.finalDesc}</p><Link href="/login?next=/onboarding" className="marketing-pressable mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black">{copy.finalCta}<DirectionArrow className="h-4 w-4" /></Link></div></div>
			</section>
		</div>
	)
}
