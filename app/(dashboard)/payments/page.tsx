import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { ArrowLeft, Bot, Link2, MessageSquareText, TrendingUp, WalletCards, Zap } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { dateLocaleTag } from '@/lib/localized-date'
import { StatusChip, type ChipTone } from '@/components/ui/status-chip'
import { BankMark } from '@/components/payments/bank-card'
import { PaymentsShell } from '@/components/payments/payments-shell'
import { PaymentActions, UnmatchedSmsActions } from '@/components/payments/payment-actions'
import { NewLinkForm } from '@/components/payments/new-link-form'
import { loadGatewayOverview } from '@/lib/payments/card/dashboard'
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

export default async function PaymentsPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const fa = locale === 'fa'
  const numbers = fa ? 'fa-IR' : 'en-US'
  const money = (value: number) => `${value.toLocaleString(numbers)} ${fa ? 'تومان' : 'Toman'}`
  const time = new Intl.DateTimeFormat(dateLocaleTag(locale), { dateStyle: 'medium', timeStyle: 'short' })
  const dayStart = new Date(Date.now() - 24 * 3_600_000)

  const overview = await loadGatewayOverview(user.workspaceId)
  // Until the gateway is set up once, the page is the setup and nothing else.
  if (!overview.activated) return <PaymentsShell active="payments" overview={overview} locale={locale} />

  const [payments, unmatched, paidToday, autoCount, paidCount] = await Promise.all([
    prisma.cardPayment.findMany({
      where: { workspaceId: user.workspaceId, NOT: { reference: { startsWith: 'TEST-' }, status: { in: ['EXPIRED', 'CANCELLED'] } } },
      orderBy: [{ createdAt: 'desc' }],
      take: 60,
      include: { card: { select: { bankKey: true, last4: true } }, site: { select: { name: true } } },
    }),
    prisma.bankSms.findMany({ where: { workspaceId: user.workspaceId, status: 'UNMATCHED' }, orderBy: { receivedAt: 'desc' }, take: 10 }),
    prisma.cardPayment.aggregate({ where: { workspaceId: user.workspaceId, status: 'PAID', paidAt: { gte: dayStart } }, _sum: { baseAmount: true }, _count: true }),
    prisma.cardPayment.count({ where: { workspaceId: user.workspaceId, status: 'PAID', confirmedBy: 'AUTO' } }),
    prisma.cardPayment.count({ where: { workspaceId: user.workspaceId, status: 'PAID' } }),
  ])
  const suggestions = await Promise.all(unmatched.map((sms) => suggestPaymentsForSms(user.workspaceId, sms.amount)))
  const review = payments.filter((payment) => payment.status === 'CLAIMED')
  const rest = payments.filter((payment) => payment.status !== 'CLAIMED')
  const hasCard = overview.cards.some((card) => card.active)
  const cap = overview.usage.cap
  const tiles = [
    { label: fa ? 'دریافتی ۲۴ ساعت اخیر' : 'Received in 24 hours', icon: TrendingUp, tint: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', value: (paidToday._sum.baseAmount ?? 0).toLocaleString(numbers), unit: fa ? 'تومان' : 'Toman', hint: paidToday._count ? (fa ? `${paidToday._count.toLocaleString(numbers)} پرداخت` : `${paidToday._count} payments`) : (fa ? 'هنوز پرداختی نیامده' : 'No payment yet'), bar: null },
    { label: fa ? 'تأیید خودکار' : 'Confirmed automatically', icon: Zap, tint: 'bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]', value: (paidCount ? Math.round((autoCount / paidCount) * 100) : 0).toLocaleString(numbers), unit: fa ? '٪' : '%', hint: paidCount ? (fa ? `${autoCount.toLocaleString(numbers)} از ${paidCount.toLocaleString(numbers)} بدون شما` : `${autoCount} of ${paidCount} without you`) : (fa ? 'بعد از اولین پرداخت' : 'After the first payment'), bar: null },
    { label: fa ? 'پرداخت این ماه' : 'Payments this month', icon: WalletCards, tint: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300', value: overview.usage.used.toLocaleString(numbers), unit: cap == null ? '' : (fa ? `از ${cap.toLocaleString(numbers)}` : `of ${cap}`), hint: cap == null ? (fa ? 'بدون سقف در پلن شما' : 'No limit on your plan') : (fa ? 'سقف پلن شما' : 'Your plan’s limit'), bar: cap ? Math.min(100, Math.round((overview.usage.used / cap) * 100)) : null },
  ]

  return (
    <PaymentsShell active="payments" overview={overview} locale={locale}>
      {/* Three tiles side by side on every width; phones get the compact type. */}
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
        <section className="rounded-card border border-red-200 bg-red-50/70 p-4 sm:p-5">
          <h2 className="text-[15px] font-bold text-red-800">{fa ? 'منتظر تصمیم شما' : 'Waiting for your decision'}</h2>
          <ul className="mt-3 grid gap-2.5">
            {review.map((payment) => (
              <li key={payment.id} className="rounded-2xl border border-red-200 bg-white p-3.5">
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
              <li key={sms.id} className="rounded-2xl border border-red-200 bg-white p-3.5">
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

      <NewLinkForm locked={!overview.platformEnabled ? 'platform' : !hasCard ? 'card' : null} />

      <section className="spatial-surface rounded-card p-4 shadow-[0_1px_2px_rgba(17,17,17,.04),0_10px_28px_-14px_rgba(17,17,17,.16)] sm:p-5">
        <h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'پرداخت‌ها' : 'Payments'}</h2>
        {rest.length === 0 ? (
          <div className="grid justify-items-center gap-1.5 px-3 py-7 text-center">
            <span className="mb-1 grid size-14 place-items-center rounded-2xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><WalletCards className="size-6" aria-hidden /></span>
            <p className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'هنوز پرداختی نیامده' : 'No payments yet'}</p>
            <p className="max-w-md text-[13px] leading-7 text-[var(--text-secondary)]">{fa ? 'اولین سفارشی که در گفتگو تأیید شود یا اولین لینکی که بسازید این‌جا می‌آید.' : 'The first order confirmed in a conversation, or the first link you create, appears here.'}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <a href="#pay-link" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border-default)] px-4 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)]"><Link2 className="size-4" aria-hidden />{fa ? 'ساخت لینک پرداخت' : 'Create a payment link'}</a>
              <Link href="/payments/settings" className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border-default)] px-4 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)]"><Bot className="size-4" aria-hidden />{fa ? 'روش پرداخت ایجنت‌ها' : 'How agents take payment'}</Link>
            </div>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
            {rest.map((payment) => {
              const status = STATUS[payment.status] ?? STATUS.CANCELLED
              return (
                <li key={payment.id} className="grid gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span dir="ltr" className="font-mono text-sm font-bold text-[var(--text-primary)]">#{payment.reference}</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{money(payment.baseAmount)}</span>
                      <StatusChip tone={status.tone} dot>{fa ? status.fa : status.en}{payment.status === 'PAID' && payment.confirmedBy !== 'AUTO' ? (fa ? ' · دستی' : ' · by hand') : ''}</StatusChip>
                    </div>
                    <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                      {payment.purpose === 'BOOKING' ? (fa ? 'بیعانهٔ نوبت' : 'Booking deposit') : payment.purpose === 'COURSE' ? (fa ? 'ثبت‌نام دوره' : 'Course seat') : (SOURCE[payment.source] ?? SOURCE.LINK)[fa ? 0 : 1]}{payment.site ? ` · ${payment.site.name}` : ''}{payment.customerName ? ` · ${payment.customerName}` : ''}{payment.description ? ` · ${payment.description}` : ''} · {time.format(payment.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                    <BankMark bankKey={payment.card.bankKey} size={24} />
                    <span>{fa ? 'واریزی' : 'Transfer'} <span dir="ltr" className="font-mono font-medium text-[var(--text-primary)]">{payment.payAmount.toLocaleString('en-US')}</span> {fa ? 'به کارت' : 'to card'} <span dir="ltr" className="font-mono">…{payment.card.last4}</span></span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {payment.status === 'PENDING' && <PaymentActions paymentId={payment.id} mode="pending" />}
                    {payment.status === 'PENDING' && payment.source === 'LINK' && <a href={payPageUrl(payment.authority)} target="_blank" rel="noopener noreferrer" className="ui-link text-[13px]">{fa ? 'صفحهٔ پرداخت' : 'Payment page'}</a>}
                    {payment.conversationId && <Link href={`/conversations/${payment.conversationId}`} aria-label={fa ? 'دیدن گفتگو' : 'Open conversation'} className="grid size-9 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"><ArrowLeft className="size-4 ltr:rotate-180" aria-hidden /></Link>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </PaymentsShell>
  )
}
