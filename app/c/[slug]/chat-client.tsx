'use client'

/**
 * Public Chat Link experience (/c/[slug]) — a standalone, mobile-first,
 * full-screen chat with one agent. Built for the Instagram-bio use case:
 * opens fast inside in-app browsers, 100dvh layout, safe-area padding,
 * 16px inputs (no iOS zoom), streaming replies with product cards.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { RotateCcw, Sparkles, User, Phone } from 'lucide-react'
import { contrastOn } from '@/lib/widget/config'
import type { ChatLinkSettings } from '@/lib/chat-link/config'
import { toEnglishDigits } from '@/lib/phone'
import { ChatComposer } from '@/components/chat/chat-composer'
import { ConversationBubble, ConversationText } from '@/components/chat/conversation-bubble'
import { TypingIndicator } from '@/components/chat/typing-indicator'
import {
	parseProductShowcaseContent,
	type ShowcaseProduct,
} from '@/components/products/product-showcase'
import { ProductShowcaseRail } from '@/components/products/product-showcase-rail'

// ─── Types ──────────────────────────────────────────────────────────────────

type ProductCard = ShowcaseProduct

type Msg =
	| { id: string; role: 'user'; text: string }
	| {
			id: string
			role: 'assistant'
			text: string
			cards: ProductCard[]
			done: boolean
			serverId?: string
	  }
	| { id: string; role: 'error'; text: string; retryText?: string }

type Props = {
	slug: string
	name: string
	avatar: string | null
	welcomeMessage: string | null
	settings: ChatLinkSettings
}

// ─── Assistant parsing (mirrors public/widget/loader.js) ────────────────────

function parseAssistant(
	raw: string,
	done: boolean,
): { text: string; cards: ProductCard[] } {
	const shared = parseProductShowcaseContent(raw, done)
	return { text: shared.text, cards: done ? shared.products : [] }
}

function errorText(code?: string): string {
	switch (code) {
		case 'RATE_LIMIT':
			return 'تعداد پیام‌ها زیاد شد — چند لحظه صبر کنید و دوباره بفرستید.'
		case 'PLAN_BLOCKED':
			return 'ظرفیت گفتگوی این صفحه فعلاً تکمیل است. کمی بعد سر بزنید.'
		case 'OPERATOR_ACTIVE':
			return 'پیامت ثبت شد؛ ادامه این گفتگو در اختیار اپراتور است.'
		default:
			return 'ارسال پیام ناموفق بود. دوباره تلاش کنید.'
	}
}

function isRetryableError(code?: string): boolean {
	return !['PLAN_BLOCKED', 'OPERATOR_ACTIVE', 'LEAD_REQUIRED', 'WIDGET_DISABLED'].includes(
		code ?? '',
	)
}

let idCounter = 0
const nextId = () => `m${Date.now()}-${++idCounter}`

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatLinkClient({ slug, name, avatar, welcomeMessage, settings }: Props) {
	const accent = settings.primaryColor
	const onAccent = contrastOn(accent)
	const reduce = useReducedMotion()

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
	const convTokenRef = useRef<string | null>(null)
	const leadRef = useRef<{ name: string; phone: string } | null>(null)
	const rootRef = useRef<HTMLDivElement>(null)
	const scrollerRef = useRef<HTMLDivElement>(null)

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
				convTokenRef.current = localStorage.getItem(`${convKey}:token`)
				const storedLead = localStorage.getItem(leadKey)
				if (storedLead) leadRef.current = JSON.parse(storedLead)
				const storedMsgs = localStorage.getItem(msgsKey)
				if (storedMsgs) {
					const parsed = JSON.parse(storedMsgs) as Msg[]
					if (Array.isArray(parsed)) setMessages(parsed.slice(-60))
				}
				// If we have a conversation but no local transcript, fetch from server.
				if (convIdRef.current && convTokenRef.current && !storedMsgs) {
					try {
						const res = await fetch(
							`/api/chat-link/${encodeURIComponent(slug)}/chat?conversationId=${encodeURIComponent(convIdRef.current)}`,
							{ headers: { Accept: 'application/json', 'X-Vigent-Conversation-Token': convTokenRef.current } },
						)
						if (res.ok) {
							const data = await res.json()
							if (!cancelled && Array.isArray(data.messages)) {
								const restored: Msg[] = data.messages
									.map((m: { id?: string; role: string; content: string }) => {
										const id = m.id || nextId()
										if (m.role === 'user')
											return {
												id,
												role: 'user',
												text: m.content,
											} as Msg
										const parsedAssistant = parseAssistant(m.content, true)
										return {
											id,
											role: 'assistant',
											text: parsedAssistant.text,
											cards: parsedAssistant.cards,
											done: true,
											serverId: id,
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

	// force=false respects the reader's position: if the visitor scrolled up
	// to read older messages, streaming deltas won't yank them back down.
	const scrollDown = useCallback((smooth = true, force = true) => {
		const el = scrollerRef.current
		if (!el) return
		if (!force) {
			const gap = el.scrollHeight - el.scrollTop - el.clientHeight
			if (gap > 120) return
		}
		requestAnimationFrame(() => {
			el.scrollTo({
				top: el.scrollHeight,
				behavior: smooth ? 'smooth' : 'auto',
			})
		})
	}, [])

	// ── Operator-message polling ───────────────────────────────────────────
	// The chat-link page is a request/response channel: when an operator
	// replies from the dashboard CRM, there's no WebSocket/SSE push to the
	// visitor. We poll the GET history endpoint every 8 seconds while:
	//   (a) we have a conversationId, and
	//   (b) we're not currently streaming an AI reply (the AI streams via
	//       its own SSE so polling would only add noise during that phase).
	// New server-side messages (id not seen locally) are appended. This
	// catches operator replies so the visitor sees them without a refresh.
	useEffect(() => {
		if (!hydrated) return
		const convId = convIdRef.current
		const convToken = convTokenRef.current
		if (!convId || !convToken) return
		let cancelled = false
		const interval = setInterval(async () => {
			if (cancelled || streaming) return
			try {
				const res = await fetch(
					`/api/chat-link/${encodeURIComponent(slug)}/chat?conversationId=${encodeURIComponent(convId)}`,
					{ headers: { Accept: 'application/json', 'X-Vigent-Conversation-Token': convToken } },
				)
				if (!res.ok) return
				const data = await res.json()
				if (cancelled || !Array.isArray(data.messages)) return
				setMessages((prev) => {
					// Build a set of ids+texts we already have so we only
					// append genuinely new server messages. We key on the
					// server id (when we have it) and fall back to text
					// content for local-only placeholders.
					const seen = new Set<string>()
					for (const m of prev) {
						if (m.role === 'assistant' && m.serverId) seen.add(m.serverId)
						else if (m.role === 'user') seen.add('u:' + m.text.slice(0, 80))
						else seen.add('e:' + m.text.slice(0, 80))
					}
					const additions: Msg[] = []
					for (const sm of data.messages) {
						const id = sm.id as string
						// Skip if we already have this server id
						if (seen.has(id)) continue
						// Skip user echoes (we already show what we typed)
						if (sm.role === 'user') {
							const key = 'u:' + String(sm.content).slice(0, 80)
							if (seen.has(key)) continue
						}
						if (sm.role === 'user') {
							additions.push({
								id,
								role: 'user',
								text: sm.content,
							})
						} else {
							const parsedAssistant = parseAssistant(String(sm.content), true)
							additions.push({
								id,
								role: 'assistant',
								text: parsedAssistant.text,
								cards: parsedAssistant.cards,
								done: true,
								serverId: id,
							})
						}
					}
					if (additions.length === 0) return prev
					scrollDown(true, false)
					return [...prev, ...additions]
				})
			} catch {
				/* network error — skip this cycle */
			}
		}, 8000)
		return () => {
			cancelled = true
			clearInterval(interval)
		}
	}, [hydrated, slug, streaming, scrollDown])

	useEffect(() => {
		if (messages.length) scrollDown(false)
	}, [hydrated]) // eslint-disable-line react-hooks/exhaustive-deps

	// ── Mobile keyboard handling ──────────────────────────────────────────
	// When the soft keyboard opens, the visualViewport shrinks. We pin the
	// root container's height to the visible viewport so the composer stays
	// anchored above the keyboard and the page never scrolls underneath.
	// Mirrors the pattern used in public/widget/loader.js#applyViewportHeight.
	useEffect(() => {
		if (typeof window === 'undefined' || !window.visualViewport) return
		const vv = window.visualViewport
		const onResize = () => {
			if (rootRef.current) {
				rootRef.current.style.height = vv.height + 'px'
			}
			scrollDown()
		}
		vv.addEventListener('resize', onResize)
		vv.addEventListener('scroll', onResize)
		return () => {
			vv.removeEventListener('resize', onResize)
			vv.removeEventListener('scroll', onResize)
		}
	}, [scrollDown])

	// ── Send flow ──
	const send = useCallback(
		async (
			text: string,
			options: { appendUser?: boolean; removeErrorId?: string } = {},
		) => {
			const message = text.trim()
			if (!message || streaming) return
			if (options.removeErrorId) {
				setMessages((current) => current.filter((item) => item.id !== options.removeErrorId))
			}
			setInput('')
			setStreaming(true)

			const isFirst = !convIdRef.current
			if (options.appendUser !== false) {
				setMessages((m) => [
					...m,
					{ id: nextId(), role: 'user', text: message },
				])
			}
			scrollDown()
			const appendError = (code?: string) => {
				setMessages((current) => [
					...current,
					{
						id: nextId(),
						role: 'error',
						text: errorText(code),
						...(isRetryableError(code) ? { retryText: message } : {}),
					},
				])
			}

			const assistantId = nextId()
			let raw = ''
			let started = false
			let serverId: string | undefined
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
						...(serverId ? { serverId } : {}),
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
						conversationToken: convTokenRef.current,
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
					appendError(err?.error)
					return
				}
				const issuedToken = res.headers.get('x-vigent-conversation-token')
				if (issuedToken) {
					convTokenRef.current = issuedToken
					try { localStorage.setItem(`${convKey}:token`, issuedToken) } catch {}
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
								scrollDown(true, false)
							} else if (evt.type === 'replace' && typeof evt.text === 'string') {
								raw = evt.text
								started = true
								upsertAssistant(true)
							} else if (evt.type === 'done') {
								if (evt.messageId && typeof evt.messageId === 'string')
									serverId = evt.messageId
								upsertAssistant(true)
							} else if (evt.type === 'error' && !started) {
								appendError(evt.error)
							}
						} catch {
							/* partial frame — ignored */
						}
					}
				}
				if (started) upsertAssistant(true)
			} catch {
				appendError()
			} finally {
				setStreaming(false)
				// Respect a reader who scrolled up mid-stream: don't yank them to the
				// bottom just because the reply finished.
				scrollDown(true, false)
			}
		},
		[slug, streaming, convKey, scrollDown],
	)

	const submitLead = useCallback(() => {
		// Convert any Persian/Arabic digits to English before validating
		// so the 10-digit length check works for Persian input too.
		const phone = toEnglishDigits(leadPhone).trim()
		const lead = { name: leadName.trim(), phone }
		if (!lead.name || lead.phone.replace(/\D/g, '').length < 10) return
		leadRef.current = lead
		try {
			localStorage.setItem(leadKey, JSON.stringify(lead))
		} catch {}
		setLeadPending(false)
	}, [leadName, leadPhone, leadKey])

	const reset = useCallback(() => {
		convIdRef.current = null
		convTokenRef.current = null
		setMessages([])
		try {
			localStorage.removeItem(convKey)
			localStorage.removeItem(`${convKey}:token`)
			localStorage.removeItem(msgsKey)
		} catch {}
	}, [convKey, msgsKey])

	const empty = messages.length === 0
	const monogram = useMemo(() => (name || '؟').trim().charAt(0), [name])

	// The shared composer paints its send button from --accent-strong, so feeding
	// the owner's accent through that variable keeps this page's branding without
	// forking the component. --vgt-on-accent carries the computed contrast colour
	// for the icon and hover state, which the shared button's `text-white` /
	// `hover:bg-black` pair would get wrong on a light accent.
	const composerAccent = {
		'--accent-strong': accent,
		'--vgt-on-accent': onAccent,
	} as CSSProperties

	return (
		<div
			ref={rootRef}
			className="relative flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-[#f2f2f0] text-neutral-900"
		>
			<Background kind={settings.background} accent={accent} reduce={Boolean(reduce)} />

			{/* App column */}
			<div className="relative z-10 mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden bg-white/55 backdrop-blur-sm md:my-3 md:h-[calc(100%-1.5rem)] md:rounded-[2rem] md:border md:border-white/70 md:shadow-[0_28px_90px_rgba(0,0,0,0.13)]">
				{/* Header — pt uses safe-area so it clears the notch/Dynamic Island
                                    in standalone or in-app browsers with viewport-fit=cover. */}
				<header className="flex items-center gap-3 border-b border-black/[0.06] bg-white/82 px-4 pb-3 backdrop-blur-2xl [padding-top:max(env(safe-area-inset-top),12px)] md:px-5">
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
						className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-black/5 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
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
					{/* While hydrating from localStorage / server history, show a
                                            loading state so the page doesn't look frozen. */}
					{!hydrated ? (
						<LoadingDots accent={accent} />
					) : empty || leadPending ? (
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
						<div dir="ltr" className="flex flex-col gap-2.5 pb-2">
							{messages.map((m) => (
								<MessageRow
									key={m.id}
									msg={m}
									accent={accent}
									onAccent={onAccent}
									onRetry={
										m.role === 'error' && m.retryText
											? () => void send(m.retryText!, { appendUser: false, removeErrorId: m.id })
											: undefined
									}
								/>
							))}
							{streaming && messages[messages.length - 1]?.role === 'user' && (
								<div className="flex justify-start">
									<TypingIndicator
										label={`${name} در حال نوشتن است`}
										accentColor={accent}
									/>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Composer */}
				<div className="border-t border-black/[0.06] bg-white/88 px-3 pt-3 backdrop-blur-2xl [padding-bottom:max(env(safe-area-inset-bottom),12px)] md:px-4">
					{leadPending ? (
						<div className="px-4 py-5 text-center">
							<p className="text-[13px] text-neutral-400">
								برای شروع گفتگو، اطلاعات زیر را وارد کنید
							</p>
						</div>
					) : (
						<div style={composerAccent}>
							<ChatComposer
								value={input}
								onChange={setInput}
								onSend={() => void send(input)}
								busy={streaming}
								disabled={leadPending || !hydrated}
								dir="rtl"
								sendLabel="ارسال"
								placeholder="پیام خود را بنویسید…"
								className="[&_button]:!text-[color:var(--vgt-on-accent)] [&_button:hover:enabled]:!bg-[color:color-mix(in_srgb,var(--accent-strong)_86%,black)]"
								footer={
									<p dir="ltr" className="mt-2 text-center text-[10px] text-neutral-400">
										Powered by{' '}
										<Link
											href="/"
											className="inline-flex items-center align-middle font-medium text-neutral-500 transition-colors hover:text-neutral-800"
										>
											<svg
												viewBox="174 298 692 126"
												height="11"
												className="inline-block fill-current"
												xmlns="http://www.w3.org/2000/svg"
											aria-label="Vigento AI by Vigent"
											>
												<g transform="matrix(2.4635 0 0 2.4635 512 360.934)">
													<g transform="translate(-111.996 0)">
														<path
															transform="translate(-100 -95.9747)"
															d="M 120.484 70.7747 L 104.14 107.2787 L 106.156 111.3827 L 124.3 70.7747 Z M 100.108 116.4227 L 99.1 114.3347 L 96.364 108.0707 L 79.732 70.7747 L 75.7 70.7747 L 98.164 121.1747 L 102.196 121.1747 L 102.052 120.8147 Z"
														/>
													</g>
													<g transform="translate(-76.644 0)">
														<path
															transform="translate(-100 -95.9747)"
															d="M 101.836 78.5507 L 101.836 70.7747 L 98.164 70.7747 L 98.164 78.5507 Z M 101.836 121.1747 L 101.836 86.7587 L 98.164 86.7587 L 98.164 121.1747 Z"
														/>
													</g>
													<g transform="translate(-40.14 0)">
														<path
															transform="translate(-98.236 -95.9747)"
															d="M 116.776 117.7187 C 118.072 116.9987 119.224 116.0627 120.304 115.0547 L 120.304 96.1907 L 116.776 96.1907 Z M 90.784 76.6787 C 94.24 74.7347 98.128 73.7987 102.448 73.7987 C 105.616 73.7987 108.496 74.3027 111.16 75.2387 C 113.752 76.1747 116.128 77.6867 118.216 79.7747 L 120.52 77.3267 C 118.288 75.0947 115.624 73.3667 112.6 72.2147 C 109.504 70.9907 106.048 70.4147 102.376 70.4147 C 97.336 70.4147 92.8 71.4947 88.84 73.7267 C 84.808 75.9587 81.64 78.9827 79.408 82.8707 C 77.104 86.7587 75.952 91.1507 75.952 95.9747 C 75.952 100.7987 77.104 105.1907 79.408 109.0787 C 81.64 112.9667 84.808 115.9907 88.84 118.2227 C 92.8 120.4547 97.336 121.5347 102.304 121.5347 C 104.68 121.5347 106.912 121.1747 109.072 120.6707 L 109.072 117.2867 C 107.056 117.8627 104.824 118.1507 102.448 118.1507 C 98.128 118.1507 94.24 117.2147 90.784 115.2707 C 87.328 113.3267 84.592 110.6627 82.648 107.2787 C 80.632 103.8947 79.624 100.0787 79.624 95.9747 C 79.624 91.7987 80.632 88.0547 82.576 84.6707 C 84.52 81.2147 87.256 78.6227 90.784 76.6787 Z"
														/>
													</g>
													<g transform="translate(14.364 0)">
														<path
															transform="translate(-101.008 -95.9747)"
															d="M 117.316 74.0867 L 117.316 70.7747 L 84.7 70.7747 L 84.7 74.0867 Z M 117.316 121.1747 L 117.316 117.8627 L 84.7 117.8627 L 84.7 121.1747 Z M 117.316 97.1987 L 117.316 93.9587 L 95.5 93.9587 L 95.5 97.1987 Z M 88.084 81.2147 L 84.7 81.2147 L 84.7 109.9427 L 88.084 109.9427 Z"
														/>
													</g>
													<g transform="translate(66.744 0)">
														<path
															transform="translate(-100 -95.9747)"
															d="M 79.48 121.1747 L 83.152 121.1747 L 83.152 86.1827 L 79.48 81.2147 Z M 116.848 70.7747 L 116.848 114.5507 L 82.576 70.7747 L 79.48 70.7747 L 79.48 72.5027 L 83.152 77.3987 L 117.496 121.1747 L 120.52 121.1747 L 120.52 70.7747 Z"
														/>
													</g>
													<g transform="translate(116.316 0)">
														<path
															transform="translate(-100 -95.9747)"
															d="M 80.02 70.7747 L 80.02 74.0867 L 119.98 74.0867 L 119.98 70.7747 Z M 101.836 121.1747 L 101.836 81.1427 L 98.164 81.1427 L 98.164 121.1747 Z"
														/>
													</g>
												</g>
											</svg>
										</Link>
									</p>
								}
							/>
						</div>
					)}
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
					decoding="async"
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
	const reduce = useReducedMotion()
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
		<div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center px-1 py-7 text-center">
			<motion.div
				initial={reduce ? false : { opacity: 0, scale: 0.96 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.5, ease: 'easeOut' }}
			>
				<Avatar avatar={avatar} monogram={monogram} accent={accent} size={76} pulse />
			</motion.div>

			{showAiBadge && (
				<motion.span
					initial={reduce ? false : { opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.15, duration: 0.45 }}
					className="mt-5 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/85 px-3.5 text-[11px] tracking-wide text-neutral-600 shadow-[0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur"
				>
					<Sparkles className="h-3 w-3" style={{ color: accent }} />
					پاسخ فوری با هوش مصنوعی
				</motion.span>
			)}

			<motion.h1
				initial={reduce ? false : { opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.22, duration: 0.45 }}
				className="mt-3 text-2xl font-semibold tracking-tight"
			>
				{name}
			</motion.h1>

			{tagline && (
				<motion.p
					initial={reduce ? false : { opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.3, duration: 0.45 }}
					className="mt-1.5 max-w-xs text-sm text-neutral-500"
				>
					{tagline}
				</motion.p>
			)}

			{leadPending ? (
				<motion.div
					initial={reduce ? false : { opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.4, duration: 0.5 }}
					className="mt-7 w-full max-w-sm rounded-[1.6rem] border border-black/[0.08] bg-white/90 p-5 text-start shadow-[0_18px_55px_rgba(0,0,0,0.09)] backdrop-blur-xl"
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
								onChange={(e) => setLeadPhone(toEnglishDigits(e.target.value))}
								placeholder="شماره موبایل"
								inputMode="tel"
								dir="rtl"
								className="w-full bg-transparent text-start text-[16px] outline-none placeholder:text-neutral-400"
							/>
						</label>
						<button
							onClick={submitLead}
							disabled={
								!leadName.trim() ||
								toEnglishDigits(leadPhone).replace(/\D/g, '').length < 10
							}
							className="w-full rounded-2xl py-2.5 text-sm font-medium shadow-sm transition-[transform,opacity,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-40"
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
							initial={reduce ? false : { opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.4, duration: 0.5 }}
							className="mt-7 max-w-sm rounded-[1.5rem] rounded-ss-lg border border-black/[0.07] bg-white/92 px-4 py-3.5 text-start text-sm leading-7 text-neutral-800 shadow-[0_14px_40px_rgba(0,0,0,0.08)] backdrop-blur"
						>
							{welcomeMessage}
						</motion.div>
					)}

					{quickReplies.length > 0 && (
						<div className="mt-5 flex max-w-md flex-wrap items-center justify-center gap-2">
							{quickReplies.map((q, i) => (
								<motion.button
									key={q}
									initial={reduce ? false : { opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.5 + i * 0.07, duration: 0.4 }}
									onClick={() => onPick(q)}
									className="min-h-11 rounded-full border border-black/10 bg-white/85 px-4 py-2 text-[13px] text-neutral-700 shadow-sm backdrop-blur transition-[border-color,box-shadow,transform] duration-150 hover:border-black/25 hover:shadow active:scale-[0.97]"
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
	onRetry,
}: {
	msg: Msg
	accent: string
	onAccent: string
	onRetry?: () => void
}) {
	if (msg.role === 'error') {
		return (
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				className="mx-auto flex max-w-[92%] items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700"
			>
				<span>{msg.text}</span>
				{onRetry && (
					<button
						type="button"
						onClick={onRetry}
					className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border border-red-200 bg-white px-3 font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
					>
						<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
						تلاش مجدد
					</button>
				)}
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
			<div
				className={
					isUser
						? 'max-w-[85%]'
						: `space-y-2 ${msg.cards.length ? 'w-full max-w-[min(92vw,680px)]' : 'max-w-[85%]'}`
				}
			>
				{(isUser || msg.text) && (
					<ConversationBubble
						side={isUser ? 'end' : 'start'}
						tone={isUser ? 'accent' : 'light'}
						className="rounded-3xl px-4 text-[15px] leading-7"
						style={isUser ? { backgroundColor: accent, color: onAccent } : undefined}
					>
						<ConversationText
							text={msg.text}
							markdown={!isUser}
							className={!isUser ? '[&_p]:leading-7 [&_p]:text-right' : undefined}
						/>
					</ConversationBubble>
				)}
				{!isUser && msg.cards.length > 0 && (
					<ProductShowcaseRail
						products={msg.cards}
						locale="fa"
						accent={accent}
						onAccent={onAccent}
					/>
				)}
			</div>
		</motion.div>
	)
}

// Subtle full-area loading state shown while the transcript hydrates from
// localStorage / the server, so the page never looks frozen on a cold visit.
function LoadingDots({ accent }: { accent: string }) {
	return (
		<div className="flex h-full items-center justify-center py-12">
			<div className="flex items-center gap-1.5">
				{[0, 1, 2].map((i) => (
					<span
						key={i}
						className="h-2 w-2 animate-bounce rounded-full"
						style={{
							backgroundColor: accent,
							animationDelay: `${i * 0.15}s`,
						}}
					/>
				))}
			</div>
		</div>
	)
}

/** Ambient page background — quiet, slow, never competing with the chat. */
function Background({
	kind,
	accent,
	reduce,
}: {
	kind: ChatLinkSettings['background']
	accent: string
	reduce: boolean
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
				animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 24, 0] }}
				transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
			/>
			<motion.div
				className="absolute bottom-[-20%] end-[-10%] h-[380px] w-[380px] rounded-full blur-[110px]"
				style={{ backgroundColor: blobB, opacity: 0.1 }}
				animate={reduce ? undefined : { x: [0, -32, 0], y: [0, -20, 0] }}
				transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
			/>
		</div>
	)
}
