'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { BankCardFace } from '@/components/payments/bank-card'
import { bankByKey } from '@/lib/payments/card/bins'
import type { GatewayWeek } from '@/lib/payments/card/dashboard'
import { cn } from '@/lib/utils'

/**
 * The payment gateway's place in the overview flow, once it is live: the
 * active cards stacked right under the agent, what they took in over seven
 * days beside them, and the front card's own week and daily cap next to it.
 * The cards stay still; the card the latest payment reached is in front.
 */
export function GatewayDock({ locale, data, conversations }: { locale: 'fa' | 'en'; data: GatewayWeek; conversations: number }) {
	const fa = locale === 'fa'
	const Arrow = fa ? ArrowLeft : ArrowRight
	const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
	const short = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US', { maximumFractionDigits: 1 })
	const toman = fa ? 'تومان' : 'Toman'
	const million = (value: number) => `${short.format(value / 1_000_000)} ${fa ? 'میلیون' : 'M'}`

	const cards = data.cards
	const recent = data.recent.filter((payment) => cards.some((card) => card.id === payment.cardId))
	const front = Math.max(0, cards.findIndex((card) => card.id === recent[0]?.cardId))

	const root = useRef<HTMLDivElement>(null)
	const [now, setNow] = useState<number | null>(null)
	const [total, setTotal] = useState(data.amount)

	// Times are relative to the viewer's clock, so they appear after hydration.
	useEffect(() => {
		setNow(Date.now())
		const timer = setInterval(() => setNow(Date.now()), 60_000)
		return () => clearInterval(timer)
	}, [])

	useEffect(() => {
		const node = root.current
		if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		let frame = 0
		// The week's total counts up once, the first time it is seen.
		const counter = new IntersectionObserver(([entry]) => {
			if (!entry.isIntersecting || !data.amount) return
			counter.disconnect()
			const start = performance.now()
			const step = (time: number) => {
				const k = Math.min(1, (time - start) / 1300)
				setTotal(Math.round((data.amount * (1 - Math.pow(1 - k, 3))) / 1000) * 1000)
				if (k < 1) frame = requestAnimationFrame(step)
				else setTotal(data.amount)
			}
			setTotal(0)
			frame = requestAnimationFrame(step)
		}, { threshold: 0.3 })
		counter.observe(node)

		return () => {
			cancelAnimationFrame(frame)
			counter.disconnect()
		}
		// The data is server-rendered once per page load.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const showcase = cards[front]
	const top = Math.max(1, ...data.daily)
	const weekday = new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { weekday: 'narrow', timeZone: 'Asia/Tehran' })
	const dayLabel = (index: number) => (index === 6 ? (fa ? 'امروز' : 'Today') : weekday.format(new Date(Date.now() - (6 - index) * 86_400_000)))
	const latest = recent[0]
	const relative = new Intl.RelativeTimeFormat(fa ? 'fa' : 'en', { numeric: 'auto' })
	const ago = (iso: string) => {
		if (now === null) return null
		const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
		if (minutes < 60) return minutes < 1 ? (fa ? 'همین حالا' : 'just now') : relative.format(-minutes, 'minute')
		const hours = Math.round(minutes / 60)
		return hours < 24 ? relative.format(-hours, 'hour') : relative.format(-Math.round(hours / 24), 'day')
	}
	const what = (purpose: string, reference: string) =>
		purpose === 'BOOKING' ? (fa ? 'نوبت' : 'Booking') : purpose === 'COURSE' ? (fa ? 'ثبت‌نام دوره' : 'Course sign-up') : `${fa ? 'سفارش' : 'Order'} ${reference}`

	return (
		<div ref={root} className="gd" dir={fa ? 'rtl' : 'ltr'}>
			<span aria-hidden className="gd-drop hidden sm:block" />

			<div className="gd-grid">
				{/* What the gateway took in over the week. */}
				<div className="gd-stats">
					<span className="text-[12px] text-[var(--text-muted)]">{fa ? 'دریافتی ۷ روز اخیر' : 'Received, last 7 days'}</span>
					<span className="text-[22px] font-bold leading-8 tabular-nums text-[var(--text-primary)]">
						{nf.format(total)} <span className="text-[12px] font-normal text-[var(--text-muted)]">{toman}</span>
					</span>
					{data.paid ? (
						<span className="text-[12px] text-[var(--text-muted)]">
							<b className="font-bold tabular-nums text-[var(--text-primary)]">{nf.format(data.paid)}</b> {fa ? 'پرداخت تأییدشده' : 'confirmed payments'}
							{conversations > 0 ? <> · <b className="font-bold tabular-nums text-[var(--text-primary)]">{short.format((data.paid / conversations) * 100)}{fa ? '٪' : '%'}</b> {fa ? 'گفتگوها' : 'of chats'}</> : null}
						</span>
					) : (
						<span className="text-[12px] leading-6 text-[var(--text-muted)]">{fa ? 'درگاه روشن است؛ اولین پرداخت اینجا می‌نشیند.' : 'The gateway is on; the first payment lands here.'}</span>
					)}
				</div>

				{/* The active cards, the one the latest payment reached in front, its numbers beside it. */}
				<div className="gd-cards">
					{cards.length ? (
						<>
							<CardCaption fa={fa} card={showcase} million={million} />
							<div className="gd-stack">
								{data.review > 0 ? (
									<Link href="/payments" className="gd-badge">{fa ? `${nf.format(data.review)} واریز منتظر تأیید` : `${nf.format(data.review)} to review`}</Link>
								) : null}
								{cards.map((card, index) => {
									const depth = (index - front + cards.length) % cards.length
									return (
										<div
											key={card.id}
											className="gd-card"
											aria-hidden={depth > 0}
											style={{ '--gd-ty': `${-11 * Math.min(depth, 2)}px`, '--gd-sc': 1 - 0.06 * Math.min(depth, 2), zIndex: cards.length - depth, opacity: depth > 2 ? 0 : 1, filter: depth ? 'brightness(.88) saturate(.85)' : undefined } as CSSProperties}
										>
											<div className="overflow-hidden rounded-[20px]">
												<BankCardFace bankKey={card.bankKey} pan={card.pan} holder={card.holder} lang={locale} />
											</div>
										</div>
									)
								})}
							</div>
						</>
					) : (
						<Link href="/payments" className="flex aspect-[1.586] w-full flex-col items-center justify-center gap-1.5 rounded-[20px] border border-dashed border-[var(--signal-border)] bg-[var(--signal-soft)] text-[13px] font-bold text-[var(--signal-strong)]">
							<Plus className="h-5 w-5" />
							{fa ? 'کارت فعالی نیست؛ کارت اضافه کنید' : 'No active card; add one'}
						</Link>
					)}
				</div>

				{/* The week day by day, and the latest payment in words. */}
				<div className="gd-side">
					<div className="gd-bars" role="img" aria-label={fa ? 'دریافتی روزانه در ۷ روز اخیر' : 'Received per day, last 7 days'}>
						{data.daily.map((value, index) => (
							<span key={index} className="gd-col" title={`${dayLabel(index)}: ${value ? `${million(value)} ${toman}` : fa ? 'بدون پرداخت' : 'no payments'}`}>
								<span
									className={cn('gd-bar', !value && 'gd-bar-none', value && index === 6 && 'gd-bar-today')}
									style={{ height: value ? Math.max(8, Math.round((value / top) * 40)) : 6, animationDelay: `${0.15 + index * 0.06}s` }}
								/>
								<span className="text-[10px] leading-none text-[var(--text-muted)]">{dayLabel(index)}</span>
							</span>
						))}
					</div>
					{latest ? (
						<p className="gd-last">
							{fa ? 'آخرین:' : 'Latest:'} <b className="font-bold tabular-nums text-[var(--text-primary)]">{nf.format(latest.amount)}</b> {toman} · {what(latest.purpose, latest.reference)}
							{ago(latest.paidAt) ? <> · {ago(latest.paidAt)}</> : null}
						</p>
					) : null}
					<Link href="/payments" className="inline-flex min-h-8 items-center gap-1 text-[12px] font-bold text-[var(--signal-strong)]">
						{fa ? 'همهٔ پرداخت‌ها' : 'All payments'}
						<Arrow className="h-3.5 w-3.5" />
					</Link>
				</div>
			</div>
		</div>
	)
}

/** The front card's own numbers: its week, and today against its daily cap. */
function CardCaption({ fa, card, million }: { fa: boolean; card: GatewayWeek['cards'][number]; million: (value: number) => string }) {
	const bank = bankByKey(card.bankKey)
	const share = card.dailyCap ? Math.min(100, (card.today / card.dailyCap) * 100) : 0
	return (
		<div className="gd-caption">
			<div className="flex items-center justify-between gap-2">
				<span className="truncate">{fa ? bank.fa : bank.en} · {fa ? '۷ روز' : '7 days'}</span>
				<b className="shrink-0 text-[12px] font-bold tabular-nums text-[var(--text-primary)]">{million(card.week)}</b>
			</div>
			<div className="h-[5px] overflow-hidden rounded-full bg-[rgba(17,17,17,0.07)]">
				<i className="block h-full rounded-full bg-gradient-to-l from-[#8b74ff] to-[var(--signal)] transition-[width] duration-500" style={{ width: `${card.today ? Math.max(3, share) : 0}%` }} />
			</div>
			<div className="flex items-center justify-between gap-2">
				<span>{fa ? 'امروز' : 'Today'} {million(card.today)}</span>
				<span>{card.dailyCap ? `${fa ? 'سقف' : 'Cap'} ${million(card.dailyCap)}` : fa ? 'بدون سقف روزانه' : 'No daily cap'}</span>
			</div>
		</div>
	)
}
