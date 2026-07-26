'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Loader2,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { ChatComposer } from '@/components/chat/chat-composer'
import { ConversationText } from '@/components/chat/conversation-bubble'

type ChatMessage = { role: 'assistant' | 'user'; content: string }

type Locale = 'fa' | 'en'

/** Compact capability chip — mirrors the node labels used by IntelligenceCore
 *  on the overview page, so the /vigento chat page visually echoes "Vigento AI
 *  | هوش مصنوعی ویجنتو" and shows what the copilot is connected to. */
const CAPABILITIES: Array<{ fa: string; en: string; icon: LucideIcon }> = [
  { fa: 'گفتگوها', en: 'Conversations', icon: MessagesSquare },
  { fa: 'مشتری‌ها', en: 'Customers', icon: Users },
  { fa: 'رزروها', en: 'Bookings', icon: CalendarDays },
  { fa: 'هزینه AI', en: 'AI cost', icon: Wallet },
]

export function VigentoWorkspace({ locale, ownerName }: { locale: Locale; ownerName?: string | null }) {
  const fa = locale === 'fa'
  const Arrow = fa ? ArrowLeft : ArrowRight
  const reduceMotion = useReducedMotion()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: fa
      ? `سلام${ownerName ? ` ${ownerName}` : ''}؛ من ویجنتو هستم. آمار فضای کاری، گفتگوها، مشتری‌ها، رزروها و هزینه پاسخ‌های AI را از داده زنده بررسی می‌کنم.`
      : `Hi${ownerName ? ` ${ownerName}` : ''}; I am Vigento. I can inspect live workspace metrics, conversations, customers, bookings and AI reply cost.`,
  }])
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const prompts = fa
    ? ['امروز چه چیزی نیاز به توجه دارد؟', 'پرتعامل‌ترین مشتری‌های امروز کدام‌اند؟', 'هزینه پاسخ‌های AI امروز چقدر بود؟']
    : ['What needs attention today?', 'Who were today’s most active customers?', 'What did AI replies cost today?']

  // Auto-scroll only while the reader sits at the bottom, so scrolling up to
  // re-read an earlier answer is never yanked back down — same rule as the
  // operator inbox thread.
  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [reduceMotion])

  async function ask(value: string) {
    const message = value.trim()
    if (!message || loading) return
    setMessages((current) => [...current, { role: 'user', content: message }])
    setInput('')
    setLoading(true)
    try {
      const response = await fetch('/api/vigento/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language: locale }),
      })
      const data = await response.json()
      if (!response.ok || typeof data.answer !== 'string') throw new Error('FAILED')
      setMessages((current) => [...current, { role: 'assistant', content: data.answer }])
    } catch {
      setMessages((current) => [...current, {
        role: 'assistant',
        content: fa ? 'الان نتوانستم داده زنده را بخوانم. چند لحظه دیگر دوباره امتحان کنید.' : 'I could not read live data just now. Please try again shortly.',
      }])
    } finally {
      setLoading(false)
    }
  }

  // `loading` is a dependency so the "inspecting live data" row scrolls in too.
  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom()
  }, [messages.length, loading, scrollToBottom])

  function submit() {
    void ask(input)
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="spatial-surface overflow-hidden rounded-[1.75rem]">
        {/* ── Header — matches IntelligenceCore on the overview page ── */}
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-black text-[var(--text-primary)] sm:text-base">
                Vigento AI <span className="font-medium text-[var(--text-muted)]">| {fa ? 'هوش مصنوعی ویجنتو' : 'Vigento intelligence'}</span>
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                {fa ? 'دستیار مدیریت فضای کاری · داده زنده' : 'Workspace management copilot · live data'}
              </p>
            </div>
          </div>
          <span className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-40" />
              <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="sm:hidden">{fa ? 'آنلاین' : 'Online'}</span>
            <span className="hidden sm:inline">{fa ? 'همه‌چیز متصل' : 'All connected'}</span>
          </span>
        </header>

        {/* ── Capabilities strip — echoes the IntelligenceCore node labels so
             the user immediately sees "what is what": Vigento can inspect
             conversations, customers, bookings and AI cost. ── */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-[var(--border-subtle)] px-4 py-2.5 sm:px-6 no-scrollbar">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            {fa ? 'دسترسی به:' : 'Connected to:'}
          </span>
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon
            return (
              <span
                key={cap.en}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)]"
              >
                <Icon className="h-3 w-3 text-[var(--text-muted)]" />
                {fa ? cap.fa : cap.en}
              </span>
            )
          })}
        </div>

        {/* ── Chat messages — dir=ltr pins the sides in every locale so the
             owner's own messages sit on the visual RIGHT, like every other
             chat surface. Bubble text keeps its own direction (ConversationText
             renders dir="auto"). Fixed height + overflow keeps the composer
             on screen no matter how long the thread gets. ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          dir="ltr"
          className="h-[29rem] space-y-4 overflow-y-auto p-4 sm:p-6"
        >
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={message.role === 'user'
                ? 'max-w-[86%] rounded-[1.25rem] rounded-br-md bg-black px-4 py-3 text-[13px] leading-7 text-white shadow-[var(--shadow-control)]'
                : 'spatial-inset max-w-[92%] rounded-[1.25rem] rounded-bl-md px-4 py-3 text-[13px] leading-7 text-[var(--text-secondary)]'}>
                <ConversationText
                  text={message.content}
                  markdown={message.role === 'assistant'}
                />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="spatial-inset inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                {fa ? 'در حال بررسی داده زنده…' : 'Inspecting live data…'}
              </div>
            </div>
          )}
        </div>

        {/* ── Prompt chips + the shared composer ── */}
        <div className="border-t border-[var(--border-subtle)] p-3 sm:p-4">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void ask(prompt)}
                className="spatial-press min-h-9 shrink-0 rounded-full border border-[var(--border-default)] bg-white px-3 text-[11px] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)]"
              >
                {prompt}
              </button>
            ))}
          </div>
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={submit}
            busy={loading}
            maxLength={1000}
            dir={fa ? 'rtl' : 'ltr'}
            placeholder={fa ? 'از ویجنتو درباره کسب‌وکارتان بپرسید…' : 'Ask Vigento about your business…'}
            sendLabel={fa ? 'ارسال' : 'Send'}
          />
        </div>
      </section>

      {/* ── Sidebar ── */}
      <aside className="space-y-4">
        <section className="spatial-surface rounded-[1.5rem] p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <h2 className="text-xs font-bold">{fa ? 'کنترل امن عملیات' : 'Safe operations'}</h2>
          </div>
          <p className="mt-3 text-[11px] leading-6 text-[var(--text-muted)]">
            {fa
              ? 'ویجنتو در این مرحله داده را می‌خواند و برای تغییرات حساس پیش‌نمایش می‌سازد؛ هیچ تغییر مالی یا حذف داده بدون تأیید اجرا نمی‌شود.'
              : 'Vigento reads data and previews sensitive changes; no financial mutation or deletion runs without confirmation.'}
          </p>
        </section>

        {/* ── "What is what" — capability cards mirroring the strip above ── */}
        <section className="spatial-surface rounded-[1.5rem] p-5">
          <h2 className="text-xs font-bold text-[var(--text-primary)]">{fa ? 'ویجنتو چه می‌بیند؟' : 'What Vigento sees'}</h2>
          <div className="mt-3 space-y-2">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon
              return (
                <div key={cap.en} className="flex items-center gap-2.5 rounded-xl bg-[var(--bg-base)] p-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black text-white">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">{fa ? cap.fa : cap.en}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {cap.en === 'Conversations' && (fa ? 'گفتگوهای زنده و خلاصه' : 'Live chats & summaries')}
                      {cap.en === 'Customers' && (fa ? 'پروفایل و فعالیت مشتری' : 'Profile & activity')}
                      {cap.en === 'Bookings' && (fa ? 'رزروهای امروز و هفته' : 'Today & week bookings')}
                      {cap.en === 'AI cost' && (fa ? 'هزینه پاسخ‌های AI' : 'AI reply spend')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="spatial-surface rounded-[1.5rem] p-3">
          {([
            ['/conversations', fa ? 'گفتگوها' : 'Conversations'],
            ['/contacts', fa ? 'مشتری‌ها' : 'Customers'],
            ['/analytics', fa ? 'گزارش کامل' : 'Full analytics'],
            ['/agents/new', fa ? 'ساخت ایجنت' : 'Build an agent'],
          ] as const).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-11 items-center rounded-xl px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
            >
              {label}
              <Arrow className="ms-auto h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
            </Link>
          ))}
        </section>
      </aside>
    </div>
  )
}
