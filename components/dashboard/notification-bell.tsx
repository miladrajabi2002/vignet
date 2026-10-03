'use client'

import { useCallback, useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion'
import {
	Bell,
	BellRing,
	CalendarCheck2,
	Check,
	CheckCheck,
	Headset,
	Megaphone,
	MessageSquareText,
	Sparkles,
	Unplug,
	X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime, smartTime } from '@/lib/format'
import { claimNotificationArrivals } from '@/lib/notifications/browser-delivery'

interface NotificationItem {
	id: string
	type: string
	title: string
	body: string | null
	link: string | null
	read: boolean
	createdAt: string
}

const POLL_MS = 10_000
// How long the in-app toast stays on screen. Short by design: the bell badge
// keeps unread state, and the countdown bar makes the dismissal predictable.
// (Browser-tab notifications use their own, longer close timer below.)
const TOAST_MS = 4_000
// Mobile sheet: a downward drag past this distance, or a flick, dismisses it.
const DISMISS_DISTANCE = 110
const DISMISS_VELOCITY = 550

interface NotificationToast extends NotificationItem {
	ids: string[]
}

type Filter = 'all' | 'unread'
type DayGroup = 'today' | 'yesterday' | 'week' | 'older'
type TypeLabelKey = 'typeMessage' | 'typeHandoff' | 'typeAppointment' | 'typeChannel' | 'typeLearning' | 'typeSystem'

// One icon + tone per notification type so the list scans by colour before
// anyone reads a word. Tones stay soft; unread state is carried separately.
const TYPE_META: Record<string, { icon: ComponentType<{ className?: string }>; tone: string; label: TypeLabelKey }> = {
	NEW_MESSAGE: { icon: MessageSquareText, tone: 'bg-black/[0.04] text-[var(--text-secondary)] ring-black/[0.06]', label: 'typeMessage' },
	HANDOFF: { icon: Headset, tone: 'bg-amber-50 text-amber-700 ring-amber-100', label: 'typeHandoff' },
	APPOINTMENT: { icon: CalendarCheck2, tone: 'bg-black/[0.04] text-[var(--text-secondary)] ring-black/[0.06]', label: 'typeAppointment' },
	CHANNEL_DOWN: { icon: Unplug, tone: 'bg-red-50 text-red-700 ring-red-100', label: 'typeChannel' },
	LEARNING: { icon: Sparkles, tone: 'bg-[var(--signal-soft)] text-[var(--signal-strong)] ring-[color:color-mix(in_srgb,var(--signal)_15%,transparent)]', label: 'typeLearning' },
	SYSTEM: { icon: Megaphone, tone: 'bg-zinc-100 text-zinc-700 ring-zinc-200/70', label: 'typeSystem' },
}

function typeMeta(type: string) {
	return TYPE_META[type] ?? TYPE_META.SYSTEM
}

const DAY_GROUP_ORDER: DayGroup[] = ['today', 'yesterday', 'week', 'older']
const DAY_GROUP_KEY: Record<DayGroup, 'groupToday' | 'groupYesterday' | 'groupWeek' | 'groupOlder'> = {
	today: 'groupToday',
	yesterday: 'groupYesterday',
	week: 'groupWeek',
	older: 'groupOlder',
}

function dayGroup(createdAt: string, now: Date): DayGroup {
	const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
	const time = new Date(createdAt).getTime()
	if (time >= startOfToday) return 'today'
	if (time >= startOfToday - 86_400_000) return 'yesterday'
	if (time >= startOfToday - 6 * 86_400_000) return 'week'
	return 'older'
}

function groupByDay(items: readonly NotificationItem[], now: Date) {
	const buckets = new Map<DayGroup, NotificationItem[]>()
	for (const item of items) {
		const group = dayGroup(item.createdAt, now)
		buckets.set(group, [...(buckets.get(group) ?? []), item])
	}
	return DAY_GROUP_ORDER.flatMap((group) => {
		const groupItems = buckets.get(group)
		return groupItems ? [{ group, items: groupItems }] : []
	})
}

function pushBrowserNotification(item: NotificationToast, scope: string, fa: boolean, onClick: () => void) {
	if (!('Notification' in window) || window.Notification.permission !== 'granted') return
	try {
		const notification = new window.Notification(item.title, {
			body: item.body ?? undefined,
			tag: `vigent-${scope}`,
			icon: '/android-chrome-192x192.png',
			dir: fa ? 'rtl' : 'ltr',
			lang: fa ? 'fa' : 'en',
			silent: true,
			requireInteraction: false,
		})
		notification.onclick = () => {
			window.focus()
			onClick()
			notification.close()
		}
		window.setTimeout(() => notification.close(), TOAST_MS)
	} catch {
		// Some browsers expose Notification but do not support its constructor.
	}
}

function useIsMobile() {
	const [mobile, setMobile] = useState(false)
	useEffect(() => {
		const query = window.matchMedia('(max-width: 639px)')
		const update = () => setMobile(query.matches)
		update()
		query.addEventListener('change', update)
		return () => query.removeEventListener('change', update)
	}, [])
	return mobile
}

export function NotificationBell() {
	const t = useTranslations('notifications')
	const fa = useLocale() !== 'en'
	const numberLocale = fa ? 'fa-IR' : 'en-US'
	const reduceMotion = useReducedMotion()
	const isMobile = useIsMobile()
	const dragControls = useDragControls()
	const [open, setOpen] = useState(false)
	const [items, setItems] = useState<NotificationItem[]>([])
	const [unread, setUnread] = useState(0)
	const [filter, setFilter] = useState<Filter>('all')
	const [now, setNow] = useState(() => new Date())
	const [ringKey, setRingKey] = useState(0)
	const [mounted, setMounted] = useState(false)
	const [toast, setToast] = useState<NotificationToast | null>(null)
	const [browserPermission, setBrowserPermission] = useState<
		NotificationPermission | 'unsupported'
	>('unsupported')
	const triggerRef = useRef<HTMLButtonElement>(null)
	const panelRef = useRef<HTMLElement>(null)
	const loadingRef = useRef(false)
	const openRef = useRef(false)
	const mountedRef = useRef(false)
	const readingRef = useRef(false)
	const readRevisionRef = useRef(0)
	const unreadRef = useRef<number | null>(null)
	const [reading, setReading] = useState(false)
	const [readError, setReadError] = useState(false)

	useEffect(() => {
		setMounted(true)
		mountedRef.current = true
		if ('Notification' in window) {
			setBrowserPermission(window.Notification.permission)
		}
		return () => { mountedRef.current = false }
	}, [])

	// Ring the bell once whenever the unread count grows after the first load.
	useEffect(() => {
		if (unreadRef.current !== null && unread > unreadRef.current) setRingKey((key) => key + 1)
		unreadRef.current = unread
	}, [unread])

	const load = useCallback(async () => {
		if (loadingRef.current || readingRef.current) return
		loadingRef.current = true
		const revision = readRevisionRef.current
		try {
			const res = await fetch('/api/notifications', {
				cache: 'no-store',
				headers: { Accept: 'application/json' },
			})
			if (!res.ok) return
			const data = await res.json() as {
				items?: NotificationItem[]
				unread?: number
				scope?: string
			}
			if (!mountedRef.current || revision !== readRevisionRef.current || readingRef.current) return
			const nextItems = Array.isArray(data.items) ? data.items : []
			setItems(nextItems)
			setUnread(typeof data.unread === 'number' ? data.unread : 0)
			setNow(new Date())
			if (!data.scope) return
			const arrivals = await claimNotificationArrivals(data.scope, nextItems, openRef.current)
			if (!arrivals.length || !mountedRef.current || openRef.current || revision !== readRevisionRef.current) return

			const newest = arrivals[0]
			const grouped = arrivals.length > 1
			const handoffs = arrivals.every((item) => /handoff|operator/i.test(item.type))
			const alert: NotificationToast = {
				...newest,
				ids: arrivals.map((item) => item.id),
				...(grouped ? {
					title: t(handoffs ? 'handoffSummary' : 'batchSummary', { count: arrivals.length }),
					body: t('batchBody'),
					link: null,
				} : {}),
			}
			if (document.visibilityState === 'visible') {
				setReadError(false)
				setToast(alert)
			} else {
				pushBrowserNotification(alert, data.scope, fa, () => {
					openRef.current = true
					setOpen(true)
				})
			}
		} catch {
			// A transient notification failure must not interrupt the dashboard.
		} finally {
			loadingRef.current = false
		}
	}, [fa, t])

	useEffect(() => {
		void load()
		const refreshWhenVisible = () => {
			if (document.visibilityState === 'visible') void load()
		}
		const id = window.setInterval(() => {
			if (document.visibilityState === 'visible') void load()
		}, POLL_MS)
		const refreshOnFocus = () => void load()
		document.addEventListener('visibilitychange', refreshWhenVisible)
		window.addEventListener('focus', refreshOnFocus)
		window.addEventListener('online', refreshOnFocus)
		return () => {
			window.clearInterval(id)
			document.removeEventListener('visibilitychange', refreshWhenVisible)
			window.removeEventListener('focus', refreshOnFocus)
			window.removeEventListener('online', refreshOnFocus)
		}
	}, [load])

	// Auto-dismiss the toast after TOAST_MS — always. There is deliberately
	// no hover/focus pause: touch devices fire mouseenter without a matching
	// mouseleave, which used to freeze the toast on screen until the ✕ was
	// tapped. The countdown bar communicates the remaining time instead.
	useEffect(() => {
		if (!toast) return
		const id = window.setTimeout(() => setToast(null), TOAST_MS)
		return () => window.clearTimeout(id)
	}, [toast])

	const closePanel = useCallback(() => {
		openRef.current = false
		setOpen(false)
	}, [])

	useEffect(() => {
		openRef.current = open
		if (!open) return
		setToast(null)
		setNow(new Date())
		const trigger = triggerRef.current
		const clock = window.setInterval(() => setNow(new Date()), 60_000)
		const focusFrame = window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }))
		function close(event: MouseEvent) {
			const target = event.target as Node
			if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
				closePanel()
			}
		}
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault()
				closePanel()
				return
			}
			if (event.key !== 'Tab') return
			const focusable = Array.from(
				panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? [],
			)
			if (focusable.length === 0) return
			const first = focusable[0]
			const last = focusable[focusable.length - 1]
			const active = document.activeElement
			if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
				event.preventDefault()
				last.focus()
			} else if (!event.shiftKey && (active === last || !panelRef.current?.contains(active))) {
				event.preventDefault()
				first.focus()
			}
		}
		document.addEventListener('mousedown', close)
		document.addEventListener('keydown', onKeyDown)
		return () => {
			window.clearInterval(clock)
			window.cancelAnimationFrame(focusFrame)
			document.removeEventListener('mousedown', close)
			document.removeEventListener('keydown', onKeyDown)
			trigger?.focus({ preventScroll: true })
		}
	}, [open, closePanel])

	// The mobile sheet covers the page, so the page must not scroll under it.
	useEffect(() => {
		if (!open || !isMobile) return
		const prev = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => { document.body.style.overflow = prev }
	}, [open, isMobile])

	async function enableBrowserNotifications() {
		if (!('Notification' in window)) return
		const permission = await window.Notification.requestPermission()
		setBrowserPermission(permission)
	}

	async function markRead(target?: string | string[]) {
		if (readingRef.current) return
		readingRef.current = true
		readRevisionRef.current += 1
		setReading(true)
		setReadError(false)
		const ids = typeof target === 'string' ? [target] : target
		try {
			const res = await fetch('/api/notifications/read', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(ids ? { ids } : {}),
			})
			if (!res.ok) throw new Error('Notification read failed')
			const count = items.filter((item) => !item.read && (!ids || ids.includes(item.id))).length
			setItems((current) => current.map((item) =>
				!ids || ids.includes(item.id) ? { ...item, read: true } : item,
			))
			setUnread((current) => ids ? Math.max(0, current - count) : 0)
			setToast((current) => current && ids && !current.ids.every((id) => ids.includes(id)) ? current : null)
		} catch {
			setReadError(true)
		} finally {
			readingRef.current = false
			setReading(false)
			void load()
		}
	}

	function openPanel() {
		openRef.current = true
		setOpen(true)
		setToast(null)
	}

	function onSheetDragEnd(_: unknown, info: PanInfo) {
		if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > DISMISS_VELOCITY) closePanel()
	}

	function startSheetDrag(event: ReactPointerEvent) {
		if (!isMobile || (event.target as HTMLElement).closest('a, button')) return
		dragControls.start(event)
	}

	const visibleItems = filter === 'unread' ? items.filter((item) => !item.read) : items
	const sections = groupByDay(visibleItems, now)
	const formatCount = (count: number) => (count > 99 ? `${(99).toLocaleString(numberLocale)}+` : count.toLocaleString(numberLocale))

	const sheetMotion = isMobile
		? {
			initial: reduceMotion ? { opacity: 0 } : { y: '100%' },
			animate: reduceMotion ? { opacity: 1 } : { y: 0 },
			exit: reduceMotion ? { opacity: 0 } : { y: '100%' },
			transition: reduceMotion ? { duration: 0.15 } : { type: 'spring' as const, bounce: 0, duration: 0.42 },
		}
		: {
			initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 },
			animate: { opacity: 1, y: 0, scale: 1 },
			exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 },
			transition: reduceMotion ? { duration: 0.15 } : { type: 'spring' as const, bounce: 0, duration: 0.3 },
		}

	return (
		<div className="relative">
			<button
				ref={triggerRef}
				type="button"
				onClick={() => (open ? closePanel() : openPanel())}
				aria-label={unread > 0 ? `${t('title')}${fa ? '، ' : ', '}${t('unreadCount', { count: unread })}` : t('title')}
				aria-expanded={open}
				aria-haspopup="dialog"
				className={cn(
					'spatial-press relative inline-flex h-12 w-12 items-center justify-center rounded-card border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[var(--elev-1)] transition-colors hover:border-black/[0.12] hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 xl:h-14 xl:w-14 xl:rounded-card',
					open && 'border-black bg-black text-white hover:border-black hover:bg-black hover:text-white',
				)}
			>
				<motion.span
					key={ringKey}
					aria-hidden="true"
					className="grid place-items-center"
					style={{ transformOrigin: '50% 10%' }}
					animate={ringKey > 0 && !reduceMotion ? { rotate: [0, -16, 13, -9, 6, -3, 0] } : undefined}
					transition={{ duration: 0.8, ease: 'easeInOut' }}
				>
					{unread > 0 && !open ? <BellRing className="h-[1.05rem] w-[1.05rem]" /> : <Bell className="h-[1.05rem] w-[1.05rem]" />}
				</motion.span>
				<AnimatePresence>
					{unread > 0 && (
						<motion.span
							key="unread"
							initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.65 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.8 }}
							transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
							aria-hidden="true"
							className="absolute -end-1.5 -top-1.5 flex h-[1.2rem] min-w-[1.2rem] items-center justify-center rounded-full bg-[var(--notif)] text-[var(--notif-ink)] px-1 text-[12px] font-bold tabular-nums shadow-sm ring-2 ring-white"
						>
							{formatCount(unread)}
						</motion.span>
					)}
				</AnimatePresence>
			</button>
			<span className="sr-only" aria-live="polite" aria-atomic="true">
				{unread > 0 ? t('unreadCount', { count: unread }) : ''}
			</span>

			{mounted && createPortal(
				<>
					<AnimatePresence>
						{toast && (
							<motion.aside
								dir={fa ? 'rtl' : 'ltr'}
								role="status"
								aria-live="polite"
								aria-atomic="true"
								initial={reduceMotion
									? { opacity: 0 }
									: { opacity: 0, transform: 'translate3d(0,-10px,0) scale(0.98)' }}
								animate={{ opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }}
								exit={reduceMotion
									? { opacity: 0 }
									: { opacity: 0, transform: 'translate3d(0,-6px,0) scale(0.985)' }}
								transition={reduceMotion
									? { duration: 0.16 }
									: { type: 'spring', bounce: 0, duration: 0.34 }}
								className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[101] mx-auto max-w-md overflow-hidden rounded-card border border-black/[0.08] bg-white/95 shadow-[0_18px_48px_-20px_rgba(17,17,17,0.45)] backdrop-blur-xl sm:inset-x-auto sm:end-5 sm:top-[5.75rem] sm:mx-0 sm:w-[24rem] sm:bg-white xl:top-[6.75rem]"
							>
								<div className="flex items-start gap-1 p-1.5">
									{toast.link ? (
										<Link
											href={toast.link}
											onClick={() => {
												void markRead(toast.ids)
												setToast(null)
											}}
											className="flex min-w-0 flex-1 items-start gap-3 rounded-[14px] p-2 transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
										>
											<ToastContent item={toast} label={t('newNotification')} />
										</Link>
									) : (
										<button
											type="button"
											onClick={openPanel}
											className="flex min-w-0 flex-1 items-start gap-3 rounded-[14px] p-2 text-start transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
										>
											<ToastContent item={toast} label={t('newNotification')} />
										</button>
									)}
									<button
										type="button"
										onClick={() => setToast(null)}
										aria-label={t('close')}
										className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--text-hint)] transition-colors hover:bg-black/[0.05] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
								<div className="flex items-center gap-2 px-3.5 pb-3.5 ps-[4.1rem]">
									<button
										type="button"
										disabled={reading}
										onClick={() => void markRead(toast.ids)}
										className="spatial-press inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-black px-3.5 text-[12px] font-bold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 disabled:opacity-50"
									>
										<CheckCheck className="h-3.5 w-3.5" />
										{t(toast.ids.length > 1 ? 'markBatchRead' : 'markReadShort')}
									</button>
									<button
										type="button"
										onClick={openPanel}
										className="inline-flex min-h-9 items-center justify-center rounded-full border border-black/[0.1] px-3.5 text-[12px] font-semibold text-black transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
									>
										{t('viewAll')}
									</button>
								</div>
								{readError && <p role="alert" className="px-4 pb-3 text-xs text-red-700">{t('readError')}</p>}
								{/* Countdown — makes the 4s auto-dismiss visible so nobody
								    waits for a ✕ they never need. */}
								<span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/[0.05]" aria-hidden="true">
									<span
										className="block h-full bg-black/70 motion-reduce:!animate-none"
										style={{
											animation: `undo-countdown ${TOAST_MS}ms linear forwards`,
											transformOrigin: fa ? 'right' : 'left',
										}}
									/>
								</span>
							</motion.aside>
						)}
					</AnimatePresence>

					<AnimatePresence>
						{open && (
							<>
								<motion.button
									type="button"
									tabIndex={-1}
									aria-label={t('close')}
									onClick={closePanel}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: reduceMotion ? 0.1 : 0.2 }}
									className="fixed inset-0 z-[98] cursor-default bg-black/40 backdrop-blur-[3px] sm:bg-black/[0.06] sm:backdrop-blur-0"
								/>
								<motion.section
									ref={panelRef}
									dir={fa ? 'rtl' : 'ltr'}
									role="dialog"
									aria-modal="true"
									aria-labelledby="notification-panel-title"
									tabIndex={-1}
									drag={isMobile && !reduceMotion ? 'y' : false}
									dragControls={dragControls}
									dragListener={false}
									dragConstraints={{ top: 0, bottom: 0 }}
									dragElastic={{ top: 0.05, bottom: 0.9 }}
									onDragEnd={onSheetDragEnd}
									{...sheetMotion}
									className="fixed inset-x-2 z-[99] flex max-h-[min(86dvh,44rem)] flex-col overflow-hidden rounded-sheet border border-white/80 bg-[var(--bg-base)] shadow-[0_-10px_40px_-12px_rgba(17,17,17,0.35)] outline-none [bottom:max(0.5rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-auto sm:end-5 sm:top-[5.75rem] sm:max-h-[min(40rem,calc(100dvh-7rem))] sm:w-[26.5rem] sm:rounded-[24px] sm:border-black/[0.08] sm:bg-white sm:shadow-[0_24px_64px_-24px_rgba(17,17,17,0.35),0_2px_6px_rgba(17,17,17,0.05)] xl:top-[6.75rem]"
								>
									<header
										onPointerDown={startSheetDrag}
										className="shrink-0 touch-none select-none px-4 pb-3 pt-2.5 sm:touch-auto sm:select-auto sm:border-b sm:border-black/[0.06] sm:pt-4"
									>
										<span aria-hidden="true" className="mx-auto mb-3 block h-[5px] w-10 rounded-full bg-black/[0.16] sm:hidden" />
										<div className="flex items-center gap-3">
											<div className="min-w-0 flex-1">
												<h2 id="notification-panel-title" className="flex items-center gap-2 text-[15px] font-bold leading-6 text-[var(--text-primary)]">
													{t('title')}
													{unread > 0 && (
														<span className="rounded-full bg-[var(--notif)] text-[var(--notif-ink)] px-2 py-px text-[12px] font-bold tabular-nums">
															{formatCount(unread)}
														</span>
													)}
												</h2>
												<p className="mt-0.5 truncate text-[13px] text-[var(--text-muted)]">
													{unread ? t('unreadCount', { count: unread }) : t('caughtUp')}
												</p>
											</div>
											{unread > 0 && (
												<button
													type="button"
													disabled={reading}
													onClick={() => void markRead()}
													className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-primary)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
												>
													<CheckCheck className="h-4 w-4" aria-hidden="true" />
													{t('markAllShort')}
												</button>
											)}
											<button
												type="button"
												onClick={closePanel}
												aria-label={t('close')}
												className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-black/[0.06] bg-white text-[var(--text-secondary)] shadow-[var(--elev-1)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] sm:border-transparent sm:bg-transparent sm:shadow-none sm:hover:bg-black/[0.05]"
											>
												<X className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
											</button>
										</div>

										<div role="group" aria-label={t('filterLabel')} className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-black/[0.05] p-1">
											{(['all', 'unread'] as const).map((value) => {
												const selected = filter === value
												return (
													<button
														key={value}
														type="button"
														aria-pressed={selected}
														onClick={() => setFilter(value)}
														className={cn(
															'relative inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
															selected ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]',
														)}
													>
														{selected && (
															<motion.span
																layoutId="notification-filter-pill"
																transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0, duration: 0.3 }}
																className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgba(17,17,17,0.08),0_4px_12px_-6px_rgba(17,17,17,0.2)]"
															/>
														)}
														<span className="relative">{t(value === 'all' ? 'filterAll' : 'filterUnread')}</span>
														{value === 'unread' && unread > 0 && (
															<span className="relative rounded-full bg-black/[0.07] px-1.5 text-[12px] font-bold tabular-nums">{formatCount(unread)}</span>
														)}
													</button>
												)
											})}
										</div>
										{readError && <p role="alert" className="mt-2 text-xs text-red-700">{t('readError')}</p>}
									</header>

									<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 [scrollbar-width:thin] sm:px-2 sm:pb-2 sm:pt-1">
										{browserPermission === 'default' && (
											<div className="mb-3 mt-1 flex items-center gap-3 rounded-card border border-black/[0.06] bg-white p-3 shadow-[var(--elev-1)] sm:mx-1 sm:mt-2 sm:bg-[var(--bg-surface)] sm:shadow-none">
												<span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-black text-white">
													<BellRing className="h-4 w-4" aria-hidden="true" />
												</span>
												<p className="min-w-0 flex-1 text-[13px] leading-5 text-[var(--text-secondary)]">{t('enableBrowserHint')}</p>
												<button
													type="button"
													onClick={enableBrowserNotifications}
													className="spatial-press inline-flex min-h-9 shrink-0 items-center rounded-full bg-black px-3.5 text-[12px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
												>
													{t('enableBrowserShort')}
												</button>
											</div>
										)}

										{sections.length === 0 ? (
											<EmptyState
												title={filter === 'unread' && items.length > 0 ? t('emptyUnreadTitle') : t('emptyTitle')}
												body={filter === 'unread' && items.length > 0 ? t('emptyUnread') : t('empty')}
											/>
										) : (
											<div className="flex flex-col gap-3 sm:gap-1">
												{sections.map((section) => (
													<section key={section.group} aria-labelledby={`notification-group-${section.group}`}>
														<h3
															id={`notification-group-${section.group}`}
															className="px-3 pb-1.5 pt-2 text-[12px] font-medium text-[var(--text-muted)] sm:sticky sm:top-0 sm:z-[1] sm:bg-white"
														>
															{t(DAY_GROUP_KEY[section.group])}
														</h3>
														<ul className="overflow-hidden rounded-card border border-black/[0.06] bg-white shadow-[var(--elev-1)] sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none">
															{section.items.map((item, index) => (
																<NotificationRow
																	key={item.id}
																	item={item}
																	first={index === 0}
																	fa={fa}
																	reading={reading}
																	typeLabel={t(typeMeta(item.type).label)}
																	markReadLabel={t('markRead')}
																	onOpen={() => {
																		if (!item.read) void markRead(item.id)
																		if (item.link) closePanel()
																	}}
																	onMarkRead={() => void markRead(item.id)}
																/>
															))}
														</ul>
													</section>
												))}
											</div>
										)}
									</div>

									{browserPermission === 'granted' && (
										<footer className="hidden shrink-0 items-center justify-center gap-1.5 border-t border-black/[0.06] px-4 py-2.5 text-[12px] font-medium text-[var(--text-muted)] sm:flex">
											<span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
											{t('browserEnabled')}
										</footer>
									)}
								</motion.section>
							</>
						)}
					</AnimatePresence>
				</>,
				document.body,
			)}
		</div>
	)
}

