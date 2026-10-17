'use client'

import Link from 'next/link'
import QRCode from 'qrcode'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CalendarDays, Clock, CreditCard, GraduationCap, Package, Plus, RefreshCw, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { BankCardFace } from '@/components/payments/bank-card'
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

function Head({ mod, title, sub, end }: { mod: ModKey; title: string; sub?: ReactNode; end?: ReactNode }) {
	const Icon = MOD[mod].icon
	return (
		<div className="ls-pn-h">
			<span className="ls-mt h-[26px] w-[26px] !rounded-lg"><Icon className="h-[15px] w-[15px]" /></span>
			<b>{title}</b>
			{sub ? <span className="ls-pn-sub">{sub}</span> : null}
			{end}
		</div>
	)
}

/** Counts up from zero when the panel opens, then from the last value; reduced motion shows it at once. */
function Count({ value, format }: { value: number; format: (value: number) => string }) {
	const [shown, setShown] = useState(0)
	const from = useRef(0)
	useEffect(() => {
		const start = from.current
		from.current = value
		if (start === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return }
		const t0 = performance.now()
		let frame = 0
		const tick = (now: number) => {
			const p = Math.min(1, (now - t0) / 1100)
			setShown(start + (value - start) * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)))
			if (p < 1) frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	}, [value])
	return <>{format(shown)}</>
}

