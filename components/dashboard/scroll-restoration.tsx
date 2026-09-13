'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Scroll restoration for the dashboard.
 *
 * Going list → detail → (browser back) used to land the user at the top of
 * the list — losing their place after every peek. Next.js App Router disables
 * native browser scroll restoration, and the lists re-render async anyway.
 *
 * This component:
 *   1. saves window.scrollY per URL (pathname + search) while the user
 *      scrolls (throttled, sessionStorage);
 *   2. on popstate (back/forward) records the destination URL's saved
 *      position as pending;
 *   3. when the new route has actually COMMITTED (pathname/search effect),
 *      an rAF loop waits (capped ~1.6s) until the page is tall enough —
 *      server pages render instantly, client-fetching lists need a few
 *      frames — then scrolls and consumes the entry.
 */

const KEY_PREFIX = 'vigent:scroll:'
const SAVE_THROTTLE_MS = 150
const RESTORE_TIMEOUT_MS = 1_600
const MIN_SAVED_OFFSET = 40

function keyFor(pathname: string, search: string): string {
  return KEY_PREFIX + pathname + search
}

export function ScrollRestoration() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const searchRef = useRef(search)
  searchRef.current = search

  // Pending restore for the URL being navigated to via back/forward.
  const pendingRef = useRef<{ key: string; top: number } | null>(null)
  const rafRef = useRef(0)

  // ── 1. Save scroll position per URL (while pages are scrolled) ─────────
  useEffect(() => {
    let saveTimer: number | undefined

    function save() {
      saveTimer = undefined
      const key = keyFor(window.location.pathname, window.location.search)
      const top = window.scrollY
      try {
        if (top > MIN_SAVED_OFFSET) {
          window.sessionStorage.setItem(key, String(Math.round(top)))
        } else {
          window.sessionStorage.removeItem(key)
        }
      } catch {
        // storage unavailable — restoration is best-effort anyway
      }
    }

    function onScroll() {
      if (saveTimer !== undefined) return
      saveTimer = window.setTimeout(save, SAVE_THROTTLE_MS)
    }

    function onPopState() {
      const key = keyFor(window.location.pathname, window.location.search)
      let top = 0
      try {
        top = Number(window.sessionStorage.getItem(key) ?? 0) || 0
      } catch {
        return
      }
      if (top > MIN_SAVED_OFFSET) pendingRef.current = { key, top }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('popstate', onPopState)
      if (saveTimer !== undefined) window.clearTimeout(saveTimer)
    }
  }, [])

  // ── 2. After the route commits: wait for content, then restore ─────────
  useEffect(() => {
    const pending = pendingRef.current
    if (!pending || pending.key !== keyFor(pathname, searchRef.current)) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const startedAt = performance.now()
    const top = pending.top
    const key = pending.key

    function step() {
      const doc = document.documentElement
      const max = Math.max(0, doc.scrollHeight - window.innerHeight)
      const waited = performance.now() - startedAt

      if (top <= max || waited >= RESTORE_TIMEOUT_MS) {
        window.scrollTo({ top: Math.min(top, max), behavior: 'instant' as ScrollBehavior })
        try {
          window.sessionStorage.removeItem(key)
        } catch {
          // ignore
        }
        pendingRef.current = null
        rafRef.current = 0
        return
      }

      // Content is still shorter than the remembered position (a client-side
      // list is fetching) — keep waiting within the cap.
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [pathname, searchParams])

  return null
}
