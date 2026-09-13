'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Settings-wide search: typing filters a static index of settings sections
 * (labels + keywords, fa+en) and jumping to a result activates its tab and
 * scrolls to the section with a brief highlight flash. The index lives with
 * the page (locale-aware); new sections only need an id + an index entry.
 */

export type SettingsSearchTab = 'business' | 'operator' | 'reports'

export interface SettingsSearchItem {
  /** Anchor element id inside the tab's content. */
  id: string
  tab: SettingsSearchTab
  /** Tab label for the result row (e.g. «اپراتور»). */
  tabLabel: string
  /** Section title shown in the result row. */
  label: string
  /** Match keywords (fa + en). */
  keywords: string[]
}

export function SettingsSearch({
  items,
  locale,
  onJump,
}: {
  items: SettingsSearchItem[]
  locale: 'fa' | 'en'
  /** Called when a result is picked — the parent switches the tab, then the
   *  section is scrolled to and flashed. */
  onJump: (item: SettingsSearchItem) => void
}) {
  const fa = locale !== 'en'
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items
      .filter((item) => {
        const haystack = [item.label, item.tabLabel, ...item.keywords]
          .join(' ')
          .toLowerCase()
        return haystack.includes(q)
      })
      .slice(0, 8)
  }, [items, query])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [results.length])

  useEffect(() => {
    const node = listRef.current?.children[activeIndex] as HTMLElement | undefined
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  function jump(item: SettingsSearchItem) {
    setOpen(false)
    setQuery('')
    onJump(item)
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              if (results.length > 0) {
                setOpen(true)
                setActiveIndex((i) => Math.min(i + 1, results.length - 1))
              }
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((i) => Math.max(i - 1, 0))
            } else if (event.key === 'Enter') {
              if (open && results[activeIndex]) {
                event.preventDefault()
                jump(results[activeIndex])
              }
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder={fa ? 'جست‌وجو در تنظیمات…' : 'Search settings…'}
          aria-label={fa ? 'جست‌وجو در تنظیمات' : 'Search settings'}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="settings-search-results"
          aria-autocomplete="list"
          className="h-12 w-full rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] ps-10 pe-10 text-sm text-[var(--text-primary)] shadow-[var(--shadow-xs)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label={fa ? 'پاک کردن' : 'Clear'}
            className="absolute end-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[0_22px_70px_rgba(0,0,0,0.16)]">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[var(--text-muted)]">
              {fa ? 'موردی پیدا نشد' : 'No matching settings'}
            </p>
          ) : (
            <ul id="settings-search-results" ref={listRef} role="listbox" aria-label={fa ? 'نتایج جست‌وجو' : 'Search results'} className="max-h-80 overflow-y-auto p-1.5">
              {results.map((item, index) => (
                <li key={item.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    onClick={() => jump(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition-colors',
                      index === activeIndex ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] text-[var(--text-muted)]">{item.tabLabel}</span>
                    </span>
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] ltr:rotate-0 rtl:rotate-90" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
