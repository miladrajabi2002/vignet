'use client'

/**
 * Public Chat Link experience (/c/[slug]) — a standalone, mobile-first,
 * full-screen chat with one agent. Built for the Instagram-bio use case:
 * opens fast inside in-app browsers, 100dvh layout, safe-area padding,
 * 16px inputs (no iOS zoom), streaming replies with product cards.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Reply, RotateCcw, Sparkles, User, Phone, X } from 'lucide-react'
import { contrastOn } from '@/lib/widget/config'
import type { ChatLinkSettings } from '@/lib/chat-link/config'
import { toEnglishDigits } from '@/lib/phone'
import { Markdown } from '@/lib/markdown'

// ─── Refined send icon ──────────────────────────────────────────────────────
// A clean, modern paper-plane — more balanced than the raw Telegram glyph and
// more polished than the Lucide "Send" outline. Single solid path so it reads
// crisply at 16-24px. Points up-right (the natural "send" direction).
function SendIcon({ className }: { className?: string }) {
        return (
                <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
                        <path d="M22 3 2.6 11.2c-.7.3-.6 1.3.1 1.5l4.5 1.4 1.7 5.2c.2.6 1 .8 1.5.3l2.3-2.1 4.4 3.2c.5.4 1.3.1 1.4-.6L23 4c.2-.8-.5-1.4-1-1z" />
                </svg>
        )
}

// ─── Types ──────────────────────────────────────────────────────────────────

type ProductCard = { name: string; price: string; desc: string; badge: string }

type Msg =
        | { id: string; role: 'user'; text: string; parentId?: string; parentContent?: string }
        | { id: string; role: 'assistant'; text: string; cards: ProductCard[]; done: boolean; serverId?: string }
        | { id: string; role: 'error'; text: string }

type Props = {
        slug: string
        name: string
        avatar: string | null
        welcomeMessage: string | null
        settings: ChatLinkSettings
}

// ─── Assistant parsing (mirrors public/widget/loader.js) ────────────────────

const PRODUCT_TOKEN = /\[\[product:(\{[\s\S]*?\})\]\]/g

function parseAssistant(
        raw: string,
        done: boolean,
): { text: string; cards: ProductCard[] } {
        const cards: ProductCard[] = []
        let text = raw.replace(PRODUCT_TOKEN, (_m, json: string) => {
                try {
                        const p = JSON.parse(json)
                        if (p && typeof p.name === 'string' && p.name) {
                                cards.push({
                                        name: String(p.name).slice(0, 80),
                                        price: p.price != null ? String(p.price).slice(0, 40) : '',
                                        desc: p.desc != null ? String(p.desc).slice(0, 90) : '',
                                        badge: p.badge != null ? String(p.badge).slice(0, 20) : '',
                                })
                        }
                } catch {
                        /* malformed token — drop it silently */
                }
                return ''
        })
        // While streaming, hold back an unterminated trailing token so it never
        // flashes as raw text; once done, whatever remains is real text.
        if (!done) {
                const tail = text.lastIndexOf('[[')
                if (tail !== -1 && text.indexOf(']]', tail) === -1) text = text.slice(0, tail)
        }
        return { text: text.replace(/\n{3,}/g, '\n\n').trim(), cards }
}

function errorText(code?: string): string {
        switch (code) {
                case 'RATE_LIMIT':
                        return 'تعداد پیام‌ها زیاد شد — چند لحظه صبر کنید و دوباره بفرستید.'
                case 'PLAN_BLOCKED':
                        return 'ظرفیت گفتگوی این صفحه فعلاً تکمیل است. کمی بعد سر بزنید.'
                default:
                        return 'ارسال پیام ناموفق بود. دوباره تلاش کنید.'
        }
}

