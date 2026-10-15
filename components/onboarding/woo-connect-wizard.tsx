'use client'

import { useLocale } from 'next-intl'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Check, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusChip } from '@/components/ui/status-chip'
import {
  WooPluginSetup,
  normalizeStoreUrlInput,
  wooCreateErrorMessage,
} from '@/components/integrations/woo-plugin-setup'
import {
  ListeningRow,
  StoreAvatar,
  StoreUrlField,
  WOO_BTN_GHOST,
  WOO_BTN_PRIMARY,
  WOO_BTN_SECONDARY,
  WOO_CARD,
  WOO_TEXT,
  WooStepsPreview,
  storeHost,
} from '@/components/integrations/woo-ui'

/**
 * WooConnectWizard — inline (non-modal) WooCommerce connect wizard.
 *
 * Renders INSIDE the onboarding KnowledgeStep (no popup / no overlay).
 *
 *  Flow:
 *   1. URL → user enters their WP site URL. We POST /api/integrations to
 *      create the StoreIntegration row (webhook-only mode — no REST keys
 *      needed, the plugin pushes via signed webhook).
 *   2. Install → show download link for the WP plugin + the "click اتصال in
 *      the plugin" instruction. Poll /api/integrations every 5s; the plugin's
 *      test.connection ping will create a sync log row which signals "connected".
 *   3. Success → "با موفقیت وصل شد" card, then auto-advance to the next
 *      onboarding step after a short delay.
 *
 * The wizard is dismissible — the user can return to the optional products
 * and services step. Closing resets local state so reopening starts fresh.
 *
 * ─── Polling design note ──────────────────────────────────────────
 * The integration ID is stored in a ref (not state) so the polling
 * callback can stay stable (empty deps). This avoids the feedback loop
 * where every poll → setState → recreate callback → re-run useEffect →
 * immediate fire, which previously caused ~10-20 requests/sec.
 */

type WizardStep = 'url' | 'install' | 'success'

interface Props {
  /** Called when the user successfully connects (or skips after connecting). */
  onConnected: () => void
  /** Called when the user dismisses the wizard without connecting. */
  onDismiss: () => void
}

interface IntegrationState {
  id: string
  storeUrl: string
  webhookSecret: string
  active: boolean
}

const EASE = [0.16, 1, 0.3, 1] as const
const POLL_INTERVAL_MS = 5000
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // give up after 5 minutes

