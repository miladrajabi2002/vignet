'use client'

/**
 * Public Chat Link experience (/c/[slug]) — a standalone, mobile-first,
 * full-screen chat with one agent. Built for the Instagram-bio use case:
 * opens fast inside in-app browsers, 100dvh layout, safe-area padding,
 * 16px inputs (no iOS zoom), streaming replies with product cards.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUp, RotateCcw, Sparkles, User, Phone } from 'lucide-react'
import { contrastOn } from '@/lib/widget/config'
import type { ChatLinkSettings } from '@/lib/chat-link/config'
import { Markdown } from '@/lib/markdown'

// ─── Types ──────────────────────────────────────────────────────────────────

type ProductCard = { name: string; price: string; desc: string; badge: string }

type Msg =
	| { id: string; role: 'user'; text: string }
	| { id: string; role: 'assistant'; text: string; cards: ProductCard[]; done: boolean }
	| { id: string; role: 'error'; text: string }

type Props = {
	slug: string
	name: string
	avatar: string | null
	welcomeMessage: string | null
	settings: ChatLinkSettings
}

// ─── Assistant parsing (mirrors public/widget/loader.js) ────────────────────

const PRODUCT_TOKEN = /\[\[product:(\{[\s\S]*?\})\]\]/g

function parseAssistant(
	raw: string,
	done: boolean,
): { text: string; cards: ProductCard[] } {
	const cards: ProductCard[] = []
	let text = raw.replace(PRODUCT_TOKEN, (_m, json: string) => {
		try {
			const p = JSON.parse(json)
			if (p && typeof p.name === 'string' && p.name) {
				cards.push({
					name: String(p.name).slice(0, 80),
					price: p.price != null ? String(p.price).slice(0, 40) : '',
					desc: p.desc != null ? String(p.desc).slice(0, 90) : '',
					badge: p.badge != null ? String(p.badge).slice(0, 20) : '',
				})
			}
		} catch {
			/* malformed token — drop it silently */
		}
		return ''
	})
	// While streaming, hold back an unterminated trailing token so it never
	// flashes as raw text; once done, whatever remains is real text.
	if (!done) {
		const tail = text.lastIndexOf('[[')
		if (tail !== -1 && text.indexOf(']]', tail) === -1) text = text.slice(0, tail)
	}
	return { text: text.replace(/\n{3,}/g, '\n\n').trim(), cards }
}

function errorText(code?: string): string {
	switch (code) {
		case 'RATE_LIMIT':
			return 'تعداد پیام‌ها زیاد شد — چند لحظه صبر کنید و دوباره بفرستید.'
		case 'PLAN_BLOCKED':
			return 'ظرفیت گفتگوی این صفحه فعلاً تکمیل است. کمی بعد سر بزنید.'
		default:
			return 'ارسال پیام ناموفق بود. دوباره تلاش کنید.'
	}
}