function NotificationRow({
	item,
	first,
	fa,
	reading,
	typeLabel,
	markReadLabel,
	onOpen,
	onMarkRead,
}: {
	item: NotificationItem
	first: boolean
	fa: boolean
	reading: boolean
	typeLabel: string
	markReadLabel: string
	onOpen: () => void
	onMarkRead: () => void
}) {
	const meta = typeMeta(item.type)
	const Icon = meta.icon
	const locale = fa ? 'fa' : 'en'
	// The panel's minute clock re-renders rows, so "۲ دقیقه پیش" stays honest.
	const relative = smartTime(item.createdAt, locale)
	const rowClass = cn(
		'flex w-full min-w-0 items-start gap-3 py-3 pe-12 ps-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] sm:rounded-[14px]',
		// Unread rows stay white: the gold dot and the bold title mark them. A
		// full gold fill turned the whole panel yellow when everything was unread.
		'hover:bg-black/[0.03]',
	)
	const content = (
		<>
			<span className={cn('relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ring-1 ring-inset', meta.tone)}>
				<Icon className="h-[1.05rem] w-[1.05rem]" />
			</span>
			<span className="min-w-0 flex-1">
				<span className={cn('line-clamp-2 block text-[15px] leading-6', item.read ? 'font-medium text-[var(--text-secondary)]' : 'font-bold text-[var(--text-primary)]')}>
					{item.title}
				</span>
				{item.body && (
					<span className="mt-0.5 line-clamp-2 block text-[13px] leading-5 text-[var(--text-muted)]">{item.body}</span>
				)}
				<span className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
					<span className="font-medium">{typeLabel}</span>
					<span aria-hidden="true">·</span>
					<time dateTime={item.createdAt} title={formatDateTime(new Date(item.createdAt), locale)}>{relative}</time>
				</span>
			</span>
		</>
	)

	return (
		<li
			className={cn(
				'group relative',
				// Inset hairline between rows (rows are plain white on every size).
				!first && 'before:absolute before:end-3 before:start-[4rem] before:top-0 before:h-px before:bg-black/[0.06] before:content-[""]',
			)}
		>
			{item.link ? (
				<Link href={item.link} onClick={onOpen} className={rowClass}>
					{content}
				</Link>
			) : (
				<button type="button" onClick={onOpen} className={rowClass}>
					{content}
				</button>
			)}
			{!item.read && (
				<>
					<span aria-hidden="true" className="pointer-events-none absolute end-[1.15rem] top-[1.35rem] h-2 w-2 rounded-full bg-[var(--notif)] ring-1 ring-[var(--notif-strong)] transition-opacity [@media(hover:hover)]:group-focus-within:opacity-0 [@media(hover:hover)]:group-hover:opacity-0" />
					<button
						type="button"
						disabled={reading}
						onClick={onMarkRead}
						aria-label={`${markReadLabel}: ${item.title}`}
						title={markReadLabel}
						className="absolute end-1.5 top-2.5 grid h-10 w-10 place-items-center rounded-full text-[var(--text-muted)] opacity-0 transition-[opacity,background-color] hover:bg-black/[0.06] hover:text-[var(--text-primary)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-0 group-hover:opacity-100 [@media(hover:none)]:pointer-events-none"
					>
						<Check className="h-4 w-4" aria-hidden="true" />
					</button>
				</>
			)}
		</li>
	)
}

