'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  Check,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Message = { id: string; role: 'assistant' | 'user'; text: string }
type Proposal = { token: string; title: string; description: string; tone: 'warning' | 'danger' }

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  text: 'سلام؛ من ویجنتوی ادمین هستم. وضعیت پلتفرم را با داده زنده بررسی می‌کنم و عملیات حساس را فقط بعد از نمایش جزئیات و تأیید شما انجام می‌دهم.',
}

const QUICK_PROMPTS = [
  'امروز چه چیزی نیاز به توجه فوری دارد؟',
  'سلامت کاربران، ایجنت‌ها و گفتگوها را تحلیل کن',
  'کاربران جدید و وضعیت راه‌اندازی آن‌ها را بررسی کن',
] as const

export function VigentoAdminConsole({
  className,
  modelLabel,
  providerId,
}: {
  className?: string
  modelLabel: string
  providerId: string
}) {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [actionState, setActionState] = useState<'idle' | 'running' | 'done'>('idle')
  const messagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let active = true
    void fetch('/api/admin/vigento', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { messages?: Message[] }) => {
        if (!active || !payload.messages?.length) return
        setMessages(payload.messages.filter((message) => message.role === 'assistant' || message.role === 'user'))
      })
      .finally(() => {
        if (active) setLoadingHistory(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const panel = messagesRef.current
    if (!panel) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    panel.scrollTo({ top: panel.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
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
          text: payload.answer || 'پاسخی دریافت نشد؛ دوباره تلاش کنید.',
        },
      ])
      if (payload.proposal) setProposal(payload.proposal)
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'ارتباط با هسته مدیریت برقرار نشد. هیچ داده‌ای تغییر نکرد.',
        },
      ])
    } finally {
      setLoading(false)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    void ask(input)
  }

  async function resetChat() {
    if (resetting || !window.confirm('تاریخچه گفتگوی ویجنتو پاک شود و یک گفتگوی تازه شروع شود؟')) return
    setResetting(true)
    try {
      const response = await fetch('/api/admin/vigento', { method: 'DELETE' })
      if (!response.ok) throw new Error('RESET_FAILED')
      const payload = (await response.json()) as { message?: Message }
      setMessages([payload.message ?? WELCOME])
      setProposal(null)
      setActionState('idle')
      setInput('')
    } catch {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: 'پاک‌کردن تاریخچه انجام نشد؛ لطفاً دوباره تلاش کنید.' },
      ])
    } finally {
      setResetting(false)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  async function confirmAction() {
    if (!proposal || actionState === 'running') return
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
        { id: crypto.randomUUID(), role: 'assistant', text: 'عملیات انجام شد و رسید آن در تاریخچه مدیریت ثبت شد.' },
      ])
    } catch (error) {
      setActionState('idle')
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: `عملیات انجام نشد (${error instanceof Error ? error.message : 'خطای نامشخص'}).` },
      ])
    }
  }

  const hasConversation = messages.some((message) => message.id !== 'welcome' || message.role === 'user')

  return (
    <section
      aria-labelledby="vigento-admin-title"
      className={cn(
        'admin-vigento-shell spatial-surface relative flex min-h-[calc(100dvh-10.5rem)] flex-col overflow-hidden rounded-[1.75rem]',
        className,
      )}
    >
      <header className="admin-vigento-toolbar relative z-10 flex min-h-[4.5rem] items-center justify-between gap-3 border-b border-black/[0.06] px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[.9rem] bg-black text-white shadow-[var(--shadow-control)]">
            <Sparkles className="h-[1.1rem] w-[1.1rem]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="vigento-admin-title" className="truncate text-sm font-bold text-black">ویجنتو</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                آنلاین
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-black/45" title={providerId}>
              {modelLabel} · تاریخچه ماندگار و عملیات تأییدشونده
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void resetChat()}
          disabled={resetting || loading || (!hasConversation && messages.length === 1)}
          className="admin-toolbar-button min-h-10 shrink-0"
          aria-label="شروع گفتگوی جدید و پاک‌کردن تاریخچه"
          title="گفتگوی جدید"
        >
          {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          <span className="hidden sm:inline">گفتگوی جدید</span>
        </button>
      </header>

      <div ref={messagesRef} className="admin-vigento-messages min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-5 sm:py-7" aria-live="polite">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {loadingHistory ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-black/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              بازیابی تاریخچه گفتگو…
            </div>
          ) : messages.map((message) => (
            <article key={message.id} className={cn('flex items-start gap-3', message.role === 'user' && 'justify-end')}>
              {message.role === 'assistant' && (
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
              )}
              <div
                className={cn(
                  'whitespace-pre-wrap text-[13px] leading-7',
                  message.role === 'user'
                    ? 'max-w-[86%] rounded-[1.35rem] rounded-se-md bg-zinc-100 px-4 py-2.5 text-zinc-900 ring-1 ring-black/[0.04]'
                    : 'max-w-[calc(100%_-_2.75rem)] flex-1 pt-0.5 text-zinc-700',
                )}
              >
                {message.text}
              </div>
            </article>
          ))}

          {loading && (
            <div className="flex items-start gap-3" role="status">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black text-white"><Sparkles className="h-3.5 w-3.5" /></span>
              <div className="flex items-center gap-1.5 pt-2 text-black/35">
                <span className="admin-typing-dot" />
                <span className="admin-typing-dot [animation-delay:120ms]" />
                <span className="admin-typing-dot [animation-delay:240ms]" />
                <span className="sr-only">ویجنتو در حال بررسی است</span>
              </div>
            </div>
          )}

          {proposal && (
            <div className={cn('ms-11 rounded-2xl border p-4', proposal.tone === 'danger' ? 'border-red-200 bg-red-50/80' : 'border-amber-200 bg-amber-50/80')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-zinc-950">{proposal.title}</p>
                  <p className="mt-1 text-xs leading-6 text-zinc-600">{proposal.description}</p>
                </div>
                <ShieldCheck className="h-5 w-5 shrink-0 text-zinc-500" />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={confirmAction} disabled={actionState !== 'idle'} className={cn('admin-primary-button flex-1', proposal.tone === 'danger' && 'bg-red-600')}>
                  {actionState === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : actionState === 'done' ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {actionState === 'done' ? 'انجام شد' : 'تأیید و اجرا'}
                </button>
                <button type="button" onClick={() => setProposal(null)} disabled={actionState === 'running'} className="admin-toolbar-button">
                  <X className="h-4 w-4" /> لغو
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="admin-vigento-composer relative z-10 border-t border-black/[0.055] px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        <div className="mx-auto w-full max-w-3xl">
          {!hasConversation && !loadingHistory && (
            <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" onClick={() => void ask(prompt)} className="spatial-press min-h-10 shrink-0 rounded-full border border-black/[0.07] bg-white/80 px-3 text-[11px] font-medium text-black/55 hover:border-black/[0.13] hover:text-black">
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <form dir="ltr" onSubmit={submit} className="flex items-end gap-2 rounded-[1.4rem] border border-black/[0.09] bg-white p-1.5 shadow-[0_14px_38px_-24px_rgba(0,0,0,.28)] transition-[border-color,box-shadow] focus-within:border-black/20 focus-within:shadow-[0_18px_44px_-24px_rgba(0,0,0,.34)]">
            <textarea
              ref={textareaRef}
              dir="rtl"
              rows={1}
              maxLength={1800}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void ask(input)
                }
              }}
              placeholder="از ویجنتو درباره پلتفرم بپرسید…"
              className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-3 text-right text-[13px] leading-5 text-zinc-900 outline-none placeholder:text-black/30"
              aria-label="پیام به ویجنتو"
            />
            <button type="submit" disabled={!input.trim() || loading} aria-label="ارسال پیام" className="spatial-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white disabled:cursor-not-allowed disabled:opacity-25">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rtl:-scale-x-100" />}
            </button>
          </form>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-black/35">
            <ShieldCheck className="h-3 w-3" />
            تغییرات حساس فقط پس از تأیید شما اجرا می‌شوند
          </p>
        </div>
      </footer>
    </section>
  )
}
