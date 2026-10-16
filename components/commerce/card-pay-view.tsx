'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { BankCardFace } from '@/components/payments/bank-card'
import { groupDigits } from '@/lib/payments/card/amount'
import { formatPan } from '@/lib/payments/card/bins'
import { cardPayStatusLabel, minutesLeft, type CardPayStatus, type CardPayView as CardPay } from '@/lib/payments/card/pay-card'

const OPEN: CardPayStatus[] = ['PENDING', 'CLAIMED']

const TONE: Record<CardPayStatus, string> = {
	PENDING: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
	CLAIMED: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-200',
	PAID: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200',
	EXPIRED: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
	FAILED: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-200',
	CANCELLED: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
}

export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch {
		try {
			const area = document.createElement('textarea')
			area.value = text
			area.style.cssText = 'position:fixed;opacity:0;top:0'
			document.body.appendChild(area)
			area.select()
			const ok = document.execCommand('copy')
			area.remove()
			return ok
		} catch {
			return false
		}
	}
}

function CopyRow({ label, shown, value, fa }: { label: string; shown: string; value: string; fa: boolean }) {
	const [done, setDone] = useState(false)
	return (
		<div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-default,#e5e7eb)] bg-neutral-50 py-2 pe-2 ps-3 dark:border-neutral-700 dark:bg-neutral-800/60">
			<span className="min-w-0">
				<span className="block text-[11.5px] leading-5 text-neutral-500 dark:text-neutral-400">{label}</span>
				<span dir="ltr" className="block truncate font-mono text-[16px] font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">{shown}</span>
			</span>
			<button
				type="button"
				onClick={async () => {
					if (await copyText(value)) {
						setDone(true)
						window.setTimeout(() => setDone(false), 1500)
					}
				}}
				className={`min-h-[36px] shrink-0 rounded-xl border px-3 text-[12.5px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${done ? 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200' : 'border-[var(--border-default,#e5e7eb)] bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200'}`}
			>
				{done ? (fa ? 'کپی شد' : 'Copied') : (fa ? 'کپی' : 'Copy')}
			</button>
		</div>
	)
}

/**
 * The live state of a payment: asks the server every few seconds while it is
 * open (slower when the tab is hidden) and stops once it is final.
 */
export function useCardPayStatus(authority: string, initial: CardPayStatus, { live = true, onChange }: { live?: boolean; onChange?: (status: CardPayStatus, paidAt: string | null) => void } = {}) {
	const [status, setStatus] = useState<CardPayStatus>(initial)
	const [paidAt, setPaidAt] = useState<string | null>(null)
	const notify = useRef(onChange)
	notify.current = onChange

	const apply = useCallback((next: CardPayStatus, paid: string | null = null) => {
		if (paid) setPaidAt(paid)
		setStatus((previous) => {
			if (previous !== next) notify.current?.(next, paid)
			return next
		})
	}, [])

	useEffect(() => {
		if (!live) return
		let stopped = false
		let timer: number | undefined
		const tick = async () => {
			try {
				const response = await fetch(`/api/pay/status/${authority}`, { cache: 'no-store' })
				if (response.ok) {
					const data = (await response.json()) as { status?: CardPayStatus; paidAt?: string | null }
					if (!stopped && data.status) {
						apply(data.status, data.paidAt ?? null)
						if (!OPEN.includes(data.status)) return
					}
				}
			} catch { /* offline: try again on the next tick */ }
			if (!stopped) timer = window.setTimeout(tick, document.hidden ? 15_000 : 5_000)
		}
		void tick()
		return () => {
			stopped = true
			if (timer) window.clearTimeout(timer)
		}
	}, [live, authority, apply])

	return { status, paidAt, apply }
}

/** A dot that keeps pulsing while a payment waits for its transfer. */
export function PendingPulse({ className }: { className?: string }) {
	return (
		<span aria-hidden className={`relative inline-flex size-2 shrink-0 ${className ?? ''}`}>
			<span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
			<span className="relative inline-flex size-2 rounded-full bg-current" />
		</span>
	)
}

/**
 * The payment card in a conversation: the business's bank card, the exact
 * amount, two copy buttons and the live state. With `live` it asks the server
 * for the state every few seconds while the payment is open, so the card
 * turns green by itself when the bank's SMS arrives.
 */
