'use client'

import Link from 'next/link'
import QRCode from 'qrcode'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AlertCircle, BadgeCheck, Bot, CalendarDays, Clock, CreditCard, GraduationCap, Plus, RefreshCw, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { BankCardFace } from '@/components/payments/bank-card'
import { bankByKey } from '@/lib/payments/card/bins'
import type { GatewayWeek } from '@/lib/payments/card/dashboard'
import type { StageBookings, StageCourses, StageMenu, StageModules, StageStore } from '@/lib/dashboard/stage-modules'
import { cn } from '@/lib/utils'

/*
 * The panels under the live stage's module nodes: one per module the
 * business turned on or connected. Each shows only what the overview needs
 * (connected or not, the week's numbers, what is next) and lands the
 * stage's replays: a coin on the card, an order on the store, a booking on
 * today's line, a sign-up on a course's seats.
 */

type Locale = 'fa' | 'en'
export type ModKey = 'store' | 'menu' | 'bookings' | 'courses' | 'pay'
export type ModState = 'live' | 'warn' | 'bad' | 'setup'
export type ModNode = { key: ModKey; name: string; value: string; state: ModState; events: number }
/** The stage calls land() when a replay token reaches the open panel; null only lights it. */
export type PanelHandle = { land: (index: number | null) => void }
type Payment = GatewayWeek['recent'][number]

export const MOD: Record<ModKey, { color: string; tint: string; icon: LucideIcon }> = {
	store: { color: '#7f54b3', tint: '#f4effa', icon: ShoppingBag },
	menu: { color: '#be123c', tint: '#fdeef2', icon: UtensilsCrossed },
	bookings: { color: '#0f766e', tint: '#e3f4f1', icon: CalendarDays },
	courses: { color: '#c2410c', tint: '#fff1e7', icon: GraduationCap },
	pay: { color: '#b8860b', tint: '#fdf5df', icon: CreditCard },
}
export const modVars = (key: ModKey) => ({ '--ls-c': MOD[key].color, '--ls-t': MOD[key].tint }) as CSSProperties

const TEHRAN_OFFSET = 3.5 * 3_600_000
const DAY = 86_400_000

/** Numbers and money the way the stage writes them. */
export function formatters(locale: Locale) {
	const fa = locale === 'fa'
	const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
	const short = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US', { maximumFractionDigits: 1 })
	const fmt = (value: number) => nf.format(Math.round(value))
	const money = (value: number) =>
		value >= 1_000_000 ? `${short.format(value / 1_000_000)} ${fa ? 'میلیون' : 'M'}` : value >= 1_000 ? `${nf.format(Math.round(value / 1_000))} ${fa ? 'هزار' : 'K'}` : nf.format(Math.round(value))
	const pct = (value: number) => (fa ? `${nf.format(Math.round(value))}٪` : `${nf.format(Math.round(value))}%`)
	return { fa, fmt, money, pct }
}

/** The viewer's clock, after hydration (relative times and today's «now» depend on it). */
export function useNow() {
	const [now, setNow] = useState<number | null>(null)
	useEffect(() => {
		setNow(Date.now())
		const timer = setInterval(() => setNow(Date.now()), 30_000)
		return () => clearInterval(timer)
	}, [])
	return now
}

function useAgo(locale: Locale, now: number | null) {
	const fa = locale === 'fa'
	const relative = new Intl.RelativeTimeFormat(fa ? 'fa' : 'en', { numeric: 'auto' })
	return (iso: string | null) => {
		if (now === null || !iso) return null
		const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
		if (minutes < 60) return minutes < 1 ? (fa ? 'همین حالا' : 'just now') : relative.format(-minutes, 'minute')
		const hours = Math.round(minutes / 60)
		return hours < 24 ? relative.format(-hours, 'hour') : relative.format(-Math.round(hours / 24), 'day')
	}
}

/** What each module node says; the stage draws them in this order. */
export function moduleNodes(modules: StageModules, gateway: GatewayWeek | null, locale: Locale): ModNode[] {
	const { fa, fmt, money } = formatters(locale)
	const out: ModNode[] = []
	const store = modules.store
	if (store) {
		const woo = store.source === 'woo', broken = woo && store.sync !== null && !store.sync.ok
		out.push({
			key: 'store',
			name: woo ? (fa ? 'ووکامرس' : 'WooCommerce') : fa ? 'محصولات' : 'Products',
			state: store.source === 'none' ? 'setup' : broken ? 'bad' : store.resync ? 'warn' : 'live',
			value: store.source === 'none' ? (fa ? 'بدون محصول' : 'No products') : broken ? (fa ? 'همگام نیست' : 'Sync failed') : fa ? `${fmt(store.products)} محصول` : `${fmt(store.products)} products`,
			events: broken ? 0 : store.latest.length,
		})
	}
	const menu = modules.menu
	if (menu) out.push({ key: 'menu', name: fa ? 'منوی دیجیتال' : 'Digital menu', state: menu.items ? 'live' : 'setup', value: fa ? `${fmt(menu.items)} آیتم` : `${fmt(menu.items)} items`, events: menu.items ? menu.latest : 0 })
	const bookings = modules.bookings
	if (bookings) {
		out.push({
			key: 'bookings',
			name: bookings.table ? (fa ? 'رزرو میز' : 'Tables') : fa ? 'نوبت‌دهی' : 'Bookings',
			state: bookings.state === 'setup' ? 'setup' : 'live',
			value: bookings.state === 'setup'
				? (bookings.steps.service ? (fa ? 'ساعت کاری ندارد' : 'No working hours') : fa ? 'خدمتی ندارد' : 'No service yet')
				: fa ? `امروز ${fmt(bookings.today.length)}` : `${fmt(bookings.today.length)} today`,
			events: bookings.state === 'live' ? bookings.today.filter((row) => row.agent).length : 0,
		})
	}
	const courses = modules.courses
	if (courses) {
		const seats = courses.state === 'live' ? courses.list.reduce((sum, course) => sum + course.confirmed + course.pending, 0) : 0
		out.push({
			key: 'courses',
			name: fa ? 'دوره‌ها' : 'Courses',
			state: courses.state === 'setup' ? 'setup' : 'live',
			value: courses.state === 'setup' ? (courses.steps.published ? (fa ? 'زمان جلسه ندارد' : 'No sessions yet') : fa ? 'دوره‌ای منتشر نشده' : 'Nothing published') : fa ? `${fmt(seats)} ثبت‌نام` : `${fmt(seats)} sign-ups`,
			events: courses.state === 'live' ? courses.recent.length : 0,
		})
	}
	if (gateway) {
		const live = gateway.cards.length > 0
		out.push({
			key: 'pay',
			name: live && gateway.amount ? (fa ? 'درگاه · ۷ روز' : 'Gateway · 7d') : fa ? 'درگاه پرداخت' : 'Payment gateway',
			state: live ? 'live' : 'warn',
			value: !live ? (fa ? 'کارت خاموش' : 'Cards off') : gateway.amount ? money(gateway.amount) : fa ? 'بدون واریز' : 'Nothing yet',
			events: live ? 1 : 0,
		})
	} else if (modules.paySetup) {
		const done = Object.values(modules.paySetup).filter(Boolean).length
		out.push({ key: 'pay', name: fa ? 'درگاه پرداخت' : 'Payment gateway', state: 'setup', value: fa ? `${fmt(done)} از ۴ قدم` : `${fmt(done)} of 4 steps`, events: 0 })
	}
	return out
}

