import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { Bot, MessageSquareText, TrendingUp, WalletCards, Zap } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { dateLocaleTag } from '@/lib/localized-date'
import { PaymentsShell } from '@/components/payments/payments-shell'
import { CustomerCardPaySwitch, PaymentActions, UnmatchedSmsActions } from '@/components/payments/payment-actions'
import { PaymentsList, type PaymentRowData } from '@/components/payments/payments-list'
import { NewPaymentButton } from '@/components/payments/new-link-form'
import { Sparkline } from '@/components/admin/sparkline'
import { loadGatewayOverview, NOT_TEST } from '@/lib/payments/card/dashboard'
import { depositFit, depositGapLabel, pendingDeposits } from '@/lib/payments/card/ingest'
import { payPageUrl } from '@/lib/payments/card/service'
import { readPayItems, type PayItem } from '@/lib/payments/card/items'
import { channelAvatarFor, channelHandleFor, contactDisplayName } from '@/lib/crm/display'
import { contactAvatarSrc } from '@/lib/crm/avatar'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('درگاه پرداخت', 'Payment gateway')

export const dynamic = 'force-dynamic'

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

const FILTERS = ['all', 'pending', 'paid', 'chat'] as const
type Filter = (typeof FILTERS)[number]

/** A chat order's lines in the payment's own shape. */
function draftPayItems(items: unknown): PayItem[] {
  if (!Array.isArray(items)) return []
  return readPayItems(items.map((item: Record<string, unknown>) => ({
    name: [item.name, item.variant].filter((part) => typeof part === 'string' && part).join(' · '),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })))
}

