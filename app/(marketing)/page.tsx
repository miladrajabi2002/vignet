import dynamicImport from 'next/dynamic'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getLocale, getTranslations } from 'next-intl/server'
import { Hero } from '@/components/marketing/hero'
import { SocialProof } from '@/components/marketing/social-proof'
import { DemoSection } from '@/components/marketing/demo-section'
import { PopularPosts } from '@/components/marketing/popular-posts'
import { SectionRevealController } from '@/components/marketing/section-reveal'
import { MarketingMotionProvider } from '@/components/marketing/motion-provider'
import { getPublicPlatformStats } from '@/lib/marketing/platform-stats'

// Below-the-fold sections are code-split so the first paint stays focused on
// the hero; each product section's JS loads independently.
// They still render on the server (SSR default), so SEO is unaffected.
const FeaturesSection = dynamicImport(() =>
	import('@/components/marketing/features-section').then((m) => m.FeaturesSection),
)
const ChannelsSection = dynamicImport(() =>
	import('@/components/marketing/channels-section').then((m) => m.ChannelsSection),
)
const VigentoSection = dynamicImport(() =>
	import('@/components/marketing/vigento-section').then((m) => m.VigentoSection),
)
const PricingSection = dynamicImport(() =>
	import('@/components/marketing/pricing-section').then((m) => m.PricingSection),
)
const FaqSection = dynamicImport(() =>
	import('@/components/marketing/faq-section').then((m) => m.FaqSection),
)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'

const HOME_METADATA_COPY = {
	fa: {
		title: 'ویجنت | ایجنت هوشمند فروش، پشتیبانی و CRM چندکاناله',
		description: 'ویجنت پاسخ‌گویی، فروش، رزرو، CRM و اتوماسیون اینستاگرام را در اینستاگرام، واتساپ، تلگرام، بله، روبیکا و سایت یکپارچه می‌کند.',
		keywords: ['ایجنت هوش مصنوعی فارسی', 'اتوماسیون اینستاگرام', 'چت بات فارسی', 'CRM چندکاناله', 'پاسخگویی خودکار مشتری', 'رزرو هوشمند'],
		openGraphTitle: 'ویجنت | مرکز عملیات هوشمند کسب‌وکار',
		openGraphDescription: 'فروش، پشتیبانی، رزرو، CRM و ارتباط با مشتری در همه کانال‌ها؛ با یک ایجنت فارسی و یک داشبورد.',
		twitterDescription: 'فروش، پشتیبانی، رزرو و CRM چندکاناله با هوش مصنوعی فارسی.',
	},
	en: {
		title: 'Vigent | AI Sales, Support and Omnichannel CRM',
		description: 'Vigent unifies AI customer support, sales, booking, CRM and Instagram automation across Instagram, WhatsApp, Telegram, Bale, Rubika and your website.',
		keywords: ['AI sales agent', 'AI customer support', 'Instagram automation', 'omnichannel CRM', 'AI chatbot', 'booking automation'],
		openGraphTitle: 'Vigent | Intelligent Business Operations',
		openGraphDescription: 'Run sales, support, booking, CRM and customer conversations across every channel with one AI agent and one dashboard.',
		twitterDescription: 'AI-powered sales, support, booking and omnichannel CRM in one workspace.',
	},
} as const

export async function generateMetadata(): Promise<Metadata> {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = HOME_METADATA_COPY[locale]

	return {
		title: copy.title,
		description: copy.description,
		keywords: [...copy.keywords],
		alternates: { canonical: SITE_URL },
		openGraph: {
			type: 'website',
			url: SITE_URL,
			title: copy.openGraphTitle,
			description: copy.openGraphDescription,
		},
		twitter: {
			card: 'summary_large_image',
			title: copy.openGraphTitle,
			description: copy.twitterDescription,
		},
	}
}

const STRUCTURED_DATA_COPY = {
	fa: {
		alternateName: 'ویجنت',
		description: 'پلتفرم ایجنت هوشمند برای کسب‌وکارها — فروش، پشتیبانی و پیگیری سفارش در سایت، تلگرام، واتساپ و اینستاگرام',
		features: [
			'پاسخ‌گویی هوشمند فارسی بر پایه دانش کسب‌وکار',
			'صندوق گفتگو و CRM چندکاناله',
			'اتوماسیون دایرکت، کامنت و استوری اینستاگرام',
			'کاتالوگ محصول، ووکامرس و پیشنهاد خرید',
			'رزرو و نوبت‌دهی بدون تداخل',
			'تحویل گفتگو به اپراتور همراه خلاصه',
		],
		offer: 'یک ماه استفاده رایگان همراه اعتبار اولیه پیام؛ اتوماسیون ثابت اینستاگرام رایگان است',
	},
	en: {
		alternateName: 'Vigent AI',
		description: 'An AI agent platform for business sales, customer support and order follow-up across websites, Telegram, WhatsApp and Instagram.',
		features: [
			'Knowledge-grounded AI customer support',
			'Omnichannel inbox and CRM',
			'Instagram direct-message, comment and story automation',
			'Product catalog, WooCommerce and purchase recommendations',
			'Conflict-free booking and appointment scheduling',
			'Human handoff with an automatic conversation summary',
		],
		offer: 'One month free with initial AI reply credit; deterministic Instagram automation remains free.',
	},
} as const

async function LivePlatformStats() {
	const stats = await getPublicPlatformStats()
	return <SocialProof stats={stats} />
}

export default async function HomePage() {
	const [requestLocale, t] = await Promise.all([
		getLocale(),
		getTranslations('marketing.faq'),
	])
	const locale = requestLocale === 'en' ? 'en' : 'fa'
	const structuredDataCopy = STRUCTURED_DATA_COPY[locale]
	const faqItems = (t.raw('items') as { q: string; a: string }[]) ?? []

	// Structured data: Organization + WebSite + SoftwareApplication + FAQPage — helps
	// Google show the brand card, product info and FAQ rich results.
	const jsonLd = [
		{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: 'Vigent',
			alternateName: structuredDataCopy.alternateName,
			url: SITE_URL,
			logo: `${SITE_URL}/icon.png`,
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'Vigent',
			alternateName: structuredDataCopy.alternateName,
			url: SITE_URL,
			inLanguage: locale === 'fa' ? 'fa-IR' : 'en',
		},
		{
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: 'Vigent',
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web',
			description: structuredDataCopy.description,
			featureList: structuredDataCopy.features,
			offers: {
				'@type': 'Offer',
				price: '0',
				priceCurrency: 'IRR',
				description: structuredDataCopy.offer,
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
		<MarketingMotionProvider>
			<SectionRevealController />
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<Hero />
			<Suspense fallback={null}>
				<LivePlatformStats />
			</Suspense>
			<DemoSection />
			<FeaturesSection />
			<ChannelsSection />
			<VigentoSection />
			<Suspense fallback={null}>
				<PricingSection />
			</Suspense>
			<FaqSection />
			<Suspense fallback={null}>
				<PopularPosts />
			</Suspense>
		</MarketingMotionProvider>
	)
}
