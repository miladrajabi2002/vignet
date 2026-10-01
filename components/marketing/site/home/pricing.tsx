import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Check, ShieldCheck, Sparkles } from 'lucide-react'
import { getEffectivePlanDefs, PAID_PLANS, type PaidPlan } from '@/lib/billing/plans'
import { InstagramIcon } from '@/components/marketing/social-links'
import { cn } from '@/lib/utils'
import { Container, SIGNUP_HREF, SectionHead, btnDark, btnGhost, type SiteLocale } from '../ui'
import { PlanLimits, PlanTabs, type PlanView } from './plan-tabs'

const PLAN_KEY: Record<PaidPlan, 'starter' | 'pro' | 'business'> = { STARTER: 'starter', PRO: 'pro', BUSINESS: 'business' }

const COPY = {
	fa: {
		pill: 'شروع بدون ریسک',
		title: 'اول بسازید و امتحان کنید؛ بعد پلن بخرید',
		titleShort: 'اول امتحان کنید؛ بعد پلن بخرید',
		lead: 'اشتراک ماهانه برای پلتفرم و برنامه‌های متصل است؛ اعتبار هوش مصنوعی جداست، منقضی نمی‌شود و فقط برای پاسخ موفق کم می‌شود.',
		leadShort: 'اعتبار هوش مصنوعی جداست، منقضی نمی‌شود و فقط برای پاسخ موفق کم می‌شود.',
		trialTitle: 'شروع رایگان، قبل از خرید',
		trialBody: 'امکانات اصلی، اعتبار اولیهٔ پاسخ و یک برنامهٔ متصل؛ ایجنت را روی گفتگوهای واقعی خودتان بسنجید.',
		trialCta: 'شروع دورهٔ رایگان',
		channels: 'برنامهٔ متصل هم‌زمان',
		products: 'محصول در کاتالوگ',
		orders: 'سفارش فروشگاه',
		customers: 'مشتری در CRM',
		credit: 'اعتبار هدیه با هر پرداخت',
		toman: 'تومان',
		limitsLabel: 'سقف‌های پلن',
		all: 'همهٔ قابلیت‌ها + ایجنت نامحدود',
		same: 'همهٔ قابلیت‌ها در هر سه پلن یکسان است؛ پلن‌ها فقط در سقف برنامه‌ها، محصولات، سفارش‌ها، مشتری‌ها و اعتبار هدیه فرق دارند. هر وقت به سقف برسید، پنل خودش پلن مناسب بعدی را پیشنهاد می‌دهد.',
		pick: (name: string) => `انتخاب ${name}`,
		badge: 'پیشنهاد ما',
		tabs: 'انتخاب پلن',
		noteA: 'اتوماسیون ثابت اینستاگرام بدون کسر اعتبار',
		noteASub: '— در طول اشتراک یا دورهٔ آزمایشی',
		noteB: 'درخواست ناموفق، بدون هزینه',
		noteBSub: '— اعتبار منقضی نمی‌شود',
	},
	en: {
		pill: 'Start without risk',
		title: 'Build and test first — then buy a plan',
		titleShort: 'Try it first — then buy a plan',
		lead: 'The monthly subscription covers the platform and connected apps; AI credit is separate, never expires and is only used by successful replies.',
		leadShort: 'AI credit is separate, never expires and is only used by successful replies.',
		trialTitle: 'Start free, before you buy',
		trialBody: 'Core features, starter reply credit and one connected app — measure the agent on your own real conversations.',
		trialCta: 'Start the free trial',
		channels: 'Connected apps at once',
		products: 'Catalog products',
		orders: 'Store orders',
		customers: 'CRM customers',
		credit: 'Bonus credit per payment',
		toman: 'toman',
		limitsLabel: 'Plan limits',
		all: 'Every feature + unlimited agents',
		same: 'Every plan has every feature; plans differ only in their limits on apps, products, orders, customers and bonus credit. When you reach a limit, the panel suggests the right next plan.',
		pick: (name: string) => `Choose ${name}`,
		badge: 'Recommended',
		tabs: 'Choose a plan',
		noteA: 'Deterministic Instagram automation uses no credit',
		noteASub: '— during a subscription or the trial',
		noteB: 'Failed requests cost nothing',
		noteBSub: '— credit never expires',
	},
} as const

