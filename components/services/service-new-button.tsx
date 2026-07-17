'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

/**
 * "خدمت جدید" trigger button.
 *
 * Navigates to `/services?new=<timestamp>` on click. The `ServiceCatalogManager`
 * watches the `new` search param and opens its dialog whenever the value
 * changes. Using a timestamp (instead of a fixed `1`) means every click
 * produces a new, distinct value — so even repeated clicks reliably
 * re-trigger the form without needing to clear the param first.
 */
export function ServiceNewButton() {
  const router = useRouter()

  function handleClick() {
    // A fresh timestamp on every click guarantees the search param value
    // changes, which reliably triggers the `useEffect` in
    // ServiceCatalogManager — even on rapid repeated clicks.
    router.replace(`/services?new=${Date.now()}`, { scroll: false })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
    >
      <Plus className="h-4 w-4" />
      خدمت جدید
    </button>
  )
}
