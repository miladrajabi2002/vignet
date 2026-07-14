import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Check, ChevronDown, MessageSquareText } from 'lucide-react'
import { getEffectivePlanDefs, PAID_PLANS, type PaidPlan } from '@/lib/billing/plans'
import { getPlatformCommercialConfig } from '@/lib/platform/commercial-config'
import { discountedReplyPriceIRR, estimateRemainingReplies } from '@/lib/billing/credit-estimates'
import { cn } from '@/lib/utils'
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
		const replyPriceIRR = discountedReplyPriceIRR(commercialConfig.replyPricesIRR.fast, def.replyDiscountBps)
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
				t('agents', { count: number.format(def.maxAgents) }),
				t('allChannels'),
				locale === 'fa' ? 'هوش مصنوعی آماده و کاملاً مدیریت‌شده' : 'Fully managed AI service',
			],
			value: t(`plans.${key}.value`),
			cta: t('planCta', { plan: t(`plans.${key}.name`) }),
		}
	})
	const mobilePlans = [...planViews].sort((a, b) => (a.plan === 'PRO' ? -1 : b.plan === 'PRO' ? 1 : 0))

        return (
                <section id="pricing" className="marketing-story-section bg-[var(--bg-surface)] py-16 sm:py-20 lg:py-24">
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

				<div className="mx-auto mt-4 flex max-w-3xl flex-col items-start gap-4 rounded-[1.35rem] bg-black p-5 text-white shadow-[0_20px_55px_rgba(0,0,0,0.13)] sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-start gap-3">
								<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black">
								<MessageSquareText className="h-4 w-4" />
                                                </span>
                                                <div>
								<p className="text-sm font-medium text-white">{t('trialTitle')}</p>
								<p className="mt-1 text-xs leading-5 text-white/45">{t('trialNote', { count: number.format(commercialConfig.trialCreditIRR / 10) })}</p>
                                                </div>
                                        </div>
						<Link href="/login?next=/onboarding" className="marketing-pressable inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-black">
                                                {t('trialCta')}
                                        </Link>
                                </div>

				<div className="mt-10 space-y-3 md:hidden">
					{mobilePlans.map((view) => view.plan === 'PRO' ? (
						<article key={view.plan} className="relative rounded-[1.35rem] border border-black/20 bg-white p-5 shadow-[var(--shadow-card)]">
							<span className="absolute -top-3 start-5 rounded-full bg-black px-3 py-1 text-[10px] font-semibold text-white">{t('popular')}</span>
							<MobilePlanHeader view={view} suffix={t('tomanPerMonth')} />
							<MobilePlanDetails view={view} />
						</article>
					) : (
						<details key={view.plan} className="group rounded-[1.35rem] border border-[var(--border-default)] bg-white open:shadow-[var(--shadow-sm)]">
							<summary className="flex min-h-[76px] cursor-pointer list-none items-center gap-3 px-5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black [&::-webkit-details-marker]:hidden">
								<div className="min-w-0 flex-1">
									<p className="font-semibold text-[var(--text-primary)]">{view.name}</p>
									<p className="mt-1 truncate text-[11px] text-[var(--text-muted)]">{view.audience}</p>
								</div>
								<p className="shrink-0 text-sm font-medium tabular-nums text-[var(--text-primary)]">{view.price} <span className="text-[10px] font-normal text-[var(--text-muted)]">{t('tomanPerMonth')}</span></p>
								<ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" />
							</summary>
							<div className="border-t border-[var(--border-subtle)] px-5 pb-5 pt-4"><MobilePlanDetails view={view} /></div>
						</details>
					))}
				</div>

				<div className="mt-10 hidden grid-cols-1 gap-4 md:grid md:grid-cols-3">
                                        {PAID_PLANS.map((plan) => {
                                                const def = defs[plan]
                                                const key = PLAN_TRANSLATION_KEY[plan]
                                                const featured = plan === 'PRO'
                                                const replyPriceIRR = discountedReplyPriceIRR(commercialConfig.replyPricesIRR.fast, def.replyDiscountBps)
                                                const replyPriceToman = replyPriceIRR / 10
                                                const includedReplies = estimateRemainingReplies(def.includedCreditIRR, replyPriceIRR)
                                                return (
                                                        <article
                                                                key={plan}
                                                                className={cn(
                                                                        'relative flex flex-col rounded-2xl border p-6 md:p-7',
                                                                        featured
                                                                                ? 'border-[var(--border-hover)] bg-white'
                                                                                : 'border-[var(--border-default)] bg-white',
                                                                )}
                                                                style={{ boxShadow: featured ? 'var(--shadow-card)' : 'var(--shadow-sm)' }}
                                                        >
                                                                {featured && (
                                                                        <span className="absolute -top-3 start-6 rounded-full bg-[var(--white)] px-3 py-1 text-[11px] font-medium text-[var(--bg-base)]">{t('popular')}</span>
                                                                )}
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
                                                                        <Feature>{t('agents', { count: number.format(def.maxAgents) })}</Feature>
                                                                        <Feature>{t('allChannels')}</Feature>
                                                                        <Feature>{locale === 'fa' ? 'هوش مصنوعی آماده و کاملاً مدیریت‌شده' : 'Fully managed AI service'}</Feature>
                                                                </ul>
                                                                <p className="mt-6 border-t border-[var(--border-subtle)] pt-4 text-xs leading-5 text-[var(--text-muted)]">{t(`plans.${key}.value`)}</p>
                                                                <Link
                                                                        href={`/login?plan=${plan}`}
                                                                        className={cn(
                                                                                'mt-5 inline-flex min-h-11 items-center justify-center rounded-xl text-sm font-medium transition-colors',
                                                                                featured
                                                                                        ? 'bg-[var(--white)] text-[var(--bg-base)]'
                                                                                        : 'border border-[var(--border-hover)] text-[var(--text-primary)] hover:border-[var(--border-strong)]',
                                                                        )}
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
}

function MobilePlanHeader({ view, suffix }: { view: MobilePlanView; suffix: string }) {
	return (
		<>
			<h3 className="text-xl font-semibold text-[var(--text-primary)]">{view.name}</h3>
			<p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{view.audience}</p>
			<div className="mt-4 flex items-baseline gap-1.5">
				<span className="text-3xl font-light tabular-nums text-[var(--text-primary)]">{view.price}</span>
				<span className="text-xs text-[var(--text-muted)]">{suffix}</span>
			</div>
		</>
	)
}

function MobilePlanDetails({ view }: { view: MobilePlanView }) {
	return (
		<>
			<ul className="space-y-3 text-xs leading-5 text-[var(--text-secondary)]">
				{view.features.map((feature) => <Feature key={feature}>{feature}</Feature>)}
			</ul>
			<p className="mt-5 border-t border-[var(--border-subtle)] pt-4 text-xs leading-5 text-[var(--text-muted)]">{view.value}</p>
			<Link href={`/login?plan=${view.plan}`} className={`mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium ${view.plan === 'PRO' ? 'bg-black text-white' : 'border border-[var(--border-hover)] text-[var(--text-primary)]'}`}>
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
