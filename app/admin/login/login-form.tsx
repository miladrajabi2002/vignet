'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { ShieldCheck, Loader2, Sparkles } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { adminLogin, type AdminLoginState } from './actions'

const initial: AdminLoginState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="admin-primary-button w-full text-sm"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? 'در حال ورود…' : 'ورود به پنل مدیریت'}
    </button>
  )
}

export function AdminLoginForm() {
  const [state, formAction] = useFormState(adminLogin, initial)

  return (
    <div dir="rtl" className="admin-root relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-6 font-fa">
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

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-black/[0.08] bg-white shadow-[0_32px_100px_-48px_rgba(0,0,0,.65)] lg:grid-cols-2">
        <div className="relative hidden min-h-[560px] overflow-hidden bg-black p-8 text-white lg:block">
          <div className="admin-vigento-grid absolute inset-0 opacity-60" />
          <div className="relative flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white"><Logo className="h-4 w-auto max-w-7" /></span><div><p className="text-sm font-bold">Vigento AI</p><p className="mt-1 text-[9px] text-white/40">OWNER OPERATIONS CORE</p></div></div>
          <div className="relative mt-24"><span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08]"><Sparkles className="h-5 w-5" /></span><h2 className="mt-6 text-3xl font-bold leading-[1.45]">تمام پلتفرم،<br />در یک مرکز فرمان.</h2><p className="mt-4 max-w-sm text-xs leading-7 text-white/45">آمار زنده، هزینه‌ها، کاربران، فایل‌های امن و عملیات تأییدشونده فقط برای مالک ویجنتو.</p></div>
          <p className="absolute bottom-8 text-[9px] text-white/25">VIGENT · SECURE ADMIN SESSION</p>
        </div>
        <div className="p-6 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-xl font-bold text-black">ورود مالک پلتفرم</h1>
            <p className="mt-1.5 text-xs text-black/45">دسترسی اختصاصی میلاد</p>
          </div>

          <form action={formAction} className="mt-7 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">شماره موبایل مدیر</label>
              <input
                name="username"
                inputMode="tel"
                autoComplete="tel"
                placeholder="۰۹۱۲۸۳۵۲۲۷۱"
                className="admin-input bg-[#f8f8f6] text-sm"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">رمز عبور</label>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="admin-input bg-[#f8f8f6] text-sm"
              />
            </div>
            {state.error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
            ) : null}
            <div className="pt-2">
              <SubmitButton />
            </div>
          </form>
          <p className="mt-8 text-center text-[10px] text-black/30">© ویجنت — نشست امضاشده و زمان‌دار</p>
        </div>
      </div>
    </div>
  )
}
