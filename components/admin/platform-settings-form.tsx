'use client'

import { useState } from 'react'
import { Save, ShieldCheck, Volume2, WalletCards } from 'lucide-react'
import type { PlatformCommercialConfig } from '@/lib/platform/commercial-config'
import { cn } from '@/lib/utils'
import { MaterialSelect } from '@/components/ui/material-select'
import { SaveButton, useSaveState } from '@/components/ui/save-button'
import { AGENT_MODELS, type ModelAlias } from '@/lib/ai/models'

type NumberPath =
  | ['trialCreditIRR']
  | ['financeUsdToIRR']
  | ['sttPricePerMinuteIRR']
  | ['visionPricePerImageIRR']
  | ['replyPricesIRR', keyof PlatformCommercialConfig['replyPricesIRR']]
  | ['plans', keyof PlatformCommercialConfig['plans'], keyof PlatformCommercialConfig['plans']['TRIAL']]

const PLAN_META = {
  TRIAL: { title: 'آزمایشی', hint: 'یک ماه تجربه محصول', locked: true },
  STARTER: { title: 'استارتر', hint: 'شروع کسب‌وکار کوچک', locked: false },
  PRO: { title: 'حرفه‌ای', hint: 'پیشنهاد اصلی ویجنت', locked: false },
  BUSINESS: { title: 'بیزینس', hint: 'ظرفیت عملیات بزرگ', locked: false },
} as const

const MODEL_META = Object.fromEntries(
  AGENT_MODELS.map((model) => [model.id, `${model.name} · ${model.provider}`]),
) as Record<ModelAlias, string>

/**
 * Money inputs are presented in Toman across the whole admin panel. The
 * database keeps integer Rials, so every IRR-backed field is divided by 10
 * for display and multiplied back on save (TOMAN_SCALE).
 */
const TOMAN_SCALE = 10

