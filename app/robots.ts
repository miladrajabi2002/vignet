import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
	const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'
	return {
		rules: [
			{
				userAgent: '*',
				allow: '/',
				disallow: [
					'/admin',
					'/api',
					'/onboarding',
					'/settings',
					'/billing',
					'/agents',
					'/conversations',
					'/contacts',
					'/products',
					'/blog/new',
					'/blog/*/edit',
				],
			},
		],
		sitemap: `${base}/sitemap.xml`,
		host: base,
	}
}
