import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { CategoryTree } from '@/components/products/category-tree'
import { BackButton } from '@/components/dashboard/back-button'

export default async function CategoriesPage() {
  const user = await requireUser()
  const t = await getTranslations('products')

  const categories = await prisma.productCategory.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { products: true } } },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackButton href="/products" label={t('title')} />
      <h1 className="text-2xl font-light text-[var(--text-primary)]">
        {t('categories.title')}
      </h1>
      <CategoryTree
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          parentId: c.parentId,
          products: c._count.products,
        }))}
      />
    </div>
  )
}
