import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeftRight, Bot, FileText, Inbox, Phone, Plug, Rocket, Sparkles, Store, UserRound } from 'lucide-react'
import { SUPPORT_PHONE_DISPLAY } from '@/lib/marketing/contact'
import { getLocale } from 'next-intl/server'
import { SOLUTIONS, getLocalizedSolution, getLocalizedSolutions } from '@/lib/marketing/solutions'
import { prisma } from '@/lib/prisma'
import { getMainWorkspaceId } from '@/lib/blog/workspace'
import { Container, CtaPair, ForwardArrow, SUPPORT_TEL, SectionPill, type IconType } from '@/components/marketing/site/ui'
import { SolutionScene } from '@/components/marketing/site/solutions/scenes'
import { Faq } from '@/components/marketing/site/faq'
import { SOLUTION_ANSWERS, SOLUTION_CARDS, SOLUTION_FACTS } from '@/components/marketing/site/solution-meta'
import { cn } from '@/lib/utils'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')

const PAGE_COPY = {
	fa: {
		breadcrumb: 'مسیر صفحه', brand: 'ویجنت', solutions: 'راهکارها',
		shortAnswer: 'پاسخ کوتاه',
		start: 'شروع رایگان',
		call: 'تماس با پشتیبانی',
		callAria: `تماس با پشتیبانی ویجنت به شماره ${SUPPORT_PHONE_DISPLAY}`,
		stats: [
			{ value: '۶', label: 'برنامه در یک صندوق' },
			{ value: 'زیر ۱۰', label: 'دقیقه تا راه‌اندازی' },
			{ value: '۲۴/۷', label: 'پاسخ‌گویی، حتی شب‌ها' },
			{ value: '۰', label: 'خط کدنویسی' },
		],
		changesPill: 'چه چیزی تغییر می‌کند',
		changesTitle: 'آنچه از همان روز اول تغییر می‌کند',
		setupPill: 'راه‌اندازی',
		setupTitle: 'در سه قدم کوتاه آماده است',
		stepTitles: ['آماده‌سازی ایجنت', 'اتصال برنامه‌ها', 'شروع پاسخ‌گویی'],
		faqTitle: 'پرسش‌های رایج',
		faqLead: 'قبل از شروع، دقیق بدانید چه چیزی در انتظار شماست.',
		more: 'بیشتر بخوانید',
		article: 'مقاله',
		relatedSolution: 'راهکار مرتبط',
		read: 'خواندن',
		view: 'مشاهده',
		nums: ['۱', '۲', '۳'],
	},
	en: {
		breadcrumb: 'Breadcrumb', brand: 'Vigent', solutions: 'Solutions',
		shortAnswer: 'Short answer',
		start: 'Start free',
		call: 'Call support',
		callAria: `Call Vigent support at ${SUPPORT_PHONE_DISPLAY}`,
		stats: [
			{ value: '6', label: 'channels in one inbox' },
			{ value: '<10', label: 'minutes to set up' },
			{ value: '24/7', label: 'answers, even at night' },
			{ value: '0', label: 'lines of code' },
		],
		changesPill: 'What changes',
		changesTitle: 'What changes from day one',
		setupPill: 'Setup',
		setupTitle: 'Ready in three short steps',
		stepTitles: ['Prepare the agent', 'Connect channels', 'Start answering'],
		faqTitle: 'Common questions',
		faqLead: 'Know exactly what to expect before you start.',
		more: 'Keep reading',
		article: 'Article',
		relatedSolution: 'Related solution',
		read: 'Read',
		view: 'View',
		nums: ['1', '2', '3'],
	},
} as const

const BENEFIT_ICONS: IconType[] = [Inbox, Bot, UserRound, Store, ArrowLeftRight, Sparkles, Plug, Rocket]
const STEP_ICONS: IconType[] = [Bot, Plug, Inbox]
// Step cards light in turn (site.css vg-g1..3 windows: 4–26%, 37–59%, 70–92%)
// and each bottom bar fills inside its own window (vg-f0 / f3 / f6).
const STEP_GLOW = ['vg-g1', 'vg-g2', 'vg-g3']
const STEP_FILL = ['vg-f0', 'vg-f3', 'vg-f6']

