'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, BadgeCheck, Check, CircleHelp, Clock3, CreditCard, ShieldCheck, XCircle } from 'lucide-react'
import { BankCardFace } from '@/components/payments/bank-card'
import { copyText, PendingPulse, useCardPayStatus } from '@/components/commerce/card-pay-view'
import { groupDigits } from '@/lib/payments/card/amount'
import { formatPan } from '@/lib/payments/card/bins'
import type { PayItem } from '@/lib/payments/card/items'
import type { CardPayStatus, CardPayView } from '@/lib/payments/card/pay-card'
import { cn } from '@/lib/utils'

const fa = (value: number) => value.toLocaleString('fa-IR')
const INTRO_KEY = 'vigent:pay-intro:'

/** Seconds left until `expiresAt`, ticking every second while `running`. */
function useSecondsLeft(expiresAt: string, running: boolean): number {
	const read = useCallback(() => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)), [expiresAt])
	const [left, setLeft] = useState(read)
	useEffect(() => {
		setLeft(read())
		if (!running) return
		const timer = window.setInterval(() => setLeft(read()), 1000)
		return () => window.clearInterval(timer)
	}, [read, running])
	return left
}

function clock(seconds: number): string {
	const minutes = Math.floor(seconds / 60)
	return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function CopyRow({ label, value, children }: { label: string; value: string; children: ReactNode }) {
	const [done, setDone] = useState(false)
	return (
		<div className="flex items-center justify-between gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] py-2 pe-2 ps-3.5">
			<span className="min-w-0">
				<span className="block text-[11.5px] leading-5 text-[var(--text-muted)]">{label}</span>
				<span dir="ltr" className="block truncate text-end font-mono text-[16.5px] font-bold tabular-nums text-[var(--text-primary)]">{children}</span>
			</span>
			<button
				type="button"
				onClick={async () => {
					if (await copyText(value)) {
						setDone(true)
						window.setTimeout(() => setDone(false), 1600)
					}
				}}
				className={cn(
					'inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl border px-3.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
					done ? 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'border-[var(--border-default)] bg-white text-[var(--text-primary)] hover:border-[var(--border-hover)] dark:bg-neutral-900',
				)}
			>
				{done ? <><Check className="size-4" aria-hidden />کپی شد</> : 'کپی'}
			</button>
		</div>
	)
}

/** The exact amount with its last three digits, the payment's identifier, set apart. */
function Amount({ value }: { value: number }) {
	const text = groupDigits(value)
	return <>{text.slice(0, -3)}<mark className="rounded-md bg-[var(--tint-violet,#f1eeff)] px-0.5 text-[#4c2fd0] dark:bg-[#5b3de8]/25 dark:text-[#c9bfff]">{text.slice(-3)}</mark></>
}

function TimerRing({ seconds, total }: { seconds: number; total: number }) {
	const share = total > 0 ? Math.min(1, seconds / total) : 0
	const length = 2 * Math.PI * 15
	return (
		<svg viewBox="0 0 36 36" className="size-10 shrink-0 -rotate-90" aria-hidden>
			<circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity=".18" strokeWidth="3.5" />
			<circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - share)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
		</svg>
	)
}

function Steps({ amount }: { amount: number }) {
	const last = groupDigits(amount).slice(-3)
	return (
		<ol className="grid gap-2.5">
			{[
				<><b className="font-bold text-[var(--text-primary)]">شماره کارت و مبلغ را کپی کنید.</b> سه رقم آخر مبلغ (<span dir="ltr" className="font-mono">{last}</span>) پرداخت شما را شناسایی می‌کند.</>,
				<>در همراه‌بانک یا اپ پرداخت خودتان کارت‌به‌کارت کنید؛ <b className="font-bold text-[var(--text-primary)]">دقیقاً همین مبلغ</b>، بدون رُند کردن.</>,
				<>این صفحه را باز بگذارید؛ با رسیدن واریز، خودش تأیید می‌شود.</>,
			].map((text, index) => (
				<li key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2.5 text-[13px] leading-7 text-[var(--text-secondary)]">
					<span className="mt-0.5 grid size-6 place-items-center rounded-full bg-[var(--text-primary)] text-[11.5px] font-bold text-[var(--bg-base)]">{fa(index + 1)}</span>
					<span>{text}</span>
				</li>
			))}
		</ol>
	)
}

