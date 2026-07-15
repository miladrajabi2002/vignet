'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Home, Menu, X, LogOut } from 'lucide-react'
import { AdminNavContent, BrandHeader } from './admin-nav'
import { adminLogout } from '../login/actions'

/** Top bar with mobile menu trigger + logout — shown on small screens. */
export function MobileNavTrigger() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="spatial-control sticky top-2 z-30 mx-2 mt-2 flex min-h-14 items-center justify-between rounded-2xl px-3 md:hidden">
        <BrandHeader />
        <div className="flex items-center gap-2">
          <form action={adminLogout}>
            <button
              type="submit"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.07] bg-white text-black/50 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              aria-label="خروج"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.07] bg-white text-black/55" aria-label="خانه سایت"><Home className="h-4 w-4" /></Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black shadow-[var(--shadow-control)]"
            aria-label="منو"
            aria-expanded={open}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="بستن منو"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="spatial-surface absolute inset-y-2 right-2 flex w-[19rem] max-w-[calc(100vw-1rem)] flex-col rounded-[1.6rem] shadow-[0_30px_90px_-35px_rgba(0,0,0,.45)]">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
              <BrandHeader />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] text-black/55"
                aria-label="بستن"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <AdminNavContent onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
