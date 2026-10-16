'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { AlertTriangle, CheckCircle2, Link2, Lock, MessageSquareText, Plus, Send, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { SideSheet } from '@/components/ui/side-sheet'
import { toEnglishDigits } from '@/lib/phone'
import { AmountField, formatAmountInput, ItemsEditor, itemsTotal, RecipientPicker, RecipientRow, toPayItems, type EditorItem, type Recipient } from '@/components/payments/payment-request-fields'
import { cn } from '@/lib/utils'

const ERRORS: Record<string, [string, string]> = {
	NO_CARD: ['اول یک کارت فعال اضافه کنید.', 'Add an active card first.'],
	DISABLED: ['درگاه خاموش است؛ از «تنظیمات» روشنش کنید.', 'The gateway is off; switch it on in Settings.'],
	AMOUNT_TOO_HIGH: ['این مبلغ از سقف کارت‌به‌کارت بیشتر است.', 'This amount is above the card-to-card limit.'],
	AMOUNT_TOO_LOW: ['حداقل مبلغ ۱٬۰۰۰ تومان است.', 'The minimum is 1,000 Toman.'],
	CAP_REACHED: ['سقف پرداخت‌های این ماهِ پلن شما پر شده است.', 'This month’s payment limit of your plan is reached.'],
	NO_SLOT: ['الان پرداخت‌های باز زیادی با همین مبلغ هست؛ چند دقیقهٔ دیگر تلاش کنید.', 'Too many open payments with this amount; try again shortly.'],
	WINDOW_CLOSED: ['اینستاگرام فقط تا ۲۴ ساعت بعد از آخرین پیام مشتری اجازهٔ پیام می‌دهد؛ «فقط لینک بساز» را بزنید و لینک را جور دیگری بفرستید.', 'Instagram allows messages only within 24 hours of the customer’s last one; make a link instead.'],
	NOT_FOUND: ['این گفتگو پیدا نشد.', 'That conversation was not found.'],
}

/**
 * «پرداخت تازه» in the gateway's header: a payment link to send by hand (a
 * phone order, another app) or a payment card sent straight into a
 * customer's conversation, optionally with its items. It opens a side sheet
 * (a bottom sheet on phones).
 */
