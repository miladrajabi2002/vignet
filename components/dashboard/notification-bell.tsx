'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { Bell, CalendarCheck2, CheckCheck, MessageCircleWarning, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'

interface NotificationItem {
	id: string
	type: string
	title: string
	body: string | null
	link: string | null
	read: boolean
	createdAt: string
}

const POLL_MS = 30_000

export function NotificationBell() {
	const t = useTranslations('notifications')
	const fa = useLocale() !== 'en'
	const [open, setOpen] = useState(false)
	const [items, setItems] = useState<NotificationItem[]>([])
	const [unread, setUnread] = useState(0)
	const [mounted, setMounted] = useState(false)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const panelRef = useRef<HTMLElement>(null)

	useEffect(() => setMounted(true), [])

	const load = useCallback(async () => {
		try {
			const res = await fetch('/api/notifications', { cache: 'no-store' })
			if (!res.ok) return
			const data = await res.json()
			setItems(data.items ?? [])
			setUnread(data.unread ?? 0)
		} catch {}
	}, [])

	useEffect(() => {
		const refreshWhenVisible = () => {
			if (document.visibilityState === 'visible') void load()
		}
		let cancelInitial: () => void
		if ('requestIdleCallback' in window) {
			const idleId = window.requestIdleCallback(refreshWhenVisible, { timeout: 2_000 })
			cancelInitial = () => window.cancelIdleCallback(idleId)
		} else {
			const timeoutId = setTimeout(refreshWhenVisible, 500)
			cancelInitial = () => clearTimeout(timeoutId)
		}

		const id = window.setInterval(refreshWhenVisible, POLL_MS)
		document.addEventListener('visibilitychange', refreshWhenVisible)
		return () => {
			cancelInitial()
			window.clearInterval(id)
			document.removeEventListener('visibilitychange', refreshWhenVisible)
		}
	}, [load])

	useEffect(() => {
		if (!open) return
		function close(event: MouseEvent) {
			const target = event.target as Node
			if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false)
		}
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') setOpen(false)
		}
		document.addEventListener('mousedown', close)
		document.addEventListener('keydown', onKeyDown)
		return () => {
			document.removeEventListener('mousedown', close)
			document.removeEventListener('keydown', onKeyDown)
		}
	}, [open])

	async function markRead(id?: string) {
		setItems((current) => current.map((item) => !id || item.id === id ? { ...item, read: true } : item))
		setUnread((current) => id ? Math.max(0, current - (items.find((item) => item.id === id && !item.read) ? 1 : 0)) : 0)
		await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(id ? { id } : {}) }).catch(() => {})
	}

	return (
		<div className="relative">
			<button ref={triggerRef} type="button" onClick={() => setOpen((current) => !current)} aria-label={t('title')} aria-expanded={open} aria-haspopup="dialog" className={cn('spatial-press relative inline-flex h-12 w-12 items-center justify-center rounded-[1.15rem] border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[0_5px_18px_rgba(0,0,0,0.035)] transition-colors hover:border-black/[0.12] hover:bg-white hover:text-black xl:h-14 xl:w-14 xl:rounded-[1.35rem]', open && 'border-black bg-black text-white hover:border-black hover:bg-black hover:text-white')}>
				<Bell className="h-4 w-4" />
				{unread > 0 && <span aria-live="polite" className="absolute -end-1.5 -top-1.5 flex h-[1.15rem] min-w-[1.15rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-black tabular-nums text-black shadow-sm ring-2 ring-white">{unread > 99 ? '99+' : unread.toLocaleString(fa ? 'fa-IR' : 'en-US')}</span>}
			</button>

			{mounted && open && createPortal(<>
				<button type="button" aria-label={fa ? 'بستن اعلان‌ها' : 'Close notifications'} onClick={() => setOpen(false)} className="fixed inset-0 z-[98] bg-black/25 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none" />
				<section ref={panelRef} role="dialog" aria-modal="true" aria-label={t('title')} className="material-select-menu fixed inset-x-3 bottom-3 z-[99] max-h-[calc(100dvh-5rem)] overflow-hidden rounded-[1.65rem] border border-black/10 bg-white/97 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl [animation:spatial-pop_220ms_cubic-bezier(.2,.8,.2,1)] motion-reduce:animate-none sm:inset-x-auto sm:bottom-auto sm:end-5 sm:top-[5.75rem] sm:w-96 xl:top-[6.75rem]">
					<header className="flex items-center justify-between border-b border-black/[0.07] px-4 py-3.5">
						<div><h2 className="text-sm font-bold text-black">{t('title')}</h2><p className="mt-0.5 text-[11px] text-black/40">{unread ? (fa ? `${unread.toLocaleString('fa-IR')} اعلان خوانده‌نشده` : `${unread} unread notifications`) : (fa ? 'همه اعلان‌ها دیده شده‌اند' : 'You are all caught up')}</p></div>
						{unread > 0 && <button type="button" onClick={() => markRead()} className="spatial-press inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-black px-3 text-[11px] font-semibold text-white"><CheckCheck className="h-3.5 w-3.5" />{t('markAllRead')}</button>}
					</header>

					<div className="max-h-[min(31rem,calc(100dvh-11rem))] overflow-y-auto overscroll-contain p-1.5">
						{items.length === 0 ? (
							<div className="flex flex-col items-center px-4 py-10 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/[0.045] text-black/35"><Bell className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium text-black/55">{t('empty')}</p></div>
						) : (
							<ul className="space-y-1">
								{items.map((item) => {
									const Icon = /appointment|booking/i.test(item.type) ? CalendarCheck2 : /handoff|operator/i.test(item.type) ? MessageCircleWarning : Sparkles
									const content = <div className={cn('flex min-h-16 gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.045]', !item.read && 'bg-amber-400/[0.08]')}><span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', !item.read ? 'bg-black text-white' : 'bg-black/[0.045] text-black/40')}><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-xs font-bold text-black/75">{item.title}</p>{!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />}</div>{item.body && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-black/45">{item.body}</p>}<time className="mt-1 block text-[11px] text-black/30">{formatDateTime(new Date(item.createdAt), fa ? 'fa' : 'en')}</time></div></div>
									return <li key={item.id}>{item.link ? <Link href={item.link} onClick={() => { void markRead(item.id); setOpen(false) }}>{content}</Link> : <button type="button" onClick={() => void markRead(item.id)} className="w-full text-start">{content}</button>}</li>
								})}
							</ul>
						)}
					</div>
				</section>
			</>, document.body)}
		</div>
	)
}