export function PlatformSettingsForm({ initial }: { initial: PlatformCommercialConfig }) {
  const [value, setValue] = useState(initial)
  const saveState = useSaveState()
  const [message, setMessage] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  function setField<K extends keyof PlatformCommercialConfig>(key: K, next: PlatformCommercialConfig[K]) {
    setValue((current) => ({ ...current, [key]: next }))
    setDirty(true)
    setMessage(null)
  }

  /**
   * @param scale multiplier applied to the parsed input before storing
   *              (Toman → Rial uses TOMAN_SCALE = 10; plain counts use 1).
   */
  function setNumber(path: NumberPath, raw: string, scale = 1) {
    const empty = raw === ''
    const parsed = empty ? 0 : Math.max(0, Math.round(Number(raw) * scale))
    if (!empty && !Number.isFinite(parsed)) return
    setValue((current) => {
      if (path[0] === 'trialCreditIRR') return { ...current, trialCreditIRR: parsed }
      if (path[0] === 'financeUsdToIRR') return { ...current, financeUsdToIRR: empty ? null : parsed }
      if (path[0] === 'sttPricePerMinuteIRR') return { ...current, sttPricePerMinuteIRR: parsed }
      if (path[0] === 'visionPricePerImageIRR') return { ...current, visionPricePerImageIRR: parsed }
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
    saveState.start()
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
      saveState.done()
      setMessage('تنظیمات ذخیره شد و از درخواست بعدی روی سیستم اعمال می‌شود.')
    } catch {
      saveState.fail()
      setMessage('ذخیره انجام نشد. مقدارهای واردشده را بررسی و دوباره تلاش کنید.')
    }
  }

  return (
    <div className="space-y-5">
      <section className="spatial-surface overflow-hidden rounded-card">
        <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--signal-strong)]"><ShieldCheck className="h-4 w-4" /> سیاست runtime پلتفرم</div>
            <h2 className="ui-h2 mt-1.5">مدل‌های صوتی و حریم خصوصی</h2>
            <p className="ui-caption">کلیدها و secretها همچنان فقط در ENV می‌مانند؛ اینجا فقط سیاست‌های امن و قابل تغییر ذخیره می‌شوند.</p>
          </div>
          <SaveButton state={saveState.state} dirty={dirty} onClick={save} icon={<Save className="h-4 w-4" />} label="ذخیره تغییرات" />
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          <div className="rounded-control bg-[var(--bg-surface)] px-4 py-3">
            <span className="text-[13px] font-bold text-[var(--text-primary)]">مدل تبدیل صدا به متن</span>
            <code dir="ltr" className="mt-2 block break-all text-left text-xs font-semibold text-[var(--text-secondary)]">{value.sttModel}</code>
            <span className="mt-1 block text-[12px] leading-5 text-[var(--text-muted)]">مدل ثابت و چندزبانه از طریق OpenRouter</span>
          </div>
          <div className="rounded-control bg-[var(--bg-surface)] px-4 py-3">
            <span className="text-[13px] font-bold text-[var(--text-primary)]">مدل توصیف عکس مشتری</span>
            <code dir="ltr" className="mt-2 block break-all text-left text-xs font-semibold text-[var(--text-secondary)]">{value.visionModel}</code>
            <span className="mt-1 block text-[12px] leading-5 text-[var(--text-muted)]">مدل ثابت بینایی؛ فقط وقتی «توصیف عکس» برای ایجنت روشن باشد مصرف می‌شود</span>
          </div>
          <Field label="تعرفه هر دقیقه تبدیل ویس" hint="پیش‌فرض: ۱۰ تومان در دقیقه؛ معادل ۱۰۰ تومان برای ۱۰ دقیقه">
            <MoneyInput value={toToman(value.sttPricePerMinuteIRR)} onChange={(raw) => setNumber(['sttPricePerMinuteIRR'], raw, TOMAN_SCALE)} suffix="تومان" />
          </Field>
          <Field label="تعرفه هر عکس توصیف‌شده" hint="پیش‌فرض: ۸۰ تومان برای هر عکس؛ فقط ایجنت‌های با توصیف عکس روشن">
            <MoneyInput value={toToman(value.visionPricePerImageIRR)} onChange={(raw) => setNumber(['visionPricePerImageIRR'], raw, TOMAN_SCALE)} suffix="تومان" />
          </Field>
          <Field label="اولویت انتخاب Provider" hint="در تمام درخواست‌های OpenRouter">
            <MaterialSelect value={value.providerSort} onValueChange={(next) => setField('providerSort', next as PlatformCommercialConfig['providerSort'])} ariaLabel="اولویت انتخاب Provider" buttonClassName="admin-input" options={[{ value: 'price', label: 'کمترین قیمت' }, { value: 'latency', label: 'کمترین تأخیر' }, { value: 'throughput', label: 'بیشترین توان پردازش' }]} />
          </Field>
          <label className="flex min-h-[76px] cursor-pointer items-center justify-between gap-4 self-start rounded-control bg-[var(--bg-surface)] px-4 py-3">
            <div><span className="text-[13px] font-bold text-[var(--text-primary)]">Zero Data Retention</span><span className="mt-1 block text-[12px] text-[var(--text-muted)]">عدم نگهداری داده توسط Provider</span></div>
            <input type="checkbox" checked={value.zeroDataRetention} onChange={(event) => setField('zeroDataRetention', event.target.checked)} className="peer sr-only" />
            <span className="relative h-7 w-12 shrink-0 rounded-full bg-black/15 transition-colors peer-checked:bg-[#111] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus-ring)] peer-focus-visible:ring-offset-2 after:absolute after:start-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" />
          </label>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="spatial-surface rounded-card p-4 sm:p-6">
          <div className="flex items-center gap-3"><span className="admin-icon-well"><Volume2 className="h-4 w-4" /></span><div><h2 className="ui-h3 !leading-6">تعرفه هر پاسخ موفق</h2><p className="text-[12px] text-[var(--text-muted)]">همه مبالغ به تومان وارد می‌شوند.</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(Object.keys(MODEL_META) as Array<keyof typeof MODEL_META>).map((model) => (
              <Field key={model} label={MODEL_META[model]} hint={model}>
                <MoneyInput value={toToman(value.replyPricesIRR[model])} onChange={(raw) => setNumber(['replyPricesIRR', model], raw, TOMAN_SCALE)} suffix="تومان" />
              </Field>
            ))}
          </div>
        </div>
        <div className="spatial-surface rounded-card p-4 sm:p-6">
          <div className="flex items-center gap-3"><span className="admin-icon-well"><WalletCards className="h-4 w-4" /></span><div><h2 className="ui-h3 !leading-6">اعتبار و نرخ مالی</h2><p className="text-[12px] text-[var(--text-muted)]">برای ثبت‌نام جدید و محاسبه سود تلفیقی</p></div></div>
          <div className="mt-5 space-y-4">
            <Field label="اعتبار هدیه ماه آزمایشی" hint="به تومان">
              <MoneyInput value={toToman(value.trialCreditIRR)} onChange={(raw) => setNumber(['trialCreditIRR'], raw, TOMAN_SCALE)} suffix="تومان" />
            </Field>
            <Field label="نرخ هر دلار آمریکا" hint="برای گزارش سود؛ خالی یعنی نمایش ندادن سود تلفیقی">
              <MoneyInput value={value.financeUsdToIRR == null ? '' : toToman(value.financeUsdToIRR)} onChange={(raw) => setNumber(['financeUsdToIRR'], raw, TOMAN_SCALE)} suffix="تومان" allowEmpty />
            </Field>
          </div>
        </div>
      </section>

      <section className="spatial-surface rounded-card p-4 sm:p-6">
        <div><h2 className="ui-h2">پلن‌ها و ظرفیت سرویس</h2><p className="ui-caption">قیمت، اعتبار هدیه و سقف کانال، محصول، سفارش و مشتری از همین تنظیمات خوانده می‌شود. قیمت‌ها به تومان هستند؛ تعرفه هر پاسخ در همه پلن‌ها ثابت و تعداد ایجنت نامحدود است.</p></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(Object.keys(PLAN_META) as Array<keyof typeof PLAN_META>).map((plan) => {
            const meta = PLAN_META[plan]
            const item = value.plans[plan]
            return (
              <article key={plan} className={cn('rounded-card border p-4 sm:p-5', plan === 'PRO' ? 'border-[#111] bg-[#111] text-white' : 'border-transparent bg-[var(--bg-surface)] text-[var(--text-primary)]')}>
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{meta.title}</p><p className={cn('mt-1 text-[12px]', plan === 'PRO' ? 'text-white/60' : 'text-[var(--text-muted)]')}>{meta.hint}</p></div><span className={cn('rounded-full px-2.5 py-1 text-[12px] font-bold', plan === 'PRO' ? 'bg-white text-black' : 'bg-white text-[var(--text-secondary)] ring-1 ring-black/[0.06]')}>{plan}</span></div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <PlanNumber label="قیمت ماهانه (تومان)" value={toTomanNum(item.priceIRR)} disabled={meta.locked} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'priceIRR'], raw, TOMAN_SCALE)} />
                  <PlanNumber label="قیمت دلاری" value={item.priceUSD} disabled={meta.locked} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'priceUSD'], raw)} />
                  <PlanNumber label="اعتبار هدیه (تومان)" value={toTomanNum(item.includedCreditIRR)} disabled={meta.locked} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'includedCreditIRR'], raw, TOMAN_SCALE)} />
                  <PlanNumber label="حداکثر اتصال کانال" value={item.maxChannels} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'maxChannels'], raw)} />
                  <PlanNumber label="حداکثر محصول" value={item.maxProducts} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'maxProducts'], raw)} />
                  <PlanNumber label="حداکثر سفارش" value={item.maxOrders} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'maxOrders'], raw)} />
                  <PlanNumber label="حداکثر مشتری" value={item.maxCustomers} dark={plan === 'PRO'} onChange={(raw) => setNumber(['plans', plan, 'maxCustomers'], raw)} />
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <div className="spatial-surface flex flex-col-reverse gap-3 rounded-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className={cn('text-xs leading-6', message?.includes('نشد') ? 'text-[var(--danger-ink)]' : dirty ? 'text-[var(--warn-ink)]' : 'text-[var(--ok-ink)]')}>{message ?? (dirty ? 'تغییرات هنوز ذخیره نشده‌اند.' : 'تنظیمات با runtime همگام است.')}</p>
        <SaveButton state={saveState.state} dirty={dirty} onClick={save} icon={<Save className="h-4 w-4" />} label="ذخیره همه تنظیمات" />
      </div>
    </div>
  )
}

