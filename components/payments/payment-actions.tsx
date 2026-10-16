'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'

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

/** Stop card-to-card for the customer behind a payment, or allow it again. */
export function CardPayBlockButton({ paymentId, blocked }: { paymentId: string; blocked: boolean }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [busy, setBusy] = useState(false)

	async function toggle() {
		setBusy(true)
		try {
			await fetch(`/api/payments/${paymentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: blocked ? 'unblock' : 'block' }) })
			router.refresh()
		} finally {
			setBusy(false)
		}
	}

	return (
		<Button size="sm" variant="ghost" loading={busy} disabled={busy} onClick={toggle} title={blocked ? undefined : (fa ? 'ایجنت دیگر برای این مشتری کارت نمی‌فرستد و راه‌های دیگر پرداخت را پیشنهاد می‌کند.' : 'The agent stops sending this customer the card and offers the other ways to pay.')}>
			{blocked ? (fa ? 'باز کردن کارت‌به‌کارت این مشتری' : 'Allow card-to-card again') : (fa ? 'بستن کارت‌به‌کارت این مشتری' : 'Block card-to-card for this customer')}
		</Button>
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
