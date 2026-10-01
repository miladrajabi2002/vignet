import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { ArrowDown, Check, Clock, CreditCard, Layers, MessageSquare, Moon, Phone, Sparkles, UserRound, X } from 'lucide-react'
import { SUPPORT_PHONE_DISPLAY } from '@/lib/marketing/contact'
import { getLocalizedSolutions } from '@/lib/marketing/solutions'
import { Container, ForwardArrow, SUPPORT_TEL, SectionPill, btnDark, btnGhost, btnLg, type IconType } from '@/components/marketing/site/ui'
import { SOLUTION_CARDS, SOLUTION_ORDER } from '@/components/marketing/site/solution-meta'
import { ProblemPicker, type ProblemView } from '@/components/marketing/site/solutions/problem-picker'
import { cn } from '@/lib/utils'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')

// Per-request rendering: /solutions and /en/solutions share this route via the
// middleware rewrite, so copy and metadata must resolve per request.
export const dynamic = 'force-dynamic'

const PAGE_COPY = {
	fa: {
		brand: 'ویجنت', solutions: 'راهکارها',
		pill: 'راهکارهای ویجنت',
		h1: 'مشکلاتی که هر روز می‌بینید',
		h1Tail: 'و دقیقاً چطور حل می‌شوند',
		lead: 'به‌جای فهرست امکانات، از مسئلهٔ واقعی شروع می‌کنیم. مسئلهٔ خودتان را انتخاب کنید تا ببینید با ویجنت چه تغییری می‌کند.',
		findCta: 'مسئلهٔ خودم را پیدا کنم',
		allCta: 'همهٔ راهکارها',
		quick: 'مسئله‌های رایج',
		step: 'قدم اول',
		problemsTitle: 'کدام مسئله برای شما آشناست؟',
		tapHint: 'روی هر مورد بزنید',
		problemsList: 'مسئله‌ها',
		problemTag: 'مسئله',
		answerTag: 'با ویجنت',
		related: 'راهکار مرتبط',
		view: 'دیدن راهکار',
		viewFor: (name: string) => `راهکار: ${name}`,
		gridPill: 'هر راهکار، یک مسئلهٔ مشخص',
		gridTitle: 'راهکار مناسب کسب‌وکارتان را انتخاب کنید',
		gridLead: 'همه روی یک پلتفرم‌اند؛ هر وقت خواستید بقیه را هم فعال کنید.',
		popular: 'پرکاربردترین',
		cardCta: 'مشاهدهٔ راهکار',
		helpTitle: 'هنوز مطمئن نیستید؟',
		helpBody: 'با پشتیبانی ویجنت تماس بگیرید تا در یک گفتگوی کوتاه، راهکار مناسب کسب‌وکارتان را پیدا کنیم.',
		helpCta: 'تماس با پشتیبانی',
		helpAria: `تماس با پشتیبانی ویجنت به شماره ${SUPPORT_PHONE_DISPLAY}`,
		baPill: 'قبل و بعد',
		baTitle: 'یک روز کاری، قبل و بعد از ویجنت',
		baCols: ['موقعیت', 'بدون ویجنت', 'با ویجنت'],
	},
	en: {
		brand: 'Vigent', solutions: 'Solutions',
		pill: 'Vigent solutions',
		h1: 'The problems you see every day',
		h1Tail: 'and exactly how they get solved',
		lead: 'Instead of a feature list, we start from the real problem. Pick yours to see what changes with Vigent.',
		findCta: 'Find my problem',
		allCta: 'All solutions',
		quick: 'Common problems',
		step: 'Step one',
		problemsTitle: 'Which problem sounds familiar?',
		tapHint: 'Pick any item',
		problemsList: 'Problems',
		problemTag: 'The problem',
		answerTag: 'With Vigent',
		related: 'Related solution',
		view: 'View solution',
		viewFor: (name: string) => `Solution: ${name}`,
		gridPill: 'One solution per concrete problem',
		gridTitle: 'Choose the right solution for your business',
		gridLead: 'They all run on one platform — switch on the rest whenever you like.',
		popular: 'Most used',
		cardCta: 'View solution',
		helpTitle: 'Still not sure?',
		helpBody: 'Call Vigent support and we’ll find the right solution for your business in one short conversation.',
		helpCta: 'Call support',
		helpAria: `Call Vigent support at ${SUPPORT_PHONE_DISPLAY}`,
		baPill: 'Before and after',
		baTitle: 'A working day, before and after Vigent',
		baCols: ['Situation', 'Without Vigent', 'With Vigent'],
	},
} as const

