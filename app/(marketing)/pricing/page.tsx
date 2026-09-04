import type { Metadata } from 'next'
import { Suspense } from 'react'
import { BadgeCheck, ChevronDown, CreditCard, Sparkles } from 'lucide-react'
import { getLocale } from 'next-intl/server'
import { PricingSection } from '@/components/marketing/pricing-section'
import { getEffectivePlanDefs, PAID_PLANS, type PaidPlan } from '@/lib/billing/plans'
import { jsonLdScript } from '@/lib/seo/json-ld'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'

// Bilingual shell copy. The pricing cards themselves (PricingSection) were
// already locale-aware; this makes the surrounding page — hero, assurances,
// FAQ, metadata and JSON-LD — fully English at /en/pricing so the URL is
// genuinely bilingual and can carry hreflang alternates again.
const COPY = {
        fa: {
                title: 'تعرفه‌ها و پلن‌ها',
                description: 'پلن‌ها، تعرفه ماهانه و اعتبار پاسخ هوش مصنوعی ویجنت را شفاف مقایسه کنید و پلن مناسب کسب‌وکار خود را انتخاب کنید.',
                ogTitle: 'تعرفه‌ها و پلن‌های ویجنت',
                ogDescription: 'مقایسه شفاف پلن‌ها، اعتبار پاسخ هوش مصنوعی و امکانات هر سطح از ویجنت.',
                heroEyebrow: 'VIGENT PRICING',
                h1: 'تعرفه روشن برای رشد واقعی کسب‌وکار',
                subtitle: 'از یک ماه رایگان شروع کنید، پلن مناسب تعداد کانال‌های خود را انتخاب کنید و مصرف پاسخ‌های هوش مصنوعی را شفاف ببینید.',
                assurancesLabel: 'مزایای تعرفه ویجنت',
                assurances: [
                        { title: 'یک ماه شروع رایگان', text: 'فرصت کافی برای راه‌اندازی و ارزیابی جریان واقعی کسب‌وکار.' },
                        { title: 'مصرف شفاف اعتبار', text: 'اعتبار هوش مصنوعی فقط مطابق مصرف ثبت‌شده در داشبورد محاسبه می‌شود.' },
                        { title: 'بدون هزینه پاسخ ناموفق', text: 'پاسخ ناموفق هزینه‌ای ندارد و اتوماسیون ثابت اینستاگرام رایگان است.' },
                ],
                faqEyebrow: 'سؤال‌های متداول',
                faqH2: 'قبل از انتخاب پلن، شفاف بدانید',
                faqIntro: 'پاسخ کوتاه سؤال‌هایی که خریداران قبل از شروع می‌پرسند. برای جزئیات بیشتر، مستندات پلن‌ها و پرداخت را ببینید.',
                planNames: { STARTER: 'استارتر', PRO: 'حرفه‌ای', BUSINESS: 'بیزینس' } as Record<PaidPlan, string>,
                appDescription: 'ایجنت هوشمند فروش و پشتیبانی فارسی برای اینستاگرام، تلگرام، بله، روبیکا و وب‌سایت — با یک ماه شروع رایگان.',
                offerName: (plan: string) => `پلن ${plan}`,
                offerDescription: (plan: string, priceToman: string, creditToman: string, channels: string) =>
                        `اشتراک ماهانه پلن ${plan} ویجنت (${priceToman} تومان در ماه) با ${creditToman} تومان اعتبار پاسخ هدیه و تا ${channels} اتصال کانال فعال.`,
                breadcrumbHome: 'ویجنت',
                breadcrumbCurrent: 'تعرفه‌ها و پلن‌ها',
        },
        en: {
                title: 'Pricing and plans',
                description: 'Compare Vigent plans, monthly pricing and AI reply credit transparently, and pick the right plan for your business.',
                ogTitle: 'Vigent pricing and plans',
                ogDescription: 'A transparent comparison of plans, AI reply credit and what each Vigent tier includes.',
                heroEyebrow: 'VIGENT PRICING',
                h1: 'Transparent pricing for real growth',
                subtitle: 'Start with a free month, pick the plan that matches your number of channels, and see exactly what each AI reply costs.',
                assurancesLabel: 'What you get with every plan',
                assurances: [
                        { title: 'One month free to start', text: 'Enough time to set up and evaluate against your real business flow.' },
                        { title: 'Transparent credit usage', text: 'AI credit is billed exactly as the usage recorded in your dashboard.' },
                        { title: 'No charge for failed replies', text: 'Failed replies cost nothing, and deterministic Instagram automation is free.' },
                ],
                faqEyebrow: 'Frequently asked questions',
                faqH2: 'Know exactly what you get before choosing',
                faqIntro: 'Short answers to the questions buyers ask before starting. For details, see the plans and billing documentation.',
                planNames: { STARTER: 'Starter', PRO: 'Pro', BUSINESS: 'Business' } as Record<PaidPlan, string>,
                appDescription: 'Persian AI sales and support agent for Instagram, Telegram, Bale, Rubika and the web — with a free first month.',
                offerName: (plan: string) => `${plan} plan`,
                offerDescription: (plan: string, priceToman: string, creditToman: string, channels: string) =>
                        `Vigent ${plan} monthly subscription (${priceToman} toman/month) with ${creditToman} toman of included reply credit and up to ${channels} active channel connections.`,
                breadcrumbHome: 'Vigent',
                breadcrumbCurrent: 'Pricing',
        },
} as const