export default async function PaymentsPage(props: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await props.searchParams
  const filter: Filter = (FILTERS as readonly string[]).includes(f ?? '') ? (f as Filter) : 'all'
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
    // Only deposits close to a payment of their last 12 hours wait for the owner.
    pendingDeposits(user.workspaceId),
    prisma.cardPayment.aggregate({ where: { workspaceId: user.workspaceId, status: 'PAID', paidAt: { gte: dayStart }, ...NOT_TEST }, _sum: { baseAmount: true }, _count: true }),
    prisma.cardPayment.count({ where: { workspaceId: user.workspaceId, status: 'PAID', confirmedBy: 'AUTO', ...NOT_TEST } }),
    prisma.cardPayment.count({ where: { workspaceId: user.workspaceId, status: 'PAID', ...NOT_TEST } }),
    prisma.cardPayment.findMany({ where: { workspaceId: user.workspaceId, status: 'PAID', paidAt: { gte: weekStart }, ...NOT_TEST }, select: { paidAt: true, baseAmount: true, confirmedBy: true } }),
  ])
  // Chat orders: their lines, and once paid whether they reached the WooCommerce store.
  const draftIds = [...new Set(payments.flatMap((payment) => (payment.orderDraftId ? [payment.orderDraftId] : [])))]
  const drafts = new Map(
    (draftIds.length
      ? await prisma.orderDraft.findMany({ where: { id: { in: draftIds } }, select: { id: true, items: true, checkoutMode: true, externalOrderNumber: true, storeSyncAt: true, storeSyncError: true } })
      : []
    ).map((draft) => [draft.id, draft]),
  )
  // Who each payment came from: the conversation's customer, their app and last words.
  const conversationIds = [...new Set(payments.flatMap((payment) => (payment.conversationId ? [payment.conversationId] : [])))]
  const conversations = new Map(
    (conversationIds.length
      ? await prisma.conversation.findMany({
          where: { id: { in: conversationIds }, workspaceId: user.workspaceId },
          select: {
            id: true,
            channel: true,
            externalId: true,
            contactId: true,
            contact: { select: { cardPayBlockedAt: true, name: true, phone: true, telegramUsername: true, telegramAvatarUrl: true, baleUsername: true, baleAvatarUrl: true, rubikaUsername: true, rubikaAvatarUrl: true, whatsappName: true, whatsappAvatarUrl: true, instagramUsername: true, instagramAvatarUrl: true } },
            messages: { where: { role: 'USER' }, orderBy: { createdAt: 'desc' }, take: 1, select: { content: true } },
          },
        })
      : []
    ).map((conversation) => [conversation.id, conversation]),
  )
  const review = payments.filter((payment) => payment.status === 'CLAIMED')
  const all = payments.filter((payment) => payment.status !== 'CLAIMED')
  const counts = { pending: all.filter((payment) => payment.status === 'PENDING').length }
  const rest = all.filter((payment) =>
    filter === 'pending' ? payment.status === 'PENDING'
      : filter === 'paid' ? payment.status === 'PAID'
      : filter === 'chat' ? Boolean(payment.conversationId)
      : true)
  const rows: PaymentRowData[] = rest.map((payment) => {
    const subject = payment.purpose === 'BOOKING' ? (fa ? 'بیعانهٔ نوبت' : 'Booking deposit') : payment.purpose === 'COURSE' ? (fa ? 'ثبت‌نام دوره' : 'Course seat') : payment.source === 'LINK' && payment.conversationId ? (fa ? 'درخواست پرداخت در گفتگو' : 'Payment request in chat') : (SOURCE[payment.source] ?? SOURCE.LINK)[fa ? 0 : 1]
    const draft = payment.orderDraftId ? drafts.get(payment.orderDraftId) : undefined
    const conversation = payment.conversationId ? conversations.get(payment.conversationId) : undefined
    const contact = conversation?.contact
    const name = conversation
      ? contactDisplayName({
          name: contact?.name ?? payment.customerName,
          phone: contact?.phone,
          handle: contact ? channelHandleFor({ channel: conversation.channel, ...contact }) : null,
          channel: conversation.channel,
          channelId: conversation.externalId,
          anonymousLabel: fa ? 'مشتری' : 'Customer',
        })
      : null
    const lastMessage = conversation?.messages[0]?.content?.replace(/\[\[[^\]]*\]\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90) || null
    const storeOrder = draft && draft.checkoutMode === 'CARD_TRANSFER' && payment.status === 'PAID' && (draft.externalOrderNumber || draft.storeSyncAt || draft.storeSyncError)
      ? { number: draft.externalOrderNumber, queued: !draft.externalOrderNumber && Boolean(draft.storeSyncAt), error: draft.storeSyncError }
      : null
    return {
      id: payment.id,
      reference: payment.reference,
      status: payment.status,
      confirmedBy: payment.confirmedBy,
      source: payment.source,
      subject,
      title: payment.description || payment.customerName || name || subject,
      customerName: payment.customerName,
      baseAmount: payment.baseAmount,
      payAmount: payment.payAmount,
      partialAmount: payment.partialAmount,
      overpaidAmount: payment.overpaidAmount,
      customerBlocked: conversation?.contactId ? Boolean(contact?.cardPayBlockedAt) : null,
      bankKey: payment.card.bankKey,
      last4: payment.card.last4,
      siteName: payment.site?.name ?? null,
      createdAt: payment.createdAt.toISOString(),
      claimedAt: payment.claimedAt?.toISOString() ?? null,
      paidAt: payment.paidAt?.toISOString() ?? null,
      resolvedAt: payment.resolvedAt?.toISOString() ?? null,
      expiresAt: payment.expiresAt.toISOString(),
      payUrl: payPageUrl(payment.authority),
      conversation: conversation && name
        ? {
            id: conversation.id,
            name,
            channel: conversation.channel,
            avatar: contactAvatarSrc({ contactId: conversation.contactId, channel: conversation.channel, rawUrl: contact ? channelAvatarFor({ channel: conversation.channel, ...contact }) : null }),
            lastMessage,
          }
        : null,
      items: draft ? draftPayItems(draft.items) : readPayItems(payment.items),
      storeOrder,
    }
  })
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
                  {(() => {
                    const conversation = payment.conversationId ? conversations.get(payment.conversationId) : undefined
                    return conversation?.contactId ? <span className="sm:ms-auto"><CustomerCardPaySwitch paymentId={payment.id} blocked={Boolean(conversation.contact?.cardPayBlockedAt)} variant="inline" /></span> : null
                  })()}
                </div>
              </li>
            ))}
            {unmatched.map(({ sms, candidates }) => (
              <li key={sms.id} className="rounded-2xl border border-red-200 bg-white p-3.5 dark:border-red-900/50 dark:bg-neutral-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'واریز بدون سفارش' : 'Deposit with no order'}</span>
                  {sms.amount != null && <span className="text-sm font-bold">{money(sms.amount)}</span>}
                  <span className="ms-auto text-xs text-[var(--text-muted)]">{time.format(sms.receivedAt)}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-6 text-[var(--text-secondary)]">
                  {fa
                    ? (candidates.length > 1 ? 'با هیچ پرداختی دقیقاً برابر نیست، ولی به این پرداخت‌های ۱۲ ساعت اخیر نزدیک است. اگر برای یکی از آن‌هاست رویش بزنید:' : 'با هیچ پرداختی دقیقاً برابر نیست، ولی به این پرداختِ ۱۲ ساعت اخیر نزدیک است. اگر برای آن است رویش بزنید:')
                    : 'It equals no payment exactly, but is close to these payments of the last 12 hours. Tap the one it is for:'}
                </p>
                <div className="mt-2.5">
                  <UnmatchedSmsActions smsId={sms.id} suggestions={candidates.map((payment) => {
                    const fit = depositFit(sms.amount, payment.payAmount)
                    const gap = sms.amount != null && sms.amount !== payment.payAmount ? depositGapLabel(sms.amount, payment.payAmount, locale) : null
                    const hint = !gap ? null
                      : fit.kind === 'SHORT' ? (fa ? `${gap}؛ بقیه از مشتری خواسته می‌شود` : `${gap}; the rest is asked for`)
                      : fa ? `${gap}؛ تأیید می‌شود` : `${gap}; it is confirmed`
                    return { id: payment.id, label: `#${payment.reference}`, name: payment.customerName, amount: money(payment.payAmount), hint }
                  })} />
                </div>
                <details className="mt-2.5 text-xs text-[var(--text-muted)]">
                  <summary className="cursor-pointer select-none">{fa ? 'متن پیامک بانک' : 'Bank SMS'}</summary>
                  {/* Rows stored before escaped line breaks were read still carry a literal «\n». */}
                  <p dir="auto" className="mt-1.5 whitespace-pre-line break-words rounded-xl bg-[var(--bg-surface)] p-2.5 leading-6 text-[var(--text-secondary)]">{sms.text.replace(/\\n/g, '\n')}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="spatial-surface overflow-hidden rounded-card shadow-[0_1px_2px_rgba(17,17,17,.04),0_10px_28px_-14px_rgba(17,17,17,.16)]">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
          <h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'پرداخت‌ها' : 'Payments'}</h2>
          {rest.length ? <span className="text-[12.5px] tabular-nums text-[var(--text-muted)]">{fa ? `${rest.length.toLocaleString(numbers)} پرداخت` : `${rest.length} payments`}</span> : null}
        </div>
        {/* Four chips that fit a phone's width side by side, no sideways scroll. */}
        {all.length ? (
          <nav aria-label={fa ? 'فیلتر پرداخت‌ها' : 'Filter payments'} className="flex gap-1.5 px-4 pb-3 sm:px-5">
            {FILTERS.map((key) => {
              const label = { all: ['همه', 'All'], pending: ['در انتظار', 'Waiting'], paid: ['پرداخت‌شده', 'Paid'], chat: ['از گفتگو', 'From chats'] }[key][fa ? 0 : 1]
              const active = filter === key
              return (
                <Link key={key} href={key === 'all' ? '/payments' : `/payments?f=${key}`} scroll={false} aria-current={active ? 'page' : undefined} className={cn('inline-flex min-h-9 min-w-0 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 text-[12.5px] font-medium transition-colors sm:min-h-8 sm:flex-none sm:gap-1.5 sm:px-3', active ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]')}>
                  {label}
                  {key === 'pending' && counts.pending ? <span className={cn('rounded-full px-1.5 text-[11px] leading-5 tabular-nums', active ? 'bg-white/20' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200')}>{counts.pending.toLocaleString(numbers)}</span> : null}
                </Link>
              )
            })}
          </nav>
        ) : null}
        {all.length === 0 ? (
          <div className="grid justify-items-center gap-1.5 px-3 pb-8 pt-5 text-center">
            <span className="mb-1 grid size-14 place-items-center rounded-2xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><WalletCards className="size-6" aria-hidden /></span>
            <p className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'هنوز پرداختی نیامده' : 'No payments yet'}</p>
            <p className="max-w-md text-[13px] leading-7 text-[var(--text-secondary)]">{fa ? 'اولین سفارشی که در گفتگو تأیید شود، یا اولین پرداختی که با دکمهٔ «پرداخت تازه» بسازید، این‌جا می‌آید.' : 'The first order confirmed in a conversation, or the first payment you make with «New payment», appears here.'}</p>
            <Link href="/payments/settings" className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border-default)] px-4 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)]"><Bot className="size-4" aria-hidden />{fa ? 'روش پرداخت ایجنت‌ها' : 'How agents take payment'}</Link>
          </div>
        ) : rows.length === 0 ? (
          <p className="border-t border-[var(--border-subtle)] px-4 py-8 text-center text-[13px] text-[var(--text-muted)]">{fa ? 'پرداختی با این فیلتر نیست.' : 'No payment matches this filter.'}</p>
        ) : (
          <PaymentsList rows={rows} />
        )}
      </section>
    </PaymentsShell>
  )
}
