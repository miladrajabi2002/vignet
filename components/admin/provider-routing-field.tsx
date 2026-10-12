'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, RotateCcw, X } from 'lucide-react'
import { MaterialSelect } from '@/components/ui/material-select'
import {
  DEFAULT_PROVIDER_ORDERS,
  MAX_PROVIDER_ORDER,
  PROVIDER_BENCHMARKS,
  isProviderSlug,
  type ProviderRouting,
  type ProviderSort,
} from '@/lib/ai/provider-routing'

const ICON_BUTTON =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-35'

const seconds = (ms: number) => (ms / 1000).toLocaleString('fa-IR', { maximumFractionDigits: 1 })

/**
 * Provider routing of the reply models: a curated order per model (best
 * first, the next one when a provider fails) or one of OpenRouter's own sorts.
 */
export function ProviderRoutingField({
  value,
  onChange,
  models,
}: {
  value: ProviderRouting
  onChange: (next: ProviderRouting) => void
  models: Array<{ id: string; label: string }>
}) {
  const setOrder = (model: string, order: string[]) => onChange({ ...value, orders: { ...value.orders, [model]: order } })

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="ui-field-label">روش انتخاب Provider</span>
          <MaterialSelect
            value={value.mode}
            onValueChange={(next) => onChange({ ...value, mode: next === 'sort' ? 'sort' : 'order' })}
            ariaLabel="روش انتخاب Provider"
            buttonClassName="admin-input"
            options={[
              { value: 'order', label: 'فهرست نوبتی (پیشنهادی)' },
              { value: 'sort', label: 'انتخاب خودکار OpenRouter' },
            ]}
          />
          <span className="ui-field-hint block">
            {value.mode === 'order'
              ? 'هر درخواست به اولین Provider فهرست می‌رود؛ اگر جواب نداد به بعدی، و بعد از فهرست به بقیهٔ Providerها.'
              : 'OpenRouter خودش بر اساس معیار روبه‌رو انتخاب می‌کند و فهرست‌های زیر استفاده نمی‌شوند.'}
          </span>
        </label>
        <label className="block">
          <span className="ui-field-label">معیار انتخاب خودکار</span>
          <MaterialSelect
            value={value.sort}
            onValueChange={(next) => onChange({ ...value, sort: next as ProviderSort })}
            ariaLabel="معیار انتخاب خودکار"
            buttonClassName="admin-input"
            options={[
              { value: 'price', label: 'کمترین قیمت' },
              { value: 'latency', label: 'کمترین تأخیر تا اولین کلمه' },
              { value: 'throughput', label: 'بیشترین سرعت تولید' },
            ]}
          />
          <span className="ui-field-hint block">برای حالت خودکار و مدل‌هایی که فهرست ندارند (مثل توصیف عکس).</span>
        </label>
      </div>

      {value.mode === 'order' && (
        <div className="grid gap-4 xl:grid-cols-2">
          {models.map((model) => (
            <ProviderOrderList
              key={model.id}
              model={model}
              order={value.orders[model.id] ?? []}
              onChange={(order) => setOrder(model.id, order)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProviderOrderList({
  model,
  order,
  onChange,
}: {
  model: { id: string; label: string }
  order: string[]
  onChange: (order: string[]) => void
}) {
  const [custom, setCustom] = useState('')
  const benchmarks = PROVIDER_BENCHMARKS[model.id] ?? []
  const measured = (slug: string) => benchmarks.find((row) => row.slug === slug)
  const available = benchmarks.filter((row) => !order.includes(row.slug))
  const full = order.length >= MAX_PROVIDER_ORDER
  const customSlug = custom.trim().toLowerCase()
  const customValid = isProviderSlug(customSlug) && !order.includes(customSlug)
  const defaults = DEFAULT_PROVIDER_ORDERS[model.id] ?? []
  const isDefault = defaults.length === order.length && defaults.every((slug, index) => order[index] === slug)

  const move = (index: number, by: number) => {
    const next = [...order]
    const [slug] = next.splice(index, 1)
    next.splice(index + by, 0, slug)
    onChange(next)
  }

  return (
    <div className="rounded-control bg-[var(--bg-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[13px] font-bold text-[var(--text-primary)]">{model.label}</span>
          <code dir="ltr" className="mt-1 block break-all text-left text-xs text-[var(--text-muted)]">{model.id}</code>
        </div>
        <button
          type="button"
          className={ICON_BUTTON}
          disabled={isDefault}
          onClick={() => onChange(defaults)}
          aria-label={`بازگشت فهرست ${model.label} به پیش‌فرض`}
          title="بازگشت به فهرست پیش‌فرض"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {order.length === 0 ? (
        <p className="mt-3 text-[12px] leading-5 text-[var(--text-muted)]">فهرست خالی است؛ این مدل با انتخاب خودکار OpenRouter پاسخ می‌دهد.</p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {order.map((slug, index) => {
            const row = measured(slug)
            return (
              <li key={slug} className="flex items-center gap-2 rounded-control bg-white px-2.5 py-1.5">
                <span className="w-5 shrink-0 text-center text-[12px] font-bold text-[var(--text-muted)]">{(index + 1).toLocaleString('fa-IR')}</span>
                <div className="min-w-0 flex-1">
                  <code dir="ltr" className="block truncate text-left text-[13px] font-semibold text-[var(--text-primary)]">{slug}</code>
                  <span className="block text-[11px] leading-4 text-[var(--text-muted)]">
                    {row
                      ? <>حدود {seconds(row.medianMs)} ثانیه · <bdi dir="ltr">${row.costUSD.toFixed(5)}</bdi> هر درخواست{row.accuracy ? <> · دقت {row.accuracy.toLocaleString('fa-IR')}٪</> : null}</>
                      : 'اندازه‌گیری نشده'}
                  </span>
                </div>
                <button type="button" className={ICON_BUTTON} disabled={index === 0} onClick={() => move(index, -1)} aria-label={`بالا بردن ${slug}`}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" className={ICON_BUTTON} disabled={index === order.length - 1} onClick={() => move(index, 1)} aria-label={`پایین بردن ${slug}`}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" className={ICON_BUTTON} onClick={() => onChange(order.filter((item) => item !== slug))} aria-label={`حذف ${slug}`}><X className="h-4 w-4" /></button>
              </li>
            )
          })}
        </ol>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MaterialSelect
          value=""
          onValueChange={(slug) => { if (slug && !full) onChange([...order, slug]) }}
          ariaLabel={`افزودن Provider به فهرست ${model.label}`}
          buttonClassName="admin-input"
          placeholder={full ? 'فهرست پر است' : available.length ? 'افزودن از اندازه‌گیری‌شده‌ها' : 'همه اضافه شده‌اند'}
          options={full ? [] : available.map((row) => ({
            value: row.slug,
            label: row.slug,
            description: `حدود ${seconds(row.medianMs)} ثانیه · $${row.costUSD.toFixed(5)}${row.accuracy ? ` · دقت ${row.accuracy.toLocaleString('fa-IR')}٪` : ''}`,
          }))}
        />
        <div className="flex items-center gap-2">
          <input
            dir="ltr"
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              if (customValid && !full) { onChange([...order, customSlug]); setCustom('') }
            }}
            placeholder="provider/variant"
            aria-label={`نشانهٔ Provider دلخواه برای ${model.label}`}
            className="admin-input min-w-0 flex-1 text-left text-[13px]"
          />
          <button
            type="button"
            className={ICON_BUTTON}
            disabled={!customValid || full}
            onClick={() => { onChange([...order, customSlug]); setCustom('') }}
            aria-label="افزودن Provider دلخواه"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
