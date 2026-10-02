'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { getVerticalPack, type BusinessTypeValue, type CapabilityKey, type DashboardModuleKey } from '@/lib/verticals/registry'

const LIFETIME_MS = 6_000
const RESUME_MS = 3_000

export type VerticalChangeDetail = {
	businessType: BusinessTypeValue
	capabilities: CapabilityKey[]
	modules: DashboardModuleKey[]
	newlyEnabled: DashboardModuleKey[]
	/** Menu sections this save added, already labelled for the saved type. */
	added?: { key: DashboardModuleKey; label: string; href: string }[]
	/** Labels of the menu sections this save hid. */
	hidden?: string[]
	typeChanged?: boolean
	/** The new business name, only when this save renamed the business. */
	renamedTo?: string
	verticalTitle?: string
	/** Capability set to restore when the owner taps Undo in the toast. */
	undoCapabilities?: CapabilityKey[]
	changedAt: number
}

/**
 * One sentence for what a business-settings save did to the menu, so the
 * toast and the settings summary say the same thing: the type only when the
 * type changed, otherwise the sections that appeared or were hidden, or the
 * new business name when that is all that changed.
 */
export function describeMenuChange({ fa, added, hidden, typeTitle, renamedTo }: { fa: boolean; added: readonly string[]; hidden: readonly string[]; typeTitle?: string; renamedTo?: string }) {
	const count = (value: number) => value.toLocaleString(fa ? 'fa-IR' : 'en-US')
	const list = (items: readonly string[]) => items.join(fa ? '، ' : ', ')

	let title: string
	if (typeTitle) title = fa ? `پنل برای «${typeTitle}» تنظیم شد` : `Dashboard set up for “${typeTitle}”`
	else if (added.length === 1) title = fa ? `«${added[0]}» به منو اضافه شد` : `“${added[0]}” added to your menu`
	else if (added.length) title = fa ? `${count(added.length)} بخش به منو اضافه شد` : `${added.length} sections added to your menu`
	else if (hidden.length === 1) title = fa ? `«${hidden[0]}» از منو پنهان شد` : `“${hidden[0]}” hidden from your menu`
	else if (hidden.length) title = fa ? `${count(hidden.length)} بخش از منو پنهان شد` : `${hidden.length} sections hidden from your menu`
	else if (renamedTo) title = fa ? `نام کسب‌وکار به «${renamedTo}» تغییر کرد` : `Business renamed to “${renamedTo}”`
	else title = fa ? 'تنظیمات کسب‌وکار ذخیره شد' : 'Business settings saved'

	// Only repeat the names the title could not carry.
	const parts = [
		added.length && (typeTitle || added.length > 1) ? `${fa ? 'اضافه شد:' : 'Added:'} ${list(added)}` : '',
		hidden.length && (typeTitle || added.length || hidden.length > 1) ? `${fa ? 'پنهان شد:' : 'Hidden:'} ${list(hidden)}` : '',
		renamedTo && (typeTitle || added.length || hidden.length) ? `${fa ? 'نام جدید:' : 'New name:'} ${renamedTo}` : '',
	].filter(Boolean)
	const detail = parts.length
		? parts.join(' · ')
		: hidden.length
			? (fa ? 'اطلاعاتش محفوظ است و با روشن‌کردن دوباره برمی‌گردد.' : 'Its data is kept and returns when you turn it back on.')
			: added.length
				? (fa ? 'از همین حالا در منوی پنل در دسترس است.' : 'It is available in your menu now.')
				: renamedTo
					? (fa ? 'قابلیت‌ها و منوی پنل همان است.' : 'Capabilities and your menu are unchanged.')
					: (fa ? 'منوی پنل تغییری نکرد.' : 'Your menu is unchanged.')

	return { title, detail }
}

