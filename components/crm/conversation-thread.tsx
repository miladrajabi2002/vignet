'use client'

/**
 * Conversation thread — the scrollable message list + the operator reply box.
 *
 * This is a CLIENT component so it can display new operator messages INSTANTLY
 * (optimistic update) without waiting for a full page refresh. The flow:
 *   1. Operator types a reply and hits send.
 *   2. The API persists the message and returns it.
 *   3. `onSent` callback appends the message to `pendingMessages` state →
 *      the bubble appears immediately in the UI.
 *   4. `router.refresh()` runs silently in the background to sync the
 *      conversation status / handoff panel, but the user never waits for it.
 *
 * Messages from the server (`initialMessages`) are merged with locally-added
 * `pendingMessages` and `polledMessages` (new messages fetched by the polling
 * loop), all deduplicated by ID.
 *
 * ── Real-time polling ──
 * The thread polls GET /api/conversations/[id]/messages?since=<lastId> every
 * 5 seconds. This catches new visitor messages on ANY channel (widget,
 * chat-link, WhatsApp, Instagram, Telegram, etc.) and messages from other
 * operator tabs — without a full page refresh. When the operator has scrolled
 * up to read history, new messages show a "new messages ↓" badge instead of
 * yanking the scroll position (matches Telegram/WhatsApp web behavior).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { Markdown } from '@/lib/markdown'
import { stripProductTokens } from '@/lib/widget/config'
import { OperatorReply } from './operator-reply'

export type ThreadMessage = {
        id: string
        role: 'USER' | 'ASSISTANT' | 'SYSTEM'
        content: string
        createdAt: string
        contentType: string
        metadata: Record<string, unknown> | null
}

export function ConversationThread({
        initialMessages,
        conversationId,
        canDeliver,
        locale,
}: {
        initialMessages: ThreadMessage[]
        conversationId: string
        canDeliver: boolean
        locale: 'fa' | 'en'
}) {
        const t = useTranslations('conversations')
        const [pendingMessages, setPendingMessages] = useState<ThreadMessage[]>([])
        const [polledMessages, setPolledMessages] = useState<ThreadMessage[]>([])
        const [hasNewMessages, setHasNewMessages] = useState(false)
        const scrollRef = useRef<HTMLDivElement>(null)
        const lastMessageIdRef = useRef<string | null>(
                initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].id : null,
        )
        const isAtBottomRef = useRef(true)

        // Track whether the operator is scrolled to the bottom of the thread.
        // When they scroll up to read history, we DON'T auto-scroll on new
        // messages — instead we show a "new messages" badge so they can jump
        // down when ready. Matches Telegram/WhatsApp web behavior.
        function handleScroll() {
                const el = scrollRef.current
                if (!el) return
                const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
                isAtBottomRef.current = atBottom
                if (atBottom) setHasNewMessages(false)
        }

        const scrollToBottom = useCallback((smooth = true) => {
                const el = scrollRef.current
                if (!el) return
                el.scrollTo({
                        top: el.scrollHeight,
                        behavior: smooth ? 'smooth' : 'auto',
                })
        }, [])

        // ── Polling for new messages ───────────────────────────────────────────
        // Polls GET /api/conversations/[id]/messages?since=<lastId> every 5s.
        // Catches new visitor messages on ANY channel (widget, chat-link,
        // WhatsApp, Instagram, Telegram, etc.) + messages from other operator
        // tabs. Deduped by id against the merged list so nothing double-renders.
        useEffect(() => {
                let cancelled = false
                const poll = async () => {
                        const sinceId = lastMessageIdRef.current
                        if (!sinceId) return
                        try {
                                const url = `/api/conversations/${conversationId}/messages?since=${encodeURIComponent(sinceId)}`
                                const res = await fetch(url, { headers: { Accept: 'application/json' } })
                                if (!res.ok || cancelled) return
                                const data = await res.json()
                                if (cancelled || !Array.isArray(data.messages) || data.messages.length === 0) return
                                const newest = data.messages[data.messages.length - 1]
                                if (newest && newest.id) lastMessageIdRef.current = newest.id
                                setPolledMessages((prev) => {
                                        const existing = new Set(prev.map((m) => m.id))
                                        const fresh = data.messages.filter((m: ThreadMessage) => !existing.has(m.id))
                                        return fresh.length ? [...prev, ...fresh] : prev
                                })
                                if (isAtBottomRef.current) {
                                        scrollToBottom()
                                } else {
                                        setHasNewMessages(true)
                                }
                        } catch {
                                /* network error — skip this cycle */
                        }
                }
                const interval = setInterval(poll, 5000)
                return () => {
                        cancelled = true
                        clearInterval(interval)
                }
        }, [conversationId, scrollToBottom])

        // Merge server + polled + pending messages (all deduped by ID).
        // Order: server messages first, then polled (new from server), then
        // pending (optimistic operator messages not yet confirmed by server).
        const seenIds = new Set<string>()
        const messages: ThreadMessage[] = []
        for (const m of [...initialMessages, ...polledMessages, ...pendingMessages]) {
                if (seenIds.has(m.id)) continue
                seenIds.add(m.id)
                messages.push(m)
        }
        if (messages.length > 0) {
                lastMessageIdRef.current = messages[messages.length - 1].id
        }

        // Clean up pending messages that are now in the server list (after refresh).
        useEffect(() => {
                setPendingMessages((prev) =>
                        prev.filter((pm) => !initialMessages.find((im) => im.id === pm.id)),
                )
        }, [initialMessages])

        // Auto-scroll to bottom on initial mount. Polled messages are handled in
        // the polling effect (which respects the isAtBottom flag so we don't yank
        // the scroll position when the operator is reading history).
        useEffect(() => {
                if (isAtBottomRef.current) scrollToBottom(false)
        }, [scrollToBottom])
        // Scroll when the operator sends a message (they expect to see it).
        useEffect(() => {
                if (pendingMessages.length > 0) scrollToBottom()
        }, [pendingMessages.length, scrollToBottom])

        function handleSent(message: ThreadMessage) {
                setPendingMessages((prev) => [...prev, message])
        }

        return (
                <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
                        <div ref={scrollRef} onScroll={handleScroll} className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                                {messages.map((m) => {
                                        const isUser = m.role === 'USER'
                                        if (m.role === 'SYSTEM') return null
                                        const isOperator =
                                                !!m.metadata &&
                                                typeof m.metadata === 'object' &&
                                                (m.metadata as Record<string, unknown>).operator === true
                                        return (
                                                <div
                                                        key={m.id}
                                                        className={cn('flex', isUser ? 'justify-start' : 'justify-end')}
                                                >
                                                        <div
                                                                className={cn(
                                                                        'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                                                                        isUser
                                                                                ? 'bg-[var(--bg-muted)] text-[var(--text-primary)]'
                                                                                : 'bg-[var(--white)] text-[var(--bg-base)]',
                                                                )}
                                                        >
                                                                {isOperator && (
                                                                        <span className="mb-0.5 block text-[10px] font-medium opacity-60">
                                                                                {t('operatorBadge')}
                                                                        </span>
                                                                )}
                                                                {isUser ? (
                                                                        <p className="whitespace-pre-wrap break-words">
                                                                                {stripProductTokens(m.content)}
                                                                        </p>
                                                                ) : (
                                                                        <div className="break-words [&_p]:whitespace-pre-wrap [&_p]:break-words">
                                                                                <Markdown>{stripProductTokens(m.content)}</Markdown>
                                                                        </div>
                                                                )}
                                                                <span
                                                                        className={cn(
                                                                                'mt-1 block text-[10px]',
                                                                                isUser
                                                                                        ? 'text-[var(--text-muted)]'
                                                                                        : 'text-[var(--bg-base)] opacity-40',
                                                                        )}
                                                                >
                                                                        {formatDateTime(new Date(m.createdAt), locale)}
                                                                </span>
                                                        </div>
                                                </div>
                                        )
                                })}
                                {messages.length === 0 && (
                                        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                                                {t('noMessages')}
                                        </p>
                                )}
                                {hasNewMessages && messages.length > 0 && (
                                        <button
                                                onClick={() => {
                                                        setHasNewMessages(false)
                                                        scrollToBottom()
                                                }}
                                                className="sticky bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[var(--bg-base)] px-4 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-lg ring-1 ring-[var(--border-default)] transition-all hover:scale-105"
                                        >
                                                پیام‌های جدید ↓
                                        </button>
                                )}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-subtle)] p-3">
                                <OperatorReply
                                        conversationId={conversationId}
                                        canDeliver={canDeliver}
                                        onSent={handleSent}
                                />
                        </div>
                </div>
        )
}
