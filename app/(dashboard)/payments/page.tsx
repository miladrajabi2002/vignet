import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { Bot, MessageSquareText, PackageCheck, PackageX, TrendingUp, WalletCards, Zap } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { dateLocaleTag } from '@/lib/localized-date'
import { StatusChip, type ChipTone } from '@/components/ui/status-chip'
import { BankMark } from '@/components/payments/bank-card'
import { PaymentsShell } from '@/components/payments/payments-shell'
import { PaymentActions, PaymentRowMenu, UnmatchedSmsActions } from '@/components/payments/payment-actions'
import { NewPaymentButton } from '@/components/payments/new-link-form'
import { Sparkline } from '@/components/admin/sparkline'
import { loadGatewayOverview, NOT_TEST } from '@/lib/payments/card/dashboard'
import { suggestPaymentsForSms } from '@/lib/payments/card/ingest'
import { payPageUrl } from '@/lib/payments/card/service'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { tone: ChipTone; fa: string; en: string }> = {
  PENDING: { tone: 'warn', fa: 'در انتظار واریز', en: 'Waiting for transfer' },
  CLAIMED: { tone: 'danger', fa: 'نیاز به بررسی شما', en: 'Needs your review' },
  PAID: { tone: 'ok', fa: 'پرداخت‌شده', en: 'Paid' },
  EXPIRED: { tone: 'neutral', fa: 'منقضی', en: 'Expired' },
  FAILED: { tone: 'danger', fa: 'رد شد', en: 'Rejected' },
  CANCELLED: { tone: 'neutral', fa: 'لغو شد', en: 'Cancelled' },
}
const SOURCE: Record<string, [string, string]> = { CHAT: ['سفارش در گفتگو', 'Chat order'], API: ['سایت', 'Site'], LINK: ['لینک پرداخت', 'Payment link'] }

const TREND_DAYS = 7
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' })

/** The last seven Tehran days, oldest first, each with what `pick` adds up from the paid payments. */
function dailySeries<T extends { paidAt: Date | null }>(rows: T[], pick: (row: T) => number): number[] {
  const now = Date.now()
  const keys = Array.from({ length: TREND_DAYS }, (_, index) => DAY_KEY.format(new Date(now - (TREND_DAYS - 1 - index) * 86_400_000)))
  const sums = new Map(keys.map((key) => [key, 0]))
  for (const row of rows) {
    if (!row.paidAt) continue
    const key = DAY_KEY.format(row.paidAt)
    if (sums.has(key)) sums.set(key, (sums.get(key) ?? 0) + pick(row))
  }
  return keys.map((key) => sums.get(key) ?? 0)
}