function Head({ mod, title, sub, href, link, Arrow }: { mod: ModKey; title: string; sub?: ReactNode; href?: string; link?: string; Arrow: LucideIcon }) {
	const Icon = MOD[mod].icon
	return (
		<div className="ls-pn-h">
			<span className="ls-mt h-[26px] w-[26px] !rounded-lg"><Icon className="h-[15px] w-[15px]" /></span>
			<b>{title}</b>
			{sub ? <span>{sub}</span> : null}
			{href && link ? <Link href={href} className="ls-go">{link}<Arrow className="h-[13px] w-[13px]" /></Link> : null}
		</div>
	)
}

function Steps({ items, next }: { items: { label: string; done: boolean }[]; next: string }) {
	const current = items.findIndex((item) => !item.done)
	return (
		<ol className="ls-steps">
			{items.map((item, index) => (
				<li key={item.label} className={cn(item.done && 'is-done', index === current && 'is-next')}>
					<i>{item.done ? '✓' : new Intl.NumberFormat('fa-IR').format(index + 1)}</i>
					<span>{item.label}</span>
					{index === current ? <em>{next}</em> : null}
				</li>
			))}
		</ol>
	)
}

function useBump() {
	const [bump, setBump] = useState(0)
	return { bump, fire: () => setBump((value) => value + 1) }
}

function Pop({ pop }: { pop: { id: number; text: string } | null }) {
	return pop ? <span key={pop.id} className="ls-pop ls-pop-at">{pop.text}</span> : null
}

/* ── the payment gateway ─────────────────────────────────────────────── */

const cardFoot = (card: GatewayWeek['cards'][number], fa: boolean, fmt: (value: number) => string) => (
	<div className="ls-ctile-f">
		<b>{fa ? `امروز ${fmt(card.today)} تومان` : `Today ${fmt(card.today)} Toman`}</b>
		<small className={card.verified ? 'is-ok' : undefined}>
			{card.verified ? <><BadgeCheck className="size-3.5" aria-hidden />{fa ? 'با واریز واقعی تأیید شده' : 'Verified by a real deposit'}</> : fa ? 'هنوز واریزی روی این کارت تطبیق نخورده' : 'No deposit has matched on this card yet'}
		</small>
	</div>
)