// Real business problems, each mapped to the solution page that answers it.
const PROBLEMS: Record<'fa' | 'en', { short: string; problem: string; answer: string; gain: string; slug: string }[]> = {
	fa: [
		{ short: 'پیام‌ها در چند برنامه پخش شده‌اند', problem: 'دایرکت اینستاگرام یک‌جا، تلگرام یک‌جا، بله و روبیکا جدا و فرم سایت هم جدا. نتیجه‌اش پیام گم‌شده و پاسخ دیر است.', answer: 'همهٔ برنامه‌ها به یک ایجنت وصل می‌شوند و پیام‌ها در یک صندوق واحد می‌آیند؛ همان‌جا می‌خوانید، پاسخ می‌دهید و مشخصات مخاطب را می‌بینید.', gain: 'هیچ پیامی گم نمی‌شود', slug: 'unified-inbox' },
		{ short: 'مشتری خارج از ساعت کاری بی‌جواب می‌ماند', problem: 'مشتری شب پیام می‌دهد و تا فردا صبر می‌کند — یا اصلاً برنمی‌گردد.', answer: 'ایجنت ۲۴ ساعته با اطلاعات واقعی کسب‌وکار شما پاسخ می‌دهد؛ فارسی روان و با لحن برند خودتان.', gain: 'پاسخ در چند ثانیه، شب و روز', slug: 'persian-ai-chatbot' },
		{ short: 'قیمت و موجودی قدیمی گفته می‌شود', problem: 'قیمت و موجودی جاهای مختلف پراکنده است: اکسل، سایت و ذهن همکار. مشتری عدد قدیمی می‌شنود.', answer: 'فروشگاه ووکامرس با افزونهٔ رسمی همگام می‌شود و ایجنت همیشه از آخرین قیمت و موجودی جواب می‌دهد.', gain: 'عدد درست، هر بار', slug: 'woocommerce' },
		{ short: 'تاریخچهٔ مشتری جایی جمع نیست', problem: 'مشخصات، خریدهای قبلی و درخواست‌های مشتری در هیچ‌جا کنار هم نیست.', answer: 'از اولین پیام، پروندهٔ مخاطب ساخته می‌شود: راه ارتباطی، برنامه‌ها، تاریخچهٔ گفتگوها و سفارش‌ها — کنار همان پیام‌ها.', gain: 'یک پرونده برای هر مشتری', slug: 'unified-inbox' },
		{ short: 'اپراتور هر روز همان جواب‌ها را تکرار می‌کند', problem: '«این مدل هست؟ چه قیمتی؟ عکس دارید؟» — و اپراتور هر بار همان توضیح را تکرار می‌کند.', answer: 'ایجنت مدل موجود را پیدا می‌کند، قیمت را می‌گوید و کارت محصول را داخل همان گفتگو می‌فرستد.', gain: 'تیم روی موارد مهم', slug: 'ecommerce-ai' },
		{ short: 'گفتگوی حساس دیر دیده می‌شود', problem: 'گفتگوی حساس — مثل مشکل پرداخت — بین ده‌ها پیام معمولی گم می‌شود.', answer: 'ایجنت موضوع را تشخیص می‌دهد و گفتگو را با خلاصهٔ کامل به اپراتور می‌سپارد؛ پیگیری قابل ردیابی می‌شود.', gain: 'موارد حساس اول دیده می‌شوند', slug: 'customer-support-ai' },
	],
	en: [
		{ short: 'Messages are scattered across apps', problem: 'Instagram DMs in one place, Telegram in another, Bale and Rubika elsewhere, plus the website form. The result is lost messages and late replies.', answer: 'Every channel connects to one agent and messages land in a single inbox — read, reply and see the contact’s details in one place.', gain: 'No message gets lost', slug: 'unified-inbox' },
		{ short: 'Customers go unanswered after hours', problem: 'A customer messages at night and waits until morning — or never comes back.', answer: 'The agent answers around the clock from your real business data, in fluent Persian and your brand’s tone.', gain: 'Answers in seconds, day and night', slug: 'persian-ai-chatbot' },
		{ short: 'Customers hear outdated prices and stock', problem: 'Prices and stock live in a spreadsheet, the site and a teammate’s head. Customers hear stale numbers.', answer: 'Your WooCommerce store syncs through the official plugin, so the agent always answers from the latest price and stock.', gain: 'The right number, every time', slug: 'woocommerce' },
		{ short: 'Customer history lives nowhere', problem: 'Details, past purchases and requests are never in one place.', answer: 'From the first message a contact record builds itself: contact details, channels, conversation history and orders — right beside the messages.', gain: 'One record per customer', slug: 'unified-inbox' },
		{ short: 'Operators repeat the same answers all day', problem: '“Is this model available? What price? Any photos?” — and the operator repeats the same explanation every time.', answer: 'The agent finds the available model, states the price and sends the product card inside the same conversation.', gain: 'Your team focuses on what matters', slug: 'ecommerce-ai' },
		{ short: 'Sensitive conversations are seen late', problem: 'A sensitive conversation — like a failed payment — gets buried among dozens of routine messages.', answer: 'The agent recognises the issue and hands the conversation to an operator with a full summary; follow-up becomes trackable.', gain: 'Sensitive cases are seen first', slug: 'customer-support-ai' },
	],
}

