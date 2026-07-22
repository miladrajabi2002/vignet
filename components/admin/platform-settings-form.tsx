'use client'

import { useState } from 'react'
import { Check, Loader2, Save, ShieldCheck, Volume2, WalletCards } from 'lucide-react'
import type { PlatformCommercialConfig } from '@/lib/platform/commercial-config'
import { cn } from '@/lib/utils'
import { MaterialSelect } from '@/components/ui/material-select'

type NumberPath =
  | ['trialCreditIRR']
  | ['financeUsdToIRR']
  | ['replyPricesIRR', keyof PlatformCommercialConfig['replyPricesIRR']]
  | ['plans', keyof PlatformCommercialConfig['plans'], keyof PlatformCommercialConfig['plans']['TRIAL']]

const PLAN_META = {
  TRIAL: { title: 'آزمایشی', hint: 'یک ماه تجربه محصول', locked: true },
  STARTER: { title: 'استارتر', hint: 'شروع کسب‌وکار کوچک', locked: false },
  PRO: { title: 'حرفه‌ای', hint: 'پیشنهاد اصلی ویجنت', locked: false },
  BUSINESS: { title: 'سازمانی', hint: 'ظرفیت عملیات بزرگ', locked: false },
} as const

const MODEL_META = {
  fast: 'سریع',
  standard: 'استاندارد',
  balanced: 'متعادل',
  premium: 'حرفه‌ای',
} as const