let idCounter = 0
const nextId = () => `m${Date.now()}-${++idCounter}`

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatLinkClient({ slug, name, avatar, welcomeMessage, settings }: Props) {
	const accent = settings.primaryColor
	const onAccent = contrastOn(accent)

	const convKey = `vgt-cl-conv-${slug}`
	const msgsKey = `vgt-cl-msgs-${slug}`
	const leadKey = `vgt-cl-lead-${slug}`

	const [messages, setMessages] = useState<Msg[]>([])
	const [input, setInput] = useState('')
	const [streaming, setStreaming] = useState(false)
	const [hydrated, setHydrated] = useState(false)
	// Lead-capture gate: null = not needed / already given, 'pending' = show form
	const [leadPending, setLeadPending] = useState(false)
	const [leadName, setLeadName] = useState('')
	const [leadPhone, setLeadPhone] = useState('')

	const convIdRef = useRef<string | null>(null)
	const leadRef = useRef<{ name: string; phone: string } | null>(null)
	const scrollerRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	// Restore conversation + transcript + lead across reloads.
	// Messages are now stored in localStorage (not sessionStorage) so the
	// transcript survives a full tab close / browser restart. We also try
	// to fetch the server-side history when we have a conversationId but no
	// local cache (e.g. first visit on a new device).
	useEffect(() => {
		let cancelled = false
		async function hydrate() {
			try {
				convIdRef.current = localStorage.getItem(convKey)
				const storedLead = localStorage.getItem(leadKey)
				if (storedLead) leadRef.current = JSON.parse(storedLead)
				const storedMsgs = localStorage.getItem(msgsKey)
				if (storedMsgs) {
					const parsed = JSON.parse(storedMsgs) as Msg[]
					if (Array.isArray(parsed)) setMessages(parsed.slice(-60))
				}
				// If we have a conversation but no local transcript, fetch from server.
				if (convIdRef.current && !storedMsgs) {
					try {
						const res = await fetch(
							`/api/chat-link/${encodeURIComponent(slug)}/chat?conversationId=${encodeURIComponent(convIdRef.current)}`,
							{ headers: { Accept: 'application/json' } },
						)
						if (res.ok) {
							const data = await res.json()
							if (!cancelled && Array.isArray(data.messages)) {
								const restored: Msg[] = data.messages
									.map((m: { id?: string; role: string; content: string }) => {
										const id = m.id || nextId()
										if (m.role === 'user')
											return { id, role: 'user', text: m.content } as Msg
										return {
											id,
											role: 'assistant',
											text: m.content,
											cards: [],
											done: true,
										} as Msg
									})
									.slice(-60)
								if (restored.length) setMessages(restored)
							}
						}
					} catch {
						/* network/parse error — continue with empty transcript */
					}
				}
				if (settings.leadCapture && !storedLead) setLeadPending(true)
			} catch {
				/* storage unavailable (private mode) — chat still works in-memory */
			}
			if (!cancelled) setHydrated(true)
		}
		void hydrate()
		return () => {
			cancelled = true
		}
	}, [convKey, leadKey, msgsKey, settings.leadCapture, slug])

	// Persist transcript to localStorage so it survives a tab close / refresh.
	useEffect(() => {
		if (!hydrated) return
		try {
			localStorage.setItem(msgsKey, JSON.stringify(messages.slice(-60)))
		} catch {
			/* ignore quota */
		}
	}, [messages, msgsKey, hydrated])

	const scrollDown = useCallback((smooth = true) => {
		requestAnimationFrame(() => {
			scrollerRef.current?.scrollTo({
				top: scrollerRef.current.scrollHeight,
				behavior: smooth ? 'smooth' : 'auto',
			})
		})
	}, [])

	useEffect(() => {
		if (messages.length) scrollDown(false)
	}, [hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

	// ── Send flow ──
	const send = useCallback(
		async (text: string) => {
			const message = text.trim()
			if (!message || streaming) return
			setInput('')
			if (inputRef.current) inputRef.current.style.height = 'auto'
			setStreaming(true)

			const isFirst = !convIdRef.current
			setMessages((m) => [...m, { id: nextId(), role: 'user', text: message }])
			scrollDown()

			const assistantId = nextId()
			let raw = ''
			let started = false
			const upsertAssistant = (done: boolean) => {
				const { text: parsed, cards } = parseAssistant(raw, done)
				setMessages((m) => {
					const idx = m.findIndex((x) => x.id === assistantId)
					const msg: Msg = {
						id: assistantId,
						role: 'assistant',
						text: parsed,
						cards,
						done,
					}
					if (idx === -1) return [...m, msg]
					const copy = m.slice()
					copy[idx] = msg
					return copy
				})
			}

			try {
				const res = await fetch(`/api/chat-link/${encodeURIComponent(slug)}/chat`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						message,
						conversationId: convIdRef.current,
						...(isFirst && leadRef.current
							? {
									visitorName: leadRef.current.name || undefined,
									visitorPhone: leadRef.current.phone || undefined,
								}
							: {}),
					}),
				})

				if (!res.ok || !res.body) {
					const err = await res.json().catch(() => null)
					setMessages((m) => [
						...m,
						{ id: nextId(), role: 'error', text: errorText(err?.error) },
					])
					return
				}

				const reader = res.body.getReader()
				const decoder = new TextDecoder()
				let buf = ''
				for (;;) {
					const { value, done } = await reader.read()
					if (done) break
					buf += decoder.decode(value, { stream: true })
					const parts = buf.split('\n\n')
					buf = parts.pop() ?? ''
					for (const part of parts) {
						const line = part.trim()
						if (!line.startsWith('data:')) continue
						try {
							const evt = JSON.parse(line.slice(5).trim())
							if (evt.type === 'meta' && evt.conversationId) {
								convIdRef.current = evt.conversationId
								try {
									localStorage.setItem(convKey, evt.conversationId)
								} catch {}
							} else if (evt.type === 'delta') {
								raw += evt.text
								started = true
								upsertAssistant(false)
								scrollDown()
							} else if (evt.type === 'done') {
								upsertAssistant(true)
							} else if (evt.type === 'error' && !started) {
								setMessages((m) => [
									...m,
									{ id: nextId(), role: 'error', text: errorText(evt.error) },
								])
							}
						} catch {
							/* partial frame — ignored */
						}
					}
				}
				if (started) upsertAssistant(true)
			} catch {
				setMessages((m) => [...m, { id: nextId(), role: 'error', text: errorText() }])
			} finally {
				setStreaming(false)
				scrollDown()
			}
		},
		[slug, streaming, convKey, scrollDown],
	)

	const submitLead = useCallback(() => {
		const lead = { name: leadName.trim(), phone: leadPhone.trim() }
		if (!lead.name || lead.phone.replace(/\D/g, '').length < 10) return
		leadRef.current = lead
		try {
			localStorage.setItem(leadKey, JSON.stringify(lead))
		} catch {}
		setLeadPending(false)
	}, [leadName, leadPhone, leadKey])

	const reset = useCallback(() => {
		convIdRef.current = null
		setMessages([])
		try {
			localStorage.removeItem(convKey)
			localStorage.removeItem(msgsKey)
		} catch {}
	}, [convKey, msgsKey])

	const autoGrow = useCallback(() => {
		const el = inputRef.current
		if (!el) return
		el.style.height = 'auto'
		el.style.height = `${Math.min(el.scrollHeight, 120)}px`
	}, [])

	const empty = messages.length === 0
	const monogram = useMemo(() => (name || '؟').trim().charAt(0), [name])

	return (
		<div className="relative flex h-[100dvh] flex-col overflow-hidden bg-[#fafafa] text-neutral-900">
			<Background kind={settings.background} accent={accent} />

			{/* App column */}
			<div className="relative z-10 mx-auto flex h-full w-full max-w-2xl flex-col md:border-x md:border-black/[0.06] md:bg-white/40 md:shadow-[0_0_80px_rgba(0,0,0,0.04)] md:backdrop-blur-sm">
				{/* Header */}
				<header className="flex items-center gap-3 border-b border-black/[0.06] bg-white/70 px-4 py-3 backdrop-blur-xl">
					<Avatar avatar={avatar} monogram={monogram} accent={accent} size={40} online />
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-semibold leading-tight">{name}</p>
						<p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
							<span className="relative flex h-1.5 w-1.5">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
								<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
							</span>
							آنلاین — پاسخ فوری
						</p>
					</div>
					{!empty && (
						<button
							onClick={reset}
							aria-label="شروع گفتگوی جدید"
							className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700"
						>
							<RotateCcw className="h-4 w-4" />
						</button>
					)}
				</header>

				{/* Messages / intro */}
				<div
					ref={scrollerRef}
					className="flex-1 overflow-y-auto overscroll-contain px-4 py-5"
				>
					{empty ? (
						<Intro
							name={name}
							avatar={avatar}
							monogram={monogram}
							accent={accent}
							onAccent={onAccent}
							tagline={settings.tagline}
							welcomeMessage={welcomeMessage}
							quickReplies={settings.quickReplies}
							showAiBadge={settings.showAiBadge}
							leadPending={leadPending}
							leadName={leadName}
							leadPhone={leadPhone}
							leadMessage={settings.leadCaptureMessage}
							leadRequired={settings.leadCaptureRequired}
							setLeadName={setLeadName}
							setLeadPhone={setLeadPhone}
							submitLead={submitLead}
							onSkip={() => {
								// Allow skipping — the AI agent will then try to extract name/phone
								// from the conversation (smart identification).
								// Only reachable when leadCaptureRequired is false.
								leadRef.current = null
								setLeadPending(false)
							}}
							onPick={(q) => void send(q)}
						/>
					) : (
						<div className="flex flex-col gap-2.5 pb-2">
							{messages.map((m) => (
								<MessageRow key={m.id} msg={m} accent={accent} onAccent={onAccent} />
							))}
							{streaming && messages[messages.length - 1]?.role === 'user' && (
								<TypingDots accent={accent} />
							)}
						</div>
					)}
				</div>

				{/* Composer */}
				<div className="border-t border-black/[0.06] bg-white/80 px-3 pt-3 backdrop-blur-xl [padding-bottom:max(env(safe-area-inset-bottom),12px)]">
					<form
						onSubmit={(e) => {
							e.preventDefault()
							void send(input)
						}}
						className="flex items-end gap-2"
					>
						<div className="flex min-w-0 flex-1 items-end rounded-3xl border border-black/10 bg-white px-4 py-2 shadow-sm transition-shadow focus-within:shadow-md">
							<textarea
								ref={inputRef}
								rows={1}
								value={input}
								disabled={leadPending}
								onChange={(e) => {
									setInput(e.target.value)
									autoGrow()
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !e.shiftKey) {
										e.preventDefault()
										void send(input)
									}
								}}
								placeholder={
									leadPending ? 'اول معرفی کوتاه را کامل کنید…' : 'پیام خود را بنویسید…'
								}
								className="max-h-[120px] w-full resize-none bg-transparent py-1 text-[16px] leading-6 outline-none placeholder:text-neutral-400 disabled:opacity-60"
							/>
						</div>
						<button
							type="submit"
							disabled={!input.trim() || streaming || leadPending}
							aria-label="ارسال"
							className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-sm transition-all active:scale-90 disabled:opacity-35"
							style={{ backgroundColor: accent, color: onAccent }}
						>
							{streaming ? (
								<span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
							) : (
								<ArrowUp className="h-5 w-5" />
							)}
						</button>
					</form>
					<p className="mt-2 text-center text-[10px] text-neutral-400">
						قدرت‌گرفته از{' '}
						<Link
							href="/"
							className="font-medium text-neutral-500 transition-colors hover:text-neutral-800"
						>
							Vigent
						</Link>
					</p>
				</div>
			</div>
		</div>
	)
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Avatar({
	avatar,
	monogram,
	accent,
	size,
	online = false,
	pulse = false,
}: {
	avatar: string | null
	monogram: string
	accent: string
	size: number
	online?: boolean
	pulse?: boolean
}) {
	return (
		<span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
			{pulse && (
				<span
					className="absolute -inset-2 animate-ping rounded-full opacity-10 [animation-duration:2.4s]"
					style={{ backgroundColor: accent }}
				/>
			)}
			{avatar ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={avatar}
					alt=""
					width={size}
					height={size}
					className="relative rounded-full object-cover ring-1 ring-black/10"
					style={{ width: size, height: size }}
				/>
			) : (
				<span
					className="relative flex items-center justify-center rounded-full text-sm font-semibold ring-1 ring-black/10"
					style={{
						width: size,
						height: size,
						backgroundColor: accent,
						color: contrastOn(accent),
						fontSize: size * 0.4,
					}}
				>
					{monogram}
				</span>
			)}
			{online && (
				<span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
			)}
		</span>
	)
}

