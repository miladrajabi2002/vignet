'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LayoutGrid, Package, Pencil, Rows3, Store, Trash2, Search as SearchIcon, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MaterialSelect } from '@/components/ui/material-select'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { queueUndo } from '@/lib/undo-queue'

export interface ProductCard {
  id: string
  name: string
  price: number | null
  comparePrice: number | null
  stock: number | null
  images: string[]
  active: boolean
  queryCount: number
  category: { name: string } | null
}

export function ProductGrid({ products }: { products: ProductCard[] }) {
  const t = useTranslations('products')
  const locale = useLocale()
  const router = useRouter()

  const fmt = (n: number) =>
    n.toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')

  // ── Delete dialog state (mirrors the conversation delete pattern) ──
  const [deleteTarget, setDeleteTarget] = useState<ProductCard | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null)
  const deleteDialogRef = useRef<HTMLDivElement | null>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement | null>(null)
  const deletingRef = useRef(false)
  const reduceMotion = useReducedMotion()

  // Undo: after a successful single delete we queue the global
  // «بازگردانی» snackbar (dashboard layout) — it survives navigation.
  deletingRef.current = deleting

  useEffect(() => {
    if (!deleteTarget) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    cancelDeleteRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deletingRef.current) {
        setDeleteTarget(null)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        deleteDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || !deleteDialogRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !deleteDialogRef.current?.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      deleteTriggerRef.current?.focus()
    }
  }, [deleteTarget])

  async function confirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError(null)
    const target = deleteTarget
    try {
      const res = await fetch(`/api/products/${target.id}`, { method: 'DELETE' })
      if (res.ok) {
        setDeleteTarget(null)
        router.refresh()
        queueUndo('product', [target.id], locale !== 'en' ? 'محصول' : 'product')
        return
      }
      setDeleteError(t('deleteFailed'))
    } catch {
      setDeleteError(t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  function openDelete(p: ProductCard, btn: HTMLButtonElement) {
    deleteTriggerRef.current = btn
    setDeleteError(null)
    setDeleteTarget(p)
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {products.map((p) => {
          const stockLabel =
            p.stock === null
              ? t('unlimited')
              : p.stock > 0
                ? t('inStock')
                : t('outOfStock')
          // The badge sits on a photo, so it carries its own solid ground and
          // says the state with a dot instead of tinted text.
          const stockDot =
            p.stock === null
              ? 'bg-[var(--text-hint)]'
              : p.stock > 0
                ? 'bg-success'
                : 'bg-danger'
          return (
            // The title link is stretched over the card; edit and delete sit
            // above it, so no link is nested inside another link.
            <article
              key={p.id}
              className="spatial-surface group relative flex flex-row overflow-hidden rounded-card transition-[border-color,transform] sm:flex-col hover:-translate-y-0.5 hover:border-[var(--border-strong)] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              {/* Phones get a compact row (small photo beside the text) so several products fit one screen. */}
              <div className="relative m-3 me-0 size-20 shrink-0 overflow-hidden rounded-2xl bg-[var(--bg-muted)] sm:m-0 sm:aspect-video sm:size-auto sm:rounded-none">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} width={320} height={320} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
                    <Package className="h-8 w-8" />
                  </div>
                )}
                <span className="absolute end-2 top-2 hidden items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] shadow-[0_1px_3px_rgba(17,17,17,0.22)] sm:inline-flex">
                  <span aria-hidden className={cn('size-1.5 rounded-full', stockDot)} />
                  {stockLabel}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
                {/* Title — no underline on hover; the whole card is the link. */}
                <h3 className="line-clamp-2 font-medium leading-7 text-[var(--text-primary)]" title={p.name}>
                  <Link href={`/products/${p.id}`} className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-[var(--focus-ring)]">
                    {p.name}
                  </Link>
                </h3>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-muted)]">
                  {p.category && <span>{p.category.name}</span>}
                  <span className="inline-flex items-center gap-1.5 sm:hidden">
                    <span aria-hidden className={cn('size-1.5 rounded-full', stockDot)} />
                    {stockLabel}
                  </span>
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  {p.price != null && (
                    <span className="text-[var(--text-primary)]">
                      {fmt(p.price)} <span className="text-xs text-[var(--text-muted)]">{t('toman')}</span>
                    </span>
                  )}
                  {p.comparePrice != null && (
                    <span className="text-xs text-[var(--text-muted)] line-through">{fmt(p.comparePrice)}</span>
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between pt-2 sm:pt-4">
                  <span className="text-xs text-[var(--text-muted)]">
                    {p.queryCount > 0 ? t('queries', { count: fmt(p.queryCount) }) : t('noQueries')}
                  </span>
                  <div className="relative z-10 flex items-center gap-2">
                    {/* Edit and delete sit above the stretched title link. */}
                    <Link
                      href={`/products/${p.id}/edit`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] sm:min-h-9"
                      aria-label={t('edit')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t('edit')}
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openDelete(p, e.currentTarget)
                      }}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-danger hover:text-danger sm:min-h-9 sm:min-w-0"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* Delete confirmation dialog — same pattern as conversation delete */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {deleteTarget && (
            <motion.div
              className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-md"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !deleting) setDeleteTarget(null)
              }}
            >
              <motion.div
                ref={deleteDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-product-title"
                aria-describedby="delete-product-description"
                className="w-full max-w-[27rem] overflow-hidden rounded-card border border-black/10 bg-white shadow-[var(--elev-2)]"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 6 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="p-6 pb-5 text-center sm:text-start">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100 sm:mx-0">
                    <Trash2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 id="delete-product-title" className="mt-4 text-lg font-bold tracking-tight text-[var(--text-primary)]">
                    {t('deleteTitle')}
                  </h2>
                  <p id="delete-product-description" className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    {t('deleteDescription', { name: deleteTarget.name })}
                  </p>

                  {deleteError && (
                    <p role="alert" className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-start text-sm text-red-700">
                      {deleteError}
                    </p>
                  )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/60 p-4 sm:flex-row sm:justify-end">
                  <button
                    ref={cancelDeleteRef}
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={deleting}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
                  >
                    {t('deleteCancel')}
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="inline-flex min-h-11 min-w-32 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {deleting ? t('deleting') : t('deleteConfirm')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

    </>
  )
}

