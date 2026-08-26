'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, X, Loader2 } from 'lucide-react'

/**
 * Live AJAX search form for the orders page.
 *
 * Replaces the original server-rendered GET form with a client component
 * that updates the URL on a 280ms debounce (same pattern as the contacts and
 * conversations pages). Soft navigation via App Router makes this feel
 * instant without a full page reload.
 *
 * The status dropdown also updates live — no submit button needed.
 *
 * All display strings are passed in as props (already translated by the
 * server parent), so this component stays locale-agnostic.
 */
export function OrdersSearchForm({
  defaultQuery,
  defaultStatus,
  statusOptions,
  searchLabel,
  searchPlaceholder,
  statusLabel,
  allStatuses,
  clearFilters,
}: {
  defaultQuery: string
  defaultStatus: string
  /** Ordered list of status value → label pairs (already translated). */
  statusOptions: { value: string; label: string }[]
  searchLabel: string
  searchPlaceholder: string
  statusLabel: string
  allStatuses: string
  clearFilters: string
}) {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState(defaultQuery)
  const [statusInput, setStatusInput] = useState(defaultStatus)
  const [isSearching, startSearchTransition] = useTransition()

  // Keep local state in sync when the URL changes externally (back/forward,
  // "clear filters" link, etc.).
  useEffect(() => {
    setSearchInput(defaultQuery)
  }, [defaultQuery])
  useEffect(() => {
    setStatusInput(defaultStatus)
  }, [defaultStatus])

  // Debounced live update: 280ms after the last change to either input.
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === defaultQuery.trim() && statusInput === defaultStatus) return
    const timer = window.setTimeout(() => {
      const sp = new URLSearchParams()
      if (trimmed) sp.set('q', trimmed)
      if (statusInput) sp.set('status', statusInput)
      sp.delete('page')
      startSearchTransition(() => {
        const url = sp.toString()
        router.replace(url ? `/products/orders?${url}` : '/products/orders', {
          scroll: false,
        })
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchInput, statusInput, defaultQuery, defaultStatus, router])

  const hasFilters = !!searchInput.trim() || !!statusInput

  return (
    <form
      action="/products/orders"
      method="get"
      onSubmit={(e) => e.preventDefault()}
      className="spatial-surface grid gap-3 rounded-[1.5rem] p-4 sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:items-end sm:p-5"
    >
      <div>
        <label
          htmlFor="orders-search"
          className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
        >
          {searchLabel}
        </label>
        <div className="relative">
          {isSearching ? (
            <Loader2 className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)] motion-reduce:animate-none" />
          ) : (
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          )}
          <input
            id="orders-search"
            name="q"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={searchPlaceholder}
            className="input min-h-11 w-full ps-10"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="orders-status"
          className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
        >
          {statusLabel}
        </label>
        <select
          id="orders-status"
          name="status"
          value={statusInput}
          onChange={(e) => setStatusInput(e.target.value)}
          className="input min-h-11 w-full"
        >
          <option value="">{allStatuses}</option>
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        {hasFilters && (
          <Link
            href="/products/orders"
            aria-label={clearFilters}
            title={clearFilters}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </Link>
        )}
      </div>
    </form>
  )
}