function Intro(props: {
	name: string
	avatar: string | null
	monogram: string
	accent: string
	onAccent: string
	tagline: string | null
	welcomeMessage: string | null
	quickReplies: string[]
	showAiBadge: boolean
	leadPending: boolean
	leadName: string
	leadPhone: string
	leadMessage: string | null
	leadRequired: boolean
	setLeadName: (v: string) => void
	setLeadPhone: (v: string) => void
	submitLead: () => void
	onSkip: () => void
	onPick: (q: string) => void
}) {
	const {
		name,
		avatar,
		monogram,
		accent,
		tagline,
		welcomeMessage,
		quickReplies,
		showAiBadge,
		leadPending,
		leadName,
		leadPhone,
		leadMessage,
		leadRequired,
		setLeadName,
		setLeadPhone,
		submitLead,
		onSkip,
		onPick,
	} = props

	return (
		<div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
			<motion.div
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5, ease: 'easeOut' }}
			>
				<Avatar avatar={avatar} monogram={monogram} accent={accent} size={76} pulse />
			</motion.div>

			{showAiBadge && (
				<motion.span
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.15, duration: 0.45 }}
					className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-1.5 text-[11px] tracking-wide text-neutral-600 shadow-sm backdrop-blur"
				>
					<Sparkles className="h-3 w-3" style={{ color: accent }} />
					پاسخ فوری با هوش مصنوعی
				</motion.span>
			)}

			<motion.h1
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.22, duration: 0.45 }}
				className="mt-3 text-2xl font-light tracking-tight"
			>
				{name}
			</motion.h1>

			{tagline && (
				<motion.p
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3, duration: 0.45 }}
					className="mt-1.5 max-w-xs text-sm text-neutral-500"
				>
					{tagline}
				</motion.p>
			)}

			{leadPending ? (
				<motion.div
					initial={{ opacity: 0, y: 14 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4, duration: 0.5 }}
					className="mt-7 w-full max-w-sm rounded-3xl border border-black/[0.07] bg-white/85 p-5 text-start shadow-sm backdrop-blur"
				>
					<p className="text-sm text-neutral-700">
						{leadMessage ?? 'برای شروع گفتگو، یک معرفی کوتاه بنویسید:'}
					</p>
					<div className="mt-4 space-y-2.5">
						<label className="flex items-center gap-2.5 rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 focus-within:border-black/25">
							<User className="h-4 w-4 shrink-0 text-neutral-400" />
							<input
								value={leadName}
								onChange={(e) => setLeadName(e.target.value)}
								placeholder="نام شما"
								dir="rtl"
								className="w-full bg-transparent text-start text-[16px] outline-none placeholder:text-neutral-400"
							/>
						</label>
						<label className="flex items-center gap-2.5 rounded-2xl border border-black/10 bg-white px-3.5 py-2.5 focus-within:border-black/25">
							<Phone className="h-4 w-4 shrink-0 text-neutral-400" />
							<input
								value={leadPhone}
								onChange={(e) => setLeadPhone(e.target.value)}
								placeholder="شماره موبایل"
								inputMode="tel"
								dir="rtl"
								className="w-full bg-transparent text-start text-[16px] outline-none placeholder:text-neutral-400"
							/>
						</label>
						<button
							onClick={submitLead}
							disabled={!leadName.trim() || leadPhone.replace(/\D/g, '').length < 10}
							className="w-full rounded-2xl py-2.5 text-sm font-medium shadow-sm transition-all active:scale-[0.98] disabled:opacity-40"
							style={{ backgroundColor: accent, color: props.onAccent }}
						>
							شروع گفتگو
						</button>
						{!leadRequired && (
							<button
								onClick={onSkip}
								className="w-full py-1.5 text-xs text-neutral-400 transition-colors hover:text-neutral-700"
							>
								رد کردن و شروع گفتگو
							</button>
						)}
					</div>
				</motion.div>
			) : (
				<>
					{welcomeMessage && (
						<motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.4, duration: 0.5 }}
							className="mt-7 max-w-sm rounded-3xl rounded-ss-lg border border-black/[0.07] bg-white/90 px-4 py-3 text-start text-sm leading-7 text-neutral-800 shadow-sm backdrop-blur"
						>
							{welcomeMessage}
						</motion.div>
					)}

					{quickReplies.length > 0 && (
						<div className="mt-5 flex max-w-md flex-wrap items-center justify-center gap-2">
							{quickReplies.map((q, i) => (
								<motion.button
									key={q}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.5 + i * 0.07, duration: 0.4 }}
									onClick={() => onPick(q)}
									className="rounded-full border border-black/10 bg-white/80 px-4 py-2 text-[13px] text-neutral-700 shadow-sm backdrop-blur transition-all hover:border-black/25 hover:shadow active:scale-95"
								>
									{q}
								</motion.button>
							))}
						</div>
					)}
				</>
			)}
		</div>
	)
}

