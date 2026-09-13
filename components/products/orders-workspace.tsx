'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { displayPhone } from '@/lib/phone'
import { dateLocaleTag } from '@/lib/localized-date'
import { CopyButton } from '@/components/ui/copy-button'
import { MobileOrderCard } from '@/components/products/mobile-order-card'
import { BulkDeleteButton } from '@/components/ui/bulk-delete-button'
import { fetchAllResultIds, SelectionBar, SelectionHeader } from '@/components/ui/selection-bar'
import { useTableSelection } from '@/lib/hooks/use-table-selection'

/**
 * Orders list with row selection (tri-state + shift-click + select-all-N).
 * Extracted from the server page so selection state can live on the client.
 * Rendering (desktop table + mobile cards) is unchanged apart from the
 * selection column.
 */

export interface OrderRowData {
  id: string
  externalOrderId: string
  storeUrl: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  status: string
  trackingCode: string | null
  courierName: string | null
  shippingDate: string | null
  trackingLink: string | null
  shippingNote: string | null
  itemsSummary: string | null
  itemCount: number
  total: number
  currency: string
  orderDate: string | null
  createdAt: string
}

export interface OrderSelectionFilters {
  q: string
  status: string
}

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

export function OrdersWorkspace({
  orders,
  totalResults,
  filters,
}: {
  orders: OrderRowData[]
  /** Server count of every order matching the current filters. */
  totalResults: number
  /** Current list filters — fed to /api/products/orders/ids for select-all-N. */
  filters: OrderSelectionFilters
}) {
  const t = useTranslations('products.orders')
  const locale = useLocale()
  const fa = locale !== 'en'
  const numberLocale = fa ? 'fa-IR' : 'en-US'
  const dateFormatter = new Intl.DateTimeFormat(dateLocaleTag(fa ? 'fa' : 'en'), {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const selection = useTableSelection(orders.map((order) => order.id))
  const [loadingAll, setLoadingAll] = useState(false)

  async function handleSelectAllResults() {
    setLoadingAll(true)
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.status) params.set('status', filters.status)
      const ids = await fetchAllResultIds('/api/products/orders/ids', params)
      selection.setSelectedIds(ids)
    } catch {
      // Best effort — the button stays available for a retry.
    } finally {
      setLoadingAll(false)
    }
  }

  function statusLabel(value: string) {
    return isOrderStatus(value) ? t(STATUS_TRANSLATION_KEYS[value]) : value
  }

  function amountLabel(total: number, currency: string) {
    const normalizedCurrency = currency.toUpperCase()
    const currencyLabel = normalizedCurrency === 'IRR'
      ? t('rial')
      : normalizedCurrency === 'IRT' || normalizedCurrency === 'TMN'
        ? t('toman')
        : normalizedCurrency
    return new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 2 }).format(total) + ' ' + currencyLabel
  }

  function rowCheckbox(order: OrderRowData, compact?: boolean) {
    const checked = selection.isSelected(order.id)
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`${fa ? 'انتخاب سفارش' : 'Select order'} #${order.externalOrderId}`}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          selection.toggle(order.id, { shiftKey: event.shiftKey })
        }}
        className={cn(
          'grid shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]',
          compact ? 'h-11 w-11' : 'h-11 w-11',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'grid h-[1.15rem] w-[1.15rem] place-items-center rounded-[0.4rem] border transition-colors',
            checked
              ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]'
              : 'border-black/25 bg-white',
          )}
        >
          {checked && (
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
              <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <SelectionHeader
        locale={fa ? 'fa' : 'en'}
        triState={selection.triState}
        onToggleVisible={selection.toggleVisible}
        visibleCount={orders.length}
        entityLabel={fa ? 'سفارش' : 'order'}
      />
              <SelectionBar
          hidden={selection.selectedCount === 0}
          locale={fa ? 'fa' : 'en'}
          selectedCount={selection.selectedCount}
          visibleCount={orders.length}
          totalResults={totalResults}
          loadingAll={loadingAll}
          allResultsSelected={selection.selectedCount >= totalResults}
          onSelectAllResults={handleSelectAllResults}
          onClear={selection.clear}
        >
          <BulkDeleteButton
            countEndpoint="/api/products/orders/bulk"
            deleteEndpoint="/api/products/orders/bulk"
            restoreEndpoint="/api/products/orders/bulk/restore"
            entityLabel={fa ? 'سفارش' : 'order'}
            entitySingularLabel={fa ? 'سفارش' : 'order'}
            buttonLabel={fa
              ? `حذف ${selection.selectedCount.toLocaleString('fa-IR')} سفارش`
              : `Delete ${selection.selectedCount} orders`}
            dialogTitle={fa
              ? `حذف ${selection.selectedCount.toLocaleString('fa-IR')} سفارش؟`
              : `Delete ${selection.selectedCount} orders?`}
            countOverride={selection.selectedCount}
            deleteBody={{ ids: [...selection.selected] }}
            compactOnMobile
            onDeleted={selection.clear}
            onRestored={selection.clear}
          />
        </SelectionBar>

      {/* ── Desktop table ── */}
      <section className="spatial-surface hidden overflow-hidden rounded-[1.5rem] !bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead className="bg-[var(--bg-muted)] text-start text-xs text-[var(--text-secondary)]">
              <tr>
                <th scope="col" className="w-14 px-2 py-3 text-start font-medium">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selection.triState === 'all' ? true : selection.triState === 'partial' ? 'mixed' : false}
                    aria-label={fa ? 'انتخاب همه سفارش‌های این صفحه' : 'Select all orders on this page'}
                    onClick={selection.toggleVisible}
                    className="grid h-8 w-8 place-items-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid h-[1.05rem] w-[1.05rem] place-items-center rounded-[0.35rem] border text-[var(--bg-base)]',
                        selection.triState === 'none'
                          ? 'border-black/25 bg-white'
                          : 'border-[var(--text-primary)] bg-[var(--text-primary)]',
                      )}
                    >
                      {selection.triState === 'partial' && <span className="h-[3px] w-2 rounded-full bg-current" />}
                      {selection.triState === 'all' && (
                        <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" aria-hidden="true">
                          <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </button>
                </th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t('order')}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t('customer')}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t('status')}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t('shippingInfo')}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t('items')}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t('amount')}</th>
                <th scope="col" className="px-4 py-3 text-start font-medium">{t('date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={cn(
                    'align-top transition-colors hover:bg-[var(--bg-muted)]/60',
                    selection.isSelected(order.id) && 'bg-[var(--bg-muted)]/80',
                  )}
                >
                  <td className="px-2 py-4">{rowCheckbox(order)}</td>
                  <td className="px-4 py-4">
                    <p dir="ltr" className="text-start font-semibold text-[var(--text-primary)]">
                      #{order.externalOrderId}
                    </p>
                    <p dir="ltr" className="mt-1 max-w-44 truncate text-start text-xs text-[var(--text-muted)]">
                      {shortStoreUrl(order.storeUrl)}
                    </p>
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
                    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', statusClassName(order.status))}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="min-w-64 px-4 py-4">
                    {order.trackingCode || order.courierName || order.trackingLink ? (
                      <div className="space-y-2">
                        {order.trackingCode && (
                          <div>
                            <p className="text-xs text-[var(--text-muted)]">{t('tracking')}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span dir="ltr" className="break-all text-start font-mono text-xs font-semibold text-[var(--text-primary)]">
                                {order.trackingCode}
                              </span>
                              <CopyButton value={order.trackingCode} label={t('copyTracking')} copiedLabel={t('copied')} />
                            </div>
                          </div>
                        )}
                        {order.courierName && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            {t('courier')}: {friendlyCourierName(order.courierName, fa ? 'fa' : 'en')}
                          </p>
                        )}
                        {order.trackingLink && (
                          <a
                            href={order.trackingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-8 items-center text-xs font-semibold text-blue-600 hover:underline"
                          >
                            {t('trackingLink')}
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">—</span>
                    )}
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
                    {dateFormatter.format(order.orderDate ? new Date(order.orderDate) : new Date(order.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Mobile cards ── */}
      <div className="grid gap-3 md:hidden">
        {orders.map((order) => (
          <MobileOrderCard
            key={order.id}
            orderNumber={order.externalOrderId}
            customerName={order.customerName || t('unknownCustomer')}
            statusLabel={statusLabel(order.status)}
            statusClassName={statusClassName(order.status)}
            amountLabel={amountLabel(order.total, order.currency)}
            dateLabel={dateFormatter.format(order.orderDate ? new Date(order.orderDate) : new Date(order.createdAt))}
            amountTitle={t('amount')}
            dateTitle={t('date')}
            detailsLabel={t('details')}
            closeLabel={t('hideDetails')}
            leading={rowCheckbox(order)}
          >
            <dl className="grid grid-cols-2 gap-x-3 gap-y-4 rounded-[1.35rem] border border-[var(--border-default)] bg-white p-4 text-xs shadow-[var(--shadow-xs)]">
              <div className="col-span-2">
                <dt className="text-[var(--text-muted)]">{t('items')}</dt>
                <dd className="mt-1 text-sm leading-6 text-[var(--text-primary)]">
                  {order.itemsSummary || t('itemsCount', { count: order.itemCount })}
                </dd>
                {order.itemsSummary && (
                  <p className="mt-1 text-[var(--text-muted)]">{t('itemsCount', { count: order.itemCount })}</p>
                )}
              </div>

              {(order.customerPhone || order.customerEmail) && (
                <div className="col-span-2">
                  <dt className="text-[var(--text-muted)]">{t('customer')}</dt>
                  <dd dir="ltr" className="mt-1 truncate text-start font-medium text-[var(--text-primary)]">
                    {order.customerPhone ? displayPhone(order.customerPhone) : order.customerEmail}
                  </dd>
                </div>
              )}

              <div className="col-span-2">
                <dt className="text-[var(--text-muted)]">{t('store')}</dt>
                <dd dir="ltr" className="mt-1 truncate text-start font-medium text-[var(--text-primary)]">
                  {shortStoreUrl(order.storeUrl)}
                </dd>
              </div>

              {order.trackingCode && (
                <div className="col-span-2">
                  <dt className="text-[var(--text-muted)]">{t('tracking')}</dt>
                  <dd className="mt-1 flex items-center justify-between gap-2">
                    <span dir="ltr" className="min-w-0 truncate text-start font-medium text-[var(--text-primary)]">
                      {order.trackingCode}
                    </span>
                    <CopyButton value={order.trackingCode} label={t('copyTracking')} copiedLabel={t('copied')} />
                  </dd>
                </div>
              )}

              {(order.courierName || order.shippingDate || order.trackingLink || order.shippingNote) && (
                <div className="col-span-2 border-t border-[var(--border-subtle)] pt-4">
                  <dt className="font-semibold text-[var(--text-primary)]">{t('shippingInfo')}</dt>
                  <dd className="mt-2 space-y-2 text-sm leading-6 text-[var(--text-primary)]">
                    {order.courierName && <p><span className="text-[var(--text-muted)]">{t('courier')}: </span>{friendlyCourierName(order.courierName, fa ? 'fa' : 'en')}</p>}
                    {order.shippingDate && <p><span className="text-[var(--text-muted)]">{t('shippingDate')}: </span>{order.shippingDate}</p>}
                    {order.trackingLink && (
                      <p className="min-w-0">
                        <span className="text-[var(--text-muted)]">{t('trackingLink')}: </span>
                        <a href={order.trackingLink} target="_blank" rel="noopener noreferrer" dir="ltr" className="break-all font-medium text-blue-600 hover:underline">
                          {order.trackingLink}
                        </a>
                      </p>
                    )}
                    {order.shippingNote && <p><span className="text-[var(--text-muted)]">{t('shippingNote')}: </span>{order.shippingNote}</p>}
                  </dd>
                </div>
              )}
            </dl>
          </MobileOrderCard>
        ))}
      </div>
    </div>
  )
}
