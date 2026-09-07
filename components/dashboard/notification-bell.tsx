'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
	Bell,
	CalendarCheck2,
	CheckCheck,
	MessageCircleWarning,
	Sparkles,
	X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'
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
const TOAST_MS = 8_000

interface NotificationToast extends NotificationItem {
	ids: string[]
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

export function NotificationBell() {
	const t = useTranslations('notifications')
	const fa = useLocale() !== 'en'
	const reduceMotion = useReducedMotion()
	const [open, setOpen] = useState(false)
	const [items, setItems] = useState<NotificationItem[]>([])
	const [unread, setUnread] = useState(0)
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
	const [reading, setReading] = useState(false)
	const [readError, setReadError] = useState(false)
	const [toastPaused, setToastPaused] = useState(false)

	useEffect(() => {
		setMounted(true)
		mountedRef.current = true
		if ('Notification' in window) {
			setBrowserPermission(window.Notification.permission)
		}
		return () => { mountedRef.current = false }
	}, [])

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
				setToastPaused(false)
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

	useEffect(() => {
		if (!toast || toastPaused || reading) return
		const id = window.setTimeout(() => setToast(null), TOAST_MS)
		return () => window.clearTimeout(id)
	}, [toast, toastPaused, reading])

	useEffect(() => {
		openRef.current = open
		if (!open) return
		setToast(null)
		function close(event: MouseEvent) {
			const target = event.target as Node
			if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
				setOpen(false)
			}
		}
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setOpen(false)
				triggerRef.current?.focus()
			}
		}
		document.addEventListener('mousedown', close)
		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.removeEventListener('mousedown', close)
			document.removeEventListener('keydown', onKeyDown)
		}
	}, [open])

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

	return (
		<div className="relative">
			<button
				ref={triggerRef}
				type="button"
				onClick={() => {
					openRef.current = !open
					setOpen(!open)
					setToast(null)
				}}
				aria-label={t('title')}
				aria-expanded={open}
				aria-haspopup="dialog"
				className={cn(
					'spatial-press relative inline-flex h-12 w-12 items-center justify-center rounded-[1.15rem] border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[0_5px_18px_rgba(0,0,0,0.035)] transition-colors hover:border-black/[0.12] hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 xl:h-14 xl:w-14 xl:rounded-[1.35rem]',
					open && 'border-black bg-black text-white hover:border-black hover:bg-black hover:text-white',
				)}
			>
				<Bell aria-hidden="true" className="h-4 w-4" />
				<AnimatePresence>
					{unread > 0 && (
						<motion.span
							key="unread"
							initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.65 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.8 }}
							transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
							aria-live="polite"
							aria-atomic="true"
							className="absolute -end-1.5 -top-1.5 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-black tabular-nums text-black shadow-sm ring-2 ring-white"
						>
							{unread > 99 ? '99+' : unread.toLocaleString(fa ? 'fa-IR' : 'en-US')}
						</motion.span>
					)}
				</AnimatePresence>
			</button>

			{mounted && createPortal(
				<>
					<AnimatePresence>
						{toast && (
							<motion.aside
								dir={fa ? 'rtl' : 'ltr'}
								onMouseEnter={() => setToastPaused(true)}
								onMouseLeave={() => setToastPaused(false)}
								onFocusCapture={() => setToastPaused(true)}
								onBlurCapture={(event) => {
									if (!event.currentTarget.contains(event.relatedTarget)) setToastPaused(false)
								}}
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
								className="fixed end-3 top-3 z-[101] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.4rem] border border-black/10 bg-white/95 p-2 shadow-[0_22px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:end-6 sm:bottom-6 sm:top-auto sm:w-[26rem] sm:rounded-2xl sm:bg-white sm:p-3"
							>
								<div className="flex items-start gap-2">
									{toast.link ? (
										<Link
											href={toast.link}
											onClick={() => {
												void markRead(toast.ids)
												setToast(null)
											}}
											className="flex min-h-16 min-w-0 flex-1 items-start gap-3 rounded-xl p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
										>
											<ToastContent item={toast} label={t('newNotification')} />
										</Link>
									) : (
										<button
											type="button"
											onClick={() => {
												openRef.current = true
												setOpen(true)
												setToast(null)
											}}
											className="flex min-h-16 min-w-0 flex-1 items-start gap-3 rounded-xl p-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
										>
											<ToastContent item={toast} label={t('newNotification')} />
										</button>
									)}
									<button
										type="button"
										onClick={() => setToast(null)}
										aria-label={t('close')}
										className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-black/45 hover:bg-black/[0.05] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
									>
										<X className="h-4 w-4" />
									</button>
								</div>
								<div className="mt-2 flex flex-wrap items-center gap-2 border-t border-black/[0.07] pt-3">
									<button
										type="button"
										disabled={reading}
										onClick={() => void markRead(toast.ids)}
										className="spatial-press inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:opacity-50"
									>
										<CheckCheck className="h-4 w-4" />
										{t(toast.ids.length > 1 ? 'markBatchRead' : 'markRead')}
									</button>
									<button
										type="button"
										onClick={() => { openRef.current = true; setOpen(true); setToast(null) }}
										className="inline-flex min-h-11 items-center justify-center rounded-xl border border-black/15 px-4 text-xs font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
									>
										{t('viewAll')}
									</button>
								</div>
								{readError && <p role="alert" className="px-2 pt-2 text-xs text-red-700">{t('readError')}</p>}
							</motion.aside>
						)}
					</AnimatePresence>

					<AnimatePresence>
						{open && (
							<>
								<motion.button
									type="button"
									aria-label={t('close')}
									onClick={() => setOpen(false)}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: reduceMotion ? 0.1 : 0.18 }}
									className="fixed inset-0 z-[98] bg-black/55 sm:bg-black/15"
								/>
								<motion.section
									ref={panelRef}
									dir={fa ? 'rtl' : 'ltr'}
									role="dialog"
									aria-modal="true"
									aria-label={t('title')}
									initial={reduceMotion
										? { opacity: 0 }
										: { opacity: 0, transform: 'translate3d(0,10px,0) scale(0.98)' }}
									animate={{ opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }}
									exit={reduceMotion
										? { opacity: 0 }
										: { opacity: 0, transform: 'translate3d(0,6px,0) scale(0.985)' }}
									transition={reduceMotion
										? { duration: 0.15 }
										: { type: 'spring', bounce: 0, duration: 0.32 }}
									className="material-select-menu fixed inset-x-3 z-[99] max-h-[calc(100dvh-5rem)] overflow-hidden rounded-[1.65rem] border border-black/15 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.34)] [bottom:max(env(safe-area-inset-bottom),0.75rem)] sm:inset-x-auto sm:bottom-auto sm:end-5 sm:top-[5.75rem] sm:w-[28rem] sm:max-w-[calc(100vw-2.5rem)] xl:top-[6.75rem]"
								>
									<header className="border-b border-black/[0.07] px-4 py-3.5">
										<div className="flex items-center justify-between gap-3">
											<div>
												<h2 className="text-sm font-bold text-black">{t('title')}</h2>
												<p className="mt-0.5 text-[11px] text-black/45">
													{unread ? t('unreadCount', { count: unread }) : t('caughtUp')}
												</p>
											</div>
											{unread > 0 && (
												<button
													type="button"
													disabled={reading}
													onClick={() => void markRead()}
													className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
												>
													<CheckCheck className="h-3.5 w-3.5" />
													{t('markAllRead')}
													<span className="rounded-md bg-white/20 px-1.5 py-0.5 tabular-nums">{unread.toLocaleString(fa ? 'fa-IR' : 'en-US')}</span>
												</button>
											)}
										</div>
										{browserPermission === 'default' && (
											<button
												type="button"
												onClick={enableBrowserNotifications}
												className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-black/[0.045] px-3 text-[11px] font-semibold text-black/65 hover:bg-black/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
											>
												<Bell className="h-3.5 w-3.5" />
												{t('enableBrowser')}
											</button>
										)}
										{browserPermission === 'granted' && (
											<p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
												<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
												{t('browserEnabled')}
											</p>
										)}
										{readError && <p role="alert" className="mt-2 text-xs text-red-700">{t('readError')}</p>}
									</header>

									<div className="max-h-[min(31rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain p-1.5">
										{items.length === 0 ? (
											<div className="flex flex-col items-center px-4 py-10 text-center">
												<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/[0.045] text-black/35">
													<Bell className="h-5 w-5" />
												</span>
												<p className="mt-3 text-sm font-medium text-black/55">{t('empty')}</p>
											</div>
										) : (
											<ul className="space-y-1">
												{items.map((item) => {
													const Icon = /appointment|booking/i.test(item.type)
														? CalendarCheck2
														: /handoff|operator/i.test(item.type)
															? MessageCircleWarning
															: Sparkles
													const content = (
														<div className={cn(
															'flex min-h-16 gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.05]',
															!item.read && 'bg-amber-50',
														)}>
															<span className={cn(
																'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
																!item.read ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-600',
															)}>
																<Icon className="h-3.5 w-3.5" />
															</span>
															<div className="min-w-0 flex-1">
																<div className="flex items-center gap-2">
																	<p className="text-xs font-bold leading-6 text-black/85 sm:text-sm">{item.title}</p>
																	{!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}
																</div>
																{item.body && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-black/60">{item.body}</p>}
																<time className="mt-1 block text-[11px] text-black/45">
																	{formatDateTime(new Date(item.createdAt), fa ? 'fa' : 'en')}
																</time>
															</div>
														</div>
													)
													return (
														<li key={item.id} className={cn("overflow-hidden rounded-xl", !item.read && "bg-amber-50")}>
															{item.link ? (
																<Link
																	href={item.link}
																	onClick={() => {
																		void markRead(item.id)
																		setOpen(false)
																	}}
																	className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1"
																>
																	{content}
																</Link>
															) : (
																<button
																	type="button"
																	onClick={() => void markRead(item.id)}
																	className="w-full rounded-xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-1"
																>
																	{content}
																</button>
															)}
															{!item.read && (
																<div className="px-3 pb-2.5 ps-14">
																	<button
																		type="button"
																		disabled={reading}
																		onClick={() => void markRead(item.id)}
																		className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-black/15 bg-white px-3 text-xs font-semibold text-black hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50"
																	>
																		<CheckCheck className="h-4 w-4" />
																		{t('markRead')}
																	</button>
																</div>
															)}
														</li>
													)
												})}
											</ul>
										)}
									</div>
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

function ToastContent({ item, label }: { item: NotificationItem; label: string }) {
	return (
		<>
			<span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black text-white">
				<Bell className="h-4 w-4" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700">
					{label}
				</span>
				<span className="mt-0.5 block text-sm font-bold leading-6 text-black">{item.title}</span>
				{item.body && (
					<span className="mt-1 line-clamp-2 block text-xs leading-5 text-black/60">
						{item.body}
					</span>
				)}
			</span>
		</>
	)
}
