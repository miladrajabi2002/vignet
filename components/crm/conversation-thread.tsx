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

import { Fragment, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
import { ConversationBubble, ConversationText } from '@/components/chat/conversation-bubble'
import { parseProductShowcaseContent } from '@/components/products/product-showcase'
import { ProductShowcaseRail } from '@/components/products/product-showcase-rail'
import { CheckoutCardView } from '@/components/commerce/checkout-card-view'
import { OperatorReply } from './operator-reply'
import { Headphones, Sparkles } from 'lucide-react'
import {
        ConversationTimelineActivity,
        HandoffMarker,
        MessageActivityReceipts,
} from './conversation-activity'
import { inboundSourceLabel, readInboundSource } from '@/lib/conversations/source'
import { presentConversationMessages } from '@/lib/conversations/reactions'
import { InboundMedia } from './inbound-media'
import { conversationSessionBoundaries } from '@/lib/conversations/session'
import { ConversationSessionDivider } from './conversation-session-divider'

export type ThreadMessage = {
        id: string
        role: 'USER' | 'ASSISTANT' | 'SYSTEM'
        content: string
        createdAt: string
        contentType: string
        metadata: Record<string, unknown> | null
}

type InboundMediaKind = 'photo' | 'video' | 'voice' | 'sticker' | 'file' | 'audio'

/** Verified channel media reference persisted by the inbound pipeline. */
function readInboundMediaKind(metadata: Record<string, unknown> | null): InboundMediaKind | null {
        const inbound = metadata && typeof metadata === 'object'
                ? (metadata as Record<string, unknown>).vigentoInbound
                : null
        if (!inbound || typeof inbound !== 'object') return null
        const kind = (inbound as Record<string, unknown>).mediaKind
        const hasReference = Boolean(
                (inbound as Record<string, unknown>).mediaUrl
                || (inbound as Record<string, unknown>).mediaFileId,
        )
        if (!hasReference) return null
        return typeof kind === 'string' && ['photo', 'video', 'voice', 'sticker', 'file', 'audio'].includes(kind)
                ? (kind as InboundMediaKind)
                : null
}

/** Media-only turns persist a label instead of text; the media element replaces it. */
function isMediaPlaceholderText(content: string): boolean {
        const t = content.trim()
        return [
                '[عکس]', '[ویدیو]', '[استیکر]', '[فایل]', '[پیام صوتی]', '[فایل صوتی]', '[پیام رسانه‌ای]',
        ].includes(t)
}

export function ConversationThread({
        initialMessages,
        conversationId,
        locale,
        embedded = false,
        handoff = null,
}: {
        initialMessages: ThreadMessage[]
        conversationId: string
        locale: 'fa' | 'en'
        /** Inside the inbox pane the surrounding card and header already exist. */
        embedded?: boolean
        /**
         * When the agent handed the conversation over. Used only for threads
         * whose handoff predates the timeline row, so the marker still shows.
         */
        handoff?: { at: string; reason: string | null } | null
}) {
        const t = useTranslations('conversations')
        const router = useRouter()
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
                                // A fresh inbound message means the customer is still
                                // talking: silently re-render the server component so the
                                // header status (a resolved thread just reopened, handoff
                                // flags, counters) stops showing stale «closed» state.
                                if (data.messages.some((m: ThreadMessage) => m.role === 'USER')) {
                                        router.refresh()
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
        }, [conversationId, scrollToBottom, router])

        // Merge server + polled + pending messages (all deduped by ID).
        // Order: server messages first, then polled (new from server), then
        // pending (optimistic operator messages not yet confirmed by server).
        const seenIds = new Set<string>()
        const allMessages: ThreadMessage[] = []
        for (const m of [...initialMessages, ...polledMessages, ...pendingMessages]) {
                if (seenIds.has(m.id)) continue
                seenIds.add(m.id)
                allMessages.push(m)
        }
        allMessages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id))
        if (allMessages.length > 0) {
                lastMessageIdRef.current = allMessages[allMessages.length - 1].id
        }
        const { messages: visibleMessages, reactionsByMessageId } = presentConversationMessages(allMessages)
        const sessionBoundaries = conversationSessionBoundaries(allMessages)
        const visibleIds = new Set(visibleMessages.map((message) => message.id))
        // A legacy reaction may start a session even though it is rendered as
        // a badge on an older bubble. Keep its boundary at its real timestamp.
        const messages = allMessages.filter((message) => visibleIds.has(message.id) || sessionBoundaries.has(message.id))
        const hasHandoffRow = allMessages.some((message) => {
                const activity = message.metadata && typeof message.metadata === 'object'
                        ? (message.metadata as Record<string, unknown>).vigentoActivity
                        : null
                return message.role === 'SYSTEM' && Boolean(activity) && (activity as Record<string, unknown>).kind === 'handoff_ready'
        })
        // The marker sits before the first message that came after the handoff.
        const handoffTime = handoff && !hasHandoffRow ? new Date(handoff.at).getTime() : null
        const handoffBeforeId = handoffTime === null
                ? null
                : messages.find((message) => visibleIds.has(message.id) && new Date(message.createdAt).getTime() > handoffTime)?.id ?? 'END'
        const handoffMarker = handoff && handoffTime !== null ? (
                <div dir={locale === 'fa' ? 'rtl' : 'ltr'}>
                        <HandoffMarker locale={locale} reason={handoff.reason} dateLabel={formatDateTime(new Date(handoff.at), locale)} />
                </div>
        ) : null

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
                <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', embedded ? 'min-h-0' : 'spatial-surface min-h-[36rem] rounded-sheet')}>
                        {!embedded && (
                                <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-4 py-3"><div><p className="text-xs font-bold text-black/75">{locale === 'fa' ? 'گفتگوی زنده' : 'Live conversation'}</p><p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{locale === 'fa' ? 'پیام‌های تازه خودکار نمایش داده می‌شوند' : 'New messages appear automatically'}</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-bold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{locale === 'fa' ? 'آنلاین' : 'Online'}</span></div>
                        )}
                        {/* dir="ltr" pins the bubble sides: the CUSTOMER is always on the
                            visual RIGHT and the agent/operator on the LEFT, identically in
                            every locale — the same pin the chat-link page and the web widget
                            use. Bubble text keeps dir="auto" so Persian still reads RTL. */}
                        <div ref={scrollRef} onScroll={handleScroll} dir="ltr" className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                                <AnimatePresence initial={false}>
                                {messages.map((m) => {
                                        if (!visibleIds.has(m.id)) return <ConversationSessionDivider key={m.id} locale={locale} />
                                        const isUser = m.role === 'USER'
                                        const isLiveMessage = !initialMessageIdsRef.current.has(m.id)
                                        if (m.role === 'SYSTEM') {
                                                return (
                                                        <Fragment key={m.id}>
                                                        {handoffBeforeId === m.id && handoffMarker}
                                                        <motion.div
                                                                id={`message-${m.id}`}
                                                                layout={reduceMotion ? false : 'position'}
                                                                initial={isLiveMessage ? arrivalInitial : false}
                                                                animate={{ opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }}
                                                                transition={arrivalTransition}
                                                                // Timeline rows are centered, so they take the page direction
                                                                // back from the LTR-pinned list to align their own copy.
                                                                dir={locale === 'fa' ? 'rtl' : 'ltr'}
                                                        >
                                                        <ConversationTimelineActivity
                                                                metadata={m.metadata}
                                                                locale={locale}
                                                                dateLabel={formatDateTime(new Date(m.createdAt), locale)}
                                                        />
                                                        </motion.div>
                                                        </Fragment>
                                                )
                                        }
                                        const isOperator =
                                                !!m.metadata &&
                                                typeof m.metadata === 'object' &&
                                                (m.metadata as Record<string, unknown>).operator === true
                                        const sourceLabel = isUser
                                                ? inboundSourceLabel(readInboundSource(m.metadata), locale)
                                                : null
                                        const showcase = isUser
                                                ? { text: m.content, products: [], checkout: null }
                                                : parseProductShowcaseContent(m.content)
                                        const hasShowcase = showcase.products.length > 0
                                        const reactions = reactionsByMessageId.get(m.id) ?? []
                                        // Verified inbound channel media (photo/video/voice) is
                                        // rendered through the view-time proxy; the placeholder
                                        // label stands in only when the channel reference is
                                        // missing or has expired.
                                        const inboundMediaKind = isUser ? readInboundMediaKind(m.metadata) : null
                                        const mediaOnlyLabel = Boolean(inboundMediaKind) && isMediaPlaceholderText(m.content)
                                        return (
                                                <Fragment key={m.id}>
                                                {sessionBoundaries.has(m.id) && <ConversationSessionDivider locale={locale} />}
                                                {handoffBeforeId === m.id && handoffMarker}
                                                <motion.div
                                                        key={m.id}
                                                        id={`message-${m.id}`}
                                                        layout={reduceMotion ? false : 'position'}
                                                        initial={isLiveMessage ? arrivalInitial : false}
                                                        animate={{ opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }}
                                                        transition={arrivalTransition}
                                                        className={cn('flex scroll-mt-28', isUser ? 'justify-end' : 'justify-start')}
                                                >
                                                        <div
                                                                className={cn(
                                                                        'flex max-w-[82%] flex-col',
                                                                        isUser ? 'items-end' : 'items-start',
                                                                        hasShowcase && !isUser && 'w-full max-w-full',
                                                                )}
                                                        >
                                                                {inboundMediaKind && (
                                                                        <div className={cn('mb-1.5 flex max-w-full flex-col', isUser ? 'items-end' : 'items-start')}>
                                                                                <InboundMedia
                                                                                        conversationId={conversationId}
                                                                                        messageId={m.id}
                                                                                        kind={inboundMediaKind}
                                                                                        locale={locale}
                                                                                />
                                                                                {mediaOnlyLabel && (
                                                                                        <span className="mt-0.5 px-1 text-[12px] text-[var(--text-muted)]">
                                                                                                {formatDateTime(new Date(m.createdAt), locale)}
                                                                                        </span>
                                                                                )}
                                                                        </div>
                                                                )}
                                                                {showcase.text && !mediaOnlyLabel && (
                                                                <div className="relative max-w-full">
                                                                {isLiveMessage && (
                                                                        <motion.span
                                                                                aria-hidden="true"
                                                                                className="pointer-events-none absolute -inset-1 z-0 rounded-card bg-gradient-to-br from-violet-500/24 via-fuchsia-400/12 to-emerald-400/18 blur-[2px]"
                                                                                initial={{ opacity: 0.78, transform: 'scale(0.96)' }}
                                                                                animate={{ opacity: 0, transform: 'scale(1.06)' }}
                                                                                transition={{ duration: reduceMotion ? 0.45 : 1.15, ease: [0.23, 1, 0.32, 1] }}
                                                                        />
                                                                )}
                                                                {/* Three voices, three looks: the customer is grey, the agent
                                                                    is white with the violet AI edge, a person is ink. */}
                                                                <ConversationBubble
                                                                        side={isUser ? 'end' : 'start'}
                                                                        tone={isUser ? 'muted' : isOperator ? 'inverse' : 'accent'}
                                                                        className={cn('relative z-[1] max-w-full py-2', !isUser && !isOperator && 'border border-[var(--signal-border)] bg-white text-[var(--text-primary)]')}
                                                                >
                                                                        {!isUser && (
                                                                                <span dir="auto" className={cn('mb-0.5 flex items-center gap-1 text-[12px] font-medium', isOperator ? 'opacity-60' : 'text-[var(--signal-strong)]')}>
                                                                                        {isOperator ? <Headphones className="h-3 w-3" aria-hidden="true" /> : <Sparkles className="h-3 w-3" aria-hidden="true" />}
                                                                                        {isOperator ? t('operatorBadge') : (locale === 'fa' ? 'ایجنت' : 'Agent')}
                                                                                </span>
                                                                        )}
                                                                        {sourceLabel && (
                                                                                <span dir="auto" className="mb-1 block text-[12px] font-semibold text-[var(--text-secondary)] opacity-75">
                                                                                        {sourceLabel}
                                                                                </span>
                                                                        )}
                                                                        <ConversationText
                                                                                text={showcase.text}
                                                                                markdown={!isUser}
                                                                        />
                                                                        {/* text-end resolves against the LTR-pinned list, so the
                                                                            timestamp sits in the bubble's trailing corner in both
                                                                            locales instead of following the page direction. */}
                                                                        <span
                                                                                className={cn(
                                                                                        'mt-1 block text-end text-[12px]',
                                                                                        isOperator
                                                                                                ? 'text-[var(--bg-base)] opacity-40'
                                                                                                : 'text-[var(--text-muted)]',
                                                                                )}
                                                                        >
                                                                                {formatDateTime(new Date(m.createdAt), locale)}
                                                                        </span>
                                                                </ConversationBubble>
                                                                </div>
                                                                )}
                                                                {!isUser && showcase.checkout && (
                                                                        <div className="mt-2">
                                                                                <CheckoutCardView card={showcase.checkout} accent="var(--text-primary, #111111)" onAccent="var(--bg-base, #ffffff)" />
                                                                        </div>
                                                                )}
                                                                {!isUser && hasShowcase && (
                                                                        <ProductShowcaseRail
                                                                                products={showcase.products}
                                                                                locale={locale}
                                                                                compact
                                                                                // No w-full: the rail shrink-wraps to its cards so a
                                                                                // one/two-card vitrine hugs the agent side (left),
                                                                                // exactly like the bubble above it.
                                                                                className="mt-2 max-w-[46rem]"
                                                                        />
                                                                )}
                                                                {!isUser && hasShowcase && !showcase.text && (
                                                                        <span className="mt-0.5 px-1 text-[12px] text-[var(--text-muted)]">
                                                                                {formatDateTime(new Date(m.createdAt), locale)}
                                                                        </span>
                                                                )}
                                                                {reactions.length > 0 && (
                                                                        <div
                                                                                className={cn(
                                                                                        '-mt-1 flex max-w-full px-2',
                                                                                        isUser ? 'justify-end' : 'justify-start',
                                                                                )}
                                                                                aria-label={locale === 'fa' ? 'واکنش مشتری به این پیام' : 'Customer reaction to this message'}
                                                                        >
                                                                                <span dir="ltr" className="inline-flex min-h-6 items-center gap-0.5 rounded-full border border-black/[0.09] bg-white px-2 py-0.5 shadow-sm">
                                                                                        {reactions.slice(-3).map((reaction) => (
                                                                                                <span key={reaction.id} className="emoji-glyph text-[15px] leading-none">
                                                                                                        {reaction.emoji}
                                                                                                </span>
                                                                                        ))}
                                                                                </span>
                                                                        </div>
                                                                )}
                                                                {!isUser && (
                                                                        <MessageActivityReceipts
                                                                                metadata={m.metadata}
                                                                                locale={locale}
                                                                        />
                                                                )}
                                                        </div>
                                                </motion.div>
                                                </Fragment>
                                        )
                                })}
                                </AnimatePresence>
                                {handoffBeforeId === 'END' && handoffMarker}
                                {messages.length === 0 && (
                                        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                                                {t('noMessages')}
                                        </p>
                                )}
                                {hasNewMessages && messages.length > 0 && (
                                        <button
                                                dir="auto"
                                                onClick={() => {
                                                        setHasNewMessages(false)
                                                        scrollToBottom()
                                                }}
                                                className="sticky bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[var(--bg-base)] px-4 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-lg ring-1 ring-[var(--border-default)] transition-[transform,box-shadow] duration-200 hover:scale-[1.03] motion-reduce:transform-none"
                                        >
                                                {locale === 'fa' ? 'پیام‌های جدید ↓' : 'New messages ↓'}
                                        </button>
                                )}
                        </div>

                        <div className="shrink-0 border-t border-[var(--border-subtle)] p-3">
                                <OperatorReply
                                        conversationId={conversationId}
                                        onSent={handleSent}
                                />
                        </div>
                </div>
        )
}