const BEFORE_AFTER: Record<'fa' | 'en', { icon: IconType; situation: string; without: string; with: string }[]> = {
	fa: [
		{ icon: Moon, situation: 'پیام ساعت ۲ بامداد', without: 'تا صبح بی‌جواب می‌ماند', with: 'در چند ثانیه، از دادهٔ واقعی شما' },
		{ icon: MessageSquare, situation: '«این مدل هست؟ قیمتش؟»', without: 'اپراتور هر بار تکرار می‌کند', with: 'کارت محصول با موجودی لحظه‌ای' },
		{ icon: CreditCard, situation: 'مشکل پرداخت مشتری', without: 'بین پیام‌ها گم می‌شود', with: 'با خلاصه به اپراتور می‌رسد' },
		{ icon: UserRound, situation: 'تاریخچهٔ مشتری', without: 'در ذهن همکاران', with: 'پرونده در CRM، کنار پیام‌ها' },
	],
	en: [
		{ icon: Moon, situation: 'A message at 2 a.m.', without: 'Unanswered until morning', with: 'Answered in seconds from your real data' },
		{ icon: MessageSquare, situation: '“Is this in stock? Price?”', without: 'The operator repeats it every time', with: 'Product card with live stock' },
		{ icon: CreditCard, situation: 'A customer’s payment problem', without: 'Lost among the messages', with: 'Reaches an operator with a summary' },
		{ icon: UserRound, situation: 'Customer history', without: 'In teammates’ heads', with: 'A CRM record beside the messages' },
	],
}

