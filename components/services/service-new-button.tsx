'use client'

import { Plus } from 'lucide-react'

/**
 * "خدمت جدید" trigger button.
 *
 * Lives in the server-rendered PageHeader (passed via `actions` prop) but must
 * be a client component to attach a real React `onClick` handler. Dispatches a
 * `service:new` CustomEvent on `window` that the `ServiceCatalogManager`
 * (client component) listens for to open its inline form — keeping the form
 * state where it belongs while letting the button render in the server header.
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
