'use client'

import { FormEvent, useState } from 'react'
import { Bot, Check, Database, FileCode2, Loader2, MessageSquareText, Send, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Message = { id: string; role: 'assistant' | 'user'; text: string }
type Proposal = { token: string; title: string; description: string; tone: 'warning' | 'danger' }

const QUICK_PROMPTS = [
  'آمار فروش و هزینه AI در ۷ روز اخیر چطور بوده؟',
  'کدام کسب‌وکارها بیشترین تعامل را داشته‌اند؟',
  'چند گفتگوی انتقال‌یافته نیاز به رسیدگی دارد؟',
]

const NODES = [
  { label: 'کاربران', icon: Users, className: 'end-3 top-4 sm:end-6 sm:top-6' },
  { label: 'دیتابیس', icon: Database, className: 'start-3 top-4 sm:start-6 sm:top-6' },
  { label: 'فایل‌ها', icon: FileCode2, className: 'start-3 bottom-4 sm:start-6 sm:bottom-6' },
  { label: 'عملیات', icon: ShieldCheck, className: 'end-3 bottom-4 sm:end-6 sm:bottom-6' },
] as const

export function VigentoAdminConsole() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'welcome', role: 'assistant', text: 'سلام میلاد؛ من ویجنتوی ادمین هستم. آمار زنده پلتفرم، کاربران، گفتگوها و فایل‌های امن پروژه را بررسی می‌کنم. عملیات مالی و بستن گفتگو فقط بعد از تأیید صریح شما اجرا می‌شود.' },
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
      const payload = await response.json() as { answer?: string; proposal?: Proposal; error?: string }
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: payload.answer || 'پاسخی دریافت نشد؛ دوباره تلاش کنید.' }])
      if (payload.proposal) setProposal(payload.proposal)
    } catch {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'ارتباط با هسته ادمین برقرار نشد. هیچ داده‌ای تغییر نکرد.' }])
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
      const payload = await response.json() as { ok?: boolean; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'ACTION_FAILED')
      setActionState('done')
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'عملیات با موفقیت انجام و رسید آن در تاریخچه ادمین ثبت شد.' }])
    } catch (error) {
      setActionState('idle')
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: `عملیات انجام نشد (${error instanceof Error ? error.message : 'خطای نامشخص'}).` }])
    }
  }

  return (
    <section aria-labelledby="vigento-admin-title" className="admin-vigento-shell overflow-hidden rounded-[1.7rem] border border-black/10 bg-black text-white shadow-[0_26px_80px_-42px_rgba(0,0,0,.9)]">
      <div className="grid min-h-[430px] lg:grid-cols-[.82fr_1.18fr]">
        <div className="relative min-h-[270px] overflow-hidden border-b border-white/10 p-5 sm:p-7 lg:min-h-full lg:border-b-0 lg:border-l">
          <div className="admin-vigento-grid absolute inset-0 opacity-55" aria-hidden="true" />
          <div className="admin-vigento-orbit absolute inset-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 sm:h-52 sm:w-52" aria-hidden="true" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.11),transparent_42%)]" aria-hidden="true" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] text-white/45"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" /> هسته مالک پلتفرم آنلاین است</div>
              <h2 id="vigento-admin-title" className="mt-3 text-xl font-bold sm:text-2xl">Vigento AI <span className="font-medium text-white/45">| ویجنتوی ادمین</span></h2>
              <p className="mt-2 max-w-md text-xs leading-6 text-white/45">مرکز فرمان میلاد برای فهم داده زنده و اجرای عملیات تأییدشونده</p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-black shadow-[0_12px_28px_-16px_rgba(255,255,255,.8)]"><Sparkles className="h-5 w-5" /></span>
          </div>

          {NODES.map(({ label, icon: Icon, className }, index) => (
            <div key={label} className={cn('absolute flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.075] px-2.5 py-2 text-[10px] text-white/65 shadow-[0_14px_36px_-22px_rgba(0,0,0,.9)] backdrop-blur-xl', className)} style={{ animationDelay: `${index * 160}ms` }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-black"><Icon className="h-3.5 w-3.5" /></span>{label}<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </div>
          ))}

          <div className="absolute inset-1/2 flex h-[108px] w-[108px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[2rem] border border-white/15 bg-black/80 shadow-[0_0_0_8px_rgba(255,255,255,.025),0_24px_70px_-30px_rgba(255,255,255,.35)] backdrop-blur-xl sm:h-[128px] sm:w-[128px]">
            <div className="text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black"><Bot className="h-5 w-5" /></span><p className="mt-2 text-xs font-bold">MILAD CORE</p><p className="mt-1 text-[8px] text-white/35">OWNER ONLY</p></div>
          </div>
        </div>

        <div className="flex min-h-[430px] flex-col bg-[#f7f7f5] p-4 text-black sm:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] pb-3">
            <div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white"><MessageSquareText className="h-4 w-4" /></span><div><p className="text-sm font-bold">گفتگو با هسته عملیات</p><p className="mt-0.5 text-[9px] text-black/40">داده زنده · فایل امن · عملیات با تأیید</p></div></div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">فقط میلاد</span>
          </div>

          <div className="admin-vigento-messages mt-3 flex-1 space-y-2.5 overflow-y-auto pe-1" aria-live="polite">
            {messages.slice(-6).map((message) => (
              <div key={message.id} className={cn('max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-6', message.role === 'user' ? 'me-auto bg-black text-white' : 'ms-auto border border-black/[0.07] bg-white text-black/70 shadow-[0_10px_28px_-24px_rgba(0,0,0,.7)]')}>
                {message.text}
              </div>
            ))}
            {loading && <div className="ms-auto flex w-fit items-center gap-2 rounded-2xl border border-black/[0.07] bg-white px-3.5 py-3 text-xs text-black/45"><Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال بررسی داده زنده…</div>}
          </div>

          {proposal && (
            <div className={cn('mt-3 rounded-2xl border p-3.5', proposal.tone === 'danger' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold">{proposal.title}</p><p className="mt-1 text-[11px] leading-5 text-black/55">{proposal.description}</p></div><ShieldCheck className={cn('h-4 w-4 shrink-0', proposal.tone === 'danger' ? 'text-red-600' : 'text-amber-600')} /></div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={confirmAction} disabled={actionState !== 'idle'} className="admin-primary-button h-10 flex-1 text-xs">{actionState === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : actionState === 'done' ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{actionState === 'done' ? 'انجام شد' : 'تأیید و اجرا'}</button>
                <button type="button" onClick={() => setProposal(null)} disabled={actionState === 'running'} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-bold text-black/55 transition-colors hover:bg-black/[0.04]"><X className="h-3.5 w-3.5" /> لغو</button>
              </div>
            </div>
          )}

          {!proposal && messages.length < 3 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{QUICK_PROMPTS.map((prompt) => <button key={prompt} type="button" onClick={() => void ask(prompt)} className="min-h-9 shrink-0 rounded-full border border-black/[0.08] bg-white px-3 text-[10px] font-medium text-black/55 transition-[transform,border-color,color] duration-200 hover:border-black/20 hover:text-black active:scale-[.97]">{prompt}</button>)}</div>}

          <form onSubmit={submit} className="mt-3 flex items-end gap-2 rounded-2xl border border-black/[0.09] bg-white p-1.5 shadow-[0_16px_40px_-32px_rgba(0,0,0,.8)] focus-within:border-black/20 focus-within:ring-4 focus-within:ring-black/[0.035]">
            <textarea rows={1} maxLength={1800} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(input) } }} placeholder="از ویجنتو درباره کل پلتفرم بپرسید…" className="min-h-11 flex-1 resize-none bg-transparent px-2 py-3 text-xs leading-5 outline-none placeholder:text-black/30" />
            <button type="submit" disabled={!input.trim() || loading} aria-label="ارسال" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black text-white transition-transform duration-150 active:scale-[.95] disabled:cursor-not-allowed disabled:opacity-30"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      </div>
    </section>
  )
}
