import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { CategoryTree } from '@/components/products/category-tree'
import { FolderTree } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function CategoriesPage() {
  const user = await requireUser()
  const t = await getTranslations('products')

  const categories = await prisma.productCategory.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { products: { where: { deletedAt: null } } } } },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader icon={FolderTree} title={t('categories.title')} back={{ href: '/products', label: t('title') }} />
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
