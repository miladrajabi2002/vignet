'use client'

import Link from 'next/link'
import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Bot, CalendarCheck2, CheckCircle2, MessagesSquare, MoreHorizontal, Package, Plug, Plus, UserPlus, type LucideIcon } from 'lucide-react'
import { CHANNEL_TONES, ChannelMark, type ChannelKey } from '@/components/ui/channel-mark'
import { BankCardFace } from '@/components/payments/bank-card'
import { bankByKey } from '@/lib/payments/card/bins'
import type { GatewayWeek } from '@/lib/payments/card/dashboard'
import { cn } from '@/lib/utils'

/*
 * The overview's 7-day flow as a live stage: the connected apps sit on an
 * arc on the start side, the agent in the middle, the outcomes on the end
 * side. Messages fly in as bubbles from each app (faster from the busier
 * ones), the agent sends each on to an outcome, and once the payment
 * gateway is live the week's latest payments replay as coins dropping onto
 * the card they reached, with a ticker beside the cards.
 *
 * The bubbles are a picture of the week's volume, not real messages; every
 * number on the stage is real. The geometry follows the stage's measured
 * width (an arc from ~480px, a top-to-bottom stage below that). Motion runs
 * only on screen and never with reduced motion.
 */

type Locale = 'fa' | 'en'
export type FlowInput = { channel: ChannelKey; count: number; connected: boolean }
export type FlowOutput = {
	key: 'resolved' | 'handoff' | 'contacts' | 'bookings' | 'orders' | 'open'
	label: string
	value: number
	href: string
	tone: 'ok' | 'warn' | 'signal' | 'ink'
}

const CHANNEL_NAMES: Record<ChannelKey, { fa: string; en: string }> = {
	INSTAGRAM: { fa: 'اینستاگرام', en: 'Instagram' },
	TELEGRAM: { fa: 'تلگرام', en: 'Telegram' },
	BALE: { fa: 'بله', en: 'Bale' },
	RUBIKA: { fa: 'روبیکا', en: 'Rubika' },
	WEB_WIDGET: { fa: 'ویجت سایت', en: 'Website' },
	CHAT_LINK: { fa: 'چت لینک', en: 'Chat link' },
	WHATSAPP: { fa: 'واتساپ', en: 'WhatsApp' },
	API: { fa: 'API', en: 'API' },
}
const OUTPUT_ICONS: Record<FlowOutput['key'], LucideIcon> = {
	resolved: CheckCircle2,
	handoff: AlertCircle,
	contacts: UserPlus,
	bookings: CalendarCheck2,
	orders: Package,
	open: MessagesSquare,
}
const TONE_TILE: Record<FlowOutput['tone'], string> = {
	ok: 'bg-[var(--ok-soft)] text-[var(--ok-ink)]',
	warn: 'bg-[var(--warn-soft)] text-[var(--warn-ink)]',
	signal: 'bg-[var(--signal-soft)] text-[var(--signal-strong)]',
	ink: 'bg-[var(--text-primary)] text-white',
}
const TONE_COLOR: Record<FlowOutput['tone'], string> = { ok: '#16a34a', warn: '#f59e0b', signal: '#5b3de8', ink: '#111111' }
const OTHER_COLOR = '#8a8580'
const GHOSTS: ChannelKey[] = ['INSTAGRAM', 'TELEGRAM', 'WEB_WIDGET']
const SVG_NS = 'http://www.w3.org/2000/svg'
const NARROW_BELOW = 480