export function NewPaymentButton({ locked }: { locked: 'card' | 'platform' | null }) {
	const fa = useLocale() !== 'en'
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [amount, setAmount] = useState('')
	const [amountTouched, setAmountTouched] = useState(false)
	const [description, setDescription] = useState('')
	const [target, setTarget] = useState<'link' | 'chat'>('link')
	const [recipient, setRecipient] = useState<Recipient | null>(null)
	const [items, setItems] = useState<EditorItem[]>([])
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [made, setMade] = useState<{ url: string; amount: number; description: string; recipient: Recipient | null; delivery: string | null } | null>(null)
	const value = Number(toEnglishDigits(amount).replace(/\D/g, ''))
	const numbers = fa ? 'fa-IR' : 'en-US'
	const total = itemsTotal(items)
	const ready = Boolean(value) && !locked && (target === 'link' || recipient !== null)

	function reset() {
		setMade(null)
		setAmount('')
		setAmountTouched(false)
		setDescription('')
		setItems([])
		setRecipient(null)
	}

	function close() {
		setOpen(false)
		setError(null)
		if (made) reset()
	}

	/** The items' total fills the amount until the owner types one of their own. */
	function changeItems(next: EditorItem[]) {
		setItems(next)
		if (!amountTouched) setAmount(formatAmountInput(itemsTotal(next)))
	}

	async function submit(event: React.FormEvent) {
		event.preventDefault()
		if (!ready) return
		setBusy(true)
		setError(null)
		try {
			const response = await fetch('/api/payments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					amount: value,
					description: description.trim() || undefined,
					items: toPayItems(items),
					...(target === 'chat' && recipient ? { conversationId: recipient.conversationId } : {}),
				}),
			})
			const data = (await response.json().catch(() => null)) as { url?: string; error?: string; delivery?: string } | null
			if (!response.ok || !data?.url) {
				const copy = ERRORS[data?.error ?? '']
				setError(copy ? copy[fa ? 0 : 1] : (fa ? 'پرداخت ساخته نشد؛ دوباره تلاش کنید.' : 'The payment was not created; try again.'))
				return
			}
			setMade({ url: data.url, amount: value, description: description.trim(), recipient: target === 'chat' ? recipient : null, delivery: data.delivery ?? null })
			router.refresh()
		} catch {
			setError(fa ? 'پرداخت ساخته نشد؛ اینترنت را چک کنید.' : 'The payment was not created; check the connection.')
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
			<Button onClick={() => setOpen(true)} aria-label={fa ? 'ساخت پرداخت تازه' : 'Create a payment'} className="max-sm:size-11 max-sm:px-0">
				<Plus className="size-4" aria-hidden /><span className="max-sm:sr-only">{fa ? 'پرداخت تازه' : 'New payment'}</span>
			</Button>
			{open && (
				<SideSheet
					title={made ? (made.recipient ? (fa ? 'درخواست پرداخت فرستاده شد' : 'Payment request sent') : (fa ? 'لینک پرداخت آماده است' : 'The payment link is ready')) : (fa ? 'پرداخت تازه' : 'New payment')}
					subtitle={fa ? 'یک لینک، یا مستقیم در گفتگوی مشتری' : 'A link, or straight into a customer’s conversation'}
					onClose={close}
					closeLabel={fa ? 'بستن' : 'Close'}
					className="md:w-[min(30rem,calc(100vw-1.5rem))]"
					icon={<span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><Link2 className="size-5" /></span>}
					footer={made ? (
						<div className="flex flex-wrap gap-2">
							<Button onClick={reset}><Plus className="size-4" aria-hidden />{fa ? 'یک پرداخت دیگر' : 'Another payment'}</Button>
							<Button variant="ghost" onClick={close}>{fa ? 'بستن' : 'Close'}</Button>
						</div>
					) : (
						<div className="flex flex-wrap gap-2">
							<Button type="submit" form="pay-new-link" loading={busy} disabled={!ready}>
								{target === 'chat' ? <Send className="size-4" aria-hidden /> : null}
								{target === 'chat' ? (recipient ? (fa ? `ساخت و فرستادن برای ${recipient.name}` : `Create and send to ${recipient.name}`) : (fa ? 'اول مشتری را انتخاب کنید' : 'Pick the customer first')) : (fa ? 'ساخت لینک پرداخت' : 'Create the link')}
							</Button>
							<Button variant="ghost" onClick={close}>{fa ? 'انصراف' : 'Cancel'}</Button>
						</div>
					)}
				>
					{made ? (
						// grid-cols-1 (minmax(0,1fr)): the long link truncates instead of widening the sheet past a phone's edge.
						<div className="grid grid-cols-1 gap-4">
							<div className="grid justify-items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-6 text-center dark:bg-emerald-950/40">
								<span className="grid size-12 place-items-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="size-6" aria-hidden /></span>
								<p className="text-[22px] font-extrabold tabular-nums text-[var(--text-primary)]">{made.amount.toLocaleString(numbers)} <span className="text-[13px] font-medium text-[var(--text-muted)]">{fa ? 'تومان' : 'Toman'}</span></p>
								{made.description ? <p className="text-[13px] text-[var(--text-secondary)]">{made.description}</p> : null}
							</div>
							{made.recipient ? (
								<div className="grid gap-2">
									<div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] p-2.5"><RecipientRow recipient={made.recipient} fa={fa} /></div>
									{made.delivery === 'failed'
										? <p className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-[12.5px] leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{fa ? 'پرداخت ساخته شد ولی پیام به کانال نرسید؛ لینک زیر را دستی بفرستید.' : 'The payment was created but the channel did not take the message; send the link below yourself.'}</p>
										: <p className="flex items-center gap-2 text-[13px] text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" aria-hidden />{fa ? 'کارت پرداخت در گفتگو فرستاده شد؛ با واریز، به مشتری هم خبر می‌دهیم.' : 'The payment card was sent in the conversation; the customer hears when it lands.'}</p>}
									<Link href={`/conversations/${made.recipient.conversationId}`} className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-[var(--border-default)] px-3.5 text-[13px] font-medium text-[var(--text-primary)] hover:border-[var(--border-hover)]"><MessageSquareText className="size-4" aria-hidden />{fa ? 'دیدن گفتگو' : 'Open the conversation'}</Link>
								</div>
							) : null}
							<div className="grid grid-cols-1 gap-1.5">
								<span className="ui-field-label">{made.recipient ? (fa ? 'لینک صفحهٔ پرداخت' : 'Payment page link') : (fa ? 'لینک را برای مشتری بفرستید' : 'Send this link to the customer')}</span>
								<div className="flex items-center gap-2 rounded-control border-[1.5px] border-[var(--border-default)] bg-[var(--bg-surface)] p-2 ps-3">
									<span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[12.5px] sm:text-[13px]">{made.url}</span>
									<CopyButton value={made.url} label={fa ? 'کپی لینک' : 'Copy link'} copiedLabel={fa ? 'کپی شد' : 'Copied'} showLabel />
								</div>
							</div>
							{typeof navigator !== 'undefined' && 'share' in navigator ? (
								<Button variant="outline" size="sm" className="w-fit" onClick={share}><Share2 className="size-4" aria-hidden />{fa ? 'اشتراک‌گذاری' : 'Share'}</Button>
							) : null}
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
							<div className="grid gap-1.5">
								<span className="ui-field-label">{fa ? 'به چه کسی؟' : 'For whom?'}</span>
								<div role="radiogroup" aria-label={fa ? 'به چه کسی؟' : 'For whom?'} className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--bg-muted)] p-1">
									{([['link', Link2, fa ? 'فقط لینک بساز' : 'Just a link'], ['chat', MessageSquareText, fa ? 'بفرست برای مشتری' : 'Send to a customer']] as const).map(([key, Icon, label]) => (
										<button key={key} type="button" role="radio" aria-checked={target === key} disabled={locked !== null} onClick={() => { setTarget(key); setError(null) }} className={cn('inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl text-[13px] transition-colors', target === key ? 'bg-white font-bold text-[var(--text-primary)] shadow-[0_1px_2px_rgba(17,17,17,.1)] dark:bg-neutral-800' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')}>
											<Icon className="size-4" aria-hidden />{label}
										</button>
									))}
								</div>
								{target === 'chat' ? (
									<>
										<RecipientPicker value={recipient} onChange={setRecipient} fa={fa} />
										<span className="ui-field-hint">{fa ? 'کارت پرداخت در همان گفتگو (اینستاگرام، تلگرام، بله، ویجت…) فرستاده می‌شود و با واریز، خودکار به مشتری خبر می‌دهیم.' : 'The payment card goes into that conversation, and the customer hears automatically when it lands.'}</span>
									</>
								) : <span className="ui-field-hint">{fa ? 'برای سفارش تلفنی یا مشتری بیرون از گفتگو؛ لینک را خودتان می‌فرستید.' : 'For a phone order or a customer outside a chat; you send the link.'}</span>}
							</div>
							<div className="grid gap-1.5">
								<span className="ui-field-label">{fa ? 'اقلام' : 'Items'} <span className="font-normal text-[var(--text-muted)]">{fa ? '(اختیاری)' : '(optional)'}</span></span>
								<ItemsEditor items={items} onChange={changeItems} fa={fa} disabled={locked !== null} />
							</div>
							<AmountField
								id="pay-link-amount"
								value={amount}
								onChange={(next) => { setAmount(next); setAmountTouched(Boolean(next)) }}
								fa={fa}
								disabled={locked !== null}
								hint={total ? (amountTouched && value !== total ? (fa ? `جمع اقلام ${total.toLocaleString(numbers)} تومان است.` : `The items add up to ${total.toLocaleString(numbers)}.`) : (fa ? 'از جمع اقلام پر شد؛ می‌توانید عوضش کنید.' : 'Filled from the items; you can change it.')) : null}
							/>
							<label className="block">
								<span className="ui-field-label">{fa ? 'بابت (اختیاری)' : 'For (optional)'}</span>
								<input id="pay-link-description" className="input mt-1.5" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} placeholder={fa ? 'مثلاً: کفش کتانی سایز ۴۰' : 'e.g. Sneakers, size 40'} disabled={locked !== null} />
								<span className="ui-field-hint">{fa ? 'مشتری همین را در صفحهٔ پرداخت می‌بیند.' : 'The customer sees this on the payment page.'}</span>
							</label>
							{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
						</form>
					)}
				</SideSheet>
			)}
		</>
	)
}
