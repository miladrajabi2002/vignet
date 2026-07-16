'use client'

import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'

/**
 * "خدمت جدید" trigger button.
 *
 * Lives in the server-rendered PageHeader (passed via `actions` prop) but must
 * be a client component to attach a real React `onClick` handler.
 *
 * Instead of relying on a CustomEvent (which can be fragile across
 * server/client component hydration boundaries in Next.js 15), this button
 * navigates to `?new=1` on the current path. The `ServiceCatalogManager`
 * (client component) watches `useSearchParams` and opens its inline form when
 * it sees `new=1`, then clears the param so the form can be closed and
 * re-opened cleanly.
 */
export function ServiceNewButton() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleClick() {
    // If the param is already `1` (e.g. user closed the form and clicked
    // again), we need to force a re-trigger. Toggle to `0` first then back
    // to `1` on the next tick.
    if (searchParams.get('new') === '1') {
      router.replace('/services', { scroll: false })
      // Small delay so React registers the param change as a new event.
      setTimeout(() => router.replace('/services?new=1', { scroll: false }), 0)
    } else {
      router.replace('/services?new=1', { scroll: false })
    }
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
