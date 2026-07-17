import type { ComponentType } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
	ArrowLeft,
	Bot,
	Check,
	ChevronDown,
	Clock3,
	Database,
	Globe2,
	MessageCircleMore,
	PackageSearch,
	Send,
	ShoppingBag,
	Sparkles,
	UserRoundCheck,
} from 'lucide-react'
import { SOLUTIONS, getSolution } from '@/lib/marketing/solutions'
import { InstagramIcon } from '@/components/marketing/social-links'
import { Spotlight } from '@/components/marketing/spotlight'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')

const SOLUTION_META: Record<string, { icon: ComponentType<{ className?: string }>; channel: string; question: string; answer: string; source: string }> = {
	'persian-ai-chatbot': { icon: Bot, channel: 'لینک چت اختصاصی', question: 'برای نیاز من کدام سرویس مناسب‌تر است؟', answer: 'با توجه به توضیحی که دادید، این گزینه مناسب‌تر است. تفاوت‌ها را هم کوتاه برایتان می‌گویم.', source: 'خدمات و قوانین کسب‌وکار' },
	'ecommerce-ai': { icon: ShoppingBag, channel: 'ویجت فروشگاه', question: 'این محصول رنگ مشکی سایز ۴۲ موجوده؟', answer: 'بله، رنگ مشکی سایز ۴۲ موجود است و امروز می‌توانید سفارش را ثبت کنید.', source: 'کاتالوگ و موجودی محصول' },
	'customer-support-ai': { icon: UserRoundCheck, channel: 'صندوق پشتیبانی', question: 'پرداخت انجام شده ولی سرویس من فعال نیست.', answer: 'اطلاعات را ثبت کردم و گفتگو را با خلاصه کامل برای بررسی فوری به همکار مربوطه می‌سپارم.', source: 'راهنمای پشتیبانی و ارجاع' },
	telegram: { icon: Send, channel: 'ربات تلگرام', question: 'سفارشم امروز تحویل پست می‌شه؟', answer: 'بله، سفارش شما آماده ارسال است و کد پیگیری بعد از تحویل به پست همین‌جا فرستاده می‌شود.', source: 'اطلاعات سفارش و ارسال' },
	instagram: { icon: InstagramIcon, channel: 'دایرکت اینستاگرام', question: 'قیمت این مدل چنده؟ رنگ کرم هم دارید؟', answer: '۲٬۳۹۰٬۰۰۰ تومان است و رنگ کرم موجود است. کارت محصول را همین‌جا می‌فرستم.', source: 'کاتالوگ محصول و موجودی' },
	whatsapp: { icon: MessageCircleMore, channel: 'واتساپ بیزینس', question: 'برای فردا عصر وقت مشاوره دارید؟', answer: 'بله، ساعت ۵ و ۶:۳۰ خالی است. کدام زمان برای شما بهتر است؟', source: 'ساعات و قوانین رزرو' },
	woocommerce: { icon: PackageSearch, channel: 'فروشگاه ووکامرس', question: 'برای دویدن سبک چه مدلی پیشنهاد می‌دید؟', answer: 'این دو مدل با نیاز و بودجه شما هماهنگ‌اند؛ تفاوت وزن و کفی را هم مقایسه کردم.', source: 'محصولات همگام‌شده ووکامرس' },
}

