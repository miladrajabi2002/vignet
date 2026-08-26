'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Package, Pencil, Trash2, Search as SearchIcon, Loader2, Undo2, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MaterialSelect } from '@/components/ui/material-select'

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

  // ── Undo toast state ──
  // After a successful delete we show a toast for 6 seconds. Clicking "Undo"
  // recreates the product via POST /api/products with the cached snapshot.
  // The toast auto-dismisses after the timeout; if the user navigates away
  // the snapshot is dropped (no stale state).
  const [undoToast, setUndoToast] = useState<{
    name: string
    snapshot: {
      name: string
      description?: string
      price?: number | null
      comparePrice?: number | null
      sku?: string
      stock?: number | null
      images: string[]
      attributes?: Record<string, string>
      tags: string[]
      active: boolean
    }
  } | null>(null)
  const [undoing, setUndoing] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Cleanup the undo timer when the toast is dismissed or the component
  // unmounts — otherwise a stale timer could fire after navigation.
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

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
        // Show the undo toast. We cache a snapshot of the product's fields
        // so the user can restore it within the next 6 seconds.
        setUndoToast({
          name: target.name,
          snapshot: {
            name: target.name,
            price: target.price,
            comparePrice: target.comparePrice,
            stock: target.stock,
            images: target.images,
            tags: [],
            active: target.active,
          },
        })
        // Auto-dismiss after 6 seconds. We keep the ref so we can cancel
        // early if the user clicks "Undo" or closes the toast manually.
        undoTimerRef.current = setTimeout(() => {
          setUndoToast(null)
          undoTimerRef.current = null
        }, 6000)
        return
      }
      setDeleteError(t('deleteFailed'))
    } catch {
      setDeleteError(t('deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  async function performUndo() {
    if (!undoToast || undoing) return
    setUndoing(true)
    try {
      // Recreate the product with the cached snapshot. The server assigns a
      // new id — we can't reuse the old one because the row is gone.
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(undoToast.snapshot),
      })
      if (res.ok) {
        // Clear the toast + cancel the auto-dismiss timer.
        if (undoTimerRef.current) {
          clearTimeout(undoTimerRef.current)
          undoTimerRef.current = null
        }
        setUndoToast(null)
        router.refresh()
      }
    } catch {
      // Best-effort — if the recreate fails, leave the toast so the user
      // can try again or dismiss manually.
    } finally {
      setUndoing(false)
    }
  }

  function dismissUndo() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setUndoToast(null)
  }

  function openDelete(p: ProductCard, btn: HTMLButtonElement) {
    deleteTriggerRef.current = btn
    setDeleteError(null)
    setDeleteTarget(p)
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const stockLabel =
            p.stock === null
              ? t('unlimited')
              : p.stock > 0
                ? t('inStock')
                : t('outOfStock')
          const stockClass =
            p.stock === null
              ? 'text-[var(--text-muted)]'
              : p.stock > 0
                ? 'text-success'
                : 'text-danger'
          return (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="spatial-surface group flex flex-col overflow-hidden rounded-[1.5rem] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-[var(--border-strong)] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-2"
            >
              <div className="relative aspect-video bg-[var(--bg-muted)]">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} width={320} height={320} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--text-hint)]">
                    <Package className="h-8 w-8" />
                  </div>
                )}
                <span className={cn('absolute end-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs backdrop-blur', stockClass)}>
                  {stockLabel}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-4">
                {/* Title — no underline on hover; the whole card is the link. */}
                <h3 className="truncate font-medium text-[var(--text-primary)]">
                  {p.name}
                </h3>
                {p.category && (
                  <span className="mt-0.5 text-xs text-[var(--text-muted)]">{p.category.name}</span>
                )}
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

                <div className="mt-auto flex items-center justify-between pt-4">
                  <span className="text-xs text-[var(--text-muted)]">
                    {t('queries', { count: p.queryCount })}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Edit button — stops propagation so it doesn't trigger the card link. */}
                    <Link
                      href={`/products/${p.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
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
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-danger hover:text-danger"
                      aria-label={t('delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </Link>
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
                className="w-full max-w-[27rem] overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
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
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] disabled:opacity-50"
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

      {/* Undo toast — shown for 6s after a successful delete. Uses the same
          portal + framer-motion pattern as the delete dialog so the styling
          stays consistent. */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {undoToast && (
            <motion.div
              className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 px-4"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 20 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
                <div className="flex-1 text-sm">
                  <span className="font-medium text-[var(--text-primary)]">
                    {t('deleted', { name: undoToast.name })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={performUndo}
                  disabled={undoing}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3 py-1.5 text-xs font-bold text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {undoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                  {t('undo')}
                </button>
                <button
                  type="button"
                  onClick={dismissUndo}
                  disabled={undoing}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
                  aria-label={t('dismissUndo')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
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
}: {
  categories: { id: string; name: string }[]
  defaultQuery: string
  defaultSort: string
  defaultCategory: string
  defaultStock: string
}) {
  const t = useTranslations('products')
  const router = useRouter()
  // Local state for the search input — we debounce URL updates so we don't
  // trigger a server round-trip on every keystroke. The dropdowns (category,
  // stock, sort) update immediately because each change is a discrete action.
  const [searchInput, setSearchInput] = useState(defaultQuery)
  const [isSearching, startSearchTransition] = useTransition()

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
      }
      for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
      sp.delete('page') // back to page 1 on every search change
      startSearchTransition(() => {
        router.replace(`/products?${sp.toString()}`, { scroll: false })
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchInput, defaultQuery, defaultSort, defaultCategory, defaultStock, router])

  function update(params: Record<string, string>) {
    const sp = new URLSearchParams()
    // When the user changes the search query, category, stock, or sort, reset to
    // page 1 — otherwise they'd land on an empty page if the new filter has
    // fewer results than the current page index.
    const isFilterChange =
      params.q !== undefined ||
      params.categoryId !== undefined ||
      params.sort !== undefined ||
      params.stock !== undefined
    const merged = {
      q: defaultQuery,
      sort: defaultSort,
      categoryId: defaultCategory,
      stock: defaultStock,
      ...(isFilterChange ? {} : {}),
      ...params,
    }
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v)
    // Explicitly drop `page` on filter changes so we go back to page 1.
    if (isFilterChange) sp.delete('page')
    router.push(`/products?${sp.toString()}`)
  }

  return (
    <div className="spatial-surface flex flex-wrap items-center gap-2 rounded-[1.5rem] p-3 sm:p-4">
      <div className="relative min-w-[12rem] flex-1">
        {isSearching ? (
          <Loader2 className="absolute top-1/2 ms-3 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--text-muted)] motion-reduce:animate-none" />
        ) : (
          <SearchIcon className="absolute top-1/2 ms-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        )}
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('search')}
          className="input ps-9"
        />
      </div>
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
        value={defaultStock}
        onValueChange={(value) => update({ stock: value })}
        ariaLabel={t('stockFilter')}
        className="min-w-40"
        options={[
          { value: '', label: t('allStockStatuses') },
          { value: 'in_stock', label: t('inStock') },
          { value: 'out_of_stock', label: t('outOfStock') },
        ]}
      />
      <MaterialSelect
        value={defaultSort}
        onValueChange={(value) => update({ sort: value })}
        ariaLabel={t('sortNewest')}
        className="min-w-40"
        options={[
          { value: 'newest', label: t('sortNewest') },
          { value: 'price_asc', label: t('sortPriceAsc') },
          { value: 'price_desc', label: t('sortPriceDesc') },
          { value: 'queried', label: t('sortQueried') },
        ]}
      />
    </div>
  )
}
