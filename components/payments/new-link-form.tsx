'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { toEnglishDigits } from '@/lib/phone'

const ERRORS: Record<string, [string, string]> = {
	NO_CARD: ['اول یک کارت فعال اضافه کنید.', 'Add an active card first.'],
	DISABLED: ['درگاه خاموش است؛ از «تنظیمات» روشنش کنید.', 'The gateway is off; switch it on in Settings.'],
	AMOUNT_TOO_HIGH: ['این مبلغ از سقف کارت‌به‌کارت بیشتر است.', 'This amount is above the card-to-card limit.'],
	AMOUNT_TOO_LOW: ['حداقل مبلغ ۱٬۰۰۰ تومان است.', 'The minimum is 1,000 Toman.'],
	CAP_REACHED: ['سقف پرداخت‌های این ماهِ پلن شما پر شده است.', 'This month’s payment limit of your plan is reached.'],
	NO_SLOT: ['الان پرداخت‌های باز زیادی با همین مبلغ هست؛ چند دقیقهٔ دیگر تلاش کنید.', 'Too many open payments with this amount; try again shortly.'],
}

/** A payment link for a customer who is not in a Vigent conversation (phone order, another app). */
export function NewLinkForm({ disabled }: { disabled: boolean }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [amount, setAmount] = useState('')
	const [description, setDescription] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [link, setLink] = useState<string | null>(null)

	async function submit(event: React.FormEvent) {
		event.preventDefault()
		const value = Number(toEnglishDigits(amount).replace(/\D/g, ''))
		if (!value) return
		setBusy(true)
		setError(null)
		setLink(null)
		try {
			const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: value, description: description.trim() || undefined }) })
			const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
			if (!response.ok || !data?.url) {
				const copy = ERRORS[data?.error ?? '']
				setError(copy ? copy[fa ? 0 : 1] : (fa ? 'لینک ساخته نشد؛ دوباره تلاش کنید.' : 'The link was not created; try again.'))
				return
			}
			setLink(data.url)
			setAmount('')
			setDescription('')
			router.refresh()
		} finally {
			setBusy(false)
		}
	}

	return (
		<form onSubmit={submit} className="spatial-surface rounded-card p-4 sm:p-5">
			<h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--text-primary)]"><Link2 className="size-4" aria-hidden />{fa ? 'لینک پرداخت دستی' : 'Payment link'}</h2>
			<p className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{fa ? 'برای سفارش تلفنی یا مشتری‌ای که در گفتگوی ویجنت نیست. لینک را بفرستید؛ کارت و مبلغ دقیق را می‌بیند و واریزش خودکار تأیید می‌شود.' : 'For a phone order or a customer outside a Vigent conversation. Send the link; they see the card and the exact amount and the transfer is confirmed automatically.'}</p>
			<div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-end">
				<label className="block">
					<span className="ui-field-label">{fa ? 'مبلغ (تومان)' : 'Amount (Toman)'}</span>
					<input id="pay-link-amount" dir="ltr" inputMode="numeric" className="input mt-1.5 font-mono" value={amount} onChange={(event) => setAmount(toEnglishDigits(event.target.value).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))} placeholder="1,250,000" required disabled={disabled} />
				</label>
				<label className="block">
					<span className="ui-field-label">{fa ? 'بابت (اختیاری)' : 'For (optional)'}</span>
					<input id="pay-link-description" className="input mt-1.5" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} placeholder={fa ? 'مثلاً: کفش کتانی سایز ۴۰' : 'e.g. Sneakers, size 40'} disabled={disabled} />
				</label>
				<Button type="submit" loading={busy} disabled={disabled} className="w-full sm:w-auto">{fa ? 'ساخت لینک' : 'Create link'}</Button>
			</div>
			{error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
			{link ? (
				<div className="mt-3 flex items-center gap-2 rounded-control border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 ps-3">
					<span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[13px]">{link}</span>
					<CopyButton value={link} label={fa ? 'کپی لینک' : 'Copy link'} copiedLabel={fa ? 'کپی شد' : 'Copied'} showLabel />
				</div>
			) : null}
		</form>
	)
}
