import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ProductForm, type VariationInput } from '@/components/products/product-form'
import { BackButton } from '@/components/dashboard/back-button'

export default async function EditProductPage(
  props: {
    params: Promise<{ productId: string }>
  }
) {
  const params = await props.params;
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

  // Parse `attributes` into the form's two sections:
  //   • publicAttrs — flat { key, value } rows for the simple attributes grid
  //   • variations — the `_variations` array (when present), mapped back into
  //     the form's VariationInput shape so editing a WooCommerce-synced
  //     product shows its variations in the form, ready to tweak.
  const rawAttrs =
    product.attributes && typeof product.attributes === 'object'
      ? (product.attributes as Record<string, unknown>)
      : {}

  const attributes = Object.entries(rawAttrs)
    .filter(([k]) => k !== '_variations')
    .map(([key, value]) => ({ key, value: String(value) }))

  const rawVariations = Array.isArray(rawAttrs._variations) ? rawAttrs._variations : []
  const variations: VariationInput[] = rawVariations
    .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
    .map((v) => {
      const attrs = v.attributes
      const attrRows: { key: string; value: string }[] =
        attrs && typeof attrs === 'object' && !Array.isArray(attrs)
          ? Object.entries(attrs as Record<string, unknown>).map(([key, val]) => ({
              key,
              value: val == null ? '' : String(val),
            }))
          : []
      const stockNum =
        v.manageStock === true && typeof v.stockQuantity === 'number'
          ? v.stockQuantity
          : null
      const priceNum = typeof v.price === 'number' && v.price > 0 ? v.price : null
      return {
        localId: `v_${Math.random().toString(36).slice(2, 10)}`,
        attributes: attrRows.length > 0 ? attrRows : [{ key: '', value: '' }],
        stock: stockNum === null ? '' : String(stockNum),
        price: priceNum === null ? '' : String(priceNum),
        image: typeof v.image === 'string' && v.image ? v.image : '',
      }
    })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackButton href="/products" label={t('title')} />
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
          externalUrl: product.externalUrl ?? '',
          images: product.images,
          attributes,
          variations,
          active: product.active,
        }}
      />
    </div>
  )
}
