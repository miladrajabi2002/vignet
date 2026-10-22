'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { ChannelType } from '@prisma/client'
import Link from 'next/link'
import { Check, CircleCheck, CreditCard, Loader2, Lock, Package, Search, StickyNote, TriangleAlert, X } from 'lucide-react'
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/chat-composer'
import { cn } from '@/lib/utils'
import { deliveryReasonDetail } from '@/lib/channels/delivery-errors'
import type { ThreadMessage } from './conversation-thread'
import { ProductImage } from '@/components/products/product-image'
import { AmountField, formatAmountInput, ItemsEditor, itemsTotal, toPayItems, type EditorItem } from '@/components/payments/payment-request-fields'

type DeliveryFeedback = {
  status: 'sent' | 'stored' | 'unavailable' | 'failed'
  reason?: string
}

type PickerProduct = {
  id: string
  name: string
  price: number | null
  stock: number | null
  images?: string[] | null
  active?: boolean
}

/** One message carries at most this many products (Meta's carousel limit). */
const MAX_PRODUCTS = 10

const CHIP =
  'spatial-press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50'
const CHIP_IDLE = 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
const CHIP_LOCKED = 'border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-hint)] hover:text-[var(--text-muted)]'

/**
 * Why a composer tool is off, so the chip can say what to switch on. Null
 * when the tool works.
 */
export type ComposerToolLock = 'GATEWAY_OFF' | 'NO_CARD' | 'GATEWAY_PAUSED' | 'NO_PRODUCTS' | null
export interface ComposerTools { payment: ComposerToolLock; products: ComposerToolLock }

const LOCK_COPY: Record<Exclude<ComposerToolLock, null>, { fa: string; en: string; href: string; cta: [string, string] }> = {
  GATEWAY_OFF: { fa: 'درخواست پرداخت با درگاه کارت‌به‌کارت ویجنت کار می‌کند که هنوز راه‌اندازی یا روشن نشده.', en: 'Payment requests use Vigent’s card-to-card gateway, which is not set up or switched on yet.', href: '/payments', cta: ['راه‌اندازی درگاه پرداخت', 'Set up the gateway'] },
  NO_CARD: { fa: 'برای درخواست پرداخت، دست‌کم یک کارت بانکی فعال در درگاه لازم است.', en: 'A payment request needs at least one active bank card in the gateway.', href: '/payments/cards', cta: ['افزودن کارت', 'Add a card'] },
  GATEWAY_PAUSED: { fa: 'درگاه پرداخت الان در دسترس نیست (متوقف شده یا سقف ماه پر شده).', en: 'The gateway is unavailable right now (paused or this month’s limit is reached).', href: '/payments', cta: ['دیدن درگاه پرداخت', 'Open the gateway'] },
  NO_PRODUCTS: { fa: 'هنوز محصول فعالی ندارید؛ محصول اضافه کنید یا فروشگاه ووکامرس را وصل کنید.', en: 'There is no active product yet; add products or connect your WooCommerce store.', href: '/products', cta: ['رفتن به محصولات', 'Go to products'] },
}

/** How the picked products reach the customer on this conversation's channel. */
function productDeliveryHint(channel: ChannelType | undefined, fa: boolean): string {
  switch (channel) {
    case 'INSTAGRAM':
      return fa ? 'در اینستاگرام به‌صورت کاتالوگ کشویی با عکس، قیمت و دکمهٔ «مشاهده محصول» می‌رود.' : 'Goes to Instagram as a swipeable catalog with photo, price and a "View product" button.'
    case 'TELEGRAM':
    case 'BALE':
    case 'RUBIKA':
      return fa ? 'هر محصول جدا با عکس، قیمت، مشخصات و دکمهٔ خرید فرستاده می‌شود.' : 'Each product is sent with its photo, price, specs and a buy button.'
    case 'WHATSAPP':
      return fa ? 'واتساپ دیگر پشتیبانی نمی‌شود؛ محصولات فقط در همین گفتگو ثبت می‌شوند.' : 'WhatsApp is retired; the products are only recorded in this conversation.'
    default:
      return fa ? 'در گفتگوی مشتری به‌صورت کارت‌های محصول کنار هم نمایش داده می‌شود.' : 'Shown to the customer as product cards side by side in the chat.'
  }
}

