'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { CheckCircle2, ExternalLink, Link2, Lock, Plus, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { SideSheet } from '@/components/ui/side-sheet'
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

/**
 * «پرداخت تازه» in the gateway's header: a payment link for a customer who
 * is not in a Vigent conversation (a phone order, another app). It opens a
 * side sheet (a bottom sheet on phones) and ends on the link to send.
 */
export function NewPaymentButton({ locked }: { locked: 'card' | 'platform' | null }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [amount, setAmount] = useState('')
	const [description, setDescription] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [made, setMade] = useState<{ url: string; amount: number; description: string } | null>(null)
	const value = Number(toEnglishDigits(amount).replace(/\D/g, ''))
	const numbers = fa ? 'fa-IR' : 'en-US'

	function close() {
		setOpen(false)
		setError(null)
		if (made) {
			setMade(null)
			setAmount('')
			setDescription('')
		}
	}

	async function submit(event: React.FormEvent) {
		event.preventDefault()
		if (!value || locked) return
		setBusy(true)
		setError(null)
		try {
			const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: value, description: description.trim() || undefined }) })
			const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
			if (!response.ok || !data?.url) {
				const copy = ERRORS[data?.error ?? '']
				setError(copy ? copy[fa ? 0 : 1] : (fa ? 'لینک ساخته نشد؛ دوباره تلاش کنید.' : 'The link was not created; try again.'))
				return
			}
			setMade({ url: data.url, amount: value, description: description.trim() })
			router.refresh()
		} catch {
			setError(fa ? 'لینک ساخته نشد؛ اتصال را بررسی کنید.' : 'The link was not created; check the connection.')
		} finally {
			setBusy(false)
		}
	}

	async function share() {
		if (!made) return
		try {
			await navigator.share({ title: fa ? 'لینک پرداخت' : 'Payment link', url: made.url })
		} catch { /* dismissed or unsupported: the copy button is right there */ }
	}

	return (
		<>
			<Button onClick={() => setOpen(true)} aria-label={fa ? 'ساخت پرداخت تازه' : 'Create a payment'} className="max-sm:size-11 max-sm:rounded-full max-sm:px-0">
				<Plus className="size-4" aria-hidden /><span className="max-sm:sr-only">{fa ? 'پرداخت تازه' : 'New payment'}</span>
			</Button>
			{open && (
				<SideSheet
					title={made ? (fa ? 'لینک پرداخت آماده است' : 'The payment link is ready') : (fa ? 'پرداخت تازه' : 'New payment')}
					subtitle={fa ? 'برای سفارش تلفنی یا مشتری بیرون از گفتگو' : 'For a phone order or a customer outside a chat'}
					onClose={close}
					closeLabel={fa ? 'بستن' : 'Close'}
					className="md:w-[min(30rem,calc(100vw-1.5rem))]"
					icon={<span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><Link2 className="size-5" /></span>}
					footer={made ? (
						<div className="flex flex-wrap gap-2">
							<Button onClick={() => { setMade(null); setAmount(''); setDescription('') }}><Plus className="size-4" aria-hidden />{fa ? 'یک پرداخت دیگر' : 'Another payment'}</Button>
							<Button variant="ghost" onClick={close}>{fa ? 'بستن' : 'Close'}</Button>
						</div>
					) : (
						<div className="flex flex-wrap gap-2">
							<Button type="submit" form="pay-new-link" loading={busy} disabled={!value || locked !== null}>{fa ? 'ساخت لینک پرداخت' : 'Create the link'}</Button>
							<Button variant="ghost" onClick={close}>{fa ? 'انصراف' : 'Cancel'}</Button>
						</div>
					)}
				>
					{made ? (
						<div className="grid gap-4">
							<div className="grid justify-items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-6 text-center dark:bg-emerald-950/40">
								<span className="grid size-12 place-items-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="size-6" aria-hidden /></span>
								<p className="text-[22px] font-extrabold tabular-nums text-[var(--text-primary)]">{made.amount.toLocaleString(numbers)} <span className="text-[13px] font-medium text-[var(--text-muted)]">{fa ? 'تومان' : 'Toman'}</span></p>
								{made.description ? <p className="text-[13px] text-[var(--text-secondary)]">{made.description}</p> : null}
							</div>
							<div className="grid gap-1.5">
								<span className="ui-field-label">{fa ? 'لینک را برای مشتری بفرستید' : 'Send this link to the customer'}</span>
								<div className="flex items-center gap-2 rounded-control border-[1.5px] border-[var(--border-default)] bg-[var(--bg-surface)] p-2 ps-3">
									<span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[13px]">{made.url}</span>
									<CopyButton value={made.url} label={fa ? 'کپی' : 'Copy'} copiedLabel={fa ? 'کپی شد' : 'Copied'} showLabel />
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								{typeof navigator !== 'undefined' && 'share' in navigator ? <Button variant="outline" size="sm" onClick={share}><Share2 className="size-4" aria-hidden />{fa ? 'اشتراک‌گذاری' : 'Share'}</Button> : null}
								<a href={made.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3.5 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)]"><ExternalLink className="size-4" aria-hidden />{fa ? 'دیدن صفحهٔ پرداخت' : 'Open the payment page'}</a>
							</div>
							<p className="text-[12.5px] leading-6 text-[var(--text-muted)]">{fa ? 'مشتری کارت و مبلغ دقیق را می‌بیند و واریزش از روی پیامک بانک خودکار تأیید می‌شود. لینک تا یک ساعت باز است.' : 'The customer sees the card and the exact amount, and the transfer is confirmed from the bank SMS. The link stays open for an hour.'}</p>
						</div>
					) : (
						<form id="pay-new-link" onSubmit={submit} className="grid gap-4">
							{locked ? (
								<div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
									<Lock className="size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
									<p className="min-w-0 flex-1 text-[13px] text-[var(--text-secondary)]">{locked === 'card' ? (fa ? 'برای ساخت پرداخت، اول یک کارت فعال اضافه کنید.' : 'Add an active card to create a payment.') : (fa ? 'درگاه موقتاً در دسترس نیست.' : 'The gateway is temporarily unavailable.')}</p>
									{locked === 'card' ? <Link href="/payments/cards" className="ui-link text-[13px]">{fa ? 'افزودن کارت' : 'Add a card'}</Link> : null}
								</div>
							) : null}
							<label className="block">
								<span className="ui-field-label">{fa ? 'مبلغ' : 'Amount'}</span>
								<span className="relative mt-1.5 block">
									<input id="pay-link-amount" data-sheet-initial-focus dir="ltr" inputMode="numeric" autoComplete="off" className={cn('input font-mono text-[18px] tabular-nums', fa ? 'pl-16 pr-3' : 'pl-3 pr-16')} value={amount} onChange={(event) => setAmount(toEnglishDigits(event.target.value).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))} placeholder="1,250,000" required disabled={locked !== null} />
									<span aria-hidden className={cn('pointer-events-none absolute inset-y-1 grid place-items-center rounded-[10px] bg-[var(--bg-surface)] px-2.5 text-[12px] text-[var(--text-muted)]', fa ? 'left-1' : 'right-1')}>{fa ? 'تومان' : 'Toman'}</span>
								</span>
								{value >= 1000 ? <span className="ui-field-hint">{fa ? `به ریال: ${(value * 10).toLocaleString('fa-IR')}` : `In rials: ${(value * 10).toLocaleString('en-US')}`}</span> : null}
							</label>
							<label className="block">
								<span className="ui-field-label">{fa ? 'بابت (اختیاری)' : 'For (optional)'}</span>
								<input id="pay-link-description" className="input mt-1.5" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} placeholder={fa ? 'مثلاً: کفش کتانی سایز ۴۰' : 'e.g. Sneakers, size 40'} disabled={locked !== null} />
								<span className="ui-field-hint">{fa ? 'مشتری همین را بالای کارت پرداخت می‌بیند.' : 'The customer sees this above the payment card.'}</span>
							</label>
							{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
						</form>
					)}
				</SideSheet>
			)}
		</>
	)
}
