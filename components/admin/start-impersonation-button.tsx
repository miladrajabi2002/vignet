'use client'

import { LoaderCircle, LogIn } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { startUserImpersonation } from '@/app/actions/impersonation'

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-describedby="impersonation-session-hint"
      className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      {pending
        ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        : <LogIn aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />}
      {pending ? 'در حال ورود…' : 'ورود به پنل کاربر'}
    </button>
  )
}

export function StartImpersonationButton({ userId }: { userId: string }) {
  return (
    <form action={startUserImpersonation}>
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton />
      <span id="impersonation-session-hint" className="sr-only">
        یک نشست پشتیبانی امن و حداکثر ۶۰ دقیقه‌ای ایجاد می‌شود.
      </span>
    </form>
  )
}
