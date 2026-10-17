'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { CreditCard, Eye, MessageSquareText, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SideSheet } from '@/components/ui/side-sheet'
import { Switch } from '@/components/ui/switch'
import { StatusChip } from '@/components/ui/status-chip'
import { BankCardFace, BankMark } from '@/components/payments/bank-card'
import { formatPan, inspectCard } from '@/lib/payments/card/bins'
import { toEnglishDigits } from '@/lib/phone'
import type { GatewayCardRow } from '@/lib/payments/card/dashboard'

function masked(card: Pick<GatewayCardRow, 'bin' | 'last4'>): string {
	return `${card.bin.slice(0, 4)} ${card.bin.slice(4)}•• •••• ${card.last4}`
}

/**
 * Destination cards: add one (the bank is recognised while typing), switch
 * it off, remove it. With no card yet (the setup) the form is on the page;
 * after that «افزودن کارت» opens it in a side drawer (a bottom sheet on phones).
 */
export function CardsManager({ cards, embedded = false }: { cards: GatewayCardRow[]; embedded?: boolean }) {
	const fa = useLocale() !== 'en'
	const numbers = fa ? 'fa-IR' : 'en-US'
	const router = useRouter()
	const [pan, setPan] = useState('')
	const [holder, setHolder] = useState('')
	const [adding, setAdding] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState<string | null>(null)
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
	const [open, setOpen] = useState(false)

	const info = inspectCard(pan)
	const hint: Record<typeof info.state, { tone: 'ok' | 'warn' | 'danger' | 'neutral'; text: string }> = {
		empty: { tone: 'neutral', text: fa ? 'شماره ۱۶ رقمی روی کارت' : 'The 16 digits on the card' },
		typing: { tone: 'neutral', text: info.bank ? `${fa ? info.bank.fa : info.bank.en} · ${(16 - info.digits.length).toLocaleString(numbers)} ${fa ? 'رقم مانده' : 'digits left'}` : `${Math.max(0, 16 - info.digits.length).toLocaleString(numbers)} ${fa ? 'رقم مانده' : 'digits left'}` },
		invalid: { tone: 'danger', text: fa ? 'شماره کارت درست نیست؛ یک رقم جابه‌جا تایپ شده.' : 'This card number is not valid; a digit is mistyped.' },
		'unknown-bank': { tone: 'warn', text: fa ? 'شماره درست است ولی بانکش را نمی‌شناسیم؛ اضافه می‌شود.' : 'The number is valid but the bank is unknown; it will still be added.' },
		ok: { tone: 'ok', text: info.bank ? (fa ? info.bank.fa : info.bank.en) : '' },
	}
	const canAdd = (info.state === 'ok' || info.state === 'unknown-bank') && holder.trim().length >= 2

	function close() {
		setOpen(false)
		setError(null)
	}

	async function add(event: React.FormEvent) {
		event.preventDefault()
		if (!canAdd) return
		setAdding(true)
		setError(null)
		try {
			const response = await fetch('/api/payments/cards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pan: info.digits, holderName: holder.trim() }) })
			const data = (await response.json().catch(() => null)) as { error?: string } | null
			if (!response.ok) {
				setError(data?.error === 'DUPLICATE_CARD' ? (fa ? 'این کارت قبلاً اضافه شده است.' : 'This card is already added.') : (fa ? 'کارت اضافه نشد؛ شماره را بررسی کنید.' : 'The card was not added; check the number.'))
				return
			}
			setPan('')
			setHolder('')
			setOpen(false)
			router.refresh()
		} catch {
			setError(fa ? 'کارت اضافه نشد؛ اینترنت را چک کنید.' : 'The card was not added; check the connection.')
		} finally {
			setAdding(false)
		}
	}

	async function update(id: string, body: Record<string, unknown>, method: 'PATCH' | 'DELETE' = 'PATCH') {
		setBusy(id)
		try {
			await fetch(`/api/payments/cards/${id}`, { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'PATCH' ? { body: JSON.stringify(body) } : {}) })
			router.refresh()
		} finally {
			setBusy(null)
			setConfirmDelete(null)
		}
	}
	const deleting = cards.find((card) => card.id === confirmDelete) ?? null

	// The card as the customer will see it, filled in while typing.
	const preview = <BankCardFace bankKey={info.bank?.key ?? 'unknown'} pan={info.digits.length === 16 ? info.digits : (formatPan(info.digits) || '•••• •••• •••• ••••')} holder={holder.trim() || (fa ? 'نام صاحب کارت' : 'Cardholder name')} lang={fa ? 'fa' : 'en'} />
	const promises = [
		{ icon: ShieldCheck, text: fa ? 'فقط شماره و نام؛ رمز، CVV2 و تاریخ انقضا هیچ‌وقت لازم نیست.' : 'Only the number and name; never a PIN, CVV2 or expiry date.' },
		{ icon: Eye, text: fa ? 'مشتری کارت را فقط بعد از تأیید سفارش و همراه مبلغ دقیق می‌بیند.' : 'A customer sees the card only after an order is confirmed, with the exact amount.' },
		{ icon: MessageSquareText, text: fa ? 'پیامک واریز همین کارت، پرداخت را خودکار تأیید می‌کند.' : 'This card’s deposit SMS confirms the payment automatically.' },
	].map((row) => (
		<li key={row.text} className="flex items-start gap-2.5">
			<row.icon className="mt-1 size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
			<span>{row.text}</span>
		</li>
	))
	const fields = (
		<>
			<label className="block">
				<span className="ui-field-label">{fa ? 'شماره کارت' : 'Card number'}</span>
				<input id="pay-card-pan" data-sheet-initial-focus dir="ltr" inputMode="numeric" autoComplete="off" className="input mt-1.5 font-mono tracking-wider" placeholder="6037 9975 0000 0000" value={pan} onChange={(event) => setPan(formatPan(toEnglishDigits(event.target.value).replace(/\D/g, '').slice(0, 16)))} />
				<span className="mt-1.5 flex items-center gap-2">
					{info.bank && info.state !== 'empty' ? <BankMark bankKey={info.bank.key} size={20} /> : null}
					<StatusChip tone={hint[info.state].tone}>{hint[info.state].text}</StatusChip>
				</span>
			</label>
			<label className="block">
				<span className="ui-field-label">{fa ? 'نام صاحب کارت' : 'Cardholder name'}</span>
				<input id="pay-card-holder" className="input mt-1.5" value={holder} onChange={(event) => setHolder(event.target.value)} maxLength={80} placeholder={fa ? 'همان‌طور که روی کارت نوشته شده' : 'As written on the card'} />
				<span className="ui-field-hint">{fa ? 'مشتری پیش از واریز همین نام را در همراه‌بانک خودش می‌بیند.' : 'The customer sees this name in their own bank app before transferring.'}</span>
			</label>
			{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
		</>
	)

	if (cards.length === 0) {
		return (
			<form onSubmit={add} className={embedded ? 'overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white dark:bg-neutral-900' : 'spatial-surface overflow-hidden rounded-card'}>
				<div className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
					<span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><CreditCard className="size-[18px]" /></span>
					<div className="min-w-0">
						<h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'کارت مقصد' : 'Destination card'}</h2>
						<p className="text-[13px] leading-6 text-[var(--text-secondary)]">{fa ? 'کارتی را بدهید که پیامک واریزش به گوشی خودتان می‌آید.' : 'Use a card whose deposit SMS comes to your own phone.'}</p>
					</div>
				</div>
				<div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)] lg:gap-8">
					<div className="mx-auto grid w-full max-w-[23rem] content-start gap-3 lg:mx-0">
						{preview}
						<ul className="hidden gap-2.5 rounded-2xl bg-[var(--bg-surface)] p-3.5 text-[12.5px] leading-6 text-[var(--text-secondary)] lg:grid">{promises}</ul>
					</div>
					<div className="grid content-start gap-4">
						{fields}
						<div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
							<Button type="submit" loading={adding} disabled={!canAdd}><Plus className="size-4" aria-hidden />{fa ? 'افزودن کارت' : 'Add card'}</Button>
							<span className="ms-auto inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] lg:hidden"><ShieldCheck className="size-3.5" aria-hidden />{fa ? 'رمز و CVV2 لازم نیست' : 'No PIN or CVV2 needed'}</span>
						</div>
					</div>
				</div>
			</form>
		)
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0">
					<h2 className="text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'کارت‌های مقصد' : 'Destination cards'}</h2>
					<p className="text-[12.5px] text-[var(--text-muted)]">{fa ? `${cards.filter((card) => card.active).length.toLocaleString(numbers)} کارت فعال از ${cards.length.toLocaleString(numbers)}` : `${cards.filter((card) => card.active).length} of ${cards.length} active`}</p>
				</div>
				<Button onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden />{fa ? 'افزودن کارت' : 'Add a card'}</Button>
			</div>

			<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{cards.map((card) => (
					<li key={card.id} className="spatial-surface flex flex-col gap-3 rounded-card p-3.5">
						<BankCardFace bankKey={card.bankKey} pan={masked(card)} holder={card.holderName} lang={fa ? 'fa' : 'en'} muted={!card.active} />
						<div className="flex items-center justify-between gap-3">
							<div className="min-w-0">
								<p className="text-sm font-medium text-[var(--text-primary)]">{fa ? 'امروز' : 'Today'} {card.receivedToday.toLocaleString(numbers)} {fa ? 'تومان' : 'Toman'}</p>
								{card.verified ? null : <p className="mt-0.5 text-xs text-[var(--text-muted)]">{fa ? 'هنوز واریزی روی این کارت تطبیق نخورده' : 'No deposit has matched on this card yet'}</p>}
							</div>
							<Switch checked={card.active} pending={busy === card.id} disabled={busy !== null} onChange={(active) => update(card.id, { active })} aria-label={fa ? 'فعال بودن کارت' : 'Card active'} />
						</div>
						{/* The same delete as everywhere else: a quiet bordered button and one confirmation. */}
						<button
							type="button"
							onClick={() => setConfirmDelete(card.id)}
							className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] px-4 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:border-danger hover:bg-red-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
						>
							<Trash2 className="size-4" aria-hidden />{fa ? 'حذف کارت' : 'Remove card'}
						</button>
					</li>
				))}
			</ul>

			<ConfirmDialog
				open={deleting != null}
				title={fa ? 'این کارت حذف شود؟' : 'Remove this card?'}
				description={deleting ? (fa ? `کارت ${deleting.bin.slice(0, 4)}…${deleting.last4} دیگر به مشتری‌ها نشان داده نمی‌شود. پرداخت‌های قبلی‌اش در فهرست می‌مانند.` : `Card ${deleting.bin.slice(0, 4)}…${deleting.last4} is no longer shown to customers. Its past payments stay in the list.`) : undefined}
				confirmLabel={busy ? (fa ? 'در حال حذف…' : 'Removing…') : (fa ? 'حذف کارت' : 'Remove card')}
				cancelLabel={fa ? 'انصراف' : 'Keep it'}
				tone="danger"
				busy={busy != null}
				onConfirm={() => { if (deleting) void update(deleting.id, {}, 'DELETE') }}
				onClose={() => { if (!busy) setConfirmDelete(null) }}
			/>

			{open && (
				<SideSheet
					title={fa ? 'کارت تازه' : 'New card'}
					subtitle={fa ? 'کارتی که پیامک واریزش به گوشی خودتان می‌آید' : 'A card whose deposit SMS comes to your own phone'}
					onClose={close}
					closeLabel={fa ? 'بستن' : 'Close'}
					className="md:w-[min(30rem,calc(100vw-1.5rem))]"
					icon={<span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><CreditCard className="size-5" /></span>}
					footer={(
						<div className="flex flex-wrap items-center gap-2">
							<Button type="submit" form="pay-card-new" loading={adding} disabled={!canAdd}><Plus className="size-4" aria-hidden />{fa ? 'افزودن کارت' : 'Add card'}</Button>
							<Button variant="ghost" onClick={close}>{fa ? 'انصراف' : 'Cancel'}</Button>
						</div>
					)}
				>
					<form id="pay-card-new" onSubmit={add} className="grid gap-5">
						<div className="mx-auto w-full max-w-[22rem]">{preview}</div>
						{fields}
						<ul className="grid gap-2.5 rounded-2xl bg-[var(--bg-surface)] p-3.5 text-[12.5px] leading-6 text-[var(--text-secondary)]">{promises}</ul>
					</form>
				</SideSheet>
			)}
		</div>
	)
}