let idCounter = 0
const nextId = () => `m${Date.now()}-${++idCounter}`

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatLinkClient({ slug, name, avatar, welcomeMessage, settings }: Props) {
        const accent = settings.primaryColor
        const onAccent = contrastOn(accent)

        const convKey = `vgt-cl-conv-${slug}`
        const msgsKey = `vgt-cl-msgs-${slug}`
        const leadKey = `vgt-cl-lead-${slug}`

        const [messages, setMessages] = useState<Msg[]>([])
        const [input, setInput] = useState('')
        const [streaming, setStreaming] = useState(false)
        const [hydrated, setHydrated] = useState(false)
        // Lead-capture gate: null = not needed / already given, 'pending' = show form
        const [leadPending, setLeadPending] = useState(false)
        const [leadName, setLeadName] = useState('')
        const [leadPhone, setLeadPhone] = useState('')
        // Reply-to (quote) state: when set, the next sent user message is linked
        // to a previous assistant message and a preview bar shows above the composer.
        // `id` is the server-side message id (null when replying to a just-streamed
        // message whose server id hasn't arrived yet — quote is local-only then).
        const [reply, setReply] = useState<{ id: string | null; text: string } | null>(null)

        const convIdRef = useRef<string | null>(null)
        const leadRef = useRef<{ name: string; phone: string } | null>(null)
        const scrollerRef = useRef<HTMLDivElement>(null)
        const inputRef = useRef<HTMLTextAreaElement>(null)
        const rootRef = useRef<HTMLDivElement>(null)

        // Restore conversation + transcript + lead across reloads.
        // Messages are now stored in localStorage (not sessionStorage) so the
        // transcript survives a full tab close / browser restart. We also try
        // to fetch the server-side history when we have a conversationId but no
        // local cache (e.g. first visit on a new device).
        useEffect(() => {
                let cancelled = false
                async function hydrate() {
                        try {
                                convIdRef.current = localStorage.getItem(convKey)
                                const storedLead = localStorage.getItem(leadKey)
                                if (storedLead) leadRef.current = JSON.parse(storedLead)
                                const storedMsgs = localStorage.getItem(msgsKey)
                                if (storedMsgs) {
                                        const parsed = JSON.parse(storedMsgs) as Msg[]
                                        if (Array.isArray(parsed)) setMessages(parsed.slice(-60))
                                }
                                // If we have a conversation but no local transcript, fetch from server.
                                if (convIdRef.current && !storedMsgs) {
                                        try {
                                                const res = await fetch(
                                                        `/api/chat-link/${encodeURIComponent(slug)}/chat?conversationId=${encodeURIComponent(convIdRef.current)}`,
                                                        { headers: { Accept: 'application/json' } },
                                                )
                                                if (res.ok) {
                                                        const data = await res.json()
                                                        if (!cancelled && Array.isArray(data.messages)) {
                                                                const restored: Msg[] = data.messages
                                                                        .map(
                                                                                (
                                                                                        m: {
                                                                                                id?: string
                                                                                                role: string
                                                                                                content: string
                                                                                                parentId?: string | null
                                                                                                parentContent?: string | null
                                                                                        },
                                                                                ) => {
                                                                                        const id = m.id || nextId()
                                                                                        if (m.role === 'user')
                                                                                                return {
                                                                                                        id,
                                                                                                        role: 'user',
                                                                                                        text: m.content,
                                                                                                        parentId: m.parentId ?? undefined,
                                                                                                        parentContent: m.parentContent ?? undefined,
                                                                                                } as Msg
                                                                                        return {
                                                                                                id,
                                                                                                role: 'assistant',
                                                                                                text: m.content,
                                                                                                cards: [],
                                                                                                done: true,
                                                                                                serverId: id,
                                                                                        } as Msg
                                                                                },
                                                                        )
                                                                        .slice(-60)
                                                                if (restored.length) setMessages(restored)
                                                        }
                                                }
                                        } catch {
                                                /* network/parse error — continue with empty transcript */
                                        }
                                }
                                if (settings.leadCapture && !storedLead) setLeadPending(true)
                        } catch {
                                /* storage unavailable (private mode) — chat still works in-memory */
                        }
                        if (!cancelled) setHydrated(true)
                }
                void hydrate()
                return () => {
                        cancelled = true
                }
        }, [convKey, leadKey, msgsKey, settings.leadCapture, slug])

        // Persist transcript to localStorage so it survives a tab close / refresh.
        useEffect(() => {
                if (!hydrated) return
                try {
                        localStorage.setItem(msgsKey, JSON.stringify(messages.slice(-60)))
                } catch {
                        /* ignore quota */
                }
        }, [messages, msgsKey, hydrated])

        const scrollDown = useCallback((smooth = true) => {
                requestAnimationFrame(() => {
                        scrollerRef.current?.scrollTo({
                                top: scrollerRef.current.scrollHeight,
                                behavior: smooth ? 'smooth' : 'auto',
                        })
                })
        }, [])

        useEffect(() => {
                if (messages.length) scrollDown(false)
        }, [hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

        // ── Mobile keyboard handling ──────────────────────────────────────────
        // When the soft keyboard opens, the visualViewport shrinks. We pin the
        // root container's height to the visible viewport so the composer stays
        // anchored above the keyboard and the page never scrolls underneath.
        // Mirrors the pattern used in public/widget/loader.js#applyViewportHeight.
        useEffect(() => {
                if (typeof window === 'undefined' || !window.visualViewport) return
                const vv = window.visualViewport
                const onResize = () => {
                        if (rootRef.current) {
                                rootRef.current.style.height = vv.height + 'px'
                        }
                        scrollDown()
                }
                vv.addEventListener('resize', onResize)
                vv.addEventListener('scroll', onResize)
                return () => {
                        vv.removeEventListener('resize', onResize)
                        vv.removeEventListener('scroll', onResize)
                }
        }, [scrollDown])

        // ── Send flow ──
        const send = useCallback(
                async (text: string) => {
                        const message = text.trim()
                        if (!message || streaming) return
                        setInput('')
                        if (inputRef.current) inputRef.current.style.height = 'auto'
                        setStreaming(true)

                        const isFirst = !convIdRef.current
                        // Snapshot the reply state before sending so we can clear it
                        // immediately (and still attach the quote to the outgoing msg).
                        const replySnapshot = reply
                        setReply(null)
                        setMessages((m) => [
                                ...m,
                                {
                                        id: nextId(),
                                        role: 'user',
                                        text: message,
                                        parentId: replySnapshot?.id ?? undefined,
                                        parentContent: replySnapshot?.text ?? undefined,
                                },
                        ])
                        scrollDown()

                        const assistantId = nextId()
                        let raw = ''
                        let started = false
                        // The server-side message id arrives in the `done` SSE event;
                        // stash it on the assistant message so a subsequent reply-to
                        // can reference the persisted row (not the local placeholder).
                        let serverId: string | undefined
                        const upsertAssistant = (done: boolean) => {
                                const { text: parsed, cards } = parseAssistant(raw, done)
                                setMessages((m) => {
                                        const idx = m.findIndex((x) => x.id === assistantId)
                                        const msg: Msg = {
                                                id: assistantId,
                                                role: 'assistant',
                                                text: parsed,
                                                cards,
                                                done,
                                                ...(serverId ? { serverId } : {}),
                                        }
                                        if (idx === -1) return [...m, msg]
                                        const copy = m.slice()
                                        copy[idx] = msg
                                        return copy
                                })
                        }

                        try {
                                const res = await fetch(`/api/chat-link/${encodeURIComponent(slug)}/chat`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                                message,
                                                conversationId: convIdRef.current,
                                                replyToMessageId: replySnapshot?.id ?? undefined,
                                                ...(isFirst && leadRef.current
                                                        ? {
                                                                        visitorName: leadRef.current.name || undefined,
                                                                        visitorPhone: leadRef.current.phone || undefined,
                                                                }
                                                        : {}),
                                        }),
                                })

                                if (!res.ok || !res.body) {
                                        const err = await res.json().catch(() => null)
                                        setMessages((m) => [
                                                ...m,
                                                { id: nextId(), role: 'error', text: errorText(err?.error) },
                                        ])
                                        return
                                }

                                const reader = res.body.getReader()
                                const decoder = new TextDecoder()
                                let buf = ''
                                for (;;) {
                                        const { value, done } = await reader.read()
                                        if (done) break
                                        buf += decoder.decode(value, { stream: true })
                                        const parts = buf.split('\n\n')
                                        buf = parts.pop() ?? ''
                                        for (const part of parts) {
                                                const line = part.trim()
                                                if (!line.startsWith('data:')) continue
                                                try {
                                                        const evt = JSON.parse(line.slice(5).trim())
                                                        if (evt.type === 'meta' && evt.conversationId) {
                                                                convIdRef.current = evt.conversationId
                                                                try {
                                                                        localStorage.setItem(convKey, evt.conversationId)
                                                                } catch {}
                                                        } else if (evt.type === 'delta') {
                                                                raw += evt.text
                                                                started = true
                                                                upsertAssistant(false)
                                                                scrollDown()
                                                        } else if (evt.type === 'done') {
                                                                if (evt.messageId && typeof evt.messageId === 'string')
                                                                        serverId = evt.messageId
                                                                upsertAssistant(true)
                                                        } else if (evt.type === 'error' && !started) {
                                                                setMessages((m) => [
                                                                        ...m,
                                                                        { id: nextId(), role: 'error', text: errorText(evt.error) },
                                                                ])
                                                        }
                                                } catch {
                                                        /* partial frame — ignored */
                                                }
                                        }
                                }
                                if (started) upsertAssistant(true)
                        } catch {
                                setMessages((m) => [...m, { id: nextId(), role: 'error', text: errorText() }])
                        } finally {
                                setStreaming(false)
                                scrollDown()
                        }
                },
                [slug, streaming, convKey, scrollDown, reply],
        )

        const submitLead = useCallback(() => {
                // Convert any Persian/Arabic digits to English before validating
                // so the 10-digit length check works for Persian input too.
                const phone = toEnglishDigits(leadPhone).trim()
                const lead = { name: leadName.trim(), phone }
                if (!lead.name || lead.phone.replace(/\D/g, '').length < 10) return
                leadRef.current = lead
                try {
                        localStorage.setItem(leadKey, JSON.stringify(lead))
                } catch {}
                setLeadPending(false)
        }, [leadName, leadPhone, leadKey])

        // Tap a reply button on an assistant bubble: stash the quoted message
        // (server id when we have it — otherwise null for a local-only quote) and
        // focus the composer so the visitor can type their reply.
        const handleReply = useCallback((serverId: string | null, text: string) => {
                setReply({ id: serverId, text: text.slice(0, 60) })
                requestAnimationFrame(() => inputRef.current?.focus())
        }, [])

        const reset = useCallback(() => {
                convIdRef.current = null
                setMessages([])
                try {
                        localStorage.removeItem(convKey)
                        localStorage.removeItem(msgsKey)
                } catch {}
        }, [convKey, msgsKey])

        const autoGrow = useCallback(() => {
                const el = inputRef.current
                if (!el) return
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
        }, [])

        const empty = messages.length === 0
        const monogram = useMemo(() => (name || '؟').trim().charAt(0), [name])

        return (
                <div ref={rootRef} className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#fafafa] text-neutral-900" style={{ ['--vgt-accent' as string]: accent }}>
                        <Background kind={settings.background} accent={accent} />

                        {/* App column */}
                        <div className="relative z-10 mx-auto flex h-full w-full max-w-2xl flex-col md:border-x md:border-black/[0.06] md:bg-white/40 md:shadow-[0_0_80px_rgba(0,0,0,0.04)] md:backdrop-blur-sm">
                                {/* Header */}
                                <header className="flex items-center gap-3 border-b border-black/[0.06] bg-white/70 px-4 py-3 backdrop-blur-xl">
                                        <Avatar avatar={avatar} monogram={monogram} accent={accent} size={40} online />
                                        <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold leading-tight">{name}</p>
                                                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                                                        <span className="relative flex h-1.5 w-1.5">
                                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                                                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                        </span>
                                                        آنلاین — پاسخ فوری
                                                </p>
                                        </div>
                                        {!empty && (
                                                <button
                                                        onClick={reset}
                                                        aria-label="شروع گفتگوی جدید"
                                                        className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700"
                                                >
                                                        <RotateCcw className="h-4 w-4" />
                                                </button>
                                        )}
                                </header>

                                {/* Messages / intro */}
                                <div
                                        ref={scrollerRef}
                                        className="flex-1 overflow-y-auto overscroll-contain px-4 py-5"
                                >
                                        {/* While hydrating from localStorage / server history, show a
                                            loading state so the page doesn't look frozen. */}
                                        {!hydrated ? (
                                                <LoadingDots accent={accent} />
                                        ) : empty || leadPending ? (
                                                <Intro
                                                        name={name}
                                                        avatar={avatar}
                                                        monogram={monogram}
                                                        accent={accent}
                                                        onAccent={onAccent}
                                                        tagline={settings.tagline}
                                                        welcomeMessage={welcomeMessage}
                                                        quickReplies={settings.quickReplies}
                                                        showAiBadge={settings.showAiBadge}
                                                        leadPending={leadPending}
                                                        leadName={leadName}
                                                        leadPhone={leadPhone}
                                                        leadMessage={settings.leadCaptureMessage}
                                                        leadRequired={settings.leadCaptureRequired}
                                                        setLeadName={setLeadName}
                                                        setLeadPhone={setLeadPhone}
                                                        submitLead={submitLead}
                                                        onSkip={() => {
                                                                // Allow skipping — the AI agent will then try to extract name/phone
                                                                // from the conversation (smart identification).
                                                                // Only reachable when leadCaptureRequired is false.
                                                                leadRef.current = null
                                                                setLeadPending(false)
                                                        }}
                                                        onPick={(q) => void send(q)}
                                                />
                                        ) : (
                                                <div dir="ltr" className="flex flex-col gap-2.5 pb-2">
                                                        {messages.map((m) => (
                                                                <MessageRow
                                                                        key={m.id}
                                                                        msg={m}
                                                                        accent={accent}
                                                                        onAccent={onAccent}
                                                                        onReply={
                                                                                m.role === 'assistant' && m.done && m.text
                                                                                        ? handleReply
                                                                                        : undefined
                                                                        }
                                                                        />
                                                        ))}
                                                        {streaming && messages[messages.length - 1]?.role === 'user' && (
                                                                <TypingDots accent={accent} />
                                                        )}
                                                </div>
                                        )}
                                </div>

                                {/* Composer */}
                                <div className="border-t border-black/[0.06] bg-white/80 px-3 pt-3 backdrop-blur-xl [padding-bottom:max(env(safe-area-inset-bottom),12px)]">
                                        {leadPending ? (
                                        <div className="px-4 py-5 text-center">
                                                <p className="text-[13px] text-neutral-400">برای شروع گفتگو، اطلاعات زیر را وارد کنید</p>
                                        </div>
                                ) : (
                                        <>
                                        {reply && (
                                                <div
                                                        className="mb-2 flex items-start gap-2 rounded-2xl border-s-2 bg-black/[0.03] px-3 py-2"
                                                        style={{ borderInlineStartColor: accent }}
                                                >
                                                        <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-medium text-neutral-500">پاسخ به</p>
                                                                <p className="mt-0.5 line-clamp-2 text-[12px] text-neutral-700">
                                                                        {reply.text}
                                                                </p>
                                                        </div>
                                                        <button
                                                                type="button"
                                                                onClick={() => setReply(null)}
                                                                aria-label="لغو پاسخ"
                                                                className="shrink-0 rounded-full p-1 text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700"
                                                        >
                                                                <X className="h-3.5 w-3.5" />
                                                        </button>
                                                </div>
                                        )}
                                        <form
                                                onSubmit={(e) => {
                                                        e.preventDefault()
                                                        void send(input)
                                                }}
                                                className="flex items-end gap-2"
                                        >
                                                <div dir="ltr" className="relative flex min-w-0 flex-1 items-end rounded-3xl border border-black/10 bg-white pr-1.5 pl-1 py-1.5 shadow-sm transition-all focus-within:shadow-md focus-within:[box-shadow:0_0_0_3px_var(--vgt-accent)] focus-within:border-[var(--vgt-accent)]">
                                                        <textarea
                                                                dir="rtl"
                                                                ref={inputRef}
                                                                rows={1}
                                                                value={input}
                                                                disabled={leadPending || !hydrated}
                                                                onChange={(e) => {
                                                                        setInput(e.target.value)
                                                                        autoGrow()
                                                                }}
                                                                onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                                e.preventDefault()
                                                                                void send(input)
                                                                        }
                                                                }}
                                                                placeholder={
                                                                        leadPending ? 'اول معرفی کوتاه را کامل کنید…' : 'پیام خود را بنویسید…'
                                                                }
                                                                className="max-h-[120px] min-h-[44px] w-full resize-none bg-transparent px-4 py-2.5 text-[16px] leading-6 outline-none placeholder:text-neutral-400 disabled:opacity-60"
                                                        />
                                                        <button
                                                                type="submit"
                                                                disabled={!input.trim() || streaming || leadPending || !hydrated}
                                                                aria-label="ارسال"
                                                                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center self-center rounded-full transition-all active:scale-90 disabled:opacity-30"
                                                                style={{ backgroundColor: accent, color: onAccent }}
                                                        >
                                                                {streaming ? (
                                                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                                ) : (
                                                                        <SendIcon className="h-[18px] w-[18px]" />
                                                                )}
                                                        </button>
                                                </div>
                                        </form>
                                        <p dir="ltr" className="mt-2 text-center text-[10px] text-neutral-400">
                                                Powered by{' '}
                                                <Link
                                                        href="/"
                                                        className="inline-flex items-center align-middle font-medium text-neutral-500 transition-colors hover:text-neutral-800"
                                                >
                                                        <svg viewBox="174 298 692 126" height="11" className="inline-block fill-current" xmlns="http://www.w3.org/2000/svg" aria-label="Vigent"><g transform="matrix(2.4635 0 0 2.4635 512 360.934)"><g transform="translate(-111.996 0)"><path transform="translate(-100 -95.9747)" d="M 120.484 70.7747 L 104.14 107.2787 L 106.156 111.3827 L 124.3 70.7747 Z M 100.108 116.4227 L 99.1 114.3347 L 96.364 108.0707 L 79.732 70.7747 L 75.7 70.7747 L 98.164 121.1747 L 102.196 121.1747 L 102.052 120.8147 Z"/></g><g transform="translate(-76.644 0)"><path transform="translate(-100 -95.9747)" d="M 101.836 78.5507 L 101.836 70.7747 L 98.164 70.7747 L 98.164 78.5507 Z M 101.836 121.1747 L 101.836 86.7587 L 98.164 86.7587 L 98.164 121.1747 Z"/></g><g transform="translate(-40.14 0)"><path transform="translate(-98.236 -95.9747)" d="M 116.776 117.7187 C 118.072 116.9987 119.224 116.0627 120.304 115.0547 L 120.304 96.1907 L 116.776 96.1907 Z M 90.784 76.6787 C 94.24 74.7347 98.128 73.7987 102.448 73.7987 C 105.616 73.7987 108.496 74.3027 111.16 75.2387 C 113.752 76.1747 116.128 77.6867 118.216 79.7747 L 120.52 77.3267 C 118.288 75.0947 115.624 73.3667 112.6 72.2147 C 109.504 70.9907 106.048 70.4147 102.376 70.4147 C 97.336 70.4147 92.8 71.4947 88.84 73.7267 C 84.808 75.9587 81.64 78.9827 79.408 82.8707 C 77.104 86.7587 75.952 91.1507 75.952 95.9747 C 75.952 100.7987 77.104 105.1907 79.408 109.0787 C 81.64 112.9667 84.808 115.9907 88.84 118.2227 C 92.8 120.4547 97.336 121.5347 102.304 121.5347 C 104.68 121.5347 106.912 121.1747 109.072 120.6707 L 109.072 117.2867 C 107.056 117.8627 104.824 118.1507 102.448 118.1507 C 98.128 118.1507 94.24 117.2147 90.784 115.2707 C 87.328 113.3267 84.592 110.6627 82.648 107.2787 C 80.632 103.8947 79.624 100.0787 79.624 95.9747 C 79.624 91.7987 80.632 88.0547 82.576 84.6707 C 84.52 81.2147 87.256 78.6227 90.784 76.6787 Z"/></g><g transform="translate(14.364 0)"><path transform="translate(-101.008 -95.9747)" d="M 117.316 74.0867 L 117.316 70.7747 L 84.7 70.7747 L 84.7 74.0867 Z M 117.316 121.1747 L 117.316 117.8627 L 84.7 117.8627 L 84.7 121.1747 Z M 117.316 97.1987 L 117.316 93.9587 L 95.5 93.9587 L 95.5 97.1987 Z M 88.084 81.2147 L 84.7 81.2147 L 84.7 109.9427 L 88.084 109.9427 Z"/></g><g transform="translate(66.744 0)"><path transform="translate(-100 -95.9747)" d="M 79.48 121.1747 L 83.152 121.1747 L 83.152 86.1827 L 79.48 81.2147 Z M 116.848 70.7747 L 116.848 114.5507 L 82.576 70.7747 L 79.48 70.7747 L 79.48 72.5027 L 83.152 77.3987 L 117.496 121.1747 L 120.52 121.1747 L 120.52 70.7747 Z"/></g><g transform="translate(116.316 0)"><path transform="translate(-100 -95.9747)" d="M 80.02 70.7747 L 80.02 74.0867 L 119.98 74.0867 L 119.98 70.7747 Z M 101.836 121.1747 L 101.836 81.1427 L 98.164 81.1427 L 98.164 121.1747 Z"/></g></g></svg>
                                                </Link>
                                        </p>
                                        </>
                                )}
                                </div>
                        </div>
                </div>
        )
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Avatar({
        avatar,
        monogram,
        accent,
        size,
        online = false,
        pulse = false,
}: {
        avatar: string | null
        monogram: string
        accent: string
        size: number
        online?: boolean
        pulse?: boolean
}) {
        return (
                <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
                        {pulse && (
                                <span
                                        className="absolute -inset-2 animate-ping rounded-full opacity-10 [animation-duration:2.4s]"
                                        style={{ backgroundColor: accent }}
                                />
                        )}
                        {avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                        src={avatar}
                                        alt=""
                                        width={size}
                                        height={size}
                                        className="relative rounded-full object-cover ring-1 ring-black/10"
                                        style={{ width: size, height: size }}
                                />
                        ) : (
                                <span
                                        className="relative flex items-center justify-center rounded-full text-sm font-semibold ring-1 ring-black/10"
                                        style={{
                                                width: size,
                                                height: size,
                                                backgroundColor: accent,
                                                color: contrastOn(accent),
                                                fontSize: size * 0.4,
                                        }}
                                >
                                        {monogram}
                                </span>
                        )}
                        {online && (
                                <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                        )}
                </span>
        )
}

