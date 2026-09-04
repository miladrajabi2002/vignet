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
					'/settings',
					'/billing',
					'/agents',
					'/conversations',
					'/contacts',
					'/products',
				],
			},
		],
		sitemap: `${base}/sitemap.xml`,
		host: base,
	}
}
