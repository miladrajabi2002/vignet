import { prisma } from '@/lib/prisma'
import type { ShowcaseProduct } from '@/components/products/product-showcase'

const SHOWCASE_SIZE = 6

/** The agent's most asked-about products that have a photo, for the intro state. */
export async function loadChatLinkShowcase(agentId: string): Promise<ShowcaseProduct[]> {
	const products = await prisma.product.findMany({
		where: { active: true, images: { isEmpty: false }, catalogItems: { some: { agentId } } },
		orderBy: [{ queryCount: 'desc' }, { updatedAt: 'desc' }],
		take: SHOWCASE_SIZE,
		select: { id: true, name: true, price: true, images: true, externalUrl: true, stock: true },
	})
	return products
		.filter((product) => product.stock == null || product.stock > 0)
		.map((product) => ({
			id: product.id,
			name: product.name,
			price: product.price != null ? `${Math.round(product.price).toLocaleString('fa-IR')} تومان` : '',
			description: '',
			badge: '',
			imageUrl: product.images[0] ?? '',
			productUrl: product.externalUrl ?? '',
			specs: [],
		}))
}
