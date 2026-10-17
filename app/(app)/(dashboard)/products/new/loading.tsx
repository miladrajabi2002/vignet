import { BackRowSkeleton } from '@/components/dashboard/agent-detail-skeletons'
import { PlainTitleSkeleton, ProductFormSkeleton } from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /products/new — mirrors the page: back button,
 * plain h1 title and the product form card (name/price/category/
 * description + save button).
 */
export default function NewProductLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackRowSkeleton />
      <PlainTitleSkeleton delay={-80} width="w-36" />
      <ProductFormSkeleton delay={-140} />
    </div>
  )
}
