'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AlertTriangle, BadgeCheck, Banknote, Check, ChevronLeft, CircleHelp, Clock3, CreditCard, ShieldCheck, ShoppingBag, X, XCircle } from 'lucide-react'
import { BankCardFace, ShetabArrow } from '@/components/payments/bank-card'
import { copyText, useCardPayStatus } from '@/components/commerce/card-pay-view'
import { groupDigits } from '@/lib/payments/card/amount'
import { bankByKey, bankLogoUrl } from '@/lib/payments/card/bins'
import type { PayItem } from '@/lib/payments/card/items'
import type { CardPayStatus, CardPayView } from '@/lib/payments/card/pay-card'
import { LATE_SMS_GRACE_MS } from '@/lib/payments/card/settings'
import s from './pay.module.css'

const fa = (value: number) => value.toLocaleString('fa-IR')
const faDigits = (text: string) => text.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])
const GUIDE_KEY = 'vigent:pay-intro:'
/** After this long without a transfer, the quiet «tell the seller» link shows up. */
const CLAIM_AFTER_MS = 3 * 60_000
/** How long «your transfer arrived» shows before the card turns over. */
const FOUND_MS = 1100
const RETURN_SECONDS = 5
const tehranTime = (iso: string | number) => new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' }).format(new Date(iso))

type Phase = 'wait' | 'found' | 'paid' | 'closed'

