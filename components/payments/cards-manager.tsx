'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { BadgeCheck, CreditCard, Eye, MessageSquareText, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { StatusChip } from '@/components/ui/status-chip'
import { BankCardFace, BankMark } from '@/components/payments/bank-card'
import { formatPan, inspectCard } from '@/lib/payments/card/bins'
import { toEnglishDigits } from '@/lib/phone'
import type { GatewayCardRow } from '@/lib/payments/card/dashboard'

function masked(card: Pick<GatewayCardRow, 'bin' | 'last4'>): string {
	return `${card.bin.slice(0, 4)} ${card.bin.slice(4)}•• •••• ${card.last4}`
}

/** Destination cards: add one (the bank is recognised while typing), switch it off, cap it, remove it. */
export function CardsManager({ cards }: { cards: GatewayCardRow[] }) {
	const fa = useLocale() !== 'en'
	const numbers = fa ? 'fa-IR' : 'en-US'
	const router = useRouter()
	const [pan, setPan] = useState('')
	const [holder, setHolder] = useState('')
	const [adding, setAdding] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState<string | null>(null)
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
	const [open, setOpen] = useState(cards.length === 0)

	const info = inspectCard(pan)
	const hint: Record<typeof info.state, { tone: 'ok' | 'warn' | 'danger' | 'neutral'; text: string }> = {
		empty: { tone: 'neutral', text: fa ? 'شماره ۱۶ رقمی روی کارت' : 'The 16 digits on the card' },
		typing: { tone: 'neutral', text: info.bank ? `${fa ? info.bank.fa : info.bank.en} · ${(16 - info.digits.length).toLocaleString(numbers)} ${fa ? 'رقم مانده' : 'digits left'}` : `${Math.max(0, 16 - info.digits.length).toLocaleString(numbers)} ${fa ? 'رقم مانده' : 'digits left'}` },
		invalid: { tone: 'danger', text: fa ? 'شماره کارت درست نیست؛ یک رقم جابه‌جا تایپ شده.' : 'This card number is not valid; a digit is mistyped.' },
		'unknown-bank': { tone: 'warn', text: fa ? 'شماره درست است ولی بانکش را نمی‌شناسیم؛ اضافه می‌شود.' : 'The number is valid but the bank is unknown; it will still be added.' },
		ok: { tone: 'ok', text: info.bank ? (fa ? info.bank.fa : info.bank.en) : '' },
	}
	const canAdd = (info.state === 'ok' || info.state === 'unknown-bank') && holder.trim().length >= 2

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

	return (
		<div className="space-y-4">
			{cards.length > 0 && (
				<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{cards.map((card) => (
						<li key={card.id} className="spatial-surface flex flex-col gap-3 rounded-card p-3.5">
							<BankCardFace bankKey={card.bankKey} pan={masked(card)} holder={card.holderName} lang={fa ? 'fa' : 'en'} muted={!card.active} />
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="text-sm font-medium text-[var(--text-primary)]">{fa ? 'امروز' : 'Today'} {card.receivedToday.toLocaleString(numbers)} {fa ? 'تومان' : 'Toman'}</p>
									<p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
										{card.verified
											? <span className="inline-flex items-center gap-1 text-emerald-700"><BadgeCheck className="size-3.5" aria-hidden />{fa ? 'با واریز واقعی تأیید شده' : 'Verified by a real deposit'}</span>
											: (fa ? 'هنوز واریزی روی این کارت تطبیق نخورده' : 'No deposit has matched on this card yet')}
									</p>
								</div>
								<Switch checked={card.active} pending={busy === card.id} disabled={busy !== null} onChange={(active) => update(card.id, { active })} aria-label={fa ? 'فعال بودن کارت' : 'Card active'} />
							</div>
							<DailyCap card={card} fa={fa} disabled={busy !== null} onSave={(dailyCap) => update(card.id, { dailyCap })} />
							{confirmDelete === card.id ? (
								<div className="flex flex-wrap items-center gap-2 rounded-control bg-red-50 p-2.5 text-[13px] text-red-800">
									<span className="min-w-0 flex-1">{fa ? 'این کارت حذف شود؟ پرداخت‌های قبلی‌اش می‌مانند.' : 'Remove this card? Its past payments stay.'}</span>
									<Button size="sm" variant="danger" loading={busy === card.id} onClick={() => update(card.id, {}, 'DELETE')}>{fa ? 'حذف' : 'Remove'}</Button>
									<Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>{fa ? 'انصراف' : 'Keep'}</Button>
								</div>
							) : (
								<button type="button" onClick={() => setConfirmDelete(card.id)} className="inline-flex w-fit items-center gap-1.5 text-[13px] text-[var(--text-muted)] hover:text-red-600">
									<Trash2 className="size-3.5" aria-hidden />{fa ? 'حذف کارت' : 'Remove card'}
								</button>
							)}
						</li>
					))}
				</ul>
			)}

			{!open ? (
				<Button variant="outline" onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden />{fa ? 'افزودن کارت' : 'Add a card'}</Button>
			) : (
				<form onSubmit={add} className="spatial-surface overflow-hidden rounded-card">
					<div className="flex items-start gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
						<span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1eeff] text-[#5b3de8] dark:bg-[#5b3de8]/20 dark:text-[#b9adff]"><CreditCard className="size-[18px]" /></span>
						<div className="min-w-0">
							<h2 className="text-[15px] font-bold text-[var(--text-primary)]">{cards.length ? (fa ? 'کارت تازه' : 'New card') : (fa ? 'کارت مقصد' : 'Destination card')}</h2>
							<p className="text-[13px] leading-6 text-[var(--text-secondary)]">{fa ? 'کارتی را بدهید که پیامک واریزش به گوشی خودتان می‌آید.' : 'Use a card whose deposit SMS comes to your own phone.'}</p>
						</div>
					</div>
					<div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:gap-7">
						{/* The card as the customer will see it, and what is (and is not) asked. */}
						<div className="mx-auto grid w-full max-w-[19rem] content-start gap-3">
							<BankCardFace bankKey={info.bank?.key ?? 'unknown'} pan={info.digits.length === 16 ? info.digits : (formatPan(info.digits) || '•••• •••• •••• ••••')} holder={holder.trim() || (fa ? 'نام صاحب کارت' : 'Cardholder name')} lang={fa ? 'fa' : 'en'} />
							<ul className="hidden gap-2.5 rounded-2xl bg-[var(--bg-surface)] p-3.5 text-[12.5px] leading-6 text-[var(--text-secondary)] md:grid">
								{[
									{ icon: ShieldCheck, text: fa ? 'فقط شماره و نام؛ رمز، CVV2 و تاریخ انقضا هیچ‌وقت لازم نیست.' : 'Only the number and name; never a PIN, CVV2 or expiry date.' },
									{ icon: Eye, text: fa ? 'مشتری کارت را فقط بعد از تأیید سفارش و همراه مبلغ دقیق می‌بیند.' : 'A customer sees the card only after an order is confirmed, with the exact amount.' },
									{ icon: MessageSquareText, text: fa ? 'پیامک واریز همین کارت، پرداخت را خودکار تأیید می‌کند.' : 'This card’s deposit SMS confirms the payment automatically.' },
								].map((row) => (
									<li key={row.text} className="flex items-start gap-2.5">
										<row.icon className="mt-1 size-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
										<span>{row.text}</span>
									</li>
								))}
							</ul>
						</div>
						<div className="grid content-start gap-4">
							<label className="block">
								<span className="ui-field-label">{fa ? 'شماره کارت' : 'Card number'}</span>
								<input id="pay-card-pan" dir="ltr" inputMode="numeric" autoComplete="off" className="input mt-1.5 font-mono tracking-wider" placeholder="6037 9975 0000 0000" value={pan} onChange={(event) => setPan(formatPan(toEnglishDigits(event.target.value).replace(/\D/g, '').slice(0, 16)))} />
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
							<div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4">
								<Button type="submit" loading={adding} disabled={!canAdd}><Plus className="size-4" aria-hidden />{fa ? 'افزودن کارت' : 'Add card'}</Button>
								{cards.length > 0 && <Button variant="ghost" onClick={() => setOpen(false)}>{fa ? 'انصراف' : 'Cancel'}</Button>}
								<span className="ms-auto inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] md:hidden"><ShieldCheck className="size-3.5" aria-hidden />{fa ? 'رمز و CVV2 لازم نیست' : 'No PIN or CVV2 needed'}</span>
							</div>
						</div>
					</div>
				</form>
			)}
		</div>
	)
}

