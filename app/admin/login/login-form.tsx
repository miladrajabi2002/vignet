'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { ShieldCheck } from 'lucide-react'
import { adminLogin, type AdminLoginState } from './actions'

const initial: AdminLoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? 'در حال ورود…' : 'ورود به پنل مدیریت'}
    </button>
  )
}

export function AdminLoginForm() {
  const [state, formAction] = useFormState(adminLogin, initial)

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <h1 className="mt-4 text-xl font-light">پنل مدیریت ویجنت</h1>
          <p className="mt-1 text-sm text-zinc-500">دسترسی فقط برای مدیر سیستم</p>
        </div>

        <form action={formAction} className="space-y-3">
          <input
            name="username"
            autoComplete="username"
            placeholder="نام کاربری"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="رمز عبور"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
          {state.error ? (
            <p className="text-sm text-red-400">{state.error}</p>
          ) : null}
          <SubmitButton />
        </form>
      </div>
    </div>
  )
}
