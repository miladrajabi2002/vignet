'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  CheckCircle2,
  Loader2,
  Package,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type AccessKey = 'productAccessEnabled' | 'orderTrackingEnabled'

export function StoreAccessSettings({
  agentId,
  initialProductAccessEnabled,
  initialOrderTrackingEnabled,
  productCount,
  orderCount,
}: {
  agentId: string
  initialProductAccessEnabled: boolean
  initialOrderTrackingEnabled: boolean
  productCount: number
  orderCount: number
}) {
  const t = useTranslations('agents.storeAccess')
  const [productAccessEnabled, setProductAccessEnabled] = useState(
    initialProductAccessEnabled,
  )
  const [orderTrackingEnabled, setOrderTrackingEnabled] = useState(
    initialOrderTrackingEnabled,
  )
  const [saving, setSaving] = useState<AccessKey | null>(null)
  const [notice, setNotice] = useState<
    { type: 'ok' | 'err'; message: string } | null
  >(null)

  async function updateAccess(key: AccessKey, enabled: boolean) {
    const previous = key === 'productAccessEnabled'
      ? productAccessEnabled
      : orderTrackingEnabled

    if (key === 'productAccessEnabled') {
      setProductAccessEnabled(enabled)
    } else {
      setOrderTrackingEnabled(enabled)
    }

    setSaving(key)
    setNotice(null)
    try {
      const response = await fetch('/api/agents/' + agentId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: enabled }),
      })

      if (!response.ok) {
        throw new Error('Unable to save agent store access')
      }

      setNotice({ type: 'ok', message: t('saved') })
    } catch {
      if (key === 'productAccessEnabled') {
        setProductAccessEnabled(previous)
      } else {
        setOrderTrackingEnabled(previous)
      }
      setNotice({ type: 'err', message: t('saveError') })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-5">
      <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            {t('description')}
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          <AccessRow
            icon={Package}
            title={t('productsTitle')}
            description={t('productsDescription')}
            count={t('productsCount', { count: productCount })}
            enabled={productAccessEnabled}
            pending={saving === 'productAccessEnabled'}
            disabled={saving !== null}
            enabledLabel={t('enabled')}
            disabledLabel={t('disabled')}
            onChange={(enabled) => updateAccess('productAccessEnabled', enabled)}
          />
          <AccessRow
            icon={ShoppingBag}
            title={t('ordersTitle')}
            description={t('ordersDescription')}
            count={t('ordersCount', { count: orderCount })}
            enabled={orderTrackingEnabled}
            pending={saving === 'orderTrackingEnabled'}
            disabled={saving !== null}
            enabledLabel={t('enabled')}
            disabledLabel={t('disabled')}
            onChange={(enabled) => updateAccess('orderTrackingEnabled', enabled)}
          />
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-primary)]">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t('readOnlyTitle')}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            {t('readOnlyDescription')}
          </p>
        </div>
      </aside>

      <div aria-live="polite" aria-atomic="true" className="min-h-6">
        {notice && (
          <p
            role={notice.type === 'err' ? 'alert' : 'status'}
            className={cn(
              'inline-flex items-center gap-2 text-sm',
              notice.type === 'ok' ? 'text-success' : 'text-danger',
            )}
          >
            {notice.type === 'ok' && <CheckCircle2 className="h-4 w-4" />}
            {notice.message}
          </p>
        )}
      </div>
    </div>
  )
}

function AccessRow({
  icon: Icon,
  title,
  description,
  count,
  enabled,
  pending,
  disabled,
  enabledLabel,
  disabledLabel,
  onChange,
}: {
  icon: typeof Package
  title: string
  description: string
  count: string
  enabled: boolean
  pending: boolean
  disabled: boolean
  enabledLabel: string
  disabledLabel: string
  onChange: (enabled: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-base)] p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-primary)]">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            {description}
          </p>
          <span className="mt-2 inline-flex rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
            {count}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {enabled ? enabledLabel : disabledLabel}
        </span>
        <button
          type="button"
          dir="ltr"
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          disabled={disabled}
          onClick={() => onChange(!enabled)}
          className={cn(
            'relative inline-flex h-11 w-[4.5rem] shrink-0 items-center rounded-full border p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-strong)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70',
            enabled
              ? 'border-[var(--text-primary)] bg-[var(--text-primary)]'
              : 'border-[var(--border-default)] bg-[var(--bg-muted)]',
          )}
        >
          <span
            className={cn(
              'grid h-8 w-8 place-items-center rounded-full bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm transition-transform',
              enabled ? 'translate-x-7' : 'translate-x-0',
            )}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          </span>
        </button>
      </div>
    </div>
  )
}
