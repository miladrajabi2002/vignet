'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Words as removable chips inside one field. Enter or a comma (Latin or
 * Persian) adds the typed word; Backspace on an empty field removes the last.
 */
export function TagInput({
	value,
	onChange,
	placeholder,
	max = 20,
	maxLength = 40,
	id,
	locale = 'fa',
	className,
	'aria-label': ariaLabel,
}: {
	value: readonly string[]
	onChange: (next: string[]) => void
	placeholder?: string
	max?: number
	maxLength?: number
	id?: string
	locale?: 'fa' | 'en'
	className?: string
	'aria-label'?: string
}) {
	const [draft, setDraft] = useState('')
	const fa = locale === 'fa'

	function commit(raw: string) {
		const words = raw.split(/[,،\n]/).map((word) => word.trim().slice(0, maxLength)).filter(Boolean)
		if (!words.length) return
		const next = [...value]
		for (const word of words) if (!next.includes(word) && next.length < max) next.push(word)
		onChange(next)
		setDraft('')
	}

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter' || event.key === ',' || event.key === '،') {
			event.preventDefault()
			commit(draft)
		} else if (event.key === 'Backspace' && !draft && value.length) {
			onChange(value.slice(0, -1))
		}
	}

	return (
		<div className={cn('input flex h-auto min-h-11 flex-wrap items-center gap-1.5 py-1.5', className)}>
			{value.map((word) => (
				<span key={word} className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] py-0.5 pe-1 ps-2.5 text-[12px] font-medium text-[var(--text-primary)]">
					{word}
					<button
						type="button"
						onClick={() => onChange(value.filter((item) => item !== word))}
						aria-label={fa ? `حذف ${word}` : `Remove ${word}`}
						className="grid h-5 w-5 place-items-center rounded-full text-[var(--text-muted)] hover:bg-black/10 hover:text-[var(--text-primary)]"
					>
						<X className="h-3 w-3" />
					</button>
				</span>
			))}
			<input
				id={id}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={onKeyDown}
				onBlur={() => commit(draft)}
				placeholder={value.length >= max ? '' : placeholder}
				disabled={value.length >= max}
				aria-label={ariaLabel}
				maxLength={maxLength}
				className="min-w-[7rem] flex-1 border-0 bg-transparent p-0 text-[13px] outline-none placeholder:text-[var(--text-hint)] focus:ring-0"
			/>
		</div>
	)
}