/** First look at the page: what card-to-card means here and the one rule that matters. */
function IntroDialog({ amount, onClose }: { amount: number; onClose: () => void }) {
	const button = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		button.current?.focus()
		const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	}, [onClose])
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
			<div role="dialog" aria-modal="true" aria-labelledby="pay-intro-title" onClick={(event) => event.stopPropagation()} className="grid w-full gap-4 rounded-t-[28px] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-2xl sm:max-w-[440px] sm:rounded-[28px] sm:p-6 dark:bg-neutral-900">
				<span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-[var(--border-strong)] sm:hidden" />
				<div className="flex items-center gap-3">
					<span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-[var(--bg-base)]"><CreditCard className="size-5" aria-hidden /></span>
					<div>
						<h2 id="pay-intro-title" className="text-[17px] font-extrabold leading-7 text-[var(--text-primary)]">پرداخت کارت‌به‌کارت</h2>
						<p className="text-[12.5px] text-[var(--text-muted)]">حدود یک دقیقه، با همراه‌بانک خودتان</p>
					</div>
				</div>
				<p className="text-[13.5px] leading-7 text-[var(--text-secondary)]">در این درگاه اطلاعات کارت شما گرفته نمی‌شود. خودتان از همراه‌بانک به کارت فروشنده واریز می‌کنید و ویجنت واریز را از روی پیامک بانک، خودکار تأیید می‌کند.</p>
				<Steps amount={amount} />
				<div role="alert" className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] leading-7 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
					<AlertTriangle className="mt-1 size-4 shrink-0" aria-hidden />
					<span><b>مبلغ را رُند نکنید.</b> باید دقیقاً <b dir="ltr" className="font-mono">{groupDigits(amount)}</b> تومان واریز شود؛ با مبلغ دیگر، پرداخت خودکار شناخته نمی‌شود.</span>
				</div>
				<button ref={button} type="button" onClick={onClose} className="min-h-12 rounded-2xl bg-[var(--text-primary)] text-[15px] font-extrabold text-[var(--bg-base)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2">متوجه شدم، شروع پرداخت</button>
			</div>
		</div>
	)
}