export function CardPayCardView({
	card,
	accent,
	onAccent,
	live = true,
	canClaim = true,
	unit = 'toman',
	onStatus,
	actions,
}: {
	card: CardPay
	accent: string
	onAccent: string
	live?: boolean
	/** False in the owner's dashboard: only the customer says «پرداخت کردم». */
	canClaim?: boolean
	/** Rial for the owner's own test: most bank apps take the amount in rials. */
	unit?: 'toman' | 'rial'
	onStatus?: (status: CardPayStatus) => void
	/** The owner's decisions under the card, given its live state and a way to move it. */
	actions?: (status: CardPayStatus, apply: (next: CardPayStatus) => void) => ReactNode
}) {
	const fa = card.lang !== 'en'
	const { status, apply } = useCardPayStatus(card.authority, card.status, { live, onChange: (next) => onStatus?.(next) })
	const [left, setLeft] = useState(() => minutesLeft(card.expiresAt))
	const [claiming, setClaiming] = useState(false)

	useEffect(() => {
		if (status !== 'PENDING') return
		const timer = window.setInterval(() => setLeft(minutesLeft(card.expiresAt)), 20_000)
		return () => window.clearInterval(timer)
	}, [status, card.expiresAt])

	const open = OPEN.includes(status)
	const stateText = status === 'PENDING' && left > 0
		? `${cardPayStatusLabel('PENDING', card.lang)} · ${fa ? `${left.toLocaleString('fa-IR')} دقیقه مهلت` : `${left} min left`}`
		: cardPayStatusLabel(status, card.lang)

	return (
		<div
			dir={fa ? 'rtl' : 'ltr'}
			className="flex w-full max-w-[340px] flex-col gap-2.5 rounded-3xl border border-[var(--border-default,#e5e7eb)] bg-white p-3.5 shadow-[0_12px_32px_-20px_rgba(0,0,0,.35)] dark:border-neutral-700 dark:bg-neutral-900"
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-[15px] font-extrabold text-neutral-900 dark:text-neutral-50">{card.title ? card.title : <>{fa ? 'سفارش' : 'Order'} <span dir="ltr" className="font-mono">{card.code}</span></>}</span>
				<span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11.5px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">{fa ? 'کارت‌به‌کارت' : 'Card transfer'}</span>
			</div>
			{status === 'PAID' ? (
				<div className="grid justify-items-center gap-1.5 rounded-2xl bg-emerald-50 px-3 py-5 text-center dark:bg-emerald-950/40">
					<span className="grid size-12 place-items-center rounded-full bg-emerald-600 text-white shadow-[0_0_0_6px_rgba(16,185,129,.15)]"><Check className="size-6" strokeWidth={3} aria-hidden /></span>
					<p className="mt-1 text-[15px] font-extrabold text-emerald-800 dark:text-emerald-200">{fa ? 'پرداخت تأیید شد' : 'Payment confirmed'}</p>
					<p className="text-[13px] text-emerald-900/80 dark:text-emerald-100/80"><span dir="ltr" className="font-mono font-bold tabular-nums">{groupDigits(card.amount)}</span> {fa ? 'تومان' : 'Toman'}</p>
				</div>
			) : (
				<BankCardFace bankKey={card.bankKey} pan={card.pan} holder={card.holder} lang={card.lang} muted={!open} />
			)}
			{open && (
				<>
					<CopyRow label={fa ? 'شماره کارت' : 'Card number'} shown={formatPan(card.pan)} value={card.pan} fa={fa} />
					{unit === 'rial' ? (
						<>
							<CopyRow label={fa ? 'مبلغ دقیق (ریال)' : 'Exact amount (Rial)'} shown={groupDigits(card.amount * 10)} value={String(card.amount * 10)} fa={fa} />
							<p className="text-[12px] leading-6 text-neutral-500 dark:text-neutral-400">
								{fa ? 'همین عدد را به ریال، بدون رُند کردن واریز کنید. به تومان: ' : 'Transfer exactly this many rials, not rounded. In tomans: '}
								<span dir="ltr" className="font-mono tabular-nums">{groupDigits(card.amount)}</span>
							</p>
						</>
					) : (
						<>
							<CopyRow label={fa ? 'مبلغ دقیق (تومان)' : 'Exact amount (Toman)'} shown={groupDigits(card.amount)} value={String(card.amount)} fa={fa} />
							<p className="text-[12px] leading-6 text-neutral-500 dark:text-neutral-400">
								{fa ? 'همین مبلغ را بدون رُند کردن واریز کنید؛ پرداخت از روی همین عدد شناخته می‌شود. به ریال: ' : 'Transfer exactly this amount; the payment is recognised by it. In rials: '}
								<span dir="ltr" className="font-mono tabular-nums">{groupDigits(card.amount * 10)}</span>
							</p>
						</>
					)}
				</>
			)}
			{status !== 'PAID' ? <div role="status" aria-live="polite" className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-center text-[13px] font-medium ${TONE[status]}`}>{status === 'PENDING' ? <PendingPulse /> : null}{stateText}</div> : <span role="status" aria-live="polite" className="sr-only">{stateText}</span>}
			{canClaim && card.claim && status === 'PENDING' && (
				<button
					type="button"
					disabled={claiming}
					onClick={async () => {
						setClaiming(true)
						try {
							const response = await fetch(`/api/pay/status/${card.authority}`, { method: 'POST' })
							const data = (await response.json().catch(() => null)) as { status?: CardPayStatus } | null
							if (data?.status) apply(data.status)
						} finally {
							setClaiming(false)
						}
					}}
					className="flex min-h-[44px] items-center justify-center rounded-2xl text-[14px] font-extrabold transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
					style={{ backgroundColor: accent, color: onAccent }}
				>
					{fa ? 'پرداخت کردم' : 'I have paid'}
				</button>
			)}
			{actions?.(status, apply)}
		</div>
	)
}
