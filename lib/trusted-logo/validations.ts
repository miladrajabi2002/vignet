import { z } from 'zod'

/**
 * Trusted-by logos are public marketing content rendered on the homepage —
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

export const trustedLogoSchema = z.object({
	// Brand display name (also used as alt text and text fallback)
	name: z.string().trim().min(2).max(60),
	// Uploaded logo image — /api/uploads/trusted-logo/
	imageUrl: imageRefine.nullish().or(z.literal('')),
	// Optional link to the customer's site
	url: z.string().trim().url().nullish().or(z.literal('')),
	active: z.boolean().default(true),
	sortOrder: z.number().int().min(0).max(9999).default(0),
})

export type TrustedLogoInput = z.infer<typeof trustedLogoSchema>
