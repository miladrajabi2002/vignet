import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { ShoppingBag } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/dashboard/page-header'
import { CommerceTabs } from '@/components/products/commerce-tabs'
import { Pagination } from '@/components/ui/pagination'
import { BulkDeleteButton } from '@/components/ui/bulk-delete-button'
import { OrdersSearchForm } from '@/components/products/orders-search-form'
import { OrdersWorkspace, type OrderRowData } from '@/components/products/orders-workspace'
import { PlanLimitNotice, type PlanLimitInfo } from '@/components/billing/plan-limit-notice'
import { checkWorkspaceResourceCreateAllowed } from '@/lib/billing/entitlements'
import { getEffectivePlanDefs, planResourceLimit, recommendedUpgradePlan } from '@/lib/billing/plans'

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
          OR: [
            { externalOrderId: { contains: q, mode: 'insensitive' } },
            { customerName: { contains: q, mode: 'insensitive' } },
            { customerPhone: { contains: q, mode: 'insensitive' } },
            { customerEmail: { contains: q, mode: 'insensitive' } },
            { trackingCode: { contains: q, mode: 'insensitive' } },
          ],
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
  function makeHref(nextPage: number) {
    const nextParams = new URLSearchParams()
    if (q) nextParams.set('q', q)
    if (status) nextParams.set('status', status)
    if (nextPage > 1) nextParams.set('page', String(nextPage))
    const query = nextParams.toString()
    return query ? '/products/orders?' + query : '/products/orders'
  }

  // Serialize the page's rows for the client workspace (selection lives there).
  const orderRows: OrderRowData[] = orders.map((order) => ({
    id: order.id,
    externalOrderId: order.externalOrderId,
    storeUrl: order.integration.storeUrl,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    status: order.status,
    trackingCode: order.trackingCode,
    courierName: order.courierName,
    shippingDate: order.shippingDate,
    trackingLink: order.trackingLink,
    shippingNote: order.shippingNote,
    itemsSummary: order.itemsSummary,
    itemCount: order.itemCount,
    total: order.total,
    currency: order.currency,
    orderDate: order.orderDate ? order.orderDate.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
  }))

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
              entityLabel={locale === 'en' ? 'orders' : 'سفارش'}
              entitySingularLabel={locale === 'en' ? 'order' : 'سفارش'}
              buttonLabel={locale === 'en' ? 'Delete all' : 'حذف همه سفارشات'}
              compactOnMobile
            />
            <span className="inline-flex min-h-10 items-center rounded-xl border border-[var(--border-default)] px-3 text-sm text-[var(--text-secondary)]">
              {t('total', { count: totalOrders })}
            </span>
          </>
        }
      />

      <CommerceTabs
        active="orders"
        productsLabel={productsT('title')}
        ordersLabel={t('title')}
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
        <section className="flex min-h-72 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border-default)] bg-white p-8 text-center shadow-[var(--shadow-card)]">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--bg-muted)] text-[var(--text-muted)]">
            <ShoppingBag className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-[var(--text-primary)]">
            {hasFilters ? t('emptyFiltered') : t('empty')}
          </h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
            {hasFilters ? t('emptyFilteredDescription') : t('emptyDescription')}
          </p>
          {hasFilters && (
            <Link
              href="/products/orders"
              className="mt-4 inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] px-4 text-sm font-medium text-[var(--text-primary)]"
            >
              {t('clearFilters')}
            </Link>
          )}
        </section>
      ) : (
        <>
          <OrdersWorkspace
            orders={orderRows}
            totalResults={totalOrders}
            filters={{ q, status }}
          />

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

