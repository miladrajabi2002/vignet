import dynamicImport from 'next/dynamic'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Hero } from '@/components/marketing/hero'
import { SocialProof } from '@/components/marketing/social-proof'
import { DemoSection } from '@/components/marketing/demo-section'
import { PopularPosts } from '@/components/marketing/popular-posts'
import { SectionRevealController } from '@/components/marketing/section-reveal'
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

export const metadata: Metadata = {
	title: 'ویجنت | ایجنت هوشمند فروش، پشتیبانی و CRM چندکاناله',
	description: 'ویجنت پاسخ‌گویی، فروش، رزرو، CRM و اتوماسیون اینستاگرام را در اینستاگرام، واتساپ، تلگرام، بله، روبیکا و سایت یکپارچه می‌کند.',
	keywords: ['ایجنت هوش مصنوعی فارسی', 'اتوماسیون اینستاگرام', 'چت بات فارسی', 'CRM چندکاناله', 'پاسخگویی خودکار مشتری', 'رزرو هوشمند'],
	alternates: { canonical: SITE_URL },
	openGraph: {
		type: 'website',
		url: SITE_URL,
		title: 'ویجنت | مرکز عملیات هوشمند کسب‌وکار',
		description: 'فروش، پشتیبانی، رزرو، CRM و ارتباط با مشتری در همه کانال‌ها؛ با یک ایجنت فارسی و یک داشبورد.',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'ویجنت | مرکز عملیات هوشمند کسب‌وکار',
		description: 'فروش، پشتیبانی، رزرو و CRM چندکاناله با هوش مصنوعی فارسی.',
	},
}

export default async function HomePage() {
	const [t, platformStats] = await Promise.all([
		getTranslations('marketing.faq'),
		getPublicPlatformStats(),
	])
	const faqItems = (t.raw('items') as { q: string; a: string }[]) ?? []

	// Structured data: Organization + WebSite + SoftwareApplication + FAQPage — helps
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
			'@type': 'WebSite',
			name: 'Vigent',
			alternateName: 'ویجنت',
			url: SITE_URL,
			inLanguage: ['fa-IR', 'en'],
		},
		{
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: 'Vigent',
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web',
			description:
				'پلتفرم ایجنت هوشمند برای کسب‌وکارها — فروش، پشتیبانی و پیگیری سفارش در سایت، تلگرام، واتساپ و اینستاگرام',
			featureList: [
				'پاسخ‌گویی هوشمند فارسی بر پایه دانش کسب‌وکار',
				'صندوق گفتگو و CRM چندکاناله',
				'اتوماسیون دایرکت، کامنت و استوری اینستاگرام',
				'کاتالوگ محصول، ووکامرس و پیشنهاد خرید',
				'رزرو و نوبت‌دهی بدون تداخل',
				'تحویل گفتگو به اپراتور همراه خلاصه',
			],
			offers: {
				'@type': 'Offer',
				price: '0',
				priceCurrency: 'IRR',
				description: 'یک ماه استفاده رایگان همراه اعتبار اولیه پیام؛ اتوماسیون ثابت اینستاگرام رایگان است',
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
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
			/>
			<Hero />
			<SocialProof stats={platformStats} />
			<DemoSection />
			<FeaturesSection />
			<ChannelsSection />
			<VigentoSection />
			<PricingSection />
			<FaqSection />
			<PopularPosts />
		</>
	)
}
