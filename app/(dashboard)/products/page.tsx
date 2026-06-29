import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Plus, Package, FolderTree } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ProductGrid, ProductsToolbar } from '@/components/products/product-grid'
import { Pagination } from '@/components/ui/pagination'

const PAGE_SIZE = 24

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string; categoryId?: string; page?: string }
}) {
  const user = await requireUser()
  const t = await getTranslations('products')

  const q = searchParams.q?.trim() ?? ''
  const sort = searchParams.sort ?? 'newest'
  const categoryId = searchParams.categoryId ?? ''
  const page = Math.max(1, Number(searchParams.page) || 1)

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === 'price_asc'
      ? { price: 'asc' }
      : sort === 'price_desc'
        ? { price: 'desc' }
        : sort === 'queried'
          ? { queryCount: 'desc' }
          : { createdAt: 'desc' }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        workspaceId: user.workspaceId,
        ...(categoryId ? { categoryId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy,
      include: { category: { select: { name: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1, // one extra row signals whether a next page exists
    }),
    prisma.productCategory.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const hasNext = products.length > PAGE_SIZE
  const pageProducts = hasNext ? products.slice(0, PAGE_SIZE) : products

  const makeHref = (p: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (sort !== 'newest') sp.set('sort', sort)
    if (categoryId) sp.set('categoryId', categoryId)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `/products?${qs}` : '/products'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/products/categories"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <FolderTree className="h-4 w-4" />
            {t('manageCategories')}
          </Link>
          <Link
            href="/products/new"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition-transform hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            {t('new')}
          </Link>
        </div>
      </div>

      {products.length === 0 && !q && !categoryId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-16 text-center">
          <Package className="h-8 w-8 text-[var(--text-muted)]" />
          <h2 className="mt-4 text-lg text-[var(--text-primary)]">{t('empty')}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('emptyDesc')}</p>
          <Link href="/products/new" className="mt-6 rounded-xl bg-[var(--white)] px-5 py-2.5 text-sm font-medium text-[var(--bg-base)]">
            {t('new')}
          </Link>
        </div>
      ) : (
        <>
          <ProductsToolbar
            categories={categories}
            defaultQuery={q}
            defaultSort={sort}
            defaultCategory={categoryId}
          />
          <ProductGrid products={pageProducts} />
          <Pagination page={page} hasNext={hasNext} makeHref={makeHref} />
        </>
      )}
    </div>
  )
}
