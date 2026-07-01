import { z } from 'zod'

/**
 * اعتبارسنجی عکس: هم URL مطلق (https://example.com/img.png)
 * و هم مسیر نسبی آپلودشده داخل سایت (/uploads/blog/xxx.png) رو قبول می‌کند.
 *
 * دلیل: endpoint آپلود یک مسیر نسبی برمی‌گرداند تا عکس‌ها روی هر دامنه‌ای
 * کار کنند، ولی z.string().url() مسیرهای نسبی را رد می‌کند.
 */
const imageRefine = z.string().refine(
	(v) => {
		if (!v) return false
		try {
			// URL مطلق؟
			new URL(v)
			return true
		} catch {
			// مسیر نسبی که با / شروع می‌شود (فایل آپلودشده داخل سایت)
			return v.startsWith('/')
		}
	},
	{ message: 'invalid image' },
)

export const blogPostSchema = z.object({
	title: z.string().min(3).max(200),
	slug: z
		.string()
		.min(3)
		.max(80)
		.regex(/^[\u0600-\u06FFa-z0-9-]+$/, 'invalid slug'),
	excerpt: z.string().max(500).nullish(),
	content: z.string().min(1).max(200_000),
	coverImage: imageRefine.nullish().or(z.literal('')),
	categoryId: z.string().nullish(),
	status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).default('DRAFT'),
	seoTitle: z.string().max(80).nullish(),
	seoDescription: z.string().max(200).nullish(),
	seoKeywords: z.array(z.string().max(60)).max(20).default([]),
	canonicalUrl: z.string().url().nullish().or(z.literal('')),
	ogImage: imageRefine.nullish().or(z.literal('')),
	featured: z.boolean().default(false),
	publishedAt: z.string().datetime().nullish(),
})

export type BlogPostInput = z.infer<typeof blogPostSchema>

export const blogCategorySchema = z.object({
	name: z.string().min(2).max(80),
	slug: z
		.string()
		.min(3)
		.max(80)
		.regex(/^[\u0600-\u06FFa-z0-9-]+$/, 'invalid slug'),
	description: z.string().max(500).nullish(),
})

export type BlogCategoryInput = z.infer<typeof blogCategorySchema>
