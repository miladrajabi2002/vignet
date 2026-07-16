'use client'

import { Plus } from 'lucide-react'

/**
 * "خدمت جدید" trigger button — lives in the PageHeader actions slot.
 *
 * This is a client component (note the 'use client' directive) so it can
 * attach an `onClick` handler. Server components can't have event handlers,
 * which is why this is split out from the server-rendered services page.
 *
 * The button dispatches a `service:new` CustomEvent on `window`. The
 * ServiceCatalogManager (also a client component) listens for this event
 * via `useEffect` + `addEventListener` and opens its inline create form.
 * This keeps the form state inside the manager while letting the trigger
 * render in the server-rendered PageHeader — matching the agents page
 * pattern where the "new" action lives in the header.
 */
export function ServiceNewButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('service:new'))}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-sm font-bold text-[var(--bg-base)] shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
    >
      <Plus className="h-4 w-4" />
      خدمت جدید
    </button>
  )
}
