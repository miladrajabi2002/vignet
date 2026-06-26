import { z } from 'zod'

export const productCreateSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  price: z.number().nonnegative().nullable().optional(),
  comparePrice: z.number().nonnegative().nullable().optional(),
  sku: z.string().max(80).optional(),
  stock: z.number().int().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  images: z.array(z.string().url()).max(10).optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  active: z.boolean().optional(),
})

export const productUpdateSchema = productCreateSchema.partial()

export const categoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export const categoryUpdateSchema = categoryCreateSchema.partial()

export type ProductCreateInput = z.infer<typeof productCreateSchema>
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>

/** Generate a URL-safe slug from a category name (supports Persian). */
export function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\p{L}\p{N}-]/gu, '')
      .slice(0, 60) || `c-${Date.now().toString(36)}`
  )
}
