'use client'

/**
 * What an Instagram scenario sent, shown the way the customer saw it.
 *
 * One scenario reply is several things at once — a Direct text, a button
 * message, a photo, a product rail and a public reply under the comment. The
 * receipt used to be one bubble with everything joined by blank lines, so the
 * operator could not tell the Direct from the comment reply, saw «[تصویر]»
 * for media and saw no buttons at all. Each part gets its own bubble here,
 * under a line naming the scenario that produced it.
 */

import type { ReactNode } from 'react'
import { ExternalLink, MessageSquare, MousePointerClick, UserPlus, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConversationBubble, ConversationText } from '@/components/chat/conversation-bubble'
import type { OutboundPart, OutboundReceipt } from '@/lib/conversations/outbound-receipt'
import { OutboundMediaView } from './outbound-media'

type Locale = 'fa' | 'en'

const SCENARIO_TYPE: Record<Locale, Record<NonNullable<OutboundReceipt['scenario']>['type'], string>> = {
	fa: { COMMENT: 'سناریوی کامنت', DIRECT_MESSAGE: 'سناریوی دایرکت', STORY: 'سناریوی استوری' },
	en: { COMMENT: 'Comment scenario', DIRECT_MESSAGE: 'Direct scenario', STORY: 'Story scenario' },
}

const MEDIA_NOTE: Record<Locale, Record<'photo' | 'video' | 'audio', string>> = {
	fa: { photo: 'تصویر ارسال شد', video: 'ویدیو ارسال شد', audio: 'پیام صوتی ارسال شد' },
	en: { photo: 'Image sent', video: 'Video sent', audio: 'Voice message sent' },
}

const BUBBLE = 'max-w-full border border-[var(--signal-border)] bg-white py-2 text-[var(--text-primary)]'

function PartLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<span dir="auto" className="mb-1 flex items-start gap-1 text-[12px] font-semibold leading-5 text-[var(--text-secondary)]">
			<span className="flex h-5 shrink-0 items-center">{icon}</span>
			<span className="min-w-0">{children}</span>
		</span>
	)
}

function ButtonsPart({ part, locale }: { part: Extract<OutboundPart, { kind: 'buttons' }>; locale: Locale }) {
	// Quick-reply chips float above the keyboard, outside the bubble.
	if (part.style === 'chips') {
		return (
			<div className="flex max-w-full flex-col items-start gap-1">
				{part.text && (
					<ConversationBubble side="start" tone="accent" className={BUBBLE}>
						<ConversationText text={part.text} />
					</ConversationBubble>
				)}
				<ul
					className="m-0 flex max-w-full list-none flex-wrap gap-1 p-0"
					aria-label={locale === 'fa' ? 'دکمه‌های پاسخ سریع' : 'Quick reply buttons'}
				>
					{part.buttons.map((button, index) => (
						<li
							key={`${button.title}-${index}`}
							dir="auto"
							className="rounded-full border border-[var(--signal-border)] bg-white px-2.5 py-0.5 text-[12px] font-medium text-[var(--text-secondary)]"
						>
							{button.title}
						</li>
					))}
				</ul>
			</div>
		)
	}
	const roleLabel =
		part.role === 'follow_gate'
			? (locale === 'fa' ? 'درخواست فالو' : 'Follow request')
			: part.role === 'opener'
				? (locale === 'fa' ? 'پیام شروع · ادامه با زدن دکمه ارسال می‌شود' : 'Opening message · the rest is sent on tap')
				: null
	return (
		<ConversationBubble side="start" tone="accent" className={cn(BUBBLE, 'min-w-[min(13rem,100%)] overflow-hidden px-0 pb-0')}>
			<div className="px-3.5">
				{roleLabel && (
					<PartLabel
						icon={part.role === 'follow_gate'
							? <UserPlus className="h-3 w-3" aria-hidden="true" />
							: <MousePointerClick className="h-3 w-3" aria-hidden="true" />}
					>
						{roleLabel}
					</PartLabel>
				)}
				{part.text && <ConversationText text={part.text} />}
			</div>
			{/* The buttons as Instagram draws them: full-width rows under the text. */}
			<ul className={cn('m-0 list-none p-0', part.text || roleLabel ? 'mt-2' : '')}>
				{part.buttons.map((button, index) => (
					<li
						key={`${button.title}-${index}`}
						dir="auto"
						className="flex min-h-10 items-center justify-center gap-1.5 break-words border-t border-black/[0.07] px-3.5 py-2 text-center text-[13px] font-semibold text-[var(--text-primary)]"
					>
						{button.url ? (
							<a
								href={button.url}
								target="_blank"
								rel="noopener noreferrer nofollow"
								className="inline-flex min-h-6 items-center gap-1.5 underline-offset-2 hover:underline"
							>
								{button.title}
								<ExternalLink className="h-3 w-3 text-[var(--text-muted)]" aria-hidden="true" />
							</a>
						) : (
							button.title
						)}
					</li>
				))}
			</ul>
		</ConversationBubble>
	)
}

