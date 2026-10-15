'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { BankCardFace } from '@/components/payments/bank-card'
import { bankByKey } from '@/lib/payments/card/bins'
import type { GatewayWeek } from '@/lib/payments/card/dashboard'
import { cn } from '@/lib/utils'

const TICK_MS = 3600
const DROP_MS = 700
const SWAP_MS = 750

/**
 * The payment gateway's place in the overview flow, once it is live: the
 * active cards stacked right under the agent, what they took in over seven
 * days beside them, and each card's own week and daily cap underneath.
 *
 * Motion replays the latest real payments: a coin drops from the agent, the
 * card it went to comes to the front and catches it. It plays only on screen
 * and never with reduced motion; the resting frame is complete without it.
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
	const firstFront = Math.max(0, cards.findIndex((card) => card.id === recent[0]?.cardId))

	const root = useRef<HTMLDivElement>(null)
	const coin = useRef<HTMLSpanElement>(null)
	const faces = useRef<(HTMLDivElement | null)[]>([])
	const plus = useRef<HTMLSpanElement>(null)
	const [front, setFront] = useState(firstFront)
	const frontRef = useRef(firstFront)
	const [leaving, setLeaving] = useState<number | null>(null)
	const [shown, setShown] = useState(0)
	const [gain, setGain] = useState<number | null>(null)
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
		let visible = false
		let tick = 0
		let frame = 0
		const timers = new Set<ReturnType<typeof setTimeout>>()
		const later = (ms: number, fn: () => void) => {
			const timer = setTimeout(() => { timers.delete(timer); fn() }, ms)
			timers.add(timer)
		}
		const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }, { threshold: 0.3 })
		observer.observe(node)

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

		const land = (index: number, cardIndex: number) => {
			const face = faces.current[cardIndex]
			face?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.045)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(.2,1.4,.4,1)' })
			face?.querySelector('.gd-shine')?.animate([{ transform: 'translateX(-130%)' }, { transform: 'translateX(130%)' }], { duration: 900, easing: 'ease-out' })
			setGain(recent[index].amount)
			setShown(index)
			plus.current?.animate(
				[
					{ opacity: 0, transform: 'translate(-50%, 8px) scale(.9)' },
					{ opacity: 1, transform: 'translate(-50%, -14px) scale(1)', offset: 0.15 },
					{ opacity: 1, transform: 'translate(-50%, -22px)', offset: 0.7 },
					{ opacity: 0, transform: 'translate(-50%, -32px)' },
				],
				{ duration: 1600, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' },
			)
		}

		const interval = setInterval(() => {
			if (!visible || document.hidden || !recent.length) return
			const index = tick++ % recent.length
			const cardIndex = cards.findIndex((card) => card.id === recent[index].cardId)
			const dropping = Boolean(coin.current?.offsetParent)
			if (dropping) {
				coin.current!.animate(
					[
						{ opacity: 0, transform: 'translateY(0) scale(.7)' },
						{ opacity: 1, offset: 0.2 },
						{ opacity: 1, transform: 'translateY(72px) scale(.55)' },
					],
					{ duration: DROP_MS + 50, easing: 'cubic-bezier(.55,0,.9,.45)' },
				)
			}
			later(dropping ? DROP_MS : 0, () => {
				const current = frontRef.current
				if (current === cardIndex) return land(index, cardIndex)
				frontRef.current = cardIndex
				setLeaving(current)
				setFront(cardIndex)
				later(SWAP_MS, () => { setLeaving(null); land(index, cardIndex) })
			})
		}, TICK_MS)

		return () => {
			clearInterval(interval)
			timers.forEach(clearTimeout)
			cancelAnimationFrame(frame)
			observer.disconnect()
			counter.disconnect()
		}
		// The data is server-rendered once per page load.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const showcase = cards[front]
	const top = Math.max(1, ...data.daily)
	const weekday = new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { weekday: 'narrow', timeZone: 'Asia/Tehran' })
	const dayLabel = (index: number) => (index === 6 ? (fa ? 'امروز' : 'Today') : weekday.format(new Date(Date.now() - (6 - index) * 86_400_000)))
	const latest = recent[shown]
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
			{recent.length ? <span ref={coin} aria-hidden className="gd-coin hidden sm:block" /> : null}

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

				{/* The active cards, the one the latest payment reached in front. */}
				<div className="gd-cards">
					{cards.length ? (
						<>
							<div className="gd-stack">
								{data.review > 0 ? (
									<Link href="/payments" className="gd-badge">{fa ? `${nf.format(data.review)} واریز منتظر تأیید` : `${nf.format(data.review)} to review`}</Link>
								) : null}
								<span ref={plus} aria-hidden className="gd-plus">
									{gain !== null ? <><span dir="ltr">+{nf.format(gain)}</span> {toman}</> : null}
								</span>
								{cards.map((card, index) => {
									const depth = (index - front + cards.length) % cards.length
									return (
										<div
											key={card.id}
											className={cn('gd-card', leaving === index && 'gd-card-out')}
											aria-hidden={depth > 0}
											style={{ '--gd-ty': `${-11 * Math.min(depth, 2)}px`, '--gd-sc': 1 - 0.06 * Math.min(depth, 2), zIndex: leaving === index ? undefined : cards.length - depth, opacity: depth > 2 ? 0 : 1, filter: depth ? 'brightness(.88) saturate(.85)' : undefined } as CSSProperties}
										>
											<div ref={(node) => { faces.current[index] = node }} className="relative overflow-hidden rounded-[20px]">
												<BankCardFace bankKey={card.bankKey} pan={card.pan} holder={card.holder} lang={locale} />
												<span aria-hidden className="gd-shine" />
											</div>
										</div>
									)
								})}
							</div>
							<CardCaption fa={fa} card={showcase} million={million} />
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
						<p key={shown} className="gd-last">
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
		<div key={card.id} className="gd-caption">
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
