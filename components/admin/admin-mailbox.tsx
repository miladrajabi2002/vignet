'use client'

import { useMemo, useState } from 'react'
import { Check, Mail, Paperclip, Reply, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLocalizedDateTime } from '@/lib/localized-date'

export interface AdminMailboxItem {
  id: string
  from: string
  to: string[]
  subject: string
  text: string | null
  preview: string
  receivedAt: string
  readAt: string | null
  repliedAt: string | null
  replyText: string | null
  attachmentCount: number
}

export function AdminMailbox({ initialItems }: { initialItems: AdminMailboxItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [selectedId, setSelectedId] = useState(
    initialItems.find((item) => !item.readAt)?.id || initialItems[0]?.id || null,
  )
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  )

  async function selectMessage(id: string) {
    setSelectedId(id)
    setNotice(null)
    const item = items.find((row) => row.id === id)
    if (!item || item.readAt) return
    const readAt = new Date().toISOString()
    setItems((current) => current.map((row) => row.id === id ? { ...row, readAt } : row))
    await fetch(`/api/admin/mail/${id}/read`, { method: 'POST' }).catch(() => undefined)
  }

  async function replyToMessage(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !replyText.trim() || sending) return
    setSending(true)
    setNotice(null)
    try {
      const response = await fetch(`/api/admin/mail/${selected.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText }),
      })
      if (!response.ok) throw new Error('REPLY_FAILED')
      const repliedAt = new Date().toISOString()
      setItems((current) => current.map((row) => row.id === selected.id
        ? { ...row, replyText: replyText.trim(), repliedAt, readAt: row.readAt || repliedAt }
        : row))
      setReplyText('')
      setNotice('پاسخ ارسال شد.')
    } catch {
      setNotice('پاسخ ارسال نشد؛ تنظیمات Resend را بررسی کنید.')
    } finally {
      setSending(false)
    }
  }

  if (!items.length) {
    return (
      <div className="spatial-surface rounded-[1.5rem] px-6 py-20 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-black text-white">
          <Mail className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-base font-bold text-black">صندوق خالی است</h2>
        <p className="mt-1 text-sm text-black/45">اولین پیام info@vigent.ir اینجا نمایش داده می‌شود.</p>
      </div>
    )
  }

  return (
    <div className="grid min-h-[36rem] gap-4 lg:grid-cols-[minmax(17rem,.78fr)_minmax(0,1.4fr)]">
      <section aria-label="فهرست ایمیل‌ها" className="spatial-surface overflow-hidden rounded-[1.5rem]">
        <div className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3.5">
          <div>
            <h2 className="text-sm font-bold text-black">پیام‌ها</h2>
            <p className="mt-0.5 text-[11px] text-black/40">جدیدترین پیام‌ها در بالا</p>
          </div>
          <span className="rounded-full bg-black px-2.5 py-1 text-[10px] font-bold text-white">
            {items.filter((item) => !item.readAt).length.toLocaleString('fa-IR')} خوانده‌نشده
          </span>
        </div>
        <div className="max-h-[40rem] divide-y divide-black/[0.055] overflow-y-auto [scrollbar-width:thin]">
          {items.map((item) => {
            const active = item.id === selectedId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectMessage(item.id)}
                className={cn(
                  'group relative flex w-full items-start gap-3 px-4 py-4 text-start transition-colors',
                  active ? 'bg-black text-white' : 'hover:bg-black/[0.035]',
                )}
              >
                <span className={cn(
                  'grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold',
                  active ? 'bg-white/12 text-white' : 'bg-black/[0.055] text-black/65',
                )}>
                  {senderInitial(item.from)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <b dir="ltr" className="truncate text-xs">{item.from}</b>
                    {!item.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="خوانده‌نشده" />}
                  </span>
                  <span className={cn('mt-1 block truncate text-sm', item.readAt ? 'font-medium' : 'font-bold')}>
                    {item.subject}
                  </span>
                  <span className={cn('mt-1 line-clamp-2 text-[11px] leading-5', active ? 'text-white/58' : 'text-black/40')}>
                    {item.preview}
                  </span>
                  <span className={cn('mt-2 flex items-center gap-2 text-[10px]', active ? 'text-white/45' : 'text-black/35')}>
                    {formatLocalizedDateTime(item.receivedAt, 'fa')}
                    {item.attachmentCount > 0 && <><Paperclip className="h-3 w-3" />{item.attachmentCount.toLocaleString('fa-IR')}</>}
                    {item.repliedAt && <><Check className="h-3 w-3" />پاسخ داده‌شده</>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="spatial-surface flex min-w-0 flex-col overflow-hidden rounded-[1.5rem]">
        {selected ? (
          <>
            <header className="border-b border-black/[0.07] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p dir="ltr" className="truncate text-xs font-semibold text-black/45">{selected.from}</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-black">{selected.subject}</h2>
                  <p className="mt-2 text-[11px] text-black/38">به {selected.to.join('، ')}</p>
                </div>
                <time className="shrink-0 rounded-lg bg-black/[0.045] px-2.5 py-1.5 text-[10px] text-black/45">
                  {formatLocalizedDateTime(selected.receivedAt, 'fa')}
                </time>
              </div>
            </header>
            <div className="min-h-[15rem] flex-1 whitespace-pre-wrap px-5 py-6 text-sm leading-8 text-black/72 sm:px-6" dir="auto">
              {selected.text || selected.preview}
            </div>
            {selected.replyText && (
              <div className="mx-5 mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:mx-6">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800"><Reply className="h-3.5 w-3.5" />پاسخ شما</p>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-emerald-900/75">{selected.replyText}</p>
              </div>
            )}
            <form onSubmit={replyToMessage} className="border-t border-black/[0.07] bg-black/[0.018] p-4 sm:p-5">
              <label htmlFor="admin-mail-reply" className="mb-2 block text-xs font-bold text-black/65">پاسخ از info@vigent.ir</label>
              <textarea
                id="admin-mail-reply"
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                rows={4}
                maxLength={10_000}
                placeholder="پاسخ را بنویسید…"
                className="input min-h-28 resize-y text-sm leading-7"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p role="status" className={cn('text-[11px]', notice?.includes('نشد') ? 'text-red-600' : 'text-emerald-700')}>{notice}</p>
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                  {sending ? 'در حال ارسال…' : 'ارسال پاسخ'}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </section>
    </div>
  )
}

function senderInitial(sender: string): string {
  const value = sender.split('@')[0]?.replace(/[^\p{L}\p{N}]/gu, '')
  return (value?.[0] || 'M').toUpperCase()
}
