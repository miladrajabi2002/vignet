'use client'

import { useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  BellRing,
  CheckCircle2,
  Hourglass,
  Truck,
  ClipboardList,
  Package,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SwitchCard } from '@/components/ui/switch'
import { PaymentMethodPicker } from '@/components/payments/payment-method-picker'

type AccessKey = 'productAccessEnabled' | 'orderTrackingEnabled' | 'orderCaptureEnabled' | 'restockAlertsEnabled' | 'payLinkEnabled' | 'orderUpdatesEnabled' | 'cartHoldEnabled'

export function StoreAccessSettings({
  agentId,
  initialProductAccessEnabled,
  initialOrderTrackingEnabled,
  initialOrderCaptureEnabled,
  initialRestockAlertsEnabled,
  initialPayLinkEnabled,
  initialCardPayEnabled,
  gatewayReady,
  initialOrderUpdatesEnabled,
  initialCartHoldEnabled,
  checkoutStore,
  productCount,
  orderCount,
}: {
  agentId: string
  initialProductAccessEnabled: boolean
  initialOrderTrackingEnabled: boolean
  initialOrderCaptureEnabled: boolean
  initialRestockAlertsEnabled: boolean
  initialPayLinkEnabled: boolean
  initialCardPayEnabled: boolean
  /** The payment gateway is on and has an active card. */
  gatewayReady: boolean
  initialOrderUpdatesEnabled: boolean
  initialCartHoldEnabled: boolean
  /** Connected WooCommerce store; `ready` once its plugin supports payment links. */
  checkoutStore: { host: string; ready: boolean } | null
  productCount: number
  orderCount: number
}) {
  const t = useTranslations('agents.storeAccess')
  const numberLocale = useLocale() === 'en' ? 'en-US' : 'fa-IR'
  const [productAccessEnabled, setProductAccessEnabled] = useState(
    initialProductAccessEnabled,
  )
  const [orderTrackingEnabled, setOrderTrackingEnabled] = useState(
    initialOrderTrackingEnabled,
  )
  const [orderCaptureEnabled, setOrderCaptureEnabled] = useState(initialOrderCaptureEnabled)
  const [restockAlertsEnabled, setRestockAlertsEnabled] = useState(initialRestockAlertsEnabled)
  const [payLinkEnabled, setPayLinkEnabled] = useState(initialPayLinkEnabled)
  const [cardPayEnabled, setCardPayEnabled] = useState(initialCardPayEnabled)
  const [orderUpdatesEnabled, setOrderUpdatesEnabled] = useState(initialOrderUpdatesEnabled)
  const [cartHoldEnabled, setCartHoldEnabled] = useState(initialCartHoldEnabled)
  const [saving, setSaving] = useState<AccessKey | null>(null)
  const [notice, setNotice] = useState<
    { type: 'ok' | 'err'; message: string } | null
  >(null)

  const values: Record<AccessKey, boolean> = {
    productAccessEnabled,
    orderTrackingEnabled,
    orderCaptureEnabled,
    restockAlertsEnabled,
    payLinkEnabled,
    orderUpdatesEnabled,
    cartHoldEnabled,
  }
  const setters: Record<AccessKey, (value: boolean) => void> = {
    productAccessEnabled: setProductAccessEnabled,
    orderTrackingEnabled: setOrderTrackingEnabled,
    orderCaptureEnabled: setOrderCaptureEnabled,
    restockAlertsEnabled: setRestockAlertsEnabled,
    payLinkEnabled: setPayLinkEnabled,
    orderUpdatesEnabled: setOrderUpdatesEnabled,
    cartHoldEnabled: setCartHoldEnabled,
  }

  // What the agent may do with orders right now, from the live switches.
  const captureOn = productCount > 0 && productAccessEnabled && orderCaptureEnabled
  const orderScope: 'payLink' | 'preOrder' | 'readOnly' = captureOn && payLinkEnabled && checkoutStore?.ready
    ? 'payLink'
    : captureOn ? 'preOrder' : 'readOnly'
  // Card-to-card is what a confirmed cart gets when no store link is issued.
  const cardScope = captureOn && cardPayEnabled && gatewayReady && orderScope !== 'payLink'
  const fa = useLocale() !== 'en'

  async function updateAccess(key: AccessKey, enabled: boolean) {
    const previous = values[key]
    setters[key](enabled)

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
      setters[key](previous)
      setNotice({ type: 'err', message: t('saveError') })
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <section className="spatial-surface overflow-hidden rounded-card p-4 sm:p-5">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">
            {t('title')}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            {t('description')}
          </p>
        </div>

        <div className="mt-5 space-y-5">
          <AccessGroup title={t('groupMain')} description={t('groupSellingDescription')}>
            <SwitchCard
              icon={Package}
              title={t('productsTitle')}
              description={t('productsDescription')}
              badge={t('productsCount', { count: productCount.toLocaleString(numberLocale) })}
              checked={productCount > 0 && productAccessEnabled}
              pending={saving === 'productAccessEnabled'}
              disabled={saving !== null || productCount === 0}
              enabledLabel={t('enabled')}
              disabledLabel={t('disabled')}
              onChange={(enabled) => updateAccess('productAccessEnabled', enabled)}
            />
            <SwitchCard
              icon={ShoppingBag}
              title={t('ordersTitle')}
              description={t('ordersDescription')}
              badge={t('ordersCount', { count: orderCount.toLocaleString(numberLocale) })}
              checked={orderCount > 0 && orderTrackingEnabled}
              pending={saving === 'orderTrackingEnabled'}
              disabled={saving !== null || orderCount === 0}
              enabledLabel={t('enabled')}
              disabledLabel={t('disabled')}
              onChange={(enabled) => updateAccess('orderTrackingEnabled', enabled)}
            />
            <SwitchCard
              icon={ClipboardList}
              title={t('orderCaptureTitle')}
              description={t('orderCaptureDescription')}
              badge={t('orderCaptureBadge')}
              checked={captureOn}
              pending={saving === 'orderCaptureEnabled'}
              disabled={saving !== null || productCount === 0 || !productAccessEnabled}
              lockedReason={productCount > 0 && !productAccessEnabled ? t('locked.needsProducts') : undefined}
              enabledLabel={t('enabled')}
              disabledLabel={t('disabled')}
              onChange={(enabled) => updateAccess('orderCaptureEnabled', enabled)}
            />
          </AccessGroup>
          <PaymentMethodPicker
            agentId={agentId}
            initial={{ cardPayEnabled: initialCardPayEnabled, payLinkEnabled: initialPayLinkEnabled }}
            gatewayReady={gatewayReady}
            store={checkoutStore}
            disabledReason={!captureOn ? t('locked.needsCapture') : undefined}
            onChange={(flags) => {
              setCardPayEnabled(flags.cardPayEnabled)
              setPayLinkEnabled(flags.payLinkEnabled)
            }}
          />
          <AccessGroup title={t('groupExtra')}>
            <SwitchCard
              icon={Truck}
              title={t('orderUpdatesTitle')}
              description={t('orderUpdatesDescription')}
              badge={t('orderUpdatesBadge')}
              checked={orderCount > 0 && orderTrackingEnabled && orderUpdatesEnabled}
              pending={saving === 'orderUpdatesEnabled'}
              disabled={saving !== null || orderCount === 0 || !orderTrackingEnabled}
              lockedReason={orderCount > 0 && !orderTrackingEnabled ? t('locked.needsOrders') : undefined}
              enabledLabel={t('enabled')}
              disabledLabel={t('disabled')}
              onChange={(enabled) => updateAccess('orderUpdatesEnabled', enabled)}
            />
            <SwitchCard
              icon={BellRing}
              title={t('restockTitle')}
              description={t('restockDescription')}
              badge={t('restockBadge')}
              checked={productCount > 0 && productAccessEnabled && restockAlertsEnabled}
              pending={saving === 'restockAlertsEnabled'}
              disabled={saving !== null || productCount === 0 || !productAccessEnabled}
              lockedReason={productCount > 0 && !productAccessEnabled ? t('locked.needsProducts') : undefined}
              enabledLabel={t('enabled')}
              disabledLabel={t('disabled')}
              onChange={(enabled) => updateAccess('restockAlertsEnabled', enabled)}
            />
            <SwitchCard
              icon={Hourglass}
              title={t('cartHoldTitle')}
              description={t('cartHoldDescription')}
              badge={t('cartHoldBadge')}
              checked={captureOn && cartHoldEnabled}
              pending={saving === 'cartHoldEnabled'}
              disabled={saving !== null || !captureOn}
              lockedReason={productCount > 0 && !captureOn ? t('locked.needsCapture') : undefined}
              enabledLabel={t('enabled')}
              disabledLabel={t('disabled')}
              onChange={(enabled) => updateAccess('cartHoldEnabled', enabled)}
            />
          </AccessGroup>
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5 sm:p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-primary)]">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {cardScope ? (fa ? 'ایجنت سفارش می‌گیرد و پرداخت را با درگاه ویجنت تأیید می‌کند' : 'The agent takes the order and confirms payment through the Vigent gateway') : t(`scope.${orderScope}.title`)}
          </h3>
          <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)] sm:text-sm">
            {cardScope
              ? (fa
                ? 'بعد از تأیید خلاصهٔ سفارش، کارت شما و مبلغ دقیق برای مشتری فرستاده می‌شود. ایجنت هیچ‌وقت خودش نمی‌گوید «پرداخت رسید»؛ تأیید فقط از روی پیامک واریز بانک یا تصمیم خود شماست.'
                : 'After the order summary is confirmed, your card and the exact amount are sent to the customer. The agent never says “payment received” by itself; confirmation comes only from the bank’s deposit SMS or your own decision.')
              : t(`scope.${orderScope}.description`, { host: checkoutStore?.host ?? '' })}
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

/** A labelled list of switches. */
function AccessGroup({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2">
        <h3 className="text-xs font-semibold text-[var(--text-muted)]">{title}</h3>
        {description && <p className="mt-1 max-w-3xl text-xs leading-6 text-[var(--text-secondary)]">{description}</p>}
      </div>
      <div className="ui-switch-list divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
        {children}
      </div>
    </div>
  )
}
