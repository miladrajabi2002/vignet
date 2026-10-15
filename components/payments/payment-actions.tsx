'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { CheckCircle2, Copy, ExternalLink, Loader2, MessageSquareText, MoreHorizontal, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { cn } from '@/lib/utils'

/** The owner's decision on one payment. `review` shows confirm + reject; `pending` shows confirm by hand + withdraw. */
export function PaymentActions({ paymentId, mode, compact = false }: { paymentId: string; mode: 'review' | 'pending'; compact?: boolean }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [busy, setBusy] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	async function act(action: 'confirm' | 'reject' | 'cancel') {
		setBusy(action)
		setError(null)
		try {
			const response = await fetch(`/api/payments/${paymentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
			if (!response.ok && response.status !== 409) throw new Error('failed')
			router.refresh()
		} catch {
			setError(fa ? 'انجام نشد؛ دوباره تلاش کنید.' : 'That did not work; try again.')
		} finally {
			setBusy(null)
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button size="sm" variant={mode === 'review' ? 'primary' : 'outline'} loading={busy === 'confirm'} disabled={busy !== null} onClick={() => act('confirm')}>
				{mode === 'review' ? (fa ? 'واریز رسیده، تأیید' : 'Money arrived, confirm') : (fa ? 'تأیید دستی' : 'Confirm by hand')}
			</Button>
			{mode === 'review' ? (
				<Button size="sm" variant="danger" loading={busy === 'reject'} disabled={busy !== null} onClick={() => act('reject')}>
					{fa ? 'واریزی نیامده، رد' : 'Nothing arrived, reject'}
				</Button>
			) : !compact ? (
				<Button size="sm" variant="ghost" loading={busy === 'cancel'} disabled={busy !== null} onClick={() => act('cancel')}>
					{fa ? 'لغو' : 'Withdraw'}
				</Button>
			) : null}
			{error ? <span role="alert" className="text-xs text-red-600">{error}</span> : null}
		</div>
	)
}

/** Attach a deposit no order asked for to one of the open payments, or say it belongs to none. */
export function UnmatchedSmsActions({ smsId, suggestions }: { smsId: string; suggestions: Array<{ id: string; label: string }> }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [busy, setBusy] = useState<string | null>(null)

	async function resolve(paymentId: string | null) {
		setBusy(paymentId ?? 'none')
		try {
			await fetch(`/api/payments/sms/${smsId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentId }) })
			router.refresh()
		} finally {
			setBusy(null)
		}
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			{suggestions.map((suggestion) => (
				<Button key={suggestion.id} size="sm" variant="outline" loading={busy === suggestion.id} disabled={busy !== null} onClick={() => resolve(suggestion.id)}>
					{fa ? `برای ${suggestion.label} است` : `It is for ${suggestion.label}`}
				</Button>
			))}
			<Button size="sm" variant="ghost" loading={busy === 'none'} disabled={busy !== null} onClick={() => resolve(null)}>
				{fa ? 'به سفارشی مربوط نیست' : 'Not an order'}
			</Button>
		</div>
	)
}

type RowAction = { key: string; label: string; icon: typeof MoreHorizontal; tone?: 'danger'; href?: string; external?: boolean; run?: () => Promise<void> | void }

/**
 * One payment's actions behind a single «⋯» button, so every row of the list
 * keeps the same columns however many actions it has: an anchored menu from
 * `md` up, a bottom sheet with thumb-sized rows on phones.
 */
