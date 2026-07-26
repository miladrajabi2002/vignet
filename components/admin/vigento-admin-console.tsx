'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/chat-composer'
import { ConversationText } from '@/components/chat/conversation-bubble'
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
  const [mode, setMode] = useState<'chat' | 'work'>('chat')
  const [showPrompts, setShowPrompts] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<ChatComposerHandle>(null)

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
      requestAnimationFrame(() => composerRef.current?.focus())
    }
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
      requestAnimationFrame(() => composerRef.current?.focus())
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
  const emptyConversation = !loadingHistory && !messages.some((message) => message.role === 'user')

  return (
    <section
      aria-label="گفتگو با ویجنتو"
      className={cn(
        'admin-vigento-shell spatial-surface relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem]',
        className,
      )}
    >
      <div ref={messagesRef} className="admin-vigento-messages min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-5 sm:py-7" aria-live="polite">
        <div className="sticky top-0 z-10 mx-auto mb-5 flex w-fit rounded-full bg-zinc-100/90 p-1 shadow-[inset_0_0_0_1px_rgba(0,0,0,.035)] backdrop-blur-xl">
          <button type="button" onClick={() => setMode('chat')} className={cn('min-h-9 min-w-24 rounded-full px-5 text-[11px] font-semibold transition-[background-color,color,box-shadow] duration-150', mode === 'chat' ? 'bg-white text-black shadow-[0_3px_12px_rgba(0,0,0,.09)]' : 'text-black/45')}>گفتگو</button>
          <button type="button" onClick={() => { setMode('work'); setShowPrompts(true) }} className={cn('min-h-9 min-w-24 rounded-full px-5 text-[11px] font-semibold transition-[background-color,color,box-shadow] duration-150', mode === 'work' ? 'bg-white text-black shadow-[0_3px_12px_rgba(0,0,0,.09)]' : 'text-black/45')}>عملیات</button>
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {loadingHistory ? (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-black/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              بازیابی تاریخچه گفتگو…
            </div>
          ) : emptyConversation ? (
            <div className="flex min-h-[17rem] flex-1 flex-col items-center justify-center px-4 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]"><Sparkles className="h-[1.125rem] w-[1.125rem]" /></span>
              <h2 id="vigento-admin-title" className="mt-5 text-xl font-medium tracking-[-0.025em] text-black sm:text-2xl">امروز چه کاری را با هم جلو ببریم؟</h2>
              <p className="mt-2 max-w-md text-xs leading-6 text-black/40">از تحلیل وضعیت پلتفرم تا اجرای عملیات مدیریتی تأییدشونده، درخواستتان را طبیعی بنویسید.</p>
            </div>
          ) : messages.map((message) => (
            <article key={message.id} dir={message.role === 'assistant' ? 'ltr' : 'rtl'} className={cn('flex w-fit max-w-[88%] items-start gap-2.5', message.role === 'user' ? 'ml-auto' : 'mr-auto')}>
              {message.role === 'assistant' && <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black text-white"><Sparkles className="h-3.5 w-3.5" /></span>}
              <div dir="rtl" className={cn('rounded-[1.25rem] px-4 py-2.5 text-right text-[13px] leading-7', message.role === 'user' ? 'rounded-tr-md bg-black text-white shadow-[var(--shadow-control)]' : 'rounded-tl-md border border-black/[0.055] bg-zinc-100/80 text-zinc-700')}>
                <ConversationText
                  text={message.text}
                  markdown={message.role === 'assistant'}
                />
              </div>
            </article>
          ))}

          {loading && (
            <div dir="ltr" className="mr-auto flex items-start gap-3" role="status">
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

      <footer className="admin-vigento-composer relative z-10 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
        <div className="mx-auto w-full max-w-3xl">
          {(showPrompts || (!hasConversation && !loadingHistory)) && (
            <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" onClick={() => void ask(prompt)} className="spatial-press min-h-10 shrink-0 rounded-full border border-black/[0.07] bg-white/80 px-3 text-[11px] font-medium text-black/55 hover:border-black/[0.13] hover:text-black">
                  {prompt}
                </button>
              ))}
            </div>
          )}
          <ChatComposer
            ref={composerRef}
            value={input}
            onChange={setInput}
            onSend={() => void ask(input)}
            busy={loading}
            maxLength={1800}
            dir="rtl"
            sendLabel="ارسال پیام"
            inputLabel="پیام به ویجنتو"
            placeholder={mode === 'work' ? 'عملیات مدیریتی موردنظر را بنویسید…' : 'از ویجنتو بپرسید…'}
            leading={
              <>
                <button type="button" onClick={() => setShowPrompts((value) => !value)} className="spatial-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black/65 hover:bg-zinc-100" aria-label="نمایش عملیات پیشنهادی" aria-expanded={showPrompts}><Plus className={cn('h-5 w-5 transition-transform duration-150', showPrompts && 'rotate-45')} /></button>
                <span dir="rtl" className="mb-0.5 hidden h-9 max-w-36 items-center truncate rounded-full bg-zinc-100 px-3 text-[9px] font-medium text-black/45 sm:inline-flex" title={providerId}>{modelLabel}</span>
                <button type="button" onClick={() => void resetChat()} disabled={resetting || loading || (!hasConversation && messages.length === 1)} className="spatial-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black/45 hover:bg-zinc-100 hover:text-black disabled:opacity-25" aria-label="گفتگوی جدید" title="گفتگوی جدید">{resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}</button>
              </>
            }
            footer={<p className="mt-1.5 flex items-center justify-center gap-1.5 text-[9px] text-black/30"><ShieldCheck className="h-3 w-3" /> تغییرات حساس فقط پس از تأیید شما اجرا می‌شوند</p>}
          />
        </div>
      </footer>
    </section>
  )
}
