import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ProductForm } from '@/components/products/product-form'

export default async function EditProductPage({
  params,
}: {
  params: { productId: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('products')

  const [product, categories] = await Promise.all([
    prisma.product.findFirst({
      where: { id: params.productId, workspaceId: user.workspaceId },
    }),
    prisma.productCategory.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ])
  if (!product) notFound()

  const attributes =
    product.attributes && typeof product.attributes === 'object'
      ? Object.entries(product.attributes as Record<string, unknown>).map(
          ([key, value]) => ({ key, value: String(value) }),
        )
      : []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('edit')}</h1>
      <ProductForm
        mode="edit"
        categories={categories}
        initial={{
          id: product.id,
          name: product.name,
          description: product.description ?? '',
          price: product.price?.toString() ?? '',
          comparePrice: product.comparePrice?.toString() ?? '',
          sku: product.sku ?? '',
          stock: product.stock?.toString() ?? '',
          categoryId: product.categoryId ?? '',
          tags: product.tags.join(', '),
          images: product.images,
          attributes,
          active: product.active,
        }}
      />
    </div>
  )
}