/** One number on a panel: a big count, a word under it, the page it opens. */
function Stat({ index, href, icon: Icon, value, label, format, bump = 0, feed, hot, children }: {
	index: number
	href?: string
	icon?: LucideIcon
	value: number
	label: string
	format: (value: number) => string
	bump?: number
	/** A live source keeps feeding it (a synced store). */
	feed?: boolean
	hot?: boolean
	children?: ReactNode
}) {
	const numRef = useRef<HTMLElement>(null)
	// A replay landing nudges the number without remounting (and recounting) it.
	useEffect(() => {
		if (!bump || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		numRef.current?.animate([{ transform: 'none' }, { transform: 'scale(1.14)', color: 'var(--ls-c)', offset: 0.4 }, { transform: 'none' }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' })
	}, [bump])
	const body = (
		<>
			{Icon ? <span className="ls-stat-ic"><Icon className="h-4 w-4" /></span> : null}
			<b ref={numRef}><Count value={value} format={format} /></b>
			<small>{label}</small>
			{children}
		</>
	)
	const className = cn('ls-stat', feed && 'is-feed', hot && 'is-hot')
	const style = { '--i': index } as CSSProperties
	return href ? <Link href={href} className={className} style={style}>{body}</Link> : <div className={className} style={style}>{body}</div>
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
	const tile = narrow ? Math.min(280, width - 24) : 248
	if (gateway && gateway.cards.length) return <Wallet ref={ref} locale={locale} data={gateway} payments={payments} narrow={narrow} tile={tile} />
	if (gateway) {
		return (
			<>
				<Head mod="pay" title={fa ? 'درگاه پرداخت' : 'Payment gateway'} end={<Review count={gateway.review} fa={fa} fmt={fmt} />} />
				<div className={narrow ? 'flex flex-col items-center gap-3.5 text-center' : 'ls-w2'}>
					<Link href="/payments/cards" className="flex aspect-[1.586] flex-col items-center justify-center gap-1.5 rounded-[20px] border border-dashed border-[var(--signal-border)] bg-[var(--signal-soft)] px-6 text-center text-[13px] font-bold text-[var(--signal-strong)]" style={{ width: tile }}>
						<Plus className="h-5 w-5" />
						{fa ? 'کارت فعالی نیست' : 'No active card'}
					</Link>
					<div className={cn('ls-wside', narrow && 'items-center')}>
						<p className="ls-explain">{fa ? <>درگاه روشن است ولی <b>همهٔ کارت‌ها خاموش‌اند</b>.</> : <>The gateway is on but <b>every card is off</b>.</>}</p>
						<div><Link href="/payments/cards" className="ls-pill">{fa ? 'روشن کردن کارت' : 'Switch a card on'}<Arrow className="h-3.5 w-3.5" /></Link></div>
					</div>
				</div>
			</>
		)
	}
	if (!setup) return null
	const order: [keyof NonNullable<StageModules['paySetup']>, string, string][] = [['card', 'کارت بانکی', 'A bank card'], ['phone', 'گوشی دریافت پیامک', 'The SMS phone'], ['test', 'واریز آزمایشی', 'A test deposit'], ['switch', 'روشن کردن درگاه', 'Switch the gateway on']]
	const done = order.filter(([key]) => setup[key]).length
	return (
		<>
			<Head mod="pay" title={fa ? 'درگاه پرداخت' : 'Payment gateway'} sub={fa ? `${fmt(done)} از ۴ قدم` : `${fmt(done)} of 4 steps`} />
			<div className={narrow ? 'flex flex-col gap-4' : 'ls-w2'}>
				<div className="relative mx-auto" style={{ width: tile }}>
					<i aria-hidden className="ls-coin ls-demo-coin">{fa ? 'ت' : 'T'}</i>
					<BankCardFace bankKey="unknown" pan="•••• •••• •••• ••••" holder={fa ? 'کارت شما' : 'Your card'} lang={locale} muted />
				</div>
				<div className="ls-wside">
					<Steps items={order.map(([key, faLabel, enLabel]) => ({ label: fa ? faLabel : enLabel, done: setup[key] }))} next={fa ? 'قدم بعد' : 'Next'} />
					<Link href="/payments" className="ls-cta self-start"><CreditCard className="h-3.5 w-3.5" />{done ? (fa ? 'ادامهٔ راه‌اندازی' : 'Continue setup') : fa ? 'راه‌اندازی درگاه' : 'Set up the gateway'}</Link>
				</div>
			</div>
		</>
	)
})

function Review({ count, fa, fmt }: { count: number; fa: boolean; fmt: (value: number) => string }) {
	return count > 0 ? <Link href="/payments" className="ls-badge">{fa ? `${fmt(count)} منتظر تأیید` : `${fmt(count)} to review`}</Link> : null
}

const Wallet = forwardRef<PanelHandle, { locale: Locale; data: GatewayWeek; payments: Payment[]; narrow: boolean; tile: number }>(function Wallet({ locale, data, payments, narrow, tile }, ref) {
	const { fa, fmt, money } = formatters(locale)
	const cards = data.cards
	const cardIndex = (payment: Payment | undefined) => Math.max(0, cards.findIndex((card) => card.id === payment?.cardId))
	const [front, setFront] = useState(() => cardIndex(payments[0]))
	const [ticker, setTicker] = useState(() => payments.slice(0, 3))
	const [pop, setPop] = useState<{ id: number; text: string } | null>(null)
	const [catchId, setCatchId] = useState(0)
	const [sheenId, setSheenId] = useState(0)
	const [tileH, setTileH] = useState(Math.round(tile / 1.586))
	const frontRef = useRef<HTMLDivElement>(null)
	const ago = useAgo(locale, useNow())

	// The stack is as tall as one card. Measure the card's own wrapper (it never
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

	const what = (payment: Payment) =>
		payment.purpose === 'BOOKING' ? (fa ? 'نوبت' : 'Booking') : payment.purpose === 'COURSE' ? (fa ? 'ثبت‌نام دوره' : 'Course sign-up') : `${fa ? 'سفارش' : 'Order'} ${payment.reference}`
	const peak = Math.max(1, ...data.daily)

	const stack = (
		<div className="relative mx-auto shrink-0" style={{ width: tile }}>
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
								<BankCardFace bankKey={item.bankKey} pan={item.pan} holder={item.holder} lang={locale} />
								{depth === 0 && sheenId > 0 ? <span key={sheenId} aria-hidden className="ls-sheen" /> : null}
							</div>
						</div>
					)
				})}
			</div>
			{pop ? <span key={pop.id} className="ls-pop">{pop.text}</span> : null}
		</div>
	)
	const week = (
		<div className="ls-sum">
			<b>{data.amount ? <><Count value={data.amount} format={money} /><i>{fa ? 'تومان' : 'Toman'}</i></> : fa ? 'هنوز واریزی نیست' : 'Nothing yet'}</b>
			<div className="ls-bars" aria-hidden>
				{data.daily.map((value, index) => (
					<i
						key={index === data.daily.length - 1 ? `t${catchId}` : index}
						title={money(value)}
						className={cn(index === data.daily.length - 1 && 'is-today', !value && 'is-zero', index === data.daily.length - 1 && catchId > 0 && 'is-hit')}
						style={{ '--h': `${value ? Math.max(14, (value / peak) * 100) : 8}%`, '--i': index } as CSSProperties}
					/>
				))}
			</div>
		</div>
	)
	const list = ticker.length ? (
		<ul className="ls-feed">
			{ticker.map((payment, index) => (
				<li key={`${payment.reference}-${payment.paidAt}`} className={cn(index === 0 && catchId > 0 && 'ls-tick')} style={{ '--i': index } as CSSProperties}>
					<b>+{fmt(payment.amount)}</b>
					<span>{what(payment)}</span>
					<small>{ago(payment.paidAt)}</small>
				</li>
			))}
		</ul>
	) : null
	return (
		<>
			<Head mod="pay" title={fa ? 'درگاه پرداخت' : 'Payment gateway'} end={<Review count={data.review} fa={fa} fmt={fmt} />} />
			<div className={narrow ? 'flex flex-col gap-5' : 'ls-w2'}>
				{stack}
				<div className="ls-wside">{week}{list}</div>
			</div>
		</>
	)
})