const NUMS: Record<'fa' | 'en', string[]> = { fa: ['۱', '۲', '۳', '۴', '۵', '۶'], en: ['1', '2', '3', '4', '5', '6'] }

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
	const catalog = await getLocalizedSolutions(locale)
	const bySlug = new Map(catalog.map((solution) => [solution.slug, solution]))
	const solutions = SOLUTION_ORDER.filter((slug) => bySlug.has(slug))
	const problems: ProblemView[] = PROBLEMS[locale].map((item, index) => ({
		num: NUMS[locale][index],
		short: item.short,
		problem: item.problem,
		answer: item.answer,
		gain: item.gain,
		solution: SOLUTION_CARDS[item.slug]?.name[locale] ?? item.slug,
		href: `/solutions/${item.slug}`,
	}))

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
				itemListElement: catalog.map((solution, index) => ({
					'@type': 'ListItem',
					position: index + 1,
					name: solution.title,
					url: `${SITE_URL}/solutions/${solution.slug}`,
				})),
			},
		],
	}

	return (
		<>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

			{/* Hero */}
			<section className="relative px-4 pb-11 pt-[92px] text-center lg:pb-[72px] lg:pt-[150px]">
				<div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[470px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(199,189,240,0.3),rgba(245,245,243,0))] lg:h-[500px] lg:w-[900px]" />
				<div className="relative mx-auto flex max-w-[1200px] flex-col items-center">
					<SectionPill icon={Layers}>{copy.pill}</SectionPill>
					<h1 className="mt-4 max-w-[900px] text-balance text-[32px] font-bold leading-[1.45] lg:mt-[18px] lg:text-[56px] lg:leading-[1.35]">
						{copy.h1}
						<span className="block font-medium text-vg-dim">{copy.h1Tail}</span>
					</h1>
					<p className="mt-3 max-w-[680px] text-[15px] leading-[1.95] text-vg-sub lg:mt-[18px] lg:text-[18px]">{copy.lead}</p>
					{/* The page's job is matching a visitor to their problem, so the
					    hero steers straight into the problem list instead of selling. */}
					<div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3 lg:mt-[30px]">
						<a href="#problems" className={cn(btnDark, btnLg, 'w-full sm:w-auto')}>
							{copy.findCta}
							<ArrowDown aria-hidden className="size-[18px]" strokeWidth={2} />
						</a>
						<a href="#all-solutions" className={cn(btnGhost, btnLg, 'w-full sm:w-auto')}>{copy.allCta}</a>
					</div>
					<nav aria-label={copy.quick} className="mt-5 hidden max-w-[860px] flex-wrap justify-center gap-2 sm:flex lg:mt-6">
{problems.map((item, index) => (
							<a key={item.short} href={`#problem-${index}`} className="vg-press vg-btn-ghost inline-flex min-h-10 items-center rounded-full border border-black/[0.08] bg-white/70 px-3.5 text-[13px] text-vg-sub">{item.short}</a>
						))}
					</nav>
				</div>
			</section>

			{/* Problems → answers */}
<section id="problems" aria-labelledby="problems-title" className="scroll-mt-24 px-4 lg:pb-[110px]">
				<div className="mx-auto max-w-[1200px]">
					<div className="vg-rv flex flex-col items-center text-center lg:flex-row lg:items-end lg:justify-between lg:text-start">
						<div>
<h2 id="problems-title" className="text-[24px] font-bold leading-[1.5] lg:mt-2 lg:text-[34px] lg:leading-[1.4]">{copy.problemsTitle}</h2>
						</div>
						<span className="hidden text-[14px] text-vg-cap lg:inline">{copy.tapHint}</span>
					</div>