function Intro(props: {
        name: string
        avatar: string | null
        monogram: string
        accent: string
        onAccent: string
        tagline: string | null
        welcomeMessage: string | null
        quickReplies: string[]
        showAiBadge: boolean
        leadPending: boolean
        leadName: string
        leadPhone: string
        leadMessage: string | null
        leadRequired: boolean
        setLeadName: (v: string) => void
        setLeadPhone: (v: string) => void
        submitLead: () => void
        onSkip: () => void
        onPick: (q: string) => void
}) {
        const {
                name,
                avatar,
                monogram,
                accent,
                tagline,
                welcomeMessage,
                quickReplies,
                showAiBadge,
                leadPending,
                leadName,
                leadPhone,
                leadMessage,
                leadRequired,
                setLeadName,
                setLeadPhone,
                submitLead,
                onSkip,
                onPick,
        } = props

        return (
                <div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
                        <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                                <Avatar avatar={avatar} monogram={monogram} accent={accent} size={76} pulse />
                        </motion.div>

                        {showAiBadge && (
                                <motion.span
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.15, duration: 0.45 }}
                                        className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-1.5 text-[11px] tracking-wide text-neutral-600 shadow-sm backdrop-blur"
                                >
                                        <Sparkles className="h-3 w-3" style={{ color: accent }} />
                                        پاسخ فوری با هوش مصنوعی
                                </motion.span>
                        )}

                        <motion.h1
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.22, duration: 0.45 }}
                                className="mt-3 text-2xl font-light tracking-tight"
                        >
                                {name}
                        </motion.h1>

                        {tagline && (
                                <motion.p
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3, duration: 0.45 }}
                                        className="mt-1.5 max-w-xs text-sm text-neutral-500"
                                >
                                        {tagline}
                                </motion.p>
                        )}

                        {leadPending ? (
                                <motion.div
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.4, duration: 0.5 }}
                                        className="mt-7 w-full max-w-sm rounded-3xl border border-black/[0.07] bg-white/85 p-5 text-start shadow-sm backdrop-blur"
                                >
                                        <p className="text-sm text-neutral-700">
                                                {leadMessage ?? 'برای شروع گفتگو، یک معرفی کوتاه بنویسید:'}
                                        </p>
                                        <div className="mt-4 space-y-2.5">
                                                <label className="flex items-center gap-2.5 rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 focus-within:border-black/25">
                                                        <User className="h-4 w-4 shrink-0 text-neutral-400" />
                                                        <input
                                                                value={leadName}
                                                                onChange={(e) => setLeadName(e.target.value)}
                                                                placeholder="نام شما"
                                                                dir="rtl"
                                                                className="w-full bg-transparent text-start text-[16px] outline-none placeholder:text-neutral-400"
                                                        />
                                                </label>
                                                <label className="flex items-center gap-2.5 rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 focus-within:border-black/25">
                                                        <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                                                        <input
                                                                value={leadPhone}
                                                                onChange={(e) => setLeadPhone(toEnglishDigits(e.target.value))}
                                                                placeholder="شماره موبایل"
                                                                inputMode="tel"
                                                                dir="rtl"
                                                                className="w-full bg-transparent text-start text-[16px] outline-none placeholder:text-neutral-400"
                                                        />
                                                </label>
                                                <button
                                                        onClick={submitLead}
                                                        disabled={!leadName.trim() || toEnglishDigits(leadPhone).replace(/\D/g, '').length < 10}
                                                        className="w-full rounded-2xl py-2.5 text-sm font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-40"
                                                        style={{ backgroundColor: accent, color: props.onAccent }}
                                                >
                                                        شروع گفتگو
                                                </button>
                                                {!leadRequired && (
                                                        <button
                                                                onClick={onSkip}
                                                                className="w-full py-1.5 text-xs text-neutral-400 transition-colors hover:text-neutral-700"
                                                        >
                                                                رد کردن و شروع گفتگو
                                                        </button>
                                                )}
                                        </div>
                                </motion.div>
                        ) : (
                                <>
                                        {welcomeMessage && (
                                                <motion.div
                                                        initial={{ opacity: 0, y: 12 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.4, duration: 0.5 }}
                                                        className="mt-7 max-w-sm rounded-3xl rounded-ss-lg border border-black/[0.07] bg-white/90 px-4 py-3 text-start text-sm leading-7 text-neutral-800 shadow-sm backdrop-blur"
                                                >
                                                        {welcomeMessage}
                                                </motion.div>
                                        )}

                                        {quickReplies.length > 0 && (
                                                <div className="mt-5 flex max-w-md flex-wrap items-center justify-center gap-2">
                                                        {quickReplies.map((q, i) => (
                                                                <motion.button
                                                                        key={q}
                                                                        initial={{ opacity: 0, y: 10 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        transition={{ delay: 0.5 + i * 0.07, duration: 0.4 }}
                                                                        onClick={() => onPick(q)}
                                                                        className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-[13px] text-neutral-700 shadow-sm backdrop-blur transition-all hover:border-black/25 hover:shadow active:scale-95"
                                                                >
                                                                        {q}
                                                                </motion.button>
                                                        ))}
                                                </div>
                                        )}
                                </>
                        )}
                </div>
        )
}

