'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  BookOpen,
  Bot,
  CalendarDays,
  FileSearch,
  LayoutDashboard,
  Loader2,
  MessagesSquare,
  Search,
  Sparkles,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { ChatComposer } from '@/components/chat/chat-composer'
import { ConversationText } from '@/components/chat/conversation-bubble'

type ChatMessage = { role: 'assistant' | 'user'; content: string }

type Locale = 'fa' | 'en'

/**
 * What Vigento can actually read — one entry per read-only workspace tool in
 * lib/vigento/profiles.ts, so the page never promises more than it does.
 */
const CAPABILITIES: Array<{ icon: LucideIcon; fa: [string, string]; en: [string, string] }> = [
  { icon: LayoutDashboard, fa: ['خلاصهٔ کسب‌وکار', 'گفتگوها، پیام‌ها، مشتری‌ها، نوبت‌ها و هزینه'], en: ['Business overview', 'Chats, messages, customers, bookings and cost'] },
  { icon: MessagesSquare, fa: ['تحلیل گفتگوها', 'وضعیت، تحویل به اپراتور و خلاصه‌ها'], en: ['Conversation analysis', 'Status, handoffs and summaries'] },
  { icon: Bot, fa: ['سلامت ایجنت‌ها', 'فعالیت و دانش متصل به هر ایجنت'], en: ['Agent health', 'Activity and knowledge per agent'] },
  { icon: Users, fa: ['فعالیت مشتری‌ها', 'فعال‌ترین مشتری‌های اخیر'], en: ['Customer activity', 'Most active recent customers'] },
  { icon: Store, fa: ['سلامت فروشگاه', 'کاتالوگ، سفارش‌ها و اتصال ووکامرس'], en: ['Store health', 'Catalog, orders and WooCommerce'] },
  { icon: Search, fa: ['جستجوی محصول', 'بر اساس نام، SKU و موجودی'], en: ['Product search', 'By name, SKU and stock'] },
  { icon: CalendarDays, fa: ['نوبت‌ها', 'نوبت‌های پیش رو و خدمات'], en: ['Bookings', 'Upcoming appointments and services'] },
  { icon: Wallet, fa: ['مصرف و هزینه', 'درخواست‌های هوش مصنوعی و مبلغ'], en: ['Usage and cost', 'AI requests and amount charged'] },
  { icon: BookOpen, fa: ['پایگاه دانش', 'وضعیت منابع و بررسی یک منبع'], en: ['Knowledge base', 'Source status and one-source check'] },
  { icon: FileSearch, fa: ['بررسی یک گفتگو', 'جزئیات یک گفتگوی مشخص'], en: ['Inspect a chat', 'Details of one conversation'] },
]

const QUESTION_GROUPS: Array<{ fa: string; en: string; questions: Array<{ fa: string; en: string }> }> = [
  {
    fa: 'امروز',
    en: 'Today',
    questions: [
      { fa: 'امروز چه چیزی نیاز به توجه دارد؟', en: 'What needs attention today?' },
      { fa: 'امروز چند گفتگو داشتیم و چندتا به اپراتور رسید؟', en: 'How many chats today, and how many reached an operator?' },
    ],
  },
  {
    fa: 'مشتری و فروش',
    en: 'Customers & sales',
    questions: [
      { fa: 'فعال‌ترین مشتری‌های این هفته کدام‌اند؟', en: 'Who were this week’s most active customers?' },
      { fa: 'کدام محصولات موجودی کمی دارند؟', en: 'Which products are low on stock?' },
      { fa: 'وضعیت فروشگاه و سفارش‌های اخیر چطور است؟', en: 'How are the store and recent orders doing?' },
    ],
  },
  {
    fa: 'ایجنت و هزینه',
    en: 'Agents & cost',
    questions: [
      { fa: 'ایجنت‌هایم چطور کار می‌کنند؟', en: 'How are my agents performing?' },
      { fa: 'هزینهٔ هوش مصنوعی ۷ روز اخیر چقدر بود؟', en: 'What did AI cost over the last 7 days?' },
      { fa: 'کدام منبع دانش هنوز آماده نیست؟', en: 'Which knowledge source isn’t ready yet?' },
    ],
  },
]