export function generateStaticParams() {
	return SOLUTIONS.map((solution) => ({ slug: solution.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
	const { slug } = await params
	const solution = getSolution(slug)
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
			locale: 'fa_IR',
			siteName: 'Vigent',
		},
		twitter: { card: 'summary_large_image', title: solution.metaTitle, description: solution.metaDescription },
	}
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params
	const solution = getSolution(slug)
	if (!solution) notFound()
	const meta = SOLUTION_META[solution.slug] ?? SOLUTION_META['persian-ai-chatbot']
	const Icon = meta.icon
	const canonical = `${SITE_URL}/solutions/${solution.slug}`
	const relatedSolutions = SOLUTIONS.filter((item) => item.slug !== solution.slug).slice(0, 3)
	const jsonLd = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'WebPage',
				'@id': `${canonical}#webpage`,
				url: canonical,
				name: solution.metaTitle,
				description: solution.metaDescription,
				inLanguage: 'fa-IR',
				keywords: solution.keywords.join('، '),
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
				areaServed: { '@type': 'Country', name: 'ایران' },
				audience: { '@type': 'BusinessAudience', audienceType: 'کسب‌وکارهای فارسی‌زبان' },
				provider: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Vigent', alternateName: 'ویجنت', url: SITE_URL },
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${canonical}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'ویجنت', item: SITE_URL },
					{ '@type': 'ListItem', position: 2, name: 'راهکارها', item: `${SITE_URL}/#businesses` },
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
					<nav aria-label="مسیر صفحه" className="mb-8 flex min-w-0 max-w-full flex-wrap items-center gap-2 text-xs text-black/45 sm:mb-10">
						<Link href="/" className="transition-colors hover:text-black">ویجنت</Link><span>/</span><Link href="/#businesses" className="transition-colors hover:text-black">راهکارها</Link><span>/</span><span className="text-black/60">{meta.channel}</span>
					</nav>

					<div className="grid min-w-0 grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.88fr)] lg:items-start lg:gap-14 xl:gap-20">
						<div className="min-w-0 w-full max-w-3xl">
							<span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-3.5 text-[11px] font-medium text-black/55 shadow-sm"><Icon className="h-3.5 w-3.5" />{meta.channel}</span>
							<h1 className="marketing-heading mt-6 max-w-3xl break-words">{solution.title}</h1>
							<p className="marketing-subtitle mt-5 max-w-2xl text-pretty sm:text-base">{solution.subtitle}</p>
							<div className="mt-8 flex flex-col gap-3 sm:flex-row">
								<Link href="/login?next=/onboarding" className="marketing-pressable group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-black px-6 text-sm font-medium text-white shadow-[0_12px_30px_rgba(0,0,0,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">شروع رایگان — یک ماه<ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /></Link>
								<Link href="/#demo" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 px-6 text-sm font-medium text-black transition-colors hover:bg-black/[0.04]">مشاهده دموی واقعی</Link>
							</div>
							<p className="mt-5 text-[11px] leading-6 text-black/45">یک ماه رایگان · اتوماسیون ثابت اینستاگرام رایگان · هزینه فقط برای پاسخ موفق AI</p>
							<div className="mt-5 grid max-w-2xl gap-2 sm:grid-cols-2">
								<div className="spatial-surface rounded-2xl px-4 py-3"><p className="text-[10px] text-black/40">اتوماسیون</p><p className="mt-1 text-sm font-semibold text-black">کارهای ثابت اینستاگرام رایگان</p></div>
								<div className="spatial-surface rounded-2xl px-4 py-3"><p className="text-[10px] text-black/40">پاسخ هوشمند</p><p className="mt-1 text-sm font-semibold text-black">کسر اعتبار فقط پس از پاسخ موفق</p></div>
							</div>
						</div>

						<aside aria-label={`نمونه پاسخ ${solution.serviceType}`} className="relative mx-auto min-w-0 w-full max-w-lg overflow-hidden rounded-[1.8rem] border border-black bg-[#050505] p-4 text-white shadow-[0_32px_90px_rgba(0,0,0,0.22)] sm:p-6 lg:sticky lg:top-28">
							<div aria-hidden className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-45" />
							<div className="relative flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black"><Bot className="h-4 w-4" /></span><div><p className="text-[11px] font-semibold text-white">ایجنت ویجنت</p><p className="mt-0.5 text-[9px] text-emerald-300">آنلاین و آماده پاسخ</p></div></div><span className="text-[9px] text-white/40">{meta.channel}</span></div>
							<div className="relative space-y-3 py-6"><div className="ms-auto max-w-[88%] rounded-2xl rounded-ee-sm bg-white px-3.5 py-3 text-[11px] leading-5 text-black">{meta.question}</div><div className="max-w-[92%] rounded-2xl rounded-es-sm border border-white/10 bg-white/[0.07] px-3.5 py-3 text-[11px] leading-5 text-white/70">{meta.answer}<span className="mt-2 flex w-max max-w-full items-center gap-1.5 rounded-full bg-white/[0.08] px-2 py-1 text-[8px] text-white/45"><Database className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{meta.source}</span></span></div></div>
							<div className="flex items-center gap-2 rounded-xl border border-emerald-700/15 bg-emerald-50 px-3 py-2.5 text-[10px] font-medium text-emerald-800"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white"><Check className="h-3 w-3" /></span>پاسخ دقیق و نتیجه گفتگو ثبت شد</div>
						</aside>
					</div>
				</div>
			</section>

			<section className="border-y border-black/10 bg-[#f7f7f5] py-20 sm:py-24">
				<div className="mx-auto max-w-7xl px-5 sm:px-8">
					<div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
						<p className="text-[11px] font-medium text-black/40">کاری که برای شما انجام می‌دهد</p>
						<div>
							<h2 className="max-w-3xl text-3xl font-semibold leading-[1.35] tracking-[-0.035em] text-black rtl:tracking-normal sm:text-4xl">از سؤال تکراری تا کاری که واقعاً باید انجام شود</h2>
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
					<div className="text-center"><p className="text-[11px] font-medium text-white/35">راه‌اندازی</p><h2 className="mt-5 text-3xl font-semibold leading-[1.35] tracking-[-0.035em] rtl:tracking-normal sm:text-4xl">سه قدم تا اولین پاسخ واقعی</h2></div>
					<ol className="relative mt-12 grid gap-4 md:grid-cols-3">
						{solution.steps.map((step, index) => {
							const StepIcon = [Sparkles, Database, Globe2][index] ?? Check
							return <li key={step} className="relative rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-6"><div className="flex items-center justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black"><StepIcon className="h-4 w-4" /></span><span className="font-mono text-[10px] text-white/30">{String(index + 1).padStart(2, '0')}</span></div><p className="mt-8 text-sm leading-7 text-white/65">{step}</p><span className="mt-5 flex items-center gap-1.5 text-[9px] text-white/30"><Clock3 className="h-3 w-3" />چند دقیقه</span></li>
						})}
					</ol>
				</div>
			</section>

			<section className="bg-white py-20 sm:py-24 lg:py-28">
				<div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
					<div><p className="text-[11px] font-medium text-black/40">سؤال‌های متداول</p><h2 className="mt-5 text-3xl font-semibold leading-[1.35] tracking-[-0.035em] text-black rtl:tracking-normal sm:text-4xl">قبل از شروع، شفاف بدانید</h2><p className="mt-4 max-w-sm text-sm leading-7 text-black/50">اگر پاسخ دیگری لازم دارید، مستندات را ببینید یا از ویجت همین صفحه بپرسید.</p></div>
					<div className="divide-y divide-black/10 border-y border-black/10">
						{solution.faq.map((item) => <details key={item.q} className="group"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"><span>{item.q}</span><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10"><ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" /></span></summary><p className="max-w-2xl pb-5 pe-10 text-sm leading-7 text-black/50">{item.a}</p></details>)}
					</div>
				</div>
			</section>

			<section aria-labelledby="related-solutions-title" className="border-t border-black/10 bg-[#f7f7f5] py-16 sm:py-20">
				<div className="mx-auto max-w-6xl px-5 sm:px-8">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
						<div>
							<p className="text-[11px] font-medium text-black/40">راهکارهای مرتبط ویجنت</p>
							<h2 id="related-solutions-title" className="mt-3 text-2xl font-semibold leading-[1.4] tracking-[-0.025em] text-black rtl:tracking-normal sm:text-3xl">مسیر بعدی را بر اساس کانال یا نیازتان انتخاب کنید</h2>
						</div>
						<Link href="/#businesses" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-black/60 transition-colors hover:text-black">مشاهده همه راهکارها<ArrowLeft className="h-4 w-4" /></Link>
					</div>
					<div className="mt-8 grid gap-3 md:grid-cols-3">
						{relatedSolutions.map((item) => (
							<Link key={item.slug} href={`/solutions/${item.slug}`} className="group rounded-[1.35rem] border border-black/10 bg-white p-5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_16px_40px_rgba(0,0,0,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2">
								<p className="text-[10px] font-medium text-black/35">{item.serviceType}</p>
								<h3 className="mt-3 text-base font-semibold leading-7 text-black">{item.title}</h3>
								<span className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-black/50 transition-colors group-hover:text-black">مشاهده راهکار<ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /></span>
							</Link>
						))}
					</div>
				</div>
			</section>

			<section className="px-5 pb-24 pt-16 sm:px-8 sm:pt-20 lg:pb-32">
				<div className="marketing-grid-dark relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-black px-6 py-14 text-center text-white shadow-[0_30px_90px_rgba(0,0,0,0.18)] sm:px-10 sm:py-16"><div className="relative"><p className="text-[10px] font-medium text-white/35">Vigento AI | هوش مصنوعی ویجنتو</p><h2 className="mt-5 text-3xl font-semibold leading-[1.35] tracking-[-0.035em] rtl:tracking-normal sm:text-4xl">این راهکار را با اطلاعات خودتان ببینید</h2><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/50">یک ماه فرصت دارید ایجنت را بسازید، محصولات و دانش را اضافه کنید و کانال واقعی خودتان را وصل کنید</p><Link href="/login?next=/onboarding" className="marketing-pressable mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-black">شروع دوره یک‌ماهه<ArrowLeft className="h-4 w-4" /></Link></div></div>
			</section>
		</div>
	)
}
