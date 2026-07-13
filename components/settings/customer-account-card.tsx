'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, LockKeyhole, Smartphone, UserRound } from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'

export function CustomerAccountCard({
  initialName,
  phone,
  initialLanguage,
  locale,
}: {
  initialName: string
  phone: string
  initialLanguage: string
  locale: 'fa' | 'en'
}) {
  const fa = locale === 'fa'
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [language, setLanguage] = useState(initialLanguage === 'en' ? 'en' : 'fa')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (name.trim().length < 2) return
    setState('saving')
    const response = await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), language }),
    }).catch(() => null)
    if (!response?.ok) {
      setState('error')
      return
    }
    setState('saved')
    router.refresh()
    window.setTimeout(() => setState('idle'), 2200)
  }

  return (
    <form onSubmit={save} className="spatial-surface overflow-hidden rounded-[1.75rem]">
      <div className="flex flex-wrap items-start justify-between gap-4 bg-black p-5 text-white sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <UserRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold">{fa ? 'حساب کاربری شما' : 'Your customer account'}</h2>
            <p className="mt-1 text-xs text-white/60">{fa ? 'اطلاعاتی که در پنل و اعلان‌ها نمایش داده می‌شود' : 'Identity used across the dashboard and notifications'}</p>
          </div>
        </div>
        <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-[10px] font-bold text-white/80">
          <LockKeyhole className="h-3.5 w-3.5" />
          {fa ? 'حساب مالک' : 'Owner account'}
        </span>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <label className="block text-xs font-bold text-[var(--text-secondary)]">
          {fa ? 'نام نمایشی' : 'Display name'}
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} className="input mt-2 min-h-12" />
        </label>
        <div>
          <p className="text-xs font-bold text-[var(--text-secondary)]">{fa ? 'زبان پنل' : 'Dashboard language'}</p>
          <MaterialSelect
            value={language}
            onValueChange={setLanguage}
            ariaLabel={fa ? 'زبان پنل' : 'Dashboard language'}
            className="mt-2"
            options={[{ value: 'fa', label: 'فارسی' }, { value: 'en', label: 'English' }]}
          />
        </div>
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-muted)] p-4 sm:col-span-2">
          <div className="flex items-center gap-3">
            <Smartphone className="h-4 w-4 text-[var(--text-muted)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[var(--text-muted)]">{fa ? 'شماره ورود تأییدشده' : 'Verified sign-in number'}</p>
              <p dir="ltr" className="mt-0.5 text-left text-sm font-semibold text-[var(--text-primary)]">{phone}</p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{fa ? 'تأییدشده' : 'Verified'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] px-5 py-4 sm:px-6">
        <p aria-live="polite" className={`text-xs ${state === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
          {state === 'saved' ? (fa ? 'تغییرات ذخیره شد.' : 'Changes saved.') : state === 'error' ? (fa ? 'ذخیره انجام نشد؛ دوباره تلاش کنید.' : 'Could not save. Try again.') : ''}
        </p>
        <button disabled={state === 'saving' || name.trim().length < 2} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white shadow-[var(--shadow-control)] disabled:opacity-50">
          {state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}
          {state === 'saving' ? (fa ? 'در حال ذخیره…' : 'Saving…') : (fa ? 'ذخیره تنظیمات' : 'Save settings')}
        </button>
      </div>
    </form>
  )
}
