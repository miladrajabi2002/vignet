'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { Search, X, Loader2, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MaterialSelect } from '@/components/ui/material-select'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'

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
  filtersLabel,
  closeFilters,
  resultsLabel,
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
  filtersLabel: string
  closeFilters: string
  resultsLabel: string
}) {
  const router = useRouter()
  const locale = useLocale()
  const [searchInput, setSearchInput] = useState(defaultQuery)
  const [statusInput, setStatusInput] = useState(defaultStatus)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [isSearching, startSearchTransition] = useTransition()
  const filterTriggerRef = useRef<HTMLButtonElement>(null)

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
  const selectedStatusLabel = statusOptions.find((option) => option.value === statusInput)?.label

  function clearAll() {
    setSearchInput('')
    setStatusInput('')
    setFiltersOpen(false)
    startSearchTransition(() => {
      router.replace('/products/orders', { scroll: false })
    })
  }

  function searchField(id: string, className?: string) {
    return (
      <div className={cn('relative min-w-0 flex-1', className)}>
        <label htmlFor={id} className="sr-only">
          {searchLabel}
        </label>
        {isSearching ? (
          <Loader2 className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)] motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
        )}
        <input
          id={id}
          name="q"
          type="search"
          inputMode="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={searchPlaceholder}
          className="input min-h-11 w-full ps-10 pe-11 text-base sm:text-sm"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            aria-label={clearFilters}
            className="absolute end-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black/60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <form
        action="/products/orders"
        method="get"
        onSubmit={(event) => event.preventDefault()}
        className="sticky top-[5.35rem] z-20 md:static md:z-auto"
      >
        <div className="spatial-surface rounded-[1.35rem] !bg-white p-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.08)] md:rounded-[1.5rem] md:p-4 md:shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 md:hidden">
            {searchField('orders-search-mobile')}
            <button
              ref={filterTriggerRef}
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              aria-label={filtersLabel}
              className={cn(
                'spatial-press relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60',
                statusInput
                  ? 'border-black bg-black text-white'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)]',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {statusInput && (
                <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-amber-400 px-1 text-[10px] font-bold tabular-nums text-black">
                  {new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(1)}
                </span>
              )}
            </button>
          </div>

          {statusInput && selectedStatusLabel && (
            <div className="mt-2 flex flex-wrap gap-2 md:hidden" aria-label={filtersLabel}>
              <button
                type="button"
                onClick={() => setStatusInput('')}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
              >
                <span className="max-w-40 truncate">{selectedStatusLabel}</span>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {searchField('orders-search', 'min-w-[12rem]')}
            <MaterialSelect
              value={statusInput}
              onValueChange={setStatusInput}
              ariaLabel={statusLabel}
              className="min-w-52"
              options={[
                { value: '', label: allStatuses },
                ...statusOptions,
              ]}
            />
            {hasFilters && (
              <button
                type="button"
                onClick={clearAll}
                aria-label={clearFilters}
                title={clearFilters}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </form>

      <MobileBottomSheet
        open={filtersOpen}
        title={filtersLabel}
        description={resultsLabel}
        closeLabel={closeFilters}
        triggerRef={filterTriggerRef}
        onClose={() => setFiltersOpen(false)}
        footer={(
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={clearAll}
              disabled={!hasFilters}
              className="min-h-12 rounded-xl border border-[var(--border-default)] px-4 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 disabled:opacity-40"
            >
              {clearFilters}
            </button>
            <button type="button" onClick={() => setFiltersOpen(false)} className="min-h-12 rounded-xl bg-black px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2">
              {closeFilters}
            </button>
          </div>
        )}
      >
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{statusLabel}</legend>
          <div className="grid gap-2">
            {[{ value: '', label: allStatuses }, ...statusOptions].map((option) => (
              <label key={option.value || 'all'} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border-default)] bg-white px-3 text-sm text-[var(--text-primary)] has-[:checked]:border-black has-[:checked]:bg-black/[0.035]">
                <input type="radio" name="mobile-order-status" value={option.value} checked={statusInput === option.value} onChange={() => setStatusInput(option.value)} className="h-4 w-4 accent-black" />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </MobileBottomSheet>
    </>
  )
}
