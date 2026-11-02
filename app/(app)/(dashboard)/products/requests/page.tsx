import { channelLabel } from '@/components/crm/channel-badge'
import Link from 'next/link'
import { BellRing, ClipboardList, CreditCard, MessageSquareText, Phone, ShoppingBag } from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { orderRef } from '@/lib/commerce/order-ref'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { CommerceTabs } from '@/components/products/commerce-tabs'
import { ChatRequestAction } from '@/components/products/chat-request-action'
import { RequestDeleteButton } from '@/components/products/request-delete-button'
import { BulkDeleteMenu } from '@/components/ui/bulk-delete-menu'
import { displayPhone } from '@/lib/phone'
import { dateLocaleTag } from '@/lib/localized-date'
import { dashboardTitle } from '@/lib/dashboard/page-title'
import { loadCommerceAttention } from '@/lib/commerce/attention'
import { REQUEST_ACTION_STATUSES, REQUEST_CLOSED_STATUSES, REQUEST_LISTED_STATUSES, REQUEST_PAYING_STATUSES, isDeletableRequest } from '@/lib/commerce/request-states'

export const generateMetadata = dashboardTitle('درخواست‌های چت', 'Chat requests')

type DraftItem = { name?: string; variant?: string | null; quantity?: number }

function draftItems(value: unknown): DraftItem[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === 'object') as DraftItem[]) : []
}

/** Chip tone, label and the one line that says what happens next — per status. */
const STATE: Record<string, { tone: string; fa: string; en: string; hintFa: string; hintEn: string }> = {
  SUBMITTED: {
    tone: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
    fa: 'منتظر هماهنگی شما', en: 'Waiting for you',
    hintFa: 'مشتری سفارش را در گفتگو تأیید کرده. برای پرداخت و ارسال با او هماهنگ کنید و بعد «انجام شد» را بزنید.',
    hintEn: 'The customer confirmed this order in the chat. Arrange payment and delivery with them, then mark it done.',
  },
  PAYMENT_REVIEW: {
    tone: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    fa: 'بررسی پرداخت', en: 'Payment review',
    hintFa: 'مشتری می‌گوید کارت‌به‌کارت کرده ولی پیامک بانک نرسیده. در «درگاه پرداخت» تأیید یا ردش کنید.',
    hintEn: 'The customer says they transferred, but no bank SMS arrived. Confirm or reject it in the payment gateway.',
  },
  AWAITING_TRANSFER: {
    tone: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    fa: 'منتظر کارت‌به‌کارت', en: 'Waiting for the transfer',
    hintFa: 'کارت و مبلغ دقیق برای مشتری رفته؛ با رسیدن پیامک واریز، خودکار تأیید می‌شود و به «سفارش‌ها» می‌رود.',
    hintEn: 'The card and exact amount went to the customer; the bank SMS confirms it and it moves to Orders.',
  },
  LINK_SENT: {
    tone: 'bg-black/[0.05] text-[var(--text-secondary)]',
    fa: 'لینک پرداخت فرستاده شد', en: 'Payment link sent',
    hintFa: 'لینک پرداخت سایت برای مشتری فرستاده شده و هنوز پرداختی نشده.',
    hintEn: 'The store’s payment link was sent; nothing is paid yet.',
  },
  PAYMENT_PENDING: {
    tone: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    fa: 'روی صفحهٔ پرداخت', en: 'On the payment page',
    hintFa: 'مشتری لینک را باز کرده و سفارش روی سایت ساخته شده؛ منتظر پرداخت اوست.',
    hintEn: 'The customer opened the link and the order exists on the store; waiting for the payment.',
  },
  ON_HOLD: {
    tone: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    fa: 'منتظر تأیید پرداخت', en: 'Awaiting payment check',
    hintFa: 'سفارش روی سایت «در انتظار بررسی» است؛ پرداختش را در پنل فروشگاه نگاه کنید.',
    hintEn: 'The store order is on hold; check its payment in the store panel.',
  },
  CONFIRMED: {
    tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    fa: 'انجام شد', en: 'Done',
    hintFa: 'هماهنگی‌اش را انجام دادید.', hintEn: 'You took care of it.',
  },
  CANCELLED: {
    tone: 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
    fa: 'لغو شد', en: 'Cancelled',
    hintFa: 'این پیش‌سفارش لغو شد.', hintEn: 'This pre-order was cancelled.',
  },
  EXPIRED: {
    tone: 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
    fa: 'منقضی', en: 'Expired',
    hintFa: 'مهلت پرداخت تمام شد و مشتری پرداخت نکرد.', hintEn: 'The time to pay ran out without a payment.',
  },
  PAYMENT_FAILED: {
    tone: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
    fa: 'پرداخت ناموفق', en: 'Payment failed',
    hintFa: 'پرداخت روی سایت ناموفق بود.', hintEn: 'The payment on the store failed.',
  },
  REFUNDED: {
    tone: 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
    fa: 'برگشت داده شد', en: 'Refunded',
    hintFa: 'مبلغ به مشتری برگشت داده شد.', hintEn: 'The money went back to the customer.',
  },
}

