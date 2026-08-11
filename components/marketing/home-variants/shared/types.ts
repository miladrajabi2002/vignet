export type HomeVariant = 1 | 2 | 3 | 4 | 5

export type HomeLocale = 'fa' | 'en'

export type PaidPlanKey = 'STARTER' | 'PRO' | 'BUSINESS'

export type PlanPreview = {
	key: PaidPlanKey
	name: string
	audience: string
	price: string
	maxChannels: string
	includedCredit: string
	featured: boolean
}

export type HomeVariantPageProps = {
	locale: HomeLocale
	plans: PlanPreview[]
}
