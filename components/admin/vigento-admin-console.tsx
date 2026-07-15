'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { Check, Loader2, Send, ShieldCheck, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Message = { id: string; role: 'assistant' | 'user'; text: string }
type Proposal = { token: string; title: string; description: string; tone: 'warning' | 'danger' }

const QUICK_PROMPTS = [
  'امروز چه چیزی نیاز به توجه فوری دارد؟',
  'سلامت کاربران، ایجنت‌ها و گفتگوها را تحلیل کن',
  'عملیات مدیریتی قابل انجام را به من بگو',
]

const NODES = [
  { id: 'users', label: 'کاربران', x: 42, y: 42 },
  { id: 'revenue', label: 'درآمد', x: 42, y: 158 },
  { id: 'conversations', label: 'گفتگوها', x: 358, y: 42 },
  { id: 'agents', label: 'ایجنت‌ها', x: 358, y: 158 },
  { id: 'services', label: 'سرویس‌ها', x: 200, y: 26 },
  { id: 'ai', label: 'هوش مصنوعی', x: 200, y: 174 },
] as const

const CORE = { x: 200, y: 100 }

export function VigentoAdminConsole({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'سلام میلاد؛ من ویجنتوی ادمین هستم. وضعیت کل پلتفرم را تحلیل می‌کنم و هر تغییر حساس را فقط بعد از نمایش جزئیات و تأیید صریح شما انجام می‌دهم.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [actionState, setActionState] = useState<'idle' | 'running' | 'done'>('idle')
  const messagesRef = useRef<HTMLDivElement>(null)

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
        { id: crypto.randomUUID(), role: 'assistant', text: payload.answer || 'پاسخی دریافت نشد؛ دوباره تلاش کنید.' },
      ])
      if (payload.proposal) setProposal(payload.proposal)
    } catch {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', text: 'ارتباط با هسته مدیریت برقرار نشد. هیچ داده‌ای تغییر نکرد.' },
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

  return (
    <section aria-labelledby="vigento-admin-title" className={cn('admin-vigento-shell relative flex min-h-[700px] flex-col overflow-hidden rounded-[1.75rem] border border-black bg-black text-white shadow-[0_32px_90px_-44px_rgba(0,0,0,.92)]', className)}>
      <div className="admin-vigento-grid pointer-events-none absolute inset-0 opacity-45" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-[12%] top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden="true" />

      <header className="relative flex flex-col gap-4 border-b border-white/[0.08] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="relative grid h-11 w-11 place-items-center rounded-2xl border border-white/15 bg-white/[0.07]">
            <span className="absolute inset-1 animate-ping rounded-xl border border-white/15 opacity-25 motion-reduce:animate-none" />
            <Sparkles className="relative h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="vigento-admin-title" className="text-lg font-bold">ویجنتو؛ هسته مدیریت</h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] text-white/60">
                <span className="relative h-1.5 w-1.5 rounded-full bg-white"><span className="absolute inset-0 animate-ping rounded-full bg-white opacity-50 motion-reduce:animate-none" /></span>
                آنلاین
              </span>
            </div>
            <p className="mt-1 text-[11px] text-white/45">تحلیل زنده، گفتگو و اجرای عملیات مدیریتی در یک فضای واحد</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-white/45">
          <ShieldCheck className="h-3.5 w-3.5" />
          دسترسی اختصاصی مالک · همه عملیات ثبت می‌شوند
        </div>
      </header>

      <div className="relative grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(22rem,.82fr)_minmax(32rem,1.18fr)]">
        <div className="relative flex min-h-[280px] items-center justify-center overflow-hidden border-b border-white/[0.08] p-5 lg:border-b-0 lg:border-l">
          <svg viewBox="0 0 400 200" className="h-full max-h-[250px] w-full" role="img" aria-label="اتصال ویجنتو به بخش‌های مختلف پلتفرم">
            <defs>
              <filter id="vigento-core-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {NODES.map((node) => <line key={`line-${node.id}`} x1={node.x} y1={node.y} x2={CORE.x} y2={CORE.y} stroke="rgba(255,255,255,.2)" strokeWidth=".8" strokeDasharray="3 4" />)}
            {NODES.map((node, index) => (
              <circle key={`flow-${node.id}`} r="2" fill="white" filter="url(#vigento-core-glow)">
                <animateMotion dur={`${2.6 + index * 0.22}s`} repeatCount="indefinite" begin={`${index * 0.28}s`} path={`M${node.x},${node.y} L${CORE.x},${CORE.y}`} />
                <animate attributeName="opacity" values="0;1;1;0" dur={`${2.6 + index * 0.22}s`} repeatCount="indefinite" begin={`${index * 0.28}s`} />
              </circle>
            ))}
            <circle cx={CORE.x} cy={CORE.y} r="38" fill="none" stroke="rgba(255,255,255,.12)"><animate attributeName="r" values="38;48;38" dur="3s" repeatCount="indefinite" /><animate attributeName="opacity" values=".55;0;.55" dur="3s" repeatCount="indefinite" /></circle>
            <circle cx={CORE.x} cy={CORE.y} r="27" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.3)" filter="url(#vigento-core-glow)" />
            <circle cx={CORE.x} cy={CORE.y} r="4" fill="white"><animate attributeName="r" values="4;5.5;4" dur="1.7s" repeatCount="indefinite" /></circle>
            <text x={CORE.x} y={CORE.y + 50} textAnchor="middle" fill="rgba(255,255,255,.62)" fontSize="9">ویجنتو</text>
            {NODES.map((node) => (
              <g key={node.id}>
                <circle cx={node.x} cy={node.y} r="12" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.2)" />
                <circle cx={node.x} cy={node.y} r="2.5" fill="white" />
                <text x={node.x} y={node.y - 18} textAnchor="middle" fill="rgba(255,255,255,.55)" fontSize="8">{node.label}</text>
              </g>
            ))}
          </svg>
          <p className="absolute bottom-4 inset-x-5 text-center text-[10px] leading-5 text-white/35">ویجنتو به داده‌های زنده پلتفرم متصل است؛ تغییرات حساس همیشه نیازمند تأیید شما هستند.</p>
        </div>

        <div className="flex min-h-[520px] flex-col overflow-hidden p-4 sm:p-5 lg:min-h-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-sm font-bold">گفتگو با ویجنتو</p><p className="mt-0.5 text-[10px] text-white/40">پرسش، تحلیل و عملیات مدیریتی</p></div>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-white/45">فقط مالک</span>
          </div>

          <div ref={messagesRef} className="admin-vigento-messages min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain rounded-[1.35rem] border border-white/[0.08] bg-white/[0.035] p-3" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={cn('max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-6', message.role === 'user' ? 'me-auto bg-white text-black' : 'ms-auto border border-white/[0.09] bg-white/[0.055] text-white/72')}>
                {message.text}
              </div>
            ))}
            {loading && <div className="ms-auto flex w-fit items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.05] px-3.5 py-3 text-xs text-white/45"><Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال بررسی داده‌های زنده…</div>}
          </div>

          {proposal && (
            <div className="mt-3 rounded-2xl border border-white/15 bg-white/[0.07] p-3.5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold">{proposal.title}</p><p className="mt-1 text-xs leading-5 text-white/55">{proposal.description}</p></div><ShieldCheck className="h-4 w-4 shrink-0 text-white/55" /></div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={confirmAction} disabled={actionState !== 'idle'} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-black transition-transform duration-150 active:scale-[.97] disabled:opacity-40">
                  {actionState === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : actionState === 'done' ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                  {actionState === 'done' ? 'انجام شد' : 'تأیید و اجرا'}
                </button>
                <button type="button" onClick={() => setProposal(null)} disabled={actionState === 'running'} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-white/12 px-3 text-xs font-bold text-white/55"><X className="h-3.5 w-3.5" /> لغو</button>
              </div>
            </div>
          )}

          {!proposal && messages.length < 3 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{QUICK_PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => void ask(prompt)} className="min-h-10 shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[10px] font-medium text-white/55 transition-[background-color,transform] duration-150 hover:bg-white/[0.08] active:scale-[.97]">{prompt}</button>)}</div>}

          <form dir="ltr" onSubmit={submit} className="mt-3 flex items-end gap-2 rounded-2xl border border-white/12 bg-white p-1.5 text-black shadow-[0_16px_40px_-32px_rgba(0,0,0,.8)] focus-within:ring-4 focus-within:ring-white/10">
            <textarea dir="rtl" rows={1} maxLength={1800} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(input) } }} placeholder="درباره وضعیت پلتفرم بپرسید یا یک عملیات را درخواست کنید…" className="min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-right text-xs leading-5 outline-none placeholder:text-black/35" />
            <button type="submit" disabled={!input.trim() || loading} aria-label="ارسال" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-white transition-transform duration-150 active:scale-[.95] disabled:cursor-not-allowed disabled:opacity-30"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </section>
  )
}
