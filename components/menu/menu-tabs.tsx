import Link from 'next/link'
import { cn } from '@/lib/utils'

export type MenuTab = 'items' | 'orders' | 'design'

const LABELS: Record<MenuTab, string> = {
  items: 'آیتم‌ها',
  orders: 'سفارش‌ها',
  design: 'طراحی و اطلاعات',
}

/**
 * The menu's sections. Items and design switch in place on /menu (pass
 * `onSelect`); orders is its own route, so from there every tab is a link.
 * Orders only shows for a business whose catalog is its menu — a shop reads
 * them under «محصولات».
 */
export function MenuTabs({
  active,
  showOrders,
  onSelect,
  ordersCount = 0,
}: {
  active: MenuTab
  showOrders: boolean
  onSelect?: (tab: 'items' | 'design') => void
  /** Paid orders waiting to be delivered: a red count on the Orders tab. */
  ordersCount?: number
}) {
  const tabs: MenuTab[] = showOrders ? ['items', 'orders', 'design'] : ['items', 'design']
  return (
    <nav className={cn('ui-seg', showOrders ? 'grid-cols-3 sm:w-[32rem]' : 'grid-cols-2 sm:w-[22rem]')} aria-label="بخش‌های منو">
      {tabs.map((tab) => {
        const selected = tab === active
        return tab !== 'orders' && onSelect ? (
          <button key={tab} type="button" aria-current={selected ? 'page' : undefined} onClick={() => onSelect(tab)} className="ui-seg-tab">{LABELS[tab]}</button>
        ) : (
          <Link key={tab} href={tab === 'orders' ? '/menu/orders' : tab === 'design' ? '/menu?tab=design' : '/menu'} aria-current={selected ? 'page' : undefined} className="ui-seg-tab gap-1.5 whitespace-nowrap">
            {LABELS[tab]}
            {tab === 'orders' && ordersCount > 0 ? (
              <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white tabular-nums">
                <span className="sr-only">منتظر رسیدگی: </span>
                {ordersCount.toLocaleString('fa-IR')}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
