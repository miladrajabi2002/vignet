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

export function AdminLoginForm({ totpEnabled }: { totpEnabled: boolean }) {
  const [state, formAction] = useFormState(adminLogin, initial)

  return (
    <div dir="rtl" className="admin-root dashboard-canvas relative flex min-h-dvh items-center justify-center px-4 py-6 font-fa">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-sheet border border-[var(--border-default)] bg-white shadow-[var(--elev-2)] lg:grid-cols-2">
        {/* The ink half is the console's rail, enlarged: same ink, same accent. */}
        <div className="relative hidden min-h-[35rem] overflow-hidden bg-[#111] p-8 text-white lg:block">
          <div className="admin-vigento-grid absolute inset-0 opacity-60" />
          <div className="relative flex items-center gap-2.5">
            <Logo variant="white" className="h-7 w-28" />
            <span className="rounded-full bg-[var(--signal)] px-2 py-0.5 text-[12px] font-bold leading-5 tracking-wide">ADMIN</span>
          </div>
          <div className="relative mt-24">
            <span className="grid h-12 w-12 place-items-center rounded-control bg-[var(--signal)]"><Sparkles className="h-5 w-5" /></span>
            <h2 className="mt-6 text-3xl font-bold leading-[1.45]">تمام پلتفرم،<br />در یک مرکز فرمان.</h2>
            <p className="mt-4 max-w-sm text-[13px] leading-7 text-white/65">آمار زنده، هزینه‌ها، کاربران، فایل‌های امن و عملیات تأییدشونده فقط برای مالک ویجنت.</p>
          </div>
          <p className="absolute bottom-8 text-[12px] text-white/40">نشست امن مدیریت ویجنت</p>
        </div>
        <div className="p-6 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex items-center gap-2 lg:hidden">
              <Logo className="h-6 w-24" />
              <span className="rounded-full bg-[var(--signal)] px-2 py-0.5 text-[12px] font-bold leading-5 tracking-wide text-white">ADMIN</span>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-control bg-[#111] text-white shadow-[var(--shadow-control)]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="ui-h2 mt-4">ورود مالک پلتفرم</h1>
            <p className="ui-caption mt-1">دسترسی امن مدیریت پلتفرم</p>
          </div>

          <form action={formAction} className="mt-7 space-y-4">
            <div>
              <label htmlFor="admin-login-username" className="ui-field-label">شماره موبایل مدیر</label>
              <input
                id="admin-login-username"
                name="username"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder="09…"
                className="input text-right"
              />
            </div>
            <div>
              <label htmlFor="admin-login-password" className="ui-field-label">رمز عبور</label>
              <input
                id="admin-login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                placeholder="••••••••"
                className="input text-right"
              />
            </div>
            {totpEnabled ? (
              <div>
                <label htmlFor="admin-login-otp" className="ui-field-label">کد یک‌بارمصرف امنیتی</label>
                <input
                  id="admin-login-otp"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  dir="ltr"
                  placeholder="••••••"
                  className="input text-right tabular-nums tracking-widest"
                />
              </div>
            ) : null}
            {state.error ? (
              <p role="alert" className="rounded-control bg-[var(--danger-soft)] px-3 py-2.5 text-[13px] text-[var(--danger-ink)]">{state.error}</p>
            ) : null}
            <div className="pt-1">
              <SubmitButton />
            </div>
          </form>
          <p className="mt-8 text-center text-[12px] text-[var(--text-muted)]">© ویجنت — نشست امضاشده و زمان‌دار</p>
        </div>
      </div>
    </div>
  )
}
