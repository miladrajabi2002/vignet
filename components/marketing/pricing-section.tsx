import type { CSSProperties } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Check, ChevronDown, MessageSquareText } from 'lucide-react'
import { getEffectivePlanDefs, PAID_PLANS, type PaidPlan } from '@/lib/billing/plans'
import { getPlatformCommercialConfig } from '@/lib/platform/commercial-config'
import { estimateRemainingReplies } from '@/lib/billing/credit-estimates'
import { InstagramIcon } from '@/components/marketing/social-links'

const PLAN_TRANSLATION_KEY: Record<PaidPlan, 'starter' | 'pro' | 'business'> = {
        STARTER: 'starter',
        PRO: 'pro',
        BUSINESS: 'business',
}

/** Pricing is server-rendered from the same catalog used by checkout. */
export async function PricingSection() {
        const t = await getTranslations('marketing.pricing')
        const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
        const [defs, commercialConfig] = await Promise.all([
                getEffectivePlanDefs(),
                getPlatformCommercialConfig(),
        ])
        const number = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
	const planViews = PAID_PLANS.map((plan) => {
		const def = defs[plan]
		const key = PLAN_TRANSLATION_KEY[plan]
		const replyPriceIRR = commercialConfig.replyPricesIRR.fast
		const replyPriceToman = replyPriceIRR / 10
		const includedReplies = estimateRemainingReplies(def.includedCreditIRR, replyPriceIRR)
		return {
			plan,
			name: t(`plans.${key}.name`),
			audience: t(`plans.${key}.audience`),
			price: number.format(def.priceIRR / 10),
			features: [
				locale === 'fa' ? `از ${number.format(replyPriceToman)} تومان برای هر پاسخ موفق` : `From ${number.format(replyPriceToman)} toman per successful reply`,
				locale === 'fa'
					? `${number.format(def.includedCreditIRR / 10)} تومان اعتبار هدیه؛ حدود ${number.format(includedReplies)} پاسخ سریع`
					: `${number.format(def.includedCreditIRR / 10)} toman included credit; about ${number.format(includedReplies)} fast replies`,
				t('channelLimit', { count: number.format(def.maxChannels) }),
				locale === 'fa' ? `تا ${number.format(def.maxProducts)} محصول` : `Up to ${number.format(def.maxProducts)} products`,
				locale === 'fa' ? `تا ${number.format(def.maxOrders)} سفارش` : `Up to ${number.format(def.maxOrders)} orders`,
				locale === 'fa' ? `تا ${number.format(def.maxCustomers)} مشتری` : `Up to ${number.format(def.maxCustomers)} customers`,
				t('allChannels'),
				t('unlimitedAgents'),
				locale === 'fa' ? 'هوش مصنوعی آماده و کاملاً مدیریت‌شده' : 'Fully managed AI service',
			],
			value: t(`plans.${key}.value`),
			cta: t('planCta', { plan: t(`plans.${key}.name`) }),
			recommended: plan === 'PRO',
			recommendedLabel: locale === 'fa' ? 'پیشنهاد ما' : 'Recommended',
		}
	})
	const mobilePlans = planViews

        return (
				<section id="pricing" className="marketing-story-section scroll-mt-24 bg-[var(--bg-surface)] py-16 sm:py-20 lg:py-24">
                        <div className="mx-auto max-w-7xl px-5 sm:px-8">
                                <div className="mx-auto max-w-2xl text-center">
                                        <span className="marketing-eyebrow">
                                                {t('eyebrow')}
                                        </span>
                                        <h2 className="marketing-heading mx-auto mt-4">{t('title')}</h2>
                                        <p className="marketing-subtitle mx-auto mt-4">{t('subtitle')}</p>
                                </div>

				<div className="mx-auto mt-9 grid max-w-3xl gap-3 sm:grid-cols-2">
					<div className="spatial-surface flex items-start gap-3 rounded-[1.35rem] p-4">
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black text-white"><InstagramIcon className="h-4 w-4" /></span>
						<div><p className="text-sm font-semibold text-black">{locale === 'fa' ? 'اتوماسیون ثابت اینستاگرام رایگان' : 'Deterministic Instagram automation is free'}</p><p className="mt-1 text-[11px] leading-5 text-black/45">{locale === 'fa' ? 'تا وقتی پاسخ به AI نیاز ندارد، از اعتبار شما چیزی کم نمی‌شود' : 'When a reply does not need AI, no credit is deducted'}</p></div>
					</div>
					<div className="spatial-surface flex items-start gap-3 rounded-[1.35rem] p-4">
						<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-black text-white"><MessageSquareText className="h-4 w-4" /></span>
						<div><p className="text-sm font-semibold text-black">{locale === 'fa' ? 'AI فقط بعد از پاسخ موفق' : 'AI credit only after a successful reply'}</p><p className="mt-1 text-[11px] leading-5 text-black/45">{locale === 'fa' ? 'پاسخ ناموفق هزینه‌ای ندارد و مصرف اعتبار شفاف نمایش داده می‌شود' : 'Failed replies cost nothing and credit usage stays transparent'}</p></div>
					</div>
				</div>

				<div className="mx-auto mt-4 flex max-w-3xl flex-col items-center gap-4 rounded-[1.35rem] bg-black p-5 text-center text-white shadow-[0_20px_55px_rgba(0,0,0,0.13)] sm:flex-row sm:justify-between sm:text-start">
										<div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
								<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black">
								<MessageSquareText className="h-4 w-4" />
                                                </span>
                                                <div>
								<p className="text-sm font-medium text-white">{t('trialTitle')}</p>
								<p className="mt-1 text-xs leading-5 text-white/45">{t('trialNote', { count: number.format(commercialConfig.trialCreditIRR / 10) })}</p>
                                                </div>
                                        </div>
						<Link href="/login?next=/onboarding" className="marketing-pressable inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-black sm:w-auto">
                                                {t('trialCta')}
                                        </Link>
                                </div>

				<div className="mt-10 space-y-3 md:hidden">
					{mobilePlans.map((view, index) => (
						<details
							key={view.plan}
							name="mobile-pricing-plan"
							open={view.recommended}
							data-scroll-reveal="up"
							style={{ '--reveal-order': index } as CSSProperties}
							className={`group rounded-[1.35rem] border bg-white shadow-[var(--shadow-sm)] ${view.recommended ? 'border-black/35 open:border-black' : 'border-[var(--border-default)] open:border-black/15'}`}
						>
							<summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--blue-accent)] [&::-webkit-details-marker]:hidden">
								<MobilePlanHeader view={view} suffix={t('tomanPerMonth')} />
								<span className="grid size-9 shrink-0 place-items-center rounded-full border border-black/10 bg-black/[0.025] transition-transform duration-200 group-open:rotate-180"><ChevronDown className="size-4" aria-hidden /></span>
							</summary>
							<div className="border-t border-[var(--border-subtle)] px-5 pb-5 pt-4"><MobilePlanDetails view={view} /></div>
						</details>
					))}
				</div>

				<div className="mt-10 hidden grid-cols-1 gap-4 md:grid md:grid-cols-3">
                                        {PAID_PLANS.map((plan) => {
                                                const def = defs[plan]
                                                const key = PLAN_TRANSLATION_KEY[plan]
                                                const replyPriceIRR = commercialConfig.replyPricesIRR.fast
                                                const replyPriceToman = replyPriceIRR / 10
                                                const includedReplies = estimateRemainingReplies(def.includedCreditIRR, replyPriceIRR)
						const recommended = plan === 'PRO'
                                                return (
                                                        <article
                                                                key={plan}
										className={`relative flex flex-col rounded-2xl border bg-white p-6 md:p-7 ${recommended ? 'border-black/45 shadow-[0_24px_60px_rgba(0,0,0,0.12)] md:-translate-y-2' : 'border-[var(--border-default)]'}`}
										style={recommended ? undefined : { boxShadow: 'var(--shadow-sm)' }}
                                                        >
										{recommended ? (
											<span className="absolute start-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-black px-3 py-1 text-[10px] font-semibold text-white">
												{locale === 'fa' ? 'پیشنهاد ما' : 'Recommended'}
											</span>
										) : null}
                                                                <h3 className="text-xl font-medium text-[var(--text-primary)]">{t(`plans.${key}.name`)}</h3>
                                                                <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--text-secondary)]">{t(`plans.${key}.audience`)}</p>
                                                                <div className="mt-5 flex items-baseline gap-1.5">
                                                                        <span className="text-3xl font-light tabular-nums text-[var(--text-primary)]">{number.format(def.priceIRR / 10)}</span>
                                                                        <span className="text-xs text-[var(--text-muted)]">{t('tomanPerMonth')}</span>
                                                                </div>
                                                                <ul className="mt-6 flex-1 space-y-3 text-sm text-[var(--text-secondary)]">
                                                                        <Feature>{locale === 'fa' ? `از ${number.format(replyPriceToman)} تومان برای هر پاسخ موفق` : `From ${number.format(replyPriceToman)} toman per successful reply`}</Feature>
                                                                        <Feature>
                                                                                {locale === 'fa'
                                                                                        ? `${number.format(def.includedCreditIRR / 10)} تومان اعتبار هدیه؛ حدود ${number.format(includedReplies)} پاسخ سریع`
                                                                                        : `${number.format(def.includedCreditIRR / 10)} toman included credit; about ${number.format(includedReplies)} fast replies`}
                                                                        </Feature>
                                                                        <Feature>{t('channelLimit', { count: number.format(def.maxChannels) })}</Feature>
                                                                        <Feature>{locale === 'fa' ? `تا ${number.format(def.maxProducts)} محصول` : `Up to ${number.format(def.maxProducts)} products`}</Feature>
                                                                        <Feature>{locale === 'fa' ? `تا ${number.format(def.maxOrders)} سفارش` : `Up to ${number.format(def.maxOrders)} orders`}</Feature>
                                                                        <Feature>{locale === 'fa' ? `تا ${number.format(def.maxCustomers)} مشتری` : `Up to ${number.format(def.maxCustomers)} customers`}</Feature>
                                                                        <Feature>{t('allChannels')}</Feature>
                                                                        <Feature>{t('unlimitedAgents')}</Feature>
                                                                        <Feature>{locale === 'fa' ? 'هوش مصنوعی آماده و کاملاً مدیریت‌شده' : 'Fully managed AI service'}</Feature>
                                                                </ul>
                                                                <p className="mt-6 border-t border-[var(--border-subtle)] pt-4 text-xs leading-5 text-[var(--text-muted)]">{t(`plans.${key}.value`)}</p>
                                                                <Link
                                                                        href={`/login?plan=${plan}`}
										className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border text-sm font-medium transition-colors ${recommended ? 'border-black bg-black text-white hover:bg-black/85' : 'border-[var(--border-hover)] text-[var(--text-primary)] hover:border-[var(--border-strong)]'}`}
                                                                >
                                                                        {t('planCta', { plan: t(`plans.${key}.name`) })}
                                                                </Link>
                                                        </article>
                                                )
                                        })}
                                </div>

                                <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-6 text-[var(--text-muted)]">{t('billingNote')}</p>
                        </div>
                </section>
        )
}

type MobilePlanView = {
	plan: PaidPlan
	name: string
	audience: string
	price: string
	features: string[]
	value: string
	cta: string
	recommended: boolean
	recommendedLabel: string
}

function MobilePlanHeader({ view, suffix }: { view: MobilePlanView; suffix: string }) {
	return (
		<div className="min-w-0 text-start">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="text-lg font-semibold text-[var(--text-primary)]">{view.name}</h3>
				{view.recommended ? <span className="rounded-full bg-black px-2.5 py-1 text-[9px] font-semibold text-white">{view.recommendedLabel}</span> : null}
			</div>
			<p className="mt-1 line-clamp-1 text-xs leading-5 text-[var(--text-secondary)]">{view.audience}</p>
			<div className="mt-2 flex flex-wrap items-baseline gap-1.5">
				<span className="text-2xl font-light tabular-nums text-[var(--text-primary)]">{view.price}</span>
				<span className="text-xs text-[var(--text-muted)]">{suffix}</span>
			</div>
		</div>
	)
}

function MobilePlanDetails({ view }: { view: MobilePlanView }) {
	return (
		<>
			<ul className="space-y-3 text-xs leading-5 text-[var(--text-secondary)]">
				{view.features.map((feature) => <Feature key={feature}>{feature}</Feature>)}
			</ul>
			<p className="mt-5 border-t border-[var(--border-subtle)] pt-4 text-xs leading-5 text-[var(--text-muted)]">{view.value}</p>
			<Link href={`/login?plan=${view.plan}`} className="marketing-pressable mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-black text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-accent)] focus-visible:ring-offset-2">
				{view.cta}
			</Link>
		</>
	)
}

function Feature({ children }: { children: React.ReactNode }) {
        return (
                <li className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{children}</span>
                </li>
        )
}
