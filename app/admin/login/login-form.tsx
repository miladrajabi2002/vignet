'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { adminLogin, type AdminLoginState } from './actions'

const initial: AdminLoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-zinc-800 disabled:opacity-50"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? 'در حال ورود…' : 'ورود به پنل مدیریت'}
    </button>
  )
}

export function AdminLoginForm() {
  const [state, formAction] = useFormState(adminLogin, initial)

  return (
    <div dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 px-4 font-fa">
      {/* Decorative grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-zinc-900/5 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xl shadow-zinc-200/50">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-lg shadow-zinc-900/20">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-xl font-bold text-zinc-900">پنل مدیریت ویجنت</h1>
            <p className="mt-1.5 text-sm text-zinc-500">دسترسی فقط برای مدیر سیستم</p>
          </div>

          <form action={formAction} className="mt-7 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">نام کاربری</label>
              <input
                name="username"
                autoComplete="username"
                placeholder="نام کاربری مدیر"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">رمز عبور</label>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors focus:border-zinc-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>
            {state.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
            ) : null}
            <div className="pt-2">
              <SubmitButton />
            </div>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-zinc-400">
          © ویجنت — تمامی حقوق محفوظ است
        </p>
      </div>
    </div>
  )
}
