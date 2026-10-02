'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CircleCheck, Loader2, Package, Search, Sparkles, StickyNote, TriangleAlert, X } from 'lucide-react'
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/chat-composer'
import { cn } from '@/lib/utils'
import type { ThreadMessage } from './conversation-thread'

type DeliveryFeedback = {
  status: 'sent' | 'stored' | 'unavailable' | 'failed'
  reason?: string
}

type PickerProduct = {
  id: string
  name: string
  price: number | null
  stock: number | null
  externalUrl: string | null
}

const CHIP =
  'spatial-press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50'
const CHIP_IDLE = 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'

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
 * feedback, and the three helpers under the field: an agent-written draft, a
 * product to paste in, and an internal note the customer never sees.
 */
export function OperatorReply({
  conversationId,
  onSent,
}: {
  conversationId: string
  onSent?: (message: ThreadMessage) => void
}) {
  const t = useTranslations('conversations')
  const locale = useLocale()
  const fa = locale !== 'en'
  const router = useRouter()
  const composerRef = useRef<ChatComposerHandle>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [delivery, setDelivery] = useState<DeliveryFeedback | null>(null)
  const [noteMode, setNoteMode] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  async function send(override?: string) {
    const body = (override ?? text).trim()
    if (!body || busy) return
    setBusy(true)
    setError(false)
    setDelivery(null)
    setNoteSaved(false)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      if (!res.ok) {
        setError(true)
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
      if (override === undefined) setText('')
      else setDraft(null)
      // Silent background refresh to sync conversation status / handoff panel.
      // The message is already visible — this is just for metadata consistency.
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    setError(false)
    setDelivery(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: body }),
      })
      if (!res.ok) {
        setError(true)
        return
      }
      const data = await res.json()
      if (onSent && data.message) onSent(data.message as ThreadMessage)
      setText('')
      setNoteMode(false)
      setNoteSaved(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  async function writeDraft() {
    if (drafting) return
    setDrafting(true)
    setDraftError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/draft`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.draft) {
        const code = data?.error as string | undefined
        setDraftError(
          code === 'NO_CREDIT'
            ? (fa ? 'اعتبار هوش مصنوعی کافی نیست.' : 'Not enough AI credit.')
            : code === 'NOTHING_TO_ANSWER'
              ? (fa ? 'هنوز پیامی از مشتری نیامده که جواب بخواهد.' : 'There is no customer message to answer yet.')
              : code === 'PLAN_BLOCKED'
                ? (fa ? 'اشتراک فعال نیست.' : 'The subscription is not active.')
                : (fa ? 'پیش‌نویس ساخته نشد. دوباره تلاش کنید.' : 'The draft could not be written. Try again.'),
        )
        return
      }
      setDraft(String(data.draft))
      // The header credit figure is server-rendered.
      router.refresh()
    } catch {
      setDraftError(fa ? 'پیش‌نویس ساخته نشد. دوباره تلاش کنید.' : 'The draft could not be written. Try again.')
    } finally {
      setDrafting(false)
    }
  }

  function editDraft() {
    if (!draft) return
    setNoteMode(false)
    setText(draft)
    setDraft(null)
    composerRef.current?.focus()
  }

  function insertProduct(product: PickerProduct) {
    const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
    const line = [
      product.name,
      product.price != null ? `${nf.format(product.price)} ${fa ? 'تومان' : 'Toman'}` : null,
    ].filter(Boolean).join(fa ? ' · ' : ' · ')
    const block = product.externalUrl ? `${line}\n${product.externalUrl}` : line
    setText((current) => (current.trim() ? `${current.trimEnd()}\n${block}` : block))
    setPickerOpen(false)
    composerRef.current?.focus()
  }

  const feedback = error ? (
    <p className="text-xs text-[var(--red)]" role="alert">{noteMode ? (fa ? 'یادداشت ذخیره نشد. دوباره تلاش کنید.' : 'The note was not saved. Try again.') : t('replyFailed')}</p>
  ) : draftError ? (
    <p className="text-xs text-[var(--red)]" role="alert">{draftError}</p>
  ) : noteSaved ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700" role="status" aria-live="polite">
      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {fa ? 'یادداشت در خط زمان گفتگو ثبت شد؛ مشتری آن را نمی‌بیند.' : 'Note added to the timeline; the customer cannot see it.'}
    </p>
  ) : delivery?.status === 'failed' ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-amber-700" role="status" aria-live="polite">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      {fa ? 'ارسال به برنامه ناموفق بود. اتصال برنامه را بررسی و دوباره تلاش کنید.' : 'Channel delivery failed. Check the connection and try again.'}
    </p>
  ) : delivery?.status === 'unavailable' ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-amber-700" role="status" aria-live="polite">
      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      {fa ? 'این برنامه اکنون آمادهٔ ارسال نیست. اتصال برنامه را بررسی کنید.' : 'This channel is not ready to send. Check its connection.'}
    </p>
  ) : delivery?.status === 'sent' ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700" role="status" aria-live="polite">
      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {fa ? 'پیام به برنامه ارسال شد.' : 'Message sent to the channel.'}
    </p>
  ) : delivery?.status === 'stored' ? (
    <p className="inline-flex items-center gap-1.5 text-xs text-emerald-700" role="status" aria-live="polite">
      <CircleCheck className="h-3.5 w-3.5" aria-hidden="true" />
      {fa ? 'پیام در گفتگو ثبت شد و برای کاربر قابل مشاهده است.' : 'Message added to the conversation and visible to the customer.'}
    </p>
  ) : null

  return (
    <div className="space-y-2">
      {draft && (
        <div className="rounded-2xl border border-[var(--signal-border)] bg-[var(--signal-soft)] p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--signal-strong)]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {fa ? 'پیش‌نویس ایجنت' : 'Agent draft'}
            <span className="font-normal text-[var(--text-muted)]">· {fa ? 'هنوز فرستاده نشده' : 'not sent yet'}</span>
          </p>
          <p dir="auto" className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-[var(--text-primary)] [overflow-wrap:anywhere]">{draft}</p>
          {/[\[\]0-9۰-۹]/.test(draft) && (
            <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
              {fa ? 'عددها و جای‌خالی‌های داخل [ ] را قبل از ارسال بازبینی کنید.' : 'Check the figures and the [ ] blanks before sending.'}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void send(draft)}
              disabled={busy || /\[[^\]]+\]/.test(draft)}
              title={/\[[^\]]+\]/.test(draft) ? (fa ? 'اول جای‌خالی‌ها را با «ویرایش» پر کنید' : 'Fill the blanks with Edit first') : undefined}
              className="spatial-press inline-flex min-h-9 items-center gap-1.5 rounded-control bg-[var(--text-primary)] px-3 text-[13px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {fa ? 'ارسال همین' : 'Send as is'}
            </button>
            <button
              type="button"
              onClick={editDraft}
              disabled={busy}
              className="spatial-press inline-flex min-h-9 items-center rounded-control border border-[var(--border-default)] bg-white px-3 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
            >
              {fa ? 'ویرایش' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={busy}
              className="ms-auto inline-flex min-h-9 items-center rounded-control px-2 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {fa ? 'نادیده' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}

      <ChatComposer
        ref={composerRef}
        value={text}
        onChange={(value) => {
          setText(value)
          if (noteSaved) setNoteSaved(false)
        }}
        onSend={() => void (noteMode ? saveNote() : send())}
        busy={busy}
        placeholder={noteMode ? (fa ? 'یادداشت داخلی؛ مشتری نمی‌بیند…' : 'Internal note; the customer will not see it…') : t('replyPlaceholder')}
        inputLabel={noteMode ? (fa ? 'یادداشت داخلی' : 'Internal note') : (fa ? 'پاسخ اپراتور' : 'Operator reply')}
        dir={fa ? 'rtl' : 'ltr'}
        sendLabel={noteMode ? (fa ? 'ثبت یادداشت' : 'Save note') : t('send')}
        maxLength={noteMode ? 1000 : 4000}
        className={cn(noteMode && '[&>div:first-child]:border-[var(--notif-strong)]/35 [&>div:first-child]:bg-[var(--notif-soft)]')}
      />

      <div className="relative flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => void writeDraft()}
          disabled={drafting || busy}
          title={fa ? 'ایجنت یک جواب پیشنهادی می‌نویسد. هر پیش‌نویس به اندازهٔ یک پاسخ از اعتبار کم می‌کند.' : 'The agent writes a suggested reply. Each draft costs one reply of credit.'}
          className={cn(CHIP, 'border-[var(--signal-border)] bg-[var(--signal-soft)] text-[var(--signal-strong)] hover:bg-[var(--signal-tint)]')}
        >
          {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          {drafting ? (fa ? 'در حال نوشتن…' : 'Writing…') : draft ? (fa ? 'پیش‌نویس دیگر' : 'Another draft') : (fa ? 'پیش‌نویس ایجنت' : 'Agent draft')}
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          title={fa ? 'نام، قیمت و لینک یک محصول را به پیام اضافه کنید' : 'Add a product name, price and link to the message'}
          className={cn(CHIP, pickerOpen ? 'border-[var(--text-primary)] bg-white text-[var(--text-primary)]' : CHIP_IDLE)}
        >
          <Package className="h-3.5 w-3.5" aria-hidden="true" />
          {fa ? 'محصول' : 'Product'}
        </button>
        <button
          type="button"
          onClick={() => {
            setNoteMode((on) => !on)
            setError(false)
            composerRef.current?.focus()
          }}
          aria-pressed={noteMode}
          className={cn(CHIP, noteMode ? 'border-[var(--notif-strong)]/40 bg-[var(--notif-tint)] text-[var(--notif-strong)]' : CHIP_IDLE)}
        >
          <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
          {fa ? 'یادداشت' : 'Note'}
        </button>

        {pickerOpen && <ProductPicker fa={fa} tomanLabel={fa ? 'تومان' : 'Toman'} onPick={insertProduct} onClose={() => setPickerOpen(false)} />}
      </div>

      {feedback ?? (
        <p className="truncate text-[12px] leading-5 text-[var(--text-muted)]" title={noteMode ? undefined : t('replyHint')}>
          {noteMode
            ? (fa ? 'یادداشت فقط در خط زمان همین گفتگو برای شما و همکارانتان می‌ماند.' : 'The note stays on this conversation’s timeline for you and your team only.')
            : t('replyHint')}
        </p>
      )}
    </div>
  )
}

/** Search the catalog and paste one product (name, price, link) into the reply. */
function ProductPicker({
  fa,
  tomanLabel,
  onPick,
  onClose,
}: {
  fa: boolean
  tomanLabel: string
  onPick: (product: PickerProduct) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PickerProduct[] | null>(null)
  const [failed, setFailed] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')

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
        const params = new URLSearchParams({ limit: '8', sort: query.trim() ? 'newest' : 'queried' })
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
      aria-label={fa ? 'انتخاب محصول' : 'Pick a product'}
      className="absolute bottom-full start-0 z-30 mb-2 w-full max-w-sm rounded-card border border-[var(--border-default)] bg-white p-2 shadow-[var(--elev-2)]"
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

      <div className="mt-1.5 max-h-60 overflow-y-auto">
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
            {items.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => onPick(product)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-control px-2.5 py-1.5 text-start transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text-primary)]">{product.name}</span>
                  {product.stock === 0 && <span className="shrink-0 text-[12px] text-[var(--red)]">{fa ? 'ناموجود' : 'Out of stock'}</span>}
                  {product.price != null && (
                    <span className="shrink-0 text-[12px] tabular-nums text-[var(--text-secondary)]">{nf.format(product.price)} {tomanLabel}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="border-t border-[var(--border-subtle)] px-2 pt-2 text-[12px] text-[var(--text-muted)]">
        {fa ? 'نام، قیمت و لینک محصول به متن پیام اضافه می‌شود.' : 'The product name, price and link are added to your message.'}
      </p>
    </div>
  )
}
