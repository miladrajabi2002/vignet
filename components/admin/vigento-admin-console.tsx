'use client'

import { FormEvent, useState } from 'react'
import {
  Bot,
  Check,
  Database,
  FileCode2,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Message = { id: string; role: 'assistant' | 'user'; text: string }
type Proposal = { token: string; title: string; description: string; tone: 'warning' | 'danger' }

const QUICK_PROMPTS = [
  'آمار فروش و هزینه AI در ۷ روز اخیر چطور بوده؟',
  'کدام کسب‌وکارها بیشترین تعامل را داشته‌اند؟',
  'چند گفتگوی انتقال‌یافته نیاز به رسیدگی دارد؟',
]

const NODES = [
  { label: 'کاربران', icon: Users },
  { label: 'دیتابیس', icon: Database },
  { label: 'فایل‌ها', icon: FileCode2 },
  { label: 'عملیات', icon: ShieldCheck },
] as const

export function VigentoAdminConsole() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'سلام میلاد؛ من ویجنتوی ادمین هستم. آمار زنده پلتفرم، کاربران، گفتگوها و فایل‌های امن پروژه را بررسی می‌کنم. عملیات مالی و بستن گفتگو فقط بعد از تأیید صریح شما اجرا می‌شود.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [actionState, setActionState] = useState<'idle' | 'running' | 'done'>('idle')

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
      const payload = (await response.json()) as {
        answer?: string
        proposal?: Proposal
        error?: string
      }
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: payload.answer || 'پاسخی دریافت نشد؛ دوباره تلاش کنید.' },
      ])
      if (payload.proposal) setProposal(payload.proposal)
    } catch {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: 'ارتباط با هسته ادمین برقرار نشد. هیچ داده‌ای تغییر نکرد.' },
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
        { id: crypto.randomUUID(), role: 'assistant', text: 'عملیات با موفقیت انجام و رسید آن در تاریخچه ادمین ثبت شد.' },
      ])
    } catch (error) {
      setActionState('idle')
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `عملیات انجام نشد (${error instanceof Error ? error.message : 'خطای نامشخص'}).`,
        },
      ])
    }
  }

  return (
    <section
      aria-labelledby="vigento-admin-title"
      className="relative overflow-hidden rounded-[1.5rem] border border-black/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-white shadow-[0_26px_80px_-42px_rgba(0,0,0,.9)]"
    >
      {/* Animated ambient glow layers */}
      <div
        className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-violet-500/15 blur-[80px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-[80px]"
        aria-hidden="true"
      />
      {/* Subtle dot grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden="true"
      />

      <div className="relative grid min-h-[400px] lg:grid-cols-[.85fr_1.15fr]">
        {/* ═══════════════════════════════════════════════════════════════
            LEFT — Identity + animated node cluster
           ═══════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col justify-between overflow-hidden border-b border-white/8 p-6 sm:p-8 lg:border-b-0 lg:border-l">
          {/* Header */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium text-white/50 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              آنلاین · هسته مالک پلتفرم
            </div>
            <h2 id="vigento-admin-title" className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
              Vigento AI
              <span className="mr-2 font-normal text-white/40">| ویجنتوی ادمین</span>
            </h2>
            <p className="mt-2 max-w-md text-xs leading-6 text-white/40">
              مرکز فرمان میلاد برای فهم داده زنده و اجرای عملیات تأییدشونده
            </p>
          </div>

          {/* Animated node cluster — 4 nodes orbiting a central core */}
          <div className="relative my-6 flex items-center justify-center lg:my-0">
            <div className="relative h-48 w-48 sm:h-56 sm:w-56">
              {/* Orbit rings */}
              <div className="absolute inset-0 rounded-full border border-white/8" />
              <div className="absolute inset-6 rounded-full border border-white/6" />
              <div className="absolute inset-12 rounded-full border border-white/4" />

              {/* Rotating glow ring */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0%, rgba(139,92,246,0.15) 25%, transparent 50%, rgba(16,185,129,0.12) 75%, transparent 100%)',
                  animation: 'vigento-spin 8s linear infinite',
                }}
                aria-hidden="true"
              />

              {/* Center core badge */}
              <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[1.25rem] border border-white/12 bg-black/60 backdrop-blur-md sm:h-24 sm:w-24">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black sm:h-10 sm:w-10">
                  <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <p className="mt-1.5 text-[10px] font-bold tracking-wide sm:text-[11px]">MILAD CORE</p>
              </div>

              {/* 4 corner nodes */}
              {NODES.map(({ label, icon: Icon }, index) => {
                const positions = [
                  'left-0 top-1/2 -translate-y-1/2',
                  'right-0 top-1/2 -translate-y-1/2',
                  'left-1/2 top-0 -translate-x-1/2',
                  'left-1/2 bottom-0 -translate-x-1/2',
                ]
                return (
                  <div
                    key={label}
                    className={cn(
                      'absolute flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/8 px-2.5 py-1.5 text-[10px] font-medium text-white/60 backdrop-blur-md transition-colors hover:bg-white/12 hover:text-white/80',
                      positions[index],
                    )}
                    style={{
                      animation: 'vigento-pulse 3s ease-in-out infinite',
                      animationDelay: `${index * 0.4}s`,
                    }}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-black">
                      <Icon className="h-3 w-3" />
                    </span>
                    {label}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer badge */}
          <div className="relative z-10 flex items-center gap-2 text-[10px] text-white/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            OWNER ONLY · دسترسی مالک پلتفرم
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            RIGHT — Chat interface
           ═══════════════════════════════════════════════════════════════ */}
        <div className="flex min-h-[400px] flex-col bg-[#f7f7f5] p-4 text-black sm:p-6">
          {/* Chat header */}
          <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold">گفتگو با هسته عملیات</p>
                <p className="mt-0.5 text-[9px] text-black/40">داده زنده · فایل امن · عملیات با تأیید</p>
              </div>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">
              فقط میلاد
            </span>
          </div>

          {/* Messages */}
          <div
            className="admin-vigento-messages mt-3 flex-1 space-y-2.5 overflow-y-auto pe-1"
            aria-live="polite"
          >
            {messages.slice(-6).map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-6',
                  message.role === 'user'
                    ? 'me-auto bg-black text-white'
                    : 'ms-auto border border-black/[0.07] bg-white text-black/70 shadow-[0_10px_28px_-24px_rgba(0,0,0,.7)]',
                )}
              >
                {message.text}
              </div>
            ))}
            {loading && (
              <div className="ms-auto flex w-fit items-center gap-2 rounded-2xl border border-black/[0.07] bg-white px-3.5 py-3 text-xs text-black/45">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال بررسی داده زنده…
              </div>
            )}
          </div>

          {/* Proposal card */}
          {proposal && (
            <div
              className={cn(
                'mt-3 rounded-2xl border p-3.5',
                proposal.tone === 'danger' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold">{proposal.title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-black/55">{proposal.description}</p>
                </div>
                <ShieldCheck
                  className={cn(
                    'h-4 w-4 shrink-0',
                    proposal.tone === 'danger' ? 'text-red-600' : 'text-amber-600',
                  )}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={confirmAction}
                  disabled={actionState !== 'idle'}
                  className="admin-primary-button h-10 flex-1 text-xs"
                >
                  {actionState === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : actionState === 'done' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {actionState === 'done' ? 'انجام شد' : 'تأیید و اجرا'}
                </button>
                <button
                  type="button"
                  onClick={() => setProposal(null)}
                  disabled={actionState === 'running'}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-black/55 transition-colors hover:bg-black/[0.04]"
                >
                  <X className="h-3.5 w-3.5" /> لغو
                </button>
              </div>
            </div>
          )}

          {/* Quick prompts */}
          {!proposal && messages.length < 3 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void ask(prompt)}
                  className="min-h-9 shrink-0 rounded-full border border-black/[0.08] bg-white px-3 text-[10px] font-medium text-black/55 transition-[transform,border-color,color] duration-200 hover:border-black/20 hover:text-black active:scale-[.97]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={submit}
            className="mt-3 flex items-end gap-2 rounded-2xl border border-black/[0.09] bg-white p-1.5 shadow-[0_16px_40px_-32px_rgba(0,0,0,.8)] focus-within:border-black/20 focus-within:ring-4 focus-within:ring-black/[0.035]"
          >
            <textarea
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
              placeholder="از ویجنتو درباره کل پلتفرم بپرسید…"
              className="min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-xs leading-5 outline-none placeholder:text-black/30"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="ارسال"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-white transition-transform duration-150 active:scale-[.95] disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Keyframe animations — scoped to this component via a style tag
          to avoid global CSS pollution. These are intentionally subtle. */}
      <style>{`
        @keyframes vigento-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes vigento-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.97); }
        }
      `}</style>
    </section>
  )
}
