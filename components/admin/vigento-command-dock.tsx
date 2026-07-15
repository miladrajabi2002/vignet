'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  Bot,
  Check,
  Command,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Message = { id: string; role: 'assistant' | 'user'; text: string }
type Proposal = { token: string; title: string; description: string; tone: 'warning' | 'danger' }

const STARTERS = [
  'چه چیزی امروز نیاز به توجه دارد؟',
  'سلامت سرویس‌ها و صف‌ها را بررسی کن',
  'گزارش یک کاربر یا کسب‌وکار را پیدا کن',
]

export function openVigentoDock() {
  window.dispatchEvent(new Event('vigento:open'))
}

export function VigentoCommandTrigger({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openVigentoDock} className={className}>
      <Sparkles className="h-4 w-4" />
      فرمان به ویجنتو
      <span className="ms-auto hidden items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-white/45 xl:inline-flex">
        <Command className="h-2.5 w-2.5" /> K
      </span>
    </button>
  )
}

export function VigentoCommandDock() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'من ویجنتوی ادمین هستم؛ به داده‌های عملیاتی و ابزارهای تأییدشونده مالک دسترسی دارم. چه چیزی را بررسی یا مدیریت کنیم؟',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [actionState, setActionState] = useState<'idle' | 'running' | 'done'>('idle')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(true)
      } else if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('vigento:open', onOpen)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('vigento:open', onOpen)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, loading, proposal])

  async function ask(message: string) {
    const prompt = message.trim()
    if (!prompt || loading) return
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text: prompt }])
    setInput('')
    setProposal(null)
    setActionState('idle')
    setLoading(true)
    try {
      const response = await fetch('/api/admin/vigento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt }),
      })
      const payload = (await response.json()) as { answer?: string; proposal?: Proposal; error?: string }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: payload.answer || (response.ok ? 'پاسخی دریافت نشد.' : 'درخواست کامل نشد؛ هیچ داده‌ای تغییر نکرد.'),
        },
      ])
      if (payload.proposal) setProposal(payload.proposal)
    } catch {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: 'ارتباط با هسته عملیات برقرار نشد؛ هیچ داده‌ای تغییر نکرد.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void ask(input)
  }

  async function confirmAction() {
    if (!proposal || actionState !== 'idle') return
    setActionState('running')
    try {
      const response = await fetch('/api/admin/vigento/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: proposal.token }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'ACTION_FAILED')
      setActionState('done')
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: 'عملیات اجرا شد و رسید آن در تاریخچه ادمین ثبت شد.' },
      ])
    } catch (error) {
      setActionState('idle')
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: `عملیات انجام نشد (${error instanceof Error ? error.message : 'خطای نامشخص'}).` },
      ])
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="admin-vigento-fab group fixed bottom-4 left-4 z-40 flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-[#111214] px-3.5 text-xs font-bold text-white shadow-[0_18px_60px_-22px_rgba(0,0,0,.8)] transition-[transform,box-shadow] duration-200 active:scale-[.97] sm:bottom-6 sm:left-6"
        aria-label="باز کردن ویجنتوی ادمین"
        aria-expanded={open}
      >
        <span className="relative grid h-7 w-7 place-items-center rounded-xl bg-white text-black">
          <Bot className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-[#111214] bg-emerald-400" />
        </span>
        <span className="hidden sm:inline">ویجنتو</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70]" role="presentation">
          <button
            type="button"
            className="admin-command-backdrop absolute inset-0 bg-black/35 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="بستن ویجنتو"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="vigento-dock-title"
            className="admin-command-sheet spatial-control absolute inset-x-2 bottom-2 flex max-h-[min(47rem,calc(100dvh-1rem))] flex-col overflow-hidden rounded-[1.75rem] border-white/70 bg-[#f8f8f6]/95 shadow-[0_32px_100px_-28px_rgba(0,0,0,.85)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[30rem]"
          >
            <header className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3.5">
              <span className="grid h-10 w-10 place-items-center rounded-[.9rem] bg-black text-white shadow-[var(--shadow-control)]">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 id="vigento-dock-title" className="text-sm font-black text-black">Vigento Command</h2>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </div>
                <p className="mt-0.5 text-[10px] text-black/45">مالک پلتفرم · داده زنده · عملیات ثبت‌شونده</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-black/[0.07] bg-white text-black/45 transition-colors hover:bg-black/[0.04] hover:text-black" aria-label="بستن">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
              <div className="space-y-2.5">
                {messages.slice(-10).map((message) => (
                  <div key={message.id} className={cn('max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-6', message.role === 'user' ? 'me-auto bg-black text-white' : 'ms-auto border border-black/[0.07] bg-white text-black/70 shadow-sm')}>
                    {message.text}
                  </div>
                ))}
                {loading && (
                  <div className="ms-auto flex w-fit items-center gap-2 rounded-2xl border border-black/[0.07] bg-white px-3.5 py-3 text-xs text-black/45">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال تحلیل…
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {messages.length === 1 && !loading && (
                <div className="mt-4 grid gap-2">
                  {STARTERS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => void ask(prompt)} className="flex min-h-11 items-center rounded-xl border border-black/[0.07] bg-white px-3 text-start text-[11px] font-semibold text-black/55 transition-[transform,border-color,color] hover:border-black/20 hover:text-black active:scale-[.985]">
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {proposal && (
                <div className={cn('mt-4 rounded-2xl border p-3.5', proposal.tone === 'danger' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')}>
                  <div className="flex items-start gap-3">
                    <ShieldCheck className={cn('mt-0.5 h-4 w-4 shrink-0', proposal.tone === 'danger' ? 'text-red-600' : 'text-amber-600')} />
                    <div><p className="text-xs font-bold">{proposal.title}</p><p className="mt-1 text-xs leading-5 text-black/60">{proposal.description}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={confirmAction} disabled={actionState !== 'idle'} className="admin-primary-button flex-1 text-xs">
                      {actionState === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : actionState === 'done' ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      {actionState === 'done' ? 'انجام شد' : 'تأیید و اجرا'}
                    </button>
                    <button type="button" onClick={() => setProposal(null)} disabled={actionState === 'running'} className="min-h-11 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-black/55">لغو</button>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={submit} className="m-3 mt-0 flex items-end gap-2 rounded-2xl border border-black/[0.09] bg-white p-1.5 shadow-[0_14px_38px_-30px_rgba(0,0,0,.8)] focus-within:border-black/20 focus-within:ring-4 focus-within:ring-black/[0.035]">
              <textarea ref={inputRef} rows={1} maxLength={1800} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(input) } }} placeholder="یک گزارش یا عملیات مدیریتی بنویسید…" className="min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-xs leading-5 outline-none placeholder:text-black/30" />
              <button type="submit" disabled={!input.trim() || loading} aria-label="ارسال" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black text-white transition-transform duration-150 active:scale-[.95] disabled:cursor-not-allowed disabled:opacity-30">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
