import { z } from 'zod'

/**
 * Showcase entries are public marketing content rendered on the homepage —
 * every field is validated defensively before it reaches the page.
 */

const imageRefine = z.string().refine(
	(v) => {
		if (!v) return false
		try {
			new URL(v)
			return true
		} catch {
			return v.startsWith('/')
		}
	},
	{ message: 'invalid image' },
)

export const SHOWCASE_CHANNELS = [
	'INSTAGRAM',
	'TELEGRAM',
	'BALE',
	'RUBIKA',
	'WEB',
	'WOOCOMMERCE',
] as const

export const showcaseEntrySchema = z.object({
	name: z.string().trim().min(2).max(80),
	// Instagram username without @ — letters, digits, dots and underscores.
	handle: z
		.string()
		.trim()
		.regex(/^@?[A-Za-z0-9._]{2,30}$/, 'invalid handle')
		.nullish()
		.or(z.literal('')),
	url: z.string().trim().url().nullish().or(z.literal('')),
	imageUrl: imageRefine.nullish().or(z.literal('')),
	channels: z.array(z.enum(SHOWCASE_CHANNELS)).max(6).default([]),
	quote: z.string().trim().max(200).nullish().or(z.literal('')),
	metricValue: z.string().trim().max(20).nullish().or(z.literal('')),
	metricLabel: z.string().trim().max(40).nullish().or(z.literal('')),
	featured: z.boolean().default(false),
	active: z.boolean().default(true),
	sortOrder: z.number().int().min(0).max(10_000).default(0),
})

export type ShowcaseEntryInput = z.infer<typeof showcaseEntrySchema>
