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
      className="spatial-surface grid grid-cols-2 gap-1 rounded-[1.35rem] p-1.5 sm:inline-grid sm:min-w-[20rem]"
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
              'spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2',
              selected
                ? 'bg-black text-white shadow-[0_8px_22px_rgba(0,0,0,0.16)]'
                : 'text-[var(--text-secondary)] hover:bg-black/[0.045] hover:text-[var(--text-primary)]',
            )}
          >
            <span
              className={cn(
                'grid h-7 w-7 place-items-center rounded-lg transition-colors duration-200',
                selected ? 'bg-white/10' : 'bg-black/[0.045]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
