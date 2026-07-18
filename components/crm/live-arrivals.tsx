'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

type LiveResource = 'conversations' | 'contacts'

const ARRIVAL_VISIBLE_MS = 2800
const DEFAULT_POLL_MS = 5000

type LiveArrivalsContextValue = {
  recentIds: ReadonlySet<string>
}

const LiveArrivalsContext = createContext<LiveArrivalsContextValue>({
  recentIds: new Set<string>(),
})

/**
 * Polls a tiny workspace-scoped version endpoint. A full RSC refresh only runs
 * after a genuinely new conversation/contact exists, so live pages stay cheap
 * while idle and all server-rendered totals remain authoritative.
 */
export function LiveRefreshProbe({
  resource,
  initialVersion,
  enabled = true,
  intervalMs = DEFAULT_POLL_MS,
}: {
  resource: LiveResource
  initialVersion: string
  enabled?: boolean
  intervalMs?: number
}) {
  const router = useRouter()
  const versionRef = useRef(initialVersion)
  const [, startTransition] = useTransition()

  useEffect(() => {
    versionRef.current = initialVersion
  }, [initialVersion])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined

    const schedule = (delay = intervalMs) => {
      if (cancelled) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(poll, delay)
    }

    const poll = async () => {
      if (cancelled) return
      if (document.hidden) {
        schedule()
        return
      }

      controller?.abort()
      controller = new AbortController()

      try {
        const response = await fetch(`/api/crm/live?resource=${resource}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })
        if (!response.ok || cancelled) return

        const data = (await response.json()) as { version?: unknown }
        if (
          typeof data.version !== 'string' ||
          data.version === versionRef.current
        )
          return

        versionRef.current = data.version
        startTransition(() => router.refresh())
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // A transient network failure should never interrupt the live page.
        }
      } finally {
        schedule()
      }
    }

    const handleVisibility = () => {
      if (!document.hidden) schedule(250)
    }

    document.addEventListener('visibilitychange', handleVisibility)
    schedule()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [enabled, intervalMs, resource, router, startTransition])

  return null
}

/**
 * Remembers IDs already shown in this mounted collection. IDs introduced by a
 * later server refresh are exposed to row/status components for a short,
 * one-time arrival treatment. The first page render is intentionally silent.
 */
export function LiveArrivalProvider({
  ids,
  children,
}: {
  ids: string[]
  children: ReactNode
}) {
  const knownIdsRef = useRef(new Set(ids))
  const mountedRef = useRef(false)
  const expiryTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  )
  const [recentIds, setRecentIds] = useState<Set<string>>(() => new Set())

  // On a refresh, this is calculated before the effect records the new IDs, so
  // newly mounted rows receive their entrance state on the very first frame.
  const incomingIds = mountedRef.current
    ? ids.filter((id) => !knownIdsRef.current.has(id))
    : []
  const incomingKey = incomingIds.join('\u001f')

  const visibleRecentIds = useMemo(() => {
    if (incomingIds.length === 0) return recentIds
    return new Set([...recentIds, ...incomingIds])
    // incomingKey deliberately represents the value-level identity of the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingKey, recentIds])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      knownIdsRef.current = new Set(ids)
      return
    }

    const added = ids.filter((id) => !knownIdsRef.current.has(id))
    ids.forEach((id) => knownIdsRef.current.add(id))
    if (added.length === 0) return

    setRecentIds((current) => new Set([...current, ...added]))
    for (const id of added) {
      const existingTimer = expiryTimersRef.current.get(id)
      if (existingTimer) clearTimeout(existingTimer)
      const timer = setTimeout(() => {
        expiryTimersRef.current.delete(id)
        setRecentIds((current) => {
          if (!current.has(id)) return current
          const next = new Set(current)
          next.delete(id)
          return next
        })
      }, ARRIVAL_VISIBLE_MS)
      expiryTimersRef.current.set(id, timer)
    }
  }, [ids])

  useEffect(
    () => () => {
      expiryTimersRef.current.forEach((timer) => clearTimeout(timer))
      expiryTimersRef.current.clear()
    },
    [],
  )

  const value = useMemo(
    () => ({ recentIds: visibleRecentIds }),
    [visibleRecentIds],
  )

  return (
    <LiveArrivalsContext.Provider value={value}>
      {children}
    </LiveArrivalsContext.Provider>
  )
}

export function LiveArrivalItem({
  itemId,
  className,
  children,
}: {
  itemId: string
  className?: string
  children: ReactNode
}) {
  const { recentIds } = useContext(LiveArrivalsContext)
  const reduceMotion = useReducedMotion()
  const isRecent = recentIds.has(itemId)

  return (
    <motion.div
      layout={reduceMotion ? false : 'position'}
      initial={
        isRecent
          ? reduceMotion
            ? { opacity: 0.55 }
            : { opacity: 0, transform: 'translate3d(0,-10px,0) scale(0.985)' }
          : false
      }
      animate={{ opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }}
      transition={
        reduceMotion
          ? { opacity: { duration: 0.16 } }
          : {
              transform: { type: 'spring', duration: 0.42, bounce: 0 },
              opacity: { duration: 0.2, ease: [0.23, 1, 0.32, 1] },
              layout: { type: 'spring', duration: 0.38, bounce: 0 },
            }
      }
      data-live-arrival={isRecent ? 'true' : undefined}
      className={cn('relative isolate overflow-hidden', className)}
    >
      <AnimatePresence>
        {isRecent && (
          <>
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(100deg,transparent_8%,rgba(124,58,237,0.11)_48%,rgba(16,185,129,0.08)_72%,transparent_96%)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: reduceMotion ? [0, 0.42, 0] : [0, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduceMotion ? 0.55 : 1.45,
                times: [0, 0.24, 1],
              }}
            />
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-2 start-0 z-20 w-[3px] rounded-full bg-gradient-to-b from-violet-500 via-fuchsia-400 to-emerald-400 shadow-[0_0_18px_rgba(124,58,237,0.55)]"
              initial={{
                opacity: 0,
                transform: reduceMotion ? 'scaleY(1)' : 'scaleY(0.35)',
              }}
              animate={{ opacity: [0, 1, 0], transform: 'scaleY(1)' }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduceMotion ? 0.55 : 1.75,
                ease: [0.23, 1, 0.32, 1],
              }}
            />
          </>
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  )
}

export function LiveArrivalStatus({
  resource,
  locale,
}: {
  resource: LiveResource
  locale: 'fa' | 'en'
}) {
  const { recentIds } = useContext(LiveArrivalsContext)
  const reduceMotion = useReducedMotion()
  const count = recentIds.size
  const number = count.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')
  const label =
    count > 0
      ? locale === 'fa'
        ? resource === 'conversations'
          ? `${number} گفتگوی تازه`
          : `${number} مشتری تازه`
        : `${number} new ${resource === 'conversations' ? (count === 1 ? 'conversation' : 'conversations') : count === 1 ? 'customer' : 'customers'}`
      : locale === 'fa'
        ? 'به‌روزرسانی زنده'
        : 'Live updates'

  return (
    <span
      aria-live="polite"
      className={cn(
        'inline-flex min-h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-[color,background-color,border-color] duration-200',
        count > 0
          ? 'border-violet-500/20 bg-violet-500/10 text-violet-700'
          : 'border-emerald-500/15 bg-emerald-500/[0.08] text-emerald-700',
      )}
    >
      {count > 0 ? (
        <Sparkles className="h-3 w-3" aria-hidden="true" />
      ) : (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-emerald-400/35" />
          <span className="absolute inset-[2px] rounded-full bg-emerald-500" />
        </span>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${count > 0 ? 'arrival' : 'live'}-${count}`}
          initial={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, transform: 'translateY(3px)' }
          }
          animate={{ opacity: 1, transform: 'translateY(0)' }}
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { opacity: 0, transform: 'translateY(-3px)' }
          }
          transition={{
            duration: reduceMotion ? 0.12 : 0.18,
            ease: [0.23, 1, 0.32, 1],
          }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
