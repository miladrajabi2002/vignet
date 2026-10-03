'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Save, SlidersHorizontal, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MaterialSelect } from '@/components/ui/material-select'
import { NumberField } from '@/components/admin/number-field'
import { Switch } from '@/components/ui/switch'
import { SaveButton, useSaveState } from '@/components/ui/save-button'
import type { UnderstandingConfig, UnderstandingDomain, UnderstandingMode } from '@/lib/agent/understand/mode'

const MODE_OPTIONS: Array<{ value: UnderstandingMode; label: string; description: string }> = [
  { value: 'on', label: 'فعال', description: 'تصمیم هر نوبت از خوانش تأییدشدهٔ مدل؛ بدون خوانش معتبر، مسیر قدیمی.' },
  { value: 'shadow', label: 'سایه', description: 'مدل می‌خواند و ثبت می‌شود ولی تصمیم همچنان با مسیر قدیمی است.' },
  { value: 'off', label: 'خاموش', description: 'هیچ فراخوانی فهم انجام نمی‌شود؛ فقط مسیر قدیمی.' },
]

const DOMAIN_LABELS: Record<UnderstandingDomain, { label: string; description: string }> = {
  products: { label: 'محصول و مشاوره', description: 'جستجو، «همین»، سؤال دربارهٔ ویژگی، مقایسه و ارزان‌تر' },
  orders: { label: 'سفارش و سبد', description: 'شروع سفارش، تغییر سبد، تأیید، لغو، مشخصات و کد تخفیف' },
  bookings: { label: 'رزرو نوبت', description: 'فقط وقتی مشتری واقعاً نوبت بخواهد وارد رزرو شود' },
  courses: { label: 'دوره‌ها', description: 'ثبت‌نام و سؤال دربارهٔ دوره' },
  restock: { label: 'خبرم کن', description: 'درخواست اطلاع از موجود شدن' },
  tracking: { label: 'پیگیری سفارش', description: 'وضعیت سفارش ثبت‌شده' },
  handoff: { label: 'انتقال به اپراتور', description: 'درخواست انسان و شکایت جدی' },
  state: { label: 'حافظهٔ گفتگو', description: 'هدف فعلی، محصول در حال بحث، شروع موضوع تازه' },
  insights: { label: 'تحلیل مشتری', description: 'رضایت و احتمال خرید از خوانش هر پیام' },
}

type Notice = { tone: 'success' | 'error'; message: string } | null

