import type { CSSProperties, ReactNode } from 'react'
import { Markdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'

export type ConversationBubbleTone = 'accent' | 'inverse' | 'surface' | 'muted' | 'light'

const TONES: Record<ConversationBubbleTone, string> = {
	accent: '',
	inverse: 'bg-[var(--white)] text-[var(--bg-base)]',
	surface: 'border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-primary)]',
	muted: 'bg-[var(--bg-muted)] text-[var(--text-primary)]',
	light: 'border border-black/[0.07] bg-white text-neutral-800 shadow-sm',
}

/** Shared bubble shell for public chat, agent testing and the operator inbox. */
export function ConversationBubble({
	side,
	tone,
	children,
	className,
	style,
}: {
	side: 'start' | 'end'
	tone: ConversationBubbleTone
	children: ReactNode
	className?: string
	style?: CSSProperties
}) {
	return (
		<div
			className={cn(
				'break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6',
				side === 'start' ? 'rounded-es-md' : 'rounded-ee-md',
				TONES[tone],
				className,
			)}
			style={style}
		>
			{children}
		</div>
	)
}

/** Keep plain customer text and Markdown agent text consistent everywhere. */
export function ConversationText({
	text,
	markdown = false,
	className,
}: {
	text: string
	markdown?: boolean
	className?: string
}) {
	if (!markdown) {
		return <span dir="auto" className={cn('whitespace-pre-wrap', className)}>{text}</span>
	}

	return (
		<div dir="auto" className={cn('[&_p]:whitespace-pre-wrap [&_p]:break-words [&_p]:leading-6', className)}>
			<Markdown>{text}</Markdown>
		</div>
	)
}
