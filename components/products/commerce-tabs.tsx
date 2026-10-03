import Link from 'next/link'
import { MessageSquareText, Package, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CommerceTabs({
  active,
  productsLabel,
  ordersLabel,
  requestsLabel,
}: {
  active: 'products' | 'orders' | 'requests'
  productsLabel: string
  ordersLabel: string
  /** In-chat pre-orders and back-in-stock waiting list. */
  requestsLabel?: string
}) {
  const items = [
    {
      key: 'products' as const,
      href: '/products',
      label: productsLabel,
      icon: Package,
    },
    {
      key: 'orders' as const,
      href: '/products/orders',
      label: ordersLabel,
      icon: ShoppingBag,
    },
    ...(requestsLabel
      ? [{
          key: 'requests' as const,
          href: '/products/requests',
          label: requestsLabel,
          icon: MessageSquareText,
        }]
      : []),
  ]

  return (
    <nav
      aria-label={productsLabel}
      className={cn(
        'ui-seg sm:inline-grid',
        items.length === 3 ? 'grid-cols-3 sm:min-w-[30rem]' : 'grid-cols-2 sm:min-w-[20rem]',
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const selected = active === item.key
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? 'page' : undefined}
            className="ui-seg-tab gap-1.5 whitespace-nowrap px-1.5 text-xs sm:gap-2 sm:px-4 sm:text-sm"
          >
            <span className="ui-seg-icon h-7 w-7">
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
