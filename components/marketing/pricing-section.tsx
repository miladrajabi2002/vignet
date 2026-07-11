import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { Check, MessageSquareText } from 'lucide-react'
import { getPlanDefs, PAID_PLANS, type PaidPlan } from '@/lib/billing/plans'
import { getReplyPriceIRR } from '@/lib/ai/models'
import { cn } from '@/lib/utils'

const PLAN_TRANSLATION_KEY: Record<PaidPlan, 'starter' | 'pro' | 'business'> = {
	STARTER: 'starter',
	PRO: 'pro',
	BUSINESS: 'business',
}

/** Pricing is server-rendered from the same catalog used by checkout. */
export async function PricingSection() {
	const t = await getTranslations('marketing.pricing')
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const defs = getPlanDefs()
	const number = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')

	return (
		<section id="pricing" className="marketing-story-section bg-[#f5f6f3] py-16 sm:py-20 lg:py-24">
			<div className="mx-auto max-w-7xl px-5 sm:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<span className="marketing-eyebrow">
						{t('eyebrow')}
					</span>
					<h2 className="marketing-heading mx-auto mt-4">{t('title')}</h2>
					<p className="marketing-subtitle mx-auto mt-4">{t('subtitle')}</p>
				</div>

				<div className="mx-auto mt-10 flex max-w-3xl flex-col items-start gap-4 border-y border-[var(--border-default)] py-5 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-3">
						<span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]">
							<MessageSquareText className="h-4 w-4 text-[var(--text-secondary)]" />
						</span>
						<div>
							<p className="text-sm font-medium text-[var(--text-primary)]">{t('trialTitle')}</p>
							<p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{t('trialNote', { count: number.format(Number(process.env.AI_TRIAL_CREDIT_IRR ?? 100000) / 10) })}</p>
						</div>
					</div>
					<Link href="/login?next=/onboarding" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-hover)] px-5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)]">
						{t('trialCta')}
					</Link>
				</div>

				<div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
					{PAID_PLANS.map((plan) => {
						const def = defs[plan]
						const key = PLAN_TRANSLATION_KEY[plan]
						const featured = plan === 'PRO'
						const replyPriceToman = Math.ceil((getReplyPriceIRR('fast') * (10_000 - def.replyDiscountBps)) / 10_000 / 10)
						return (
							<article
								key={plan}
								className={cn(
									'relative flex flex-col rounded-2xl border p-6 md:p-7',
									featured
										? 'border-black/25 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.08)]'
										: 'border-black/10 bg-white',
								)}
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

function Feature({ children }: { children: React.ReactNode }) {
	return (
		<li className="flex items-start gap-2.5">
			<Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
			<span>{children}</span>
		</li>
	)
}
