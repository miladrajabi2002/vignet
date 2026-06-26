import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ProductForm } from '@/components/products/product-form'

export default async function NewProductPage() {
  const user = await requireUser()
  const t = await getTranslations('products')

  const categories = await prisma.productCategory.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('new')}</h1>
      <ProductForm mode="create" categories={categories} />
    </div>
  )
}
