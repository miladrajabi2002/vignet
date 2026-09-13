'use client'

import { useCallback, useMemo, useRef, useState } from 'react'

/**
 * Shared row-selection state for the four table pages (contacts, products,
 * orders, conversations).
 *
 * Provides:
 *   • tri-state for the header checkbox (none / partial / all-visible)
 *   • Shift+Click range selection — click a checkbox, then shift-click another
 *     to select the whole visible span between them (Gmail/Files style)
 *   • "select all N results" support via setSelectedIds (fed by the /ids
 *     endpoints) — the selection can exceed the visible page
 */

export type SelectionTriState = 'none' | 'partial' | 'all'

export function useTableSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const lastIndexRef = useRef(-1)

  const visibleSelectedCount = useMemo(
    () => visibleIds.reduce((count, id) => count + (selected.has(id) ? 1 : 0), 0),
    [visibleIds, selected],
  )

  const triState: SelectionTriState =
    visibleIds.length > 0 && visibleSelectedCount === visibleIds.length
      ? 'all'
      : visibleSelectedCount > 0
        ? 'partial'
        : 'none'

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  /** Toggle one row; with `shift` it range-selects from the last clicked row. */
  const toggle = useCallback(
    (id: string, options?: { shiftKey?: boolean }) => {
      const index = visibleIds.indexOf(id)
      setSelected((current) => {
        const next = new Set(current)
        if (options?.shiftKey && lastIndexRef.current >= 0 && lastIndexRef.current !== index) {
          const from = Math.min(lastIndexRef.current, index)
          const to = Math.max(lastIndexRef.current, index)
          // Shift+click always ADDS the span (never deselects the anchor's
          // neighbours) — the predictable behaviour users expect.
          for (let i = from; i <= to; i++) {
            if (visibleIds[i]) next.add(visibleIds[i])
          }
        } else if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      })
      if (index >= 0) lastIndexRef.current = index
    },
    [visibleIds],
  )

  /** Header tri-state click: select all visible when not everything is selected, clear otherwise. */
  const toggleVisible = useCallback(() => {
    setSelected((current) => {
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => current.has(id))
      if (allSelected) {
        const next = new Set(current)
        for (const id of visibleIds) next.delete(id)
        return next
      }
      const next = new Set(current)
      for (const id of visibleIds) next.add(id)
      return next
    })
    lastIndexRef.current = -1
  }, [visibleIds])

  /** Replace the whole selection (used by "select all N results"). */
  const setSelectedIds = useCallback((ids: string[]) => {
    setSelected(new Set(ids))
    lastIndexRef.current = -1
  }, [])

  const clear = useCallback(() => {
    setSelected(new Set())
    lastIndexRef.current = -1
  }, [])

  return {
    selected,
    selectedCount: selected.size,
    visibleSelectedCount,
    triState,
    isSelected,
    toggle,
    toggleVisible,
    setSelectedIds,
    clear,
  }
}
