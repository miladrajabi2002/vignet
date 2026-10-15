'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Link2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { toEnglishDigits } from '@/lib/phone'
import { cn } from '@/lib/utils'

const ERRORS: Record<string, [string, string]> = {
	NO_CARD: ['اول یک کارت فعال اضافه کنید.', 'Add an active card first.'],
	DISABLED: ['درگاه خاموش است؛ از «تنظیمات» روشنش کنید.', 'The gateway is off; switch it on in Settings.'],
	AMOUNT_TOO_HIGH: ['این مبلغ از سقف کارت‌به‌کارت بیشتر است.', 'This amount is above the card-to-card limit.'],
	AMOUNT_TOO_LOW: ['حداقل مبلغ ۱٬۰۰۰ تومان است.', 'The minimum is 1,000 Toman.'],
	CAP_REACHED: ['سقف پرداخت‌های این ماهِ پلن شما پر شده است.', 'This month’s payment limit of your plan is reached.'],
	NO_SLOT: ['الان پرداخت‌های باز زیادی با همین مبلغ هست؛ چند دقیقهٔ دیگر تلاش کنید.', 'Too many open payments with this amount; try again shortly.'],
}

/** A payment link for a customer who is not in a Vigent conversation (phone order, another app). */
export function NewLinkForm({ locked }: { locked: 'card' | 'platform' | null }) {
	const fa = useLocale() !== 'en'
	const disabled = locked !== null
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
		<form id="pay-link" onSubmit={submit} className="spatial-surface scroll-mt-24 rounded-card p-4 shadow-[0_1px_2px_rgba(17,17,17,.04),0_10px_28px_-14px_rgba(17,17,17,.16)] sm:p-5">
			<h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--text-primary)]"><Link2 className="size-4" aria-hidden />{fa ? 'لینک پرداخت دستی' : 'Payment link'}</h2>
			<p className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{fa ? 'برای سفارش تلفنی یا مشتری‌ای که در گفتگوی ویجنت نیست. لینک را بفرستید؛ کارت و مبلغ دقیق را می‌بیند و واریزش خودکار تأیید می‌شود.' : 'For a phone order or a customer outside a Vigent conversation. Send the link; they see the card and the exact amount and the transfer is confirmed automatically.'}</p>
			{locked ? (
				<div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
					<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[var(--text-muted)] dark:bg-neutral-900"><Lock className="size-4" aria-hidden /></span>
					<div className="min-w-0 flex-1 basis-48">
						<p className="text-[13.5px] font-bold text-[var(--text-primary)]">{locked === 'card' ? (fa ? 'بعد از افزودن اولین کارت فعال می‌شود' : 'Available once you add a card') : (fa ? 'درگاه موقتاً در دسترس نیست' : 'The gateway is temporarily unavailable')}</p>
						<p className="text-[12.5px] text-[var(--text-muted)]">{locked === 'card' ? (fa ? 'لینک، مشتری را به همان کارت می‌فرستد.' : 'The link sends the customer to that card.') : (fa ? 'به‌زودی دوباره باز می‌شود.' : 'It will be back shortly.')}</p>
					</div>
					{locked === 'card' ? <Link href="/payments/cards" className="inline-flex min-h-10 items-center rounded-full bg-[var(--text-primary)] px-4 text-[13px] font-bold text-white dark:text-neutral-900">{fa ? 'افزودن کارت' : 'Add a card'}</Link> : null}
				</div>
			) : null}
			<div className={cn('mt-4 grid gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_auto] sm:items-end', disabled && 'pointer-events-none opacity-50')}>
				<label className="block">
					<span className="ui-field-label">{fa ? 'مبلغ' : 'Amount'}</span>
					<span className="relative mt-1.5 block">
						<input id="pay-link-amount" dir="ltr" inputMode="numeric" className={cn('input font-mono', fa ? 'pl-16 pr-3' : 'pl-3 pr-16')} value={amount} onChange={(event) => setAmount(toEnglishDigits(event.target.value).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))} placeholder="1,250,000" required disabled={disabled} />
						<span aria-hidden className={cn('pointer-events-none absolute inset-y-1 grid place-items-center rounded-[10px] bg-[var(--bg-surface)] px-2.5 text-[12px] text-[var(--text-muted)]', fa ? 'left-1' : 'right-1')}>{fa ? 'تومان' : 'Toman'}</span>
					</span>
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