function MessageRow({
        msg,
        accent,
        onAccent,
        onReply,
}: {
        msg: Msg
        accent: string
        onAccent: string
        onReply?: (serverId: string | null, text: string) => void
}) {
        if (msg.role === 'error') {
                return (
                        <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mx-auto rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-xs text-red-600"
                        >
                                {msg.text}
                        </motion.div>
                )
        }

        const isUser = msg.role === 'user'
        return (
                <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className={isUser ? 'flex justify-end' : 'flex justify-start'}
                >
                        <div className={`max-w-[85%] ${isUser ? '' : 'space-y-2'}`}>
                                {msg.role === 'user' && msg.parentContent ? (
                                        <div
                                                className="mb-1 max-w-full rounded-2xl border-s-2 bg-black/[0.03] px-3 py-1.5 text-[12px] text-neutral-500"
                                                style={{ borderInlineStartColor: accent }}
                                        >
                                                <p className="line-clamp-2">{msg.parentContent}</p>
                                        </div>
                                ) : null}
                                {(isUser || msg.text) && (
                                        <div
                                                className={
                                                        isUser
                                                                ? 'rounded-3xl rounded-br-md px-4 py-2.5 text-[15px] leading-7 shadow-sm'
                                                                : 'rounded-3xl rounded-bl-md border border-black/[0.07] bg-white px-4 py-2.5 text-[15px] leading-7 text-neutral-800 shadow-sm'
                                                }
                                                style={isUser ? { backgroundColor: accent, color: onAccent } : undefined}
                                        >
                                                {isUser ? (
                                                        <span dir="auto" className="whitespace-pre-wrap">{msg.text}</span>
                                                ) : (
                                                        <div dir="auto" className="[&_p]:leading-7 [&_p]:whitespace-pre-wrap [&_p]:text-right">
                                                                <Markdown>{msg.text}</Markdown>
                                                        </div>
                                                )}
                                        </div>
                                )}
                                {onReply && msg.role === 'assistant' && msg.done && msg.text ? (
                                        <button
                                                type="button"
                                                onClick={() => onReply(msg.serverId ?? null, msg.text)}
                                                className="ms-1 mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700"
                                                aria-label="پاسخ به این پیام"
                                        >
                                                <Reply className="h-3.5 w-3.5" />
                                                <span>پاسخ</span>
                                        </button>
                                ) : null}
                                {!isUser &&
                                        msg.cards.map((card, i) => (
                                                <div
                                                        key={`${card.name}-${i}`}
                                                        className="flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white p-3 shadow-sm"
                                                >
                                                        <span
                                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
                                                                style={{ backgroundColor: `${accent}14`, color: accent }}
                                                        >
                                                                {card.name.charAt(0)}
                                                        </span>
                                                        <span className="min-w-0 flex-1 text-start">
                                                                <span className="flex items-center gap-2">
                                                                        <span className="truncate text-[13px] font-medium text-neutral-900">
                                                                                {card.name}
                                                                        </span>
                                                                        {card.badge && (
                                                                                <span
                                                                                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                                                                                        style={{ backgroundColor: `${accent}14`, color: accent }}
                                                                                >
                                                                                        {card.badge}
                                                                                </span>
                                                                        )}
                                                                </span>
                                                                {card.desc && (
                                                                        <span className="mt-0.5 block truncate text-xs text-neutral-500">
                                                                                {card.desc}
                                                                        </span>
                                                                )}
                                                                {card.price && (
                                                                        <span className="mt-1 block text-[13px] font-semibold text-neutral-900">
                                                                                {card.price}
                                                                        </span>
                                                                )}
                                                        </span>
                                                </div>
                                        ))}
                        </div>
                </motion.div>
        )
}

