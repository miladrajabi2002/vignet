'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Gauge,
  Loader2,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ModelAlias = 'fast' | 'balanced' | 'premium'

type ModelOption = {
  alias: ModelAlias
  name: string
  providerLabel: string
  providerId: string
  description: string
}

type Policy = {
  defaultModel: ModelAlias
  enabledModels: ModelAlias[]
  monthlyBudgetUSD: number | null
}

type Notice = { tone: 'success' | 'error'; message: string } | null

function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    UNAUTHORIZED: 'نشست مدیریت منقضی شده است؛ دوباره وارد پنل شوید.',
    INVALID: 'مقادیر واردشده معتبر نیستند.',
    AT_LEAST_ONE_MODEL: 'حداقل یک مدل باید فعال بماند.',
    DEFAULT_MUST_BE_ENABLED: 'مدل پیش‌فرض باید در فهرست مدل‌های فعال باشد.',
  }
  return messages[code] ?? 'ذخیره تنظیمات انجام نشد. دوباره تلاش کنید.'
}

export function AiModelPolicyForm({
  models,
  initialPolicy,
  currentMonthSpendUSD,
}: {
  models: ModelOption[]
  initialPolicy: Policy
  currentMonthSpendUSD: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [defaultModel, setDefaultModel] = useState(initialPolicy.defaultModel)
  const [enabledModels, setEnabledModels] = useState<ModelAlias[]>(initialPolicy.enabledModels)
  const [budgetEnabled, setBudgetEnabled] = useState(initialPolicy.monthlyBudgetUSD !== null)
  const [budget, setBudget] = useState(
    initialPolicy.monthlyBudgetUSD === null ? '' : String(initialPolicy.monthlyBudgetUSD),
  )
  const [notice, setNotice] = useState<Notice>(null)

  const parsedBudget = Number(budget)
  const budgetValue = budgetEnabled && Number.isFinite(parsedBudget) && parsedBudget > 0
    ? parsedBudget
    : null
  const budgetPercent = budgetValue
    ? Math.min(100, (currentMonthSpendUSD / budgetValue) * 100)
    : 0
  const remainingBudget = budgetValue ? Math.max(0, budgetValue - currentMonthSpendUSD) : null

  const dirty = useMemo(() => {
    const initialEnabled = [...initialPolicy.enabledModels].sort().join(',')
    const currentEnabled = [...enabledModels].sort().join(',')
    return (
      defaultModel !== initialPolicy.defaultModel ||
      initialEnabled !== currentEnabled ||
      budgetEnabled !== (initialPolicy.monthlyBudgetUSD !== null) ||
      budgetValue !== initialPolicy.monthlyBudgetUSD
    )
  }, [budgetEnabled, budgetValue, defaultModel, enabledModels, initialPolicy])

  function toggleModel(alias: ModelAlias) {
    setNotice(null)
    setEnabledModels((current) => {
      if (current.includes(alias)) {
        if (current.length === 1) {
          setNotice({ tone: 'error', message: 'حداقل یک مدل باید فعال بماند.' })
          return current
        }
        const next = current.filter((item) => item !== alias)
        if (defaultModel === alias) setDefaultModel(next[0])
        return next
      }
      return [...current, alias]
    })
  }

  async function savePolicy() {
    setNotice(null)
    if (budgetEnabled && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) {
      setNotice({ tone: 'error', message: 'سقف ماهانه باید یک عدد مثبت دلاری باشد.' })
      return
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/ai-settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            defaultModel,
            enabledModels,
            monthlyBudgetUSD: budgetEnabled ? parsedBudget : null,
          }),
        })
        const body = (await response.json().catch(() => null)) as
          | (Policy & { error?: never })
          | { error?: string }
          | null

        if (!response.ok) {
          throw new Error(body && 'error' in body ? body.error : 'UNKNOWN')
        }

        setNotice({ tone: 'success', message: 'سیاست مدل و سقف هزینه با موفقیت ذخیره شد.' })
        router.refresh()
      } catch (error) {
        setNotice({
          tone: 'error',
          message: errorMessage(error instanceof Error ? error.message : 'UNKNOWN'),
        })
      }
    })
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-zinc-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-zinc-900">سیاست اجرای مدل‌ها</h2>
          </div>
          <p className="mt-1.5 max-w-2xl text-xs leading-6 text-zinc-500">
            مدل پیش‌فرض، مدل‌های قابل استفاده و سقف هزینهٔ ماهانه را مدیریت کنید. این
            تنظیمات فقط aliasهای امن را ذخیره می‌کند و به کلید OpenRouter دسترسی ندارد.
          </p>
        </div>
        <button
          type="button"
          onClick={savePolicy}
          disabled={isPending || !dirty}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : dirty ? (
            <Save className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {isPending ? 'در حال ذخیره…' : dirty ? 'ذخیره تنظیمات' : 'ذخیره‌شده'}
        </button>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-semibold text-zinc-700">مدل‌های مجاز و مدل پیش‌فرض</legend>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {models.map((model) => {
            const enabled = enabledModels.includes(model.alias)
            const isDefault = defaultModel === model.alias
            return (
              <div
                key={model.alias}
                className={cn(
                  'rounded-2xl border p-4 transition-colors',
                  enabled ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-200 bg-white opacity-70',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900">{model.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{model.providerLabel}</p>
                  </div>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleModel(model.alias)}
                      className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
                    />
                    فعال
                  </label>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-6 text-zinc-500">{model.description}</p>
                <code dir="ltr" className="mt-2 block truncate text-left text-[10px] text-zinc-400" title={model.providerId}>
                  {model.providerId}
                </code>
                <label
                  className={cn(
                    'mt-4 flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors',
                    enabled
                      ? 'cursor-pointer border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
                      : 'cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-400',
                  )}
                >
                  <input
                    type="radio"
                    name="default-model"
                    value={model.alias}
                    checked={isDefault}
                    disabled={!enabled}
                    onChange={() => setDefaultModel(model.alias)}
                    className="h-4 w-4 border-zinc-300 accent-zinc-900"
                  />
                  مدل پیش‌فرض
                  {isDefault && <CheckCircle2 className="ms-auto h-4 w-4 text-emerald-600" aria-hidden="true" />}
                </label>
              </div>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 border-t border-zinc-100 pt-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-zinc-700">سقف هزینهٔ ماهانه OpenRouter</p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                پس از رسیدن هزینه واقعی ماه جاری به سقف، درخواست جدید اجرا نمی‌شود.
              </p>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100">
              <input
                type="checkbox"
                checked={budgetEnabled}
                onChange={(event) => {
                  setBudgetEnabled(event.target.checked)
                  if (event.target.checked && !budget) {
                    setBudget(String(Math.max(10, Math.ceil(currentMonthSpendUSD * 1.25))))
                  }
                  setNotice(null)
                }}
                className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
              />
              فعال
            </label>
          </div>
          <label className="mt-3 block">
            <span className="sr-only">سقف هزینه ماهانه به دلار</span>
            <div
              dir="ltr"
              className={cn(
                'flex min-h-11 items-center rounded-xl border bg-white px-3 focus-within:border-zinc-500 focus-within:ring-2 focus-within:ring-zinc-100',
                budgetEnabled ? 'border-zinc-200' : 'border-zinc-100 bg-zinc-50',
              )}
            >
              <span className="text-sm font-semibold text-zinc-400">$</span>
              <input
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                inputMode="decimal"
                value={budget}
                disabled={!budgetEnabled}
                onChange={(event) => {
                  setBudget(event.target.value)
                  setNotice(null)
                }}
                placeholder="100"
                className="h-10 min-w-0 flex-1 bg-transparent px-2 text-left text-sm font-semibold text-zinc-900 outline-none disabled:text-zinc-400"
              />
              <span className="text-[11px] text-zinc-400">USD / month</span>
            </div>
          </label>
        </div>

        <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-zinc-600" aria-hidden="true" />
              <p className="text-xs font-semibold text-zinc-700">مصرف ماه جاری</p>
            </div>
            <bdi dir="ltr" className="font-mono text-sm font-bold text-zinc-900">
              {formatUSD(currentMonthSpendUSD)}
              {budgetValue ? ` / ${formatUSD(budgetValue)}` : ''}
            </bdi>
          </div>
          {budgetValue ? (
            <>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-valuemin={0} aria-valuemax={budgetValue} aria-valuenow={currentMonthSpendUSD}>
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-200',
                    budgetPercent >= 90 ? 'bg-red-500' : budgetPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                <span>{budgetPercent.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪ مصرف شده</span>
                <span>{formatUSD(remainingBudget ?? 0)} باقی‌مانده</span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs leading-6 text-zinc-500">
              سقف غیرفعال است؛ درخواست‌ها بر اساس هزینه ماهانه متوقف نمی‌شوند.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 min-h-6" aria-live="polite">
        {notice && (
          <p
            className={cn(
              'flex items-center gap-2 text-xs font-medium',
              notice.tone === 'success' ? 'text-emerald-700' : 'text-red-700',
            )}
          >
            {notice.tone === 'success' ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
            )}
            {notice.message}
          </p>
        )}
      </div>
    </section>
  )
}