const FILTERS = ['all', 'action', 'paying', 'closed'] as const
type Filter = (typeof FILTERS)[number]

const FILTER_STATUSES: Record<Filter, readonly string[]> = {
  all: REQUEST_LISTED_STATUSES,
  action: REQUEST_ACTION_STATUSES,
  paying: REQUEST_PAYING_STATUSES,
  closed: REQUEST_CLOSED_STATUSES,
}

/**
 * «درخواست‌ها»: chat pre-orders, by what they wait for (the owner first),
 * and the back-in-stock waiting list grouped by product. A paid pre-order is
 * an order now and lives on «سفارش‌ها».
 */
export default async function ChatRequestsPage(props: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await props.searchParams
  const filter: Filter = (FILTERS as readonly string[]).includes(f ?? '') ? (f as Filter) : 'all'
  const user = await requireUser()
  const productsT = await getTranslations('products')
  const locale = await getLocale()
  const isEn = locale === 'en'
  const fa = !isEn
  const numberLocale = isEn ? 'en-US' : 'fa-IR'
  const num = (value: number) => value.toLocaleString(numberLocale)
  const dateFormatter = new Intl.DateTimeFormat(dateLocaleTag(isEn ? 'en' : 'fa'), { dateStyle: 'medium', timeStyle: 'short' })
  const base = { workspaceId: user.workspaceId, submittedAt: { not: null } }

  const [drafts, counts, alerts, attention] = await Promise.all([
    prisma.orderDraft.findMany({
      where: { ...base, status: { in: [...FILTER_STATUSES[filter]] } },
      orderBy: { submittedAt: 'desc' },
      take: 80,
    }),
    prisma.orderDraft.groupBy({ by: ['status'], where: { ...base, status: { in: [...REQUEST_LISTED_STATUSES] } }, _count: true }),
    prisma.restockAlert.findMany({
      where: { workspaceId: user.workspaceId, status: { in: ['ACTIVE', 'NEEDS_FOLLOW_UP', 'SENDING'] } },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { conversation: { select: { contact: { select: { name: true, phone: true } } } } },
    }),
    loadCommerceAttention(user.workspaceId),
  ])

  const countOf = (statuses: readonly string[]) => counts.reduce((sum, row) => sum + (statuses.includes(row.status) ? row._count : 0), 0)
  const filterCounts: Record<Filter, number> = {
    all: countOf(REQUEST_LISTED_STATUSES),
    action: countOf(REQUEST_ACTION_STATUSES),
    paying: countOf(REQUEST_PAYING_STATUSES),
    closed: countOf(REQUEST_CLOSED_STATUSES),
  }
  // The owner's to-do first, then what waits on the customer, then the rest; newest first inside each.
  const rank = (status: string) => (REQUEST_ACTION_STATUSES as readonly string[]).includes(status) || status === 'PAYMENT_REVIEW' ? 0 : (REQUEST_PAYING_STATUSES as readonly string[]).includes(status) ? 1 : 2
  const listed = [...drafts].sort((a, b) => rank(a.status) - rank(b.status))

  const byProduct = new Map<string, { name: string; alerts: typeof alerts }>()
  for (const alert of alerts) {
    const key = `${alert.productId}:${alert.variationId ?? ''}`
    const label = alert.variantLabel ? `${alert.productName} — ${alert.variantLabel}` : alert.productName
    const entry = byProduct.get(key) ?? { name: label, alerts: [] }
    entry.alerts.push(alert)
    byProduct.set(key, entry)
  }
  const groups = [...byProduct.values()].sort((left, right) => right.alerts.length - left.alerts.length)
  const actionError = fa ? 'انجام نشد؛ دوباره تلاش کنید.' : 'That didn’t work; please try again.'

  const filterLabel: Record<Filter, string> = {
    all: fa ? 'همه' : 'All',
    action: fa ? 'منتظر شما' : 'For you',
    paying: fa ? 'منتظر پرداخت' : 'Paying',
    closed: fa ? 'بسته‌شده' : 'Closed',
  }
  const emptyText: Record<Filter, string> = {
    all: fa ? 'هنوز پیش‌سفارشی از چت ثبت نشده. وقتی ایجنت سفارشی را در گفتگو کامل کند و مشتری تأییدش کند، این‌جا می‌آید. «گرفتن سفارش در چت» را در تنظیمات ایجنت روشن کنید.' : 'No pre-orders from chat yet. When the agent completes an order in a chat and the customer confirms it, it lands here. Turn on “Take orders in chat” in the agent settings.',
    action: fa ? 'پیش‌سفارشی منتظر شما نیست.' : 'No pre-order is waiting for you.',
    paying: fa ? 'پیش‌سفارشی منتظر پرداخت مشتری نیست.' : 'No pre-order is waiting for a payment.',
    closed: fa ? 'پیش‌سفارش بسته‌شده‌ای نیست.' : 'No closed pre-orders.',
  }

  return (
    <div className="mx-auto max-w-none space-y-6">
      <PageHeader
        icon={MessageSquareText}
        title={fa ? 'درخواست‌های چت' : 'Chat requests'}
        subtitle={fa
          ? 'پیش‌سفارش‌هایی که مشتری در گفتگو تأیید کرده و هنوز پرداخت نشده‌اند، و مشتری‌هایی که منتظر موجود شدن محصول‌اند. سفارش‌های پرداخت‌شده در «سفارش‌ها» هستند.'
          : 'Pre-orders customers confirmed in chat that are not paid yet, and customers waiting for a product to be back in stock. Paid orders are under Orders.'}
        actions={filterCounts.closed > 0 ? (
          <BulkDeleteMenu
            endpoint="/api/products/requests/bulk"
            undoKind="request"
            entityLabel={fa ? 'پیش‌سفارش' : 'pre-orders'}
            compactOnMobile
            options={[
              { scope: 'closed', label: fa ? 'حذف لغوشده‌ها و منقضی‌ها' : 'Delete cancelled and expired', hint: fa ? 'لغوشده، منقضی، پرداخت ناموفق یا برگشتی' : 'Cancelled, expired, failed or refunded' },
              { scope: 'done', label: fa ? 'حذف انجام‌شده‌ها' : 'Delete done ones', hint: fa ? 'هماهنگی‌شان تمام شده' : 'Already taken care of' },
              { scope: 'older_90d', label: fa ? 'حذف قدیمی‌تر از سه ماه' : 'Delete older than 3 months', hint: fa ? 'بسته‌شده‌هایی که بیش از ۹۰ روز پیش ثبت شده‌اند' : 'Closed ones filed more than 90 days ago' },
              { scope: 'all', label: fa ? 'حذف همهٔ بسته‌شده‌ها' : 'Delete every closed one', hint: fa ? 'پیش‌سفارش‌های باز و منتظر پرداخت می‌مانند' : 'Open and paying ones stay' },
            ]}
            extraWarning={fa ? 'پیش‌سفارش‌های باز (منتظر شما یا منتظر پرداخت) حذف نمی‌شوند؛ گفتگوها دست نمی‌خورند' : 'Open pre-orders (for you or paying) are kept; conversations are not touched'}
          />
        ) : undefined}
      />

      <CommerceTabs
        active="requests"
        productsLabel={productsT('title')}
        ordersLabel={productsT('orders.title')}
        requestsLabel={productsT('orders.requestsTab')}
        attention={attention}
        locale={locale}
      />

      <section className="spatial-surface overflow-hidden rounded-card !bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
            <ClipboardList className="h-4 w-4" aria-hidden /> {fa ? 'پیش‌سفارش‌های چت' : 'Chat pre-orders'}
          </h2>
          <Link href="/products/orders" className="inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <ShoppingBag className="size-4" aria-hidden />
            {fa ? 'پرداخت‌شده‌ها در «سفارش‌ها»' : 'Paid ones are under Orders'}
          </Link>
        </div>
        {filterCounts.all > 0 ? (
          <nav aria-label={fa ? 'فیلتر پیش‌سفارش‌ها' : 'Filter pre-orders'} className="flex gap-1.5 px-4 pb-3 sm:px-5">
            {FILTERS.map((key) => {
              const active = filter === key
              const count = filterCounts[key]
              return (
                <Link
                  key={key}
                  href={key === 'all' ? '/products/requests' : `/products/requests?f=${key}`}
                  scroll={false}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-9 min-w-0 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 text-[12.5px] font-medium transition-colors sm:min-h-8 sm:flex-none sm:gap-1.5 sm:px-3',
                    active ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]',
                  )}
                >
                  {filterLabel[key]}
                  {key === 'action' && count > 0 ? (
                    <span className={cn('rounded-full px-1.5 text-[11px] leading-5 tabular-nums', active ? 'bg-white/20' : 'bg-red-600 text-white')}>{num(count)}</span>
                  ) : key !== 'all' && count > 0 ? (
                    <span className="text-[11px] tabular-nums opacity-70">{num(count)}</span>
                  ) : null}
                </Link>
              )
            })}
          </nav>
        ) : null}

        {listed.length === 0 ? (
          <p className="border-t border-[var(--border-subtle)] px-4 py-8 text-center text-[13px] leading-7 text-[var(--text-secondary)] sm:px-5">{emptyText[filter]}</p>
        ) : (
          <ul className="grid gap-3 border-t border-[var(--border-subtle)] p-3 sm:p-4">
            {listed.map((draft) => {
              const state = STATE[draft.status] ?? STATE.CANCELLED
              const items = draftItems(draft.items)
              const amount = draft.grandTotal ?? draft.total
              const ref = `#${orderRef(draft)}`
              const waiting = draft.status === 'SUBMITTED' || draft.status === 'PAYMENT_REVIEW'
              const address = [draft.province, draft.city, draft.address].filter(Boolean).join(isEn ? ', ' : '، ')
              return (
                <li key={draft.id} className={cn('rounded-2xl border bg-white p-3.5 dark:bg-neutral-900 sm:p-4', waiting ? 'border-amber-300 shadow-[0_10px_30px_-24px_rgba(217,119,6,.8)]' : 'border-[var(--border-subtle)]')}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span dir="ltr" className="font-mono text-sm font-bold text-[var(--text-primary)]">{ref}</span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', state.tone)}>{fa ? state.fa : state.en}</span>
                    <time className="ms-auto text-xs tabular-nums text-[var(--text-muted)]">{dateFormatter.format(draft.submittedAt ?? draft.createdAt)}</time>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-6 text-[var(--text-secondary)]">{fa ? state.hintFa : state.hintEn}</p>

                  <dl className="mt-3 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-xs text-[var(--text-muted)]">{fa ? 'اقلام' : 'Items'}</dt>
                      <dd className="mt-1 grid gap-1 text-[var(--text-primary)]">
                        {items.length ? items.map((item, index) => (
                          <p key={index} className="flex items-start gap-2 leading-6">
                            <span className="mt-0.5 grid h-5 min-w-6 shrink-0 place-items-center rounded-md bg-[var(--bg-muted)] px-1 text-[11.5px] font-bold tabular-nums text-[var(--text-secondary)]">{num(item.quantity ?? 1)}×</span>
                            <span className="min-w-0 break-words">{item.name ?? '—'}{item.variant ? <span className="text-[var(--text-muted)]"> · {item.variant}</span> : null}</span>
                          </p>
                        )) : <p className="text-[var(--text-muted)]">—</p>}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-[var(--text-muted)]">{fa ? 'مشتری' : 'Customer'}</dt>
                      <dd className="mt-1 text-[var(--text-primary)]">
                        <span className="block font-medium">{draft.customerName ?? (fa ? 'بی‌نام' : 'No name')}</span>
                        {draft.customerPhone ? (
                          <a href={`tel:${draft.customerPhone}`} dir="ltr" className="mt-0.5 inline-flex min-h-8 items-center gap-1.5 text-[13px] tabular-nums text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                            <Phone className="size-3.5" aria-hidden />{displayPhone(draft.customerPhone)}
                          </a>
                        ) : null}
                      </dd>
                    </div>
                    {address || draft.postalCode ? (
                      <div className="min-w-0 sm:col-span-2">
                        <dt className="text-xs text-[var(--text-muted)]">{fa ? 'آدرس' : 'Address'}</dt>
                        <dd className="mt-1 break-words leading-6 text-[var(--text-primary)]">
                          {address}{draft.postalCode ? `${address ? ' · ' : ''}${fa ? 'کد پستی ' : 'Postcode '}${draft.postalCode}` : ''}
                        </dd>
                      </div>
                    ) : null}
                    {amount != null ? (
                      <div>
                        <dt className="text-xs text-[var(--text-muted)]">{fa ? 'مبلغ' : 'Amount'}</dt>
                        <dd className="mt-1 font-bold tabular-nums text-[var(--text-primary)]">{num(Math.round(amount))} <span className="text-xs font-normal text-[var(--text-muted)]">{fa ? 'تومان' : 'Toman'}</span></dd>
                      </div>
                    ) : null}
                    {draft.checkoutMode === 'PAY_LINK' && (draft.externalOrderNumber || draft.paymentMethodTitle) ? (
                      <div>
                        <dt className="text-xs text-[var(--text-muted)]">{fa ? 'سفارش سایت' : 'Store order'}</dt>
                        <dd className="mt-1 leading-6 text-[var(--text-primary)]">
                          {draft.externalOrderNumber ? <span dir="ltr" className="font-mono">#{draft.externalOrderNumber}</span> : '—'}
                          {draft.paymentMethodTitle ? ` · ${draft.paymentMethodTitle}` : ''}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
                    {draft.status === 'SUBMITTED' ? (
                      <>
                        <ChatRequestAction endpoint={`/api/commerce/order-drafts/${draft.id}`} status="CONFIRMED" label={fa ? 'انجام شد' : 'Mark done'} errorLabel={actionError} tone="primary" />
                        <ChatRequestAction endpoint={`/api/commerce/order-drafts/${draft.id}`} status="CANCELLED" label={fa ? 'لغو سفارش' : 'Cancel order'} errorLabel={actionError} />
                      </>
                    ) : null}
                    {draft.status === 'PAYMENT_REVIEW' ? (
                      <Link href="/payments" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-black px-3 text-xs font-semibold text-white hover:bg-black/85">
                        <CreditCard className="size-3.5" aria-hidden />{fa ? 'بررسی در درگاه پرداخت' : 'Review in the gateway'}
                      </Link>
                    ) : null}
                    <Link
                      href={`/conversations/${draft.conversationId}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                    >
                      <MessageSquareText className="size-3.5" aria-hidden />{fa ? 'گفتگو' : 'Conversation'}
                    </Link>
                    {isDeletableRequest(draft.status) ? (
                      <span className="ms-auto">
                        <RequestDeleteButton draftId={draft.id} label={ref} fa={fa} />
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="spatial-surface rounded-card !bg-white p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
          <BellRing className="h-4 w-4" aria-hidden /> {fa ? 'منتظران موجودی' : 'Back-in-stock waiting list'}
        </h2>
        <p className="mt-1 text-[12.5px] leading-6 text-[var(--text-secondary)]">
          {fa
            ? 'وقتی محصول موجود شود ایجنت خودش به این مشتری‌ها خبر می‌دهد. «پیگیری دستی» یعنی پیام خودکار نرسید و باید خودتان تماس بگیرید.'
            : 'When the product is back the agent tells these customers itself. «Manual follow-up» means the automatic message could not reach them; contact them yourself.'}
        </p>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{fa ? 'فعلاً کسی منتظر موجود شدن محصولی نیست.' : 'Nobody is waiting for a product right now.'}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {groups.map((group) => {
              const followUp = group.alerts.filter((alert) => alert.status === 'NEEDS_FOLLOW_UP').length
              return (
                <li key={group.name} className="rounded-2xl border border-[var(--border-subtle)] p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">{group.name}</span>
                    <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]">
                      {fa ? `${num(group.alerts.length)} نفر منتظر` : `${group.alerts.length} waiting`}
                    </span>
                    {followUp > 0 && (
                      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                        {fa ? `${num(followUp)} پیگیری دستی` : `${followUp} manual follow-up`}
                      </span>
                    )}
                  </div>
                  <ul className="mt-3 divide-y divide-[var(--border-subtle)] text-sm">
                    {group.alerts.map((alert) => (
                      <li key={alert.id} className="flex flex-wrap items-center gap-2 py-2">
                        <span className="text-[var(--text-primary)]">{alert.conversation.contact?.name ?? (fa ? 'بی‌نام' : 'No name')}</span>
                        {alert.conversation.contact?.phone && (
                          <a href={`tel:${alert.conversation.contact.phone}`} dir="ltr" className="text-xs tabular-nums text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{displayPhone(alert.conversation.contact.phone)}</a>
                        )}
                        <span className="text-xs text-[var(--text-muted)]">{channelLabel(alert.channel, locale)}</span>
                        <span className={cn('text-xs', alert.status === 'NEEDS_FOLLOW_UP' ? 'font-semibold text-red-700 dark:text-red-300' : 'text-[var(--text-muted)]')}>
                          · {alert.status === 'NEEDS_FOLLOW_UP' ? (fa ? 'پیگیری دستی' : 'Manual follow-up') : alert.status === 'SENDING' ? (fa ? 'در حال خبر دادن' : 'Being told') : (fa ? 'منتظر' : 'Waiting')}
                        </span>
                        <span className="ms-auto flex items-center gap-2">
                          <Link href={`/conversations/${alert.conversationId}`} className="ui-link">
                            {fa ? 'گفتگو' : 'Conversation'}
                          </Link>
                          {alert.status === 'NEEDS_FOLLOW_UP' && (
                            <ChatRequestAction endpoint={`/api/commerce/restock-alerts/${alert.id}`} status="NOTIFIED" label={fa ? 'خبر دادم' : 'I told them'} errorLabel={actionError} tone="primary" />
                          )}
                          <ChatRequestAction endpoint={`/api/commerce/restock-alerts/${alert.id}`} status="CANCELLED" label={fa ? 'حذف از فهرست' : 'Remove'} errorLabel={actionError} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