export function PaymentRowMenu({ paymentId, pending, payUrl, conversationHref, label }: { paymentId: string; pending: boolean; payUrl: string | null; conversationHref: string | null; label: string }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [busy, setBusy] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [desktop, setDesktop] = useState(true)
	const [copied, setCopied] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		const media = window.matchMedia('(min-width: 768px)')
		const update = () => setDesktop(media.matches)
		update()
		media.addEventListener('change', update)
		return () => media.removeEventListener('change', update)
	}, [])
	useEffect(() => {
		if (!open || !desktop) return
		const onDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
		const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus() } }
		document.addEventListener('mousedown', onDown)
		document.addEventListener('keydown', onKey)
		return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
	}, [open, desktop])

	async function act(action: 'confirm' | 'cancel') {
		setBusy(action)
		setError(null)
		try {
			const response = await fetch(`/api/payments/${paymentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
			if (!response.ok && response.status !== 409) throw new Error('failed')
			setOpen(false)
			router.refresh()
		} catch {
			setError(fa ? 'انجام نشد؛ دوباره تلاش کنید.' : 'That did not work; try again.')
		} finally {
			setBusy(null)
		}
	}

	const actions: RowAction[] = [
		...(pending ? [{ key: 'confirm', label: fa ? 'تأیید دستی؛ واریز رسیده' : 'Confirm by hand', icon: CheckCircle2, run: () => act('confirm') }] : []),
		...(payUrl ? [
			{ key: 'copy', label: copied ? (fa ? 'کپی شد' : 'Copied') : (fa ? 'کپی لینک پرداخت' : 'Copy the payment link'), icon: Copy, run: async () => { try { await navigator.clipboard.writeText(payUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1500) } catch { /* no clipboard */ } } },
			{ key: 'page', label: fa ? 'دیدن صفحهٔ پرداخت' : 'Open the payment page', icon: ExternalLink, href: payUrl, external: true },
		] : []),
		...(conversationHref ? [{ key: 'chat', label: fa ? 'دیدن گفتگو' : 'Open the conversation', icon: MessageSquareText, href: conversationHref }] : []),
		...(pending ? [{ key: 'cancel', label: fa ? 'لغو این پرداخت' : 'Withdraw this payment', icon: XCircle, tone: 'danger' as const, run: () => act('cancel') }] : []),
	]
	if (!actions.length) return <span aria-hidden className="size-9" />

	const row = (action: RowAction, sheet: boolean) => {
		const Icon = action.icon
		const className = cn(
			'flex w-full items-center gap-2.5 text-start font-medium transition-colors disabled:opacity-50',
			sheet ? 'min-h-12 rounded-2xl px-3.5 text-[14px]' : 'min-h-10 rounded-xl px-3 text-[13px]',
			action.tone === 'danger' ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40' : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
		)
		const inner = <>{busy === action.key ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className={cn('size-4 shrink-0', action.tone === 'danger' ? '' : 'text-[var(--text-muted)]')} aria-hidden />}{action.label}</>
		if (action.href) {
			return action.external
				? <a key={action.key} role="menuitem" href={action.href} target="_blank" rel="noopener noreferrer" className={className} onClick={() => setOpen(false)}>{inner}</a>
				: <Link key={action.key} role="menuitem" href={action.href} className={className} onClick={() => setOpen(false)}>{inner}</Link>
		}
		return <button key={action.key} type="button" role="menuitem" disabled={busy !== null} className={className} onClick={() => void action.run?.()}>{inner}</button>
	}

	return (
		<div ref={rootRef} className="relative">
			<button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={fa ? `کارهای پرداخت ${label}` : `Actions for ${label}`} onClick={() => setOpen(!open)} className={cn('grid size-9 place-items-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]', open && 'bg-[var(--bg-hover)] text-[var(--text-primary)]')}>
				<MoreHorizontal className="size-[18px]" aria-hidden />
			</button>
			{open && desktop && (
				<div role="menu" className="absolute end-0 top-full z-30 mt-1.5 grid w-60 gap-0.5 rounded-2xl border border-[var(--border-default)] bg-white p-1.5 shadow-[var(--elev-2)] dark:bg-neutral-900">
					{actions.map((action) => row(action, false))}
					{error ? <p role="alert" className="px-3 py-1.5 text-[12px] text-red-600">{error}</p> : null}
				</div>
			)}
			<MobileBottomSheet open={open && !desktop} title={label} closeLabel={fa ? 'بستن' : 'Close'} triggerRef={triggerRef} onClose={() => setOpen(false)}>
				<div role="menu" className="grid gap-1">
					{actions.map((action) => row(action, true))}
					{error ? <p role="alert" className="px-3.5 py-2 text-[13px] text-red-600">{error}</p> : null}
				</div>
			</MobileBottomSheet>
		</div>
	)
}
