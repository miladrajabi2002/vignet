'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ClipboardList, CreditCard, Loader2, Package, ShoppingBag, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import type { StoreAccessChoice, StoreAccessValues } from '@/lib/agents/store-access-choice'

/**
 * Asked once a store is connected, wherever that happened (setup or the
 * integrations page): what may the agent do with the store? Until the owner
 * answers, the connection's own defaults apply.
 *
 * Renders outside the dashboard message scope too (setup), so the copy lives here.
 */
export function StoreAccessPrompt({
  initial,
  onDone,
  onSkip,
  className,
}: {
  /** Server-loaded state; fetched on mount when omitted. */
  initial?: StoreAccessChoice
  /** Saved, or there was nothing to ask. Defaults to refreshing the page. */
  onDone?: () => void
  /** Shows a "later" button; the question stays open for the integrations page. */
  onSkip?: () => void
  className?: string
}) {
  const fa = useLocale() !== 'en'
  const router = useRouter()
  const [choice, setChoice] = useState<StoreAccessChoice | null>(initial ?? null)
  const [values, setValues] = useState<StoreAccessValues | null>(initial?.values ?? null)
  const [saving, setSaving] = useState(false)
  const [answered, setAnswered] = useState(false)
  const [error, setError] = useState('')
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (initial) return
    let cancelled = false
    fetch('/api/agents/store-access', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StoreAccessChoice | null) => {
        if (cancelled) return
        // Nothing to ask (or the state could not be read): never block the flow.
        if (!data?.pending) {
          doneRef.current?.()
          return
        }
        setChoice(data)
        setValues(data.values)
      })
      .catch(() => { if (!cancelled) doneRef.current?.() })
    return () => { cancelled = true }
  }, [initial])

  async function save() {
    if (!values || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/agents/store-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) throw new Error('SAVE_FAILED')
      setAnswered(true)
      if (onDone) onDone()
      else router.refresh()
    } catch {
      setError(fa ? 'ذخیره انجام نشد؛ دوباره تلاش کنید.' : 'Could not save. Try again.')
      setSaving(false)
    }
  }

  if (answered || (choice && !choice.pending)) return null

  if (!choice || !values) {
    return (
      <div role="status" className={cn('flex items-center justify-center gap-2 py-10 text-[13px] text-[var(--text-muted)]', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {fa ? 'در حال بررسی اتصال فروشگاه…' : 'Checking the store connection…'}
      </div>
    )
  }

  const set = (key: keyof StoreAccessValues, value: boolean) =>
    setValues((current) => (current ? { ...current, [key]: value } : current))
  const captureOn = values.productAccessEnabled && values.orderCaptureEnabled
  const host = choice.storeHost ?? (fa ? 'سایت شما' : 'your site')

  const rows: { key: keyof StoreAccessValues; icon: LucideIcon; title: string; body: string; checked: boolean; locked?: string }[] = [
    {
      key: 'productAccessEnabled',
      icon: Package,
      title: fa ? 'جواب دادن دربارهٔ محصول‌ها' : 'Answer about products',
      body: fa ? 'معرفی، مقایسه، قیمت و موجودی محصول‌های همگام‌شده.' : 'Introduce and compare synced products, with price and stock.',
      checked: values.productAccessEnabled,
    },
    {
      key: 'orderTrackingEnabled',
      icon: ShoppingBag,
      title: fa ? 'پیگیری سفارش مشتری' : 'Track customer orders',
      body: fa ? 'وضعیت سفارش‌های ثبت‌شده در سایت را به مشتری می‌گوید.' : 'Tells customers the status of orders placed on the site.',
      checked: values.orderTrackingEnabled,
    },
    {
      key: 'orderCaptureEnabled',
      icon: ClipboardList,
      title: fa ? 'گرفتن سفارش در چت' : 'Take orders in chat',
      body: fa
        ? 'کالا، تعداد و مشخصات مشتری را در همان گفتگو می‌گیرد و برای اپراتور شما ثبت می‌کند.'
        : 'Collects the item, quantity and customer details in the conversation and files it for your operator.',
      checked: captureOn,
      locked: values.productAccessEnabled ? undefined : (fa ? 'به دسترسی محصول‌ها نیاز دارد.' : 'Needs product access.'),
    },
    ...(choice.checkoutReady
      ? [{
          key: 'payLinkEnabled' as const,
          icon: CreditCard,
          title: fa ? 'پرداخت آنلاین روی سایت' : 'Online payment on your site',
          body: fa
            ? `به‌جای سپردن سفارش به اپراتور، لینک پرداخت روی ${host} را برای مشتری می‌فرستد.`
            : `Instead of handing the order to an operator, sends the customer a payment link on ${host}.`,
          checked: captureOn && values.payLinkEnabled,
          locked: captureOn ? undefined : (fa ? 'به «گرفتن سفارش در چت» نیاز دارد.' : 'Needs “Take orders in chat”.'),
        }]
      : []),
  ]

  return (
    <section className={cn('spatial-surface rounded-card p-4 text-start sm:p-5', className)} aria-labelledby="store-access-prompt-title">
      <h2 id="store-access-prompt-title" className="text-[15px] font-bold text-[var(--text-primary)]">
        {fa ? 'ایجنت با فروشگاه شما چه کارهایی بکند؟' : 'What may the agent do with your store?'}
      </h2>
      <p className="mt-1 text-[12px] leading-6 text-[var(--text-secondary)]">
        {fa
          ? <><bdi dir="ltr">{host}</bdi> وصل است. هر کدام را که نمی‌خواهید خاموش کنید.</>
          : <><bdi dir="ltr">{host}</bdi> is connected. Switch off anything you do not want.</>}
        {choice.agentCount > 1 && (fa
          ? ` برای ${choice.agentCount.toLocaleString('fa-IR')} ایجنت اعمال می‌شود.`
          : ` Applies to ${choice.agentCount} agents.`)}
      </p>

      <div className="mt-4 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-white">
        {rows.map(({ key, icon: Icon, title, body, checked, locked }) => (
          <div key={key} className="flex items-center gap-3 px-3.5 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-primary)]">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold leading-6 text-[var(--text-primary)]">{title}</p>
              <p className="text-[12px] leading-5 text-[var(--text-muted)]">{locked ?? body}</p>
            </div>
            <Switch checked={checked} onChange={(value) => set(key, value)} disabled={saving || Boolean(locked)} aria-label={title} />
          </div>
        ))}
      </div>

      {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-[12rem] flex-1 text-[12px] leading-5 text-[var(--text-muted)]">
          {fa ? 'بعداً از تنظیمات ایجنت، بخش «دسترسی به فروشگاه» قابل تغییر است.' : 'You can change these later in the agent’s store access settings.'}
        </p>
        <div className="flex items-center gap-2">
          {onSkip && (
            <button type="button" onClick={onSkip} disabled={saving} className="inline-flex min-h-11 items-center px-3 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
              {fa ? 'بعداً' : 'Later'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            aria-busy={saving}
            className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-[13px] font-semibold text-white shadow-[var(--shadow-control)] hover:bg-black disabled:cursor-wait disabled:opacity-70"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {fa ? 'ذخیرهٔ دسترسی‌ها' : 'Save access'}
          </button>
        </div>
      </div>
    </section>
  )
}
