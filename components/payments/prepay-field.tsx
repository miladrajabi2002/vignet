'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { WalletCards } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NumberField } from '@/components/admin/number-field'
import { describePrepay, PREPAY_MODES, type PrepayMode } from '@/lib/payments/card/prepay'

type GatewayState = { ready: boolean; reason: string | null; phoneConnected: boolean; ttlMinutes: number | null }

const MODE_LABEL: Record<PrepayMode, { fa: string; en: string }> = {
	NONE: { fa: 'بدون پیش‌پرداخت', en: 'None' },
	FIXED: { fa: 'مبلغ ثابت', en: 'Fixed amount' },
	PERCENT: { fa: 'درصدی از قیمت', en: 'Share of price' },
	FULL: { fa: 'کل مبلغ', en: 'Full price' },
}

/**
 * «پیش‌پرداخت با درگاه» for a bookable service or a course: the customer
 * transfers it card-to-card in the chat and the booking/seat is confirmed
 * automatically from the deposit SMS. Shared by the service and course editors.
 */
export function PrepayField({
	mode,
	value,
	price,
	onChange,
	lang,
	kind,
}: {
	mode: PrepayMode
	/** Tomans for FIXED, 1…100 for PERCENT. */
	value: string
	/** The item's price in tomans, '' when unset. */
	price: string
	onChange: (next: { mode: PrepayMode; value: string }) => void
	lang: 'fa' | 'en'
	kind: 'booking' | 'course'
}) {
	const fa = lang !== 'en'
	const [gateway, setGateway] = useState<GatewayState | null>(null)
	useEffect(() => {
		let alive = true
		fetch('/api/payments/settings', { cache: 'no-store' })
			.then((response) => (response.ok ? response.json() : null))
			.then((data) => { if (alive && data) setGateway(data as GatewayState) })
			.catch(() => {})
		return () => { alive = false }
	}, [])

	const numericPrice = price ? Number(price) : null
	const numericValue = value ? Number(value) : null
	const active = mode !== 'NONE'
	const hint = describePrepay(mode, numericValue, numericPrice, lang)
	const notReady = active && gateway && !gateway.ready

	return (
		<div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
			<div className="flex items-start gap-2.5">
				<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft,rgba(124,58,237,.1))] text-[var(--accent,#7c3aed)]"><WalletCards className="size-4.5" aria-hidden /></span>
				<div className="min-w-0">
					<p className="text-sm font-bold text-[var(--text-primary)]">{fa ? 'پیش‌پرداخت با درگاه پرداخت' : 'Advance payment via the gateway'}</p>
					<p className="text-[12.5px] leading-6 text-[var(--text-secondary)]">
						{kind === 'booking'
							? (fa ? 'ایجنت بعد از ثبت نوبت، کارت و مبلغ دقیق را در همان گفتگو می‌فرستد. نوبت تا رسیدن واریز نگه داشته می‌شود و خودکار قطعی می‌شود.' : 'After booking, the agent sends the card and exact amount in the chat. The time is held until the transfer arrives, then confirmed automatically.')
							: (fa ? 'ایجنت بعد از ثبت‌نام، کارت و مبلغ دقیق را در همان گفتگو می‌فرستد. جا تا رسیدن واریز نگه داشته می‌شود و خودکار قطعی می‌شود.' : 'After sign-up, the agent sends the card and exact amount in the chat. The seat is held until the transfer arrives, then confirmed automatically.')}
					</p>
				</div>
			</div>
			<div role="radiogroup" aria-label={fa ? 'نوع پیش‌پرداخت' : 'Advance payment type'} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
				{PREPAY_MODES.map((key) => (
					<button
						key={key}
						type="button"
						role="radio"
						aria-checked={mode === key}
						onClick={() => onChange({ mode: key, value: key === mode ? value : key === 'PERCENT' ? '30' : key === 'FIXED' ? value : '' })}
						className={cn(
							'min-h-10 rounded-xl border px-2 text-[13px] font-semibold transition',
							mode === key
								? 'border-[var(--accent,#7c3aed)] bg-[var(--accent-soft,rgba(124,58,237,.08))] text-[var(--text-primary)]'
								: 'border-[var(--border-subtle)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-default)] dark:bg-transparent',
						)}
					>
						{fa ? MODE_LABEL[key].fa : MODE_LABEL[key].en}
					</button>
				))}
			</div>
			{mode === 'FIXED' ? (
				<NumberField
					value={value}
					onChange={(raw) => onChange({ mode, value: raw.slice(0, 10) })}
					unit={fa ? 'تومان' : 'Toman'}
					persian={fa}
					className="min-h-11"
					placeholder={fa ? 'مثلاً ۲۰۰٬۰۰۰' : 'e.g. 200,000'}
					ariaLabel={fa ? 'مبلغ پیش‌پرداخت به تومان' : 'Advance payment in Toman'}
				/>
			) : null}
			{mode === 'PERCENT' ? (
				<div className="flex flex-wrap gap-1.5">
					{['10', '20', '30', '50'].map((option) => (
						<button key={option} type="button" onClick={() => onChange({ mode, value: option })} aria-pressed={value === option} className={cn('min-h-9 rounded-full border px-3.5 text-[13px] font-semibold tabular-nums', value === option ? 'border-[var(--accent,#7c3aed)] bg-[var(--accent-soft,rgba(124,58,237,.08))]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)]')}>
							{fa ? `${Number(option).toLocaleString('fa-IR')}٪` : `${option}%`}
						</button>
					))}
					<NumberField value={value} onChange={(raw) => onChange({ mode, value: String(Math.min(100, Number(raw || 0)) || '') })} unit="٪" persian={fa} className="min-h-9 w-28" ariaLabel={fa ? 'درصد پیش‌پرداخت' : 'Advance payment percent'} />
				</div>
			) : null}
			<p className={cn('text-[12.5px] leading-6', active ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary,var(--text-secondary))]')}>{hint}</p>
			{notReady ? (
				<p className="rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] leading-6 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
					{fa ? 'درگاه پرداخت هنوز آماده نیست؛ تا وقتی روشن نشود، ' : 'The payment gateway is not ready; until it is, '}
					{kind === 'booking' ? (fa ? 'نوبت‌ها مثل قبل بدون پیش‌پرداخت ثبت می‌شوند.' : 'bookings are made without payment as before.') : (fa ? 'ثبت‌نام‌ها مثل قبل منتظر تأیید شما می‌مانند.' : 'sign-ups wait for your confirmation as before.')}{' '}
					<Link href="/payments" className="font-bold underline underline-offset-4">{fa ? 'راه‌اندازی درگاه' : 'Set up the gateway'}</Link>
				</p>
			) : null}
		</div>
	)
}
