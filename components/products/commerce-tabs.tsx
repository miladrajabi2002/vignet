import Link from 'next/link'
import { Package, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CommerceTabs({
  active,
  productsLabel,
  ordersLabel,
}: {
  active: 'products' | 'orders'
  productsLabel: string
  ordersLabel: string
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
  ]

  return (
    <nav
      aria-label={productsLabel}
      className="grid grid-cols-2 gap-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1 sm:inline-grid"
    >
      {items.map((item) => {
        const Icon = item.icon
        const selected = active === item.key
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-strong)]',
              selected
                ? 'bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
