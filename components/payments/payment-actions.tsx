'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Ban, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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

/**
 * Card-to-card for the customer behind a payment, as a switch: on, the agent
 * sends them the card; off, it offers the other ways to pay. `row` is the
 * detail sheet's full row with its explanation; `inline` sits beside other
 * buttons.
 */
export function CustomerCardPaySwitch({ paymentId, blocked, variant = 'row' }: { paymentId: string; blocked: boolean; variant?: 'row' | 'inline' }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [allowed, setAllowed] = useState(!blocked)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState(false)
	// Another payment of the same customer may have flipped it.
	useEffect(() => { setAllowed(!blocked) }, [blocked])

	async function change(next: boolean) {
		setAllowed(next)
		setBusy(true)
		setError(false)
		try {
			const response = await fetch(`/api/payments/${paymentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: next ? 'unblock' : 'block' }) })
			if (!response.ok) throw new Error('failed')
			router.refresh()
		} catch {
			setAllowed(!next)
			setError(true)
		} finally {
			setBusy(false)
		}
	}

	const title = fa ? 'کارت‌به‌کارت برای این مشتری' : 'Card-to-card for this customer'
	const state = allowed
		? (fa ? 'ایجنت برایش کارت و مبلغ را می‌فرستد.' : 'The agent sends them the card and the amount.')
		: (fa ? 'بسته است؛ ایجنت کارت نمی‌فرستد و راه‌های دیگر پرداخت را پیشنهاد می‌کند.' : 'Off: the agent sends no card and offers the other ways to pay.')
	const failed = error ? <span role="alert" className="block text-[12px] text-red-600">{fa ? 'ذخیره نشد؛ دوباره تلاش کنید.' : 'Not saved; try again.'}</span> : null

	if (variant === 'inline') {
		return (
			<span className="inline-flex items-center gap-2.5 text-[12.5px] text-[var(--text-secondary)]" title={state}>
				<Switch checked={allowed} onChange={change} pending={busy} disabled={busy} aria-label={title} />
				<span>{allowed ? (fa ? 'کارت‌به‌کارت این مشتری باز است' : 'Card-to-card on for this customer') : (fa ? 'کارت‌به‌کارت این مشتری بسته است' : 'Card-to-card off for this customer')}{failed}</span>
			</span>
		)
	}
	return (
		<div className={cn('flex items-center gap-3 rounded-2xl border p-3 transition-colors', allowed ? 'border-[var(--border-default)]' : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30')}>
			<span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', allowed ? 'bg-[var(--bg-muted)] text-[var(--text-primary)]' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200')}>
				{allowed ? <CreditCard className="size-4" aria-hidden /> : <Ban className="size-4" aria-hidden />}
			</span>
			<span className="min-w-0 flex-1">
				<b className="block text-[13px] text-[var(--text-primary)]">{title}</b>
				<span className="block text-[12px] leading-5 text-[var(--text-muted)]">{state}</span>
				{failed}
			</span>
			<Switch checked={allowed} onChange={change} pending={busy} disabled={busy} aria-label={title} />
		</div>
	)
}

/**
 * Attach a deposit no order asked for to one of the open payments, or say it
 * belongs to none. `hint` says what attaching does when the amounts differ.
 */
export function UnmatchedSmsActions({ smsId, suggestions }: { smsId: string; suggestions: Array<{ id: string; label: string; hint?: string | null }> }) {
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
					{suggestion.hint ? <span className="font-normal opacity-70">· {suggestion.hint}</span> : null}
				</Button>
			))}
			<Button size="sm" variant="ghost" loading={busy === 'none'} disabled={busy !== null} onClick={() => resolve(null)}>
				{fa ? 'به سفارشی مربوط نیست' : 'Not an order'}
			</Button>
		</div>
	)
}