type Pt = { x: number; y: number }
type Lane = { a: Pt; c: Pt; b: Pt }
type Item = { key: ChannelKey | 'OTHER'; count: number; names?: string[]; ghost?: boolean }
type Geo = {
	narrow: boolean
	W: number
	H: number
	C: Pt
	R: number
	node: number
	ins: (Pt & { lane: Lane })[]
	outs: (Pt & { lane: Lane; w: number })[]
	coin: Lane | null
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
function unit(a: Pt, b: Pt): Pt {
	const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1
	return { x: dx / l, y: dy / l }
}
const quad = (L: Lane, t: number): Pt => ({
	x: (1 - t) * (1 - t) * L.a.x + 2 * (1 - t) * t * L.c.x + t * t * L.b.x,
	y: (1 - t) * (1 - t) * L.a.y + 2 * (1 - t) * t * L.c.y + t * t * L.b.y,
})
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const lanePath = (L: Lane) => `M${L.a.x.toFixed(1)} ${L.a.y.toFixed(1)}Q${L.c.x.toFixed(1)} ${L.c.y.toFixed(1)} ${L.b.x.toFixed(1)} ${L.b.y.toFixed(1)}`

/** The arc: apps on the start side, outcomes on the end side, the agent between. */
function wideGeo(W: number, nIn: number, nOut: number, rtl: boolean, coin: boolean): Geo {
	const dir = rtl ? 1 : -1
	const H = 306, C = { x: W / 2, y: 162 }, R = 46, node = nIn >= 6 ? 34 : 38
	// A narrow stage flattens the arc so the top and bottom nodes keep clear of the agent's name.
	const curve = W >= 600 ? 0.5 : 0.2
	const rx = clamp(W / 2 - 100, 150, 236), rxo = clamp(W / 2 - 78, 150, 226)
	const angle = (i: number, n: number) => ((n === 1 ? 0 : -50 + (100 * i) / (n - 1)) * Math.PI) / 180
	// Apps are spaced evenly top to bottom (never closer than ~38px), then pushed onto the arc.
	const span = nIn === 1 ? 0 : Math.min(114, 52 + 22 * (nIn - 1))
	const ins = Array.from({ length: nIn }, (_, i) => {
		const y = nIn === 1 ? C.y : C.y - span + (2 * span * i) / (nIn - 1)
		const a = Math.asin((y - C.y) / 124)
		const p = { x: C.x + dir * rx * (1 - curve + curve * Math.cos(a)), y }
		const c = { x: C.x + (p.x - C.x) * 0.42, y: p.y }
		const u0 = unit(p, c), u1 = unit(c, C)
		return { ...p, lane: { a: { x: p.x + u0.x * (node / 2 + 5), y: p.y + u0.y * (node / 2 + 5) }, c, b: { x: C.x - u1.x * (R + 3), y: C.y - u1.y * (R + 3) } } }
	})
	const outs = Array.from({ length: nOut }, (_, j) => {
		const a = angle(j, nOut)
		const p = { x: C.x - dir * rxo * (1 - curve + curve * Math.cos(a)), y: C.y + 106 * Math.sin(a) }
		const b = { x: p.x + dir * 75, y: p.y }
		const c = { x: C.x - (C.x - b.x) * 0.5, y: b.y }
		const u = unit(C, c)
		return { ...p, w: 150, lane: { a: { x: C.x + u.x * (R + 3), y: C.y + u.y * (R + 3) }, c, b } }
	})
	return {
		narrow: false, W, H, C, R, node, ins, outs,
		coin: coin ? { a: { x: C.x, y: C.y + R }, c: { x: C.x, y: (C.y + H) / 2 + 30 }, b: { x: C.x, y: H + 44 } } : null,
	}
}

/** Phones: apps across the top, the agent, the outcomes in one row. */
function narrowGeo(W: number, nIn: number, nOut: number, rtl: boolean): Geo {
	const H = 392, C = { x: W / 2, y: 182 }, R = 40, node = 36, tilesY = 304
	const iw = W / nIn, tw = (W - 6 * (nOut - 1)) / nOut
	const ins = Array.from({ length: nIn }, (_, i) => {
		const x = rtl ? W - iw * (i + 0.5) : iw * (i + 0.5)
		const y = 22 + 16 * Math.pow((x - C.x) / C.x, 2)
		const a = { x, y: y + 54 }, c = { x, y: (a.y + C.y - R) / 2 + 18 }, u = unit(c, C)
		return { x, y, lane: { a, c, b: { x: C.x - u.x * (R + 3), y: C.y - u.y * (R + 3) } } }
	})
	const outs = Array.from({ length: nOut }, (_, j) => {
		const x = rtl ? W - (j + 0.5) * tw - j * 6 : (j + 0.5) * tw + j * 6
		const a = { x: C.x, y: C.y + R + 50 }
		return { x, y: tilesY, w: tw, lane: { a, c: { x, y: a.y + 6 }, b: { x, y: tilesY } } }
	})
	return { narrow: true, W, H, C, R, node, ins, outs, coin: null }
}

function group(inputs: FlowInput[], max: number, locale: Locale): Item[] {
	const sorted = [...inputs].sort((a, b) => b.count - a.count)
	if (sorted.length <= max) return sorted.map((input) => ({ key: input.channel, count: input.count }))
	const top = sorted.slice(0, max - 1), rest = sorted.slice(max - 1)
	return [
		...top.map((input) => ({ key: input.channel, count: input.count })),
		{ key: 'OTHER' as const, count: rest.reduce((sum, input) => sum + input.count, 0), names: rest.map((input) => CHANNEL_NAMES[input.channel][locale]) },
	]
}

// useLayoutEffect warns on the server; the stage only measures in the browser.
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function LiveStage({
	locale,
	agentName,
	automationRate,
	inputs,
	outputs,
	gateway,
}: {
	locale: Locale
	agentName: string
	automationRate: number | null
	inputs: FlowInput[]
	outputs: FlowOutput[]
	/** The live payment gateway's week; null until it is live. */
	gateway: GatewayWeek | null
}) {
	const fa = locale === 'fa'
	const rtl = fa
	const nf = useMemo(() => new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US'), [fa])
	const fmt = (value: number) => nf.format(value)
	const gid = useId().replace(/[^a-zA-Z0-9]/g, '')

	const rootRef = useRef<HTMLDivElement>(null)
	const fxRef = useRef<SVGGElement>(null)
	const coreRef = useRef<HTMLSpanElement>(null)
	const outRefs = useRef<(HTMLAnchorElement | null)[]>([])
	const walletRef = useRef<WalletHandle>(null)

	const [width, setWidth] = useState<number | null>(null)
	const [motion, setMotion] = useState(false)
	const [onScreen, setOnScreen] = useState(false)

	useBrowserLayoutEffect(() => {
		const el = rootRef.current
		if (!el) return
		const measure = () => setWidth(Math.round(el.clientWidth))
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	useEffect(() => {
		const query = window.matchMedia('(prefers-reduced-motion: reduce)')
		const sync = () => setMotion(!query.matches)
		sync()
		query.addEventListener('change', sync)
		const el = rootRef.current
		const io = el ? new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.15 }) : null
		if (el && io) io.observe(el)
		return () => {
			query.removeEventListener('change', sync)
			io?.disconnect()
		}
	}, [])

	const total = inputs.reduce((sum, input) => sum + input.count, 0)
	const empty = inputs.length === 0
	const narrow = width !== null && width < NARROW_BELOW
	const items: Item[] = useMemo(
		() => (empty ? GHOSTS.map((key) => ({ key, count: 0, ghost: true })) : group(inputs, narrow ? 5 : 7, locale)),
		[empty, inputs, narrow, locale],
	)
	const payments = gateway?.recent.filter((payment) => gateway.cards.some((card) => card.id === payment.cardId)) ?? []
	const coins = Boolean(gateway && gateway.cards.length && payments.length)
	const geo = useMemo(() => {
		if (width === null) return null
		return width < NARROW_BELOW ? narrowGeo(width, items.length, outputs.length, rtl) : wideGeo(width, items.length, outputs.length, rtl, coins)
	}, [width, items.length, outputs.length, rtl, coins])

	const low = automationRate !== null && automationRate < 50
	const itemName = (item: Item, short = false) =>
		item.key === 'OTHER'
			? short ? (fa ? `${fmt(item.names?.length ?? 0)}+ دیگر` : `+${fmt(item.names?.length ?? 0)} more`) : fa ? `${fmt(item.names?.length ?? 0)} کانال دیگر` : `${fmt(item.names?.length ?? 0)} more`
			: CHANNEL_NAMES[item.key][locale]
	const itemColor = (item: Item) => (item.ghost ? '#c9c5bf' : item.key === 'OTHER' ? OTHER_COLOR : CHANNEL_TONES[item.key].color)

	/* The motion: bubbles from the apps, dots to the outcomes, coins to the cards. */
	useEffect(() => {
		const fx = fxRef.current
		if (!geo || !fx || !motion || !onScreen || (!total && !coins)) return
		type Particle = { lane: Lane; t: number; dur: number; g: SVGGElement; accel?: boolean; done?: () => void }
		const particles: Particle[] = []
		const timers: number[] = []
		const later = (ms: number, fn: () => void) => { timers.push(window.setTimeout(fn, ms)) }
		const spawn = (markup: string) => {
			const g = document.createElementNS(SVG_NS, 'g')
			g.innerHTML = markup
			g.setAttribute('opacity', '0')
			fx.appendChild(g)
			return g
		}
		const bump = (el: Element | null | undefined, scale: number) => {
			if (!el) return
			const base = getComputedStyle(el).transform
			const from = base === 'none' ? 'none' : base
			el.animate([{ transform: from }, { transform: `${base === 'none' ? '' : base} scale(${scale})`.trim() }, { transform: from }], { duration: 320, easing: 'ease-out' })
		}
		const index = (key: FlowOutput['key']) => outputs.findIndex((output) => output.key === key)
		const value = (key: FlowOutput['key']) => outputs.find((output) => output.key === key)?.value ?? 0
		const resolved = value('resolved'), handoff = value('handoff')
		const extra = outputs.find((output) => output.key === 'orders' || output.key === 'bookings')
		const send = (j: number) => {
			if (j < 0 || !outputs[j]?.value) return
			const color = TONE_COLOR[outputs[j].tone]
			particles.push({ lane: geo.outs[j].lane, t: 0, dur: geo.narrow ? 0.8 : 1.05, g: spawn(`<circle r="8" fill="${color}" fill-opacity=".18"/><circle r="4" fill="${color}"/>`), done: () => bump(outRefs.current[j], 1.06) })
		}
		const route = () => {
			const r = Math.random() * Math.max(1, total)
			if (r < resolved) send(index('resolved'))
			else if (r < resolved + handoff) send(index('handoff'))
			else send(index('open'))
			if (Math.random() < (value('contacts') / Math.max(1, total)) * 1.4) later(240, () => send(index('contacts')))
			if (extra && Math.random() < (extra.value / Math.max(1, resolved)) * 1.6) later(420, () => send(index(extra.key)))
		}
		const message = (i: number) => {
			const color = itemColor(items[i])
			particles.push({
				lane: geo.ins[i].lane,
				t: 0,
				dur: geo.narrow ? 1.2 : 1.55,
				g: spawn(`<rect x="-9" y="-7" width="18" height="13" rx="5" fill="${color}"/><path d="M-5 5.5-8 10 0 5.5z" fill="${color}"/><circle cx="-4" cy="-.5" r="1.1" fill="#fff"/><circle cx="0" cy="-.5" r="1.1" fill="#fff"/><circle cx="4" cy="-.5" r="1.1" fill="#fff"/>`),
				done: () => { bump(coreRef.current, 1.09); later(150, route) },
			})
		}

		// Busier weeks send more bubbles; a quiet app still sends one now and then.
		const rate = total ? Math.min(3.3, 0.5 + Math.log10(total + 1) * 0.72) : 0
		const acc = items.map(() => Math.random())

		// Coins replay the latest payments oldest first, so the newest ends in front; then a pause.
		if (coins) {
			let step = 0
			const next = () => {
				const order = payments.length - 1 - (step % payments.length)
				const lastOfRound = step % payments.length === payments.length - 1
				step++
				if (geo.coin) {
					particles.push({
						lane: geo.coin, t: 0, dur: 1, accel: true,
						g: spawn(`<circle r="10" fill="url(#${gid}-coin)"/><text y="3.6" text-anchor="middle" font-size="10" font-weight="800" fill="#6b4e00">${fa ? 'ت' : 'T'}</text>`),
						done: () => walletRef.current?.land(order),
					})
				} else walletRef.current?.drop(order)
				later(lastOfRound ? 9000 : 3800, next)
			}
			later(1600, next)
		}

		let raf = 0, last = performance.now(), dead = false
		const tick = (now: number) => {
			if (dead) return
			const sec = Math.min(60, now - last) / 1000
			last = now
			if (rate) items.forEach((item, i) => {
				acc[i] += sec * Math.max((rate * item.count) / total, 0.16)
				if (acc[i] >= 1) { acc[i] -= 1; message(i) }
			})
			for (let k = particles.length - 1; k >= 0; k--) {
				const p = particles[k]
				p.t += sec / p.dur
				if (p.t >= 1) { p.g.remove(); particles.splice(k, 1); p.done?.(); continue }
				const pt = quad(p.lane, p.accel ? p.t * p.t : easeInOut(p.t))
				const scale = p.t < 0.15 ? 0.5 + (p.t / 0.15) * 0.5 : 1
				const opacity = p.t > 0.86 ? (1 - p.t) / 0.14 : 1
				p.g.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) scale(${scale.toFixed(2)})`)
				p.g.setAttribute('opacity', opacity.toFixed(2))
			}
			raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => {
			dead = true
			cancelAnimationFrame(raf)
			timers.forEach((timer) => clearTimeout(timer))
			particles.forEach((p) => p.g.remove())
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [geo, motion, onScreen, total, coins])

	const Arrow = fa ? ArrowLeft : ArrowRight
	const agentChip = automationRate === null
		? <span className="ui-chip ui-chip-neutral whitespace-nowrap">{fa ? 'منتظر اولین پیام' : 'Waiting for the first message'}</span>
		: <span className={cn('ui-chip whitespace-nowrap', low ? 'ui-chip-warn' : 'ui-chip-signal')}>{fa ? `${fmt(automationRate)}٪ خودکار` : `${fmt(automationRate)}% automated`}</span>

	return (
		<div dir={rtl ? 'rtl' : 'ltr'} className="ls">
			<div className="flex items-center gap-2">
				<h2 className="ui-h3">{fa ? 'جریان ۷ روز اخیر' : 'The last 7 days, flowing'}</h2>
				{empty ? (
					<span className="ui-chip ui-chip-neutral">{fa ? 'هنوز وصل نشده' : 'Nothing connected'}</span>
				) : (
					<span className="ui-chip ui-chip-ok">
						<span className="relative inline-flex"><span className="absolute inset-0 animate-ping rounded-full bg-current opacity-40 motion-reduce:animate-none" /><span className="ui-chip-dot relative" /></span>
						{fa ? 'داده زنده' : 'Live data'}
					</span>
				)}
				<span className="ms-auto text-[12px] tabular-nums text-[var(--text-muted)]">{fa ? `${fmt(total)} گفتگو` : `${fmt(total)} chats`}</span>
			</div>

			{/* Before the first measure the stage keeps its height, so nothing jumps. */}
			<div ref={rootRef} className={cn('relative mt-4', !geo && 'h-[392px] sm:h-[306px]')} style={geo ? { height: geo.H } : undefined}>
				{geo ? (
					<div className="ls-stage absolute inset-0">
						<svg aria-hidden className="absolute inset-0 overflow-visible" width={geo.W} height={geo.H} viewBox={`0 0 ${geo.W} ${geo.H}`}>
							<defs>
								<radialGradient id={`${gid}-coin`} cx=".35" cy=".3" r=".75">
									<stop offset="0" stopColor="#fff6d2" />
									<stop offset=".45" stopColor="#f5c84b" />
									<stop offset="1" stopColor="#c99a1b" />
								</radialGradient>
							</defs>
							{geo.ins.map((node, i) => <path key={`i${i}`} d={lanePath(node.lane)} className="ls-lane" stroke={itemColor(items[i])} />)}
							{geo.outs.map((node, j) => <path key={`o${j}`} d={lanePath(node.lane)} className="ls-lane" stroke={outputs[j].value ? TONE_COLOR[outputs[j].tone] : '#c9c5bf'} />)}
							{geo.coin ? <path d={lanePath(geo.coin)} className="ls-lane" stroke="#c99a1b" /> : null}
							<g ref={fxRef} />
						</svg>

						{geo.ins.map((node, i) => {
							const item = items[i]
							const name = itemName(item, geo.narrow)
							const href = item.ghost ? '/integrations' : item.key === 'OTHER' ? '/conversations' : `/conversations?channel=${item.key}`
							const mark = item.ghost ? (
								<span className="ls-ghost grid place-items-center rounded-full" style={{ width: geo.node, height: geo.node }}>
									{(() => { const Icon = CHANNEL_TONES[item.key as ChannelKey].icon; return <Icon className="h-4 w-4" strokeWidth={1.8} /> })()}
								</span>
							) : item.key === 'OTHER' ? (
								<span className="grid place-items-center rounded-full bg-[#f2f1ef] text-[#8a8580]" style={{ width: geo.node, height: geo.node }}><MoreHorizontal className="h-4 w-4" /></span>
							) : (
								<ChannelMark channel={item.key} size="sm" className="!h-full !w-full !rounded-full" />
							)
							const count = item.ghost
								? <b className="text-[var(--text-hint)]">{fa ? 'وصل نیست' : 'Not connected'}</b>
								: <b className="tabular-nums">{fmt(item.count)}</b>
							if (geo.narrow) {
								return (
									<Link key={item.key} href={href} title={item.names?.join(fa ? '، ' : ', ')} className="ls-chm" style={{ left: node.x, top: node.y, width: geo.W / items.length }}>
										<span className="ls-ring grid place-items-center rounded-full" style={{ width: geo.node, height: geo.node }}>{mark}</span>
										<small>{name}</small>
										{count}
									</Link>
								)
							}
							return (
								<Link
									key={item.key}
									href={href}
									title={item.names?.join(fa ? '، ' : ', ')}
									className="ls-ch flex-row-reverse"
									style={rtl ? { left: node.x - geo.node / 2, top: node.y } : { right: geo.W - node.x - geo.node / 2, top: node.y }}
								>
									<span className="ls-ring grid shrink-0 place-items-center rounded-full" style={{ width: geo.node, height: geo.node }}>{mark}</span>
									<span className="ls-ch-tx" style={{ maxWidth: Math.max(48, rtl ? geo.W - node.x - geo.node / 2 - 8 : node.x - geo.node / 2 - 8) }}>
										{count}
										<small>{name}</small>
									</span>
								</Link>
							)
						})}

						{geo.outs.map((node, j) => {
							const output = outputs[j]
							const Icon = OUTPUT_ICONS[output.key]
							const hot = output.key === 'handoff' && low
							return (
								<Link
									key={output.key}
									ref={(el) => { outRefs.current[j] = el }}
									href={output.href}
									className={cn(geo.narrow ? 'ls-tile' : 'ls-out', hot && 'ls-hot')}
									style={geo.narrow ? { left: node.x - node.w / 2, top: node.y, width: node.w } : { left: node.x, top: node.y, width: node.w }}
								>
									<span className={cn('grid shrink-0 place-items-center rounded-lg', geo.narrow ? 'h-[26px] w-[26px]' : 'h-[30px] w-[30px]', TONE_TILE[output.tone])}><Icon className="h-3.5 w-3.5" /></span>
									<span className="min-w-0">
										<b className={cn('block font-bold tabular-nums', geo.narrow ? 'text-[14.5px] leading-[18px]' : 'text-[15px] leading-5', output.value === 0 ? 'text-[var(--text-hint)]' : 'text-[var(--text-primary)]')}>{fmt(output.value)}</b>
										<small className={cn('block text-[var(--text-muted)]', geo.narrow ? 'text-[10.5px] leading-[14px]' : 'truncate text-[11.5px] leading-4')}>{output.label}</small>
									</span>
								</Link>
							)
						})}

						<div className="absolute z-[2] -translate-x-1/2 -translate-y-1/2" style={{ left: geo.C.x, top: geo.C.y }}>
							<StageAgent size={geo.R * 2} idle={!total} low={low} rate={automationRate ?? 0} coreRef={coreRef} />
						</div>
						<div
							className={cn('absolute z-[2] flex w-[150px] -translate-x-1/2 flex-col items-center gap-1 text-center', !geo.narrow && '-translate-y-full')}
							style={{ left: geo.C.x, top: geo.narrow ? geo.C.y + geo.R + 4 : geo.C.y - geo.R - 6 }}
						>
							<span className="line-clamp-2 text-balance text-[12px] font-bold leading-[18px] text-[var(--text-primary)]">{agentName}</span>
							{agentChip}
						</div>
						{empty ? (
							<div className="absolute z-[3] -translate-x-1/2" style={{ left: geo.C.x, top: geo.narrow ? geo.C.y - geo.R - 46 : geo.C.y + geo.R + 14 }}>
								<Link href="/integrations" className="spatial-press inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-[var(--text-primary)] px-3.5 text-[12.5px] font-semibold text-white shadow-[var(--shadow-control)]">
									<Plug className="h-4 w-4" />
									{fa ? 'افزودن اولین اتصال' : 'Connect your first app'}
								</Link>
							</div>
						) : null}
					</div>
				) : null}
			</div>

			{gateway && geo ? (
				<Wallet
					ref={walletRef}
					locale={locale}
					data={gateway}
					payments={payments}
					layout={geo.narrow || geo.W < 600 ? 'stack' : 'three'}
					single={geo.W < 420}
					drop={geo.narrow}
					cardWidth={geo.narrow ? Math.min(232, geo.W - 40) : geo.W < 600 ? 220 : 208}
					Arrow={Arrow}
				/>
			) : null}
		</div>
	)
}

function StageAgent({ size, idle, low, rate, coreRef }: { size: number; idle: boolean; low: boolean; rate: number; coreRef: React.Ref<HTMLSpanElement> }) {
	return (
		<div className={cn('ls-ag', idle && 'ls-ag-idle', low && 'ls-ag-low')} style={{ width: size, height: size, '--ls-a': rate } as CSSProperties}>
			<span aria-hidden className="ls-pulse" />
			<span aria-hidden className="ls-pulse [animation-delay:1.4s]" />
			<svg aria-hidden className="ls-ag-svg" viewBox="0 0 120 120">
				<circle cx="60" cy="60" r="57" className="ls-orbit" />
				<circle cx="60" cy="60" r="49" className="ls-track" />
				{idle ? null : <circle cx="60" cy="60" r="49" className="ls-gauge" pathLength={100} />}
			</svg>
			<span ref={coreRef} className="ls-core">
				<Bot style={{ width: size * 0.28, height: size * 0.28 }} strokeWidth={1.8} />
			</span>
		</div>
	)
}

/* ── The cards: the payments replay onto them, the ticker follows ─────── */

type WalletHandle = { land: (index: number) => void; drop: (index: number) => void }
type Payment = GatewayWeek['recent'][number]

const Wallet = forwardRef<WalletHandle, {
	locale: Locale
	data: GatewayWeek
	payments: Payment[]
	layout: 'three' | 'stack'
	/** Narrow phones put the card's numbers above the days instead of beside them. */
	single: boolean
	drop: boolean
	cardWidth: number
	Arrow: LucideIcon
}>(function Wallet({ locale, data, payments, layout, single, drop, cardWidth, Arrow }, ref) {
	const fa = locale === 'fa'
	const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
	const short = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US', { maximumFractionDigits: 1 })
	const million = (value: number) => `${short.format(value / 1_000_000)} ${fa ? 'میلیون' : 'M'}`
	const toman = fa ? 'تومان' : 'Toman'
	const cards = data.cards
	const cardIndex = (payment: Payment | undefined) => Math.max(0, cards.findIndex((card) => card.id === payment?.cardId))

	const [front, setFront] = useState(() => cardIndex(payments[0]))
	const [ticker, setTicker] = useState(() => payments.slice(0, 3))
	const [pop, setPop] = useState<{ id: number; text: string } | null>(null)
	const [catchId, setCatchId] = useState(0)
	const [now, setNow] = useState<number | null>(null)
	const vlRef = useRef<HTMLDivElement>(null)

	// Times are relative to the viewer's clock, so they appear after hydration.
	useEffect(() => {
		setNow(Date.now())
		const timer = setInterval(() => setNow(Date.now()), 60_000)
		return () => clearInterval(timer)
	}, [])

	const land = (index: number) => {
		const payment = payments[index]
		if (!payment) return
		setFront(cardIndex(payment))
		setCatchId((id) => id + 1)
		setPop({ id: Date.now(), text: `+${million(payment.amount)} ${toman}` })
		setTicker((list) => [payment, ...list.filter((item) => item !== payment)].slice(0, 3))
	}
	useImperativeHandle(ref, () => ({
		land,
		drop: (index: number) => {
			const vl = vlRef.current
			if (!vl) return land(index)
			const coin = document.createElement('i')
			coin.className = 'ls-coin'
			coin.textContent = fa ? 'ت' : 'T'
			vl.appendChild(coin)
			const animation = coin.animate(
				[
					{ transform: 'translate(-50%,-26px) scale(.5)', opacity: 0 },
					{ transform: 'translate(-50%,-10px) scale(1)', opacity: 1, offset: 0.3 },
					{ transform: 'translate(-50%,46px) scale(.75)', opacity: 0.9 },
				],
				{ duration: 950, easing: 'cubic-bezier(.55,0,.75,.2)' },
			)
			animation.onfinish = () => { coin.remove(); land(index) }
		},
	}))

	const relative = new Intl.RelativeTimeFormat(fa ? 'fa' : 'en', { numeric: 'auto' })
	const ago = (iso: string) => {
		if (now === null) return null
		const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
		if (minutes < 60) return minutes < 1 ? (fa ? 'همین حالا' : 'just now') : relative.format(-minutes, 'minute')
		const hours = Math.round(minutes / 60)
		return hours < 24 ? relative.format(-hours, 'hour') : relative.format(-Math.round(hours / 24), 'day')
	}
	const what = (payment: Payment) =>
		payment.purpose === 'BOOKING' ? (fa ? 'نوبت' : 'Booking') : payment.purpose === 'COURSE' ? (fa ? 'ثبت‌نام دوره' : 'Course sign-up') : `${fa ? 'سفارش' : 'Order'} ${payment.reference}`

	const badge = data.review > 0 ? (
		<Link href="/payments" className="ls-badge">{fa ? `${nf.format(data.review)} واریز منتظر تأیید` : `${nf.format(data.review)} to review`}</Link>
	) : null
	const line = drop ? <div ref={vlRef} aria-hidden className="ls-vl" /> : null

	if (!cards.length) {
		return (
			<div className={cn('ls-wallet', !drop && 'pt-3')}>
				{line}
				<div className="relative mx-auto" style={{ width: cardWidth }}>
					{badge}
					<Link href="/payments" className="flex aspect-[1.586] w-full flex-col items-center justify-center gap-1 rounded-[20px] border border-dashed border-[var(--signal-border)] bg-[var(--signal-soft)] px-6 text-center text-[13px] font-bold text-[var(--signal-strong)]">
						<Plus className="h-5 w-5" />
						{fa ? 'کارت فعالی نیست' : 'No active card'}
						<span className="text-[11.5px] font-medium text-[var(--text-muted)]">{fa ? 'یک کارت روشن کنید تا پرداخت‌ها برسد' : 'Switch a card on to receive payments'}</span>
					</Link>
				</div>
			</div>
		)
	}

	const card = cards[front] ?? cards[0]
	const bank = bankByKey(card.bankKey)
	const share = card.dailyCap ? Math.min(100, (card.today / card.dailyCap) * 100) : 0
	const near = share >= 85
	const top = Math.max(1, ...data.daily)
	const weekday = new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { weekday: 'narrow', timeZone: 'Asia/Tehran' })
	const dayLabel = (index: number) => (index === 6 ? (fa ? 'امروز' : 'Today') : now === null ? '' : weekday.format(new Date(now - (6 - index) * 86_400_000)))

	const stack = (
		<div className="relative mx-auto" style={{ width: cardWidth }}>
			{badge}
			<div className="relative" style={{ height: Math.round(cardWidth / 1.586) + 22 }}>
				{cards.map((item, index) => {
					const depth = (index - front + cards.length) % cards.length
					const k = Math.min(depth, 2)
					return (
						<div
							key={item.id}
							aria-hidden={depth > 0}
							className="ls-card"
							style={{ transform: `translateY(${-11 * k}px) scale(${1 - 0.06 * k})`, zIndex: cards.length - depth, opacity: depth > 2 ? 0 : 1, filter: depth ? 'brightness(.86) saturate(.85)' : undefined }}
						>
							<div key={depth === 0 ? catchId : 'still'} className={cn('overflow-hidden rounded-[20px]', depth === 0 && catchId > 0 && 'ls-catch')}>
								<BankCardFace bankKey={item.bankKey} pan={item.pan} holder={item.holder} lang={locale} />
							</div>
						</div>
					)
				})}
			</div>
			{pop ? <span key={pop.id} className="ls-pop">{pop.text}</span> : null}
		</div>
	)
	const caption = (
		<div className="flex min-w-0 flex-col gap-1.5 text-[12px] text-[var(--text-muted)]">
			<div className="flex items-center justify-between gap-2">
				<span className="truncate">{fa ? bank.fa : bank.en} · {fa ? '۷ روز' : '7 days'}</span>
				<b className="shrink-0 tabular-nums text-[var(--text-primary)]">{card.week ? million(card.week) : fa ? 'بدون واریز' : 'Nothing yet'}</b>
			</div>
			{card.dailyCap ? (
				<div className="h-[5px] overflow-hidden rounded-full bg-[rgba(17,17,17,0.07)]">
					<i className={cn('block h-full rounded-full transition-[width] duration-500', near ? 'bg-gradient-to-l from-amber-500 to-red-600' : 'bg-gradient-to-l from-[#8b74ff] to-[var(--signal)]')} style={{ width: `${card.today ? Math.max(3, share) : 0}%` }} />
				</div>
			) : null}
			<div className="flex items-center justify-between gap-2 whitespace-nowrap">
				<span>{card.today ? `${fa ? 'امروز' : 'Today'} ${million(card.today)}` : fa ? 'امروز بدون واریز' : 'Nothing today'}</span>
				{card.dailyCap ? <span>{fa ? 'سقف' : 'Cap'} {million(card.dailyCap)}</span> : null}
			</div>
			{near ? <span className="ui-chip ui-chip-warn self-start">{fa ? `${nf.format(Math.round(share))}٪ سقف امروز پر شده` : `${nf.format(Math.round(share))}% of today's cap used`}</span> : null}
		</div>
	)
	const bars = (
		<div className="grid h-[58px] grid-cols-7 items-end gap-[5px]" role="img" aria-label={fa ? 'دریافتی روزانه در ۷ روز اخیر' : 'Received per day, last 7 days'}>
			{data.daily.map((value, index) => (
				<span key={index} className="flex h-full flex-col items-center justify-end gap-1" title={value ? `${million(value)} ${toman}` : fa ? 'بدون پرداخت' : 'no payments'}>
					<span
						className={cn('ls-bar', !value && 'ls-bar-none', value && index === 6 && 'ls-bar-today')}
						style={{ height: value ? Math.max(6, Math.round((value / top) * 38)) : 4, animationDelay: `${0.15 + index * 0.06}s` }}
					/>
					<span className="h-2.5 text-[9.5px] leading-none text-[var(--text-muted)]">{dayLabel(index)}</span>
				</span>
			))}
		</div>
	)
	const list = (
		<div className="min-w-0">
			<p className="mb-1.5 text-[11.5px] font-semibold text-[var(--text-muted)]">{fa ? 'آخرین پرداخت‌ها · تومان' : 'Latest payments · Toman'}</p>
			<ul className="flex flex-col gap-1.5">
				{ticker.map((payment, index) => (
					<li key={`${payment.reference}-${payment.paidAt}`} className={cn('flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5', index === 0 && catchId > 0 && 'ls-tick')}>
						<b className="shrink-0 text-[12px] font-bold tabular-nums text-[var(--ok-ink)]">+{nf.format(payment.amount)}</b>
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
		<Link
			href="/payments"
			className="spatial-press group inline-flex min-h-9 items-center gap-1.5 self-start rounded-full border border-[var(--signal-border)] bg-[var(--signal-soft)] pe-3 ps-3.5 text-[12.5px] font-bold text-[var(--signal-strong)] transition-colors hover:border-[var(--signal)] hover:bg-white"
		>
			{fa ? 'همهٔ پرداخت‌ها' : 'All payments'}
			<Arrow className={cn('h-3.5 w-3.5 transition-transform', fa ? 'group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5')} />
		</Link>
	)

	if (layout === 'three') {
		return (
			<div className="ls-wallet grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-5 pt-2.5">
				{ticker.length ? list : <span />}
				{stack}
				<div className="flex min-w-0 flex-col gap-3 pt-3">{caption}{bars}{pill}</div>
			</div>
		)
	}
	return (
		<div className={cn('ls-wallet', !drop && 'pt-2.5')}>
			{line}
			{stack}
			<div className={cn('mt-4 grid items-end gap-4', single ? 'grid-cols-1' : 'grid-cols-2')}>{caption}{bars}</div>
			{ticker.length ? <div className="mt-4">{list}</div> : null}
			<div className="mt-3">{pill}</div>
		</div>
	)
})