export function UnderstandingModeForm({
  initial,
  workspaces,
  envMode,
}: {
  initial: UnderstandingConfig
  workspaces: Array<{ id: string; name: string }>
  envMode: UnderstandingMode | null
}) {
  const router = useRouter()
  const saveState = useSaveState()
  const [mode, setMode] = useState<UnderstandingMode>(initial.mode)
  const [domains, setDomains] = useState(initial.domains)
  const [timeoutRaw, setTimeoutRaw] = useState(String(initial.timeoutMs))
  const [overrides, setOverrides] = useState<Record<string, UnderstandingMode>>(initial.workspaces)
  const [picked, setPicked] = useState('')
  const [notice, setNotice] = useState<Notice>(null)

  const names = useMemo(() => new Map(workspaces.map((workspace) => [workspace.id, workspace.name])), [workspaces])
  const timeoutMs = Number(timeoutRaw.replace(/[^\d]/g, ''))
  const dirty = mode !== initial.mode
    || JSON.stringify(domains) !== JSON.stringify(initial.domains)
    || timeoutMs !== initial.timeoutMs
    || JSON.stringify(overrides) !== JSON.stringify(initial.workspaces)
  const addable = workspaces.filter((workspace) => !(workspace.id in overrides))

  async function save() {
    setNotice(null)
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1_500 || timeoutMs > 15_000) {
      setNotice({ tone: 'error', message: 'مهلت باید بین ۱۵۰۰ و ۱۵۰۰۰ میلی‌ثانیه باشد.' })
      return
    }
    saveState.start()
    try {
      const response = await fetch('/api/admin/agent-core', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, domains, timeoutMs, workspaces: overrides }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'UNKNOWN')
      }
      saveState.done()
      setNotice({ tone: 'success', message: 'تنظیمات هسته ذخیره شد؛ حداکثر ظرف ۳۰ ثانیه روی همهٔ پردازش‌ها اعمال می‌شود.' })
      router.refresh()
    } catch (error) {
      saveState.fail()
      const code = error instanceof Error ? error.message : 'UNKNOWN'
      setNotice({
        tone: 'error',
        message: code === 'UNAUTHORIZED' ? 'نشست مدیریت منقضی شده است.' : code === 'INVALID' ? 'مقادیر معتبر نیستند.' : 'ذخیره انجام نشد؛ دوباره تلاش کنید.',
      })
    }
  }

  return (
    <section className="spatial-surface overflow-hidden rounded-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="admin-icon-well"><SlidersHorizontal className="h-4 w-4" aria-hidden="true" /></span>
            <h2 className="ui-h3">حالت اجرای لایهٔ فهم</h2>
          </div>
          <p className="ui-caption mt-2 max-w-2xl">
            هر حوزه جداگانه قابل خاموش شدن است؛ حوزهٔ خاموش همان مسیر قبلی را می‌رود. برای یک کسب‌وکار خاص هم می‌توانید حالت جدا بگذارید.
          </p>
          {envMode && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-control bg-amber-50 px-2.5 py-1 text-[12px] text-amber-800">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
              متغیر محیطی AGENT_UNDERSTANDING_MODE={envMode} روی سرور تنظیم است و بر این تنظیمات مقدم است.
            </p>
          )}
        </div>
        <SaveButton
          state={saveState.state}
          dirty={dirty}
          onClick={save}
          icon={<Save className="h-4 w-4" aria-hidden="true" />}
          label="ذخیره"
        />
      </div>

      <fieldset className="mt-5">
        <legend className="text-[13px] font-medium text-[var(--text-primary)]">حالت کلی</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              aria-pressed={mode === option.value}
              className={cn(
                'rounded-control border p-3 text-start transition-[border-color,background-color] duration-200',
                mode === option.value
                  ? 'border-[var(--accent)] bg-[var(--bg-surface)]'
                  : 'border-[var(--border-default)] bg-white hover:bg-[var(--bg-surface)]',
              )}
            >
              <span className="block text-[13px] font-medium text-[var(--text-primary)]">{option.label}</span>
              <span className="mt-1 block text-[12px] leading-5 text-[var(--text-secondary)]">{option.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-[13px] font-medium text-[var(--text-primary)]">حوزه‌هایی که از فهم مدل تصمیم می‌گیرند</legend>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(DOMAIN_LABELS) as UnderstandingDomain[]).map((domain) => (
            <div key={domain} className="flex items-start justify-between gap-3 rounded-control bg-[var(--bg-surface)] p-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--text-primary)]">{DOMAIN_LABELS[domain].label}</p>
                <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{DOMAIN_LABELS[domain].description}</p>
              </div>
              <Switch
                checked={domains[domain]}
                onChange={(value) => setDomains((current) => ({ ...current, [domain]: value }))}
                aria-label={DOMAIN_LABELS[domain].label}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <div>
          <label htmlFor="understanding-timeout" className="text-[13px] font-medium text-[var(--text-primary)]">مهلت هر فراخوانی فهم</label>
          <NumberField
            id="understanding-timeout"
            value={timeoutRaw}
            onChange={setTimeoutRaw}
            unit="ms"
            ariaLabel="مهلت فراخوانی فهم"
            className="mt-2"
          />
          <p className="ui-caption mt-1.5">بعد از این مهلت همان نوبت با مسیر قبلی جواب می‌گیرد.</p>
        </div>

        <div>
          <p className="text-[13px] font-medium text-[var(--text-primary)]">حالت اختصاصی کسب‌وکارها</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <MaterialSelect
              value={picked}
              onValueChange={setPicked}
              options={addable.map((workspace) => ({ value: workspace.id, label: workspace.name }))}
              placeholder="انتخاب کسب‌وکار"
              ariaLabel="انتخاب کسب‌وکار"
              className="min-w-[220px]"
            />
            <button
              type="button"
              disabled={!picked}
              onClick={() => {
                if (!picked) return
                setOverrides((current) => ({ ...current, [picked]: 'shadow' }))
                setPicked('')
              }}
              className="rounded-control border border-[var(--border-default)] px-3 py-2 text-[13px] disabled:opacity-50"
            >
              افزودن
            </button>
          </div>
          {Object.keys(overrides).length > 0 && (
            <ul className="mt-3 space-y-2">
              {Object.entries(overrides).map(([id, value]) => (
                <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-[var(--bg-surface)] px-3 py-2">
                  <span className="min-w-0 truncate text-[13px]">{names.get(id) ?? id}</span>
                  <div className="flex items-center gap-2">
                    {MODE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setOverrides((current) => ({ ...current, [id]: option.value }))}
                        aria-pressed={value === option.value}
                        className={cn(
                          'rounded-control px-2.5 py-1 text-[12px]',
                          value === option.value ? 'bg-[var(--accent)] text-white' : 'bg-white text-[var(--text-secondary)]',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="حذف"
                      onClick={() => setOverrides((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)))}
                      className="rounded-control p-1.5 text-[var(--text-secondary)] hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className={cn(
            'mt-4 inline-flex items-center gap-1.5 text-[13px]',
            notice.tone === 'success' ? 'text-emerald-700' : 'text-red-600',
          )}
        >
          {notice.tone === 'success'
            ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            : <AlertCircle className="h-4 w-4" aria-hidden="true" />}
          {notice.message}
        </p>
      )}
    </section>
  )
}
