'use client'

import Link from 'next/link'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AlertCircle, ArrowLeft, ArrowRight, Bot, CalendarCheck2, CheckCircle2, MessagesSquare, MoreHorizontal, Package, Plug, UserPlus, type LucideIcon } from 'lucide-react'
import { CHANNEL_TONES, ChannelMark, type ChannelKey } from '@/components/ui/channel-mark'
import { BookingsPanel, CoursesPanel, MenuPanel, MOD, modVars, moduleNodes, PayPanel, StorePanel, type ModKey, type ModNode, type PanelHandle } from '@/components/dashboard/stage-panels'
import type { GatewayWeek } from '@/lib/payments/card/dashboard'
import type { StageModules } from '@/lib/dashboard/stage-modules'
import { cn } from '@/lib/utils'

/*
 * The overview's 7-day flow as a live stage: the connected apps sit on an
 * arc on the start side, the agent in the middle, the outcomes on the end
 * side. Messages fly in as bubbles from each app (faster from the busier
 * ones) and the agent sends each on to an outcome.
 *
 * Under the agent, every module the business turned on or connected has a
 * node and a lane: the store (WooCommerce or the catalog), the digital
 * menu, bookings, courses and the payment gateway. The chosen node opens
 * its panel below. Each lane replays only that module's real events (a coin
 * for a payment, a parcel for an order, a calendar for a booking the agent
 * made, a cap for a sign-up); a module still being set up has a grey, still
 * lane and its panel shows the next step.
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
}
type Band = { top: number; nh: number; nw: number; H: number; nodes: { x: number; lane: Lane }[] }

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
function wideGeo(W: number, nIn: number, nOut: number, rtl: boolean): Geo {
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
	return { narrow: false, W, H, C, R, node, ins, outs }
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
	return { narrow: true, W, H, C, R, node, ins, outs }
}

/** The module nodes under the agent, start side first, one lane each from the agent. */
function bandGeo(geo: Geo, count: number, rtl: boolean): Band {
	const top = geo.H + 30, nh = 52, gap = 10
	const nw = Math.min(152, (geo.W - gap * (count - 1)) / count)
	const x0 = (geo.W - (nw * count + gap * (count - 1))) / 2
	const a = { x: geo.C.x, y: geo.C.y + geo.R + 3 }
	const nodes = Array.from({ length: count }, (_, i) => {
		const x = rtl ? geo.W - x0 - nw * (i + 0.5) - gap * i : x0 + nw * (i + 0.5) + gap * i
		return { x, lane: { a, c: { x: geo.C.x + (x - geo.C.x) * 0.1, y: top - 40 }, b: { x, y: top - 3 } } }
	})
	return { top, nh, nw, H: top + nh, nodes }
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

/** Opens on a module that has something to show: events first, then anything set up. */
function firstModule(nodes: ModNode[]): ModKey | null {
	return (nodes.find((node) => node.state !== 'setup' && node.events > 0) ?? nodes.find((node) => node.state !== 'setup') ?? nodes[0])?.key ?? null
}

/* Replay tokens on the module lanes. */
const TOKENS: Record<Exclude<ModKey, 'pay'>, string> = {
	store: `<rect x="-8" y="-8" width="16" height="16" rx="5" fill="${MOD.store.color}"/><path d="M-4-2h8l-1 6h-6z" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/><path d="M-2-2a2 2 0 0 1 4 0" fill="none" stroke="#fff" stroke-width="1.4"/>`,
	menu: `<circle r="8" fill="${MOD.menu.color}"/><path d="M-3-4v8M1-4v3a2 2 0 0 0 2 2v3" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
	bookings: `<rect x="-8" y="-8" width="16" height="16" rx="4" fill="${MOD.bookings.color}"/><path d="M-5-3h10M-2-7v3M2-7v3" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><circle cx="0" cy="2" r="1.6" fill="#fff"/>`,
	courses: `<circle r="8" fill="${MOD.courses.color}"/><path d="M-5-1 0-4 5-1 0 2zM-3 0v3c2 1.6 4 1.6 6 0V0" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>`,
}
const GAPS: Record<Exclude<ModKey, 'pay'>, number> = { store: 4600, menu: 5000, bookings: 5200, courses: 5600 }

// useLayoutEffect warns on the server; the stage only measures in the browser.
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function LiveStage({
	locale,
	agentName,
	automationRate,
	inputs,
	outputs,
	gateway,
	modules,
}: {
	locale: Locale
	agentName: string
	automationRate: number | null
	inputs: FlowInput[]
	outputs: FlowOutput[]
	/** The live payment gateway's week; null until it is live. */
	gateway: GatewayWeek | null
	/** The modules under the agent (lib/dashboard/stage-modules.ts). */
	modules: StageModules
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
	const modRefs = useRef<Partial<Record<ModKey, HTMLButtonElement | null>>>({})
	const panelRef = useRef<PanelHandle>(null)
	const vlRef = useRef<HTMLDivElement>(null)

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
	const payments = useMemo(() => gateway?.recent.filter((payment) => gateway.cards.some((card) => card.id === payment.cardId)) ?? [], [gateway])
	const mods = useMemo(() => moduleNodes(modules, gateway, locale), [modules, gateway, locale])
	const modsKey = mods.map((node) => `${node.key}:${node.state}:${node.events}`).join('|')
	const [active, setActive] = useState<ModKey | null>(() => firstModule(mods))
	const activeRef = useRef(active)
	useEffect(() => { activeRef.current = active }, [active])

	const geo = useMemo(() => {
		if (width === null) return null
		return width < NARROW_BELOW ? narrowGeo(width, items.length, outputs.length, rtl) : wideGeo(width, items.length, outputs.length, rtl)
	}, [width, items.length, outputs.length, rtl])
	const band = useMemo(() => (geo && !geo.narrow && mods.length ? bandGeo(geo, mods.length, rtl) : null), [geo, mods.length, rtl])
	const stageH = band ? band.H : geo?.H

	const low = automationRate !== null && automationRate < 50
	const itemName = (item: Item, short = false) =>
		item.key === 'OTHER'
			? short ? (fa ? `${fmt(item.names?.length ?? 0)}+ دیگر` : `+${fmt(item.names?.length ?? 0)} more`) : fa ? `${fmt(item.names?.length ?? 0)} کانال دیگر` : `${fmt(item.names?.length ?? 0)} more`
			: CHANNEL_NAMES[item.key][locale]
	const itemColor = (item: Item) => (item.ghost ? '#c9c5bf' : item.key === 'OTHER' ? OTHER_COLOR : CHANNEL_TONES[item.key].color)

	/* The motion: bubbles from the apps, dots to the outcomes, each module's replays on its lane. */
	useEffect(() => {
		const fx = fxRef.current
		const replays = mods.filter((node) => node.state !== 'setup' && node.events > 0)
		if (!geo || !fx || !motion || !onScreen || (!total && !replays.length)) return
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

		// A token reaches its module: the node nudges and, if its panel is open, the panel lands it.
		const arrive = (key: ModKey, at: number | null) => {
			bump(modRefs.current[key], 1.05)
			if (activeRef.current === key) panelRef.current?.land(at)
		}
		const coinMarkup = (coin: boolean) => coin
			? `<circle r="10" fill="url(#${gid}-coin)"/><text y="3.6" text-anchor="middle" font-size="10" font-weight="800" fill="#6b4e00">${fa ? 'ت' : 'T'}</text>`
			: `<circle r="8" fill="#f5c84b" fill-opacity=".22"/><circle r="3.6" fill="url(#${gid}-coin)"/>`
		const fly = (key: ModKey, at: number | null, coin = true) => {
			const slot = mods.findIndex((node) => node.key === key)
			if (band && slot >= 0) {
				particles.push({ lane: band.nodes[slot].lane, t: 0, dur: 1.05, accel: true, g: spawn(key === 'pay' ? coinMarkup(coin) : TOKENS[key]), done: () => arrive(key, at) })
				return
			}
			// Phones: the open module's token drops down the line above the module row.
			const vl = vlRef.current
			if (!vl || activeRef.current !== key) { bump(modRefs.current[key], 1.05); return }
			const token = document.createElement('i')
			token.className = key === 'pay' ? (coin ? 'ls-coin' : 'ls-coin ls-spark') : 'ls-coin'
			token.textContent = key === 'pay' && coin ? (fa ? 'ت' : 'T') : ''
			if (key !== 'pay') Object.assign(token.style, { width: '14px', height: '14px', background: MOD[key].color, boxShadow: `0 3px 8px ${MOD[key].color}66`, borderRadius: key === 'store' || key === 'bookings' ? '5px' : '9999px' })
			vl.appendChild(token)
			const animation = token.animate(
				[{ transform: 'translate(-50%,-22px) scale(.5)', opacity: 0 }, { transform: 'translate(-50%,-8px) scale(1)', opacity: 1, offset: 0.3 }, { transform: 'translate(-50%,40px) scale(.75)', opacity: 0.9 }],
				{ duration: 950, easing: 'cubic-bezier(.55,0,.75,.2)' },
			)
			animation.onfinish = () => { token.remove(); arrive(key, at) }
		}

		replays.forEach((node, slot) => {
			if (node.key === 'pay') {
				// The latest payments replay oldest first, so the newest ends in front; then a pause.
				if (payments.length) {
					let step = 0
					const next = () => {
						const order = payments.length - 1 - (step % payments.length)
						const lastOfRound = step % payments.length === payments.length - 1
						step++
						fly('pay', order, true)
						later(lastOfRound ? 9000 : 3800, next)
					}
					later(1600, next)
				} else {
					// No payment yet: a spark, not a coin, so nothing pretends money arrived.
					const spark = () => { fly('pay', null, false); later(5200, spark) }
					later(1400, spark)
				}
				return
			}
			const key = node.key
			let step = 0
			const next = () => {
				fly(key, step % node.events)
				step++
				later(step % node.events === 0 ? GAPS[key] * 2 : GAPS[key], next)
			}
			later(2200 + slot * 900, next)
		})

		// Busier weeks send more bubbles; a quiet app still sends one now and then.
		const rate = total ? Math.min(3.3, 0.5 + Math.log10(total + 1) * 0.72) : 0
		const acc = items.map(() => Math.random())
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
	}, [geo, band, motion, onScreen, total, modsKey, payments])

	const Arrow = fa ? ArrowLeft : ArrowRight
	const agentChip = automationRate === null
		? <span className="ui-chip ui-chip-neutral whitespace-nowrap">{fa ? 'منتظر اولین پیام' : 'Waiting for the first message'}</span>
		: <span className={cn('ui-chip whitespace-nowrap', low ? 'ui-chip-warn' : 'ui-chip-signal')}>{fa ? `${fmt(automationRate)}٪ خودکار` : `${fmt(automationRate)}% automated`}</span>

	const modButton = (node: ModNode, slot: number) => {
		const Icon = MOD[node.key].icon
		return (
			<button
				key={node.key}
				ref={(el) => { modRefs.current[node.key] = el }}
				type="button"
				aria-pressed={active === node.key}
				onClick={() => setActive(node.key)}
				className={cn('ls-mn', node.state === 'setup' && 'is-setup', band && band.nw < 130 && 'is-compact')}
				style={{ ...modVars(node.key), ...(band ? { left: band.nodes[slot].x - band.nw / 2, top: band.top, width: band.nw } : null) }}
			>
				<span className="ls-mt"><Icon className="h-4 w-4" /></span>
				<span className="ls-mn-tx"><small>{node.name}</small><b>{node.value}</b></span>
				<span aria-hidden className={cn('ls-mn-st', `is-${node.state}`)} />
			</button>
		)
	}
	const panelWidth = geo?.W ?? 600
	const panel = (() => {
		switch (active) {
			case 'pay': return <PayPanel ref={panelRef} locale={locale} gateway={gateway} payments={payments} setup={modules.paySetup} narrow={Boolean(geo?.narrow)} width={panelWidth} Arrow={Arrow} />
			case 'store': return modules.store ? <StorePanel ref={panelRef} locale={locale} data={modules.store} Arrow={Arrow} /> : null
			case 'menu': return modules.menu ? <MenuPanel ref={panelRef} locale={locale} data={modules.menu} narrow={Boolean(geo?.narrow)} Arrow={Arrow} /> : null
			case 'bookings': return modules.bookings ? <BookingsPanel ref={panelRef} locale={locale} data={modules.bookings} narrow={Boolean(geo?.narrow)} Arrow={Arrow} /> : null
			case 'courses': return modules.courses ? <CoursesPanel ref={panelRef} locale={locale} data={modules.courses} Arrow={Arrow} /> : null
			default: return null
		}
	})()
	const activeSlot = active ? mods.findIndex((node) => node.key === active) : -1

	return (
		<div dir={rtl ? 'rtl' : 'ltr'} className={cn('ls', geo?.narrow && 'ls-narrow')}>
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
			<div ref={rootRef} className={cn('relative mt-4', !geo && (mods.length ? 'h-[392px] sm:h-[388px]' : 'h-[392px] sm:h-[306px]'))} style={geo ? { height: stageH } : undefined}>
				{geo ? (
					<div className="ls-stage absolute inset-0">
						<svg aria-hidden className="absolute inset-0 overflow-visible" width={geo.W} height={stageH} viewBox={`0 0 ${geo.W} ${stageH}`}>
							<defs>
								<radialGradient id={`${gid}-coin`} cx=".35" cy=".3" r=".75">
									<stop offset="0" stopColor="#fff6d2" />
									<stop offset=".45" stopColor="#f5c84b" />
									<stop offset="1" stopColor="#c99a1b" />
								</radialGradient>
							</defs>
							{geo.ins.map((node, i) => <path key={`i${i}`} d={lanePath(node.lane)} className="ls-lane" stroke={itemColor(items[i])} />)}
							{geo.outs.map((node, j) => <path key={`o${j}`} d={lanePath(node.lane)} className="ls-lane" stroke={outputs[j].value ? TONE_COLOR[outputs[j].tone] : '#c9c5bf'} />)}
							{band ? mods.map((node, slot) => <path key={`m${node.key}`} d={lanePath(band.nodes[slot].lane)} className={cn('ls-lane ls-lane-mod', node.state === 'setup' && 'is-idle', active === node.key && 'is-on')} stroke={MOD[node.key].color} />) : null}
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

						{band ? mods.map(modButton) : null}
					</div>
				) : null}
			</div>

			{geo && mods.length ? (
				<>
					{geo.narrow ? (
						<>
							<div ref={vlRef} aria-hidden className="ls-mvl" style={active ? modVars(active) : undefined} />
							<div className="ls-mrow" role="group" aria-label={fa ? 'ماژول‌ها' : 'Modules'}>{mods.map(modButton)}</div>
						</>
					) : null}
					{active && panel ? (
						<div className="ls-dock" style={geo.narrow ? { paddingTop: 6 } : undefined}>
							{band && activeSlot >= 0 ? <span aria-hidden className="ls-dock-cn" style={{ ...modVars(active), left: band.nodes[activeSlot].x }} /> : null}
							<section key={active} className="ls-pn" style={modVars(active) as CSSProperties} aria-label={mods[activeSlot]?.name}>{panel}</section>
						</div>
					) : null}
				</>
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