/** Rial (integer) → Toman for input display; empty stays empty. */
function toToman(irr: number | null | undefined): number | '' {
  if (irr === null || irr === undefined) return ''
  return Math.round(irr / 10)
}

/** Rial (integer) → Toman for non-nullable plan fields. */
function toTomanNum(irr: number): number {
  return Math.round(irr / 10)
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  // Shared field anatomy: label, control, then the hint on its own line.
  return <label className="block"><span className="ui-field-label">{label}</span>{children}{hint && <span className="ui-field-hint block"><bdi>{hint}</bdi></span>}</label>
}

function MoneyInput({ value, onChange, suffix, allowEmpty }: { value: number | ''; onChange: (value: string) => void; suffix: string; allowEmpty?: boolean }) {
  return <div className="relative"><input dir="ltr" inputMode="numeric" min={allowEmpty ? undefined : 1} type="number" value={value} onChange={(event) => onChange(event.target.value)} className="admin-input pe-14 tabular-nums" /><span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[12px] text-[var(--text-muted)]">{suffix}</span></div>
}

function PlanNumber({ label, value, onChange, disabled, dark }: { label: string; value: number; onChange: (value: string) => void; disabled?: boolean; dark?: boolean }) {
  return <label className="block"><span className={cn('mb-1.5 block text-[12px] font-medium', dark ? 'text-white/60' : 'text-[var(--text-muted)]')}>{label}</span><input dir="ltr" type="number" min={0} inputMode="numeric" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={cn('h-11 w-full rounded-xl border px-3 text-xs tabular-nums outline-none transition-[border-color,box-shadow,background-color] duration-200 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40', dark ? 'border-white/10 bg-white/[0.07] text-white focus:border-white/30 focus:ring-white/10' : 'border-black/[0.08] bg-white text-black focus:border-black/25 focus:ring-black/[0.06]')} /></label>
}
