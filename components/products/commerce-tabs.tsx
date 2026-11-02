import Link from 'next/link'
import { MessageSquareText, Package, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CommerceTabs({
  active,
  productsLabel,
  ordersLabel,
  requestsLabel,
  attention,
  locale = 'fa',
}: {
  active: 'products' | 'orders' | 'requests'
  productsLabel: string
  ordersLabel: string
  /** In-chat pre-orders and back-in-stock waiting list. */
  requestsLabel?: string
  /** What waits for the owner on each tab (lib/commerce/attention). */
  attention?: { orders: number; requests: number }
  locale?: string
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
            <TabCount
              count={item.key === 'orders' ? attention?.orders : item.key === 'requests' ? attention?.requests : 0}
              locale={locale}
              label={item.key === 'orders' ? (locale === 'en' ? 'to deliver' : 'منتظر رسیدگی') : (locale === 'en' ? 'waiting for you' : 'منتظر شما')}
            />
          </Link>
        )
      })}
    </nav>
  )
}

/** A red count beside a tab: things on it that wait for the owner. */
function TabCount({ count, locale, label }: { count?: number; locale: string; label: string }) {
  if (!count) return null
  const nf = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'fa-IR')
  return (
    <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white tabular-nums">
      <span className="sr-only">{label}: </span>
      {count > 99 ? `${nf.format(99)}+` : nf.format(count)}
    </span>
  )
}
