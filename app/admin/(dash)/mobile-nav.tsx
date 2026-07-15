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
      <div className="admin-command-rail sticky top-2 z-30 mx-2 mt-2 flex min-h-14 items-center justify-between rounded-2xl border border-white/10 bg-[#101113] px-3 shadow-[0_18px_50px_-30px_rgba(0,0,0,.85)] md:hidden">
        <BrandHeader />
        <div className="flex items-center gap-2">
          <form action={adminLogout}>
            <button
              type="submit"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/55 transition-colors hover:border-red-300/25 hover:bg-red-500/10 hover:text-red-300"
              aria-label="خروج"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
          <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/60" aria-label="خانه سایت"><Home className="h-4 w-4" /></Link>
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
          <div className="admin-command-rail absolute inset-y-2 right-2 flex w-[19rem] max-w-[calc(100vw-1rem)] flex-col rounded-[1.6rem] border border-white/10 bg-[#101113]/98 shadow-[0_30px_90px_-35px_rgba(0,0,0,.85)] backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <BrandHeader />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/55"
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
