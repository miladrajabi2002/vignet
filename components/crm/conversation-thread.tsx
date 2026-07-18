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
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { stripProductTokens } from '@/lib/widget/config'
import { ConversationBubble, ConversationText } from '@/components/chat/conversation-bubble'
import { OperatorReply } from './operator-reply'
import {
        ConversationTimelineActivity,
        MessageActivityReceipts,
} from './conversation-activity'
import { inboundSourceLabel, readInboundSource } from '@/lib/conversations/source'

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
        const reduceMotion = useReducedMotion()
        const [pendingMessages, setPendingMessages] = useState<ThreadMessage[]>([])
        const [polledMessages, setPolledMessages] = useState<ThreadMessage[]>([])
        const [hasNewMessages, setHasNewMessages] = useState(false)
        const scrollRef = useRef<HTMLDivElement>(null)
        const lastMessageIdRef = useRef<string | null>(
                initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].id : null,
        )
        const initialMessageIdsRef = useRef(new Set(initialMessages.map((message) => message.id)))
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
                        behavior: smooth && !reduceMotion ? 'smooth' : 'auto',
                })
        }, [reduceMotion])

        // ── Polling for new messages ───────────────────────────────────────────
        // Polls GET /api/conversations/[id]/messages?since=<lastId> every 5s.
        // Catches new visitor messages on ANY channel (widget, chat-link,
        // WhatsApp, Instagram, Telegram, etc.) + messages from other operator
        // tabs. Deduped by id against the merged list so nothing double-renders.
        useEffect(() => {
                let cancelled = false
                let timer: ReturnType<typeof setTimeout> | undefined
                let controller: AbortController | undefined

                const schedule = () => {
                        if (!cancelled) timer = setTimeout(poll, 5000)
                }

                const poll = async () => {
                        if (cancelled) return
                        if (document.hidden) {
                                schedule()
                                return
                        }

                        const sinceId = lastMessageIdRef.current
                        const url = sinceId
                                ? `/api/conversations/${conversationId}/messages?since=${encodeURIComponent(sinceId)}`
                                : `/api/conversations/${conversationId}/messages`
                        controller = new AbortController()

                        try {
                                const res = await fetch(url, {
                                        cache: 'no-store',
                                        headers: { Accept: 'application/json' },
                                        signal: controller.signal,
                                })
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
                                if (!isAtBottomRef.current) {
                                        setHasNewMessages(true)
                                }
                        } catch (error) {
                                if (!(error instanceof DOMException && error.name === 'AbortError')) {
                                        /* network error — skip this cycle */
                                }
                        } finally {
                                schedule()
                        }
                }

                schedule()
                return () => {
                        cancelled = true
                        if (timer) clearTimeout(timer)
                        controller?.abort()
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
        // Polled messages scroll only after React has committed the new bubble,
        // so the final scroll target includes its full animated height.
        useEffect(() => {
                if (polledMessages.length > 0 && isAtBottomRef.current) scrollToBottom()
        }, [polledMessages.length, scrollToBottom])

        function handleSent(message: ThreadMessage) {
                setPendingMessages((prev) => [...prev, message])
        }

        const arrivalInitial = reduceMotion
                ? { opacity: 0.55 }
                : { opacity: 0, transform: 'translate3d(0,9px,0) scale(0.985)' }
        const arrivalTransition = reduceMotion
                ? { opacity: { duration: 0.16 } }
                : {
                        transform: { type: 'spring' as const, duration: 0.4, bounce: 0 },
                        opacity: { duration: 0.2, ease: [0.23, 1, 0.32, 1] as const },
                        layout: { type: 'spring' as const, duration: 0.36, bounce: 0 },
                }

        return (
                <div className="spatial-surface flex min-h-[36rem] min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem]">
                        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-4 py-3"><div><p className="text-xs font-bold text-black/75">{locale === 'fa' ? 'گفتگوی زنده' : 'Live conversation'}</p><p className="mt-0.5 text-[11px] text-black/35">{locale === 'fa' ? 'پیام‌های تازه خودکار نمایش داده می‌شوند' : 'New messages appear automatically'}</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{locale === 'fa' ? 'آنلاین' : 'Online'}</span></div>
                        <div ref={scrollRef} onScroll={handleScroll} className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                                <AnimatePresence initial={false}>
                                {messages.map((m) => {
                                        const isUser = m.role === 'USER'
                                        const isLiveMessage = !initialMessageIdsRef.current.has(m.id)
                                        if (m.role === 'SYSTEM') {
                                                return (
                                                        <motion.div
                                                                key={m.id}
                                                                layout={reduceMotion ? false : 'position'}
                                                                initial={isLiveMessage ? arrivalInitial : false}
                                                                animate={{ opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }}
                                                                transition={arrivalTransition}
                                                        >
                                                        <ConversationTimelineActivity
                                                                metadata={m.metadata}
                                                                locale={locale}
                                                                dateLabel={formatDateTime(new Date(m.createdAt), locale)}
                                                        />
                                                        </motion.div>
                                                )
                                        }
                                        const isOperator =
                                                !!m.metadata &&
                                                typeof m.metadata === 'object' &&
                                                (m.metadata as Record<string, unknown>).operator === true
                                        const sourceLabel = isUser
                                                ? inboundSourceLabel(readInboundSource(m.metadata), locale)
                                                : null
                                        return (
                                                <motion.div
                                                        key={m.id}
                                                        layout={reduceMotion ? false : 'position'}
                                                        initial={isLiveMessage ? arrivalInitial : false}
                                                        animate={{ opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }}
                                                        transition={arrivalTransition}
                                                        className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
                                                >
                                                        <div
                                                                className={cn(
                                                                        'flex max-w-[82%] flex-col',
                                                                        isUser ? 'items-end' : 'items-start',
                                                                )}
                                                        >
                                                                <div className="relative max-w-full">
                                                                {isLiveMessage && (
                                                                        <motion.span
                                                                                aria-hidden="true"
                                                                                className="pointer-events-none absolute -inset-1 z-0 rounded-[1.35rem] bg-gradient-to-br from-violet-500/24 via-fuchsia-400/12 to-emerald-400/18 blur-[2px]"
                                                                                initial={{ opacity: 0.78, transform: 'scale(0.96)' }}
                                                                                animate={{ opacity: 0, transform: 'scale(1.06)' }}
                                                                                transition={{ duration: reduceMotion ? 0.45 : 1.15, ease: [0.23, 1, 0.32, 1] }}
                                                                        />
                                                                )}
                                                                <ConversationBubble
                                                                        side={isUser ? 'end' : 'start'}
                                                                        tone={isUser ? 'muted' : 'inverse'}
                                                                        className="relative z-[1] max-w-full py-2"
                                                                >
                                                                        {isOperator && (
                                                                                <span className="mb-0.5 block text-[11px] font-medium opacity-60">
                                                                                        {t('operatorBadge')}
                                                                                </span>
                                                                        )}
                                                                        {sourceLabel && (
                                                                                <span className="mb-1 block text-[10px] font-semibold text-[var(--text-secondary)] opacity-75">
                                                                                        {sourceLabel}
                                                                                </span>
                                                                        )}
                                                                        <ConversationText
                                                                                text={stripProductTokens(m.content)}
                                                                                markdown={!isUser}
                                                                        />
                                                                        <span
                                                                                className={cn(
                                                                                        'mt-1 block text-[11px]',
                                                                                        isUser
                                                                                                ? 'text-[var(--text-muted)]'
                                                                                                : 'text-[var(--bg-base)] opacity-40',
                                                                                )}
                                                                        >
                                                                                {formatDateTime(new Date(m.createdAt), locale)}
                                                                        </span>
                                                                </ConversationBubble>
                                                                </div>
                                                                {!isUser && (
                                                                        <MessageActivityReceipts
                                                                                metadata={m.metadata}
                                                                                locale={locale}
                                                                        />
                                                                )}
                                                        </div>
                                                </motion.div>
                                        )
                                })}
                                </AnimatePresence>
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
                                                className="sticky bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[var(--bg-base)] px-4 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-lg ring-1 ring-[var(--border-default)] transition-[transform,box-shadow] duration-200 hover:scale-[1.03] motion-reduce:transform-none"
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