export async function Pricing({ locale }: { locale: SiteLocale }) {
	const c = COPY[locale]
	const [t, defs] = await Promise.all([getTranslations('marketing.pricing'), getEffectivePlanDefs()])
	const number = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
	const plans: PlanView[] = PAID_PLANS.map((plan) => {
		const def = defs[plan]
		const name = t(`plans.${PLAN_KEY[plan]}.name`)
		return {
			id: plan,
			name,
			audience: t(`plans.${PLAN_KEY[plan]}.audience`),
			price: number.format(def.priceIRR / 10),
			unit: t('tomanPerMonth'),
			// Plans differ only in these limits, so they render as a label/value
			// table with the numbers aligned — comparable at a glance.
			limits: [
				{ label: c.channels, value: number.format(def.maxChannels) },
				{ label: c.products, value: number.format(def.maxProducts) },
				{ label: c.orders, value: number.format(def.maxOrders) },
				{ label: c.customers, value: number.format(def.maxCustomers) },
				{ label: c.credit, value: number.format(def.includedCreditIRR / 10), unit: c.toman },
			],
			limitsLabel: c.limitsLabel,
			all: c.all,
			href: `/login?plan=${plan}`,
			cta: c.pick(name),
			recommended: plan === 'PRO',
			badge: c.badge,
		}
	})

	return (
		<section id="pricing" aria-labelledby="pricing-title" className="vg-cv scroll-mt-24 pt-[52px] lg:border-y lg:border-black/[0.06] lg:bg-white lg:py-[110px]">
			<Container>
				<SectionHead
					id="pricing-title"
					pill={c.pill}
					icon={ShieldCheck}
					title={<><span className="lg:hidden">{c.titleShort}</span><span className="hidden lg:inline">{c.title}</span></>}
					lead={<><span className="lg:hidden">{c.leadShort}</span><span className="hidden lg:inline">{c.lead}</span></>}
					titleClassName="lg:leading-[1.4]"
					className="vg-rv"
				/>

				<div className="vg-rv mt-4 flex flex-col items-center gap-1.5 rounded-card border border-[rgba(110,86,207,0.2)] bg-vg-tint px-4 py-[18px] text-center lg:mt-9 lg:flex-row lg:justify-between lg:gap-4 lg:px-7 lg:py-[22px] lg:text-start">
					<div className="flex flex-col items-center gap-1.5 lg:flex-row lg:gap-4">
						<span aria-hidden className="inline-flex size-10 items-center justify-center rounded-xl bg-vg-signal text-white lg:size-12 lg:rounded-control"><Sparkles className="size-[19px] lg:size-[22px]" strokeWidth={1.8} /></span>
						<div>
							<h3 className="text-[16px] font-bold lg:text-[18px]">{c.trialTitle}</h3>
							<p className="text-[13px] leading-[1.9] text-vg-sub lg:mt-0.5 lg:text-[14px]">{c.trialBody}</p>
						</div>
					</div>
					<Link href={SIGNUP_HREF} className={cn(btnDark, 'hidden h-12 rounded-control px-[22px] text-[15px] shadow-none lg:inline-flex')}>{c.trialCta}</Link>
				</div>

				<div className="vg-rv mt-3.5 lg:hidden">
					<PlanTabs plans={plans} label={c.tabs} />
				</div>

				<div className="vg-rv-group mt-9 hidden grid-cols-3 items-stretch gap-4 lg:grid">
					{plans.map((plan) => (
						<article
							key={plan.id}
							className={cn('relative flex flex-col rounded-card border bg-white p-[30px]', plan.recommended ? 'border-vg-ink shadow-[0_0_0_1px_#111111,var(--elev-2)]' : 'vg-lift border-black/10')}
						>
							{plan.recommended ? <span className="absolute end-6 top-6 rounded-full bg-vg-soft px-3 py-[5px] text-[12px] font-medium text-[#5746af]">{plan.badge}</span> : null}
							<h3 className="text-[20px] font-bold">{plan.name}</h3>
							<p className="mt-1.5 text-[14px] leading-[1.8] text-vg-cap">{plan.audience}</p>
							<p className="mt-[22px] flex items-baseline gap-2"><span className="text-[38px] font-bold tabular-nums">{plan.price}</span><span className="text-[14px] text-vg-cap">{plan.unit}</span></p>
							<div className="mt-[22px]">
								<PlanLimits plan={plan} />
							</div>
							<Link
								href={plan.href}
								className={cn(
									'vg-press mt-7 inline-flex h-[50px] items-center justify-center rounded-control text-[15px] font-medium',
									plan.recommended ? cn(btnDark, 'vg-sheen') : cn(btnGhost, 'bg-transparent'),
								)}
							>
								{plan.cta}
							</Link>
						</article>
					))}
				</div>

				<p className="vg-rv mx-auto mt-4 flex max-w-[860px] items-start justify-center gap-2 px-2 text-center text-[13px] leading-[1.9] text-vg-sub lg:mt-6 lg:text-[14px]">
					<Check aria-hidden className="mt-[5px] size-4 shrink-0 text-vg-ok" strokeWidth={2.2} />
					<span>{c.same}</span>
				</p>

				<ul className="vg-rv-group mt-2.5 flex flex-col gap-2 text-start text-[13px] lg:mt-4 lg:flex-row lg:gap-4 lg:text-[14px]">
					<li className="flex grow basis-0 items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white p-3.5 lg:gap-3 lg:rounded-card lg:border-0 lg:bg-vg-bg lg:px-5 lg:py-[18px]">
						<span aria-hidden className="inline-flex size-[18px] shrink-0 text-[#be185d] lg:size-5"><InstagramIcon className="size-full" /></span>
						<span><b className="font-normal lg:font-bold">{c.noteA}</b> <span className="hidden text-vg-cap lg:inline">{c.noteASub}</span></span>
					</li>
					<li className="flex grow basis-0 items-center gap-2.5 rounded-2xl border border-black/[0.06] bg-white p-3.5 lg:gap-3 lg:rounded-card lg:border-0 lg:bg-vg-bg lg:px-5 lg:py-[18px]">
						<Check aria-hidden className="size-[18px] shrink-0 text-vg-ok lg:size-5" strokeWidth={2} />
						<span><b className="font-normal lg:font-bold">{c.noteB}</b> <span className="hidden text-vg-cap lg:inline">{c.noteBSub}</span></span>
					</li>
				</ul>
			</Container>
		</section>
	)
}