function EmptyState({ title, body }: { title: string; body: string }) {
	return (
		<div className="flex flex-col items-center px-6 py-12 text-center">
			<span className="relative grid h-16 w-16 place-items-center">
				<span aria-hidden="true" className="absolute inset-0 rounded-full bg-black/[0.03]" />
				<span aria-hidden="true" className="absolute inset-2 rounded-full bg-black/[0.04]" />
				<span className="relative grid h-10 w-10 place-items-center rounded-full bg-white text-[var(--text-secondary)] shadow-[var(--elev-1)]">
					<CheckCheck className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
				</span>
			</span>
			<p className="mt-4 text-[15px] font-bold text-[var(--text-primary)]">{title}</p>
			<p className="mt-1 max-w-[18rem] text-[13px] leading-6 text-[var(--text-muted)]">{body}</p>
		</div>
	)
}

function ToastContent({ item, label }: { item: NotificationItem; label: string }) {
	const meta = typeMeta(item.type)
	const Icon = meta.icon
	return (
		<>
			<span className={cn('relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-[12px] ring-1 ring-inset', meta.tone)}>
				<Icon className="h-[1.05rem] w-[1.05rem]" />
				<span aria-hidden="true" className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--notif)] ring-2 ring-white" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-[12px] font-semibold text-[var(--notif-strong)]">{label}</span>
				<span className="mt-0.5 line-clamp-2 block text-[15px] font-bold leading-6 text-black">{item.title}</span>
				{item.body && (
					<span className="mt-0.5 line-clamp-2 block text-[13px] leading-5 text-[var(--text-secondary)]">
						{item.body}
					</span>
				)}
			</span>
		</>
	)
}
