'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ClipboardList, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SideSheet } from '@/components/ui/side-sheet'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { LocalizedDatePicker } from '@/components/ui/localized-date-picker'
import { PurchaseCard, type PurchaseView } from '@/components/payments/purchase-card'
import { AmountField, formatAmountInput, ItemsEditor, itemsTotal, toPayItems, type EditorItem } from '@/components/payments/payment-request-fields'
import type { PayItem } from '@/lib/payments/card/items'
import { relativeTime } from '@/lib/format'
import { toEnglishDigits } from '@/lib/phone'
import { cn } from '@/lib/utils'

export type ManualOrderView = {
  id: string
  title: string
  items: PayItem[]
  amount: number | null
  orderedAt: string
  note: string | null
}

type Entry =
  | { kind: 'paid'; id: string; at: Date; total: number; purchase: PurchaseView }
  | { kind: 'manual'; id: string; at: Date; total: number; order: ManualOrderView }

/**
 * A customer's purchases in one place: orders paid in Vigent and orders the
 * owner recorded by hand (phone, in-store), newest first. Each row opens to
 * its full receipt; «ثبت سفارش دستی» opens a sheet (side on desktop, bottom on
 * phones) that picks items like a new payment does.
 */
export function ContactPurchases({
  contactId,
  purchases,
  manualOrders,
  locale,
}: {
  contactId: string
  purchases: PurchaseView[]
  manualOrders: ManualOrderView[]
  locale: 'fa' | 'en'
}) {
  const fa = locale !== 'en'
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const dateFmt = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
  const [adding, setAdding] = useState(false)

  const entries = useMemo<Entry[]>(() => [
    ...purchases.map((purchase): Entry => ({ kind: 'paid', id: purchase.id, at: new Date(purchase.paidAt), total: purchase.total, purchase })),
    ...manualOrders.map((order): Entry => ({ kind: 'manual', id: order.id, at: new Date(order.orderedAt), total: order.amount ?? 0, order })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()), [purchases, manualOrders])

  const spent = entries.reduce((sum, entry) => sum + entry.total, 0)
  const waiting = purchases.filter((purchase) => purchase.paymentId && !purchase.handledAt).length
  const priced = entries.filter((entry) => entry.total > 0).length

  const unit = <span className="ms-1 text-[12px] font-medium text-[var(--text-muted)]">{fa ? 'تومان' : 'Toman'}</span>
  const stats: Array<{ label: string; value: React.ReactNode; wide?: boolean; tone?: 'warn' }> = [
    { label: fa ? 'مجموع خرید' : 'Total spent', value: <>{nf.format(Math.round(spent))}{unit}</>, wide: true },
    { label: fa ? 'سفارش' : 'Orders', value: nf.format(entries.length) },
    waiting
      ? { label: fa ? 'منتظر رسیدگی' : 'To handle', value: nf.format(waiting), tone: 'warn' }
      : { label: fa ? 'میانگین هر سفارش' : 'Average order', value: priced ? <>{nf.format(Math.round(spent / priced))}{unit}</> : '—' },
  ]

  return (
    <section className="spatial-surface rounded-card p-4 sm:p-5" aria-labelledby="purchases-title">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white"><ShoppingBag className="size-5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 id="purchases-title" className="ui-h3">{fa ? 'خریدها' : 'Purchases'}</h2>
          <p className="text-[12.5px] text-[var(--text-muted)]">
            {entries.length
              ? (fa ? `آخرین خرید ${relativeTime(entries[0].at, locale)}` : `Last purchase ${relativeTime(entries[0].at, locale)}`)
              : (fa ? 'هنوز خریدی ثبت نشده است' : 'No purchases yet')}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden />
          {fa ? 'ثبت سفارش دستی' : 'Add an order'}
        </Button>
      </div>

      {entries.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                'min-w-0 rounded-2xl border px-3 py-2.5',
                stat.wide && 'col-span-2 sm:col-span-1',
                stat.tone === 'warn' ? 'border-amber-200 bg-amber-50' : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]',
              )}
            >
              <dt className="text-[11.5px] text-[var(--text-muted)]">{stat.label}</dt>
              <dd className="mt-0.5 break-words text-[16px] font-extrabold leading-7 tabular-nums text-[var(--text-primary)]">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {entries.length > 0 ? (
        <ul className="mt-4 grid gap-2">
          {entries.map((entry) => (
            <li key={`${entry.kind}:${entry.id}`}>
              <details className="group overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white open:shadow-[var(--shadow-xs)]">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3 hover:bg-black/[0.02] [&::-webkit-details-marker]:hidden">
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', entry.kind === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]')}>
                    {entry.kind === 'paid' ? <ShoppingBag className="size-[18px]" aria-hidden /> : <ClipboardList className="size-[18px]" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[13.5px] font-medium leading-6 text-[var(--text-primary)]">
                      {entry.kind === 'paid'
                        ? entry.purchase.lines.map((line) => (line.quantity > 1 ? `${nf.format(line.quantity)}× ${line.name}` : line.name)).join('، ') || (fa ? `سفارش #${entry.purchase.code}` : `Order #${entry.purchase.code}`)
                        : entry.order.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-muted)]">
                      <span>{dateFmt.format(entry.at)}</span>
                      {entry.kind === 'paid' ? (
                        <>
                          <span dir="ltr" className="font-mono">#{entry.purchase.code}</span>
                          {entry.purchase.paymentId && !entry.purchase.handledAt
                            ? <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">{fa ? 'منتظر رسیدگی' : 'To handle'}</span>
                            : <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">{fa ? 'پرداخت‌شده' : 'Paid'}</span>}
                        </>
                      ) : (
                        <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 font-semibold text-[var(--text-secondary)]">{fa ? 'ثبت دستی' : 'Added by hand'}</span>
                      )}
                    </span>
                  </span>
                  {entry.total > 0 && (
                    <span className="shrink-0 text-end text-[13.5px] font-bold tabular-nums text-[var(--text-primary)]">
                      {nf.format(Math.round(entry.total))}
                      <span className="block text-[11px] font-normal text-[var(--text-muted)]">{fa ? 'تومان' : 'Toman'}</span>
                    </span>
                  )}
                  <ChevronDown className="size-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="border-t border-[var(--border-subtle)] p-3">
                  {entry.kind === 'paid'
                    ? <PurchaseCard purchase={entry.purchase} locale={locale} />
                    : <ManualOrderDetail contactId={contactId} order={entry.order} locale={locale} />}
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-4 w-full rounded-2xl border border-dashed border-[var(--border-default)] px-4 py-6 text-center text-[13px] leading-6 text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
        >
          {fa
            ? 'خریدهایی که در ویجنت پرداخت شوند خودکار اینجا می‌آیند. سفارش تلفنی یا فروش حضوری را با «ثبت سفارش دستی» اضافه کنید؛ دستیار هم آن را می‌بیند.'
            : 'Orders paid in Vigent show up here. Add phone orders or in-store sales with «Add an order»; the assistant sees them too.'}
        </button>
      )}

      {adding && <ManualOrderSheet contactId={contactId} locale={locale} onClose={() => setAdding(false)} />}
    </section>
  )
}

function ManualOrderDetail({ contactId, order, locale }: { contactId: string; order: ManualOrderView; locale: 'fa' | 'en' }) {
  const fa = locale !== 'en'
  const router = useRouter()
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const money = (value: number) => `${nf.format(Math.round(value))} ${fa ? 'تومان' : 'Toman'}`
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lines = order.items.length ? order.items : [{ name: order.title, quantity: 1, unitPrice: null }]

  async function remove() {
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/contacts/${contactId}/orders?id=${encodeURIComponent(order.id)}`, { method: 'DELETE' }).catch(() => null)
    setBusy(false)
    if (!response?.ok) {
      setError(fa ? 'حذف نشد؛ دوباره تلاش کنید.' : 'Could not delete; try again.')
      return
    }
    setConfirming(false)
    router.refresh()
  }

  return (
    <div className="grid gap-3">
      <ul className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] px-3">
        {lines.map((line, index) => (
          <li key={index} className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 grid h-6 min-w-6 shrink-0 place-items-center rounded-md bg-[var(--bg-muted)] px-1 text-[12px] font-bold tabular-nums text-[var(--text-secondary)]">{nf.format(line.quantity)}×</span>
            <span className="min-w-0 flex-1 text-[13.5px] leading-6 text-[var(--text-primary)]">{line.name}</span>
            {line.unitPrice != null && <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{money(line.unitPrice * line.quantity)}</span>}
          </li>
        ))}
      </ul>
      {order.amount != null && (
        <p className="flex items-center justify-between gap-3 text-[13px]">
          <span className="font-bold text-[var(--text-primary)]">{fa ? 'مبلغ سفارش' : 'Order total'}</span>
          <span className="text-[15px] font-extrabold tabular-nums text-[var(--text-primary)]">{money(order.amount)}</span>
        </p>
      )}
      {order.note && <p className="rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-[12.5px] leading-6 text-[var(--text-secondary)]">{order.note}</p>}
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} className="text-[var(--text-muted)] hover:text-red-600">
          <Trash2 className="size-4" aria-hidden />
          {fa ? 'حذف این سفارش' : 'Delete this order'}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={fa ? 'این سفارش دستی حذف شود؟' : 'Delete this manual order?'}
        description={order.title}
        confirmLabel={fa ? 'حذف سفارش' : 'Delete'}
        cancelLabel={fa ? 'انصراف' : 'Cancel'}
        busy={busy}
        error={error}
        onConfirm={remove}
        onClose={() => setConfirming(false)}
      />
    </div>
  )
}

function ManualOrderSheet({ contactId, locale, onClose }: { contactId: string; locale: 'fa' | 'en'; onClose: () => void }) {
  const fa = locale !== 'en'
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const [items, setItems] = useState<EditorItem[]>([])
  const [amount, setAmount] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lines = toPayItems(items)
  const value = Number(toEnglishDigits(amount).replace(/\D/g, ''))
  const total = itemsTotal(items)
  const numbers = fa ? 'fa-IR' : 'en-US'

  /** The items' total fills the amount until the owner types one of their own. */
  function changeItems(next: EditorItem[]) {
    setItems(next)
    if (!amountTouched) setAmount(formatAmountInput(itemsTotal(next)))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!lines.length || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/contacts/${contactId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: lines,
          amount: value || null,
          // Noon UTC keeps the chosen day in every Iranian time zone.
          orderedAt: new Date(`${date || today}T12:00:00.000Z`).toISOString(),
          note: note.trim() || null,
        }),
      })
      if (!response.ok) throw new Error('SAVE_FAILED')
      router.refresh()
      onClose()
    } catch {
      setError(fa ? 'سفارش ثبت نشد؛ دوباره تلاش کنید.' : 'The order was not saved; try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SideSheet
      title={fa ? 'ثبت سفارش دستی' : 'Add an order'}
      subtitle={fa ? 'سفارش تلفنی، فروش حضوری یا هر خریدی بیرون از ویجنت' : 'A phone order, an in-store sale or anything sold outside Vigent'}
      onClose={() => { if (!busy) onClose() }}
      closeLabel={fa ? 'بستن' : 'Close'}
      className="md:w-[min(30rem,calc(100vw-1.5rem))]"
      icon={<span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ClipboardList className="size-5" /></span>}
      footer={(
        <div className="flex flex-wrap gap-2">
          <Button type="submit" form="manual-order-form" loading={busy} disabled={!lines.length}>
            {lines.length ? (fa ? 'ثبت سفارش' : 'Save order') : (fa ? 'اول بگویید چه خرید' : 'Add what they bought')}
          </Button>
          <Button variant="ghost" onClick={onClose}>{fa ? 'انصراف' : 'Cancel'}</Button>
        </div>
      )}
    >
      <form id="manual-order-form" onSubmit={submit} className="grid gap-4">
        <div className="grid gap-1.5">
          <span className="ui-field-label">{fa ? 'چه خرید؟' : 'What did they buy?'}</span>
          <ItemsEditor items={items} onChange={changeItems} fa={fa} />
          <span className="ui-field-hint">{fa ? 'از محصولات انتخاب کنید یا یک قلم دستی بنویسید؛ دستیار این خرید را برای همین مشتری به یاد می‌آورد.' : 'Pick from your products or type a line; the assistant remembers this purchase for this customer.'}</span>
        </div>
        <AmountField
          id="manual-order-amount"
          value={amount}
          onChange={(next) => { setAmount(next); setAmountTouched(Boolean(next)) }}
          fa={fa}
          hint={total
            ? (amountTouched && value !== total
              ? (fa ? `جمع اقلام ${total.toLocaleString(numbers)} تومان است.` : `The items add up to ${total.toLocaleString(numbers)}.`)
              : (fa ? 'از جمع اقلام پر شد؛ می‌توانید عوضش کنید.' : 'Filled from the items; you can change it.'))
            : null}
        />
        <div className="grid gap-1.5">
          <span className="ui-field-label">{fa ? 'تاریخ خرید' : 'Date'}</span>
          <LocalizedDatePicker value={date} onValueChange={setDate} locale={locale} max={today} ariaLabel={fa ? 'تاریخ خرید' : 'Date'} />
        </div>
        <label className="block">
          <span className="ui-field-label">{fa ? 'توضیح (اختیاری)' : 'Note (optional)'}</span>
          <input className="input mt-1.5" value={note} onChange={(event) => setNote(event.target.value.slice(0, 1000))} placeholder={fa ? 'مثلاً: تحویل حضوری، پرداخت نقدی' : 'e.g. Picked up in store, paid cash'} />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
    </SideSheet>
  )
}
