'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Gauge,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MaterialSelect } from '@/components/ui/material-select'
import { Switch } from '@/components/ui/switch'
import { SaveButton, useSaveState } from '@/components/ui/save-button'
import type { ModelAlias } from '@/lib/ai/models'

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
  trialModel: ModelAlias
  vigentoModel: ModelAlias
  providerModels: Partial<Record<ModelAlias, string>>
  monthlyBudgetUSD: number | null
}

type Notice = { tone: 'success' | 'error'; message: string } | null

function formatUSD(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
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
  const saveState = useSaveState()
  const [defaultModel, setDefaultModel] = useState(initialPolicy.defaultModel)
  const [enabledModels, setEnabledModels] = useState<ModelAlias[]>(initialPolicy.enabledModels)
  const [trialModel, setTrialModel] = useState<ModelAlias>(initialPolicy.trialModel)
  const [vigentoModel, setVigentoModel] = useState<ModelAlias>(initialPolicy.vigentoModel)
  const [providerModels, setProviderModels] = useState<Partial<Record<ModelAlias, string>>>(
    initialPolicy.providerModels,
  )
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
    const initialProviders = JSON.stringify(initialPolicy.providerModels)
    const currentProviders = JSON.stringify(providerModels)
    return (
      defaultModel !== initialPolicy.defaultModel ||
      trialModel !== initialPolicy.trialModel ||
      vigentoModel !== initialPolicy.vigentoModel ||
      initialEnabled !== currentEnabled ||
      initialProviders !== currentProviders ||
      budgetEnabled !== (initialPolicy.monthlyBudgetUSD !== null) ||
      budgetValue !== initialPolicy.monthlyBudgetUSD
    )
  }, [budgetEnabled, budgetValue, defaultModel, enabledModels, initialPolicy, providerModels, trialModel, vigentoModel])

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

    saveState.start()
    await (async () => {
      try {
        const response = await fetch('/api/admin/ai-settings', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            defaultModel,
            enabledModels,
            trialModel,
            vigentoModel,
            providerModels,
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

        saveState.done()
        setNotice({ tone: 'success', message: 'سیاست مدل و سقف هزینه با موفقیت ذخیره شد.' })
        router.refresh()
      } catch (error) {
        saveState.fail()
        setNotice({
          tone: 'error',
          message: errorMessage(error instanceof Error ? error.message : 'UNKNOWN'),
        })
      }
    })()
  }

  return (
    <section className="spatial-surface overflow-hidden rounded-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="admin-icon-well"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
            <h2 className="ui-h3">سیاست اجرای مدل‌ها</h2>
          </div>
          <p className="ui-caption mt-2 max-w-2xl">
            مدل پیش‌فرض، مدل‌های قابل استفاده و سقف هزینهٔ ماهانه را مدیریت کنید. این
            تنظیمات فقط aliasهای امن را ذخیره می‌کند و به کلید OpenRouter دسترسی ندارد.
          </p>
        </div>
        <SaveButton
          state={saveState.state}
          dirty={dirty}
          onClick={savePolicy}
          icon={<Save className="h-4 w-4" aria-hidden="true" />}
          label="ذخیره تنظیمات"
        />
      </div>

      <fieldset className="mt-5">
        <legend className="text-[13px] font-medium text-[var(--text-primary)]">مدل‌های مجاز و مدل پیش‌فرض</legend>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {models.map((model) => {
            const enabled = enabledModels.includes(model.alias)
            const isDefault = defaultModel === model.alias
            return (
              <div
                key={model.alias}
                className={cn(
                  'rounded-control border p-3.5 transition-[border-color,background-color] duration-200',
                  enabled ? 'border-transparent bg-[var(--bg-surface)]' : 'border-dashed border-[var(--border-default)] bg-white',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate whitespace-nowrap text-[13px] font-bold text-[var(--text-primary)]" title={model.name}>{model.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{model.providerLabel}</p>
                  </div>
                  <span className="flex min-h-11 shrink-0 items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                    {enabled ? 'فعال' : 'غیرفعال'}
                    <Switch checked={enabled} onChange={() => toggleModel(model.alias)} aria-label={`فعال بودن ${model.name}`} />
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">{model.description}</p>
                <label className="mt-2 block">
                  <span className="sr-only">OpenRouter model id</span>
                  <input
                    dir="ltr"
                    value={providerModels[model.alias] ?? model.providerId}
                    onChange={(event) => setProviderModels((current) => ({ ...current, [model.alias]: event.target.value }))}
                    className="input min-h-10 px-3 py-1.5 text-left font-mono text-[12px] text-[var(--text-secondary)]"
                    aria-label={`OpenRouter model id for ${model.name}`}
                  />
                </label>
                <label
                  className={cn(
                    'mt-3 flex min-h-11 items-center gap-2 rounded-control border px-3 text-xs font-medium transition-colors',
                    !enabled
                      ? 'cursor-not-allowed border-[var(--border-subtle)] text-[var(--text-hint)]'
                      : isDefault
                        ? 'cursor-pointer border-[var(--signal-border)] bg-[var(--signal-soft)] text-[var(--signal-strong)]'
                        : 'cursor-pointer border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:border-[var(--border-hover)]',
                  )}
                >
                  <input
                    type="radio"
                    name="default-model"
                    value={model.alias}
                    checked={isDefault}
                    disabled={!enabled}
                    onChange={() => setDefaultModel(model.alias)}
                    className="h-4 w-4 border-[var(--border-hover)] accent-[#111]"
                  />
                  مدل پیش‌فرض
                  {isDefault && <CheckCircle2 className="ms-auto h-4 w-4" aria-hidden="true" />}
                </label>
              </div>
            )
          })}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-control bg-[var(--bg-surface)] p-3.5">
        <label className="block text-[13px] font-medium text-[var(--text-primary)]">
          مدل فعال پلن آزمایشی
          <MaterialSelect
            value={trialModel}
            onValueChange={(value) => setTrialModel(value as ModelAlias)}
            ariaLabel="مدل فعال پلن آزمایشی"
            className="mt-2"
            options={models.map((model) => ({ value: model.alias, label: model.name }))}
          />
          <span className="mt-1 block text-[12px] font-normal leading-5 text-[var(--text-muted)]">
            این مدل مستقل از فعال/غیرفعال بودن مدل‌های پلن‌های پولی انتخاب می‌شود؛ بقیه مدل‌ها در پلن آزمایشی بسته نمایش داده می‌شوند.
          </span>
        </label>
      </div>
      <div className="rounded-control bg-[var(--signal-soft)] p-3.5">
        <label className="block text-[13px] font-medium text-[var(--text-primary)]">
          مدل اختصاصی ویجنتو ادمین
          <MaterialSelect
            value={vigentoModel}
            onValueChange={(value) => setVigentoModel(value as ModelAlias)}
            ariaLabel="مدل اختصاصی ویجنتو ادمین"
            className="mt-2"
            options={models.map((model) => ({
              value: model.alias,
              label: `${model.name} · ${providerModels[model.alias] ?? model.providerId}`,
            }))}
          />
          <span className="mt-1 block text-[12px] font-normal leading-5 text-[var(--text-secondary)]">
            فقط برای دستیار مدیریتی /admin/vigento استفاده می‌شود و از مدل پیش‌فرض کاربران مستقل است.
          </span>
        </label>
      </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--border-subtle)] pt-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-[var(--text-primary)]">سقف هزینهٔ ماهانه OpenRouter</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                پس از رسیدن هزینه واقعی ماه جاری به سقف، درخواست جدید اجرا نمی‌شود.
              </p>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
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
                className="h-4 w-4 rounded border-[var(--border-hover)] accent-[#111]"
              />
              فعال
            </label>
          </div>
          <label className="mt-3 block">
            <span className="sr-only">سقف هزینه ماهانه به دلار</span>
            <div
              dir="ltr"
              className={cn(
                'flex min-h-11 items-center rounded-control border bg-white px-3 focus-within:border-[var(--focus-field)] focus-within:shadow-[0_0_0_3px_var(--focus-field-halo)]',
                budgetEnabled ? 'border-[rgba(17,17,17,0.16)]' : 'border-transparent bg-[var(--bg-muted)]',
              )}
            >
              <span className="text-sm font-semibold text-[var(--text-muted)]">$</span>
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
                className="h-10 min-w-0 flex-1 bg-transparent px-2 text-left text-sm font-semibold text-[var(--text-primary)] outline-none disabled:text-[var(--text-muted)]"
              />
              <span className="text-[12px] text-[var(--text-muted)]">دلار در ماه</span>
            </div>
          </label>
        </div>

        <div className="rounded-control bg-[var(--bg-surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
              <p className="text-xs font-semibold text-[var(--text-secondary)]">مصرف ماه جاری</p>
            </div>
            <bdi dir="ltr" className="font-mono text-sm font-bold text-[var(--text-primary)]">
              {formatUSD(currentMonthSpendUSD)}
              {budgetValue ? ` / ${formatUSD(budgetValue)}` : ''}
            </bdi>
          </div>
          {budgetValue ? (
            <>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuemin={0} aria-valuemax={budgetValue} aria-valuenow={currentMonthSpendUSD}>
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-200',
                    budgetPercent >= 90 ? 'bg-red-500' : budgetPercent >= 70 ? 'bg-amber-500' : 'bg-[var(--signal)]',
                  )}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-[var(--text-muted)]">
                <span>{budgetPercent.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪ مصرف شده</span>
                <span>{formatUSD(remainingBudget ?? 0)} باقی‌مانده</span>
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs leading-6 text-[var(--text-muted)]">
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
              notice.tone === 'success' ? 'text-[var(--ok-ink)]' : 'text-[var(--danger-ink)]',
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