function DailyCap({ card, fa, disabled, onSave }: { card: GatewayCardRow; fa: boolean; disabled: boolean; onSave: (value: number | null) => void }) {
	const [value, setValue] = useState(card.dailyCap != null ? card.dailyCap.toLocaleString('en-US') : '')
	const parsed = Number(value.replace(/\D/g, '')) || null
	const changed = parsed !== card.dailyCap
	return (
		<label className="block">
			<span className="ui-field-label">{fa ? 'سقف دریافت روزانهٔ این کارت (تومان)' : 'Daily receiving cap of this card (Toman)'}</span>
			<span className="mt-1.5 flex gap-2">
				<input dir="ltr" inputMode="numeric" className="input min-w-0 flex-1 font-mono" placeholder={fa ? 'بدون سقف' : 'No cap'} value={value} onChange={(event) => setValue(toEnglishDigits(event.target.value).replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','))} aria-label={fa ? 'سقف روزانه' : 'Daily cap'} />
				{changed && <Button size="sm" variant="outline" disabled={disabled} onClick={() => onSave(parsed)}>{fa ? 'ذخیره' : 'Save'}</Button>}
			</span>
			<span className="ui-field-hint">{fa ? 'وقتی به این مبلغ برسد، پرداخت‌های بعدی به کارت دیگر شما می‌رود.' : 'Once reached, new payments go to your other card.'}</span>
		</label>
	)
}
