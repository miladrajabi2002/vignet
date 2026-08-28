import Link from 'next/link'
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

  const [orders, totalOrders] = await Promise.all([
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
  ])

  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE))
  const hasFilters = Boolean(q || status)
  const numberLocale = locale === 'en' ? 'en-US' : 'fa-IR'
  const dateFormatter = new Intl.DateTimeFormat(numberLocale, {
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
              entityLabel={locale === 'en' ? 'orders' : 'سفارش'}
              buttonLabel={locale === 'en' ? 'Delete all' : 'حذف همه سفارشات'}
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
      />

      {orders.length === 0 ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
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
          <section className="hidden overflow-hidden rounded-[1.5rem] border border-[var(--border-subtle)] bg-[var(--bg-surface)] md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="bg-[var(--bg-muted)] text-start text-xs text-[var(--text-secondary)]">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('order')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('customer')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('status')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('items')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('amount')}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start font-medium">
                      {t('date')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {orders.map((order) => (
                    <tr key={order.id} className="align-top transition-colors hover:bg-[var(--bg-muted)]/60">
                      <td className="px-4 py-4">
                        <p dir="ltr" className="text-start font-semibold text-[var(--text-primary)]">
                          #{order.externalOrderId}
                        </p>
                        <p dir="ltr" className="mt-1 max-w-44 truncate text-start text-xs text-[var(--text-muted)]">
                          {shortStoreUrl(order.integration.storeUrl)}
                        </p>
                        {order.trackingCode && (
                          <p className="mt-2 text-xs text-[var(--text-secondary)]">
                            {t('tracking')}: <span dir="ltr">{order.trackingCode}</span>
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-[var(--text-primary)]">
                          {order.customerName || t('unknownCustomer')}
                        </p>
                        {order.customerPhone ? (
                          <p dir="ltr" className="mt-1 text-start text-xs text-[var(--text-muted)]">
                            {displayPhone(order.customerPhone)}
                          </p>
                        ) : order.customerEmail ? (
                          <p dir="ltr" className="mt-1 max-w-52 truncate text-start text-xs text-[var(--text-muted)]">
                            {order.customerEmail}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                          statusClassName(order.status),
                        )}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="max-w-64 px-4 py-4">
                        <p className="line-clamp-2 leading-relaxed text-[var(--text-secondary)]">
                          {order.itemsSummary || t('itemsCount', { count: order.itemCount })}
                        </p>
                        {order.itemsSummary && (
                          <p className="mt-1 text-xs text-[var(--text-muted)]">
                            {t('itemsCount', { count: order.itemCount })}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums text-[var(--text-primary)]">
                        {amountLabel(order.total, order.currency)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-[var(--text-secondary)]">
                        {dateFormatter.format(order.orderDate ?? order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-3 md:hidden">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p dir="ltr" className="text-start font-bold text-[var(--text-primary)]">
                      #{order.externalOrderId}
                    </p>
                    <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">
                      {order.customerName || t('unknownCustomer')}
                    </p>
                  </div>
                  <span className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                    statusClassName(order.status),
                  )}>
                    {statusLabel(order.status)}
                  </span>
                </div>

                <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {order.itemsSummary || t('itemsCount', { count: order.itemCount })}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-4 text-xs">
                  <div>
                    <dt className="text-[var(--text-muted)]">{t('amount')}</dt>
                    <dd className="mt-1 font-semibold tabular-nums text-[var(--text-primary)]">
                      {amountLabel(order.total, order.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">{t('date')}</dt>
                    <dd className="mt-1 text-[var(--text-primary)]">
                      {dateFormatter.format(order.orderDate ?? order.createdAt)}
                    </dd>
                  </div>
                  {order.trackingCode && (
                    <div className="col-span-2">
                      <dt className="text-[var(--text-muted)]">{t('tracking')}</dt>
                      <dd dir="ltr" className="mt-1 text-start font-medium text-[var(--text-primary)]">
                        {order.trackingCode}
                      </dd>
                    </div>
                  )}
                  {(order.courierName || order.shippingDate || order.trackingLink || order.shippingNote) && (
                    <div className="col-span-2 border-t border-[var(--border-subtle)] pt-3">
                      <dt className="text-[var(--text-muted)]">{t('shippingInfo', { fallback: 'اطلاعات ارسال' })}</dt>
                      <dd className="mt-2 space-y-1 text-sm text-[var(--text-primary)]">
                        {order.courierName && (
                          <div className="flex gap-2">
                            <span className="text-[var(--text-muted)]">{t('courier', { fallback: 'نام کالارسان' })}:</span>
                            <span className="font-medium">{order.courierName}</span>
                          </div>
                        )}
                        {order.shippingDate && (
                          <div className="flex gap-2">
                            <span className="text-[var(--text-muted)]">{t('shippingDate', { fallback: 'تاریخ ارسال' })}:</span>
                            <span className="font-medium">{order.shippingDate}</span>
                          </div>
                        )}
                        {order.trackingLink && (
                          <div className="flex gap-2">
                            <span className="text-[var(--text-muted)]">{t('trackingLink', { fallback: 'لینک پیگیری' })}:</span>
                            <a
                              href={order.trackingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              dir="ltr"
                              className="font-medium text-blue-600 hover:underline"
                            >
                              {order.trackingLink}
                            </a>
                          </div>
                        )}
                        {order.shippingNote && (
                          <div className="flex gap-2">
                            <span className="text-[var(--text-muted)]">{t('shippingNote', { fallback: 'توضیحات' })}:</span>
                            <span>{order.shippingNote}</span>
                          </div>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </article>
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

function statusClassName(status: string) {
  switch (status) {
    case 'completed':
      return 'bg-green-50 text-green-700'
    case 'processing':
      return 'bg-blue-50 text-blue-700'
    case 'pending':
    case 'on-hold':
      return 'bg-amber-50 text-amber-700'
    case 'cancelled':
    case 'failed':
      return 'bg-red-50 text-red-700'
    case 'refunded':
      return 'bg-purple-50 text-purple-700'
    default:
      return 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'
  }
}
