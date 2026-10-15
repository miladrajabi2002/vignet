'use client'

/**
 * Bulk-delete menu — the «حذف گروهی» action on the products / orders /
 * conversations / contacts lists. Instead of one blunt «حذف همه» it offers
 * categorized cleanups («حذف محصولات ناموجود», «حذف گفتگوهای حل‌شده», …)
 * with «حذف همه» kept last, set apart in red.
 *
 * Phones get a bottom sheet with thumb-sized rows (the header action rail
 * scrolls sideways there and would clip a dropdown); from `md` up it is an
 * anchored dropdown.
 *
 * Opening the menu asks the bulk route (GET) for `{ counts }` — one number per
 * preset, so every option shows how many rows it would remove and a preset
 * with nothing to remove is disabled. Picking one opens the shared confirm
 * dialog; confirming sends DELETE `?scope=<preset>` (or the caller's
 * `selection` ids). The route soft-deletes the rows and returns their ids,
 * which are queued for the global «بازگردانی» (undo) snackbar. Trashed rows are
 * purged by the worker after 7 days.
 *
 * ⚠️ Security: the API route is workspace-scoped, and the scope is resolved
 * server-side (lib/bulk-delete/scopes.ts). This menu is just UX.
 */

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { AlertTriangle, ChevronDown, Loader2, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { queueUndo, type UndoKind } from '@/lib/undo-queue'
import { cn } from '@/lib/utils'

export interface BulkDeleteOption {
  /** Scope key understood by the bulk route, e.g. "out_of_stock". */
  scope: string
  /** The full action, e.g. «حذف محصولات ناموجود». */
  label: string
  /** One short line under the label saying what matches. */
  hint?: string
  /** Extra warning for the confirm dialog (on top of the menu-wide one). */
  extraWarning?: string
}

interface BulkDeleteMenuProps {
  /** Bulk route: GET → { counts }, DELETE ?scope= → { ids }. */
  endpoint: string
  /** Presets in display order. The `all` preset is always rendered last. */
  options: BulkDeleteOption[]
  /** Singular noun used after the count, e.g. «محصول» → «۱۲ محصول حذف می‌شود». */
  entityLabel: string
  /** Which soft-deleted entity this trashes — enables the undo snackbar. */
  undoKind?: UndoKind
  /** Rows picked on the page; offered first, as «حذف N … انتخاب‌شده». */
  selection?: { ids: string[]; label: string }
  /** Trigger label (defaults to «حذف گروهی»). */
  buttonLabel?: string
  /** Warning shown in every confirm dialog. */
  extraWarning?: string
  /** Called after a successful delete with the route's JSON reply;
   *  router.refresh() always runs. */
  onDeleted?: (result: Record<string, unknown>) => void
  /** Icon-only trigger on narrow screens, to keep action rails on one row. */
  compactOnMobile?: boolean
}

type Pending = { kind: 'scope'; option: BulkDeleteOption } | { kind: 'selection' }

export function BulkDeleteMenu({
  endpoint,
  options,
  entityLabel,
  undoKind,
  selection,
  buttonLabel,
  extraWarning,
  onDeleted,
  compactOnMobile = false,
}: BulkDeleteMenuProps) {
  const router = useRouter()
  const locale = useLocale()
  const fa = locale !== 'en'
  const nf = (n: number) => n.toLocaleString(fa ? 'fa-IR' : 'en-US')
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [countsLoading, setCountsLoading] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasSelection = Boolean(selection && selection.ids.length > 0)
  const presets = options.filter((option) => option.scope !== 'all')
  const allOption = options.find((option) => option.scope === 'all')
  const triggerLabel = buttonLabel ?? (fa ? 'حذف گروهی' : 'Bulk delete')

  // Fresh counts every time the menu opens — the list may have changed
  // since (a sync, a new chat), and a stale «۰» would disable a real option.
  useEffect(() => {
    if (!menuOpen) return
    let cancelled = false
    setCountsLoading(true)
    fetch(endpoint, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('COUNT_FAILED'))))
      .then((data) => {
        if (cancelled) return
        if (data && typeof data.counts === 'object' && data.counts) setCounts(data.counts as Record<string, number>)
        else if (typeof data?.count === 'number') setCounts({ all: data.count })
      })
      .catch(() => {
        if (!cancelled) setCounts(null)
      })
      .finally(() => {
        if (!cancelled) setCountsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [menuOpen, endpoint])

  // Same breakpoint as MobileBottomSheet (md), so the two never overlap.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const menuItems = useCallback(
    () => Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []),
    [],
  )

  // Desktop dropdown only: outside click / Escape close it and focus lands on
  // the first option. The phone sheet portals out of rootRef and handles
  // Escape, focus and the backdrop tap itself.
  useEffect(() => {
    if (!menuOpen || !isDesktop) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen, isDesktop])

  useEffect(() => {
    if (menuOpen && isDesktop) menuItems()[0]?.focus()
  }, [menuOpen, isDesktop, menuItems])

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()
    const items = menuItems()
    if (items.length === 0) return
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      event.key === 'Home' ? 0
        : event.key === 'End' ? items.length - 1
          : event.key === 'ArrowDown' ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length
    items[next]?.focus()
  }

  function choose(next: Pending) {
    setMenuOpen(false)
    setError(null)
    setPending(next)
  }

  const pendingCount =
    pending?.kind === 'selection'
      ? selection?.ids.length ?? 0
      : pending
        ? counts?.[pending.option.scope]
        : undefined

  async function handleConfirm() {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      const res =
        pending.kind === 'selection'
          ? await fetch(endpoint, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: selection?.ids ?? [] }),
            })
          : await fetch(`${endpoint}?scope=${encodeURIComponent(pending.option.scope)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json().catch(() => ({}))
      setPending(null)
      setCounts(null)
      // Refresh the server component's data so the trashed rows disappear
      // from the list without a manual F5.
      router.refresh()
      onDeleted?.(body)
      if (undoKind && Array.isArray(body.ids) && body.ids.length > 0) {
        queueUndo(undoKind, body.ids as string[], entityLabel)
      }
    } catch {
      setError(fa ? 'حذف نشد؛ اینترنت را چک کنید و دوباره امتحان کنید.' : 'Delete failed. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const countText =
    typeof pendingCount === 'number'
      ? fa
        ? `${nf(pendingCount)} ${entityLabel} حذف می‌شود`
        : `${nf(pendingCount)} ${entityLabel} will be deleted`
      : ''
  const optionWarning = pending?.kind === 'scope' ? pending.option.extraWarning : undefined
  const description = [countText, optionWarning, extraWarning].filter(Boolean).join('. ')
  const dialogTitle =
    pending?.kind === 'selection'
      ? `${selection?.label ?? ''}${fa ? '؟' : '?'}`
      : pending
        ? `${pending.option.label}${fa ? '؟' : '?'}`
        : ''
  const undoNote = undoKind
    ? (fa
        ? 'تا چند ثانیه بعد از حذف، دکمهٔ «بازگردانی» پایین صفحه همه را برمی‌گرداند.'
        : 'For a few seconds after deleting, the Undo button at the bottom of the screen brings them all back.')
    : undefined

  // Phones get the app's bottom sheet: the page-header action rail scrolls
  // sideways there, which would clip a dropdown, and thumb-sized rows read
  // better than a 20rem popover. From `md` up it is an anchored dropdown.
  const asSheet = !isDesktop

  function countBadge(count: number | undefined, danger: boolean) {
    return (
      <span
        className={cn(
          'inline-flex min-w-8 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
          asSheet && 'min-h-7 min-w-9 text-xs',
          danger ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
        )}
      >
        {countsLoading ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : typeof count === 'number' ? nf(count) : '—'}
      </span>
    )
  }

  function renderRow({
    key,
    label,
    hint,
    count,
    danger = false,
    disabled = false,
    onSelect,
  }: {
    key: string
    label: string
    hint?: string
    count: number | undefined
    danger?: boolean
    disabled?: boolean
    onSelect: () => void
  }) {
    return (
      <button
        key={key}
        type="button"
        role={asSheet ? undefined : 'menuitem'}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3 text-start transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45',
          asSheet ? 'min-h-14 px-4 py-3 active:bg-black/[0.04]' : 'min-h-12 px-3 py-2',
          danger
            ? 'text-red-700 hover:bg-red-50 focus-visible:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 dark:focus-visible:bg-red-950/40'
            : 'text-[var(--text-primary)] hover:bg-black/[0.04] focus-visible:bg-black/[0.04]',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={cn('block', asSheet ? 'text-sm' : 'text-[13px]', danger ? 'font-bold' : 'font-semibold')}>{label}</span>
          {hint && (
            <span className={cn('mt-0.5 block leading-5 text-[var(--text-muted)]', asSheet ? 'text-xs' : 'text-[11.5px]')}>{hint}</span>
          )}
        </span>
        {countBadge(count, danger)}
      </button>
    )
  }

  const selectionRow = hasSelection && selection
    ? renderRow({
        key: '__selection',
        label: selection.label,
        count: selection.ids.length,
        danger: true,
        onSelect: () => choose({ kind: 'selection' }),
      })
    : null
  const presetRows = presets.map((option) => renderRow({
    key: option.scope,
    label: option.label,
    hint: option.hint,
    count: counts?.[option.scope],
    disabled: counts?.[option.scope] === 0,
    onSelect: () => choose({ kind: 'scope', option }),
  }))
  const allRow = allOption
    ? renderRow({
        key: allOption.scope,
        label: allOption.label,
        hint: allOption.hint,
        count: counts?.[allOption.scope],
        danger: true,
        disabled: counts?.[allOption.scope] === 0,
        onSelect: () => choose({ kind: 'scope', option: allOption }),
      })
    : null

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        aria-haspopup={asSheet ? 'dialog' : 'menu'}
        aria-expanded={menuOpen}
        aria-controls={menuOpen && !asSheet ? menuId : undefined}
        aria-label={triggerLabel}
        title={triggerLabel}
        className={cn(
          'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50',
          compactOnMobile ? 'w-11 px-0 sm:w-auto sm:px-3' : 'px-3',
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        <span className={compactOnMobile ? 'hidden sm:inline' : undefined}>{triggerLabel}</span>
        <ChevronDown
          aria-hidden
          className={cn('h-3.5 w-3.5 transition-transform', menuOpen && !asSheet && 'rotate-180', compactOnMobile && 'hidden sm:block')}
        />
      </button>

      {menuOpen && !asSheet && (
        <div
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          onKeyDown={onMenuKeyDown}
          className="absolute end-0 top-full z-30 mt-1.5 w-80 overflow-hidden rounded-xl border border-[var(--border-default)] bg-white py-1 shadow-[var(--elev-2)] dark:bg-[var(--bg-surface)]"
        >
          {selectionRow && (
            <>
              {selectionRow}
              <div className="my-1 border-t border-[var(--border-subtle)]" role="separator" />
            </>
          )}
          {presetRows}
          {allRow && (
            <>
              {presetRows.length > 0 && <div className="my-1 border-t border-[var(--border-subtle)]" role="separator" />}
              {allRow}
            </>
          )}
        </div>
      )}

      <MobileBottomSheet
        open={menuOpen && asSheet}
        title={triggerLabel}
        description={fa ? 'چه چیزی پاک شود؟ تعداد هر گزینه کنارش آمده' : 'What should go? Each option shows how many'}
        closeLabel={fa ? 'بستن' : 'Close'}
        triggerRef={triggerRef}
        onClose={() => setMenuOpen(false)}
      >
        <div className="space-y-3">
          {selectionRow && (
            <div className="overflow-hidden rounded-2xl border border-red-200 bg-white dark:border-red-900/50">{selectionRow}</div>
          )}
          {presetRows.length > 0 && (
            <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white">
              {presetRows}
            </div>
          )}
          {allRow && (
            <div className="overflow-hidden rounded-2xl border border-red-200 bg-white dark:border-red-900/50">{allRow}</div>
          )}
          {undoKind && (
            <p className="px-1 text-xs leading-5 text-[var(--text-muted)]">
              {fa ? 'بعد از هر حذف، چند ثانیه فرصت «بازگردانی» دارید.' : 'After each delete you get a few seconds to undo.'}
            </p>
          )}
        </div>
      </MobileBottomSheet>

      <ConfirmDialog
        open={pending !== null}
        title={dialogTitle}
        description={description}
        undoNote={undoNote}
        cancelLabel={fa ? 'انصراف' : 'Cancel'}
        confirmLabel={busy ? (fa ? 'در حال حذف…' : 'Deleting…') : (fa ? 'بله، حذف کن' : 'Yes, delete')}
        tone="danger"
        busy={busy}
        error={error}
        icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
        onConfirm={handleConfirm}
        onClose={() => {
          if (!busy) setPending(null)
        }}
      />
    </div>
  )
}