<div className="vg-rv-group mt-4 flex flex-col gap-2 lg:hidden">
						{problems.map((item, index) => (
							<details key={item.short} name="problems" open={index === 0} className="vg-details rounded-card border border-vg-line bg-white text-start open:border-black/[0.14] open:shadow-[var(--elev-1)]">
								<summary className="vg-press flex min-h-[58px] items-center gap-3 rounded-card px-3.5 py-2.5 text-[15px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vg-signal">
									<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-chip bg-[#f4f4f5] text-[14px] text-vg-sub">{item.num}</span>
									<h3 className="grow">{item.short}</h3>
								</summary>
{/* Fragment target inside the body: browsers auto-open the <details>. */}
								<div id={`problem-${index}`} className="vg-details-body scroll-mt-28 px-4 pb-4">
									<p className="text-[13.5px] leading-[1.9] text-vg-cap">{item.problem}</p>
									<div className="mt-2.5 rounded-2xl bg-[#f0fdf4] px-3.5 py-3">
										<p className="flex items-center gap-1.5 text-[12px] font-bold text-vg-ok"><Sparkles aria-hidden className="size-3.5" strokeWidth={2} />{copy.answerTag}</p>
										<p className="mt-1 text-[14.5px] font-medium leading-[1.9]">{item.answer}</p>
									</div>
									<Link href={item.href} className="vg-press mt-2.5 flex min-h-12 items-center justify-between rounded-control bg-vg-ink px-3.5 text-[14px] font-medium text-white">
										{copy.viewFor(item.solution)}
										<ForwardArrow locale={locale} />
									</Link>
								</div>
							</details>
						))}
					</div>

<div className="vg-rv mt-7 hidden lg:block">
						<ProblemPicker
							problems={problems}
							labels={{ list: copy.problemsList, problem: copy.problemTag, answer: copy.answerTag, related: copy.related, view: copy.view, arrow: <ForwardArrow locale={locale} /> }}
						/>
					</div>
				</div>
			</section>

			{/* Solution cards */}
<section id="all-solutions" aria-labelledby="solutions-grid-title" className="vg-cv mt-12 scroll-mt-24 px-4 lg:mt-0 lg:border-y lg:border-black/[0.06] lg:bg-white lg:py-[100px]">
				<Container className="px-0 sm:px-0 xl:px-0">
					<div className="vg-rv flex flex-col items-center text-center">
						<SectionPill icon={Check}>{copy.gridPill}</SectionPill>
						<h2 id="solutions-grid-title" className="mt-3 text-balance text-[24px] font-bold leading-[1.5] lg:mt-3.5 lg:text-[40px] lg:leading-[1.4]">{copy.gridTitle}</h2>
						<p className="mt-2 text-[14.5px] text-vg-sub lg:mt-2.5 lg:text-[16px]">{copy.gridLead}</p>
					</div>
<ul className="vg-rv-group mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:mt-9 lg:grid-cols-3 lg:gap-4">
						{solutions.map((slug, index) => {
							const meta = SOLUTION_CARDS[slug]
							const Icon = meta.icon
							const featured = index === 0
							return (
								<li key={slug} className={cn(featured && 'sm:col-span-2')}>
									<Link
										href={`/solutions/${slug}`}
										className={cn(
											'vg-press vg-lift flex h-full min-h-[200px] flex-col gap-2.5 rounded-3xl border p-[22px] text-start lg:min-h-[220px] lg:p-[26px]',
											featured ? 'border-vg-ink bg-vg-ink text-white' : 'border-vg-line bg-white text-vg-ink',
										)}
									>
										<span className="flex items-center justify-between">
											<span aria-hidden className={cn('inline-flex size-[46px] items-center justify-center rounded-control', featured ? 'bg-white/10 text-[#b9adff]' : 'bg-vg-tint text-vg-signal')}>
												<span className="inline-flex size-[21px]"><Icon className="size-full" strokeWidth={1.8} /></span>
											</span>
											{featured ? <span className="text-[12px] text-[#b9adff]">{copy.popular}</span> : null}
										</span>
										<h3 className="mt-1 text-[19px] font-bold lg:text-[20px]">{meta.name[locale]}</h3>
										<p className={cn('max-w-[560px] text-[14px] leading-[1.9] lg:text-[14.5px]', featured ? 'text-[#d4d4d8]' : 'text-vg-sub')}>{meta.card[locale]}</p>
										<span className="mt-auto flex items-center justify-between gap-3 pt-1">
											<span className="flex flex-wrap gap-1.5">
												{meta.tags[locale].map((tag) => <span key={tag} className={cn('rounded-full px-2.5 py-1 text-[12px]', featured ? 'bg-white/10' : 'bg-[#f4f4f5]')}>{tag}</span>)}
											</span>
											<span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[13.5px] font-medium', featured ? 'text-white' : 'text-vg-signal')}>
												{copy.cardCta}
												<ForwardArrow locale={locale} />
											</span>
										</span>
									</Link>
								</li>
							)
						})}
						{/* Fills the last slot of the 3-column grid (featured card spans two). */}
						<li className="hidden lg:block">
							<a href={SUPPORT_TEL} aria-label={copy.helpAria} className="vg-press vg-lift flex h-full min-h-[220px] flex-col gap-2.5 rounded-3xl border border-dashed border-black/15 p-[26px] text-start">
								<span aria-hidden className="inline-flex size-[46px] items-center justify-center rounded-control bg-white text-vg-ink"><Phone className="size-[21px]" strokeWidth={1.8} /></span>
								<h3 className="mt-1 text-[20px] font-bold">{copy.helpTitle}</h3>
								<p className="text-[14.5px] leading-[1.9] text-vg-sub">{copy.helpBody}</p>
								<span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-[13.5px] font-medium text-vg-signal">{copy.helpCta}<ForwardArrow locale={locale} /></span>
							</a>
						</li>
					</ul>
				</Container>
			</section>

			{/* Before / after */}
			<section aria-labelledby="before-after-title" className="vg-cv mt-12 px-4 lg:mt-0 lg:pt-[100px]">
				<div className="mx-auto max-w-[1200px]">
					<div className="vg-rv flex flex-col items-center text-center">
						<SectionPill icon={Clock}>{copy.baPill}</SectionPill>
						<h2 id="before-after-title" className="mt-3 text-[24px] font-bold leading-[1.5] lg:mt-3.5 lg:text-[40px] lg:leading-[1.4]">{copy.baTitle}</h2>
					</div>
					<div className="mt-4 overflow-hidden lg:mt-[30px] lg:rounded-card lg:border lg:border-vg-line lg:bg-white">
						<div aria-hidden className="hidden grid-cols-3 gap-5 bg-[#fafaf9] px-7 py-4 text-[13px] font-medium text-vg-cap lg:grid">
							{copy.baCols.map((col) => <span key={col}>{col}</span>)}
						</div>
<ul className="vg-rv-group flex flex-col gap-2.5 lg:gap-0">
							{BEFORE_AFTER[locale].map((row) => {
								const Icon = row.icon
								return (
									<li key={row.situation} className="rounded-card border border-vg-line bg-white p-4 text-start lg:grid lg:grid-cols-3 lg:items-center lg:gap-5 lg:rounded-none lg:border-0 lg:border-t lg:border-black/[0.06] lg:px-7 lg:py-5 lg:text-[15px]">
										<span className="flex items-center gap-2.5 text-[15px] font-bold lg:gap-3">
											<span aria-hidden className="inline-flex size-[34px] items-center justify-center rounded-chip bg-[#f4f4f5] lg:size-9 lg:rounded-chip"><Icon className="size-4" strokeWidth={1.8} /></span>
											{row.situation}
										</span>
										<span className="mt-2.5 flex items-center gap-2 text-[13.5px] text-vg-cap lg:mt-0 lg:text-[15px]">
											<X aria-hidden className="size-4 shrink-0 text-[#b91c1c]" strokeWidth={2} />
											<span className="sr-only">{copy.baCols[1]}: </span>{row.without}
										</span>
										<span className="mt-1.5 flex items-center gap-2 text-[13.5px] font-medium text-[#166534] lg:mt-0 lg:text-[15px]">
											<Check aria-hidden className="size-4 shrink-0" strokeWidth={2.2} />
											<span className="sr-only">{copy.baCols[2]}: </span>{row.with}
										</span>
									</li>
								)
							})}
						</ul>
					</div>
				</div>
			</section>
		</>
	)
}
