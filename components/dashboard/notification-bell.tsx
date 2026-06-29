'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setItems(data.items ?? [])
      setUnread(data.unread ?? 0)
    } catch {
      // silent — the bell must never break the header
    }
  }, [])

  // Poll for new notifications.
  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function markAllRead() {
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {})
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t('title')}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-80 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-2.5">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {t('title')}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {t('markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                {t('empty')}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border-subtle)]">
                {items.map((n) => {
                  const inner = (
                    <div
                      className={cn(
                        'px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]',
                        !n.read && 'bg-[var(--bg-hover)]/50',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {!n.read && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                        )}
                        <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {n.title}
                        </span>
                      </div>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                          {n.body}
                        </p>
                      )}
                    </div>
                  )
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link href={n.link} onClick={() => setOpen(false)}>
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
