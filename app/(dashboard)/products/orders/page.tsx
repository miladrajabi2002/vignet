import type { Prisma } from '@prisma/client'
import { ShoppingBag } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { CommerceTabs } from '@/components/products/commerce-tabs'
import { Pagination } from '@/components/ui/pagination'
import { displayPhone } from '@/lib/phone'
import { BulkDeleteButton } from '@/components/ui/bulk-delete-button'
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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>
}) {
  const params = await searchParams
  const user = await requireUser()
  const t = await getTranslations('products.orders')
  const productsT = await getTranslations('products')
  const locale = await getLocale()
  const q = params.q?.trim() ?? ''
  const requestedStatus = params.status ?? ''
  const status = isOrderStatus(requestedStatus) ? requestedStatus : ''
  const page = Math.max(1, Number(params.page) || 1)

  const where: Prisma.StoreOrderWhereInput = {
    workspaceId: user.workspaceId,
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: searchVariants(q).flatMap((term): Prisma.StoreOrderWhereInput[] => [
            { externalOrderId: { contains: term, mode: 'insensitive' } },
            { customerName: { contains: term, mode: 'insensitive' } },
            { customerPhone: { contains: term, mode: 'insensitive' } },
            { customerEmail: { contains: term, mode: 'insensitive' } },
            { trackingCode: { contains: term, mode: 'insensitive' } },
          ]),
        }
      : {}),
  }

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
    checkWorkspaceResourceCreateAllowed(user.workspaceId, 'orders'),
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
    return query ? '/products/orders?' + query : '/products/orders'
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
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        icon={ShoppingBag}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <BulkDeleteButton
              countEndpoint="/api/products/orders/bulk"
              deleteEndpoint="/api/products/orders/bulk"
              restoreEndpoint="/api/products/orders/bulk/restore"
              undoKind="order"
              entityLabel={locale === 'en' ? 'orders' : 'سفارش'}
              entitySingularLabel={locale === 'en' ? 'order' : 'سفارش'}
              buttonLabel={t('deleteAll')}
              variant="menu"
            />
            <span className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)]">
              {t('total', { count: totalOrders.toLocaleString(locale === 'en' ? 'en-US' : 'fa-IR') })}
            </span>
          </>
        }
      />

      <CommerceTabs
        active="orders"
        productsLabel={productsT('title')}
        ordersLabel={t('title')}
        requestsLabel={t('requestsTab')}
      />

      {!orderCapacity.allowed && (
        <PlanLimitNotice limit={orderLimit} locale={locale === 'en' ? 'en' : 'fa'} syncContext />
      )}

      <OrdersSearchForm
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
        resultsLabel={t('results', { count: totalOrders })}
      />

      {orders.length === 0 ? (
        <LiveEmptyState
        icon={ShoppingBag}
        preview={hasFilters ? 'none' : 'orders'}
        title={hasFilters ? t('emptyFiltered') : t('empty')}
        description={hasFilters ? t('emptyFilteredDescription') : t('emptyDescription')}
        action={hasFilters ? { href: '/products/orders', label: t('clearFilters') } : undefined}
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
              {orders.map((order) => (
                <li key={order.id}>
                  <OrderEntry variant="row" {...entryProps(order)}>
                    {orderDetails(order)}
                  </OrderEntry>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-3 md:hidden">
            {orders.map((order) => (
              <OrderEntry key={order.id} variant="card" {...entryProps(order)}>
                {orderDetails(order)}
              </OrderEntry>
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