export function VerticalChangeNotice({ businessType }: { businessType?: BusinessTypeValue | null; capabilities?: readonly CapabilityKey[] }) {
	const fa = useLocale() !== 'en'
	const pathname = usePathname()
	const reduceMotion = useReducedMotion()
	const [change, setChange] = useState<VerticalChangeDetail | null>(null)
	const [ttl, setTtl] = useState(LIFETIME_MS)
	const [paused, setPaused] = useState(false)

	useEffect(() => {
		function accept(detail: VerticalChangeDetail | null) {
			if (!detail) return
			const remaining = LIFETIME_MS - (Date.now() - Number(detail.changedAt))
			if (!(remaining > 0)) return
			setTtl(remaining)
			setPaused(false)
			setChange(detail)
		}
		function onChange(event: Event) {
			accept((event as CustomEvent<VerticalChangeDetail>).detail)
		}
		window.addEventListener('vigent:vertical-changed', onChange)
		try {
			const stored = JSON.parse(localStorage.getItem('vigent:vertical-change') ?? 'null') as VerticalChangeDetail | null
			if (stored?.businessType === businessType) accept(stored)
		} catch {}
		return () => window.removeEventListener('vigent:vertical-changed', onChange)
	}, [businessType])

	function dismiss() {
		setChange(null)
		try { localStorage.removeItem('vigent:vertical-change') } catch {}
	}

	// Hovering or focusing the toast holds it open; leaving gives a short grace.
	useEffect(() => {
		if (!change || paused) return
		const timer = window.setTimeout(dismiss, ttl)
		return () => window.clearTimeout(timer)
	}, [change, paused, ttl])

	function hold() {
		setPaused(true)
	}
	function release() {
		setTtl(RESUME_MS)
		setPaused(false)
	}

	const added = change?.added ?? []
	const pack = change ? getVerticalPack(change.businessType) : null
	const summary = change && pack
		? describeMenuChange({
			fa,
			added: added.map((item) => item.label),
			hidden: change.hidden ?? [],
			typeTitle: change.typeChanged ? change.verticalTitle || (fa ? pack.titleFa : pack.titleEn) : undefined,
			renamedTo: change.renamedTo,
		})
		: null
	// The settings page shows the new sections in its own summary card.
	const links = pathname.startsWith('/settings') ? [] : added.slice(0, 3)
	const Arrow = fa ? ArrowLeft : ArrowRight

	return (
		<AnimatePresence>
			{change && summary && (
				<motion.aside
					key={change.changedAt}
					initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
					transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
					role="status"
					aria-live="polite"
					onMouseEnter={hold}
					onMouseLeave={release}
					onFocus={hold}
					onBlur={release}
					className="fixed inset-x-3 z-[90] mx-auto max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c]/95 text-white shadow-[0_24px_60px_-24px_rgba(0,0,0,0.65)] backdrop-blur [bottom:calc(6rem+env(safe-area-inset-bottom))] md:bottom-5"
				>
					<div className="flex items-start gap-3 p-3 ps-3.5">
						<span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-[0_8px_18px_-8px_rgba(16,185,129,0.9)]">
							<Check className="h-4 w-4" strokeWidth={3} />
						</span>
						<div className="min-w-0 flex-1 py-0.5">
							<p className="text-[13px] font-bold leading-5">{summary.title}</p>
							<p className="mt-0.5 text-[13px] leading-5 text-white/65">{summary.detail}</p>
							{links.length > 0 && (
								<div className="mt-2.5 flex flex-wrap gap-1.5">
									{links.map((item) => (
										<Link key={item.key} href={item.href} onClick={dismiss} className="spatial-press inline-flex min-h-9 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-bold text-black">
											{item.label}
											<Arrow className="h-3.5 w-3.5" />
										</Link>
									))}
								</div>
							)}
						</div>
						{change.undoCapabilities && pathname.startsWith('/settings') && (
							<button
								type="button"
								onClick={() => {
									window.dispatchEvent(new CustomEvent('vigent:vertical-undo', { detail: change.undoCapabilities }))
									dismiss()
								}}
								className="mt-0.5 inline-flex min-h-9 shrink-0 items-center rounded-xl px-2.5 text-[13px] font-bold text-[#b9adff] transition-colors hover:bg-white/10"
							>
								{fa ? 'برگرداندن' : 'Undo'}
							</button>
						)}
						<button type="button" onClick={dismiss} aria-label={fa ? 'بستن' : 'Close'} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
							<X className="h-4 w-4" />
						</button>
					</div>
					{!reduceMotion && !paused && (
						<motion.span
							key={ttl}
							aria-hidden
							initial={{ scaleX: 1 }}
							animate={{ scaleX: 0 }}
							transition={{ duration: ttl / 1000, ease: 'linear' }}
							className="absolute inset-x-0 bottom-0 block h-0.5 bg-emerald-400/80 ltr:origin-left rtl:origin-right"
						/>
					)}
				</motion.aside>
			)}
		</AnimatePresence>
	)
}
