import { BackRowSkeleton } from '@/components/dashboard/agent-detail-skeletons'
import { CategoryRowSkeleton, PlainTitleSkeleton } from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /products/categories — mirrors the page: back
 * button, plain h1 title and the category tree rows (root + nested).
 */
export default function ProductCategoriesLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackRowSkeleton />
      <PlainTitleSkeleton delay={-80} width="w-44" />

      {/* Category tree */}
      <div className="space-y-2">
        <CategoryRowSkeleton delay={-120} />
        <CategoryRowSkeleton delay={-200} indent />
        <CategoryRowSkeleton delay={-280} indent />
        <CategoryRowSkeleton delay={-360} />
      </div>
    </div>
  )
}
