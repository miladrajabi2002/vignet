'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { Send, Loader2, ThumbsUp, ThumbsDown } from 'lucide-react'
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
}: {
        agentId: string
        welcomeMessage?: string | null
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
                                setStreaming(false)
                                return
                        }

                        const reader = res.body.getReader()
                        const decoder = new TextDecoder()
                        let buffer = ''

                        while (true) {
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
                                                }
                                        } catch {
                                                /* ignore */
                                        }
                                }
                        }
                } catch {
                        setError(t('error'))
                } finally {
                        setStreaming(false)
                }
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
                <div className="flex h-[480px] flex-col overflow-hidden rounded-2xl bg-[var(--bg-muted)]">
                        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                                {messages.length === 0 ? (
                                        <div className="flex h-full flex-col items-center justify-center text-center">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-base)] text-[var(--text-muted)] shadow-sm">
                                                        <Send className="h-5 w-5" />
                                                </div>
                                                <p className="mt-3 text-sm text-[var(--text-muted)]">{t('empty')}</p>
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
                                                                                        onClick={() => rate(m.id!, 1, i)}
                                                                                        className={cn(
                                                                                                'rounded p-1 transition-colors',
                                                                                                m.rating === 1
                                                                                                        ? 'text-success'
                                                                                                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                                                                                        )}
                                                                                        title={t('rateGood')}
                                                                                >
                                                                                        <ThumbsUp className="h-3.5 w-3.5" />
                                                                                </button>
                                                                                <button
                                                                                        onClick={() => rate(m.id!, -1, i)}
                                                                                        className={cn(
                                                                                                'rounded p-1 transition-colors',
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
                                <div className="border-t border-danger/20 bg-danger/5 px-5 py-2 text-xs text-danger">
                                        {error}
                                </div>
                        )}

                        <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] p-3">
                                <VoiceRecorder
                                        vad
                                        disabled={streaming}
                                        label={t('record')}
                                        onTranscript={(text) => setInput((prev) => (prev ? `${prev} ${text}` : text))}
                                        onError={(code) => setError(code === 'NO_CREDIT' ? t('noKey') : t('error'))}
                                />
                                <div className="relative flex min-w-0 flex-1 items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] pe-1 ps-3.5 focus-within:border-[var(--border-strong)]">
                                        <input
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && send()}
                                                placeholder={t('placeholder')}
                                                className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                                        />
                                        <button
                                                onClick={send}
                                                disabled={streaming || !input.trim()}
                                                className="flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-lg bg-[var(--text-primary)] text-[var(--bg-base)] transition-opacity hover:opacity-90 active:opacity-100 disabled:opacity-40"
                                                aria-label={t('send')}
                                        >
                                                {streaming ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                        <Send className="h-4 w-4" />
                                                )}
                                        </button>
                                </div>
                        </div>
                </div>
        )
}