export function PlatformSettingsForm({ initial }: { initial: PlatformCommercialConfig }) {
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  function setField<K extends keyof PlatformCommercialConfig>(key: K, next: PlatformCommercialConfig[K]) {
    setValue((current) => ({ ...current, [key]: next }))
    setDirty(true)
    setMessage(null)
  }

  function setNumber(path: NumberPath, raw: string) {
    const parsed = raw === '' ? 0 : Math.max(0, Math.round(Number(raw)))
    if (!Number.isFinite(parsed)) return
    setValue((current) => {
      if (path[0] === 'trialCreditIRR') return { ...current, trialCreditIRR: parsed }
      if (path[0] === 'financeUsdToIRR') return { ...current, financeUsdToIRR: raw === '' ? null : parsed }
      if (path[0] === 'replyPricesIRR') {
        return { ...current, replyPricesIRR: { ...current.replyPricesIRR, [path[1]]: parsed } }
      }
      const [, plan, field] = path
      return {
        ...current,
        plans: {
          ...current.plans,
          [plan]: { ...current.plans[plan], [field]: parsed },
        },
      }
    })
    setDirty(true)
    setMessage(null)
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/platform-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      })
      if (!response.ok) throw new Error('SAVE_FAILED')
      const next = await response.json() as PlatformCommercialConfig
      setValue(next)
      setDirty(false)
      setMessage('تنظیمات ذخیره شد و از درخواست بعدی روی سیستم اعمال می‌شود.')
    } catch {
      setMessage('ذخیره انجام نشد. مقدارهای واردشده را بررسی و دوباره تلاش کنید.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="spatial-surface overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-black/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium text-black/45"><ShieldCheck className="h-4 w-4" /> سیاست runtime پلتفرم</div>
            <h2 className="mt-2 text-lg font-bold text-black">مدل‌های صوتی و حریم خصوصی</h2>
            <p className="mt-1 text-xs leading-6 text-black/45">کلیدها و secretها همچنان فقط در ENV می‌مانند؛ اینجا فقط سیاست‌های امن و قابل تغییر ذخیره می‌شوند.</p>
          </div>
          <button type="button" onClick={save} disabled={!dirty || saving} className="admin-primary-button min-w-36">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : dirty ? <Save className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {saving ? 'در حال ذخیره' : dirty ? 'ذخیره تغییرات' : 'ذخیره شده'}
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="مدل تبدیل صدا به متن" hint="OpenRouter provider slug">
            <input dir="ltr" value={value.sttModel} onChange={(event) => setField('sttModel', event.target.value)} className="admin-input" />
          </Field>
          <Field label="مدل تبدیل متن به صدا" hint="OpenRouter provider slug">
            <input dir="ltr" value={value.ttsModel} onChange={(event) => setField('ttsModel', event.target.value)} className="admin-input" />
          </Field>
          <Field label="اولویت انتخاب Provider" hint="در تمام درخواست‌های OpenRouter">
            <MaterialSelect value={value.providerSort} onValueChange={(next) => setField('providerSort', next as PlatformCommercialConfig['providerSort'])} ariaLabel="اولویت انتخاب Provider" buttonClassName="admin-input" options={[{ value: 'price', label: 'کمترین قیمت' }, { value: 'latency', label: 'کمترین تأخیر' }, { value: 'throughput', label: 'بیشترین توان پردازش' }]} />
          </Field>
          <label className="flex min-h-[76px] cursor-pointer items-center justify-between gap-4 rounded-2xl border border-black/[0.07] bg-[#f7f7f5] px-4 py-3">
            <div><span className="text-sm font-bold text-black">Zero Data Retention</span><span className="mt-1 block text-[11px] text-black/45">عدم نگهداری داده توسط Provider</span></div>
            <input type="checkbox" checked={value.zeroDataRetention} onChange={(event) => setField('zeroDataRetention', event.target.checked)} className="peer sr-only" />
            <span className="relative h-7 w-12 shrink-0 rounded-full bg-black/15 transition-colors peer-checked:bg-black after:absolute after:start-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" />
          </label>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="admin-icon-well"><Volume2 className="h-4 w-4" /></span><div><h2 className="text-base font-bold">تعرفه هر پاسخ موفق</h2><p className="mt-0.5 text-[11px] text-black/45">مقدار داخلی ریال است؛ داشبورد کاربران تومان نمایش می‌دهد.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(Object.keys(MODEL_META) as Array<keyof typeof MODEL_META>).map((model) => (
              <Field key={model} label={MODEL_META[model]} hint={model}>
                <MoneyInput value={value.replyPricesIRR[model]} onChange={(raw) => setNumber(['replyPricesIRR', model], raw)} suffix="ریال" />
              </Field>
            ))}
          </div>
        </div>
        <div className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="admin-icon-well"><WalletCards className="h-4 w-4" /></span><div><h2 className="text-base font-bold">اعتبار و نرخ مالی</h2><p className="mt-0.5 text-[11px] text-black/45">برای ثبت‌نام جدید و محاسبه سود تلفیقی</p></div></div>
          <div className="mt-5 space-y-4">
            <Field label="اعتبار هدیه ماه آزمایشی" hint={`${Math.round(value.trialCreditIRR / 10).toLocaleString('fa-IR')} تومان`}>
              <MoneyInput value={value.trialCreditIRR} onChange={(raw) => setNumber(['trialCreditIRR'], raw)} suffix="ریال" />
            </Field>
            <Field label="هر دلار آمریکا" hint="برای گزارش سود؛ خالی یعنی نمایش ندادن سود تلفیقی">
              <MoneyInput value={value.financeUsdToIRR ?? ''} onChange={(raw) => setNumber(['financeUsdToIRR'], raw)} suffix="ریال" allowEmpty />
            </Field>
          </div>
        </div>
      </section>

      <section className="spatial-surface rounded-[1.5rem] p-5 sm:p-6">
        <div><h2 className="text-lg font-bold">پلن‌ها و ظرفیت سرویس</h2><p className="mt-1 text-xs leading-6 text-black/45">قیمت، اعتبار هدیه، تخفیف پاسخ و تعداد اتصال کانال از همین تنظیمات خوانده می‌شود. تعداد ایجنت محدود نیست و پاسخ‌های AI بر اساس اعتبار کیف پول محاسبه می‌شوند.</p></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(Object.keys(PLAN_META) as Array<keyof typeof PLAN_META>).map((plan) => {
            const meta = PLAN_META[plan]
            const item = value.plans[plan]
            return (
              <article key={plan} className={cn('rounded-[1.35rem] border p-4 sm:p-5', plan === 'PRO' ? 'border-black bg-black text-white shadow-[0_18px_48px_-30px_rgba(0,0,0,.8)]' : 'border-black/[0.07] bg-[#f8f8f6] text-black')}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{meta.title}</p><p className={cn('mt-1 text-[11px]', plan === 'PRO' ? 'text-white/45' : 'text-black/40')}>{meta.hint}</p></div><span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', plan === 'PRO' ? 'bg-white text-black' : 'bg-white text-black/55 ring-1 ring-black/[0.06]')}>{plan}</span></div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <PlanNumber label="قیمت ماهانه ریال" value={item.priceIRR} disabled={meta.locked} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'priceIRR'], raw)} />
                  <PlanNumber label="قیمت دلاری" value={item.priceUSD} disabled={meta.locked} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'priceUSD'], raw)} />
                  <PlanNumber label="اعتبار هدیه ریال" value={item.includedCreditIRR} disabled={meta.locked} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'includedCreditIRR'], raw)} />
                  <PlanNumber label="تخفیف پاسخ (BPS)" value={item.replyDiscountBps} disabled={meta.locked} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'replyDiscountBps'], raw)} />
                  <PlanNumber label="حداکثر اتصال کانال" value={item.maxChannels} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'maxChannels'], raw)} />
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 rounded-2xl border border-black/[0.07] bg-white/80 p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className={cn('text-xs leading-6', message?.includes('نشد') ? 'text-red-600' : 'text-emerald-700')}>{message ?? (dirty ? 'تغییرات هنوز ذخیره نشده‌اند.' : 'تنظیمات با runtime همگام است.')}</p>
        <button type="button" onClick={save} disabled={!dirty || saving} className="admin-primary-button">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          ذخیره همه تنظیمات
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold text-black/65"><span>{label}</span>{hint && <span dir="ltr" className="truncate text-[11px] font-normal text-black/35">{hint}</span>}</span>{children}</label>
}

function MoneyInput({ value, onChange, suffix, allowEmpty }: { value: number | ''; onChange: (value: string) => void; suffix: string; allowEmpty?: boolean }) {
  return <div className="relative"><input dir="ltr" inputMode="numeric" min={allowEmpty ? undefined : 1} type="number" value={value} onChange={(event) => onChange(event.target.value)} className="admin-input pe-14 tabular-nums" /><span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-black/35">{suffix}</span></div>
}

function PlanNumber({ label, value, onChange, disabled, dark }: { label: string; value: number; onChange: (value: string) => void; disabled?: boolean; dark?: boolean }) {
  return <label className="block"><span className={cn('mb-1.5 block text-[11px] font-medium', dark ? 'text-white/45' : 'text-black/45')}>{label}</span><input dir="ltr" type="number" min={0} inputMode="numeric" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={cn('h-11 w-full rounded-xl border px-3 text-xs tabular-nums outline-none transition-[border-color,box-shadow,background-color] duration-200 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40', dark ? 'border-white/10 bg-white/[0.07] text-white focus:border-white/30 focus:ring-white/10' : 'border-black/[0.08] bg-white text-black focus:border-black/25 focus:ring-black/[0.06]')} /></label>
}