export function generateStaticParams() {
        return SOLUTIONS.map((solution) => ({ slug: solution.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
        const { slug } = await params
        const locale = await getLocale()
        const solution = await getLocalizedSolution(slug, locale)
        if (!solution) return {}
        const canonical = `${SITE_URL}/solutions/${solution.slug}`
        // /solutions/<slug> (fa) and /en/solutions/<slug> (en) share this route
        // via the middleware rewrite; each locale advertises the other so
        // crawlers can index both language versions.
        const localizedCanonical = locale === 'en' ? `${SITE_URL}/en/solutions/${solution.slug}` : canonical
        return {
                title: { absolute: solution.metaTitle },
                description: solution.metaDescription,
                category: 'technology',
                alternates: {
                        canonical: localizedCanonical,
                        languages: {
                                fa: canonical,
                                en: `${SITE_URL}/en/solutions/${solution.slug}`,
                                'x-default': canonical,
                        },
                },
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
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const isFa = locale === 'fa'
	const copy = PAGE_COPY[locale]
	const [solutions, solution] = await Promise.all([getLocalizedSolutions(locale), getLocalizedSolution(slug, locale)])
	if (!solution) notFound()
	const card = SOLUTION_CARDS[solution.slug]
	const PillIcon = card?.icon ?? Sparkles
	const facts = SOLUTION_FACTS[solution.slug]
	const stats = facts?.stats[locale] ?? copy.stats
	const stepTitles: readonly string[] = facts?.steps[locale] ?? copy.stepTitles
	const canonical = `${SITE_URL}/solutions/${solution.slug}`

	// Related blog posts for cluster internal linking (fa catalog only; the
	// English entries declare no relatedArticles because the blog is fa-only).
	const wsId = solution.relatedArticles?.length ? await getMainWorkspaceId() : null
	const relatedArticles = solution.relatedArticles?.length
		? await prisma.blogPost.findMany({
				where: { workspaceId: wsId ?? undefined, status: 'PUBLISHED', slug: { in: solution.relatedArticles } },
				select: { slug: true, title: true },
				take: 4,
			}).catch(() => [])
		: []
	const orderedArticles = (solution.relatedArticles ?? [])
		.map((articleSlug) => relatedArticles.find((post) => post.slug === articleSlug))
		.filter((post): post is NonNullable<typeof post> => Boolean(post))
		.slice(0, 2)
	const relatedSolutions = solutions.filter((item) => item.slug !== solution.slug)
	const reading = [
		...orderedArticles.map((post) => ({ href: `/blog/${post.slug}`, kind: copy.article, title: post.title, cta: copy.read })),
		...relatedSolutions.map((item) => ({ href: `/solutions/${item.slug}`, kind: copy.relatedSolution, title: SOLUTION_CARDS[item.slug]?.name[locale] ?? item.title, cta: copy.view })),
	].slice(0, 3)

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
				breadcrumb: { '@id': `${canonical}#breadcrumb` },
				mainEntity: { '@id': `${canonical}#service` },
			},
			{
				'@type': 'Service',
				'@id': `${canonical}#service`,
				name: solution.serviceType,
				serviceType: solution.serviceType,
				description: SOLUTION_ANSWERS[solution.slug]?.[locale] ?? solution.metaDescription,
				url: canonical,
				areaServed: { '@type': 'Country', name: isFa ? 'ایران' : 'Iran' },
				audience: { '@type': 'BusinessAudience', audienceType: isFa ? 'کسب‌وکارهای فارسی‌زبان' : 'Businesses serving Persian and English-speaking customers' },
				provider: { '@id': `${SITE_URL}/#organization` },
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${canonical}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: copy.brand, item: SITE_URL },
					{ '@type': 'ListItem', position: 2, name: copy.solutions, item: `${SITE_URL}/solutions` },
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
		<>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

			{/* Hero: the answer first, then the product at work */}
			<section className="px-4 pb-10 pt-[92px] lg:pb-14 lg:pt-[142px]">
				<div className="mx-auto flex max-w-[1200px] flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
					<div className="text-center lg:w-[560px] lg:shrink-0 lg:text-start">
						<nav aria-label={copy.breadcrumb}>
							<ol className="flex flex-wrap items-center justify-center gap-x-2 text-[13px] text-vg-cap lg:justify-start">
								<li><Link href="/" className="inline-flex min-h-11 items-center hover:text-vg-ink">{copy.brand}</Link></li>
								<li aria-hidden className="text-black/25">/</li>
								<li><Link href="/solutions" className="inline-flex min-h-11 items-center hover:text-vg-ink">{copy.solutions}</Link></li>
								<li aria-hidden className="text-black/25">/</li>
								<li aria-current="page" className="text-vg-ink">{card?.name[locale] ?? solution.title}</li>
							</ol>
						</nav>
						<SectionPill icon={PillIcon} className="mt-2">{card?.name[locale] ?? solution.serviceType}</SectionPill>
						<h1 className="mt-4 text-balance text-[28px] font-bold leading-[1.5] lg:text-[48px] lg:leading-[1.45]">{solution.title}</h1>
						<p className="mt-3.5 text-[15px] leading-[1.95] text-vg-sub lg:text-[18px]">{solution.subtitle}</p>
						{SOLUTION_ANSWERS[solution.slug] ? (
							<div className="mt-5 rounded-card border border-vg-line border-s-[3px] border-s-vg-signal bg-white px-[18px] py-4 text-start">
								<p className="text-[12px] font-bold text-vg-signal">{copy.shortAnswer}</p>
								<p className="mt-1.5 text-[15px] leading-[1.9]">{SOLUTION_ANSWERS[solution.slug][locale]}</p>
							</div>
						) : null}
<CtaPair locale={locale} className="mt-6 lg:justify-start" primary={copy.start} secondary={copy.call} secondaryHref={SUPPORT_TEL} secondaryIcon={Phone} secondaryAria={copy.callAria} />
					</div>

					<SolutionScene slug={solution.slug} locale={locale} />
				</div>
			</section>

			{/* Key numbers */}
			<section aria-label={stats.map((stat) => `${stat.value} ${stat.label}`).join('، ')} className="px-4 pb-12 lg:pb-24">
<dl className="vg-rv mx-auto grid max-w-[1200px] grid-cols-2 overflow-hidden rounded-3xl border border-vg-line bg-white lg:grid-cols-4">
					{stats.map((stat, i) => (
						<div key={stat.label} className={cn('flex flex-col-reverse px-5 py-[18px] lg:px-6 lg:py-[22px]', i % 2 === 0 && 'border-e border-black/[0.06]', i < 2 && 'border-b border-black/[0.06] lg:border-b-0', i === 1 && 'lg:border-e')}>
							<dt className="mt-1 text-[13px] text-vg-cap lg:text-[15px]">{stat.label}</dt>
							<dd className="text-[22px] font-bold leading-[1.3] lg:text-[28px]">{stat.value}</dd>
						</div>
					))}
				</dl>
			</section>

			{/* Benefits */}
			<section aria-labelledby="changes-title" className="vg-cv px-4 lg:border-y lg:border-black/[0.06] lg:bg-white lg:py-[120px]">
				<Container className="px-0 sm:px-0 xl:px-0">
<div className="vg-rv flex flex-col items-center text-center">
						<SectionPill icon={Sparkles}>{copy.changesPill}</SectionPill>
						<h2 id="changes-title" className="mt-3 text-[22px] font-bold leading-[1.5] lg:mt-3.5 lg:text-[36px] lg:leading-[1.4]">{copy.changesTitle}</h2>
					</div>
<ul className="vg-rv-group mt-5 grid grid-cols-1 gap-2.5 lg:mt-8 lg:grid-cols-2 lg:gap-4">
						{solution.benefits.map((benefit, i) => {
							const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length]
							return (
								<li key={benefit.title} className="vg-lift flex gap-3.5 rounded-3xl border border-black/[0.05] bg-white p-5 text-start lg:gap-[18px] lg:bg-vg-bg lg:p-7">
									<span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-vg-ink text-white lg:size-12 lg:rounded-control"><Icon className="size-5" strokeWidth={1.8} /></span>
									<div>
										<h3 className="text-[16.5px] font-bold leading-[1.6] lg:text-[18px]">{benefit.title}</h3>
										<p className="mt-1.5 text-[15px] leading-[1.95] text-vg-sub lg:text-[15px]">{benefit.desc}</p>
									</div>
								</li>
							)
						})}
					</ul>
				</Container>
			</section>

			{/* Setup */}
			<section aria-labelledby="setup-title" className="vg-cv px-4 pt-14 md:pt-20 lg:pt-[120px]">
				<div className="mx-auto max-w-[1200px]">
<div className="vg-rv flex flex-col items-center text-center">
						<SectionPill icon={Rocket}>{copy.setupPill}</SectionPill>
						<h2 id="setup-title" className="mt-3 text-[22px] font-bold leading-[1.5] lg:mt-3.5 lg:text-[36px] lg:leading-[1.4]">{copy.setupTitle}</h2>
					</div>
{/* The three steps play in order on one 12s clock: each card lights
					    (vg-gN) while its bar fills, so "three short steps" is seen. */}
<ol className="vg-anim vg-rv-group mt-5 flex flex-col gap-2.5 lg:mt-8 lg:flex-row lg:gap-4">
						{solution.steps.map((step, i) => {
							const Icon = STEP_ICONS[i % STEP_ICONS.length]
							return (
								<li key={step} className={cn('relative grow basis-0 overflow-hidden rounded-3xl border border-vg-line bg-white p-5 text-start lg:p-[26px]', STEP_GLOW[i])}>
									<span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-black/[0.04]"><span className={cn('vg-fx absolute inset-0 bg-vg-signal', STEP_FILL[i])} /></span>
									<div className="flex items-center justify-between">
										<span aria-hidden className="inline-flex size-11 items-center justify-center rounded-control bg-vg-tint text-vg-signal"><Icon className="size-5" strokeWidth={1.8} /></span>
										<span aria-hidden className="text-[36px] font-bold text-black/[0.08]">{copy.nums[i] ?? i + 1}</span>
									</div>
									<h3 className="mt-3 text-[18px] font-bold lg:mt-4 lg:text-[18px]">{stepTitles[i] ?? step}</h3>
									<p className="mt-1.5 text-[15px] leading-[1.9] text-vg-sub lg:text-[15px]">{step}</p>
								</li>
							)
						})}
					</ol>
				</div>
			</section>

			<Faq locale={locale} items={solution.faq} title={copy.faqTitle} lead={copy.faqLead} columns={1} className="mt-12 lg:mt-24" />

			{/* Internal links: related articles and solutions */}
			{reading.length ? (
				<section aria-labelledby="more-title" className="vg-cv px-4 pt-14 md:pt-20 lg:pt-[120px]">
					<div className="mx-auto max-w-[1200px]">
<h2 id="more-title" className="vg-rv text-center text-[15px] font-bold text-vg-cap lg:text-start">{copy.more}</h2>
<ul className="vg-rv-group mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:gap-4">
							{reading.map((item) => (
								<li key={item.href}>
									<Link href={item.href} className="vg-press vg-lift flex h-full flex-col gap-2 rounded-card border border-vg-line bg-white p-5 text-start">
										<span className="flex items-center gap-1.5 text-[12px] text-vg-signal"><FileText aria-hidden className="size-3.5" strokeWidth={1.8} />{item.kind}</span>
										<span className="text-[15px] font-bold leading-[1.8]">{item.title}</span>
										<span className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-medium text-vg-sub">{item.cta}<ForwardArrow locale={locale} className="size-3.5" /></span>
									</Link>
								</li>
							))}
						</ul>
					</div>
				</section>
			) : null}
		</>
	)
}