export const PayPanel = forwardRef<PanelHandle, {
	locale: Locale
	gateway: GatewayWeek | null
	payments: Payment[]
	setup: StageModules['paySetup']
	narrow: boolean
	width: number
	Arrow: LucideIcon
}>(function PayPanel({ locale, gateway, payments, setup, narrow, width, Arrow }, ref) {
	const { fa, fmt } = formatters(locale)
	const tile = narrow ? Math.min(264, width - 24) : 248
	if (gateway && gateway.cards.length) return <Wallet ref={ref} locale={locale} data={gateway} payments={payments} narrow={narrow} tile={tile} Arrow={Arrow} />
	if (gateway) {
		const slot = (
			<div className="relative" style={{ width: tile }}>
				{gateway.review > 0 ? <Link href="/payments" className="ls-badge">{fa ? `${fmt(gateway.review)} واریز منتظر تأیید` : `${fmt(gateway.review)} to review`}</Link> : null}
				<Link href="/payments/cards" className="flex aspect-[1.586] w-full flex-col items-center justify-center gap-1 rounded-[20px] border border-dashed border-[var(--signal-border)] bg-[var(--signal-soft)] px-6 text-center text-[13px] font-bold text-[var(--signal-strong)]">
					<Plus className="h-5 w-5" />
					{fa ? 'کارت فعالی نیست' : 'No active card'}
					<span className="text-[11.5px] font-medium text-[var(--text-muted)]">{fa ? 'یک کارت روشن کنید تا پرداخت‌ها برسد' : 'Switch a card on to receive payments'}</span>
				</Link>
			</div>
		)
		const text = <p className="ls-explain">{fa ? <>درگاه روشن است ولی <b>همهٔ کارت‌ها خاموش‌اند</b>؛ تا یک کارت روشن نشود، ایجنت کارتی برای فرستادن در گفتگو ندارد.</> : <>The gateway is on but <b>every card is off</b>; until one is on, the agent has no card to send in a chat.</>}</p>
		return (
			<>
				<Head mod="pay" title={fa ? 'درگاه پرداخت' : 'Payment gateway'} sub={fa ? 'روشن · بدون کارت فعال' : 'On · no active card'} href="/payments" link={fa ? 'درگاه' : 'Gateway'} Arrow={Arrow} />
				<div className={narrow ? 'flex flex-col items-center gap-3' : 'ls-w2'}>
					{slot}
					<div className="ls-wside">{text}<div><Link href="/payments/cards" className="ls-pill">{fa ? 'روشن کردن کارت' : 'Switch a card on'}<Arrow className="h-3.5 w-3.5" /></Link></div></div>
				</div>
			</>
		)
	}
	if (!setup) return null
	const order: [keyof NonNullable<StageModules['paySetup']>, string, string][] = [['card', 'کارت بانکی', 'A bank card'], ['phone', 'گوشی دریافت پیامک', 'The SMS phone'], ['test', 'واریز آزمایشی', 'A test deposit'], ['switch', 'روشن کردن درگاه', 'Switch the gateway on']]
	const done = order.filter(([key]) => setup[key]).length
	const ghost = (
		<div className="relative mx-auto" style={{ width: tile }}>
			<i aria-hidden className="ls-coin ls-demo-coin">{fa ? 'ت' : 'T'}</i>
			<div className="ls-ctile">
				<BankCardFace bankKey="unknown" pan="•••• •••• •••• ••••" holder={fa ? 'نام صاحب کارت' : 'Cardholder name'} lang={locale} />
				<div className="ls-ctile-f">
					<b>{fa ? 'کارت شما اینجا می‌نشیند' : 'Your card sits here'}</b>
					<small>{fa ? 'نمونه · بعد از افزودن کارت، واریزهایش همین‌جا دیده می‌شود' : 'Sample · once you add a card, its deposits show here'}</small>
				</div>
			</div>
		</div>
	)
	return (
		<>
			<Head mod="pay" title={fa ? 'درگاه پرداخت' : 'Payment gateway'} sub={fa ? `راه‌اندازی · ${fmt(done)} از ۴ قدم` : `Setup · ${fmt(done)} of 4 steps`} href="/payments" link={fa ? 'درگاه' : 'Gateway'} Arrow={Arrow} />
			<div className={narrow ? 'flex flex-col gap-3.5' : 'ls-w2'}>
				{ghost}
				<div className="ls-wside">
					<Steps items={order.map(([key, faLabel, enLabel]) => ({ label: fa ? faLabel : enLabel, done: setup[key] }))} next={fa ? 'قدم بعد' : 'Next'} />
					<p className="ls-explain">{fa ? <>ایجنت کارت شما را با <b>مبلغ دقیق</b> در گفتگو می‌فرستد؛ پیامک واریز بانک که برسد، سفارش، نوبت یا ثبت‌نام خودکار تأیید می‌شود.</> : <>The agent sends your card with <b>an exact amount</b> in the chat; when the bank’s deposit SMS arrives, the order, booking or sign-up confirms by itself.</>}</p>
					<Link href="/payments" className="ls-cta self-start"><CreditCard className="h-3.5 w-3.5" />{done ? (fa ? 'ادامهٔ راه‌اندازی' : 'Continue setup') : fa ? 'راه‌اندازی قدم‌به‌قدم' : 'Set it up step by step'}</Link>
				</div>
			</div>
		</>
	)
})