function reducedMotion(): boolean {
	return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

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

/** Counts from zero up to `target` once `run` turns on. */
function useCountUp(target: number, run: boolean, delay: number): number {
	const [value, setValue] = useState(0)
	useEffect(() => {
		if (!run) return
		if (reducedMotion()) {
			setValue(target)
			return
		}
		let frame = 0
		const start = performance.now() + delay
		const step = (now: number) => {
			const t = Math.min(1, Math.max(0, (now - start) / 900))
			setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
			if (t < 1) frame = requestAnimationFrame(step)
		}
		frame = requestAnimationFrame(step)
		return () => cancelAnimationFrame(frame)
	}, [target, run, delay])
	return value
}

function clock(seconds: number): string {
	return faDigits(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`)
}

/**
 * The exact amount, its identifying last digits in the bank's colour. Each
 * character drops in on its own beat, so switching rial ↔ toman rolls the
 * number over instead of swapping it (remount it with a new `key`).
 */
function RollingAmount({ value, tail }: { value: number; tail: number }) {
	const text = groupDigits(value)
	let cut = text.length
	for (let digits = 0; cut > 0 && digits < tail; cut--) if (/\d/.test(text[cut - 1])) digits++
	return (
		<span className={s.roll} dir="ltr">
			{[...text].map((char, index) => (
				<span key={index} className={index >= cut ? s.rollId : undefined} style={{ '--d': `${(text.length - 1 - index) * 26}ms` } as CSSProperties}>{char}</span>
			))}
		</span>
	)
}

/**
 * One of the two copy buttons, in the bank's colour. It stays green with
 * «… کپی شد» so the customer sees what they already took; `next` gives the
 * one to press next a soft shine.
 */
function ActionCopy({ value, label, doneLabel, icon, next, onCopied }: { value: string; label: string; doneLabel: string; icon: ReactNode; next: boolean; onCopied: () => void }) {
	const [done, setDone] = useState(false)
	const [flash, setFlash] = useState(0)
	useEffect(() => setDone(false), [value])
	return (
		<button
			type="button"
			className={s.act}
			data-done={done || undefined}
			data-next={(next && !done) || undefined}
			onClick={async () => {
				if (!(await copyText(value))) return
				setDone(true)
				setFlash((count) => count + 1)
				onCopied()
			}}
		>
			<span className={s.actIcon}>{done ? <Check className={s.okTick} strokeWidth={2.6} aria-hidden /> : icon}</span>
			<span>{done ? doneLabel : label}</span>
			{flash ? <span key={flash} className={s.flash} aria-hidden /> : null}
			<span className="sr-only" role="status">{done ? doneLabel : ''}</span>
		</button>
	)
}

/**
 * A panel that rises from the bottom on phones (drag the handle down to
 * close) and opens in the middle on wider screens.
 */
function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
	const [mounted, setMounted] = useState(open)
	const [shown, setShown] = useState(false)
	const [drag, setDrag] = useState<number | null>(null)
	const startY = useRef(0)
	const panel = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (open) {
			setMounted(true)
			let inner = 0
			const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setShown(true)) })
			return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner) }
		}
		setShown(false)
		const timer = window.setTimeout(() => setMounted(false), 420)
		return () => window.clearTimeout(timer)
	}, [open])

	useEffect(() => {
		if (!open) return
		const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	}, [open, onClose])

	useEffect(() => {
		if (shown) panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
	}, [shown])

	if (!mounted) return null
	return (
		<div className={s.sheetWrap} data-open={shown || undefined}>
			<div className={s.sheetBg} onClick={onClose} aria-hidden />
			<div
				ref={panel}
				role="dialog"
				aria-modal="true"
				aria-label={label}
				tabIndex={-1}
				className={s.sheet}
				data-dragging={drag !== null || undefined}
				style={{ '--drag': `${drag ?? 0}px` } as CSSProperties}
			>
				<div
					className={s.grab}
					aria-hidden
					onPointerDown={(event) => {
						startY.current = event.clientY
						setDrag(0)
						event.currentTarget.setPointerCapture(event.pointerId)
					}}
					onPointerMove={(event) => { if (drag !== null) setDrag(Math.max(0, event.clientY - startY.current)) }}
					onPointerUp={() => {
						if ((drag ?? 0) > 90) onClose()
						setDrag(null)
					}}
					onPointerCancel={() => setDrag(null)}
				>
					<span />
				</div>
				{children}
			</div>
		</div>
	)
}

function ItemsSheetBody({ items, code, baseAmount, amount, onClose }: { items: PayItem[]; code: string; baseAmount: number; amount: number; onClose: () => void }) {
	const tail = amount - baseAmount
	return (
		<>
			<div className={s.shHead}>
				<span className={s.shIcon}><ShoppingBag aria-hidden /></span>
				<div>
					<h2>اقلام سفارش</h2>
					<p>{fa(items.length)} قلم · سفارش <span dir="ltr" className={s.mono}>{code}</span></p>
				</div>
				<button type="button" className={s.shX} onClick={onClose} aria-label="بستن" data-autofocus><X aria-hidden /></button>
			</div>
			<ul className={s.items}>
				{items.map((item, index) => (
					<li key={index} style={{ '--i': index } as CSSProperties}>
						<span className={s.qty}>{fa(item.quantity)} عدد</span>
						<span className={s.itemTx}>
							<b>{item.name}</b>
							{item.unitPrice != null && item.quantity > 1 ? <small>هر عدد {fa(item.unitPrice)} تومان</small> : null}
						</span>
						{item.unitPrice != null ? <span className={s.itemSum}>{fa(item.unitPrice * item.quantity)}</span> : <span />}
					</li>
				))}
			</ul>
			<dl className={s.sum}>
				<div><dt>جمع سفارش</dt><dd>{fa(baseAmount)} تومان</dd></div>
				{tail > 0 ? <div className={s.sumId}><dt>شناسهٔ پرداخت</dt><dd>+{fa(tail)} تومان</dd></div> : null}
				<div className={s.sumTotal}><dt>مبلغ واریز</dt><dd>{fa(amount)} تومان</dd></div>
			</dl>
		</>
	)
}

/** First look at the page, after the ZarinPay guide: three steps and the one rule that matters. */
function GuideBody({ rial, onClose }: { rial: number; onClose: () => void }) {
	return (
		<div className={s.guide}>
			<div className={s.gHead}>
				<span className={s.gIcon}><CircleHelp aria-hidden /></span>
				<span className={s.gTitle}>
					<h2>راهنمای پرداخت آسان</h2>
					<p>حدود یک دقیقه، با همراه‌بانک خودتان</p>
				</span>
				<button type="button" className={s.shX} onClick={onClose} aria-label="بستن"><X aria-hidden /></button>
			</div>
			<ol className={s.gSteps}>
				<li style={{ '--i': 0 } as CSSProperties}><span>۱</span><div><h3>کپی شماره کارت</h3><p>با دکمهٔ «کپی شماره کارت» آن را بردارید.</p></div></li>
				<li style={{ '--i': 1 } as CSSProperties}><span>۲</span><div><h3>واریز مبلغ دقیق</h3><p>دقیقاً <b dir="ltr">{groupDigits(rial)}</b> ریال کارت‌به‌کارت کنید؛ رُند نکنید.</p></div></li>
				<li style={{ '--i': 2 } as CSSProperties}><span>۳</span><div><h3>همین‌جا بمانید</h3><p>واریز که برسد، این صفحه خودش تأیید می‌شود.</p></div></li>
			</ol>
			<div className={s.gNote} role="note">
				<AlertTriangle aria-hidden />
				<p>فقط کارت‌به‌کارت کنید؛ انتقال شبا و پایا دیر می‌رسد و به موقع تأیید نمی‌شود.</p>
			</div>
			<button type="button" className={s.primary} onClick={onClose} data-autofocus>متوجه شدم</button>
		</div>
	)
}

/** The back of the card once the transfer is in: green, a tick, the amount and the reference. */
function PaidCardFace({ bankKey, amount, business, code }: { bankKey: string; amount: number; business: string; code: string }) {
	const bank = bankByKey(bankKey)
	const logo = bankLogoUrl(bank, 'color')
	return (
		<div className={s.okCard} aria-hidden>
			<ShetabArrow />
			<div className={s.okIn}>
				<div className={s.okTop}>
					{logo ? (
						// eslint-disable-next-line @next/next/no-img-element
						<span className={s.okLogo}><img src={logo} alt="" /></span>
					) : <span />}
					<span className={s.okBadge}>پرداخت شد</span>
				</div>
				<div className={s.okMid}>
					<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
					<span className={s.okAmt}>
						<span>به {business}</span>
						<b>{fa(amount)}<small>تومان</small></b>
					</span>
				</div>
				<div className={s.okBot}>
					<span>کد پیگیری</span>
					<b dir="ltr" className={s.mono}>{code}</b>
				</div>
			</div>
		</div>
	)
}

const BURST = Array.from({ length: 14 }, (_, index) => ({
	'--a': `${Math.round((index * 360) / 14 + (index % 2 ? 8 : -6))}deg`,
	'--d': `${90 + (index % 3) * 12}px`,
	'--c': ['var(--ok)', 'var(--violet)', '#f5b301'][index % 3],
})) as CSSProperties[]

const NECK_SIDES = 'M52 .5H51A9 9 0 0 0 42 9.5V10.5A9 9 0 0 0 51 19.5H52M0 .5H1A9 9 0 0 1 10 9.5V10.5A9 9 0 0 1 1 19.5H0'

/**
 * The neck that joins the card's tray to the order below it. Drops of the
 * card's colour rise through it (this amount goes to this card); copying the
 * card number (`shot` changes) sends a brighter one up.
 */
function CardLink({ shot }: { shot: number }) {
	const fill = useId()
	return (
		<div className={s.link} data-shot={shot || undefined} aria-hidden>
			<svg viewBox="0 0 52 20">
				<defs>
					<linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" style={{ stopColor: 'var(--tint)' }} />
						<stop offset="1" style={{ stopColor: 'var(--surface)' }} />
					</linearGradient>
				</defs>
				<path fill={`url(#${fill})`} d="M0 0H52V.5H51A9 9 0 0 0 42 9.5V10.5A9 9 0 0 0 51 19.5H52V20H0V19.5H1A9 9 0 0 0 10 10.5V9.5A9 9 0 0 0 1 .5H0Z" />
				<path className={s.lkEdge} d={NECK_SIDES} />
				<rect className={s.lkPipe} x="24.5" y="1" width="3" height="18" rx="1.5" />
				{[0, 1, 2].map((k) => <circle key={k} className={s.lkDrop} style={{ '--k': k } as CSSProperties} cx="26" cy="17" r={k ? 1.7 : 2.3} />)}
				{shot ? <circle key={shot} className={s.lkShot} cx="26" cy="18" r="3" /> : null}
			</svg>
		</div>
	)
}

/** How much the page is scaled on screen (1 on the real page; less inside a preview frame). */
function scaleOf(element: HTMLElement): number {
	return element.getBoundingClientRect().width / element.offsetWidth || 1
}

/** The header timer's ring flies down and becomes the clock above the card. */
function flyClock(root: HTMLElement, face: HTMLElement, from: DOMRect) {
	const scale = scaleOf(root)
	const box = root.getBoundingClientRect()
	const to = face.getBoundingClientRect()
	const ghost = face.cloneNode(true) as HTMLElement
	ghost.classList.add(s.ghost)
	ghost.style.left = `${(to.left - box.left) / scale}px`
	ghost.style.top = `${(to.top - box.top) / scale + root.scrollTop}px`
	face.setAttribute('data-wait', '')
	root.appendChild(ghost)
	const dx = (from.left + from.width / 2 - to.left - to.width / 2) / scale
	const dy = (from.top + from.height / 2 - to.top - to.height / 2) / scale
	const k = from.width / to.width
	const flight = ghost.animate([
		{ transform: `translate(${dx}px, ${dy}px) scale(${k})` },
		{ transform: `translate(${dx * 0.35}px, ${dy * 0.55}px) scale(${(k + 1) / 2 + 0.15})`, offset: 0.55 },
		{ transform: 'translate(0, 0) scale(1.06)', offset: 0.85 },
		{ transform: 'none' },
	], { duration: 820, easing: 'cubic-bezier(.45,0,.2,1)' })
	const land = () => { face.removeAttribute('data-wait'); ghost.remove() }
	flight.onfinish = land
	flight.oncancel = land
}

/** Confetti from the card as it turns: one burst that falls and fades. */
function confetti(root: HTMLElement, hold: HTMLElement) {
	const scale = scaleOf(root)
	const box = root.getBoundingClientRect()
	const card = hold.getBoundingClientRect()
	const width = root.clientWidth
	const height = root.clientHeight
	const dpr = Math.min(2, window.devicePixelRatio || 1)
	const canvas = document.createElement('canvas')
	canvas.className = s.confetti
	canvas.width = width * dpr
	canvas.height = height * dpr
	canvas.style.cssText = `top:${root.scrollTop}px;width:${width}px;height:${height}px`
	root.appendChild(canvas)
	const ctx = canvas.getContext('2d')
	if (!ctx) { canvas.remove(); return }
	ctx.scale(dpr, dpr)
	const ox = (card.left + card.width / 2 - box.left) / scale
	const oy = (card.top + card.height * 0.42 - box.top) / scale
	const spread = (card.width / scale) * 0.42
	const colors = ['#16b37d', '#0e9a69', '#f5c518', 'var(--bank-l)', '#38bdf8', '#a78bfa']
	const bank = getComputedStyle(root).getPropertyValue('--bank-l').trim() || '#7b61ff'
	const pieces = Array.from({ length: 120 }, (_, index) => {
		const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3
		const speed = 5 + Math.random() * 8
		return {
			x: ox + (Math.random() - 0.5) * spread,
			y: oy + (Math.random() - 0.5) * 20,
			vx: Math.cos(angle) * speed,
			vy: Math.sin(angle) * speed - 2,
			w: 4 + Math.random() * 4,
			h: 7 + Math.random() * 6,
			turn: Math.random() * 6.28,
			spin: (Math.random() - 0.5) * 0.4,
			wobble: Math.random() * 6.28,
			color: colors[index % colors.length] === 'var(--bank-l)' ? bank : colors[index % colors.length],
			round: index % 5 === 0,
		}
	})
	const LIFE = 2700
	const start = performance.now()
	let last = start
	const frame = (now: number) => {
		const dt = Math.min(34, now - last) / 16.7
		last = now
		const age = now - start
		const fade = Math.max(0, Math.min(1, (LIFE - age) / 700))
		ctx.clearRect(0, 0, width, height)
		for (const p of pieces) {
			p.vy += 0.3 * dt
			p.vx *= Math.pow(0.982, dt)
			p.vy *= Math.pow(0.985, dt)
			p.x += p.vx * dt
			p.y += p.vy * dt
			p.turn += p.spin * dt
			p.wobble += 0.14 * dt
			ctx.save()
			ctx.globalAlpha = fade
			ctx.translate(p.x, p.y)
			ctx.rotate(p.turn)
			ctx.scale(1, Math.cos(p.wobble))
			ctx.fillStyle = p.color
			if (p.round) {
				ctx.beginPath()
				ctx.arc(0, 0, p.w * 0.6, 0, Math.PI * 2)
				ctx.fill()
			} else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
			ctx.restore()
		}
		if (age < LIFE) requestAnimationFrame(frame)
		else canvas.remove()
	}
	requestAnimationFrame(frame)
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
	const [returnUrl, setReturnUrl] = useState<string | null>(null)
	const [returning, setReturning] = useState<number | null>(null)
	// A claim made after the deadline keeps the expired page, now waiting on the owner's review.
	const lateClaim = card.status === 'CLAIMED' && new Date(card.expiresAt).getTime() < Date.now()
	const [initialPhase] = useState<Phase>((card.status === 'PENDING' || card.status === 'CLAIMED' || card.status === 'PAID') && !lateClaim ? 'wait' : 'closed')
	const [phase, setPhase] = useState<Phase>(initialPhase)
	// Once the deadline has passed on this page, a late success keeps the order folded away.
	const [lapsedOnce, setLapsedOnce] = useState(initialPhase === 'closed')
	// The timer and the help button leave with a short exit instead of vanishing.
	const [leaving, setLeaving] = useState(false)
	const rootRef = useRef<HTMLElement>(null)
	const holdRef = useRef<HTMLDivElement>(null)
	const faceRef = useRef<HTMLSpanElement>(null)
	const ringRef = useRef<SVGSVGElement>(null)
	const flightFrom = useRef<DOMRect | null>(null)
	const celebrate = useRef(false)
	// The amount stays held this long after the deadline, so a late transfer or claim still counts.
	const heldUntil = new Date(card.expiresAt).getTime() + LATE_SMS_GRACE_MS

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
		} catch { /* the customer stays on the confirmed page */ }
	}, [card.authority, card.code, hasReturn])

	/** The deadline passes in front of the customer: everything they no longer need folds away. */
	const lapse = useCallback(() => {
		if (ringRef.current && !reducedMotion()) flightFrom.current = ringRef.current.getBoundingClientRect()
		setLeaving(true)
		window.setTimeout(() => setLeaving(false), 340)
		setLapsedOnce(true)
		setPhase((current) => (current === 'wait' ? 'closed' : current))
	}, [])

	const { status, paidAt, apply } = useCardPayStatus(card.authority, card.status, {
		onChange: (next: CardPayStatus) => {
			if (next === 'PAID') {
				// The moment of truth: «your transfer arrived», then the card turns over.
				celebrate.current = true
				setPhase('found')
				window.setTimeout(() => setPhase('paid'), FOUND_MS)
				void goBack()
			} else if (next === 'EXPIRED') lapse()
			else if (next !== 'PENDING' && next !== 'CLAIMED') setPhase('closed')
		},
		// Past the deadline the amount is still held for a late SMS; keep listening for it.
		watch: (next) => next === 'EXPIRED' && Date.now() < heldUntil,
	})

	// Opened when it was already paid: still play the turn, after the card lands.
	useEffect(() => {
		if (card.status !== 'PAID') return
		const timer = window.setTimeout(() => setPhase('paid'), 650)
		return () => window.clearTimeout(timer)
	}, [card.status])

	const open = status === 'PENDING' || status === 'CLAIMED'
	const seconds = useSecondsLeft(card.expiresAt, status === 'PENDING')
	const total = Math.max(seconds, Math.round((new Date(card.expiresAt).getTime() - new Date(createdAt).getTime()) / 1000))

	// The timer reaching zero closes the page right away; the server's own sweep may come a little later.
	useEffect(() => {
		if (status === 'PENDING' && seconds === 0 && phase === 'wait') lapse()
	}, [status, seconds, phase, lapse])

	useLayoutEffect(() => {
		if (phase !== 'closed' || !flightFrom.current) return
		const from = flightFrom.current
		flightFrom.current = null
		if (rootRef.current && faceRef.current) flyClock(rootRef.current, faceRef.current, from)
	}, [phase])

	// A transfer confirmed while the customer watched: confetti as the card turns, and a short buzz.
	useEffect(() => {
		if (phase !== 'paid' || !celebrate.current) return
		celebrate.current = false
		try { navigator.vibrate?.([14, 60, 26]) } catch { /* not on this device */ }
		if (reducedMotion()) return
		const timer = window.setTimeout(() => { if (rootRef.current && holdRef.current) confetti(rootRef.current, holdRef.current) }, 720)
		return () => window.clearTimeout(timer)
	}, [phase])

	const [unit, setUnit] = useState<'rial' | 'toman'>('rial')
	const [copied, setCopied] = useState({ pan: false, amount: false })
	const [cardPing, setCardPing] = useState(0)
	const [amountPing, setAmountPing] = useState(0)
	const [guide, setGuide] = useState(false)
	const [itemsOpen, setItemsOpen] = useState(false)
	const [claimShown, setClaimShown] = useState(false)
	const [claiming, setClaiming] = useState(false)
	const [claimFailed, setClaimFailed] = useState(false)
	const shown = useCountUp(card.amount, phase === 'paid', 600)

	useEffect(() => {
		if (card.status !== 'PENDING') return
		try {
			if (!window.sessionStorage.getItem(GUIDE_KEY + card.authority)) setGuide(true)
		} catch { setGuide(true) }
	}, [card.authority, card.status])
	const closeGuide = useCallback(() => {
		setGuide(false)
		try { window.sessionStorage.setItem(GUIDE_KEY + card.authority, '1') } catch { /* private mode */ }
	}, [card.authority])
	const closeItems = useCallback(() => setItemsOpen(false), [])

	useEffect(() => {
		if (!card.claim || status !== 'PENDING') return
		const timer = window.setTimeout(() => setClaimShown(true), CLAIM_AFTER_MS)
		return () => window.clearTimeout(timer)
	}, [card.claim, status])

	// Back to the shop a few seconds after the card has turned.
	useEffect(() => {
		if (!returnUrl || phase !== 'paid') return
		const timer = window.setTimeout(() => setReturning(RETURN_SECONDS), 1400)
		return () => window.clearTimeout(timer)
	}, [returnUrl, phase])
	useEffect(() => {
		if (returning == null || !returnUrl) return
		if (returning <= 0) { window.location.assign(returnUrl); return }
		const timer = window.setTimeout(() => setReturning(returning - 1), 1000)
		return () => window.clearTimeout(timer)
	}, [returning, returnUrl])

	async function claim() {
		setClaiming(true)
		setClaimFailed(false)
		try {
			const response = await fetch(`/api/pay/status/${card.authority}`, { method: 'POST' })
			const data = (await response.json().catch(() => null)) as { status?: CardPayStatus } | null
			if (data?.status) apply(data.status)
			// Still expired: the hold ran out or today's claims are used up.
			if (!response.ok || data?.status === 'EXPIRED') setClaimFailed(true)
		} catch {
			setClaimFailed(true)
		} finally {
			setClaiming(false)
		}
	}

	const bank = bankByKey(card.bankKey)
	const rial = card.amount * 10
	const copyValue = unit === 'rial' ? rial : card.amount
	const confirmedAt = paidAt ?? initialPaidAt
	const time = confirmedAt ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(new Date(confirmedAt)) : '—'
	const subject = card.title ?? description
	const first = items[0]
	const initial = business.trim().slice(0, 1) || 'و'
	const site = website ? website.replace(/^https?:\/\//, '').replace(/\/$/, '') : null
	const length = 2 * Math.PI * 15
	const closed = phase === 'closed'
	const final = status === 'FAILED' || status === 'CANCELLED'
	const minutes = Math.max(1, Math.round((new Date(card.expiresAt).getTime() - new Date(createdAt).getTime()) / 60_000))
	const lateBox = card.claim && !final && (status === 'CLAIMED' || Date.now() < heldUntil)

	const orderLine = first
		? <><ShoppingBag aria-hidden /><span>{first.name}{first.quantity > 1 ? ` (${fa(first.quantity)} عدد)` : ''}</span>{items.length > 1 ? <span className={s.more}>+{fa(items.length - 1)} قلم</span> : null}</>
		: <span>{subject ?? `پرداخت به ${business}`}</span>
	const orderBody = (
		<>
			<span className={s.orderL}>
				<span className={s.orderCode}>سفارش <span dir="ltr" className={s.mono}>{card.code}</span></span>
				<span className={s.orderLine}>{orderLine}</span>
			</span>
			<span className={s.orderT}><b>{fa(baseAmount)}</b><small>تومان</small></span>
			{items.length ? <ChevronLeft className={s.chev} aria-hidden /> : null}
		</>
	)

	const live = status === 'CLAIMED' ? (
		<div className={s.live} data-tone="review" role="status" aria-live="polite">
			<Clock3 className={s.radar} aria-hidden />
			<span className={s.liveTx}><b>واریز شما در حال بررسی است</b><span>{business} حسابش را نگاه می‌کند؛ نتیجه همین‌جا می‌آید.</span></span>
		</div>
	) : (
		<div className={s.live} role="status" aria-live="polite">
			{phase === 'found' ? (
				<>
					<svg className={s.spin} viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" /></svg>
					<span className={s.liveTx}><b>واریز {fa(rial)} ریالی شما رسید</b><span>در حال ثبت پرداخت…</span></span>
				</>
			) : (
				<>
					<span className={s.radar} aria-hidden><i /><i /><b /></span>
					<span className={s.liveTx}><b>منتظر واریز شما هستیم</b><span>هر ۵ ثانیه خودکار بررسی می‌کنیم.</span></span>
					<svg className={s.poll} viewBox="0 0 20 20" aria-hidden><circle cx="10" cy="10" r="8" /><circle cx="10" cy="10" r="8" /></svg>
				</>
			)}
		</div>
	)

	const head = status === 'FAILED' ? (
		<div className={s.final}>
			<span className={s.finalIcon} data-tone="bad"><XCircle aria-hidden /></span>
			<h1>واریزی پیدا نشد</h1>
			<p>{business} واریزی با این مبلغ در حسابش پیدا نکرد. اگر واریز کرده‌اید، رسید همراه‌بانک را برایش بفرستید.</p>
		</div>
	) : status === 'CANCELLED' ? (
		<div className={s.final}>
			<span className={s.finalIcon}><XCircle aria-hidden /></span>
			<h1>این پرداخت لغو شده</h1>
			<p>لطفاً واریز نکنید. اگر هنوز می‌خواهید خرید کنید، با {business} در تماس باشید.</p>
		</div>
	) : (
		<div className={s.exp}>
			<span ref={faceRef} className={s.clockFace} aria-hidden>
				<svg viewBox="0 0 46 46">
					<circle className={s.clockTrack} cx="23" cy="23" r="19" />
					<circle className={s.clockRest} cx="23" cy="23" r="19" pathLength={100} />
					<path className={s.clockHand} d="M23 23V11" />
					<circle className={s.clockHub} cx="23" cy="23" r="2.4" />
				</svg>
			</span>
			<h1>مهلت پرداخت تمام شد</h1>
			<span className={s.expWhen}><Clock3 aria-hidden />مهلت {fa(minutes)} دقیقه‌ای، ساعت {tehranTime(card.expiresAt)} تمام شد</span>
		</div>
	)

	const secText = phase === 'paid'
		? `پرداخت شما در حساب ${business} ثبت شد.`
		: closed
			? `به این کارت دیگر واریز نکنید؛ برای خرید، از ${business} لینک تازه بخواهید.`
			: 'این مبلغ را به همین شماره کارت واریز کنید تا خودکار تأیید شود.'

	return (
		<main
			ref={rootRef}
			dir="rtl"
			lang="fa"
			className={`${s.root} ${lapsedOnce ? s.lapsed : ''}`}
			data-phase={phase}
			style={{ '--bank-l': bank.colors[1], '--bank-d': bank.colors[0] } as CSSProperties}
		>
			<span className={s.amb} aria-hidden />
			<span className={s.ambOk} aria-hidden />

			<header className={`${s.top} ${s.rise}`}>
				<div className={s.mer}>
					<span className={s.merAv} aria-hidden>{initial}</span>
					<span className={s.merTx}>
						<b>{business}</b>
						<span className={s.merSub}><BadgeCheck aria-hidden /><span>{site ? <span dir="ltr">{site}</span> : 'فروشندهٔ ثبت‌شده در ویجنت'}</span></span>
					</span>
				</div>
				<div className={s.topEnd}>
					<span className={s.topCode}>سفارش <span dir="ltr" className={s.mono}>{card.code}</span></span>
					{(open && !closed) || leaving ? (
						<button type="button" className={`${s.help} ${leaving ? s.gone : ''}`} onClick={() => setGuide(true)} aria-label="راهنمای پرداخت"><CircleHelp aria-hidden /></button>
					) : null}
					{(status === 'PENDING' && !closed) || leaving ? (
						<span className={`${s.timer} ${leaving ? s.gone : ''}`} data-low={seconds < 180 || undefined} data-final={(seconds > 0 && seconds <= 5) || undefined} title="مهلت پرداخت">
							<svg ref={ringRef} viewBox="0 0 36 36" aria-hidden>
								<circle cx="18" cy="18" r="15" />
								<circle cx="18" cy="18" r="15" strokeDasharray={length} strokeDashoffset={length * (1 - (total > 0 ? Math.min(1, seconds / total) : 0))} />
							</svg>
							<span dir="ltr">{clock(seconds)}</span>
						</span>
					) : null}
				</div>
			</header>

			<section className={s.col}>
				<div className={`${s.fold} ${s.foldIn}`}>
					<div>
						<div className={s.paidHead} role="status" aria-live="polite">
							{phase === 'paid' ? <><h1>پرداخت شما تأیید شد</h1><p><b>{fa(shown)}</b> تومان به {business}</p></> : null}
						</div>
					</div>
				</div>

				<div className={`${s.fold} ${s.foldLapse}`} inert={!closed}>
					<div>{head}</div>
				</div>

				<div ref={holdRef} className={s.hold}>
					<span className={s.trayGlow} aria-hidden />
					<span className={s.wave} aria-hidden />
					<span className={s.wave} aria-hidden />
					<div className={s.flip}>
						<div className={s.flipIn}>
							<div className={s.front}>
								<BankCardFace bankKey={card.bankKey} pan={card.pan} holder={card.holder} lang="fa" />
								{cardPing ? <span key={cardPing} className={s.ping} style={{ animationDelay: '.3s' }} aria-hidden /> : null}
								<span className={s.scan} aria-hidden />
							</div>
							<div className={s.back}>
								<PaidCardFace bankKey={card.bankKey} amount={card.amount} business={business} code={card.code} />
							</div>
						</div>
					</div>
					<span className={s.dots} aria-hidden>{BURST.map((style, index) => <i key={index} style={style} />)}</span>
					{cardPing ? <span key={`hit-${cardPing}`} className={s.trayHit} aria-hidden /> : null}
					<div className={`${s.fold} ${s.foldIn}`}>
						<div>
							<dl className={s.receipt}>
								<div><dt>کد پیگیری</dt><dd dir="ltr" className={s.mono}>{card.code}</dd></div>
								<div><dt>زمان تأیید</dt><dd>{time}</dd></div>
								<div><dt>واریز به</dt><dd>{bank.fa} · <span dir="ltr" className={s.mono}>•••• {card.pan.slice(-4)}</span></dd></div>
								<div><dt>بابت</dt><dd>{items.length > 1 ? `${fa(items.length)} قلم کالا` : first?.name ?? subject ?? `سفارش ${card.code}`}</dd></div>
							</dl>
						</div>
					</div>
				</div>

				{initialPhase !== 'closed' || phase === 'found' || phase === 'paid' ? (
					<>
						<CardLink shot={cardPing} />
						<div className={`${s.fold} ${s.foldOut}`} inert={closed}>
							<div className={s.foldBody}>
								<div className={`${s.order} ${s.rise}`} style={{ '--i': 2 } as CSSProperties}>
									{items.length ? (
										<button type="button" className={s.itemsBtn} onClick={() => setItemsOpen(true)} aria-label="دیدن اقلام سفارش">{orderBody}</button>
									) : <span className={s.itemsBtn} style={{ cursor: 'default' }}>{orderBody}</span>}
								</div>
								<div className={`${s.acts} ${s.rise}`} style={{ '--i': 3 } as CSSProperties}>
									<ActionCopy
										value={card.pan}
										label="کپی شماره کارت"
										doneLabel="شماره کارت کپی شد"
										icon={<CreditCard aria-hidden />}
										next={!copied.pan}
										onCopied={() => { setCopied((state) => ({ ...state, pan: true })); setCardPing((count) => count + 1) }}
									/>
									<ActionCopy
										value={String(copyValue)}
										label={`کپی مبلغ (${unit === 'rial' ? 'ریال' : 'تومان'})`}
										doneLabel="مبلغ کپی شد"
										icon={<Banknote aria-hidden />}
										next={copied.pan && !copied.amount}
										onCopied={() => { setCopied((state) => ({ ...state, amount: true })); setAmountPing((count) => count + 1) }}
									/>
								</div>
								<div className={`${s.amt} ${s.rise}`} style={{ '--i': 4 } as CSSProperties}>
									<div className={s.amtHead}>
										<span className={s.label}>مبلغ دقیق واریز · <b>رُند نکنید</b></span>
										<span className={s.seg} data-unit={unit} role="group" aria-label="واحد مبلغ">
											{(['rial', 'toman'] as const).map((value) => (
												<button key={value} type="button" aria-pressed={unit === value} onClick={() => setUnit(value)}>
													{value === 'rial' ? 'ریال' : 'تومان'}
												</button>
											))}
										</span>
									</div>
									<div className={s.amtVal} aria-live="polite">
										<RollingAmount key={unit} value={copyValue} tail={unit === 'rial' ? 4 : 3} />
										<span key={`u-${unit}`} className={s.unit}>{unit === 'rial' ? 'ریال' : 'تومان'}</span>
										{amountPing ? <span key={amountPing} className={s.amtPing} aria-hidden /> : null}
									</div>
									<p className={s.hint}>رقم‌های <b>رنگی</b> شناسهٔ پرداخت شماست.</p>
								</div>
							</div>
						</div>
					</>
				) : null}

				<div className={`${s.foot} ${s.rise}`} style={{ '--i': 4 } as CSSProperties} inert={closed}>
					{live}
					<div className={s.done}>
						{returnUrl ? (
							<a href={returnUrl} className={s.primary}>
								{returning != null ? <span className={s.fill} style={{ '--fill-s': `${RETURN_SECONDS}s` } as CSSProperties} /> : null}
								<span>بازگشت به {site ?? 'فروشگاه'}</span>
								{returning != null ? <span className={s.count}>{fa(Math.max(0, returning))}</span> : null}
							</a>
						) : null}
						<p>{business} هم خبردار شد. رسید در همین لینک می‌ماند{returnUrl ? '.' : '؛ می‌توانید صفحه را ببندید.'}</p>
					</div>
				</div>

				{lateBox ? (
					<div className={`${s.fold} ${s.foldLapse} ${s.foldLate}`} inert={!closed}>
						<div>
							<div className={s.late}>
								{status === 'CLAIMED' ? (
									<div className={s.live} data-tone="review" role="status" aria-live="polite">
										<Clock3 className={s.radar} aria-hidden />
										<span className={s.liveTx}><b>به {business} خبر دادیم</b><span>حسابش را نگاه می‌کند؛ نتیجه همین‌جا می‌آید.</span></span>
									</div>
								) : (
									<>
										<span className={s.lateTx}>
											<b>واریز کرده‌اید؟</b>
											<span>پیامک بانک تا ساعت {tehranTime(heldUntil)} هنوز تأییدش می‌کند. زودتر می‌خواهید؟ به {business} خبر بدهید.</span>
										</span>
										<button type="button" className={s.primary} disabled={claiming} onClick={claim}>
											<Check aria-hidden /><span>{claiming ? 'در حال ارسال…' : 'واریز کرده‌ام'}</span>
										</button>
										{claimFailed ? <p className={s.lateErr} role="alert">الان ثبت نشد. رسید همراه‌بانک را مستقیم برای {business} بفرستید.</p> : null}
									</>
								)}
							</div>
						</div>
					</div>
				) : null}

				{claimShown && status === 'PENDING' && phase === 'wait' ? (
					<button type="button" className={s.claim} disabled={claiming} onClick={claim}>واریز کردید و تأیید نشد؟ به {business} خبر بدهید</button>
				) : null}
			</section>

			<p className={s.sec}><ShieldCheck aria-hidden /><span key={secText} className={s.secT}>{secText}</span></p>

			<Sheet open={itemsOpen} onClose={closeItems} label="اقلام سفارش">
				<ItemsSheetBody items={items} code={card.code} baseAmount={baseAmount} amount={card.amount} onClose={closeItems} />
			</Sheet>
			<Sheet open={guide && open && !closed} onClose={closeGuide} label="راهنمای پرداخت">
				<GuideBody rial={rial} onClose={closeGuide} />
			</Sheet>
		</main>
	)
}