// Subtle full-area loading state shown while the transcript hydrates from
// localStorage / the server, so the page never looks frozen on a cold visit.
function LoadingDots({ accent }: { accent: string }) {
        return (
                <div className="flex h-full items-center justify-center py-12">
                        <div className="flex items-center gap-1.5">
                                {[0, 1, 2].map((i) => (
                                        <span
                                                key={i}
                                                className="h-2 w-2 animate-bounce rounded-full"
                                                style={{
                                                        backgroundColor: accent,
                                                        animationDelay: `${i * 0.15}s`,
                                                }}
                                        />
                                ))}
                        </div>
                </div>
        )
}

function TypingDots({ accent }: { accent: string }) {
        return (
                <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                >
                        <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-md border border-black/[0.07] bg-white px-4 py-3.5 shadow-sm">
                                {[0, 1, 2].map((i) => (
                                        <motion.span
                                                key={i}
                                                className="h-1.5 w-1.5 rounded-full"
                                                style={{ backgroundColor: accent, opacity: 0.5 }}
                                                animate={{ y: [0, -4, 0], opacity: [0.35, 0.9, 0.35] }}
                                                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                                        />
                                ))}
                        </div>
                </motion.div>
        )
}

/** Ambient page background — quiet, slow, never competing with the chat. */
function Background({
        kind,
        accent,
}: {
        kind: ChatLinkSettings['background']
        accent: string
}) {
        if (kind === 'minimal') return null

        if (kind === 'dots') {
                return (
                        <div
                                aria-hidden
                                className="pointer-events-none absolute inset-0 opacity-[0.5]"
                                style={{
                                        backgroundImage: 'radial-gradient(rgba(0,0,0,0.10) 1px, transparent 1px)',
                                        backgroundSize: '22px 22px',
                                        maskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, black, transparent)',
                                        WebkitMaskImage:
                                                'radial-gradient(ellipse 90% 70% at 50% 30%, black, transparent)',
                                }}
                        />
                )
        }

        // aurora / mesh: two soft drifting blobs (accent-tinted for mesh).
        const blobA = kind === 'mesh' ? accent : '#94a3b8'
        const blobB = kind === 'mesh' ? '#f59e0b' : accent
        return (
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                        <motion.div
                                className="absolute -top-32 start-[-15%] h-[420px] w-[420px] rounded-full blur-[110px]"
                                style={{ backgroundColor: blobA, opacity: 0.14 }}
                                animate={{ x: [0, 40, 0], y: [0, 24, 0] }}
                                transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.div
                                className="absolute bottom-[-20%] end-[-10%] h-[380px] w-[380px] rounded-full blur-[110px]"
                                style={{ backgroundColor: blobB, opacity: 0.1 }}
                                animate={{ x: [0, -32, 0], y: [0, -20, 0] }}
                                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
                        />
                </div>
        )
}
