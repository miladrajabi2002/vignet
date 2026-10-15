import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { ArrowLeft, Check, MessageSquareText } from 'lucide-react'
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

  const [overview, payments, unmatched, paidToday, autoCount, paidCount] = await Promise.all([
    loadGatewayOverview(user.workspaceId),
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
  const hasDevice = overview.devices.some((device) => device.active && device.connectedAt)
  const verified = overview.devices.some((device) => device.verifiedAt)
  const steps = [
    { done: hasCard, href: '/payments/cards', title: fa ? 'کارت مقصد را اضافه کنید' : 'Add the destination card', body: fa ? 'شماره کارتی که مشتری‌ها به آن واریز می‌کنند.' : 'The card your customers transfer to.' },
    { done: hasDevice, href: '/payments/devices', title: fa ? 'گوشی دریافت پیامک را وصل کنید' : 'Connect the phone that gets the bank SMS', body: fa ? 'پیامک واریز بانک باید خودکار به ویجنت برسد تا پرداخت بدون شما تأیید شود.' : 'The bank’s deposit SMS must reach Vigent so payments confirm without you.' },
    { done: verified, href: '/payments/devices', title: fa ? 'یک واریز آزمایشی بزنید' : 'Make one test transfer', body: fa ? 'با اولین پیامکی که تطبیق بخورد، درگاه آماده است.' : 'The first SMS that matches makes the gateway ready.' },
  ]

  return (
    <PaymentsShell active="payments" overview={overview} locale={locale}>
      {!verified && (
        <section className="spatial-surface rounded-card p-4 sm:p-5">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">{fa ? 'راه‌اندازی در سه قدم' : 'Set up in three steps'}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">{fa ? 'بعد از این سه قدم، ایجنت بعد از تأیید هر سفارش کارت و مبلغ دقیق را برای مشتری می‌فرستد و واریز را خودش تأیید می‌کند.' : 'After these three steps the agent sends your card and the exact amount for every confirmed order and confirms the transfer by itself.'}</p>
          <ol className="mt-4 grid gap-2.5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title}>
                <Link href={step.href} className={cn('spatial-press flex h-full items-start gap-3 rounded-2xl border p-3.5', step.done ? 'border-emerald-200 bg-emerald-50/60' : 'border-[var(--border-default)] bg-[var(--bg-surface)]')}>
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold', step.done ? 'bg-emerald-600 text-white' : 'bg-[var(--text-primary)] text-white')}>
                    {step.done ? <Check className="size-4" aria-hidden /> : (index + 1).toLocaleString(numbers)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--text-primary)]">{step.title}</span>
                    <span className="mt-0.5 block text-[13px] leading-6 text-[var(--text-secondary)]">{step.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: fa ? 'دریافتی ۲۴ ساعت اخیر' : 'Received in 24 hours', value: money(paidToday._sum.baseAmount ?? 0), hint: fa ? `${paidToday._count.toLocaleString(numbers)} پرداخت` : `${paidToday._count} payments` },
          { label: fa ? 'تأیید خودکار' : 'Confirmed automatically', value: `${(paidCount ? Math.round((autoCount / paidCount) * 100) : 0).toLocaleString(numbers)}${fa ? '٪' : '%'}`, hint: fa ? `از ${paidCount.toLocaleString(numbers)} پرداخت` : `of ${paidCount} payments` },
          { label: fa ? 'پرداخت این ماه' : 'Payments this month', value: overview.usage.used.toLocaleString(numbers), hint: overview.usage.cap == null ? (fa ? 'بدون سقف در پلن شما' : 'No limit on your plan') : (fa ? `از سقف ${overview.usage.cap.toLocaleString(numbers)} در پلن شما` : `of ${overview.usage.cap} on your plan`) },
        ].map((tile) => (
          <div key={tile.label} className="spatial-surface rounded-card p-4">
            <p className="text-[13px] text-[var(--text-muted)]">{tile.label}</p>
            <p className="ui-num mt-1 text-[22px] font-bold text-[var(--text-primary)]">{tile.value}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{tile.hint}</p>
          </div>
        ))}
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

      <NewLinkForm disabled={!hasCard || !overview.platformEnabled} />

      <section className="spatial-surface rounded-card p-4 sm:p-5">
        <h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'پرداخت‌ها' : 'Payments'}</h2>
        {rest.length === 0 ? (
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{fa ? 'هنوز پرداختی ثبت نشده. اولین سفارشی که در گفتگو تأیید شود یا اولین لینکی که بسازید این‌جا می‌آید.' : 'No payments yet. The first order confirmed in a conversation, or the first link you create, appears here.'}</p>
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
                      {(SOURCE[payment.source] ?? SOURCE.LINK)[fa ? 0 : 1]}{payment.site ? ` · ${payment.site.name}` : ''}{payment.customerName ? ` · ${payment.customerName}` : ''}{payment.description ? ` · ${payment.description}` : ''} · {time.format(payment.createdAt)}
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
