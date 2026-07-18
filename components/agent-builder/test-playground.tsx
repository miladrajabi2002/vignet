'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Bot, Send, Loader2, ThumbsUp, ThumbsDown, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConversationBubble, ConversationText } from '@/components/chat/conversation-bubble'
import { SpeakButton } from '@/components/voice/audio-player'

// The VAD recorder pulls a sizeable ONNX/WASM runtime. Split it from the agent
// detail route so text chat becomes interactive before voice tooling arrives.
const VoiceRecorder = dynamic(
        () => import('@/components/voice/voice-recorder').then((module) => module.VoiceRecorder),
        { ssr: false, loading: () => <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-[var(--bg-base)]" /> },
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

        const [messages, setMessages] = useState<Msg[]>(
                welcomeMessage ? [{ role: 'assistant', content: welcomeMessage }] : [],
        )
        const [input, setInput] = useState('')
        const [streaming, setStreaming] = useState(false)
        const [error, setError] = useState<string | null>(null)
        const conversationId = useRef<string | undefined>(undefined)
        const scrollRef = useRef<HTMLDivElement>(null)
        const inputRef = useRef<HTMLTextAreaElement>(null)

        useEffect(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
        }, [messages])

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

                        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
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
                                        messages.map((m, i) => (
                                                <div
                                                        key={i}
                                                        className={cn(
                                                                'flex items-end gap-1.5',
                                                                m.role === 'user' ? 'justify-end' : 'justify-start',
                                                        )}
                                                >
                                                        <div className="flex flex-col gap-1">
                                                                <ConversationBubble
                                                                        side={m.role === 'user' ? 'end' : 'start'}
                                                                        tone={m.role === 'user' ? 'inverse' : 'surface'}
                                                                        className="max-w-[80%] px-4"
                                                                >
                                                                        {m.content ? (
                                                                                <ConversationText
                                                                                        text={m.content}
                                                                                        markdown={m.role === 'assistant'}
                                                                                />
                                                                        ) : (
                                                                                <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
                                                                        )}
                                                                </ConversationBubble>
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
                                        ))
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

                        <form
                                onSubmit={(event) => {
                                        event.preventDefault()
                                        void send()
                                }}
                                className="flex items-end gap-2 bg-[var(--bg-base)] p-3"
                        >
                                <button
                                        type="submit"
                                        disabled={streaming || !input.trim()}
                                        className="order-last inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-xs font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 active:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 rtl:order-first"
                                >
                                        {streaming ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                                <Send className="h-4 w-4" />
                                        )}
                                        <span>{streaming ? t('sending') : t('send')}</span>
                                </button>
                                <div className="min-w-0 flex-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] px-3.5 py-2 focus-within:border-[var(--border-strong)] focus-within:ring-2 focus-within:ring-black/5">
                                        <textarea
                                                ref={inputRef}
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault()
                                                                void send()
                                                        }
                                                }}
                                                rows={1}
                                                placeholder={t('placeholder')}
                                                aria-label={t('placeholder')}
                                                className="block min-h-7 max-h-24 w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-[var(--text-muted)]"
                                        />
                                </div>
                                <div className="order-first shrink-0 rtl:order-last">
                                        <VoiceRecorder
                                                vad
                                                disabled={streaming}
                                                label={t('record')}
                                                onTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
                                                onError={(code) => setError(code === 'NO_CREDIT' ? t('noKey') : t('error'))}
                                        />
                                </div>
                        </form>
                </div>
        )
}