/**
 * Real buyer questions, answered from how the product actually works
 * (credit-per-successful-reply billing, channel catalog, operator handoff).
 * Rendered visibly below the plans and mirrored in the FAQPage JSON-LD.
 */
const PRICING_FAQ = {
        fa: [
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
        ],
        en: [
                {
                        q: 'How are AI reply costs calculated?',
                        a: 'AI credit is prepaid and deducted only after each successful AI reply, one reply at a time. Failed replies cost nothing, and deterministic Instagram automations (such as automatic replies to comments and stories) are completely free. Usage is reported transparently in your dashboard.',
                },
                {
                        q: 'Which channels does Vigent support?',
                        a: 'Instagram (DMs, comments and stories), Telegram, Bale, Rubika, a website chat widget and a dedicated chat link. WooCommerce stores can connect their product catalog directly to the agent, and every conversation is managed in one unified inbox.',
                },
                {
                        q: 'How long does setup take? Does it need technical skills?',
                        a: 'Setup usually takes a few minutes and requires no programming: create your agent, add your business information and products, then connect your channel in a few clicks. From the moment it connects, the agent starts answering.',
                },
                {
                        q: 'Is my business data kept secure?',
                        a: 'Yes. Your information, products and knowledge base are stored only in your own workspace and are used solely to answer your customers. Your data is never shared with other businesses, and you can edit or delete it whenever you want.',
                },
                {
                        q: 'Can I change or cancel my plan?',
                        a: 'Plans renew monthly. Any time, from the "Subscription & billing" section of the dashboard, you can upgrade, switch, or simply not renew. Remaining AI credit is independent of your plan and survives plan changes.',
                },
                {
                        q: 'What happens when the AI does not know an answer?',
                        a: 'Instead of guessing, the agent hands the conversation over to your human operator with a full summary, so no customer is left unanswered. This handoff does not deduct anything from your credit.',
                },
        ],
} as const

const ASSURANCE_ICONS = [Sparkles, CreditCard, BadgeCheck] as const

// Per-request rendering: /pricing and /en/pricing share this route via the
// middleware rewrite, and a statically prerendered shell would bake the fa
// copy + fa metadata into the English URL (the "mixed shell" problem that
// kept /en/pricing out of the sitemap). Prices and locale must resolve per
// request; this page renders server-side in tens of milliseconds anyway.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
        const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
        const copy = COPY[locale]
        const url = locale === 'en' ? `${SITE_URL}/en/pricing` : `${SITE_URL}/pricing`

        return {
                title: copy.title,
                description: copy.description,
                alternates: {
                        canonical: url,
                        // /en/pricing is now fully English (this page + the pricing
                        // cards), so both locales advertise each other again.
                        languages: {
                                fa: `${SITE_URL}/pricing`,
                                en: `${SITE_URL}/en/pricing`,
                                'x-default': `${SITE_URL}/pricing`,
                        },
                },
                openGraph: {
                        type: 'website',
                        url,
                        title: copy.ogTitle,
                        description: copy.ogDescription,
                        // The page replaces the root openGraph object, so reference the shared
                        // 1200x630 file-convention card explicitly (see homepage for details).
                        images: [{
                                url: `${SITE_URL}/opengraph-image`,
                                width: 1200,
                                height: 630,
                                alt: copy.ogTitle,
                        }],
                },
                twitter: {
                        card: 'summary_large_image',
                        title: copy.ogTitle,
                        description: copy.ogDescription,
                },
        }
}

