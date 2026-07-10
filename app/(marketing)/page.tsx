import dynamicImport from 'next/dynamic'
import { getTranslations } from 'next-intl/server'
import { Hero } from '@/components/marketing/hero'
import { SocialProof } from '@/components/marketing/social-proof'
import { LazyDemoSection } from '@/components/marketing/lazy-demo-section'
import { UseCasesSection } from '@/components/marketing/use-cases-section'
import { PopularPosts } from '@/components/marketing/popular-posts'

// Below-the-fold sections are code-split so the first paint stays focused on
// the hero; each product section's JS loads independently.
// They still render on the server (SSR default), so SEO is unaffected.
const FeaturesSection = dynamicImport(() =>
	import('@/components/marketing/features-section').then((m) => m.FeaturesSection),
)
const ChannelsSection = dynamicImport(() =>
	import('@/components/marketing/channels-section').then((m) => m.ChannelsSection),
)
const HowItWorks = dynamicImport(() =>
	import('@/components/marketing/how-it-works').then((m) => m.HowItWorks),
)
const PricingSection = dynamicImport(() =>
	import('@/components/marketing/pricing-section').then((m) => m.PricingSection),
)
const FaqSection = dynamicImport(() =>
	import('@/components/marketing/faq-section').then((m) => m.FaqSection),
)
const CtaSection = dynamicImport(() =>
	import('@/components/marketing/cta-section').then((m) => m.CtaSection),
)

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'

export default async function HomePage() {
	const t = await getTranslations('marketing.faq')
	const faqItems = (t.raw('items') as { q: string; a: string }[]) ?? []

	// Structured data: Organization + SoftwareApplication + FAQPage — helps
	// Google show the brand card, product info and FAQ rich results.
	const jsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: 'Vigent',
			alternateName: 'ویجنت',
			url: SITE_URL,
			logo: `${SITE_URL}/icon.png`,
		},
		{
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: 'Vigent',
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web',
			description:
				'پلتفرم ایجنت هوشمند برای کسب‌وکارها — فروش، پشتیبانی و پیگیری سفارش در سایت، تلگرام، واتساپ و اینستاگرام',
			offers: {
				'@type': 'Offer',
				price: '0',
				priceCurrency: 'IRR',
				description: '۱۴ روز آزمایش رایگان',
			},
		},
		...(faqItems.length
			? [
					{
						'@context': 'https://schema.org',
						'@type': 'FAQPage',
						mainEntity: faqItems.map((item) => ({
							'@type': 'Question',
							name: item.q,
							acceptedAnswer: { '@type': 'Answer', text: item.a },
						})),
					},
				]
			: []),
	]

	return (
		<>
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<Hero />
			<SocialProof />
			<ChannelsSection />
			<LazyDemoSection />
			<UseCasesSection />
			<FeaturesSection />
			<HowItWorks />
			<PricingSection />
			<FaqSection />
			<PopularPosts />
			<CtaSection />
		</>
	)
}
