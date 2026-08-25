'use client'

import { LoaderCircle, LogOut, ShieldCheck } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { stopUserImpersonation } from '@/app/actions/impersonation'

function ReturnToAdminButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="spatial-press inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-950 px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-950 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
    >
      {pending
        ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        : <LogOut aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />}
      {pending ? 'در حال بازگشت…' : 'بازگشت به پنل ادمین'}
    </button>
  )
}

export function ImpersonationBanner({ userName }: { userName: string }) {
  return (
    <aside
      aria-label="حالت پشتیبانی ادمین"
      className="mb-2 flex flex-col gap-3 rounded-[1.35rem] border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-amber-950 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:px-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-950 text-amber-50">
          <ShieldCheck aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black">حالت پشتیبانی: پنل {userName}</p>
          <p className="mt-0.5 text-xs leading-5 text-amber-900/75">
            اکنون با دسترسی این کاربر کار می‌کنید؛ این نشست حداکثر ۶۰ دقیقه فعال است.
          </p>
        </div>
      </div>
      <form action={stopUserImpersonation} className="shrink-0">
        <ReturnToAdminButton />
      </form>
    </aside>
  )
}
