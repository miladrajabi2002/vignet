'use client'

import { FormEvent, useState } from 'react'
import {
  Check,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Message = { id: string; role: 'assistant' | 'user'; text: string }
type Proposal = { token: string; title: string; description: string; tone: 'warning' | 'danger' }

const QUICK_PROMPTS = [
  'آمار فروش و هزینه AI در ۷ روز اخیر چطور بوده؟',
  'کدام کسب‌وکارها بیشترین تعامل را داشته‌اند؟',
  'چند گفتگوی انتقال‌یافته نیاز به رسیدگی دارد؟',
]

// ── Neural network node positions (relative to a 320×280 SVG viewBox) ────────
// Central core = Vigento AI. 6 satellite nodes represent platform subsystems.
const CORE = { x: 160, y: 140 }
const SATELLITES = [
  { id: 'users', label: 'کاربران', x: 50, y: 60 },
  { id: 'convos', label: 'گفتگوها', x: 270, y: 60 },
  { id: 'revenue', label: 'درآمد', x: 30, y: 140 },
  { id: 'agents', label: 'ایجنت‌ها', x: 290, y: 140 },
  { id: 'errors', label: 'خطاها', x: 50, y: 220 },
  { id: 'ai', label: 'هوش مصنوعی', x: 270, y: 220 },
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
      className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-white shadow-[0_26px_80px_-42px_rgba(0,0,0,.9)]"
    >
      {/* ═══════════════════════════════════════════════════════════════
          Ambient glow layers
         ═══════════════════════════════════════════════════════════════ */}
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full bg-violet-600/20 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full bg-emerald-500/15 blur-[100px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/5 blur-[120px]"
        aria-hidden="true"
      />

      <div className="relative grid lg:min-h-[440px] lg:grid-cols-[1fr_1fr]">
        {/* ═══════════════════════════════════════════════════════════════
            LEFT — Neural network visualization
           ═══════════════════════════════════════════════════════════════ */}
        <div className="relative flex flex-col overflow-hidden border-b border-white/8 p-4 sm:p-6 lg:border-b-0 lg:border-l lg:p-8">
          {/* Header */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/65 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              هسته مالک پلتفرم · آنلاین
            </div>
            <h2 id="vigento-admin-title" className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Vigento AI
            </h2>
            <p className="mt-1 text-sm text-white/55">ویجنتوی ادمین · مرکز فرمان</p>
            <p className="mt-3 max-w-md text-xs leading-6 text-white/55">
              همه‌چیز زیر دست Vigento AI است — کاربران، گفتگوها، درآمد، هوش مصنوعی و خطاها همگی به‌صورت زنده متصل و قابل کنترل.
            </p>
          </div>

          {/* ── SVG Neural Network Visualization ────────────────────── */}
          <div className="relative my-2 flex flex-1 items-center justify-center sm:my-4">
            <svg
              viewBox="0 0 320 280"
              className="h-full w-full max-h-[190px] sm:max-h-[230px] lg:max-h-[260px]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* ── Connection lines (neural pathways) ─────────────────── */}
              <defs>
                {/* Gradient for connection lines */}
                <linearGradient id="neural-line" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(139,92,246,0.5)" />
                  <stop offset="50%" stopColor="rgba(16,185,129,0.4)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0.3)" />
                </linearGradient>

                {/* Glow filter for core */}
                <filter id="core-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Glow filter for nodes */}
                <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Pulsing animation for data flow along lines */}
                <linearGradient id="pulse-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(16,185,129,0)" />
                  <stop offset="40%" stopColor="rgba(16,185,129,0.8)" />
                  <stop offset="60%" stopColor="rgba(16,185,129,0.8)" />
                  <stop offset="100%" stopColor="rgba(16,185,129,0)" />
                </linearGradient>
              </defs>

              {/* Static connection lines from each satellite to core */}
              {SATELLITES.map((sat) => (
                <line
                  key={`line-${sat.id}`}
                  x1={sat.x}
                  y1={sat.y}
                  x2={CORE.x}
                  y2={CORE.y}
                  stroke="url(#neural-line)"
                  strokeWidth="1"
                  opacity="0.5"
                />
              ))}

              {/* Cross-connections between adjacent satellites (neural mesh) */}
              {SATELLITES.map((sat, i) => {
                const next = SATELLITES[(i + 1) % SATELLITES.length]
                return (
                  <line
                    key={`mesh-${sat.id}`}
                    x1={sat.x}
                    y1={sat.y}
                    x2={next.x}
                    y2={next.y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="0.5"
                    strokeDasharray="2 4"
                  />
                )
              })}

              {/* Animated data pulses traveling along each connection line */}
              {SATELLITES.map((sat, i) => (
                <circle key={`pulse-${sat.id}`} r="2" fill="rgba(16,185,129,0.9)" filter="url(#node-glow)">
                  <animateMotion
                    dur={`${2.5 + i * 0.3}s`}
                    repeatCount="indefinite"
                    path={`M${sat.x},${sat.y} L${CORE.x},${CORE.y}`}
                    begin={`${i * 0.4}s`}
                  />
                  <animate
                    attributeName="opacity"
                    values="0;1;1;0"
                    dur={`${2.5 + i * 0.3}s`}
                    repeatCount="indefinite"
                    begin={`${i * 0.4}s`}
                  />
                </circle>
              ))}

              {/* Return pulses (core → satellite) */}
              {SATELLITES.map((sat, i) => (
                <circle key={`pulse-back-${sat.id}`} r="1.5" fill="rgba(139,92,246,0.7)" filter="url(#node-glow)">
                  <animateMotion
                    dur={`${3 + i * 0.2}s`}
                    repeatCount="indefinite"
                    path={`M${CORE.x},${CORE.y} L${sat.x},${sat.y}`}
                    begin={`${1.2 + i * 0.3}s`}
                  />
                  <animate
                    attributeName="opacity"
                    values="0;0.8;0.8;0"
                    dur={`${3 + i * 0.2}s`}
                    repeatCount="indefinite"
                    begin={`${1.2 + i * 0.3}s`}
                  />
                </circle>
              ))}

              {/* ── Central core: Vigento AI ───────────────────────────── */}
              {/* Outer pulsing ring */}
              <circle
                cx={CORE.x}
                cy={CORE.y}
                r="42"
                fill="none"
                stroke="rgba(16,185,129,0.2)"
                strokeWidth="1"
              >
                <animate
                  attributeName="r"
                  values="42;52;42"
                  dur="3s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Inner pulsing ring */}
              <circle
                cx={CORE.x}
                cy={CORE.y}
                r="34"
                fill="none"
                stroke="rgba(139,92,246,0.15)"
                strokeWidth="0.5"
              >
                <animate
                  attributeName="r"
                  values="34;40;34"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Core glow circle */}
              <circle
                cx={CORE.x}
                cy={CORE.y}
                r="28"
                fill="rgba(255,255,255,0.04)"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
                filter="url(#core-glow)"
              />

              {/* Core center dot */}
              <circle cx={CORE.x} cy={CORE.y} r="4" fill="white" filter="url(#core-glow)">
                <animate
                  attributeName="r"
                  values="4;5.5;4"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Core label */}
              <text
                x={CORE.x}
                y={CORE.y + 52}
                textAnchor="middle"
                fill="rgba(255,255,255,0.5)"
                fontSize="9"
                fontWeight="700"
                letterSpacing="1"
              >
                VIGENTO AI
              </text>

              {/* ── Satellite nodes ────────────────────────────────────── */}
              {SATELLITES.map((sat, i) => (
                <g key={`sat-${sat.id}`}>
                  {/* Node glow circle */}
                  <circle
                    cx={sat.x}
                    cy={sat.y}
                    r="14"
                    fill="rgba(255,255,255,0.03)"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="0.8"
                    filter="url(#node-glow)"
                  >
                    <animate
                      attributeName="r"
                      values="14;16;14"
                      dur="2.5s"
                      repeatCount="indefinite"
                      begin={`${i * 0.3}s`}
                    />
                  </circle>

                  {/* Node center dot */}
                  <circle cx={sat.x} cy={sat.y} r="3" fill="rgba(16,185,129,0.8)" filter="url(#node-glow)">
                    <animate
                      attributeName="opacity"
                      values="0.6;1;0.6"
                      dur="2s"
                      repeatCount="indefinite"
                      begin={`${i * 0.2}s`}
                    />
                  </circle>

                  {/* Node label */}
                  <text
                    x={sat.x}
                    y={sat.y - 20}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.4)"
                    fontSize="8"
                    fontWeight="600"
                  >
                    {sat.label}
                  </text>
                </g>
              ))}

              {/* ── Floating particles (ambient) ──────────────────────── */}
              {[...Array(6)].map((_, i) => {
                const angle = (i / 6) * Math.PI * 2
                const r = 100 + (i % 2) * 20
                const px = CORE.x + Math.cos(angle) * r
                const py = CORE.y + Math.sin(angle) * r
                return (
                  <circle key={`particle-${i}`} cx={px} cy={py} r="1" fill="rgba(255,255,255,0.3)">
                    <animate
                      attributeName="opacity"
                      values="0;0.6;0"
                      dur="4s"
                      repeatCount="indefinite"
                      begin={`${i * 0.6}s`}
                    />
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from={`0 ${CORE.x} ${CORE.y}`}
                      to={`360 ${CORE.x} ${CORE.y}`}
                      dur={`${20 + i * 3}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                )
              })}
            </svg>
          </div>

          {/* Footer badge */}
          <div className="relative z-10 flex items-center gap-2 text-[11px] text-white/45">
            <ShieldCheck className="h-3.5 w-3.5" />
            OWNER ONLY · دسترسی مالک پلتفرم
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            RIGHT — Chat interface
           ═══════════════════════════════════════════════════════════════ */}
        <div className="flex min-h-[360px] flex-col bg-[#f7f7f5] p-4 text-black sm:min-h-[400px] sm:p-6">
          {/* Chat header */}
          <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold">گفتگو با هسته عملیات</p>
                <p className="mt-0.5 text-[11px] text-black/50">داده زنده · فایل امن · عملیات با تأیید</p>
              </div>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
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
                  <p className="mt-1 text-xs leading-5 text-black/60">{proposal.description}</p>
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
                  className="min-h-10 shrink-0 rounded-full border border-black/[0.08] bg-white px-3 text-[11px] font-medium text-black/60 transition-[transform,border-color,color] duration-200 hover:border-black/20 hover:text-black active:scale-[.97]"
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
    </section>
  )
}
