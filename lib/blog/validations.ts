import { z } from 'zod'

export const blogPostSchema = z.object({
	title: z.string().min(3).max(200),
	slug: z
		.string()
		.min(3)
		.max(80)
		.regex(/^[\u0600-\u06FFa-z0-9-]+$/, 'invalid slug'),
	excerpt: z.string().max(500).nullish(),
	content: z.string().min(1).max(200_000),
	coverImage: z.string().url().nullish().or(z.literal('')),
	categoryId: z.string().nullish(),
	status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).default('DRAFT'),
	seoTitle: z.string().max(80).nullish(),
	seoDescription: z.string().max(200).nullish(),
	seoKeywords: z.array(z.string().max(60)).max(20).default([]),
	canonicalUrl: z.string().url().nullish().or(z.literal('')),
	ogImage: z.string().url().nullish().or(z.literal('')),
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