/**
 * Operator (human handoff) reply box. Sends a message directly to the contact
 * through the conversation's channel. For messenger channels the message is
 * pushed live; for widget / chat-link / API channels the message is persisted
 * and shown to the visitor the next time they load the chat (the backend reply
 * route always persists the operator message regardless of channel).
 *
 * OPTIMISTIC DISPLAY: When `onSent` is provided, the message is displayed
 * INSTANTLY in the UI (via the parent's state) — no page refresh needed.
 * `router.refresh()` still runs silently in the background to sync the
 * conversation status and handoff panel, but the user never waits for it.
 *
 * Input handling (Enter to send, auto-grow, send button, busy state) belongs to
 * the shared <ChatComposer>; this component owns the send request, the delivery
 * feedback, and two helpers under the field: a product catalog (up to ten
 * products sent as real cards on every channel) and an internal note the
 * customer never sees.
 */
export function OperatorReply({
  conversationId,
  channel,
  commentThread = false,
  tools = { payment: null, products: null },
  onSent,
}: {
  conversationId: string
  channel?: ChannelType
  /** A public Instagram comment thread: text replies only, no product cards. */
  commentThread?: boolean
  /** Which helpers under the field are off, and why. */
  tools?: ComposerTools
  onSent?: (message: ThreadMessage) => void
}) {
  const t = useTranslations('conversations')
  const locale = useLocale()
  const fa = locale !== 'en'
  const router = useRouter()
  const composerRef = useRef<ChatComposerHandle>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [delivery, setDelivery] = useState<DeliveryFeedback | null>(null)
  const [noteMode, setNoteMode] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [attached, setAttached] = useState<PickerProduct[]>([])
  const [payMode, setPayMode] = useState(false)
  const [payItems, setPayItems] = useState<EditorItem[]>([])
  const [payAmount, setPayAmount] = useState('')
  const [payAmountTouched, setPayAmountTouched] = useState(false)
  const [payFor, setPayFor] = useState('')
  const [lockShown, setLockShown] = useState<Exclude<ComposerToolLock, null> | null>(null)
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const sendsProducts = !noteMode && !payMode && attached.length > 0
  const payValue = Number(payAmount.replace(/\D/g, ''))
  const payTotal = itemsTotal(payItems)

  /** Open the payment panel; products already picked become its items. */
  function openPayment() {
    if (tools.payment) { setLockShown(lockShown === tools.payment ? null : tools.payment); return }
    if (payMode) { setPayMode(false); return }
    const fromProducts: EditorItem[] = attached.map((product) => ({ key: product.id, name: product.name, quantity: 1, unitPrice: product.price, productId: product.id, image: product.images?.find((src) => /^https?:\/\//.test(src)) ?? null }))
    setPayItems(fromProducts)
    setPayAmount(formatAmountInput(itemsTotal(fromProducts)))
    setPayAmountTouched(false)
    setAttached([])
    setPickerOpen(false)
    setNoteMode(false)
    setLockShown(null)
    setPayMode(true)
    setError(null)
  }

  function changePayItems(next: EditorItem[]) {
    setPayItems(next)
    if (!payAmountTouched) setPayAmount(formatAmountInput(itemsTotal(next)))
  }

  async function sendPayment() {
    if (!payValue || busy) {
      if (!payValue) setError(fa ? 'مبلغ پرداخت را وارد کنید.' : 'Enter the amount.')
      return
    }
    setBusy(true)
    setError(null)
    setDelivery(null)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, amount: payValue, description: payFor.trim() || undefined, items: toPayItems(payItems), note: text.trim() || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const copy: Record<string, string> = fa
          ? { WINDOW_CLOSED: 'اینستاگرام فقط تا ۲۴ ساعت بعد از آخرین پیام مشتری اجازهٔ پیام می‌دهد.', DISABLED: 'درگاه پرداخت خاموش است.', NO_CARD: 'کارت فعالی در درگاه نیست.', AMOUNT_TOO_LOW: 'حداقل مبلغ ۱٬۰۰۰ تومان است.', AMOUNT_TOO_HIGH: 'این مبلغ از سقف کارت‌به‌کارت بیشتر است.', CAP_REACHED: 'سقف پرداخت‌های این ماه پر شده است.', NO_SLOT: 'چند دقیقهٔ دیگر دوباره تلاش کنید.' }
          : { WINDOW_CLOSED: 'Instagram allows messages only within 24 hours of the customer’s last one.', DISABLED: 'The gateway is off.', NO_CARD: 'There is no active card.', AMOUNT_TOO_LOW: 'The minimum is 1,000 Toman.', AMOUNT_TOO_HIGH: 'This amount is above the card-to-card limit.', CAP_REACHED: 'This month’s limit is reached.', NO_SLOT: 'Try again in a few minutes.' }
        setError(copy[data?.error] ?? (fa ? 'درخواست پرداخت فرستاده نشد. دوباره تلاش کنید.' : 'The payment request was not sent. Try again.'))
        return
      }
      if (onSent && data?.message) {
        onSent({ id: data.message.id, role: data.message.role, content: data.message.content, createdAt: data.message.createdAt, contentType: 'TEXT', metadata: data.message.metadata ?? { operator: true } })
      }
      setDelivery({ status: data?.delivery === 'failed' ? 'failed' : data?.delivery === 'stored' ? 'stored' : 'sent' })
      setText('')
      setPayMode(false)
      setPayItems([])
      setPayAmount('')
      setPayFor('')
      router.refresh()
    } catch {
      setError(fa ? 'درخواست پرداخت فرستاده نشد. اینترنت را چک کنید.' : 'The payment request was not sent. Check the connection.')
    } finally {
      setBusy(false)
    }
  }

  function toggleProduct(product: PickerProduct) {
    setAttached((current) => {
      if (current.some((item) => item.id === product.id)) return current.filter((item) => item.id !== product.id)
      if (current.length >= MAX_PRODUCTS) return current
      return [...current, product]
    })
  }

  async function send() {
    const body = text.trim()
    const productIds = noteMode ? [] : attached.map((product) => product.id)
    if ((!body && productIds.length === 0) || busy) return
    setBusy(true)
    setError(null)
    setDelivery(null)
    setNoteSaved(false)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body, productIds }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(
          data?.error === 'PRODUCTS_UNAVAILABLE'
            ? (fa ? 'محصولات انتخاب‌شده دیگر فعال نیستند. فهرست را دوباره باز کنید.' : 'The picked products are no longer active. Open the list again.')
            : t('replyFailed'),
        )
        return
      }
      const data = await res.json()
      const deliveryResult = data.delivery as DeliveryFeedback | undefined
      // Instantly display the message via the parent's optimistic state.
      // The API returns { message: { id, content, createdAt, role }, delivered }.
      if (onSent && data.message) {
        onSent({
          id: data.message.id,
          role: data.message.role,
          content: data.message.content,
          createdAt: data.message.createdAt,
          contentType: 'TEXT',
          metadata: {
            operator: true,
            ...(deliveryResult ? { delivery: deliveryResult } : {}),
          },
        })
      }
      if (deliveryResult) setDelivery(deliveryResult)
      setText('')
      setAttached([])
      setPickerOpen(false)
      // Silent background refresh to sync conversation status / handoff panel.
      // The message is already visible — this is just for metadata consistency.
      router.refresh()
    } catch {
      setError(t('replyFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError(null)
    setDelivery(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      if (!res.ok) {
        setError(fa ? 'یادداشت ذخیره نشد. دوباره تلاش کنید.' : 'The note was not saved. Try again.')
        return
      }
      const data = await res.json()
      if (onSent && data.message) onSent(data.message as ThreadMessage)
      setText('')
      setNoteMode(false)
      setNoteSaved(true)
    } catch {
      setError(fa ? 'یادداشت ذخیره نشد. دوباره تلاش کنید.' : 'The note was not saved. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const feedback = error ? (
    <p className="text-xs text-[var(--red)]" role="alert">{error}</p>
  ) : noteSaved ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700" role="status" aria-live="polite">
      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {fa ? 'یادداشت در خط زمان گفتگو ثبت شد؛ مشتری آن را نمی‌بیند.' : 'Note added to the timeline; the customer cannot see it.'}
    </p>
  ) : delivery?.status === 'failed' ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-amber-700" role="status" aria-live="polite">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      {deliveryReasonDetail(delivery.reason, fa)
        ?? (fa ? 'پیام به مشتری نرسید. اتصال را بررسی و دوباره تلاش کنید.' : 'Channel delivery failed. Check the connection and try again.')}
    </p>
  ) : delivery?.status === 'unavailable' ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-amber-700" role="status" aria-live="polite">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      {deliveryReasonDetail(delivery.reason, fa)
        ?? (fa ? 'این اتصال الان آمادهٔ ارسال نیست. اتصال را بررسی کنید.' : 'This channel is not ready to send. Check its connection.')}
    </p>
  ) : delivery?.status === 'sent' ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700" role="status" aria-live="polite">
      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {fa ? 'پیام برای مشتری فرستاده شد.' : 'Message sent to the channel.'}
    </p>
  ) : delivery?.status === 'stored' ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700" role="status" aria-live="polite">
      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {fa ? 'پیام در گفتگو ثبت شد و مشتری آن را می‌بیند.' : 'Message added to the conversation and visible to the customer.'}
    </p>
  ) : null

  return (
    <div className="space-y-2">
      {sendsProducts && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-2.5">
          <div className="flex items-center gap-2 px-0.5">
            <Package className="h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
            <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-[var(--text-primary)]">
              {fa ? `${nf.format(attached.length)} محصول برای ارسال` : `${attached.length} product${attached.length === 1 ? '' : 's'} to send`}
            </p>
            <button
              type="button"
              onClick={() => setAttached([])}
              disabled={busy}
              className="inline-flex min-h-8 shrink-0 items-center rounded-control px-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
            >
              {fa ? 'حذف همه' : 'Clear'}
            </button>
          </div>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]" aria-label={fa ? 'محصولات انتخاب‌شده' : 'Picked products'}>
            {attached.map((product) => (
              <li key={product.id} className="flex w-44 shrink-0 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-white p-1.5">
                <ProductThumb product={product} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium text-[var(--text-primary)]" title={product.name}>{product.name}</p>
                  <p className="truncate text-[12px] tabular-nums text-[var(--text-muted)]">
                    {product.price != null ? `${nf.format(product.price)} ${fa ? 'تومان' : 'Toman'}` : '—'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleProduct(product)}
                  disabled={busy}
                  aria-label={fa ? `حذف ${product.name}` : `Remove ${product.name}`}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 px-0.5 text-[12px] leading-5 text-[var(--text-muted)]">{productDeliveryHint(channel, fa)}</p>
        </div>
      )}

      {payMode && (
        <div className="grid gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-[13px] font-bold text-[var(--text-primary)]">{fa ? 'درخواست پرداخت کارت‌به‌کارت' : 'Card-to-card payment request'}</p>
            <button type="button" onClick={() => setPayMode(false)} disabled={busy} aria-label={fa ? 'بستن' : 'Close'} className="grid h-8 w-8 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"><X className="h-4 w-4" aria-hidden="true" /></button>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-start">
            <div className="grid gap-1.5">
              <span className="text-[12px] font-medium text-[var(--text-muted)]">{fa ? 'اقلام (اختیاری)' : 'Items (optional)'}</span>
              <ItemsEditor items={payItems} onChange={changePayItems} fa={fa} disabled={busy} />
            </div>
            <div className="grid gap-2">
              <AmountField
                id={`pay-request-amount-${conversationId}`}
                value={payAmount}
                onChange={(next) => { setPayAmount(next); setPayAmountTouched(Boolean(next)) }}
                fa={fa}
                disabled={busy}
                hint={payTotal ? (payAmountTouched && payValue !== payTotal ? (fa ? `جمع اقلام ${nf.format(payTotal)}` : `Items: ${nf.format(payTotal)}`) : (fa ? 'از جمع اقلام' : 'From the items')) : null}
              />
              <input value={payFor} onChange={(event) => setPayFor(event.target.value)} maxLength={200} disabled={busy} placeholder={fa ? 'بابت (اختیاری)، مثلاً: کفش سایز ۴۰' : 'For (optional), e.g. Sneakers size 40'} aria-label={fa ? 'بابت' : 'For'} className="input min-h-10 text-[13px]" />
            </div>
          </div>
          <p className="text-[12px] leading-5 text-[var(--text-muted)]">{fa ? 'کارت بانکی و مبلغ دقیق در همین گفتگو می‌رود؛ با رسیدن پیامک واریز، خودکار تأیید و به مشتری خبر داده می‌شود.' : 'The bank card and the exact amount go into this conversation; the transfer is confirmed from the bank SMS and the customer is told.'}</p>
        </div>
      )}

      <ChatComposer
        ref={composerRef}
        value={text}
        onChange={(value) => {
          setText(value)
          if (noteSaved) setNoteSaved(false)
        }}
        onSend={() => void (noteMode ? saveNote() : payMode ? sendPayment() : send())}
        busy={busy}
        hasAttachment={sendsProducts || (payMode && payValue > 0)}
        placeholder={noteMode
          ? (fa ? 'یادداشت داخلی؛ مشتری نمی‌بیند…' : 'Internal note; the customer will not see it…')
          : payMode
            ? (fa ? 'یک متن کوتاه همراه کارت پرداخت (اختیاری)…' : 'A short line to go with the payment card (optional)…')
          : sendsProducts
            ? (fa ? 'یک متن کوتاه همراه محصولات (اختیاری)…' : 'A short line to go with the products (optional)…')
            : t('replyPlaceholder')}
        inputLabel={noteMode ? (fa ? 'یادداشت داخلی' : 'Internal note') : (fa ? 'پاسخ اپراتور' : 'Operator reply')}
        dir={fa ? 'rtl' : 'ltr'}
        sendLabel={noteMode ? (fa ? 'ثبت یادداشت' : 'Save note') : payMode ? (fa ? 'فرستادن کارت پرداخت' : 'Send the payment card') : t('send')}
        maxLength={noteMode ? 1000 : 4000}
        className={cn(noteMode && '[&>div:first-child]:border-[color:color-mix(in_srgb,var(--notif-strong)_35%,transparent)] [&>div:first-child]:bg-[var(--notif-soft)]')}
      />

      {/* One row on a phone (scrolls sideways) so the box stays short. */}
      <div className="relative flex flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
        <button
          type="button"
          onClick={() => {
            if (tools.products) { setLockShown(lockShown === tools.products ? null : tools.products); return }
            setPickerOpen((open) => !open)
          }}
          disabled={noteMode || payMode || commentThread}
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          title={commentThread
            ? (deliveryReasonDetail('products_need_dm', fa) ?? undefined)
            : (fa ? 'چند محصول را با عکس و قیمت برای مشتری بفرستید' : 'Send several products with photo and price')}
          className={cn(CHIP, tools.products ? CHIP_LOCKED : pickerOpen || attached.length > 0 ? 'border-[var(--text-primary)] bg-white text-[var(--text-primary)]' : CHIP_IDLE)}
          aria-describedby={lockShown === tools.products && tools.products ? `composer-lock-${conversationId}` : undefined}
        >
          {tools.products ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <Package className="h-3.5 w-3.5" aria-hidden="true" />}
          {fa ? 'ارسال محصول' : 'Send products'}
          {attached.length > 0 && (
            <span className="rounded-full bg-[var(--text-primary)] px-1.5 text-[12px] font-bold leading-5 text-white tabular-nums">{nf.format(attached.length)}</span>
          )}
        </button>
        {!commentThread && (
          <button
            type="button"
            onClick={openPayment}
            disabled={noteMode || busy}
            aria-pressed={payMode}
            title={tools.payment ? LOCK_COPY[tools.payment][fa ? 'fa' : 'en'] : (fa ? 'کارت بانکی و مبلغ دقیق را برای پرداخت به مشتری بفرستید' : 'Send the customer your bank card and the exact amount to pay')}
            aria-describedby={lockShown === tools.payment && tools.payment ? `composer-lock-${conversationId}` : undefined}
            className={cn(CHIP, tools.payment ? CHIP_LOCKED : payMode ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : CHIP_IDLE)}
          >
            {tools.payment ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />}
            {fa ? 'درخواست پرداخت' : 'Request payment'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setNoteMode((on) => !on)
            setPayMode(false)
            setPickerOpen(false)
            setError(null)
            composerRef.current?.focus()
          }}
          aria-pressed={noteMode}
          className={cn(CHIP, noteMode ? 'border-[color:color-mix(in_srgb,var(--notif-strong)_40%,transparent)] bg-[var(--notif-tint)] text-[var(--notif-strong)]' : CHIP_IDLE)}
        >
          <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
          {fa ? 'یادداشت' : 'Note'}
        </button>

        {pickerOpen && (
          <ProductPicker
            fa={fa}
            selectedIds={attached.map((product) => product.id)}
            onToggle={toggleProduct}
            onClose={() => {
              setPickerOpen(false)
              composerRef.current?.focus()
            }}
          />
        )}
      </div>

      {lockShown && (
        <div id={`composer-lock-${conversationId}`} role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2.5 text-[12.5px] leading-6 text-[var(--text-secondary)]">
          <Lock className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <span className="min-w-0 flex-1">{LOCK_COPY[lockShown][fa ? 'fa' : 'en']}</span>
          <Link href={LOCK_COPY[lockShown].href} className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-[var(--text-primary)] px-3 text-[12px] font-bold text-white">{LOCK_COPY[lockShown].cta[fa ? 0 : 1]}</Link>
          <button type="button" onClick={() => setLockShown(null)} aria-label={fa ? 'بستن' : 'Close'} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>
      )}

      {feedback ?? (
        <p className="text-[12px] leading-5 text-[var(--text-muted)]">
          {noteMode
            ? (fa ? 'یادداشت فقط در خط زمان همین گفتگو برای شما و همکارانتان می‌ماند.' : 'The note stays on this conversation’s timeline for you and your team only.')
            : payMode
              ? (fa ? 'متن اختیاری بالای کارت پرداخت می‌آید؛ ایجنت همچنان پاسخ مشتری را می‌دهد.' : 'The optional text goes above the payment card; the agent keeps answering the customer.')
              : (
                <>
                  <span className="sm:hidden">{fa ? 'به‌نام شما می‌رود و ایجنت در این گفتگو کنار می‌کشد.' : 'Sent as you; the agent steps back here.'}</span>
                  <span className="hidden sm:inline">{t('replyHint')}</span>
                </>
              )}
        </p>
      )}
    </div>
  )
}

/** Square product photo, or a package glyph when the product has none. */
function ProductThumb({ product }: { product: PickerProduct }) {
  const src = product.images?.find((image) => /^https?:\/\//.test(image))
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- catalog photos come from arbitrary shop hosts
    <ProductImage src={src} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-[var(--bg-muted)] object-cover" />
  ) : (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-[var(--text-muted)]">
      <Package className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}

/** Search the catalog and pick up to ten products to send as cards. */
function ProductPicker({
  fa,
  selectedIds,
  onToggle,
  onClose,
}: {
  fa: boolean
  selectedIds: string[]
  onToggle: (product: PickerProduct) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PickerProduct[] | null>(null)
  const [failed, setFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const selected = new Set(selectedIds)
  const full = selectedIds.length >= MAX_PRODUCTS

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: '20', sort: query.trim() ? 'newest' : 'queried' })
        if (query.trim()) params.set('q', query.trim())
        const res = await fetch(`/api/products?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error('PRODUCTS_FAILED')
        const data = await res.json()
        setItems(Array.isArray(data.products) ? data.products : [])
        setFailed(false)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setFailed(true)
      }
    }, query ? 250 : 0)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  return (
    <div
      role="dialog"
      aria-label={fa ? 'انتخاب محصول' : 'Pick products'}
      className="absolute bottom-full start-0 z-30 mb-2 flex max-h-[min(28rem,70dvh)] w-full max-w-md flex-col rounded-card border border-[var(--border-default)] bg-white p-2 shadow-[var(--elev-2)]"
    >
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={fa ? 'نام یا کد محصول…' : 'Product name or SKU…'}
            aria-label={fa ? 'جستجوی محصول' : 'Search products'}
            className="input min-h-10 w-full ps-9 text-base sm:text-sm"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={fa ? 'بستن' : 'Close'}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-control text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto">
        {failed ? (
          <p className="px-2 py-4 text-center text-[12px] text-[var(--red)]">{fa ? 'فهرست محصولات باز نشد.' : 'The product list could not be loaded.'}</p>
        ) : items === null ? (
          <p className="flex items-center justify-center gap-2 px-2 py-4 text-[12px] text-[var(--text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            {fa ? 'در حال جستجو…' : 'Searching…'}
          </p>
        ) : items.length === 0 ? (
          <p className="px-2 py-4 text-center text-[12px] text-[var(--text-muted)]">{fa ? 'محصولی پیدا نشد.' : 'No product found.'}</p>
        ) : (
          <ul>
            {items.map((product) => {
              const isSelected = selected.has(product.id)
              const inactive = product.active === false
              const blocked = inactive || (full && !isSelected)
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => onToggle(product)}
                    disabled={blocked}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 rounded-control px-2 py-1.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45',
                      isSelected ? 'bg-black/[0.045]' : 'hover:bg-[var(--bg-hover)]',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
                        isSelected ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-white' : 'border-[var(--border-strong)] bg-white',
                      )}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <ProductThumb product={product} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{product.name}</span>
                      <span className="block truncate text-[12px] tabular-nums text-[var(--text-secondary)]">
                        {product.price != null ? `${nf.format(product.price)} ${fa ? 'تومان' : 'Toman'}` : (fa ? 'بدون قیمت' : 'No price')}
                        {inactive
                          ? <span className="text-[var(--text-muted)]"> · {fa ? 'غیرفعال' : 'Inactive'}</span>
                          : product.stock === 0 && <span className="text-[var(--red)]"> · {fa ? 'ناموجود' : 'Out of stock'}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2 border-t border-[var(--border-subtle)] px-1 pt-2">
        <p className="min-w-0 flex-1 text-[12px] text-[var(--text-muted)]">
          {fa
            ? `${nf.format(selectedIds.length)} از ${nf.format(MAX_PRODUCTS)} محصول انتخاب شده`
            : `${selectedIds.length} of ${MAX_PRODUCTS} products picked`}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="spatial-press inline-flex min-h-9 shrink-0 items-center rounded-control bg-[var(--text-primary)] px-3.5 text-[13px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
        >
          {fa ? 'تأیید' : 'Done'}
        </button>
      </div>
    </div>
  )
}
