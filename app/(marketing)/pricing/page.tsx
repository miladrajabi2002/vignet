import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BadgeCheck, ChevronDown, CreditCard, Sparkles } from 'lucide-react'
import { PricingSection } from '@/components/marketing/pricing-section'
import { getEffectivePlanDefs, PAID_PLANS, type PaidPlan } from '@/lib/billing/plans'
import { jsonLdScript } from '@/lib/seo/json-ld'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'

export const metadata: Metadata = {
	title: 'تعرفه‌ها و پلن‌ها',
	description: 'پلن‌ها، تعرفه ماهانه و اعتبار پاسخ هوش مصنوعی ویجنت را شفاف مقایسه کنید و پلن مناسب کسب‌وکار خود را انتخاب کنید.',
	alternates: { canonical: `${SITE_URL}/pricing` },
	openGraph: {
		type: 'website',
		url: `${SITE_URL}/pricing`,
		title: 'تعرفه‌ها و پلن‌های ویجنت',
		description: 'مقایسه شفاف پلن‌ها، اعتبار پاسخ هوش مصنوعی و امکانات هر سطح از ویجنت.',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'تعرفه‌ها و پلن‌های ویجنت',
		description: 'مقایسه شفاف پلن‌ها، اعتبار پاسخ هوش مصنوعی و امکانات هر سطح از ویجنت.',
	},
}

const assurances = [
	{ icon: Sparkles, title: 'یک ماه شروع رایگان', text: 'فرصت کافی برای راه‌اندازی و ارزیابی جریان واقعی کسب‌وکار.' },
	{ icon: CreditCard, title: 'مصرف شفاف اعتبار', text: 'اعتبار هوش مصنوعی فقط مطابق مصرف ثبت‌شده در داشبورد محاسبه می‌شود.' },
	{ icon: BadgeCheck, title: 'بدون هزینه پاسخ ناموفق', text: 'پاسخ ناموفق هزینه‌ای ندارد و اتوماسیون ثابت اینستاگرام رایگان است.' },
] as const

const PLAN_FA_NAMES: Record<PaidPlan, string> = {
	STARTER: 'استارتر',
	PRO: 'حرفه‌ای',
	BUSINESS: 'بیزینس',
}

/**
 * Real buyer questions, answered from how the product actually works
 * (credit-per-successful-reply billing, channel catalog, operator handoff).
 * Rendered visibly below the plans and mirrored in the FAQPage JSON-LD.
 */
const PRICING_FAQ = [
	{
		q: 'هزینه پاسخ‌های هوش مصنوعی چطور محاسبه می‌شود؟',
		a: 'اعتبار پاسخ به‌صورت پیش‌پرداخت شارژ می‌شود و فقط بعد از هر پاسخ موفق هوش مصنوعی، به اندازه همان پاسخ از اعتبار کم می‌شود. پاسخ ناموفق هیچ هزینه‌ای ندارد و اتوماسیون‌های ثابت اینستاگرام (مثل پاسخ خودکار به کامنت و استوری) کاملاً رایگان هستند. گزارش مصرف هم به‌صورت شفاف در داشبورد قابل مشاهده است.',
	},
	{
		q: 'ویجنت از چه کانال‌هایی پشتیبانی می‌کند؟',
		a: 'اینستاگرام (دایرکت، کامنت و استوری)، تلگرام، بله، روبیکا، ویجت چت وب‌سایت و لینک چت اختصاصی. فروشگاه‌های ووکامرس هم می‌توانند محصولات خود را مستقیم به ایجنت متصل کنند. همه گفتگوها در یک صندوق یکپارچه مدیریت می‌شوند.',
	},
	{
		q: 'راه‌اندازی چقدر طول می‌کشد و به دانش فنی نیاز دارد؟',
		a: 'راه‌اندازی معمولاً چند دقیقه طول می‌کشد و به هیچ دانش برنامه‌نویسی نیاز ندارد: ایجنت را می‌سازید، اطلاعات و محصولات کسب‌وکار را اضافه می‌کنید و کانال دلخواه را با چند کلیک وصل می‌کنید. از همان لحظه اتصال، ایجنت پاسخ‌گویی را شروع می‌کند.',
	},
	{
		q: 'آیا اطلاعات کسب‌وکار من امن می‌ماند؟',
		a: 'بله. اطلاعات، محصولات و پایگاه دانش شما فقط در فضای کاری خودتان نگهداری می‌شود و صرفاً برای پاسخ‌دادن به مشتریان همان کسب‌وکار استفاده می‌شود. داده‌های شما در اختیار کسب‌وکارهای دیگر قرار نمی‌گیرد و هر زمان بخواهید می‌توانید آن‌ها را ویرایش یا حذف کنید.',
	},
	{
		q: 'می‌توانم پلنم را تغییر دهم یا لغو کنم؟',
		a: 'بله. پلن‌ها ماهانه هستند و هر زمان می‌توانید از بخش «اشتراک و پرداخت» داشبورد، پلن را ارتقا دهید، تغییر دهید یا تمدید نکنید. اعتبار پاسخ باقی‌مانده شما مستقل از پلن است و با تغییر پلن از بین نمی‌رود.',
	},
	{
		q: 'اگر هوش مصنوعی پاسخ سؤالی را نداند چه اتفاقی می‌افتد؟',
		a: 'ایجنت به‌جای حدس‌زدن، گفتگو را همراه با خلاصه کامل به اپراتور انسانی شما منتقل می‌کند تا مشتری بدون پاسخ نماند. برای این انتقال هزینه‌ای از اعتبار شما کم نمی‌شود.',
	},
] as const

