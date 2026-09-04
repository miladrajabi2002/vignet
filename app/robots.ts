import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
	const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir'
	return {
		rules: [
			{
				userAgent: '*',
				// Product images are intentionally public: Meta fetches Generic
				// Template images server-side. Keep this more-specific allow rule
				// ahead of the blanket /api exclusion so Instagram cards retain
				// their media while the rest of the private API stays uncrawlable.
				allow: ['/', '/api/uploads/products/'],
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
