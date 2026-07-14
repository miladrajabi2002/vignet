import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { ProductForm } from '@/components/products/product-form'
import { Package } from 'lucide-react'

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>
}) {
  const user = await requireUser()
  const t = await getTranslations('products')
  const query = await searchParams
  const onboardingMode = query.onboarding === '1'

  const categories = await prisma.productCategory.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {onboardingMode ? (
        <div className="spatial-surface flex items-center gap-3 rounded-[1.4rem] p-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]"><Package className="h-4 w-4" /></span>
          <div>
            <p className="text-[11px] font-bold text-[var(--text-muted)]">مرحله ۳ از ۴</p>
            <h1 className="mt-1 text-lg font-bold text-[var(--text-primary)]">اولین محصول یا خدمت را اضافه کنید</h1>
            <p className="mt-1 text-xs text-[var(--text-muted)]">بعد از ذخیره، مستقیم به ادامه مسیر راه‌اندازی برمی‌گردید.</p>
          </div>
        </div>
      ) : <h1 className="text-2xl font-light text-[var(--text-primary)]">{t('new')}</h1>}
      <ProductForm mode="create" categories={categories} returnTo={onboardingMode ? '/onboarding' : undefined} />
    </div>
  )
}