export default async function PricingPage() {
	// Same catalog the checkout and PricingSection use — the schema below never
	// drifts from the rendered prices.
	const defs = await getEffectivePlanDefs()
	const canonical = `${SITE_URL}/pricing`
	const jsonLd = {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'SoftwareApplication',
				'@id': `${canonical}#product`,
				name: 'Vigent',
				alternateName: 'ویجنت',
				applicationCategory: 'BusinessApplication',
				operatingSystem: 'Web',
				url: canonical,
				description:
					'ایجنت هوشمند فروش و پشتیبانی فارسی برای اینستاگرام، تلگرام، بله، روبیکا و وب‌سایت — با یک ماه شروع رایگان.',
				offers: PAID_PLANS.map((plan) => {
					const def = defs[plan]
					return {
						'@type': 'Offer',
						name: `پلن ${PLAN_FA_NAMES[plan]}`,
						// priceIRR is in rials; the UI shows priceIRR / 10 tomans.
						price: String(def.priceIRR),
						priceCurrency: 'IRR',
						url: canonical,
						availability: 'https://schema.org/InStock',
						description: `اشتراک ماهانه پلن ${PLAN_FA_NAMES[plan]} ویجنت (${(def.priceIRR / 10).toLocaleString('fa-IR')} تومان در ماه) با ${(def.includedCreditIRR / 10).toLocaleString('fa-IR')} تومان اعتبار پاسخ هدیه و تا ${def.maxChannels.toLocaleString('fa-IR')} اتصال کانال فعال.`,
					}
				}),
			},
			{
				'@type': 'BreadcrumbList',
				'@id': `${canonical}#breadcrumb`,
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'ویجنت', item: SITE_URL },
					{ '@type': 'ListItem', position: 2, name: 'تعرفه‌ها و پلن‌ها', item: canonical },
				],
			},
			{
				'@type': 'FAQPage',
				'@id': `${canonical}#faq`,
				mainEntity: PRICING_FAQ.map((item) => ({
					'@type': 'Question',
					name: item.q,
					acceptedAnswer: { '@type': 'Answer', text: item.a },
				})),
			},
		],
	}

	return (
		<div className="marketing-page-shell min-h-screen pb-20 pt-24 sm:pt-28">
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
			<div className="mx-auto max-w-7xl px-3 sm:px-5">
				<header className="marketing-page-hero marketing-grid-dark px-6 py-12 text-white sm:px-10 sm:py-16">
					<div className="relative z-10 mx-auto max-w-3xl text-center">
						<p className="text-[10px] font-medium tracking-[0.14em] text-white/40 rtl:tracking-normal">VIGENT PRICING</p>
						<h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.2] tracking-[-0.04em] sm:text-5xl rtl:tracking-normal">
							تعرفه روشن برای رشد واقعی کسب‌وکار
						</h1>
						<p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/50">
							از یک ماه رایگان شروع کنید، پلن مناسب تعداد کانال‌های خود را انتخاب کنید و مصرف پاسخ‌های هوش مصنوعی را شفاف ببینید.
						</p>
					</div>
				</header>

				<section className="relative z-10 -mt-5 grid gap-3 px-3 sm:grid-cols-3 sm:px-6" aria-label="مزایای تعرفه ویجنت">
					{assurances.map(({ icon: Icon, title, text }) => (
						<article key={title} className="spatial-surface rounded-[1.5rem] bg-white p-5">
							<span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white">
								<Icon className="h-4 w-4" />
							</span>
							<h2 className="mt-4 text-sm font-semibold text-black">{title}</h2>
							<p className="mt-2 text-xs leading-6 text-black/45">{text}</p>
						</article>
					))}
				</section>
			</div>

			<Suspense fallback={<div className="min-h-[38rem]" aria-hidden />}>
				<PricingSection />
			</Suspense>

			<section aria-labelledby="pricing-faq-title" className="mx-auto mt-4 max-w-7xl px-3 sm:px-5">
				<div className="mx-auto grid max-w-6xl gap-10 rounded-[2rem] border border-black/[0.08] bg-white px-6 py-12 shadow-[0_18px_55px_rgba(0,0,0,0.06)] sm:px-10 sm:py-14 lg:grid-cols-[0.7fr_1.3fr]">
					<div>
						<p className="text-[11px] font-medium text-black/40">سؤال‌های متداول</p>
						<h2 id="pricing-faq-title" className="mt-4 text-3xl font-semibold leading-[1.35] tracking-[-0.035em] text-black rtl:tracking-normal sm:text-4xl">
							قبل از انتخاب پلن، شفاف بدانید
						</h2>
						<p className="mt-4 max-w-sm text-sm leading-7 text-black/50">
							پاسخ کوتاه سؤال‌هایی که خریداران قبل از شروع می‌پرسند. برای جزئیات بیشتر، مستندات پلن‌ها و پرداخت را ببینید.
						</p>
					</div>
					<div className="divide-y divide-black/10 border-y border-black/10">
						{PRICING_FAQ.map((item) => (
							<details key={item.q} className="group">
								<summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black">
									<span>{item.q}</span>
									<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10">
										<ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
									</span>
								</summary>
								<p className="max-w-2xl pb-5 pe-10 text-sm leading-7 text-black/50">{item.a}</p>
							</details>
						))}
					</div>
				</div>
			</section>
		</div>
	)
}