export function ProductsToolbar({
  categories,
  defaultQuery,
  defaultSort,
  defaultCategory,
  defaultStock,
  totalResults,
  view = 'table',
  storeLabel,
  storeTone = 'neutral',
  storeCard,
}: {
  categories: { id: string; name: string }[]
  defaultQuery: string
  defaultSort: string
  defaultCategory: string
  defaultStock: string
  totalResults: number
  /** The table runs the catalog; cards are for looking at it. */
  view?: 'table' | 'cards'
  /** Store connection as one chip; the full card opens under the toolbar. */
  storeLabel?: string
  storeTone?: 'ok' | 'warn' | 'neutral'
  storeCard?: React.ReactNode
}) {
  const t = useTranslations('products')
  const router = useRouter()
  const locale = useLocale()
  const fa = locale !== 'en'
  // Local state for the search input — we debounce URL updates so we don't
  // trigger a server round-trip on every keystroke. The dropdowns (category,
  // stock, sort) update immediately because each change is a discrete action.
  const [searchInput, setSearchInput] = useState(defaultQuery)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [storeOpen, setStoreOpen] = useState(false)
  const [isSearching, startSearchTransition] = useTransition()
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const activeFacetCount = [
    defaultCategory,
    defaultStock,
    defaultSort !== 'newest' ? defaultSort : '',
  ].filter(Boolean).length
  const hasFilters = Boolean(searchInput.trim() || activeFacetCount)
  const number = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')

  // Keep local input in sync when the URL changes (e.g. user clicks "clear").
  useEffect(() => {
    setSearchInput(defaultQuery)
  }, [defaultQuery])

  // Debounced live search: wait 280ms after the last keystroke, then update
  // the URL. Soft navigation (Next.js App Router) makes this feel instant.
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === defaultQuery.trim()) return
    const timer = window.setTimeout(() => {
      const sp = new URLSearchParams()
      const merged = {
        q: trimmed,
        sort: defaultSort,
        categoryId: defaultCategory,
        stock: defaultStock,
        view: view === 'cards' ? 'cards' : '',
      }
      for (const [k, v] of Object.entries(merged)) {
        if (v && !(k === 'sort' && v === 'newest')) sp.set(k, v)
      }
      sp.delete('page') // back to page 1 on every search change
      startSearchTransition(() => {
        const query = sp.toString()
        router.replace(query ? `/products?${query}` : '/products', { scroll: false })
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchInput, defaultQuery, defaultSort, defaultCategory, defaultStock, view, router])

  function update(params: Record<string, string>) {
    const sp = new URLSearchParams()
    // When the user changes the search query, category, stock, or sort, reset to
    // page 1 — otherwise they'd land on an empty page if the new filter has
    // fewer results than the current page index.
    const isFilterChange =
      params.view !== undefined ||
      params.q !== undefined ||
      params.categoryId !== undefined ||
      params.sort !== undefined ||
      params.stock !== undefined
    const merged = {
      q: defaultQuery,
      sort: defaultSort,
      categoryId: defaultCategory,
      stock: defaultStock,
      view: view === 'cards' ? 'cards' : '',
      ...params,
    }
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === 'sort' && v === 'newest')) sp.set(k, v)
    }
    // Explicitly drop `page` on filter changes so we go back to page 1.
    if (isFilterChange) sp.delete('page')
    const query = sp.toString()
    router.push(query ? `/products?${query}` : '/products', { scroll: false })
  }

  function clearFilters() {
    setSearchInput('')
    router.push(view === 'cards' ? '/products?view=cards' : '/products', { scroll: false })
  }

  const storeChip = storeLabel ? (
    <button
      type="button"
      onClick={() => setStoreOpen((open) => !open)}
      aria-expanded={storeOpen}
      className={cn(
        'spatial-press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border px-3 text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
        storeOpen ? 'border-[var(--text-primary)] bg-white text-[var(--text-primary)]' : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-hover)]',
      )}
    >
      <Store className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">{storeLabel}</span>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', storeTone === 'ok' ? 'bg-success' : storeTone === 'warn' ? 'bg-amber-500' : 'bg-[var(--text-hint)]')} aria-hidden="true" />
      <span className="sr-only sm:hidden">{storeLabel}</span>
    </button>
  ) : null

  const viewToggle = (
    <div role="group" aria-label={fa ? 'نوع نمایش' : 'View'} className="flex shrink-0 rounded-control border border-[var(--border-default)] bg-white p-0.5">
      {([
        { key: 'table', icon: Rows3, label: fa ? 'جدول' : 'Table' },
        { key: 'cards', icon: LayoutGrid, label: fa ? 'کارت' : 'Cards' },
      ] as const).map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => update({ view: key === 'cards' ? 'cards' : '' })}
          aria-pressed={view === key}
          aria-label={label}
          title={label}
          className={cn(
            'grid h-10 w-10 place-items-center rounded-[calc(var(--radius-control)-2px)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
            view === key ? 'bg-black/[0.07] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  )

  function searchField(className?: string) {
    return (
      <div className={cn('relative min-w-0 flex-1', className)}>
        {isSearching ? (
          <Loader2 className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)] motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
        )}
        <input
          type="search"
          inputMode="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          className="input min-h-11 w-full ps-9 pe-11 text-base sm:text-sm"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput('')}
            className="absolute end-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
            aria-label={t('clearFilters')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="sticky top-[5.35rem] z-20 md:static md:z-auto">
        <div className="spatial-surface rounded-card p-2.5 shadow-[var(--elev-1)] md:rounded-card md:p-4 md:shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 md:hidden">
            {searchField()}
            <button
              ref={filterTriggerRef}
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={filterSheetOpen}
              aria-label={t('filters')}
              className={cn(
                'spatial-press relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                activeFacetCount > 0
                  ? 'border-black bg-black text-white'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)]',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {activeFacetCount > 0 && (
                <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-amber-400 px-1 text-[12px] font-bold tabular-nums text-black">
                  {number.format(activeFacetCount)}
                </span>
              )}
            </button>
            {storeChip}
          </div>

          {activeFacetCount > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 md:hidden" aria-label={t('filters')}>
              {defaultCategory && (
                <ProductFilterChip
                  label={categories.find((category) => category.id === defaultCategory)?.name ?? t('allCategories')}
                  onRemove={() => update({ categoryId: '' })}
                />
              )}
              {defaultStock && (
                <ProductFilterChip
                  label={defaultStock === 'in_stock' ? t('inStock') : defaultStock === 'low_stock' ? t('lowStock') : defaultStock === 'hidden' ? (fa ? 'پنهان' : 'Hidden') : t('outOfStock')}
                  onRemove={() => update({ stock: '' })}
                />
              )}
              {defaultSort !== 'newest' && (
                <ProductFilterChip
                  label={defaultSort === 'price_asc' ? t('sortPriceAsc') : defaultSort === 'price_desc' ? t('sortPriceDesc') : t('sortQueried')}
                  onRemove={() => update({ sort: 'newest' })}
                />
              )}
            </div>
          )}

          <div className="hidden flex-wrap items-center gap-2 md:flex">
            {searchField('min-w-[12rem]')}
            <MaterialSelect
              value={defaultCategory}
              onValueChange={(value) => update({ categoryId: value })}
              ariaLabel={t('allCategories')}
              className="min-w-40"
              options={[
                { value: '', label: t('allCategories') },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
            />
            <MaterialSelect
              value={defaultSort}
              onValueChange={(value) => update({ sort: value })}
              ariaLabel={t('sort')}
              className="min-w-40"
              options={[
                { value: 'newest', label: t('sortNewest') },
                { value: 'price_asc', label: t('sortPriceAsc') },
                { value: 'price_desc', label: t('sortPriceDesc') },
                { value: 'queried', label: t('sortQueried') },
              ]}
            />
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                aria-label={t('clearFilters')}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <span className="ms-auto flex items-center gap-2">
              {storeChip}
              {viewToggle}
            </span>
          </div>
        </div>
      </div>

      {storeOpen && <div key="store-card">{storeCard}</div>}

      <MobileBottomSheet
        open={filterSheetOpen}
        title={t('filters')}
        description={t('filtersDescription')}
        closeLabel={t('dismissUndo')}
        triggerRef={filterTriggerRef}
        onClose={() => setFilterSheetOpen(false)}
        footer={
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasFilters}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border-default)] px-4 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-40"
            >
              {t('clearFilters')}
            </button>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-black px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
            >
              {t('showResults')} ({number.format(totalResults)})
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <ProductFilterField label={t('allCategories')}>
            <MaterialSelect
              value={defaultCategory}
              onValueChange={(value) => update({ categoryId: value })}
              ariaLabel={t('allCategories')}
              options={[
                { value: '', label: t('allCategories') },
                ...categories.map((category) => ({ value: category.id, label: category.name })),
              ]}
            />
          </ProductFilterField>
          <ProductFilterField label={t('stockFilter')}>
            <MaterialSelect
              value={defaultStock}
              onValueChange={(value) => update({ stock: value })}
              ariaLabel={t('stockFilter')}
              options={[
                { value: '', label: t('allStockStatuses') },
                { value: 'in_stock', label: t('inStock') },
                { value: 'out_of_stock', label: t('outOfStock') },
                { value: 'low_stock', label: t('lowStock') },
              ]}
            />
          </ProductFilterField>
          <ProductFilterField label={t('sort')}>
            <MaterialSelect
              value={defaultSort}
              onValueChange={(value) => update({ sort: value })}
              ariaLabel={t('sort')}
              options={[
                { value: 'newest', label: t('sortNewest') },
                { value: 'price_asc', label: t('sortPriceAsc') },
                { value: 'price_desc', label: t('sortPriceDesc') },
                { value: 'queried', label: t('sortQueried') },
              ]}
            />
          </ProductFilterField>
        </div>
      </MobileBottomSheet>
    </>
  )
}

function ProductFilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
    >
      <span className="max-w-36 truncate">{label}</span>
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}

function ProductFilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-[var(--text-secondary)]">{label}</span>
      {children}
    </div>
  )
}