export function WooConnectWizard({ onConnected, onDismiss }: Props) {
  const fa = useLocale() !== 'en'
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState<WizardStep>('url')
  const [storeUrl, setStoreUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [integration, setIntegration] = useState<IntegrationState | null>(null)
  const [polling, setPolling] = useState(false)

  // ── Refs used by the polling loop so the callback can stay stable ──
  // `onConnectedRef` holds the latest onConnected callback so the polling
  // closure can call it without being re-created on every render.
  const onConnectedRef = useRef(onConnected)
  onConnectedRef.current = onConnected

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartRef = useRef<number>(0)
  const pollStoppedRef = useRef<boolean>(false)

  // ── Step 1: submit URL → create integration ──
  async function submitUrl(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)

    const normalized = normalizeStoreUrlInput(storeUrl)
    if (!normalized) {
      setError((fa ? 'آدرس سایت را وارد کنید.' : 'Enter your site address.'))
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'WOOCOMMERCE',
          storeUrl: normalized,
          credentials: {}, // webhook-only — the plugin pushes data, no REST keys needed
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(wooCreateErrorMessage(data.error, fa))
        return
      }
      // Integration created (or returned idempotently) — move to install step.
      setIntegration({
        id: data.integration.id,
        storeUrl: data.integration.storeUrl,
        webhookSecret: data.webhookSecret,
        active: data.integration.active,
      })
      setStep('install')
      // Start polling for the plugin's test.connection ping.
      pollStartRef.current = Date.now()
      pollStoppedRef.current = false
      setPolling(true)
    } catch {
      setError((fa ? 'خطا در ارتباط با سرور.' : 'Could not reach the server.'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Polling: detect when the plugin has connected ──
  // The plugin sends a `test.connection` event when the user clicks "اتصال"
  // in the WP admin. That event stamps connectedAt/lastWebhookAt on the
  // integration. We poll /api/integrations for that durable connection state.
  //
  // IMPORTANT: this callback has EMPTY deps so it never re-creates. The
  // polling interval is set ONCE when `polling` flips to true and cleared
  // when it flips back to false. This prevents the feedback loop that
  // previously caused a request storm.
  //
  // FORGIVING MATCH: we accept the connection as live if ANY WooCommerce
  // integration in the workspace is stamped connected — not just the specific
  // integration ID we created. This handles the case where the user has
  // duplicate integrations for the same URL (e.g. from earlier test runs
  // before POST became idempotent) and the WP plugin's auto-discovery
  // picked a different one. Once the user has clicked "اتصال" anywhere,
  // we let them proceed.
  const checkConnection = useCallback(async () => {
    if (pollStoppedRef.current) return
    try {
      const res = await fetch('/api/integrations', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const integrations: Array<{
        type: string
        connectedAt?: string | null
        lastWebhookAt?: string | null
        lastSyncAt?: string | null
      }> = data.integrations ?? []
      const anyConnected = integrations.some(
        (i) => i.type === 'WOOCOMMERCE' && Boolean(i.connectedAt || i.lastWebhookAt || i.lastSyncAt),
      )

      // The first signed plugin event stamps the integration itself. This stays
      // true even after old high-volume sync logs are pruned.
      if (anyConnected) {
        pollStoppedRef.current = true
        setPolling(false)
        setStep('success')
        // Auto-advance (to the store-access questions) after a short celebration.
        setTimeout(() => onConnectedRef.current(), 1800)
        return
      }

      // Timeout — stop polling after POLL_TIMEOUT_MS.
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        pollStoppedRef.current = true
        setPolling(false)
        // Don't error — just let the user know they can come back later.
      }
    } catch {
      // Network blip — keep polling.
    }
  }, [])

  useEffect(() => {
    if (!polling || step !== 'install') return
    // Fire immediately, then on interval. The interval is set ONCE — the
    // callback is stable (empty deps) so this effect won't re-run on every
    // render, breaking the previous request-storm feedback loop.
    void checkConnection()
    pollTimerRef.current = setInterval(checkConnection, POLL_INTERVAL_MS)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [polling, step, checkConnection])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  function restartPolling() {
    pollStartRef.current = Date.now()
    pollStoppedRef.current = false
    setPolling(true)
  }

  const stepIndex = step === 'url' ? 0 : step === 'install' ? 1 : 2
  const stepLabel = fa
    ? `قدم ${(stepIndex + 1).toLocaleString('fa-IR')} از ۳`
    : `Step ${stepIndex + 1} of 3`

  return (
    <motion.div
      className={cn(WOO_CARD, 'w-full overflow-hidden')}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: EASE }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
        <StoreAvatar className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold leading-7 text-[var(--text-primary)]">
            {fa ? 'اتصال فروشگاه ووکامرس' : 'Connect a WooCommerce store'}
          </h2>
          <p className="text-[12.5px] font-semibold text-[var(--text-muted)]">{stepLabel}</p>
        </div>
        {/* Three segments: how far along the owner is, at a glance. */}
        <div aria-hidden className="flex w-16 shrink-0 gap-1">
          {[0, 1, 2].map((index) => (
            <span key={index} className={cn('h-1.5 flex-1 rounded-full', index <= stepIndex ? (step === 'success' ? 'bg-[var(--ok)]' : 'bg-[var(--text-primary)]') : 'bg-[var(--bg-muted)]')} />
          ))}
        </div>
      </div>

      {/* Body — animated step transitions */}
      <div className="px-5 py-5 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'url' && (
            <motion.div
              key="url"
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: EASE }}
              className="space-y-4"
            >
              <div>
                <h3 className="text-[16px] font-bold leading-relaxed text-[var(--text-primary)]">
                  {fa ? 'آدرس فروشگاه' : 'Store address'}
                </h3>
                <p className={cn(WOO_TEXT, 'mt-0.5')}>
                  {fa ? 'آدرس سایت وردپرسی یا فروشگاه ووکامرس را وارد کنید؛ اتصال را ما می‌سازیم.' : 'Enter your WordPress site or WooCommerce store; we create the connection.'}
                </p>
              </div>

              <form onSubmit={submitUrl} noValidate className="space-y-4">
                <StoreUrlField
                  fa={fa}
                  value={storeUrl}
                  onChange={(next) => { setStoreUrl(next); if (error) setError(null) }}
                  error={error}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className={cn(WOO_BTN_PRIMARY, 'spatial-press w-full')}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? (fa ? 'در حال ایجاد اتصال…' : 'Creating the connection…') : (fa ? 'ادامه' : 'Continue')}
                </button>
              </form>

              <div className="rounded-2xl bg-[var(--bg-base)] p-4">
                <WooStepsPreview fa={fa} />
              </div>
            </motion.div>
          )}

          {step === 'install' && integration && (
            <motion.div
              key="install"
              initial={reduceMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: EASE }}
              className="space-y-4"
            >
              {/* The address the connection was made for */}
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--bg-base)] px-3.5 py-2.5">
                <StoreAvatar storeUrl={integration.storeUrl} className="h-8 w-8 rounded-[10px] text-[14px]" />
                <span dir="ltr" className="min-w-0 flex-1 truncate text-start text-[13.5px] font-bold text-[var(--text-primary)] rtl:text-right">
                  {storeHost(integration.storeUrl)}
                </span>
                <StatusChip tone="ok" dot>{fa ? 'اتصال ساخته شد' : 'Created'}</StatusChip>
              </div>

              <WooPluginSetup
                storeUrl={integration.storeUrl}
                status={polling ? (
                  <ListeningRow fa={fa} />
                ) : (
                  <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg-base)] px-3.5 py-3">
                    <span className="text-[13px] text-[var(--text-secondary)]">
                      {fa ? 'هنوز خبری از افزونه نرسیده. بعد از زدن «اتصال» در وردپرس، دوباره بررسی کنید.' : 'No word from the plugin yet. After pressing “Connect” in WordPress, check again.'}
                    </span>
                    <button type="button" onClick={restartPolling} className={cn(WOO_BTN_SECONDARY, 'min-h-9 px-3 text-[12.5px]')}>
                      <RefreshCw className="h-3.5 w-3.5" />
                      {fa ? 'دوباره بررسی کن' : 'Check again'}
                    </button>
                  </div>
                )}
              />
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={{ duration: reduceMotion ? 0 : 0.3, ease: EASE }}
              className="space-y-4 py-2 text-center"
            >
              <motion.div
                initial={reduceMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.5, ease: EASE, type: 'spring', bounce: 0.45 }}
                className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--ok-soft)] text-[var(--ok)] shadow-[0_0_0_8px_color-mix(in_srgb,var(--ok-soft)_45%,transparent)]"
              >
                <Check className="h-8 w-8" strokeWidth={3} />
              </motion.div>

              <div>
                <h3 className="text-[18px] font-bold text-[var(--text-primary)]">
                  {fa ? 'فروشگاه وصل شد' : 'Your store is connected'}
                </h3>
                <p className={cn(WOO_TEXT, 'mx-auto mt-1.5 max-w-sm')}>
                  {fa ? 'محصولات و سفارش‌ها از این به بعد خودکار همگام می‌شوند.' : 'Products and orders now sync automatically.'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-[12.5px] text-[var(--text-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                {fa ? 'رفتن به قدم بعد…' : 'Moving to the next step…'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {step !== 'success' && (
          <div className="mt-5 border-t border-[var(--border-subtle)] pt-3">
            <button
              type="button"
              onClick={onDismiss}
              disabled={submitting}
              className={cn(WOO_BTN_GHOST, 'spatial-press w-full text-[12.5px]')}
            >
              <ArrowLeft className="h-4 w-4 ltr:rotate-0 rtl:rotate-180" />
              {fa ? 'بازگشت به محصولات و خدمات' : 'Back to products and services'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