export function ScenarioReceiptView({
	receipt,
	locale,
	dateLabel,
	productRail,
}: {
	receipt: OutboundReceipt
	locale: Locale
	dateLabel: string
	/** The product rail of this message; drawn where the cards were sent. */
	productRail?: ReactNode
}) {
	let railPlaced = false
	return (
		<div className="flex max-w-full flex-col items-start gap-1.5">
			{receipt.scenario && (
				<span
					dir="auto"
					className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--signal-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--signal-strong)]"
				>
					<Zap className="h-3 w-3 shrink-0" aria-hidden="true" />
					<span className="min-w-0 truncate">
						{SCENARIO_TYPE[locale][receipt.scenario.type]}
						{' · '}
						{receipt.scenario.name}
					</span>
				</span>
			)}
			{receipt.parts.map((part, index) => {
				const key = `${part.kind}-${index}`
				if (part.kind === 'text') {
					if (part.via === 'comment') {
						return (
							<ConversationBubble
								key={key}
								side="start"
								tone="muted"
								className="max-w-full border border-dashed border-[var(--border-default)] py-2"
							>
								<PartLabel icon={<MessageSquare className="h-3 w-3" aria-hidden="true" />}>
									{locale === 'fa' ? 'پاسخ عمومی زیر کامنت' : 'Public reply under the comment'}
								</PartLabel>
								<ConversationText text={part.text} />
							</ConversationBubble>
						)
					}
					return (
						<ConversationBubble key={key} side="start" tone="accent" className={BUBBLE}>
							<ConversationText text={part.text} />
						</ConversationBubble>
					)
				}
				if (part.kind === 'buttons') return <ButtonsPart key={key} part={part} locale={locale} />
				if (part.kind === 'media') {
					return (
						<div key={key} className="flex max-w-full flex-col items-start gap-1">
							{part.mediaUrl ? (
								<OutboundMediaView media={{ kind: part.media, mediaUrl: part.mediaUrl }} locale={locale} />
							) : (
								<span
									dir="auto"
									className="inline-flex items-center rounded-2xl border border-black/[0.08] bg-black/[0.04] px-3 py-2 text-xs text-[var(--text-secondary)]"
								>
									{MEDIA_NOTE[locale][part.media]}
								</span>
							)}
							{part.caption && (
								<ConversationBubble side="start" tone="accent" className={BUBBLE}>
									<ConversationText text={part.caption} />
								</ConversationBubble>
							)}
						</div>
					)
				}
				if (part.kind === 'products' && productRail && !railPlaced) {
					railPlaced = true
					return <div key={key} className="w-full max-w-full">{productRail}</div>
				}
				return null
			})}
			{productRail && !railPlaced && <div className="w-full max-w-full">{productRail}</div>}
			<span className="px-1 text-[12px] text-[var(--text-muted)]">{dateLabel}</span>
		</div>
	)
}
