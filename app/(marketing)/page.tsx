import dynamicImport from 'next/dynamic'
import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getLocale, getTranslations } from 'next-intl/server'
import { Hero } from '@/components/marketing/hero'
import { SocialProof } from '@/components/marketing/social-proof'
import { PopularPosts } from '@/components/marketing/popular-posts'
import { SectionRevealController } from '@/components/marketing/section-reveal'
import { CapabilitiesSection } from '@/components/marketing/capabilities-section'
import { InstagramAutomationSection } from '@/components/marketing/instagram-automation-section'
import { HomeOnboarding } from '@/components/marketing/home-onboarding'
import { getPublicPlatformStats } from '@/lib/marketing/platform-stats'
import { jsonLdScript } from '@/lib/seo/json-ld'

// Below-the-fold sections are split from the initial route bundle. Their
// meaningful media also stays lazy, while server rendering keeps the content
// available to search engines and no client hydration is added unnecessarily.
const ChannelsSection = dynamicImport(() =>
	import('@/components/marketing/channels-section').then((m) => m.ChannelsSection),
)
const PricingSection = dynamicImport(() =>
	import('@/components/marketing/pricing-section').then((m) => m.PricingSection),
)
const FaqSection = dynamicImport(() =>
	import('@/components/marketing/faq-section').then((m) => m.FaqSection),
)
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/+$/, '')

const HOME_METADATA_COPY = {
	fa: {
		title: 'ویجنت | ایجنت هوشمند فروش، پشتیبانی و CRM چندکاناله',
		description: 'ویجنت پاسخ‌گویی، فروش، رزرو، CRM و اتوماسیون اینستاگرام را در اینستاگرام، تلگرام، بله، روبیکا و سایت یکپارچه می‌کند.',
		keywords: ['ایجنت هوش مصنوعی فارسی', 'پشتیبانی هوشمند مشتری', 'اتوماسیون اینستاگرام', 'چت‌بات فارسی', 'CRM چندکاناله', 'دستیار فروش هوشمند'],
		openGraphTitle: 'ویجنت | مرکز عملیات هوشمند کسب‌وکار',
		openGraphDescription: 'فروش، پشتیبانی، رزرو، CRM و ارتباط با مشتری در همه کانال‌ها؛ با یک ایجنت فارسی و یک داشبورد.',
		twitterDescription: 'فروش، پشتیبانی، رزرو و CRM چندکاناله با هوش مصنوعی فارسی.',
	},
	en: {
		title: 'Vigent | AI Sales, Support and Omnichannel CRM',
		description: 'Vigent unifies AI customer support, sales, booking, CRM and Instagram automation across Instagram, Telegram, Bale, Rubika and your website.',
		keywords: ['AI sales agent', 'AI customer support', 'Instagram automation', 'omnichannel CRM', 'Persian AI chatbot', 'AI booking assistant'],
		openGraphTitle: 'Vigent | Intelligent Business Operations',
		openGraphDescription: 'Run sales, support, booking, CRM and customer conversations across every channel with one AI agent and one dashboard.',
		twitterDescription: 'AI-powered sales, support, booking and omnichannel CRM in one workspace.',
	},
} as const

export async function generateMetadata(): Promise<Metadata> {
	const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
	const copy = HOME_METADATA_COPY[locale]

	return {
		title: { absolute: copy.title },
		description: copy.description,
		keywords: [...copy.keywords],
		applicationName: 'Vigent',
		category: 'business software',
		alternates: { canonical: SITE_URL },
		openGraph: {
			type: 'website',
			url: SITE_URL,
			siteName: 'Vigent',
			locale: locale === 'fa' ? 'fa_IR' : 'en_US',
			alternateLocale: locale === 'fa' ? ['en_US'] : ['fa_IR'],
			title: copy.openGraphTitle,
			description: copy.openGraphDescription,
			images: [{
				url: `${SITE_URL}/android-chrome-512x512.png`,
				width: 512,
				height: 512,
				alt: locale === 'fa' ? 'نشان ویجنت' : 'Vigent logo',
			}],
		},
		twitter: {
			card: 'summary',
			title: copy.openGraphTitle,
			description: copy.twitterDescription,
			images: [`${SITE_URL}/android-chrome-512x512.png`],
		},
		other: {
			'content-language': locale === 'fa' ? 'fa-IR' : 'en-US',
		},
	}
}

const STRUCTURED_DATA_COPY = {
	fa: {
		alternateName: 'ویجنت',
		description: 'پلتفرم ایجنت هوشمند برای کسب‌وکارها — فروش، پشتیبانی و پیگیری سفارش در سایت، تلگرام، بله و اینستاگرام',
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
		description: 'An AI agent platform for business sales, customer support and order follow-up across websites, Telegram, Bale and Instagram.',
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
			'@id': `${SITE_URL}/#organization`,
			name: 'Vigent',
			alternateName: structuredDataCopy.alternateName,
			url: SITE_URL,
			logo: `${SITE_URL}/android-chrome-512x512.png`,
			telephone: '+989128352271',
			contactPoint: {
				'@type': 'ContactPoint',
				telephone: '+989128352271',
				contactType: 'customer support',
				availableLanguage: ['fa', 'en'],
			},
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			'@id': `${SITE_URL}/#website`,
			name: 'Vigent',
			alternateName: structuredDataCopy.alternateName,
			url: SITE_URL,
			inLanguage: locale === 'fa' ? 'fa-IR' : 'en',
			publisher: { '@id': `${SITE_URL}/#organization` },
		},
		{
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			'@id': `${SITE_URL}/#software`,
			name: 'Vigent',
			url: SITE_URL,
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web',
			inLanguage: locale === 'fa' ? 'fa-IR' : 'en-US',
			provider: { '@id': `${SITE_URL}/#organization` },
			description: structuredDataCopy.description,
			featureList: structuredDataCopy.features,
			offers: {
				'@type': 'Offer',
				price: '0',
				priceCurrency: 'IRR',
				url: `${SITE_URL}/login?next=/onboarding`,
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
		<>
			<SectionRevealController />
			<script
				type="application/ld+json"
				dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
			/>
			<Hero />
			<Suspense fallback={null}>
				<LivePlatformStats />
			</Suspense>
			<CapabilitiesSection locale={locale} />
			<ChannelsSection locale={locale} />
			<InstagramAutomationSection locale={locale} />
			<HomeOnboarding locale={locale} />
			<Suspense fallback={null}>
				<PricingSection />
			</Suspense>
			<FaqSection />
			<Suspense fallback={null}>
				<PopularPosts />
			</Suspense>
		</>
	)
}