const Wallet = forwardRef<PanelHandle, { locale: Locale; data: GatewayWeek; payments: Payment[]; narrow: boolean; tile: number; Arrow: LucideIcon }>(function Wallet({ locale, data, payments, narrow, tile, Arrow }, ref) {
	const { fa, fmt, money, pct } = formatters(locale)
	const cards = data.cards
	const cardIndex = (payment: Payment | undefined) => Math.max(0, cards.findIndex((card) => card.id === payment?.cardId))
	const [front, setFront] = useState(() => cardIndex(payments[0]))
	const [ticker, setTicker] = useState(() => payments.slice(0, 3))
	const [pop, setPop] = useState<{ id: number; text: string } | null>(null)
	const [catchId, setCatchId] = useState(0)
	const [sheenId, setSheenId] = useState(0)
	const [tileH, setTileH] = useState(Math.round((tile - 30) / 1.586) + 86)
	const frontRef = useRef<HTMLDivElement>(null)
	const now = useNow()
	const ago = useAgo(locale, now)

	// The stack is as tall as one tile. Measure the card's own wrapper (it never
	// remounts, unlike the face that replays a catch) and skip empty readings.
	useLayoutEffect(() => {
		const el = frontRef.current
		if (!el) return
		const measure = () => { if (el.offsetHeight > 0) setTileH(el.offsetHeight) }
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	useImperativeHandle(ref, () => ({
		land: (index) => {
			if (index === null) { setSheenId((id) => id + 1); return }
			const payment = payments[index]
			if (!payment) return
			setFront(cardIndex(payment))
			setCatchId((id) => id + 1)
			setSheenId((id) => id + 1)
			setPop({ id: Date.now(), text: `+${money(payment.amount)} ${fa ? 'تومان' : 'Toman'}` })
			setTicker((list) => [payment, ...list.filter((item) => item !== payment)].slice(0, 3))
		},
	}))

	const card = cards[front] ?? cards[0]
	const bank = bankByKey(card.bankKey)
	const share = card.dailyCap ? Math.min(100, (card.today / card.dailyCap) * 100) : 0
	const near = share >= 85
	const what = (payment: Payment) =>
		payment.purpose === 'BOOKING' ? (fa ? 'نوبت' : 'Booking') : payment.purpose === 'COURSE' ? (fa ? 'ثبت‌نام دوره' : 'Course sign-up') : `${fa ? 'سفارش' : 'Order'} ${payment.reference}`

	const stack = (
		<div className="relative mx-auto shrink-0" style={{ width: tile }}>
			{data.review > 0 ? <Link href="/payments" className="ls-badge">{fa ? `${fmt(data.review)} واریز منتظر تأیید` : `${fmt(data.review)} to review`}</Link> : null}
			<div className="relative" style={{ height: tileH + 22 }}>
				{cards.map((item, index) => {
					const depth = (index - front + cards.length) % cards.length
					const k = Math.min(depth, 2)
					return (
						<div
							key={item.id}
							ref={index === 0 ? frontRef : undefined}
							aria-hidden={depth > 0}
							className="ls-card"
							style={{ transform: `translateY(${-11 * k}px) scale(${1 - 0.06 * k})`, zIndex: cards.length - depth, opacity: depth > 2 ? 0 : 1, filter: depth ? 'brightness(.9) saturate(.85)' : undefined }}
						>
							<div key={depth === 0 ? catchId : 'still'} className={cn(depth === 0 && catchId > 0 && 'ls-catch')}>
								<div className="ls-ctile">
									<BankCardFace bankKey={item.bankKey} pan={item.pan} holder={item.holder} lang={locale} />
									{cardFoot(item, fa, fmt)}
								</div>
								{depth === 0 && sheenId > 0 ? <span key={sheenId} aria-hidden className="ls-sheen" /> : null}
							</div>
						</div>
					)
				})}
			</div>
			{pop ? <span key={pop.id} className="ls-pop">{pop.text}</span> : null}
		</div>
	)
	const caption = (
		<div className="ls-cap flex min-w-0 flex-col gap-1.5 text-[12px] text-[var(--text-muted)]">
			<div className="flex items-center justify-between gap-2">
				<span className="truncate">{fa ? bank.fa : bank.en} · {fa ? '۷ روز' : '7 days'}</span>
				<b className="shrink-0 tabular-nums text-[var(--text-primary)]">{card.week ? money(card.week) : fa ? 'بدون واریز' : 'Nothing yet'}</b>
			</div>
			{card.dailyCap ? (
				<>
					<div className="h-[5px] overflow-hidden rounded-full bg-[rgba(17,17,17,0.07)]">
						<i className={cn('block h-full rounded-full transition-[width] duration-500', near ? 'bg-gradient-to-l from-amber-500 to-red-600' : 'bg-gradient-to-l from-[#8b74ff] to-[var(--signal)]')} style={{ width: `${card.today ? Math.max(3, share) : 0}%` }} />
					</div>
					<div className="flex items-center justify-between gap-2 whitespace-nowrap"><span>{fa ? 'سقف روزانه' : 'Daily cap'}</span><span className="tabular-nums">{fa ? `${pct(share)} از ${money(card.dailyCap)}` : `${pct(share)} of ${money(card.dailyCap)}`}</span></div>
				</>
			) : <div className="flex items-center justify-between gap-2"><span>{fa ? 'سقف روزانه' : 'Daily cap'}</span><span>{fa ? 'ندارد' : 'None'}</span></div>}
			{near ? <span className="ui-chip ui-chip-warn self-start">{fa ? `${pct(share)} سقف امروز پر شده` : `${pct(share)} of today's cap used`}</span> : null}
		</div>
	)
	const list = (
		<div className="min-w-0">
			<p className="mb-1.5 text-[11.5px] font-semibold text-[var(--text-muted)]">{fa ? 'آخرین پرداخت‌ها · تومان' : 'Latest payments · Toman'}</p>
			{ticker.length ? null : (
				<p className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[var(--text-muted)]">
					{fa ? 'هنوز پرداختی نرسیده. پرداخت هر مشتری همین‌جا، با نام کارتی که به آن رسیده، دیده می‌شود.' : 'No payment yet. Each one shows here, with the card it reached.'}
				</p>
			)}
			<ul className="flex flex-col gap-1.5">
				{ticker.map((payment, index) => (
					<li key={`${payment.reference}-${payment.paidAt}`} className={cn('flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5', index === 0 && catchId > 0 && 'ls-tick')}>
						<b className="shrink-0 text-[12px] font-bold tabular-nums text-[var(--ok-ink)]">+{fmt(payment.amount)}</b>
						<span className="min-w-0 flex-1 truncate text-[11.5px] leading-[1.45] text-[var(--text-primary)]">
							{what(payment)}
							<small className="block truncate text-[10.5px] text-[var(--text-muted)]">
								{fa ? bankByKey(cards[cardIndex(payment)]?.bankKey).fa : bankByKey(cards[cardIndex(payment)]?.bankKey).en}
								{ago(payment.paidAt) ? ` · ${ago(payment.paidAt)}` : ''}
							</small>
						</span>
					</li>
				))}
			</ul>
		</div>
	)
	const pill = (
		<Link href="/payments" className="ls-pill group self-start">
			{fa ? 'همهٔ پرداخت‌ها' : 'All payments'}
			<Arrow className={cn('h-3.5 w-3.5 transition-transform', fa ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5')} />
		</Link>
	)
	return (
		<>
			<Head mod="pay" title={fa ? 'درگاه پرداخت' : 'Payment gateway'} sub={fa ? `${fmt(cards.length)} کارت روشن · کارت‌به‌کارت` : `${fmt(cards.length)} active cards · card-to-card`} Arrow={Arrow} />
			<div className={narrow ? 'flex flex-col gap-3.5' : 'ls-w2'}>
				{stack}
				<div className="ls-wside">{caption}{list}{pill}</div>
			</div>
		</>
	)
})

/* ── the store: connected or not, and what came in ───────────────────── */

export const StorePanel = forwardRef<PanelHandle, { locale: Locale; data: StageStore; Arrow: LucideIcon }>(function StorePanel({ locale, data, Arrow }, ref) {
	const { fa, fmt, money } = formatters(locale)
	const ago = useAgo(locale, useNow())
	const [pop, setPop] = useState<{ id: number; text: string } | null>(null)
	const flash = useBump()
	const woo = data.source === 'woo', none = data.source === 'none'
	const broken = woo && data.sync !== null && !data.sync.ok
	useImperativeHandle(ref, () => ({
		land: (index) => {
			const order = data.latest[(index ?? 0) % Math.max(1, data.latest.length)]
			if (!order) return
			setPop({ id: Date.now(), text: `${order.label} · ${money(order.toman)}` })
			flash.fire()
		},
	}))
	const syncedAgo = ago(data.sync?.at ?? null)
	const shop = woo ? (
		<div className="ls-ce"><span className="ls-cmk ls-cmk-woo">Woo</span><span className="ls-cx"><b dir="ltr">{data.url}</b><small>{fa ? 'ووکامرس' : 'WooCommerce'}{data.plugin ? ` · ${fa ? 'افزونه' : 'plugin'} ${data.plugin}` : ''}</small></span></div>
	) : (
		<div className="ls-ce is-dim"><span className="ls-cmk ls-cmk-woo is-ghost">Woo</span><span className="ls-cx"><b>{fa ? 'ووکامرس' : 'WooCommerce'}</b><small>{fa ? 'وصل نیست' : 'Not connected'}</small></span></div>
	)
	const vigent = (
		<div className="ls-ce"><span className="ls-cmk ls-cmk-vg"><Bot className="h-[18px] w-[18px]" /></span><span className="ls-cx"><b>{fa ? 'ویجنت' : 'Vigent'}</b><small>{data.products ? (fa ? `${fmt(data.products)} محصول ${woo ? 'همگام' : 'فعال'}` : `${fmt(data.products)} ${woo ? 'synced' : 'active'}`) : fa ? 'بدون محصول' : 'No products'}</small></span></div>
	)
	const status = woo
		? broken
			? <span className="ui-chip ui-chip-danger">{fa ? 'ناموفق' : 'Failed'}{syncedAgo ? ` · ${syncedAgo}` : ''}</span>
			: <span className="ui-chip ui-chip-ok"><span className="ui-chip-dot" />{fa ? 'همگام' : 'In sync'}{syncedAgo ? ` · ${syncedAgo}` : ''}</span>
		: <Link href="/integrations" className="ls-pill">{fa ? 'اتصال ووکامرس' : 'Connect WooCommerce'}</Link>
	const wire = (
		<div key={flash.bump} className={cn('ls-wire', woo && (broken ? 'is-bad' : 'is-ok'), flash.bump > 0 && 'is-flash')}>
			{woo && !broken ? <><i className="ls-wp" /><i className="ls-wp is-back" /></> : null}
			{broken ? <span className="ls-wx"><AlertCircle className="h-[13px] w-[13px]" /></span> : null}
		</div>
	)
	return (
		<>
			<Head
				mod="store"
				title={fa ? 'فروشگاه' : 'Store'}
				sub={woo ? (broken ? (fa ? 'ووکامرس وصل است، همگام‌سازی خطا دارد' : 'WooCommerce connected, sync failing') : fa ? 'ووکامرس وصل است' : 'WooCommerce connected') : none ? (fa ? 'هنوز محصولی ندارد' : 'No products yet') : fa ? 'کاتالوگ ویجنت' : 'Vigent catalog'}
				href={none ? undefined : '/products'}
				link={fa ? 'محصولات' : 'Products'}
				Arrow={Arrow}
			/>
			<div className="ls-conn">{shop}<div className="ls-cw">{status}{wire}</div>{vigent}<Pop pop={pop} /></div>
			{none ? (
				<div className="mt-3"><Link href="/products/new" className="ls-cta"><Plus className="h-3.5 w-3.5" />{fa ? 'افزودن اولین محصول' : 'Add your first product'}</Link></div>
			) : (
				<>
					{broken ? (
						<div className="ls-note ls-note-bad mt-2.5">
							<AlertCircle className="h-3.5 w-3.5" />
							<span className="min-w-0 flex-1">{data.sync?.error || (fa ? 'آخرین همگام‌سازی ناموفق بود.' : 'The last sync failed.')}{syncedAgo ? (fa ? ` محصول و موجودی تا ${syncedAgo} به‌روزند.` : ` Products and stock are as of ${syncedAgo}.`) : ''}</span>
							<Link href="/integrations" className="ls-pill ls-pill-ghost">{fa ? 'بررسی اتصال' : 'Check the connection'}</Link>
						</div>
					) : null}
					{data.resync ? (
						<div className="ls-note ls-note-warn mt-2">
							<RefreshCw className="h-3.5 w-3.5" />
							<span>{fa ? 'سقف محصول پلن پر است و بخشی از محصولات تازه همگام نشد. با ارتقای پلن، فروشگاه خودش دوباره می‌فرستد.' : 'The plan’s product limit is full, so some new products did not sync. After an upgrade the store sends them again by itself.'}</span>
						</div>
					) : null}
					<div className="ls-kp mt-2.5" style={{ '--ls-n': data.links || !woo ? 3 : 2 } as CSSProperties}>
						<div key={flash.bump} className={cn(flash.bump > 0 && 'is-bump')}><b>{fmt(data.orders7.count)}{data.orders7.toman ? <i>{money(data.orders7.toman)}</i> : null}</b><small>{woo ? (fa ? 'سفارش ووکامرس · ۷ روز' : 'WooCommerce orders · 7d') : fa ? 'سفارش · ۷ روز' : 'Orders · 7d'}</small></div>
						<div><b>{fmt(data.chat7)}</b><small>{fa ? 'ثبت‌شده در گفتگو' : 'Placed in chat'}</small></div>
						{data.links
							? <div><b>{fmt(data.links.paid)}<i>{fa ? `از ${fmt(data.links.sent)}` : `of ${fmt(data.links.sent)}`}</i></b><small>{fa ? 'لینک پرداخت، پرداخت شد' : 'Payment links paid'}</small></div>
							: woo ? null : <div className={cn(data.low > 0 && 'is-hot')}><b>{fmt(data.low)}</b><small>{fa ? 'محصول رو به اتمام' : 'Running low'}</small></div>}
					</div>
				</>
			)}
		</>
	)
})

/* ── the digital menu ────────────────────────────────────────────────── */

export const MenuPanel = forwardRef<PanelHandle, { locale: Locale; data: StageMenu; narrow: boolean; Arrow: LucideIcon }>(function MenuPanel({ locale, data, narrow, Arrow }, ref) {
	const { fa, fmt } = formatters(locale)
	const [qr, setQr] = useState<string | null>(null)
	const [pop, setPop] = useState<{ id: number; text: string } | null>(null)
	const bump = useBump()
	useEffect(() => {
		let alive = true
		void QRCode.toDataURL(data.publicUrl, { width: 240, margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } }).then((value) => { if (alive) setQr(value) })
		return () => { alive = false }
	}, [data.publicUrl])
	useImperativeHandle(ref, () => ({ land: () => { setPop({ id: Date.now(), text: fa ? 'سفارش از منو' : 'A menu order' }); bump.fire() } }))
	const size = narrow ? 60 : 74
	return (
		<>
			<Head mod="menu" title={fa ? 'منوی دیجیتال' : 'Digital menu'} sub={fa ? `${fmt(data.items)} آیتم فعال` : `${fmt(data.items)} active items`} href="/menu" link={fa ? 'منو' : 'Menu'} Arrow={Arrow} />
			<div className="flex items-start gap-3.5">
				<a href={data.publicUrl} target="_blank" rel="noreferrer" className="ls-qr" aria-label={fa ? 'منوی عمومی' : 'Public menu'}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					{qr ? <img src={qr} alt="" width={size} height={size} /> : <span className="block" style={{ width: size, height: size }} />}
					<Pop pop={pop} />
				</a>
				<div className="flex min-w-0 flex-1 flex-col items-start gap-2">
					{data.linkLive
						? <span className="ui-chip ui-chip-ok"><span className="ui-chip-dot" />{fa ? 'لینک منو روشن' : 'Menu link on'}</span>
						: <span className="ui-chip ui-chip-warn">{fa ? 'لینک گفتگو خاموش است' : 'The chat link is off'}</span>}
					<p className="ls-explain">{fa ? 'مهمان QR روی میز را می‌زند، منو را می‌بیند و سفارشش را در گفتگو ثبت می‌کند.' : 'A guest scans the table QR, sees the menu and orders in the chat.'}</p>
					<div className="ls-kp self-stretch" style={{ '--ls-n': 2 } as CSSProperties}>
						<div key={bump.bump} className={cn(bump.bump > 0 && 'is-bump')}><b>{fmt(data.chat7)}</b><small>{fa ? 'سفارش از منو · ۷ روز' : 'Menu orders · 7d'}</small></div>
						<div><b>{fmt(data.items)}</b><small>{fa ? 'آیتم آمادهٔ پاسخ ایجنت' : 'Items the agent can answer'}</small></div>
					</div>
				</div>
			</div>
		</>
	)
})

/* ── bookings: today on one line ─────────────────────────────────────── */

const minuteOfDay = (iso: string) => Math.round((((new Date(iso).getTime() + TEHRAN_OFFSET) % DAY) + DAY) % DAY / 60_000)

export const BookingsPanel = forwardRef<PanelHandle, { locale: Locale; data: StageBookings; narrow: boolean; Arrow: LucideIcon }>(function BookingsPanel({ locale, data, narrow, Arrow }, ref) {
	const { fa, fmt } = formatters(locale)
	const nowMs = useNow()
	const [drop, setDrop] = useState<{ row: number; id: number } | null>(null)
	const live = data.state === 'live'
	const agentRows = live ? data.today.map((row, index) => (row.agent ? index : -1)).filter((index) => index >= 0) : []
	useImperativeHandle(ref, () => ({ land: (index) => { if (agentRows.length) setDrop({ row: agentRows[(index ?? 0) % agentRows.length], id: Date.now() }) } }))
	const noun = data.table ? (fa ? 'رزرو' : 'reservation') : fa ? 'نوبت' : 'booking'
	const digits = (value: number) => new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US', { minimumIntegerDigits: 2, useGrouping: false }).format(value)
	const hm = (minute: number) => `${digits(Math.floor(minute / 60) % 24)}:${digits(minute % 60)}`

	if (!live) {
		return (
			<>
				<Head mod="bookings" title={data.table ? (fa ? 'رزرو میز' : 'Table reservations') : fa ? 'نوبت‌دهی' : 'Bookings'} sub={data.steps.service ? (fa ? 'خدمت ثبت شده، هنوز ساعت کاری ندارد' : 'A service is in, no working hours yet') : fa ? 'هنوز خدمتی ثبت نشده' : 'No service yet'} Arrow={Arrow} />
				<div className="ls-day opacity-75"><div className="absolute inset-x-0 bottom-[18px] top-0 grid place-items-center text-[11.5px] text-[var(--text-muted)]">{fa ? 'خط روز بعد از تعیین ساعت کاری پر می‌شود' : 'The day fills in once working hours are set'}</div></div>
				<div className="mt-3 flex flex-wrap items-center justify-between gap-3.5">
					<Steps items={[{ label: fa ? 'یک خدمت فعال' : 'An active service', done: data.steps.service }, { label: fa ? 'ساعت کاری برای خدمت' : 'Working hours on a service', done: data.steps.hours }]} next={fa ? 'قدم بعد' : 'Next'} />
					<Link href="/appointments?tab=services" className="ls-cta"><Clock className="h-3.5 w-3.5" />{data.steps.service ? (fa ? 'تعیین ساعت کاری' : 'Set working hours') : fa ? 'افزودن خدمت' : 'Add a service'}</Link>
				</div>
			</>
		)
	}

	const span = data.close - data.open
	const now = nowMs === null ? null : minuteOfDay(new Date(nowMs).toISOString())
	const at = (minute: number) => `${(((minute - data.open) / span) * 100).toFixed(2)}%`
	const hours: number[] = []
	for (let hour = Math.ceil(data.open / 60); hour * 60 <= data.close; hour += narrow ? 3 : 2) hours.push(hour)
	const rows = data.today.map((row) => ({ ...row, from: minuteOfDay(row.start) }))
	// Two lanes: a booking that overlaps the one before it drops to the second.
	let laneEnd = [-1, -1]
	const lane = rows.map((row) => {
		const pick = row.from >= laneEnd[0] ? 0 : row.from >= laneEnd[1] ? 1 : 0
		laneEnd = pick === 0 ? [row.from + row.minutes, laneEnd[1]] : [laneEnd[0], row.from + row.minutes]
		return pick
	})
	const statusFa: Record<string, string> = { PENDING: 'منتظر پیش‌پرداخت', CONFIRMED: 'تأییدشده', COMPLETED: 'انجام شد', NO_SHOW: 'نیامد' }
	const next = now === null ? null : rows.filter((row) => row.from > now && (row.status === 'CONFIRMED' || row.status === 'PENDING'))[0] ?? null
	const left = next && now !== null ? next.from - now : 0
	const channelFa: Record<string, string> = { INSTAGRAM: 'اینستاگرام', TELEGRAM: 'تلگرام', BALE: 'بله', RUBIKA: 'روبیکا', WEB_WIDGET: 'ویجت سایت', CHAT_LINK: 'چت لینک', WHATSAPP: 'واتساپ' }
	const nearHour = (hour: number) => now !== null && Math.abs(hour * 60 - now) < span * 0.06

	return (
		<>
			<Head mod="bookings" title={data.table ? (fa ? 'رزرو میز امروز' : 'Tables today') : fa ? 'نوبت‌های امروز' : 'Today’s bookings'} sub={fa ? `${fmt(rows.length)} ${noun} · ${fmt(data.services)} ${data.table ? 'نوع میز' : 'خدمت'}` : `${fmt(rows.length)} · ${fmt(data.services)} services`} href="/appointments" link={fa ? 'تقویم' : 'Calendar'} Arrow={Arrow} />
			<div className="ls-day">
				<div className="ls-day-in">
					{now !== null && now > data.open ? <span className="ls-day-past" style={{ width: `calc(${at(Math.min(now, data.close))} + 16px)` }} /> : null}
					{hours.map((hour) => (
						<span key={hour}>
							<span className="ls-day-hr" style={{ right: at(hour * 60) }} />
							{nearHour(hour) ? null : <span className="ls-day-hl" style={{ right: at(hour * 60) }}>{new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US').format(hour % 24)}</span>}
						</span>
					))}
					{rows.map((row, index) => (
						<span
							key={drop?.row === index ? `${index}-${drop.id}` : index}
							title={`${hm(row.from)} · ${row.service} · ${row.who}${fa ? ` · ${statusFa[row.status]}` : ''}`}
							className={cn('ls-blk', row.status === 'PENDING' && 'is-pend', row.status === 'COMPLETED' && 'is-done', row.status === 'NO_SHOW' && 'is-ns', drop?.row === index && 'is-drop')}
							style={{ right: at(row.from), width: `calc(${((row.minutes / span) * 100).toFixed(2)}% - 3px)`, top: lane[index] ? 26 : 9 }}
						/>
					))}
					{drop !== null && rows[drop.row] ? <span key={drop.id} className="ls-pop" style={{ top: 2, left: 'auto', right: `calc(${at(rows[drop.row].from)} - 40px)` }}>{fa ? `${noun} تازه از گفتگو` : 'Booked in chat'}</span> : null}
					{now !== null && now >= data.open && now <= data.close ? <><span className="ls-nowl" style={{ right: at(now) }} /><span className="ls-nowt" style={{ right: at(now) }}>{hm(now)}</span></> : null}
				</div>
			</div>
			<div className="ls-lgd">
				<span><i style={{ background: 'var(--ls-c)' }} />{fa ? 'تأییدشده' : 'Confirmed'}</span>
				<span><i style={{ background: 'repeating-linear-gradient(135deg,#f59e0b 0 3px,#fde8b8 3px 6px)' }} />{fa ? 'منتظر پیش‌پرداخت' : 'Awaiting prepayment'}</span>
				<span><i style={{ background: '#d6d2cb' }} />{fa ? 'انجام شد' : 'Done'}</span>
				<span><i style={{ background: '#fff', boxShadow: 'inset 0 0 0 1.5px #f3a5a5' }} />{fa ? 'نیامد' : 'No-show'}</span>
			</div>
			<div className="ls-bk2">
				{next ? (
					<div className="ls-nx">
						<div className="ls-nx-t"><b>{hm(next.from)}</b><small>{fa ? `${noun} بعدی` : 'Next'}</small></div>
						<div className="ls-nx-w">
							<b>{next.service} · {next.who}</b>
							<small>{next.agent ? (fa ? `ثبت در گفتگو${next.channel && channelFa[next.channel] ? ` · ${channelFa[next.channel]}` : ''}` : 'Booked in chat') : fa ? 'ثبت از داشبورد' : 'Added in the dashboard'}</small>
							<span className="ui-chip">{left < 60 ? (fa ? `${fmt(left)} دقیقه دیگر` : `in ${fmt(left)} min`) : fa ? `${fmt(Math.floor(left / 60))} ساعت و ${fmt(left % 60)} دقیقه دیگر` : `in ${fmt(Math.floor(left / 60))}h ${fmt(left % 60)}m`}</span>
						</div>
					</div>
				) : (
					<div className="ls-nx"><div className="ls-nx-w"><b>{fa ? `${noun} دیگری برای امروز نمانده` : 'Nothing else today'}</b><small>{fa ? `${fmt(data.upcoming)} ${noun} در روزهای بعد` : `${fmt(data.upcoming)} coming up`}</small></div></div>
				)}
				<div className="ls-kp" style={{ '--ls-n': 3 } as CSSProperties}>
					<div><b>{fmt(data.upcoming)}</b><small>{fa ? `${noun} پیش رو` : 'Upcoming'}</small></div>
					<div className={cn(data.pending > 0 && 'is-hot')}><b>{fmt(data.pending)}</b><small>{fa ? 'منتظر پیش‌پرداخت' : 'Awaiting prepayment'}</small></div>
					<div><b>{fmt(data.lost7)}</b><small>{fa ? 'لغو یا نیامده · ۷ روز' : 'Cancelled or no-show · 7d'}</small></div>
				</div>
			</div>
		</>
	)
})

/* ── courses: seats per course ───────────────────────────────────────── */

export const CoursesPanel = forwardRef<PanelHandle, { locale: Locale; data: StageCourses; Arrow: LucideIcon }>(function CoursesPanel({ locale, data, Arrow }, ref) {
	const { fa, fmt, money } = formatters(locale)
	const [fill, setFill] = useState<{ course: number; id: number } | null>(null)
	useEffect(() => {
		if (!fill) return
		const timer = setTimeout(() => setFill(null), 2600)
		return () => clearTimeout(timer)
	}, [fill])
	useImperativeHandle(ref, () => ({
		land: (index) => {
			if (data.state !== 'live' || !data.recent.length) return
			const course = data.recent[(index ?? 0) % data.recent.length]
			setFill({ course, id: Date.now() })
		},
	}))
	if (data.state === 'setup') {
		return (
			<>
				<Head mod="courses" title={fa ? 'دوره‌ها' : 'Courses'} sub={data.steps.published ? (fa ? 'دوره منتشر شده، زمان جلسه ندارد' : 'Published, no session dates') : fa ? 'هنوز دوره‌ای منتشر نشده' : 'Nothing published yet'} Arrow={Arrow} />
				<div className="flex flex-wrap items-center justify-between gap-3.5">
					<Steps items={[{ label: fa ? 'یک دورهٔ منتشرشده' : 'A published course', done: data.steps.published }, { label: fa ? 'زمان جلسات دوره' : 'Session dates', done: data.steps.sessions }]} next={fa ? 'قدم بعد' : 'Next'} />
					<Link href="/courses" className="ls-cta"><GraduationCap className="h-3.5 w-3.5" />{fa ? 'دوره‌ها' : 'Courses'}</Link>
				</div>
			</>
		)
	}
	const when = new Intl.DateTimeFormat(fa ? 'fa-IR-u-ca-persian' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' })
	const formats: Record<string, [string, string]> = { ONLINE: [fa ? 'آنلاین' : 'Online', 'ui-chip-signal'], IN_PERSON: [fa ? 'حضوری' : 'In person', 'ui-chip-neutral'], HYBRID: [fa ? 'ترکیبی' : 'Hybrid', 'ui-chip-warn'] }
	return (
		<>
			<Head mod="courses" title={fa ? 'دوره‌ها' : 'Courses'} sub={fa ? `${fmt(data.list.length)} دوره در حال ثبت‌نام` : `${fmt(data.list.length)} open for sign-up`} href="/courses" link={fa ? 'دوره‌ها' : 'Courses'} Arrow={Arrow} />
			<div className="flex flex-col gap-2">
				{data.list.map((course, index) => {
					const taken = course.confirmed + course.pending, left = course.capacity - taken
					const [formatLabel, formatChip] = formats[course.format] ?? formats.IN_PERSON
					const filling = fill?.course === index
					return (
						<Link key={course.title + index} href="/courses" className="ls-cr">
							<span className="ls-cr-t"><span className={cn('ui-chip', formatChip)}>{formatLabel}</span><b>{course.title}</b></span>
							<span className="ls-cr-s">
								{course.next ? `${course.started ? (fa ? 'جلسهٔ بعد' : 'Next') : fa ? 'شروع' : 'Starts'} ${when.format(new Date(course.next))}` : fa ? 'جلسه‌ای پیش رو نیست' : 'No upcoming session'}
								{course.price ? ` · ${money(course.price)} ${fa ? 'تومان' : 'Toman'}` : ''}
							</span>
							<span className="ls-cr-n">
								<b>{fmt(taken)}<i>{fa ? ` از ${fmt(course.capacity)}` : ` of ${fmt(course.capacity)}`}</i></b>
								<small>{left > 0 ? (fa ? `${fmt(left)} جا مانده` : `${fmt(left)} left`) : course.waitlisted ? (fa ? `پر · ${fmt(course.waitlisted)} در فهرست انتظار` : `Full · ${fmt(course.waitlisted)} waiting`) : fa ? 'ظرفیت پر شد' : 'Full'}</small>
							</span>
							{course.capacity <= 40 ? (
								<span className="ls-seats" aria-hidden>
									{Array.from({ length: course.capacity }, (_, seat) => (
										<i key={seat === taken && filling ? `f${fill?.id}` : seat} className={cn(seat < course.confirmed ? 'is-c' : seat < taken || (filling && seat === taken) ? 'is-p' : '', filling && seat === taken && 'is-fill')} />
									))}
								</span>
							) : <span className="ls-seat-bar" aria-hidden><i style={{ width: `${Math.min(100, (taken / Math.max(1, course.capacity)) * 100)}%` }} /></span>}
							{filling ? <span key={fill?.id} className="ls-pop ls-pop-at">{fa ? 'ثبت‌نام از گفتگو' : 'Signed up in chat'}</span> : null}
						</Link>
					)
				})}
			</div>
		</>
	)
})