function MessageRow({
	msg,
	accent,
	onAccent,
}: {
	msg: Msg
	accent: string
	onAccent: string
}) {
	if (msg.role === 'error') {
		return (
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				className="mx-auto rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-xs text-red-600"
			>
				{msg.text}
			</motion.div>
		)
	}

	const isUser = msg.role === 'user'
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: 'easeOut' }}
			className={isUser ? 'flex justify-end' : 'flex justify-start'}
		>
			<div className={`max-w-[85%] ${isUser ? '' : 'space-y-2'}`}>
				{(isUser || msg.text) && (
					<div
						className={
							isUser
								? 'rounded-3xl rounded-ee-lg px-4 py-2.5 text-[15px] leading-7 shadow-sm'
								: 'rounded-3xl rounded-ss-lg border border-black/[0.07] bg-white px-4 py-2.5 text-[15px] leading-7 text-neutral-800 shadow-sm'
						}
						style={isUser ? { backgroundColor: accent, color: onAccent } : undefined}
					>
						{isUser ? (
							<span className="whitespace-pre-wrap">{msg.text}</span>
						) : (
							<div className="[&_p]:leading-7 [&_p]:whitespace-pre-wrap">
								<Markdown>{msg.text}</Markdown>
							</div>
						)}
					</div>
				)}
				{!isUser &&
					msg.cards.map((card, i) => (
						<div
							key={`${card.name}-${i}`}
							className="flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white p-3 shadow-sm"
						>
							<span
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
								style={{ backgroundColor: `${accent}14`, color: accent }}
							>
								{card.name.charAt(0)}
							</span>
							<span className="min-w-0 flex-1 text-start">
								<span className="flex items-center gap-2">
									<span className="truncate text-[13px] font-medium text-neutral-900">
										{card.name}
									</span>
									{card.badge && (
										<span
											className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
											style={{ backgroundColor: `${accent}14`, color: accent }}
										>
											{card.badge}
										</span>
									)}
								</span>
								{card.desc && (
									<span className="mt-0.5 block truncate text-xs text-neutral-500">
										{card.desc}
									</span>
								)}
								{card.price && (
									<span className="mt-1 block text-[13px] font-semibold text-neutral-900">
										{card.price}
									</span>
								)}
							</span>
						</div>
					))}
			</div>
		</motion.div>
	)
}