export default async function PricingPage() {
        const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
        const copy = COPY[locale]
        const faqItems = PRICING_FAQ[locale]
        const number = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')

        // Same catalog the checkout and PricingSection use — the schema below never
        // drifts from the rendered prices.
        const defs = await getEffectivePlanDefs()
        const canonical = locale === 'en' ? `${SITE_URL}/en/pricing` : `${SITE_URL}/pricing`
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
                                description: copy.appDescription,
                                offers: PAID_PLANS.map((plan) => {
                                        const def = defs[plan]
                                        const planName = copy.planNames[plan]
                                        return {
                                                '@type': 'Offer',
                                                name: copy.offerName(planName),
                                                // priceIRR is in rials; the UI shows priceIRR / 10 tomans.
                                                price: String(def.priceIRR),
                                                priceCurrency: 'IRR',
                                                url: canonical,
                                                availability: 'https://schema.org/InStock',
                                                description: copy.offerDescription(
                                                        planName,
                                                        number.format(def.priceIRR / 10),
                                                        number.format(def.includedCreditIRR / 10),
                                                        number.format(def.maxChannels),
                                                ),
                                        }
                                }),
                        },
                        {
                                '@type': 'BreadcrumbList',
                                '@id': `${canonical}#breadcrumb`,
                                itemListElement: [
                                        { '@type': 'ListItem', position: 1, name: copy.breadcrumbHome, item: SITE_URL },
                                        { '@type': 'ListItem', position: 2, name: copy.breadcrumbCurrent, item: canonical },
                                ],
                        },
                        {
                                '@type': 'FAQPage',
                                '@id': `${canonical}#faq`,
                                mainEntity: faqItems.map((item) => ({
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
                                                <p className="text-[10px] font-medium tracking-[0.14em] text-white/40 rtl:tracking-normal">{copy.heroEyebrow}</p>
                                                <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.2] tracking-[-0.04em] sm:text-5xl rtl:tracking-normal">
                                                        {copy.h1}
                                                </h1>
                                                <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/50">
                                                        {copy.subtitle}
                                                </p>
                                        </div>
                                </header>

                                <section className="relative z-10 -mt-5 grid gap-3 px-3 sm:grid-cols-3 sm:px-6" aria-label={copy.assurancesLabel}>
                                        {copy.assurances.map(({ title, text }, index) => {
                                                const Icon = ASSURANCE_ICONS[index]
                                                return (
                                                        <article key={title} className="spatial-surface rounded-[1.5rem] bg-white p-5">
                                                                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white">
                                                                        <Icon className="h-4 w-4" />
                                                                </span>
                                                                <h2 className="mt-4 text-sm font-semibold text-black">{title}</h2>
                                                                <p className="mt-2 text-xs leading-6 text-black/45">{text}</p>
                                                        </article>
                                                )
                                        })}
                                </section>
                        </div>

                        <Suspense fallback={<div className="min-h-[38rem]" aria-hidden />}>
                                <PricingSection />
                        </Suspense>

                        <section aria-labelledby="pricing-faq-title" className="mx-auto mt-4 max-w-7xl px-3 sm:px-5">
                                <div className="mx-auto grid max-w-6xl gap-10 rounded-[2rem] border border-black/[0.08] bg-white px-6 py-12 shadow-[0_18px_55px_rgba(0,0,0,0.06)] sm:px-10 sm:py-14 lg:grid-cols-[0.7fr_1.3fr]">
                                        <div>
                                                <p className="text-[11px] font-medium text-black/40">{copy.faqEyebrow}</p>
                                                <h2 id="pricing-faq-title" className="mt-4 text-3xl font-semibold leading-[1.35] tracking-[-0.035em] text-black rtl:tracking-normal sm:text-4xl">
                                                        {copy.faqH2}
                                                </h2>
                                                <p className="mt-4 max-w-sm text-sm leading-7 text-black/50">
                                                        {copy.faqIntro}
                                                </p>
                                        </div>
                                        <div className="divide-y divide-black/10 border-y border-black/10">
                                                {faqItems.map((item) => (
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
