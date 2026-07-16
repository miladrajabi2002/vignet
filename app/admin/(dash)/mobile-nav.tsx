'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { AdminNavContent, BrandHeader } from './admin-nav'

/** Mobile navigation trigger embedded in the shared admin header. */
export function MobileNavTrigger() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="spatial-press inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-white text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:text-[var(--text-primary)]"
        aria-label="بازکردن منوی مدیریت"
        aria-expanded={open}
        aria-controls="admin-mobile-navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted && open && createPortal(
        <div className="fixed inset-0 z-[100] md:hidden">
          <button
            type="button"
            aria-label="بستن منو"
            className="dashboard-mobile-backdrop absolute inset-0 bg-black/38 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="منوی پنل مدیریت"
            className="dashboard-mobile-sheet spatial-control absolute inset-y-3 start-3 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-[2rem] p-4 shadow-[var(--shadow-lift)]"
          >
            <div className="mb-4 flex items-center justify-between px-1">
              <div className="flex-1"><BrandHeader /></div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                autoFocus
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                aria-label="بستن منو"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <AdminNavContent onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  )
}