function TypingDots({ accent }: { accent: string }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className="flex justify-start"
		>
			<div className="flex items-center gap-1.5 rounded-3xl rounded-ss-lg border border-black/[0.07] bg-white px-4 py-3.5 shadow-sm">
				{[0, 1, 2].map((i) => (
					<motion.span
						key={i}
						className="h-1.5 w-1.5 rounded-full"
						style={{ backgroundColor: accent, opacity: 0.5 }}
						animate={{ y: [0, -4, 0], opacity: [0.35, 0.9, 0.35] }}
						transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
					/>
				))}
			</div>
		</motion.div>
	)
}

/** Ambient page background — quiet, slow, never competing with the chat. */
function Background({
	kind,
	accent,
}: {
	kind: ChatLinkSettings['background']
	accent: string
}) {
	if (kind === 'minimal') return null

	if (kind === 'dots') {
		return (
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-[0.5]"
				style={{
					backgroundImage: 'radial-gradient(rgba(0,0,0,0.10) 1px, transparent 1px)',
					backgroundSize: '22px 22px',
					maskImage: 'radial-gradient(ellipse 90% 70% at 50% 30%, black, transparent)',
					WebkitMaskImage:
						'radial-gradient(ellipse 90% 70% at 50% 30%, black, transparent)',
				}}
			/>
		)
	}

	// aurora / mesh: two soft drifting blobs (accent-tinted for mesh).
	const blobA = kind === 'mesh' ? accent : '#94a3b8'
	const blobB = kind === 'mesh' ? '#f59e0b' : accent
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
			<motion.div
				className="absolute -top-32 start-[-15%] h-[420px] w-[420px] rounded-full blur-[110px]"
				style={{ backgroundColor: blobA, opacity: 0.14 }}
				animate={{ x: [0, 40, 0], y: [0, 24, 0] }}
				transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
			/>
			<motion.div
				className="absolute bottom-[-20%] end-[-10%] h-[380px] w-[380px] rounded-full blur-[110px]"
				style={{ backgroundColor: blobB, opacity: 0.1 }}
				animate={{ x: [0, -32, 0], y: [0, -20, 0] }}
				transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
			/>
		</div>
	)
}
