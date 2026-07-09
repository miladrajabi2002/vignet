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
 * `pendingMessages`, deduplicated by ID. When `router.refresh()` completes and
 * the server list includes the new message, it's automatically filtered out
 * of the pending list.
 */

import { useState, useEffect, useRef } from 'react'
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
	parentId: string | null
	parent: { content: string } | null
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
	const scrollRef = useRef<HTMLDivElement>(null)

	// Merge server messages with pending optimistic messages (deduped by ID).
	// When the server refresh includes a pending message, it's filtered out.
	const messages = [
		...initialMessages,
		...pendingMessages.filter(
			(pm) => !initialMessages.find((im) => im.id === pm.id),
		),
	]

	// Clean up pending messages that are now in the server list (after refresh).
	useEffect(() => {
		setPendingMessages((prev) =>
			prev.filter((pm) => !initialMessages.find((im) => im.id === pm.id)),
		)
	}, [initialMessages])

	// Auto-scroll to bottom when a new message arrives.
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [messages.length])

	function handleSent(message: ThreadMessage) {
		setPendingMessages((prev) => [...prev, message])
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
			<div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
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
								{m.parentId && m.parent?.content && (
									<div className="mb-1.5 border-s-2 border-current opacity-60 ps-2 text-[11px] leading-snug">
										<p className="line-clamp-2 whitespace-pre-wrap break-words">
											{stripProductTokens(m.parent.content)}
										</p>
									</div>
								)}
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