function Final({ tone, icon, title, children }: { tone: 'ok' | 'muted' | 'bad'; icon: ReactNode; title: string; children: ReactNode }) {
	return (
		<div className="grid justify-items-center gap-3 px-2 py-6 text-center">
			<span className={cn('grid size-16 place-items-center rounded-full', tone === 'ok' ? 'bg-emerald-600 text-white shadow-[0_0_0_10px_rgba(16,185,129,.14)]' : tone === 'bad' ? 'bg-red-50 text-red-600 dark:bg-red-950/50' : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]')}>{icon}</span>
			<h2 className="mt-1 text-[19px] font-extrabold leading-8 text-[var(--text-primary)]">{title}</h2>
			{children}
		</div>
	)
}

export function PayPageClient({
	card,
	business,
	website,
	description,
	baseAmount,
	items,
	paidAt: initialPaidAt,
	createdAt,
	hasReturn,
}: {
	card: CardPayView
	business: string
	website: string | null
	description: string | null
	baseAmount: number
	items: PayItem[]
	paidAt: string | null
	createdAt: string
	hasReturn: boolean
}) {
	const [returning, setReturning] = useState<number | null>(null)
	const [returnUrl, setReturnUrl] = useState<string | null>(null)

	const goBack = useCallback(async () => {
		if (!hasReturn) return
		try {
			const response = await fetch(`/api/pay/status/${card.authority}`, { cache: 'no-store' })
			const data = (await response.json()) as { returnUrl?: string | null }
			if (!data.returnUrl) return
			const target = new URL(data.returnUrl)
			target.searchParams.set('authority', card.authority)
			target.searchParams.set('order_id', card.code)
			target.searchParams.set('status', 'paid')
			setReturnUrl(target.toString())
			setReturning(3)
		} catch { /* the customer stays on the confirmed page */ }
	}, [card.authority, card.code, hasReturn])

	const { status, paidAt, apply } = useCardPayStatus(card.authority, card.status, {
		onChange: (next: CardPayStatus) => { if (next === 'PAID') void goBack() },
	})
	const open = status === 'PENDING' || status === 'CLAIMED'
	const seconds = useSecondsLeft(card.expiresAt, status === 'PENDING')
	const total = Math.max(seconds, Math.round((new Date(card.expiresAt).getTime() - new Date(createdAt).getTime()) / 1000))
	const [intro, setIntro] = useState(false)
	const [claiming, setClaiming] = useState(false)

	useEffect(() => {
		if (card.status !== 'PENDING') return
		try {
			if (!window.sessionStorage.getItem(INTRO_KEY + card.authority)) setIntro(true)
		} catch { setIntro(true) }
	}, [card.authority, card.status])
	const closeIntro = useCallback(() => {
		setIntro(false)
		try { window.sessionStorage.setItem(INTRO_KEY + card.authority, '1') } catch { /* private mode */ }
	}, [card.authority])

	useEffect(() => {
		if (returning == null || !returnUrl) return
		if (returning <= 0) { window.location.assign(returnUrl); return }
		const timer = window.setTimeout(() => setReturning(returning - 1), 1000)
		return () => window.clearTimeout(timer)
	}, [returning, returnUrl])

	async function claim() {
		setClaiming(true)
		try {
			const response = await fetch(`/api/pay/status/${card.authority}`, { method: 'POST' })
			const data = (await response.json().catch(() => null)) as { status?: CardPayStatus } | null
			if (data?.status) apply(data.status)
		} finally {
			setClaiming(false)
		}
	}

	const confirmedAt = paidAt ?? initialPaidAt
	const time = confirmedAt ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(confirmedAt)) : null
	const subject = card.title ?? description
	const initial = business.trim().slice(0, 1) || 'و'
	const timerTone = seconds < 180 ? 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300' : 'text-amber-800 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-200'

	const merchant = (
		<div className="flex min-w-0 items-center gap-3">
			<span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--text-primary)] text-[18px] font-extrabold text-[var(--bg-base)]">{initial}</span>
			<div className="min-w-0">
				<p className="truncate text-[15.5px] font-extrabold leading-7 text-[var(--text-primary)]">{business}</p>
				<p className="flex items-center gap-1 text-[11.5px] font-medium text-emerald-700 dark:text-emerald-300"><BadgeCheck className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{website ? <span dir="ltr">{website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span> : 'فروشندهٔ ثبت‌شده در ویجنت'}</span></p>
			</div>
		</div>
	)

	const live = status === 'CLAIMED' ? (
		<div role="status" aria-live="polite" className="flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-[13px] leading-7 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
			<Clock3 className="mt-1 size-4 shrink-0" aria-hidden />
			<span><b>واریز شما در حال بررسی است.</b> فروشنده حسابش را نگاه می‌کند و همین صفحه نتیجه را نشان می‌دهد.</span>
		</div>
	) : (
		<div role="status" aria-live="polite" className="flex items-center gap-2.5 rounded-2xl bg-[#f1eeff] px-3.5 py-3 text-[13px] font-bold text-[#4c2fd0] dark:bg-[#5b3de8]/20 dark:text-[#c9bfff]">
			<PendingPulse />منتظر واریز شما هستیم… معمولاً کمتر از یک دقیقه بعد از واریز
		</div>
	)

	const claimButton = card.claim && status === 'PENDING' ? (
		<div className="grid gap-1.5">
			<button type="button" disabled={claiming} onClick={claim} className="min-h-12 rounded-2xl bg-[var(--text-primary)] text-[15px] font-extrabold text-[var(--bg-base)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-60">پرداخت کردم</button>
			<p className="text-center text-[12px] leading-6 text-[var(--text-muted)]">اگر واریز کردید ولی چند دقیقه گذشت و تأیید نشد، این دکمه را بزنید تا فروشنده بررسی کند.</p>
		</div>
	) : null

	const final = status === 'PAID' ? (
		<Final tone="ok" icon={<Check className="size-8" strokeWidth={3} aria-hidden />} title="پرداخت شما تأیید شد">
			<p className="text-[14px] text-[var(--text-secondary)]"><b className="text-[18px] tabular-nums text-[var(--text-primary)]">{fa(card.amount)}</b> تومان به {business}</p>
			<dl className="mt-1 grid w-full max-w-xs gap-0 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-[13px]">
				<div className="flex justify-between gap-3 border-b border-dashed border-[var(--border-default)] py-2.5"><dt className="text-[var(--text-muted)]">کد پیگیری</dt><dd dir="ltr" className="font-mono font-bold">{card.code}</dd></div>
				{time ? <div className="flex justify-between gap-3 border-b border-dashed border-[var(--border-default)] py-2.5"><dt className="text-[var(--text-muted)]">زمان تأیید</dt><dd className="font-medium">{time}</dd></div> : null}
				<div className="flex justify-between gap-3 py-2.5"><dt className="text-[var(--text-muted)]">به کارت</dt><dd dir="ltr" className="font-mono font-medium">•••• {card.pan.slice(-4)}</dd></div>
			</dl>
			{returnUrl ? (
				<a href={returnUrl} className="mt-1 inline-flex min-h-11 items-center rounded-2xl bg-[var(--text-primary)] px-5 text-[14px] font-bold text-[var(--bg-base)]">بازگشت به فروشگاه{returning != null && returning > 0 ? ` (${fa(returning)})` : ''}</a>
			) : (
				<p className="text-[12.5px] text-[var(--text-muted)]">فروشنده هم خبردار شد. می‌توانید این صفحه را ببندید.</p>
			)}
		</Final>
	) : status === 'EXPIRED' ? (
		<Final tone="muted" icon={<Clock3 className="size-7" aria-hidden />} title="مهلت پرداخت تمام شد">
			<p className="max-w-sm text-[13.5px] leading-7 text-[var(--text-secondary)]">اگر همین الان واریز کرده‌اید، چند دقیقهٔ دیگر هنوز شناخته و تأیید می‌شود. وگرنه برای پرداخت، از {business} یک لینک تازه بخواهید.</p>
		</Final>
	) : status === 'FAILED' ? (
		<Final tone="bad" icon={<XCircle className="size-7" aria-hidden />} title="واریزی پیدا نشد">
			<p className="max-w-sm text-[13.5px] leading-7 text-[var(--text-secondary)]">فروشنده واریزی با این مبلغ در حسابش پیدا نکرد. اگر واریز کرده‌اید، رسید همراه‌بانک را برای {business} بفرستید.</p>
		</Final>
	) : status === 'CANCELLED' ? (
		<Final tone="muted" icon={<XCircle className="size-7" aria-hidden />} title="این پرداخت لغو شده">
			<p className="max-w-sm text-[13.5px] leading-7 text-[var(--text-secondary)]">لطفاً واریز نکنید. اگر هنوز می‌خواهید خرید کنید، با {business} در تماس باشید.</p>
		</Final>
	) : null

	return (
		<main dir="rtl" lang="fa" className="flex min-h-dvh justify-center bg-[var(--bg-base,#f5f5f3)] text-[var(--text-primary,#111)] md:items-center md:p-6">
			<div className="flex w-full flex-col md:grid md:max-w-[920px] md:grid-cols-[300px_minmax(0,1fr)] md:overflow-hidden md:rounded-[30px] md:border md:border-[var(--border-default)] md:bg-white md:shadow-[0_1px_2px_rgba(17,17,17,.04),0_30px_60px_-30px_rgba(17,17,17,.3)] md:dark:bg-neutral-900">
				{/* Desktop: the order beside the payment, like a bank gateway. */}
				<aside className="hidden flex-col gap-4 border-e border-[var(--border-default)] bg-[var(--bg-surface)] p-6 md:flex">
					{merchant}
					<dl className="grid text-[13px]">
						<div className="flex justify-between gap-3 border-b border-dashed border-[var(--border-default)] py-2.5"><dt className="text-[var(--text-muted)]">شمارهٔ سفارش</dt><dd dir="ltr" className="font-mono font-bold">{card.code}</dd></div>
						{subject ? <div className="flex justify-between gap-3 border-b border-dashed border-[var(--border-default)] py-2.5"><dt className="shrink-0 text-[var(--text-muted)]">بابت</dt><dd className="min-w-0 truncate text-end font-medium" title={subject}>{subject}</dd></div> : null}
						<div className="flex justify-between gap-3 py-2.5"><dt className="text-[var(--text-muted)]">روش پرداخت</dt><dd className="font-medium">کارت‌به‌کارت</dd></div>
					</dl>
					{items.length ? (
						<ul className="grid max-h-40 gap-1.5 overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-white p-3 text-[12.5px] dark:bg-neutral-900">
							{items.map((item, index) => (
								<li key={index} className="flex justify-between gap-2">
									<span className="min-w-0 truncate text-[var(--text-secondary)]">{item.name}{item.quantity > 1 ? ` × ${fa(item.quantity)}` : ''}</span>
									{item.unitPrice != null ? <span className="shrink-0 tabular-nums">{fa(item.unitPrice * item.quantity)}</span> : null}
								</li>
							))}
						</ul>
					) : null}
					<div className="rounded-2xl border border-[var(--border-default)] bg-white p-4 dark:bg-neutral-900">
						<p className="text-[12px] text-[var(--text-muted)]">مبلغ سفارش</p>
						<p className="mt-0.5 text-[24px] font-extrabold tabular-nums">{fa(baseAmount)} <span className="text-[12.5px] font-normal text-[var(--text-muted)]">تومان</span></p>
					</div>
					{status === 'PENDING' ? (
						<div className={cn('mt-auto flex items-center gap-3 rounded-2xl p-3', timerTone)}>
							<TimerRing seconds={seconds} total={total} />
							<div><p className="text-[12px]">مهلت پرداخت</p><p dir="ltr" className="text-end font-mono text-[18px] font-bold leading-6">{clock(seconds)}</p></div>
						</div>
					) : null}
					<p className="mt-auto flex items-center gap-1.5 text-[11.5px] leading-5 text-[var(--text-muted)]"><ShieldCheck className="size-4 shrink-0" aria-hidden />پول مستقیم به حساب فروشنده می‌رود؛ ویجنت فقط واریز را تأیید می‌کند.</p>
				</aside>

				{/* Phones: the seller and the clock on one line. */}
				<header className="flex items-center gap-3 px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))] md:hidden">
					{merchant}
					{status === 'PENDING' ? <span dir="ltr" className={cn('ms-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[13px] font-bold', timerTone)}><Clock3 className="size-3.5" aria-hidden />{clock(seconds)}</span> : null}
				</header>

				<section className="flex flex-1 flex-col gap-3 px-4 pb-4 md:gap-4 md:p-7">
					{open ? (
						<>
							<div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-white px-3.5 py-2.5 md:hidden dark:bg-neutral-900">
								<div className="min-w-0">
									<p className="truncate text-[11.5px] text-[var(--text-muted)]">سفارش <span dir="ltr" className="font-mono">{card.code}</span>{subject ? ` · ${subject}` : ''}</p>
									<p className="text-[17px] font-extrabold tabular-nums">{fa(baseAmount)} <span className="text-[11.5px] font-normal text-[var(--text-muted)]">تومان</span></p>
								</div>
								<button type="button" onClick={() => setIntro(true)} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--border-default)] px-3 text-[12px] font-medium text-[var(--text-secondary)]"><CircleHelp className="size-3.5" aria-hidden />راهنما</button>
							</div>
							<div className="hidden items-center justify-between gap-3 md:flex">
								<h1 className="text-[17px] font-extrabold">کارت‌به‌کارت به این کارت</h1>
								<span className="rounded-full bg-[#f1eeff] px-2.5 py-0.5 text-[12px] font-bold text-[#4c2fd0] dark:bg-[#5b3de8]/20 dark:text-[#c9bfff]">تأیید خودکار</span>
							</div>
							<div className="grid gap-3 md:grid-cols-2 md:gap-6">
								<div className="grid content-start gap-2.5">
									<BankCardFace bankKey={card.bankKey} pan={card.pan} holder={card.holder} lang="fa" className="mx-auto max-w-[330px]" />
									<CopyRow label="شماره کارت" value={card.pan}>{formatPan(card.pan)}</CopyRow>
									<CopyRow label="مبلغ دقیق (تومان) · رُند نکنید" value={String(card.amount)}><Amount value={card.amount} /></CopyRow>
									<p className="px-1 text-[11.5px] text-[var(--text-muted)]">اگر اپ بانک مبلغ را به ریال می‌خواهد: <span dir="ltr" className="font-mono">{groupDigits(card.amount * 10)}</span> ریال</p>
								</div>
								<div className="grid content-start gap-3.5">
									<div className="hidden md:block"><Steps amount={card.amount} /></div>
									{live}
									<div className="hidden md:block">{claimButton}</div>
								</div>
							</div>
						</>
					) : (
						<div className="flex flex-1 items-center justify-center">{final}</div>
					)}
				</section>

				{open && claimButton ? (
					<footer className="sticky bottom-0 bg-gradient-to-t from-[var(--bg-base)] from-70% to-transparent px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:hidden">{claimButton}</footer>
				) : null}
				<p className="flex items-center justify-center gap-1.5 px-4 pb-[max(14px,env(safe-area-inset-bottom))] text-[11.5px] text-[var(--text-muted)] md:hidden"><ShieldCheck className="size-3.5" aria-hidden />پول مستقیم به حساب {business} می‌رود</p>
			</div>
			{intro && open ? <IntroDialog amount={card.amount} onClose={closeIntro} /> : null}
		</main>
	)
}