export default async function PaymentsPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const fa = locale === 'fa'
  const numbers = fa ? 'fa-IR' : 'en-US'
  const money = (value: number) => `${value.toLocaleString(numbers)} ${fa ? 'تومان' : 'Toman'}`
  const time = new Intl.DateTimeFormat(dateLocaleTag(locale), { dateStyle: 'medium', timeStyle: 'short' })
  const dayStart = new Date(Date.now() - 24 * 3_600_000)
  const weekStart = new Date(Date.now() - TREND_DAYS * 86_400_000)

  const overview = await loadGatewayOverview(user.workspaceId)
  // Until the gateway is set up once, the page is the setup and nothing else.
  if (!overview.activated) return <PaymentsShell active="payments" overview={overview} locale={locale} />

  const [payments, unmatched, paidToday, autoCount, paidCount, paidWeek] = await Promise.all([
    prisma.cardPayment.findMany({
      // The setup's own test transfers are never listed or counted.
      where: { workspaceId: user.workspaceId, ...NOT_TEST },
      orderBy: [{ createdAt: 'desc' }],
      take: 60,
      include: { card: { select: { bankKey: true, last4: true } }, site: { select: { name: true } } },
    }),
    prisma.bankSms.findMany({ where: { workspaceId: user.workspaceId, status: 'UNMATCHED' }, orderBy: { receivedAt: 'desc' }, take: 10 }),
    prisma.cardPayment.aggregate({ where: { workspaceId: user.workspaceId, status: 'PAID', paidAt: { gte: dayStart }, ...NOT_TEST }, _sum: { baseAmount: true }, _count: true }),
    prisma.cardPayment.count({ where: { workspaceId: user.workspaceId, status: 'PAID', confirmedBy: 'AUTO', ...NOT_TEST } }),
    prisma.cardPayment.count({ where: { workspaceId: user.workspaceId, status: 'PAID', ...NOT_TEST } }),
    prisma.cardPayment.findMany({ where: { workspaceId: user.workspaceId, status: 'PAID', paidAt: { gte: weekStart }, ...NOT_TEST }, select: { paidAt: true, baseAmount: true, confirmedBy: true } }),
  ])
  const suggestions = await Promise.all(unmatched.map((sms) => suggestPaymentsForSms(user.workspaceId, sms.amount)))
  // Chat orders paid by card: whether they reached the WooCommerce store.
  const draftIds = payments.flatMap((payment) => (payment.status === 'PAID' && payment.orderDraftId ? [payment.orderDraftId] : []))
  const storeOrders = new Map(
    (draftIds.length
      ? await prisma.orderDraft.findMany({ where: { id: { in: draftIds }, checkoutMode: 'CARD_TRANSFER' }, select: { id: true, externalOrderNumber: true, storeSyncAt: true, storeSyncError: true } })
      : []
    ).map((draft) => [draft.id, draft]),
  )
  const review = payments.filter((payment) => payment.status === 'CLAIMED')
  const rest = payments.filter((payment) => payment.status !== 'CLAIMED')
  const hasCard = overview.cards.some((card) => card.active)
  const cap = overview.usage.cap
  const dayLabels = Array.from({ length: TREND_DAYS }, (_, index) => {
    const ago = TREND_DAYS - 1 - index
    return ago === 0 ? (fa ? 'امروز' : 'Today') : fa ? `${ago.toLocaleString('fa-IR')} روز پیش` : `${ago}d ago`
  })
  const tiles = [
    {
      label: fa ? 'دریافتی ۲۴ ساعت اخیر' : 'Received in 24 hours', icon: TrendingUp, tint: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', stroke: '#059669',
      value: (paidToday._sum.baseAmount ?? 0).toLocaleString(numbers), unit: fa ? 'تومان' : 'Toman',
      hint: paidToday._count ? (fa ? `${paidToday._count.toLocaleString(numbers)} پرداخت` : `${paidToday._count} payments`) : (fa ? 'هنوز پرداختی نیامده' : 'No payment yet'),
      // Rials, so the hover chip reads tomans.
      series: dailySeries(paidWeek, (row) => row.baseAmount * 10), format: 'irr' as const, bar: null,
    },
    {
      label: fa ? 'تأیید خودکار' : 'Confirmed automatically', icon: Zap, tint: 'bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]', stroke: '#5b3de8',
      value: (paidCount ? Math.round((autoCount / paidCount) * 100) : 0).toLocaleString(numbers), unit: fa ? '٪' : '%',
      hint: paidCount ? (fa ? `${autoCount.toLocaleString(numbers)} از ${paidCount.toLocaleString(numbers)} بدون شما` : `${autoCount} of ${paidCount} without you`) : (fa ? 'بعد از اولین پرداخت' : 'After the first payment'),
      series: dailySeries(paidWeek, (row) => (row.confirmedBy === 'AUTO' ? 1 : 0)), format: 'number' as const, bar: null,
    },
    {
      label: fa ? 'پرداخت این ماه' : 'Payments this month', icon: WalletCards, tint: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', stroke: '#d97706',
      value: overview.usage.used.toLocaleString(numbers), unit: cap == null ? '' : (fa ? `از ${cap.toLocaleString(numbers)}` : `of ${cap}`),
      hint: cap == null ? (fa ? 'بدون سقف در پلن شما' : 'No limit on your plan') : (fa ? 'سقف پلن شما' : 'Your plan’s limit'),
      series: dailySeries(paidWeek, () => 1), format: 'number' as const, bar: cap ? Math.min(100, Math.round((overview.usage.used / cap) * 100)) : null,
    },
  ]
  const locked = !overview.platformEnabled ? 'platform' as const : !hasCard ? 'card' as const : null

  return (
    <PaymentsShell active="payments" overview={overview} locale={locale} action={<NewPaymentButton locked={locked} />}>
      {/* Three tiles side by side on every width, each with its last seven days. */}
      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <div key={tile.label} className="spatial-surface flex min-w-0 flex-col rounded-card p-3 shadow-[0_1px_2px_rgba(17,17,17,.04),0_10px_28px_-14px_rgba(17,17,17,.16)] sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11.5px] leading-5 text-[var(--text-muted)] sm:text-[13px]">{tile.label}</p>
                <span className={cn('hidden size-8 shrink-0 place-items-center rounded-xl sm:grid', tile.tint)}><Icon className="size-4" aria-hidden /></span>
              </div>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-1 sm:mt-2">
                <span className="text-[18px] font-extrabold tabular-nums leading-7 text-[var(--text-primary)] sm:text-[26px] sm:leading-9">{tile.value}</span>
                {tile.unit ? <span className="text-[11px] text-[var(--text-muted)] sm:text-[12.5px]">{tile.unit}</span> : null}
              </p>
              {tile.bar != null ? (
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]"><span className="block h-full rounded-full bg-[#5b3de8]" style={{ width: `${tile.bar}%` }} /></span>
              ) : null}
              <p className="mt-1 text-[10.5px] leading-5 text-[var(--text-muted)] sm:text-xs">{tile.hint}</p>
              <div className="-mx-1 mt-auto h-8 pt-1.5 sm:h-10" title={fa ? 'روند ۷ روز اخیر' : 'Last 7 days'}>
                <Sparkline data={tile.series} color={tile.stroke} height={30} fluid labels={dayLabels} valueFormat={tile.format} />
              </div>
            </div>
          )
        })}
      </section>

      {overview.usage.reached && (
        <p role="status" className="rounded-card border border-amber-200 bg-amber-50 p-3.5 text-sm leading-7 text-amber-900">
          {fa ? 'سقف پرداخت‌های این ماهِ پلن شما پر شده؛ تا ماه بعد یا ارتقای پلن، سفارش‌های تازه به اپراتور سپرده می‌شوند.' : 'This month’s payment limit of your plan is reached; until next month or an upgrade, new orders go to your operator.'}{' '}
          <Link href="/billing" className="ui-link">{fa ? 'دیدن پلن‌ها' : 'See plans'}</Link>
        </p>
      )}

      {(review.length > 0 || unmatched.length > 0) && (
        <section className="rounded-card border border-red-200 bg-red-50/70 p-4 sm:p-5 dark:border-red-900/50 dark:bg-red-950/20">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-red-800 dark:text-red-200">
            {fa ? 'منتظر تصمیم شما' : 'Waiting for your decision'}
            <span className="rounded-full bg-red-600 px-2 text-[12px] leading-5 text-white tabular-nums">{(review.length + unmatched.length).toLocaleString(numbers)}</span>
          </h2>
          <ul className="mt-3 grid gap-2.5">
            {review.map((payment) => (
              <li key={payment.id} className="rounded-2xl border border-red-200 bg-white p-3.5 dark:border-red-900/50 dark:bg-neutral-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span dir="ltr" className="font-mono text-sm font-bold">#{payment.reference}</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{money(payment.payAmount)}</span>
                  <span className="ms-auto text-xs text-[var(--text-muted)]">{time.format(payment.claimedAt ?? payment.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                  {fa ? `${payment.customerName ?? 'مشتری'} می‌گوید این مبلغ را واریز کرده ولی پیامک واریز به ویجنت نرسیده. حساب بانکی را نگاه کنید.` : `${payment.customerName ?? 'The customer'} says this amount was transferred, but no deposit SMS reached Vigent. Check your bank account.`}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <PaymentActions paymentId={payment.id} mode="review" />
                  {payment.conversationId && <Link href={`/conversations/${payment.conversationId}`} className="ui-link inline-flex items-center gap-1 text-[13px]"><MessageSquareText className="size-4" aria-hidden />{fa ? 'دیدن گفتگو' : 'Open conversation'}</Link>}
                </div>
              </li>
            ))}
            {unmatched.map((sms, index) => (
              <li key={sms.id} className="rounded-2xl border border-red-200 bg-white p-3.5 dark:border-red-900/50 dark:bg-neutral-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'واریز بدون سفارش' : 'Deposit with no order'}</span>
                  {sms.amount != null && <span className="text-sm font-bold">{money(sms.amount)}</span>}
                  <span className="ms-auto text-xs text-[var(--text-muted)]">{time.format(sms.receivedAt)}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">{fa ? 'این مبلغ با هیچ پرداخت بازی دقیقاً برابر نیست؛ احتمالاً مشتری مبلغ را رُند واریز کرده.' : 'This amount equals no open payment exactly; the customer probably rounded it.'}</p>
                <pre dir="rtl" className="mt-2 whitespace-pre-wrap rounded-xl bg-[var(--bg-surface)] p-2.5 text-xs leading-6 text-[var(--text-secondary)]">{sms.text}</pre>
                <div className="mt-3">
                  <UnmatchedSmsActions smsId={sms.id} suggestions={suggestions[index].slice(0, 3).map((payment) => ({ id: payment.id, label: `#${payment.reference} · ${money(payment.baseAmount)}` }))} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="spatial-surface overflow-hidden rounded-card shadow-[0_1px_2px_rgba(17,17,17,.04),0_10px_28px_-14px_rgba(17,17,17,.16)]">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'پرداخت‌ها' : 'Payments'}</h2>
          {rest.length ? <span className="text-[12.5px] tabular-nums text-[var(--text-muted)]">{fa ? `${rest.length.toLocaleString(numbers)} پرداخت آخر` : `Last ${rest.length}`}</span> : null}
        </div>
        {rest.length === 0 ? (
          <div className="grid justify-items-center gap-1.5 px-3 pb-8 pt-5 text-center">
            <span className="mb-1 grid size-14 place-items-center rounded-2xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><WalletCards className="size-6" aria-hidden /></span>
            <p className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'هنوز پرداختی نیامده' : 'No payments yet'}</p>
            <p className="max-w-md text-[13px] leading-7 text-[var(--text-secondary)]">{fa ? 'اولین سفارشی که در گفتگو تأیید شود، یا اولین پرداختی که با دکمهٔ «پرداخت تازه» بسازید، این‌جا می‌آید.' : 'The first order confirmed in a conversation, or the first payment you make with «New payment», appears here.'}</p>
            <Link href="/payments/settings" className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border-default)] px-4 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)]"><Bot className="size-4" aria-hidden />{fa ? 'روش پرداخت ایجنت‌ها' : 'How agents take payment'}</Link>
          </div>
        ) : (
          <>
            {/* Column heads, desktop only: every row below keeps these columns. */}
            <div aria-hidden className="hidden grid-cols-[2.25rem_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-4 border-y border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-2 text-[12px] font-medium text-[var(--text-muted)] md:grid">
              <span />
              <span>{fa ? 'پرداخت' : 'Payment'}</span>
              <span>{fa ? 'مبلغ' : 'Amount'}</span>
              <span>{fa ? 'وضعیت' : 'Status'}</span>
              <span />
            </div>
            <ul className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)] md:border-t-0">
              {rest.map((payment) => {
                const status = STATUS[payment.status] ?? STATUS.CANCELLED
                const subject = payment.purpose === 'BOOKING' ? (fa ? 'بیعانهٔ نوبت' : 'Booking deposit') : payment.purpose === 'COURSE' ? (fa ? 'ثبت‌نام دوره' : 'Course seat') : (SOURCE[payment.source] ?? SOURCE.LINK)[fa ? 0 : 1]
                const pending = payment.status === 'PENDING'
                return (
                  <li key={payment.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--bg-surface)] sm:px-5 md:grid-cols-[2.25rem_minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_2.25rem] md:gap-x-4">
                    <span className="row-span-2 md:row-span-1"><BankMark bankKey={payment.card.bankKey} size={36} /></span>
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13.5px] font-bold text-[var(--text-primary)]">{payment.description || payment.customerName || subject}</span>
                        <span dir="ltr" className="shrink-0 font-mono text-[11.5px] text-[var(--text-muted)]">#{payment.reference}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                        {[subject, payment.site?.name, payment.description && payment.customerName ? payment.customerName : null, time.format(payment.createdAt)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {/* Phones: the amount on the end of the first line. */}
                    <div className="text-end md:text-start">
                      <p className="whitespace-nowrap text-[14px] font-bold tabular-nums text-[var(--text-primary)]">{payment.baseAmount.toLocaleString(numbers)} <span className="text-[11.5px] font-normal text-[var(--text-muted)]">{fa ? 'تومان' : 'Toman'}</span></p>
                      <p className="hidden truncate text-[12px] text-[var(--text-muted)] md:block">{fa ? 'واریز دقیق' : 'Exact'} <span dir="ltr" className="font-mono">{payment.payAmount.toLocaleString('en-US')}</span> · <span dir="ltr" className="font-mono">••{payment.card.last4}</span></p>
                    </div>
                    <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-1.5 md:col-start-auto">
                      <StatusChip tone={status.tone} dot>{fa ? status.fa : status.en}{payment.status === 'PAID' && payment.confirmedBy !== 'AUTO' ? (fa ? ' · دستی' : ' · by hand') : ''}</StatusChip>
                      <StoreOrderChip draft={payment.orderDraftId ? storeOrders.get(payment.orderDraftId) : undefined} fa={fa} />
                    </div>
                    <div className="col-start-3 row-start-2 justify-self-end md:col-start-auto md:row-start-auto">
                      <PaymentRowMenu
                        paymentId={payment.id}
                        pending={pending}
                        payUrl={pending && payment.source === 'LINK' ? payPageUrl(payment.authority) : null}
                        conversationHref={payment.conversationId ? `/conversations/${payment.conversationId}` : null}
                        label={`#${payment.reference} · ${money(payment.baseAmount)}`}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>
    </PaymentsShell>
  )
}

/** Where a paid chat order stands on the WooCommerce store. */
function StoreOrderChip({ draft, fa }: { draft?: { externalOrderNumber: string | null; storeSyncAt: Date | null; storeSyncError: string | null }; fa: boolean }) {
  if (!draft) return null
  if (draft.externalOrderNumber) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[#f1eeff] px-2 py-0.5 text-[11.5px] font-medium text-[#4c2fd0] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><PackageCheck className="size-3.5" aria-hidden />{fa ? 'ووکامرس' : 'WooCommerce'} #{draft.externalOrderNumber}</span>
  }
  if (draft.storeSyncAt) {
    return <span title={draft.storeSyncError ?? undefined} className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11.5px] text-[var(--text-secondary)]"><PackageCheck className="size-3.5" aria-hidden />{fa ? 'در صف ثبت در ووکامرس' : 'Queued for WooCommerce'}</span>
  }
  if (draft.storeSyncError) {
    return <span title={draft.storeSyncError} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11.5px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"><PackageX className="size-3.5" aria-hidden />{fa ? 'در ووکامرس ثبت نشد' : 'Not placed on WooCommerce'}</span>
  }
  return null
}