/**
 * /vigento — the workspace copilot.
 *
 * The chat card is sized to the viewport (header + bottom bar accounted for)
 * so the composer is always on screen without scrolling. While the thread is
 * fresh, the message area shows what Vigento can read and grouped starter
 * questions; `?q=` (from the overview card) asks a question on arrival.
 */
export function VigentoWorkspace({ locale, ownerName, initialQuestion }: { locale: Locale; ownerName?: string | null; initialQuestion?: string }) {
  const fa = locale === 'fa'
  const reduceMotion = useReducedMotion()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [restored, setRestored] = useState(false)
  const welcome: ChatMessage = {
    role: 'assistant',
    content: fa
      ? `سلام${ownerName ? ` ${ownerName}` : ''}؛ من ویجنتو هستم. هر سؤالی دربارهٔ کسب‌وکارتان دارید بپرسید؛ از دادهٔ زندهٔ همین فضای کاری جواب می‌دهم.`
      : `Hi${ownerName ? ` ${ownerName}` : ''}, I’m Vigento. Ask anything about your business — I answer from this workspace’s live data.`,
  }
  const [messages, setMessages] = useState<ChatMessage[]>([welcome])
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const askedInitial = useRef(false)
  const fresh = messages.length <= 1 && !loading

  const quickPrompts = QUESTION_GROUPS.flatMap((group) => group.questions).slice(0, 4)

  // Auto-scroll only while the reader sits at the bottom, so scrolling up to
  // re-read an earlier answer is never yanked back down.
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

  const ask = useCallback(async (value: string) => {
    const message = value.trim()
    if (!message) return
    isAtBottomRef.current = true
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
  }, [fa, locale])

  // A fresh thread starts at the top (welcome + starter questions); once a
  // conversation is going, follow the newest message.
  useEffect(() => {
    if (messages.length <= 1 && !loading) return
    if (isAtBottomRef.current) scrollToBottom()
  }, [messages.length, loading, scrollToBottom])

  function submit() {
    if (loading) return
    void ask(input)
  }

  // Restore only this authenticated owner/workspace thread. Keep a message the
  // user may have sent while the request was in flight.
  useEffect(() => {
    let cancelled = false
    void fetch('/api/vigento/assistant', { method: 'GET' })
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json() as { messages?: unknown }
        if (cancelled || !Array.isArray(data.messages)) return
        const history = data.messages.flatMap((item): ChatMessage[] => {
          if (!item || typeof item !== 'object') return []
          const value = item as { role?: unknown; content?: unknown }
          if ((value.role !== 'assistant' && value.role !== 'user') || typeof value.content !== 'string') return []
          return [{ role: value.role, content: value.content }]
        })
        if (history.length > 0) setMessages((current) => current.length === 1 ? history : current)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRestored(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // A question handed over from the overview card is asked once, after the
  // saved thread is restored, and removed from the URL.
  useEffect(() => {
    if (!restored || askedInitial.current || !initialQuestion?.trim()) return
    askedInitial.current = true
    void ask(initialQuestion.slice(0, 1000))
    const url = new URL(window.location.href)
    url.searchParams.delete('q')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [restored, initialQuestion, ask])

  return (
    <div className="mx-auto grid max-w-6xl gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="spatial-surface flex h-[calc(100dvh-12.5rem)] min-h-[26rem] flex-col overflow-hidden rounded-sheet md:h-[calc(100dvh-8.75rem)] md:min-h-[32rem] xl:h-[calc(100dvh-9.75rem)]">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
              <Sparkles className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold text-[var(--text-primary)] sm:text-base">
                {fa ? 'ویجنتو' : 'Vigento'} <span className="font-medium text-[var(--text-muted)]">· {fa ? 'دستیار هوشمند پنل' : 'panel assistant'}</span>
              </h1>
              <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                {fa ? 'از دادهٔ زندهٔ فضای کاری شما جواب می‌دهد' : 'Answers from your workspace’s live data'}
              </p>
            </div>
          </div>
          <span className="ui-chip ui-chip-ok shrink-0">
            <span className="relative inline-flex"><span className="absolute inset-0 animate-ping rounded-full bg-current opacity-40 motion-reduce:animate-none" /><span className="ui-chip-dot relative" /></span>
            {fa ? 'آنلاین' : 'Online'}
          </span>
        </header>

        {/* dir=ltr pins the sides in every locale (owner right, Vigento left);
            bubble text keeps its own direction via ConversationText. */}
        <div ref={scrollRef} onScroll={handleScroll} dir="ltr" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div className={message.role === 'user'
                ? 'max-w-[86%] rounded-card rounded-br-md bg-black px-4 py-3 text-[13.5px] leading-7 text-white shadow-[var(--shadow-control)]'
                : 'spatial-inset max-w-[92%] rounded-card rounded-bl-md px-4 py-3 text-[13.5px] leading-7 text-[var(--text-secondary)]'}>
                <ConversationText text={message.content} markdown={message.role === 'assistant'} />
              </div>
            </div>
          ))}

          {fresh ? (
            <div dir={fa ? 'rtl' : 'ltr'} className="space-y-4 pt-1">
              <div>
                <p className="text-[12.5px] font-bold text-[var(--text-primary)]">{fa ? 'چه چیزی بپرسم؟' : 'What can I ask?'}</p>
                <div className="mt-2 space-y-3">
                  {QUESTION_GROUPS.map((group) => (
                    <div key={group.en}>
                      <p className="mb-1.5 text-[12.5px] font-semibold text-[var(--text-muted)]">{fa ? group.fa : group.en}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.questions.map((question) => (
                          <button
                            key={question.en}
                            type="button"
                            onClick={() => void ask(fa ? question.fa : question.en)}
                            className="spatial-press min-h-10 rounded-xl border border-[var(--border-default)] bg-white px-3 text-start text-[12.5px] text-[var(--text-secondary)] shadow-[var(--shadow-xs)] hover:border-[var(--signal-border)] hover:text-[var(--text-primary)]"
                          >
                            {fa ? question.fa : question.en}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="xl:hidden">
                <p className="text-[12.5px] font-bold text-[var(--text-primary)]">{fa ? 'به چه چیزهایی دسترسی دارم؟' : 'What I can read'}</p>
                <ul className="mt-2 grid grid-cols-2 gap-1.5">
                  {CAPABILITIES.map(({ icon: Icon, fa: faText, en }) => (
                    <li key={en[0]} className="flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] px-2.5 py-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--signal)]" aria-hidden="true" />
                      <span className="min-w-0 truncate text-[12px] font-medium text-[var(--text-secondary)]">{fa ? faText[0] : en[0]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          {loading && (
            <div className="flex justify-start">
              <div className="spatial-inset inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                {fa ? 'در حال بررسی داده زنده…' : 'Inspecting live data…'}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-[var(--border-subtle)] p-3 sm:p-4">
          {!fresh ? (
            <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {quickPrompts.map((question) => (
                <button
                  key={question.en}
                  type="button"
                  disabled={loading}
                  onClick={() => void ask(fa ? question.fa : question.en)}
                  className="spatial-press min-h-9 shrink-0 rounded-full border border-[var(--border-default)] bg-white px-3 text-[12px] font-medium text-[var(--text-secondary)] shadow-[var(--shadow-xs)] disabled:opacity-50"
                >
                  {fa ? question.fa : question.en}
                </button>
              ))}
            </div>
          ) : null}
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={submit}
            busy={loading}
            maxLength={1000}
            dir={fa ? 'rtl' : 'ltr'}
            placeholder={fa ? 'از ویجنتو دربارهٔ کسب‌وکارتان بپرسید…' : 'Ask Vigento about your business…'}
            sendLabel={fa ? 'ارسال' : 'Send'}
          />
        </div>
      </section>

      {/* Desktop side rail: what Vigento can read. */}
      <aside className="hidden space-y-4 xl:block">
        <section className="spatial-surface rounded-card p-5">
          <h2 className="ui-h3">{fa ? 'ویجنتو به چه چیزهایی دسترسی دارد؟' : 'What Vigento can read'}</h2>
          <ul className="mt-3 space-y-1.5">
            {CAPABILITIES.map(({ icon: Icon, fa: faText, en }) => (
              <li key={en[0]} className="flex items-center gap-2.5 rounded-xl p-1.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--signal-soft)] text-[var(--signal)]">
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{fa ? faText[0] : en[0]}</span>
                  <span className="block truncate text-[12.5px] text-[var(--text-muted)]">{fa ? faText[1] : en[1]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

      </aside>
    </div>
  )
}
