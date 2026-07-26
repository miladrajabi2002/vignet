'use client'

import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
	type CSSProperties,
	type ReactNode,
} from 'react'
import { ArrowUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * THE shared message composer. Every surface with a message input uses this:
 * the chat-link page, the operator inbox, the agent test playground, and both
 * Vigento consoles. The web widget (vanilla JS, zero deps) mirrors the same
 * geometry in its own CSS — see COMPOSER_GEOMETRY below, which is the single
 * written contract both implementations follow.
 *
 * Design: a rounded pill wrapper containing an auto-growing textarea and one
 * circular send button carrying an up-arrow. Deliberately NOT included from
 * the reference mockup: the "+" attachment button and the model selector.
 *
 * Behaviour that is identical everywhere (it used to differ per surface):
 *   - Enter sends, Shift+Enter inserts a newline, IME composition never sends
 *   - the textarea auto-grows to a shared max height, then scrolls
 *   - the send button is disabled while empty or busy and shows a spinner
 *   - the row is pinned dir="ltr" so the send button is always on the visual
 *     RIGHT, while the textarea itself keeps the caller's text direction
 *   - 16px text on the textarea, which is what stops iOS Safari from zooming
 */

/** The geometry contract shared with the vanilla widget CSS in public/widget/loader.js. */
export const COMPOSER_GEOMETRY = {
	/** Send button diameter, px. */
	sendButtonSize: 40,
	/** Send icon stroke box, px. */
	sendIconSize: 18,
	/** Textarea min height, px (matches the button so the pill never jumps). */
	textareaMinHeight: 40,
	/** Textarea max height before it scrolls, px. */
	textareaMaxHeight: 132,
	/** Pill corner radius. */
	pillRadius: '1.5rem',
} as const

export interface ChatComposerHandle {
	focus: () => void
	/** Reset the measured height after the caller clears the value. */
	resetHeight: () => void
}

export interface ChatComposerProps {
	value: string
	onChange: (value: string) => void
	/** Called on Enter or send-button click. Never called while empty or busy. */
	onSend: () => void
	placeholder?: string
	/** Busy = a reply is in flight: spinner on the button, sending blocked. */
	busy?: boolean
	/** Hard-disable the whole composer (e.g. a lead form is still pending). */
	disabled?: boolean
	maxLength?: number
	/** Text direction of the typed content. The control row stays LTR. */
	dir?: 'rtl' | 'ltr' | 'auto'
	/** Accessible label for the send button. */
	sendLabel: string
	/**
	 * Accessible name for the textarea. Pass this when the placeholder alone
	 * would not identify the field (a placeholder is not a reliable label).
	 */
	inputLabel?: string
	/** Optional controls placed before the send button (e.g. a mic button). */
	leading?: ReactNode
	/** Extra content rendered under the pill (hints, counters, errors). */
	footer?: ReactNode
	className?: string
	textareaClassName?: string
	autoFocus?: boolean
	name?: string
}

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
	function ChatComposer(
		{
			value,
			onChange,
			onSend,
			placeholder,
			busy = false,
			disabled = false,
			maxLength,
			dir = 'auto',
			sendLabel,
			inputLabel,
			leading,
			footer,
			className,
			textareaClassName,
			autoFocus,
			name,
		},
		ref,
	) {
		const textareaRef = useRef<HTMLTextAreaElement | null>(null)
		// Tracks IME composition (Persian/Chinese input methods): pressing Enter
		// to accept a candidate must not send the message.
		const composingRef = useRef(false)

		const resetHeight = useCallback(() => {
			const el = textareaRef.current
			if (!el) return
			el.style.height = 'auto'
			el.style.height = `${Math.min(el.scrollHeight, COMPOSER_GEOMETRY.textareaMaxHeight)}px`
		}, [])

		useImperativeHandle(ref, () => ({
			focus: () => textareaRef.current?.focus(),
			resetHeight,
		}))

		// Re-measure whenever the value changes, including when the caller clears
		// it after a send.
		useEffect(resetHeight, [value, resetHeight])

		const canSend = !busy && !disabled && value.trim().length > 0

		const submit = () => {
			if (!canSend) return
			onSend()
		}

		return (
			<div className={cn('w-full', className)}>
				{/* dir=ltr pins the send button to the visual right in every locale. */}
				<div
					dir="ltr"
					className={cn(
						'flex items-end gap-2 border bg-white px-2 py-1.5 transition-colors',
						'border-black/[0.09] shadow-[0_1px_2px_rgba(17,17,17,0.04)]',
						'focus-within:border-black/25 focus-within:shadow-[0_0_0_3px_rgba(17,17,17,0.06)]',
						disabled && 'opacity-60',
					)}
					style={{ borderRadius: COMPOSER_GEOMETRY.pillRadius }}
				>
					<textarea
						ref={textareaRef}
						name={name}
						dir={dir}
						rows={1}
						value={value}
						disabled={disabled}
						maxLength={maxLength}
						autoFocus={autoFocus}
						placeholder={placeholder}
						aria-label={inputLabel}
						enterKeyHint="send"
						onChange={(e) => onChange(e.target.value)}
						onCompositionStart={() => {
							composingRef.current = true
						}}
						onCompositionEnd={() => {
							composingRef.current = false
						}}
						onKeyDown={(e) => {
							if (e.key !== 'Enter' || e.shiftKey) return
							// `isComposing` covers browsers that fire keydown during IME.
							if (composingRef.current || e.nativeEvent.isComposing) return
							e.preventDefault()
							submit()
						}}
						className={cn(
							// 16px is intentional: anything smaller makes iOS Safari zoom
							// the page when the field takes focus.
							'flex-1 resize-none bg-transparent px-2 py-2 text-[16px] leading-6',
							'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70',
							'outline-none [scrollbar-width:thin]',
							textareaClassName,
						)}
						style={{
							minHeight: COMPOSER_GEOMETRY.textareaMinHeight,
							maxHeight: COMPOSER_GEOMETRY.textareaMaxHeight,
						}}
					/>
					{leading}
					<SendButton onClick={submit} busy={busy} disabled={!canSend} label={sendLabel} />
				</div>
				{footer}
			</div>
		)
	},
)

/**
 * The one send button. Same size, radius, icon, hover, active, disabled and
 * loading treatment on every surface — including the static channel previews,
 * so what an owner configures matches what a visitor sees.
 */
export function SendButton({
	onClick,
	busy = false,
	disabled = false,
	label,
	type = 'button',
	size = COMPOSER_GEOMETRY.sendButtonSize,
	className,
	style,
}: {
	onClick?: () => void
	busy?: boolean
	disabled?: boolean
	label: string
	type?: 'button' | 'submit'
	size?: number
	className?: string
	style?: CSSProperties
}) {
	const iconSize = Math.round(size * (COMPOSER_GEOMETRY.sendIconSize / COMPOSER_GEOMETRY.sendButtonSize))
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled || busy}
			aria-label={label}
			title={label}
			className={cn(
				'grid shrink-0 place-items-center rounded-full transition-[transform,background-color,opacity]',
				'bg-[var(--accent-strong)] text-white',
				'hover:enabled:bg-black active:enabled:scale-[0.94]',
				'disabled:cursor-not-allowed disabled:opacity-30',
				'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40',
				className,
			)}
			style={{ width: size, height: size, ...style }}
		>
			{busy ? (
				<Loader2 className="animate-spin" style={{ width: iconSize, height: iconSize }} />
			) : (
				<ArrowUp strokeWidth={2.5} style={{ width: iconSize, height: iconSize }} />
			)}
		</button>
	)
}
