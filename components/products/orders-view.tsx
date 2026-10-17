import type { Prisma } from '@prisma/client'
import { ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { CommerceTabs } from '@/components/products/commerce-tabs'
import { MenuTabs } from '@/components/menu/menu-tabs'
import { getDashboardModuleLabel } from '@/lib/verticals/registry'
import { Pagination } from '@/components/ui/pagination'
import { displayPhone } from '@/lib/phone'
import { BulkDeleteMenu } from '@/components/ui/bulk-delete-menu'
import { OrdersSearchForm } from '@/components/products/orders-search-form'
import { CopyButton } from '@/components/ui/copy-button'
import { OrderEntry } from '@/components/products/order-entry'
import { ORDER_ROW_GRID } from '@/components/products/order-row-grid'
import { PlanLimitNotice, type PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { checkWorkspaceResourceCreateAllowed } from '@/lib/billing/entitlements'
import { getEffectivePlanDefs, planResourceLimit, recommendedUpgradePlan } from '@/lib/billing/plans'
import { dateLocaleTag } from '@/lib/localized-date'
import { searchVariants } from '@/lib/search/persian'
import { LiveEmptyState } from '@/components/ui/live-empty-state'
import { loadGatewayOrders, type Purchase } from '@/lib/payments/card/fulfilment'
import { PurchaseCard } from '@/components/payments/purchase-card'

const PAGE_SIZE = 20
const ORDER_STATUSES = [
  'pending',
  'processing',
  'on-hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
] as const

type OrderStatus = (typeof ORDER_STATUSES)[number]

const STATUS_TRANSLATION_KEYS: Record<OrderStatus, string> = {
  pending: 'statuses.pending',
  processing: 'statuses.processing',
  'on-hold': 'statuses.onHold',
  completed: 'statuses.completed',
  cancelled: 'statuses.cancelled',
  refunded: 'statuses.refunded',
  failed: 'statuses.failed',
}

export type OrdersSearchParams = { q?: string; status?: string; page?: string }

/**
 * The orders list. A shop reads it under «محصولات»; a business whose catalog
 * is only its digital menu reads the same list as a tab of the menu.
 */
export async function OrdersView({
  scope,
  workspaceId,
  searchParams: params,
}: {
  scope: 'products' | 'menu'
  workspaceId: string
  searchParams: OrdersSearchParams
}) {
  const basePath = scope === 'menu' ? '/menu/orders' : '/products/orders'
  const t = await getTranslations('products.orders')
  const productsT = await getTranslations('products')
  const locale = await getLocale()
  const q = params.q?.trim() ?? ''
  // «#1001» is how numbers are shown; the stored reference has no «#».
  const needle = q.replace(/^[#＃]\s*/, '')
  const requestedStatus = params.status ?? ''
  const status = isOrderStatus(requestedStatus) ? requestedStatus : ''
  const page = Math.max(1, Number(params.page) || 1)

  const where: Prisma.StoreOrderWhereInput = {
    workspaceId: workspaceId,
    ...(status ? { status } : {}),
    ...(needle
      ? {
          OR: searchVariants(needle).flatMap((term): Prisma.StoreOrderWhereInput[] => [
            { externalOrderId: { contains: term, mode: 'insensitive' } },
            { customerName: { contains: term, mode: 'insensitive' } },
            { customerPhone: { contains: term, mode: 'insensitive' } },
            { customerEmail: { contains: term, mode: 'insensitive' } },
            { trackingCode: { contains: term, mode: 'insensitive' } },
          ]),
        }
      : {}),
  }

  // Orders paid by card-to-card in Vigent itself (not placed on a store) sit
  // on the first page beside the store's: waiting ones read «در حال انجام»,
  // handled ones «تکمیل‌شده».
  const gatewayStatus = status === 'processing' ? false : status === 'completed' ? true : status ? null : undefined
  const gatewayOrders: Purchase[] = page === 1 && gatewayStatus !== null
    ? await loadGatewayOrders(workspaceId, { query: needle ? searchVariants(needle) : undefined, handled: gatewayStatus })
    : []

  const [orders, totalOrders, orderCapacity, planDefs] = await Promise.all([
    prisma.storeOrder.findMany({
      where,
      orderBy: [{ orderDate: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        integration: {
          select: { storeUrl: true },
        },
      },
    }),
    prisma.storeOrder.count({ where }),
    checkWorkspaceResourceCreateAllowed(workspaceId, 'orders'),
    getEffectivePlanDefs(),
  ])

  const recommendedPlan = recommendedUpgradePlan(
    planDefs,
    orderCapacity.plan,
    'orders',
    orderCapacity.used,
  )
  const orderLimit: PlanLimitInfo = {
    resource: 'orders',
    plan: orderCapacity.plan,
    used: orderCapacity.used,
    limit: orderCapacity.limit,
    recommendedPlan,
    recommendedLimit: recommendedPlan ? planResourceLimit(planDefs[recommendedPlan], 'orders') : null,
  }

  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE))
  const listedCount = totalOrders + gatewayOrders.length
  const hasFilters = Boolean(q || status)
  const numberLocale = locale === 'en' ? 'en-US' : 'fa-IR'
  const dateFormatter = new Intl.DateTimeFormat(dateLocaleTag(locale === 'en' ? 'en' : 'fa'), {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  function makeHref(nextPage: number) {
    const nextParams = new URLSearchParams()
    if (q) nextParams.set('q', q)
    if (status) nextParams.set('status', status)
    if (nextPage > 1) nextParams.set('page', String(nextPage))
    const query = nextParams.toString()
    return query ? basePath + '?' + query : basePath
  }

  function statusLabel(value: string) {
    return isOrderStatus(value)
      ? t(STATUS_TRANSLATION_KEYS[value])
      : value
  }

  function amountLabel(total: number, currency: string) {
    const normalizedCurrency = currency.toUpperCase()
    const currencyLabel = normalizedCurrency === 'IRR'
      ? t('rial')
      : normalizedCurrency === 'IRT' || normalizedCurrency === 'TMN'
        ? t('toman')
        : normalizedCurrency
    return new Intl.NumberFormat(numberLocale, {
      maximumFractionDigits: 2,
    }).format(total) + ' ' + currencyLabel
  }

  type OrderRow = (typeof orders)[number]

  /** Everything the list row and the mobile card show at a glance. */
  function entryProps(order: OrderRow) {
    return {
      orderNumber: order.externalOrderId,
      storeLabel: shortStoreUrl(order.integration.storeUrl),
      customerName: order.customerName || t('unknownCustomer'),
      customerContact: order.customerPhone ? displayPhone(order.customerPhone) : order.customerEmail || null,
      itemsLabel: order.itemsSummary || t('itemsCount', { count: order.itemCount }),
      itemsCountLabel: order.itemsSummary ? t('itemsCount', { count: order.itemCount }) : null,
      statusLabel: statusLabel(order.status),
      statusClassName: statusClassName(order.status),
      amountLabel: amountLabel(order.total, order.currency),
      dateLabel: dateFormatter.format(order.orderDate ?? order.createdAt),
      amountTitle: t('amount'),
      dateTitle: t('date'),
      detailsLabel: t('details'),
      closeLabel: t('hideDetails'),
    }
  }

  function gatewayEntryProps(order: Purchase) {
    const items = order.lines.map((line) => `${line.quantity > 1 ? `${new Intl.NumberFormat(numberLocale).format(line.quantity)}× ` : ''}${line.name}`).join('، ')
    const count = order.lines.reduce((sum, line) => sum + line.quantity, 0)
    const state = order.handledAt ? 'completed' : 'processing'
    return {
      orderNumber: order.code,
      storeLabel: locale === 'en' ? 'Vigent · card transfer' : 'ویجنت · کارت‌به‌کارت',
      customerName: order.customerName || t('unknownCustomer'),
      customerContact: order.customerPhone ? displayPhone(order.customerPhone) : null,
      itemsLabel: items || t('itemsCount', { count }),
      itemsCountLabel: items ? t('itemsCount', { count }) : null,
      statusLabel: order.handledAt ? (locale === 'en' ? 'Handled' : 'رسیدگی شد') : (locale === 'en' ? 'Paid · to deliver' : 'پرداخت‌شده · منتظر رسیدگی'),
      statusClassName: statusClassName(state),
      amountLabel: amountLabel(order.total, 'IRT'),
      dateLabel: dateFormatter.format(order.paidAt),
      amountTitle: t('amount'),
      dateTitle: t('date'),
      detailsLabel: t('details'),
      closeLabel: t('hideDetails'),
    }
  }

  // Newest first across both sources.
  type ListedOrder = { kind: 'store'; order: OrderRow; at: Date } | { kind: 'gateway'; order: Purchase; at: Date }
  const listed: ListedOrder[] = [
    ...orders.map((order): ListedOrder => ({ kind: 'store', order, at: order.orderDate ?? order.createdAt })),
    ...gatewayOrders.map((order): ListedOrder => ({ kind: 'gateway', order, at: order.paidAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime())

  function listedEntry(entry: ListedOrder, variant: 'row' | 'card') {
    return entry.kind === 'store' ? (
      <OrderEntry variant={variant} {...entryProps(entry.order)}>
        {orderDetails(entry.order)}
      </OrderEntry>
    ) : (
      <OrderEntry variant={variant} {...gatewayEntryProps(entry.order)}>
        <PurchaseCard purchase={entry.order} locale={locale === 'en' ? 'en' : 'fa'} />
      </OrderEntry>
    )
  }

  /** The popup body: items, customer, store and shipping, each only when known. */
  function orderDetails(order: OrderRow) {
    return (
      <dl className="grid gap-x-4 gap-y-4 rounded-card border border-[var(--border-default)] bg-white p-4 text-xs shadow-[var(--shadow-xs)] sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[var(--text-muted)]">{t('items')}</dt>
          <dd className="mt-1 whitespace-pre-line text-sm leading-6 text-[var(--text-primary)]">
            {order.itemsSummary || t('itemsCount', { count: order.itemCount })}
          </dd>
          {order.itemsSummary && (
            <p className="mt-1 text-[var(--text-muted)]">{t('itemsCount', { count: order.itemCount })}</p>
          )}
        </div>

        <div className="min-w-0">
          <dt className="text-[var(--text-muted)]">{t('customer')}</dt>
          <dd className="mt-1 font-medium text-[var(--text-primary)]">{order.customerName || t('unknownCustomer')}</dd>
          {order.customerPhone && (
            <dd dir="ltr" className="mt-0.5 truncate text-start tabular-nums text-[var(--text-secondary)]">{displayPhone(order.customerPhone)}</dd>
          )}
          {order.customerEmail && (
            <dd dir="ltr" className="mt-0.5 truncate text-start text-[var(--text-secondary)]">{order.customerEmail}</dd>
          )}
        </div>

        <div className="min-w-0">
          <dt className="text-[var(--text-muted)]">{t('store')}</dt>
          <dd dir="ltr" className="mt-1 truncate text-start font-medium text-[var(--text-primary)]">
            {shortStoreUrl(order.integration.storeUrl)}
          </dd>
        </div>

        {order.trackingCode && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--text-muted)]">{t('tracking')}</dt>
            <dd className="mt-1 flex items-center justify-between gap-2">
              <span dir="ltr" className="min-w-0 truncate text-start font-mono font-semibold text-[var(--text-primary)]">
                {order.trackingCode}
              </span>
              <CopyButton value={order.trackingCode} label={t('copyTracking')} copiedLabel={t('copied')} />
            </dd>
          </div>
        )}

        {(order.courierName || order.shippingDate || order.trackingLink || order.shippingNote) && (
          <div className="border-t border-[var(--border-subtle)] pt-4 sm:col-span-2">
            <dt className="font-semibold text-[var(--text-primary)]">{t('shippingInfo')}</dt>
            <dd className="mt-2 space-y-2 text-sm leading-6 text-[var(--text-primary)]">
              {order.courierName && <p><span className="text-[var(--text-muted)]">{t('courier')}: </span>{friendlyCourierName(order.courierName, locale)}</p>}
              {order.shippingDate && <p><span className="text-[var(--text-muted)]">{t('shippingDate')}: </span>{order.shippingDate}</p>}
              {order.trackingLink && (
                <p className="min-w-0">
                  <span className="text-[var(--text-muted)]">{t('trackingLink')}: </span>
                  <a href={order.trackingLink} target="_blank" rel="noopener noreferrer" dir="ltr" className="ui-link inline break-all">
                    {order.trackingLink}
                  </a>
                </p>
              )}
              {order.shippingNote && <p><span className="text-[var(--text-muted)]">{t('shippingNote')}: </span>{order.shippingNote}</p>}
            </dd>
          </div>
        )}
      </dl>
    )
  }

  return (
    <div className="mx-auto max-w-none space-y-6">
      <PageHeader
        icon={scope === 'menu' ? UtensilsCrossed : ShoppingBag}
        title={scope === 'menu' ? getDashboardModuleLabel('menu', null, locale, t('title')) : t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <BulkDeleteMenu
              endpoint="/api/products/orders/bulk"
              undoKind="order"
              entityLabel={locale === 'en' ? 'orders' : 'سفارش'}
              compactOnMobile
              options={[
                { scope: 'cancelled', label: locale === 'en' ? 'Delete cancelled and failed orders' : 'حذف سفارش‌های لغوشده و ناموفق', hint: locale === 'en' ? 'Cancelled, refunded or failed payment' : 'لغوشده، مرجوعی یا پرداخت ناموفق' },
                { scope: 'completed', label: locale === 'en' ? 'Delete completed orders' : 'حذف سفارش‌های تکمیل‌شده', hint: locale === 'en' ? 'Delivered; nothing left to follow up' : 'تحویل شده‌اند و پیگیری لازم ندارند' },
                { scope: 'older_90d', label: locale === 'en' ? 'Delete orders older than 3 months' : 'حذف سفارش‌های قدیمی‌تر از سه ماه', hint: locale === 'en' ? 'Placed more than 90 days ago' : 'ثبت‌شده بیش از ۹۰ روز پیش' },
                { scope: 'all', label: t('deleteAll'), hint: locale === 'en' ? 'Every order, whatever its status' : 'همهٔ سفارش‌ها با هر وضعیتی' },
              ]}
              extraWarning={scope === 'products'
                ? (locale === 'en'
                    ? 'Only the copy in Vigent is removed; the orders stay in your store'
                    : 'فقط نسخهٔ ویجنت حذف می‌شود؛ سفارش‌ها در فروشگاه شما می‌مانند')
                : undefined}
            />
            <span className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)]">
              {t('total', { count: listedCount.toLocaleString(locale === 'en' ? 'en-US' : 'fa-IR') })}
            </span>
          </>
        }
      />

      {scope === 'menu' ? (
        <MenuTabs active="orders" showOrders />
      ) : (
        <CommerceTabs
          active="orders"
          productsLabel={productsT('title')}
          ordersLabel={t('title')}
          requestsLabel={t('requestsTab')}
        />
      )}

      {!orderCapacity.allowed && (
        <PlanLimitNotice limit={orderLimit} locale={locale === 'en' ? 'en' : 'fa'} syncContext />
      )}

      <OrdersSearchForm
        basePath={basePath}
        defaultQuery={q}
        defaultStatus={status}
        statusOptions={ORDER_STATUSES.map((value) => ({
          value,
          label: t(STATUS_TRANSLATION_KEYS[value]),
        }))}
        searchLabel={t('searchLabel')}
        searchPlaceholder={t('searchPlaceholder')}
        statusLabel={t('statusLabel')}
        allStatuses={t('allStatuses')}
        clearFilters={t('clearFilters')}
        filtersLabel={t('filters')}
        closeFilters={t('showResults')}
        resultsLabel={t('results', { count: listedCount })}
      />

      {listed.length === 0 ? (
        <LiveEmptyState
        icon={ShoppingBag}
        preview={hasFilters ? 'none' : 'orders'}
        title={hasFilters ? t('emptyFiltered') : t('empty')}
        description={hasFilters ? t('emptyFilteredDescription') : t('emptyDescription')}
        action={hasFilters ? { href: basePath, label: t('clearFilters') } : undefined}
        />
      ) : (
        <>
          <section className="spatial-surface hidden overflow-hidden rounded-card !bg-white md:block">
            <div className={cn(ORDER_ROW_GRID, 'border-b border-[var(--border-subtle)] bg-[var(--bg-muted)] px-4 py-2.5 text-xs font-medium text-[var(--text-secondary)] sm:px-5')}>
              <span>{t('order')}</span>
              <span>{t('customer')}</span>
              <span className="hidden lg:block">{t('items')}</span>
              <span>{t('status')}</span>
              <span className="text-end">{t('amount')}</span>
              <span className="text-end">{t('date')}</span>
              <span aria-hidden="true" />
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {listed.map((entry) => (
                <li key={entry.order.id}>{listedEntry(entry, 'row')}</li>
              ))}
            </ul>
          </section>

          <div className="grid gap-3 md:hidden">
            {listed.map((entry) => (
              <div key={entry.order.id}>{listedEntry(entry, 'card')}</div>
            ))}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            hasNext={page < totalPages}
            makeHref={makeHref}
          />
        </>
      )}
    </div>
  )
}

function isOrderStatus(value: string): value is OrderStatus {
  return ORDER_STATUSES.includes(value as OrderStatus)
}

function shortStoreUrl(storeUrl: string) {
  return storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function friendlyCourierName(courierName: string, locale: string) {
  const normalized = courierName.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (['iran_post', 'iranpost', 'post', 'national_post'].includes(normalized)) {
    return locale === 'en' ? 'Iran Post' : 'شرکت ملی پست ایران'
  }
  if (normalized === 'tipax') return locale === 'en' ? 'Tipax' : 'تیپاکس'
  if (normalized === 'chapar') return locale === 'en' ? 'Chapar' : 'چاپار'
  return courierName
}

/** Order states on the shared chip palette (app/ui-system.css). */
function statusClassName(status: string) {
switch (status) {
case 'completed':
return 'ui-chip ui-chip-ok'
case 'processing':
return 'ui-chip ui-chip-signal'
case 'pending':
case 'on-hold':
return 'ui-chip ui-chip-warn'
case 'cancelled':
case 'failed':
return 'ui-chip ui-chip-danger'
default:
return 'ui-chip ui-chip-neutral'
}
}
