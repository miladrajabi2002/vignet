'use client'

import type { ReactNode } from 'react'
import { Check, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SelectionTriState } from '@/lib/hooks/use-table-selection'

/**
 * Shared selection chrome for the four table pages:
 *
 *  • SelectionHeader — slim row above the list with the tri-state checkbox
 *    («انتخاب همه این صفحه»).
 *  • SelectionBar — appears once something is selected: count, the scoped
 *    action buttons (delete-selected …), «انتخاب همه N نتیجه» when the total
 *    exceeds the visible page, and a clear button.
 *
 * Both are pure presentational; state lives in useTableSelection.
 */

export function TriStateCheckbox({
  state,
  onToggle,
  label,
  disabled,
  className,
}: {
  state: SelectionTriState
  onToggle: () => void
  label: string
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'all' ? true : state === 'partial' ? 'mixed' : false}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] disabled:opacity-40',
        className,
      )}
    >
      <span
        className={cn(
          'grid h-[1.15rem] w-[1.15rem] place-items-center rounded-[0.4rem] border transition-colors',
          state === 'none'
            ? 'border-black/25 bg-white'
            : 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-base)]',
        )}
        aria-hidden="true"
      >
        {state === 'partial' && <Minus className="h-3 w-3" strokeWidth={3} />}
        {state === 'all' && <Check className="h-3 w-3" strokeWidth={3.5} />}
      </span>
    </button>
  )
}

export function SelectionHeader({
  locale,
  triState,
  onToggleVisible,
  visibleCount,
  entityLabel,
  disabled,
  right,
}: {
  locale: 'fa' | 'en'
  triState: SelectionTriState
  onToggleVisible: () => void
  visibleCount: number
  entityLabel: string
  disabled?: boolean
  right?: ReactNode
}) {
  const fa = locale !== 'en'
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.35rem] border border-[var(--border-subtle)] bg-[var(--bg-surface)]/70 px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <TriStateCheckbox
          state={triState}
          onToggle={onToggleVisible}
          disabled={disabled || visibleCount === 0}
          label={fa ? 'انتخاب همه موارد این صفحه' : 'Select all on this page'}
        />
        <span className="min-w-0 truncate text-xs font-medium text-[var(--text-secondary)]">
          {fa
            ? `انتخاب همه این صفحه (${nf.format(visibleCount)})`
            : `Select all on this page (${nf.format(visibleCount)})`}
        </span>
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  )
}

export function SelectionBar({
  locale,
  selectedCount,
  visibleCount,
  totalResults,
  loadingAll,
  allResultsSelected,
  onSelectAllResults,
  onClear,
  hidden,
  children,
}: {
  locale: 'fa' | 'en'
  selectedCount: number
  visibleCount: number
  /** Total matching the current filters (server count) — drives the
   *  «انتخاب همه N نتیجه» affordance when it exceeds the visible page. */
  totalResults: number
  loadingAll?: boolean
  allResultsSelected?: boolean
  onSelectAllResults?: () => void
  onClear: () => void
  /** Keep the bar mounted but invisible (instead of unmounting) while nothing
   *  is selected — the undo snackbar rendered by the scoped delete button
   *  inside must survive the selection clearing right after a delete. */
  hidden?: boolean
  /** Scoped action buttons — e.g. a BulkDeleteButton with the selection ids. */
  children?: ReactNode
}) {
  const fa = locale !== 'en'
  const nf = new Intl.NumberFormat(fa ? 'fa-IR' : 'en-US')
  const showSelectAllResults =
    Boolean(onSelectAllResults) && totalResults > visibleCount && !allResultsSelected

  return (
    <div
      role="toolbar"
      aria-label={fa ? 'عملیات روی موارد انتخاب‌شده' : 'Selection actions'}
      hidden={hidden}
      className="flex flex-wrap items-center gap-2 rounded-[1.35rem] border border-[var(--text-primary)]/15 bg-[var(--bg-surface)] px-2.5 py-2 shadow-[0_14px_36px_rgba(0,0,0,0.1)]"
    >
      <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-3 text-xs font-bold tabular-nums text-[var(--bg-base)]">
        {fa
          ? `${nf.format(selectedCount)} مورد انتخاب شد`
          : `${nf.format(selectedCount)} selected`}
      </span>
      {children}
      {showSelectAllResults && (
        <button
          type="button"
          onClick={onSelectAllResults}
          disabled={loadingAll}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[var(--border-default)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)] disabled:opacity-50"
        >
          {loadingAll
            ? fa ? 'در حال انتخاب…' : 'Selecting…'
            : fa
              ? `انتخاب همه ${nf.format(totalResults)} نتیجه`
              : `Select all ${nf.format(totalResults)} results`}
        </button>
      )}
      {allResultsSelected && totalResults > visibleCount && (
        <span className="inline-flex min-h-11 items-center text-xs font-medium text-[var(--text-secondary)]">
          {fa
            ? `همه ${nf.format(totalResults)} نتیجه انتخاب شد`
            : `All ${nf.format(totalResults)} results selected`}
        </span>
      )}
      <button
        type="button"
        onClick={onClear}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-primary)]"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        {fa ? 'لغو انتخاب' : 'Clear'}
      </button>
    </div>
  )
}

/** Tiny helper for pages: wires the /ids fetch for «انتخاب همه N نتیجه». */
export async function fetchAllResultIds(endpoint: string, params: URLSearchParams): Promise<string[]> {
  const qs = params.toString()
  const res = await fetch(qs ? `${endpoint}?${qs}` : endpoint, { cache: 'no-store' })
  if (!res.ok) throw new Error('IDS_FAILED')
  const data = (await res.json()) as { ids?: string[] }
  return Array.isArray(data.ids) ? data.ids : []
}

// Re-export keeps consumers from importing the hook type separately.
export type { SelectionTriState }
