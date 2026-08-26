import 'server-only'

import { getLocale, getTranslations } from 'next-intl/server'
import { getEffectivePlanDefs, getEffectivePlanReplyPricesIRR, PAID_PLANS, type PaidPlan } from '@/lib/billing/plans'
import type { HomeLocale, HomeVariantPageProps } from './types'

const PLAN_KEY: Record<PaidPlan, 'starter' | 'pro' | 'business'> = {
	STARTER: 'starter',
	PRO: 'pro',
	BUSINESS: 'business',
}

export async function getHomeVariantProps(): Promise<HomeVariantPageProps> {
	const [requestLocale, t, definitions] = await Promise.all([
		getLocale(),
		getTranslations('marketing.pricing'),
		getEffectivePlanDefs(),
	])
	const locale: HomeLocale = requestLocale === 'en' ? 'en' : 'fa'
	const number = new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US')
	const replyPrices = await getEffectivePlanReplyPricesIRR('STARTER')
	const fastReplyIRR = replyPrices.fast ?? 3_000

	return {
		locale,
		plans: PAID_PLANS.map((key) => {
			const definition = definitions[key]
			const translationKey = PLAN_KEY[key]
			const planReplyIRR = Math.round(
				fastReplyIRR * (1 - definition.replyDiscountBps / 10_000),
			)
			return {
				key,
				name: t(`plans.${translationKey}.name`),
				audience: t(`plans.${translationKey}.audience`),
				price: number.format(definition.priceIRR / 10),
				maxChannels: number.format(definition.maxChannels),
				includedCredit: number.format(definition.includedCreditIRR / 10),
				replyPrice: number.format(planReplyIRR / 10),
				featured: key === 'PRO',
			}
		}),
	}
}
