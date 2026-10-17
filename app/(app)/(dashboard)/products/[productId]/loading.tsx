import { BackRowSkeleton } from '@/components/dashboard/agent-detail-skeletons'
import {
  CoverageCardSkeleton,
  ProductHeaderCardSkeleton,
  ProductStatCardSkeleton,
} from '@/components/dashboard/pages-skeletons'

/**
 * Route-level skeleton for /products/[productId] — mirrors the page: back
 * button + edit button row, the product header card (aspect-video image +
 * name/price/tags), the 3 stat cards, agent coverage and attributes.
 */
export default function ProductDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back + edit row (edit button is fixed-bottom on mobile) */}
      <div className="flex items-center justify-between">
        <BackRowSkeleton />
        <div className="hidden md:block">
          <BackRowSkeleton delay={-60} />
        </div>
      </div>

      {/* Header card: image + name/price/tags */}
      <ProductHeaderCardSkeleton delay={-100} />

      {/* Analytics stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <ProductStatCardSkeleton key={index} delay={-160 - index * 90} />
        ))}
      </div>

      {/* Agent coverage */}
      <CoverageCardSkeleton delay={-260} chips={2} />

      {/* Attributes */}
      <CoverageCardSkeleton delay={-320} chips={4} />
    </div>
  )
}
