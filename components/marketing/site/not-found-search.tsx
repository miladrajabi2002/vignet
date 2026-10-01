'use client'

import { useId, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { normalizePersian } from '@/lib/search/persian'

export type SearchEntry = { href: string; title: string; hint?: string }

const normalize = normalizePersian

/**
 * 404 search over the site's own destinations (pages, solutions, docs).
 * Runs entirely in the browser against a small list the server passes in —
 * no search backend, no network request while typing.
 */
export function NotFoundSearch({ entries, labels }: { entries: SearchEntry[]; labels: { label: string; placeholder: string; submit: string; empty: string; results: string } }) {
	const router = useRouter()
	const inputId = useId()
	const listId = useId()
	const [query, setQuery] = useState('')
	const matches = useMemo(() => {
		const q = normalize(query)
		if (!q) return []
		const words = q.split(/\s+/)
		return entries.filter((entry) => {
			const haystack = normalize(`${entry.title} ${entry.hint ?? ''}`)
			return words.every((word) => haystack.includes(word))
		}).slice(0, 5)
	}, [entries, query])

	const submit = (event: FormEvent) => {
		event.preventDefault()
		router.push(matches[0]?.href ?? '/docs')
	}

	return (
		<form role="search" onSubmit={submit} className="w-full">
			<label htmlFor={inputId} className="sr-only">{labels.label}</label>
			<div className="flex gap-2">
				<div className="flex h-14 min-w-0 grow items-center gap-2.5 rounded-2xl border border-black/[0.12] bg-white px-4 focus-within:border-[var(--focus-field)] focus-within:shadow-[0_0_0_4px_var(--focus-field-halo)]">
					<Search aria-hidden className="size-[18px] shrink-0 text-vg-cap" strokeWidth={1.8} />
					<input
						id={inputId}
						type="search"
						enterKeyHint="search"
						autoComplete="off"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder={labels.placeholder}
						aria-controls={listId}
						className="h-[50px] min-w-0 grow border-0 bg-transparent text-[16px] text-vg-ink outline-none placeholder:text-vg-cap"
					/>
				</div>
				<button type="submit" className="vg-press vg-btn-dark h-14 shrink-0 rounded-2xl bg-vg-ink px-5 text-[15px] font-medium text-white lg:px-6">{labels.submit}</button>
			</div>
			<div id={listId} aria-live="polite" className="text-start">
				{query.trim() ? (
					matches.length ? (
						<ul aria-label={labels.results} className="mt-2 overflow-hidden rounded-2xl border border-vg-line bg-white">
							{matches.map((entry) => (
								<li key={entry.href} className="border-b border-black/[0.06] last:border-0">
									<Link href={entry.href} className="flex min-h-12 flex-col justify-center px-4 py-2 hover:bg-vg-bg">
										<span className="text-[14.5px] font-medium">{entry.title}</span>
										{entry.hint ? <span className="text-[12.5px] text-vg-cap">{entry.hint}</span> : null}
									</Link>
								</li>
							))}
						</ul>
					) : (
						<p className="mt-2 px-1 text-[13px] text-vg-cap">{labels.empty}</p>
					)
				) : null}
			</div>
		</form>
	)
}