/* ── the store: products and orders, WooCommerce only when it is there ── */

export const StorePanel = forwardRef<PanelHandle, { locale: Locale; data: StageStore }>(function StorePanel({ locale, data }, ref) {
	const { fa, fmt, money } = formatters(locale)
	const ago = useAgo(locale, useNow())
	const [pop, setPop] = useState<{ id: number; text: string } | null>(null)
	const flash = useBump()
	const woo = data.source === 'woo'
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
	const source = woo ? (
		<Link href="/integrations" title={(broken ? data.sync?.error : data.url) ?? undefined} className={cn('ls-src', broken && 'is-bad')}>
			<span className="ls-cmk ls-cmk-woo">Woo</span>
			<i aria-hidden />
			{broken ? (fa ? 'همگام نیست' : 'Out of sync') : fa ? 'همگام' : 'In sync'}
			{syncedAgo ? <small>{syncedAgo}</small> : null}
		</Link>
	) : null

	if (data.source === 'none') {
		return (
			<>
				<Head mod="store" title={fa ? 'محصولات' : 'Products'} />
				<div className="ls-empty">
					<span className="ls-stat-ic"><Package className="h-4 w-4" /></span>
					<p>{fa ? 'هنوز محصولی ثبت نشده' : 'No products yet'}</p>
					<Link href="/products/new" className="ls-cta"><Plus className="h-3.5 w-3.5" />{fa ? 'افزودن اولین محصول' : 'Add your first product'}</Link>
				</div>
			</>
		)
	}
	return (
		<>
			<Head mod="store" title={woo ? (fa ? 'فروشگاه' : 'Store') : fa ? 'محصولات' : 'Products'} sub={woo && data.url ? <bdi dir="ltr">{data.url.replace(/^https?:\/\//, '')}</bdi> : undefined} end={source} />
			<div className="ls-stats">
				<Stat index={0} href="/products" icon={Package} value={data.products} label={fa ? 'محصول' : 'Products'} format={fmt} feed={woo && !broken} />
				<Stat index={1} href="/products/orders" icon={ShoppingBag} value={data.orders7.count} label={fa ? 'سفارش' : 'Orders'} format={fmt} bump={flash.bump}>
					<Pop pop={pop} />
				</Stat>
			</div>
			{data.resync ? (
				<p className="ls-note ls-note-warn mt-2.5">
					<RefreshCw className="h-3.5 w-3.5" />
					<span>{fa ? 'سقف محصول پلن پر است؛ بخشی از محصولات همگام نشد.' : 'The plan’s product limit is full; some products did not sync.'}</span>
				</p>
			) : null}
		</>
	)
})

/* ── the digital menu ────────────────────────────────────────────────── */

export const MenuPanel = forwardRef<PanelHandle, { locale: Locale; data: StageMenu; narrow: boolean }>(function MenuPanel({ locale, data, narrow }, ref) {
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
			<Head mod="menu" title={fa ? 'منوی دیجیتال' : 'Digital menu'} end={data.linkLive ? null : <span className="ui-chip ui-chip-warn ms-auto">{fa ? 'لینک گفتگو خاموش است' : 'The chat link is off'}</span>} />
			<div className="flex items-stretch gap-2.5">
				<a href={data.publicUrl} target="_blank" rel="noreferrer" className="ls-qr" aria-label={fa ? 'منوی عمومی' : 'Public menu'}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					{qr ? <img src={qr} alt="" width={size} height={size} /> : <span className="block" style={{ width: size, height: size }} />}
					<span aria-hidden className="ls-scan" />
					<Pop pop={pop} />
				</a>
				<div className="ls-stats min-w-0 flex-1">
					<Stat index={0} href="/menu/orders" value={data.chat7} label={fa ? 'سفارش' : 'Orders'} format={fmt} bump={bump.bump} />
					<Stat index={1} href="/menu" value={data.items} label={fa ? 'آیتم' : 'Items'} format={fmt} />
				</div>
			</div>
		</>
	)
})

/* ── bookings: today on one line ─────────────────────────────────────── */

const minuteOfDay = (iso: string) => Math.round((((new Date(iso).getTime() + TEHRAN_OFFSET) % DAY) + DAY) % DAY / 60_000)

export const BookingsPanel = forwardRef<PanelHandle, { locale: Locale; data: StageBookings; narrow: boolean }>(function BookingsPanel({ locale, data, narrow }, ref) {
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
				<Head mod="bookings" title={data.table ? (fa ? 'رزرو میز' : 'Table reservations') : fa ? 'نوبت‌دهی' : 'Bookings'} sub={data.steps.service ? (fa ? 'خدمت ثبت شده، هنوز ساعت کاری ندارد' : 'A service is in, no working hours yet') : fa ? 'هنوز خدمتی ثبت نشده' : 'No service yet'} />
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
			<Head mod="bookings" title={data.table ? (fa ? 'رزرو میز امروز' : 'Tables today') : fa ? 'نوبت‌های امروز' : 'Today’s bookings'} sub={fa ? `${fmt(rows.length)} ${noun} · ${fmt(data.services)} ${data.table ? 'نوع میز' : 'خدمت'}` : `${fmt(rows.length)} · ${fmt(data.services)} services`} />
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
				<div className="ls-stats">
					<Stat index={0} href="/appointments" value={data.upcoming} label={fa ? `${noun} پیش رو` : 'Upcoming'} format={fmt} />
					<Stat index={1} href="/appointments" value={data.pending} label={fa ? 'منتظر پیش‌پرداخت' : 'Awaiting prepayment'} format={fmt} hot={data.pending > 0} />
				</div>
			</div>
		</>
	)
})

/* ── courses: seats per course ───────────────────────────────────────── */

export const CoursesPanel = forwardRef<PanelHandle, { locale: Locale; data: StageCourses }>(function CoursesPanel({ locale, data }, ref) {
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
				<Head mod="courses" title={fa ? 'دوره‌ها' : 'Courses'} sub={data.steps.published ? (fa ? 'دوره منتشر شده، زمان جلسه ندارد' : 'Published, no session dates') : fa ? 'هنوز دوره‌ای منتشر نشده' : 'Nothing published yet'} />
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
			<Head mod="courses" title={fa ? 'دوره‌ها' : 'Courses'} sub={fa ? `${fmt(data.list.length)} دوره در حال ثبت‌نام` : `${fmt(data.list.length)} open for sign-up`} />
			<div className="flex flex-col gap-2">
				{data.list.map((course, index) => {
					const taken = course.confirmed + course.pending, left = course.capacity - taken
					const [formatLabel, formatChip] = formats[course.format] ?? formats.IN_PERSON
					const filling = fill?.course === index
					return (
						<Link key={course.title + index} href="/courses" className="ls-cr" style={{ '--i': index } as CSSProperties}>
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

