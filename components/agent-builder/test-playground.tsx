'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Bot, ThumbsUp, ThumbsDown, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatComposer, type ChatComposerHandle } from '@/components/chat/chat-composer'
import { ConversationBubble, ConversationText } from '@/components/chat/conversation-bubble'
import { TypingIndicator } from '@/components/chat/typing-indicator'
import { parseProductShowcaseContent } from '@/components/products/product-showcase'
import { ProductShowcaseRail } from '@/components/products/product-showcase-rail'
import { SpeakButton } from '@/components/voice/audio-player'

// The VAD recorder pulls a sizeable ONNX/WASM runtime. Split it from the agent
// detail route so text chat becomes interactive before voice tooling arrives.
// The placeholder matches the real button's 40px box so the composer pill keeps
// its height while the chunk loads.
const VoiceRecorder = dynamic(
        () => import('@/components/voice/voice-recorder').then((module) => module.VoiceRecorder),
        { ssr: false, loading: () => <span className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[var(--bg-muted)]" /> },
)

interface Msg {
        role: 'user' | 'assistant'
        content: string
        id?: string
        rating?: 1 | -1 | null
}

export function TestPlayground({
        agentId,
        welcomeMessage,
        suggestedPrompts = [],
}: {
        agentId: string
        welcomeMessage?: string | null
        suggestedPrompts?: string[]
}) {
        const t = useTranslations('agents.playground')
        const locale = useLocale() === 'en' ? 'en' : 'fa'

        const [messages, setMessages] = useState<Msg[]>(
                welcomeMessage ? [{ role: 'assistant', content: welcomeMessage }] : [],
        )
        const [input, setInput] = useState('')
        const [streaming, setStreaming] = useState(false)
        const [error, setError] = useState<string | null>(null)
        const conversationId = useRef<string | undefined>(undefined)
        const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
        const scrollRef = useRef<HTMLDivElement>(null)
        const inputRef = useRef<ChatComposerHandle>(null)
        const isAtBottomRef = useRef(true)

        // Track whether the owner is parked at the bottom. When they scroll up to
        // re-read an answer, streaming deltas must NOT yank them back down.
        // Same rule as the operator inbox thread.
        function handleScroll() {
                const el = scrollRef.current
                if (!el) return
                isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
        }

        const scrollToBottom = useCallback(() => {
                const el = scrollRef.current
                if (!el) return
                el.scrollTo({ top: el.scrollHeight })
        }, [])

        useEffect(() => {
                if (isAtBottomRef.current) scrollToBottom()
        }, [messages, scrollToBottom])

        // API conversations use persisted history as their return path for
        // operator replies. Once the SSE turn finishes, poll that shared
        // history so a reply sent from CRM appears here without another user
        // request or a page refresh — the same delivery contract as Chat Link
        // and Web Widget.
        useEffect(() => {
                if (!activeConversationId || streaming) return
                let cancelled = false
                let inFlight = false

                async function pollHistory() {
                        if (cancelled || inFlight || document.visibilityState === 'hidden') return
                        inFlight = true
                        try {
                                const res = await fetch(
                                        `/api/conversations/${encodeURIComponent(activeConversationId!)}/messages`,
                                        { headers: { Accept: 'application/json' }, cache: 'no-store' },
                                )
                                if (!res.ok) return
                                const data = await res.json() as { messages?: unknown[] }
                                if (cancelled || !Array.isArray(data.messages)) return
                                const historyMessages = data.messages

                                setMessages((current) => {
                                        const seenIds = new Set(
                                                current.flatMap((message) => message.id ? [message.id] : []),
                                        )
                                        const seenUserText = new Set(
                                                current
                                                        .filter((message) => message.role === 'user')
                                                        .map((message) => message.content),
                                        )
                                        const additions: Msg[] = []

                                        for (const raw of historyMessages) {
                                                if (!raw || typeof raw !== 'object') continue
                                                const row = raw as Record<string, unknown>
                                                const id = typeof row.id === 'string' ? row.id : null
                                                const content = typeof row.content === 'string' ? row.content : null
                                                if (!id || content == null || seenIds.has(id)) continue
                                                if (row.role === 'USER') {
                                                        if (seenUserText.has(content)) continue
                                                        additions.push({ id, role: 'user', content })
                                                } else if (row.role === 'ASSISTANT') {
                                                        additions.push({ id, role: 'assistant', content, rating: null })
                                                }
                                        }

                                        return additions.length > 0 ? [...current, ...additions] : current
                                })
                        } catch {
                                // A transient polling failure must not interrupt the test chat.
                        } finally {
                                inFlight = false
                        }
                }

                void pollHistory()
                const interval = window.setInterval(pollHistory, 5000)
                return () => {
                        cancelled = true
                        window.clearInterval(interval)
                }
        }, [activeConversationId, streaming])

        async function send() {
                const text = input.trim()
                if (!text || streaming) return
                setError(null)
                setInput('')
                setMessages((m) => [
                        ...m,
                        { role: 'user', content: text },
                        { role: 'assistant', content: '' },
                ])
                // Sending is always worth following, even if they had scrolled up.
                isAtBottomRef.current = true
                setStreaming(true)

                try {
                        const res = await fetch('/api/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                        agentId,
                                        message: text,
                                        conversationId: conversationId.current,
                                }),
                        })

                        if (!res.ok || !res.body) {
                                const data = await res.json().catch(() => ({}))
                                setError(data.error === 'NO_CREDIT' ? t('noKey') : t('error'))
                                setMessages((m) => m.slice(0, -1))
                                setInput(text)
                                setStreaming(false)
                                return
                        }

                        const reader = res.body.getReader()
                        const decoder = new TextDecoder()
                        let buffer = ''
                        let streamFailed = false

                        while (!streamFailed) {
                                const { done, value } = await reader.read()
                                if (done) break
                                buffer += decoder.decode(value, { stream: true })
                                const parts = buffer.split('\n\n')
                                buffer = parts.pop() ?? ''
                                for (const part of parts) {
                                        const line = part.trim()
                                        if (!line.startsWith('data:')) continue
                                                try {
                                                        const evt = JSON.parse(line.slice(5).trim())
                                                        if (evt.type === 'meta') {
                                                                conversationId.current = evt.conversationId
                                                                setActiveConversationId(evt.conversationId)
                                                } else if (evt.type === 'delta') {
                                                        setMessages((m) => {
                                                                const next = [...m]
                                                                next[next.length - 1] = {
                                                                        ...next[next.length - 1],
                                                                        content: next[next.length - 1].content + evt.text,
                                                                }
                                                                return next
                                                        })
                                                } else if (evt.type === 'done' && evt.messageId) {
                                                        setMessages((m) => {
                                                                const next = [...m]
                                                                next[next.length - 1] = {
                                                                        ...next[next.length - 1],
                                                                        id: evt.messageId,
                                                                        rating: null,
                                                                }
                                                                return next
                                                        })
                                                } else if (evt.type === 'error') {
                                                        setError(t('error'))
                                                        streamFailed = true
                                                        break
                                                }
                                        } catch {
                                                /* ignore */
                                        }
                                }
                        }
                        if (streamFailed) {
                                setMessages((m) => m.slice(0, -1))
                                setInput((current) => current || text)
                        }
                } catch {
                        setError(t('error'))
                        setMessages((m) => m.slice(0, -1))
                        setInput((current) => current || text)
                } finally {
                        setStreaming(false)
                }
        }

        function resetSession() {
                if (streaming) return
                conversationId.current = undefined
                setActiveConversationId(null)
                setMessages(welcomeMessage ? [{ role: 'assistant', content: welcomeMessage }] : [])
                setInput('')
                setError(null)
                requestAnimationFrame(() => inputRef.current?.focus())
        }

        function selectSuggestedPrompt(prompt: string) {
                setInput(prompt)
                requestAnimationFrame(() => inputRef.current?.focus())
        }

        async function rate(msgId: string, value: 1 | -1, idx: number) {
                setMessages((m) => {
                        const next = [...m]
                        next[idx] = { ...next[idx], rating: value }
                        return next
                })
                await fetch(`/api/messages/${msgId}/rate`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rating: value }),
                }).catch(() => {})
        }

        return (
                <div className="flex h-[540px] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-muted)]">
                        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2.5">
                                <div className="flex min-w-0 items-center gap-2.5">
                                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                                        </span>
                                        <div className="min-w-0">
                                                <p className="truncate text-xs font-bold text-[var(--text-primary)]">
                                                        {t('sessionLabel')}
                                                </p>
                                                <p className="truncate text-[10px] text-[var(--text-muted)]">
                                                        {t('sessionHint')}
                                                </p>
                                        </div>
                                </div>
                                <button
                                        type="button"
                                        onClick={resetSession}
                                        disabled={streaming}
                                        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        {t('newSession')}
                                </button>
                        </div>

                        {/* dir=ltr pins the tester's own bubbles to the visual RIGHT in every
                            dashboard locale, which is what a visitor sees on the widget and
                            the chat link. Message text keeps its own dir via ConversationText. */}
                        <div
                                ref={scrollRef}
                                onScroll={handleScroll}
                                dir="ltr"
                                className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5"
                        >
                                {messages.length === 0 ? (
                                        <div className="flex h-full flex-col items-center justify-center text-center">
                                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-muted)] shadow-sm">
                                                        <Bot className="h-6 w-6" />
                                                </div>
                                                <p className="mt-3 text-sm font-semibold text-[var(--text-secondary)]">{t('empty')}</p>
                                                <p className="mt-1 max-w-xs text-xs leading-5 text-[var(--text-muted)]">
                                                        {t('emptyHint')}
                                                </p>
                                        </div>
                                ) : (
                                        messages.map((m, i) => {
                                                const isUser = m.role === 'user'
                                                // Same rule as the chat link and widget: strip [[product:{…}]]
                                                // markers into real cards, and hold a partial marker back while
                                                // the last message is still streaming so machine syntax never
                                                // flashes on screen.
                                                const showcase = isUser
                                                        ? { text: m.content, products: [] }
                                                        : parseProductShowcaseContent(m.content, !streaming || i !== messages.length - 1)
                                                const hasShowcase = showcase.products.length > 0
                                                return (
                                                        <div
                                                                key={i}
                                                                className={cn(
                                                                        'flex items-end gap-1.5',
                                                                        isUser ? 'justify-end' : 'justify-start',
                                                                )}
                                                        >
                                                                <div
                                                                        className={cn(
                                                                                'flex flex-col gap-1',
                                                                                isUser ? 'items-end' : 'items-start',
                                                                                hasShowcase ? 'w-full max-w-[46rem]' : 'max-w-[82%]',
                                                                        )}
                                                                >
                                                                        {showcase.text ? (
                                                                                <ConversationBubble
                                                                                        side={isUser ? 'end' : 'start'}
                                                                                        tone={isUser ? 'inverse' : 'surface'}
                                                                                        className="max-w-full px-4"
                                                                                >
                                                                                        <ConversationText
                                                                                                text={showcase.text}
                                                                                                markdown={m.role === 'assistant'}
                                                                                        />
                                                                                </ConversationBubble>
                                                                        ) : !hasShowcase ? (
                                                                                <TypingIndicator
                                                                                        label={t('typing')}
                                                                                        variant="app"
                                                                                />
                                                                        ) : null}
                                                                        {m.role === 'assistant' && hasShowcase && (
                                                                                <ProductShowcaseRail
                                                                                        products={showcase.products}
                                                                                        locale={locale}
                                                                                        compact
                                                                                        className="mt-1 w-full"
                                                                                />
                                                                        )}
                                                                        {m.role === 'assistant' && m.id && m.content && (
                                                                                <div className="flex items-center gap-1 ps-1">
                                                                                        <button
                                                                                                type="button"
                                                                                                onClick={() => rate(m.id!, 1, i)}
                                                                                                className={cn(
                                                                                                        'inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                                                                                                        m.rating === 1
                                                                                                                ? 'text-success'
                                                                                                                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                                                                                                )}
                                                                                                title={t('rateGood')}
                                                                                        >
                                                                                                <ThumbsUp className="h-3.5 w-3.5" />
                                                                                        </button>
                                                                                        <button
                                                                                                type="button"
                                                                                                onClick={() => rate(m.id!, -1, i)}
                                                                                                className={cn(
                                                                                                        'inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                                                                                                        m.rating === -1
                                                                                                                ? 'text-danger'
                                                                                                                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                                                                                                )}
                                                                                                title={t('rateBad')}
                                                                                        >
                                                                                                <ThumbsDown className="h-3.5 w-3.5" />
                                                                                        </button>
                                                                                </div>
                                                                        )}
                                                                </div>
                                                                {m.role === 'assistant' && m.content && (
                                                                        <SpeakButton text={m.content} label={t('speak')} />
                                                                )}
                                                        </div>
                                                )
                                        })
                                )}
                        </div>

                        {error && (
                                <div role="alert" className="border-t border-danger/20 bg-danger/5 px-5 py-2 text-xs text-danger">
                                        {error}
                                </div>
                        )}

                        {suggestedPrompts.length > 0 && (
                                <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 pt-3">
                                        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                                                <Sparkles className="h-3.5 w-3.5" />
                                                {t('suggestions')}
                                        </div>
                                        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
                                                {suggestedPrompts.map((prompt) => (
                                                        <button
                                                                key={prompt}
                                                                type="button"
                                                                onClick={() => selectSuggestedPrompt(prompt)}
                                                                disabled={streaming}
                                                                className="min-h-11 shrink-0 rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] px-3 text-[11px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
                                                        >
                                                                {prompt}
                                                        </button>
                                                ))}
                                        </div>
                                </div>
                        )}

                        <div className="bg-[var(--bg-base)] p-3">
                                <ChatComposer
                                        ref={inputRef}
                                        value={input}
                                        onChange={setInput}
                                        onSend={() => void send()}
                                        placeholder={t('placeholder')}
                                        busy={streaming}
                                        sendLabel={streaming ? t('sending') : t('send')}
                                        leading={
                                                <VoiceRecorder
                                                        vad
                                                        disabled={streaming}
                                                        label={t('record')}
                                                        onTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
                                                        onError={(code) => setError(code === 'NO_CREDIT' ? t('noKey') : t('error'))}
                                                />
                                        }
                                />
                        </div>
                </div>
        )
}
