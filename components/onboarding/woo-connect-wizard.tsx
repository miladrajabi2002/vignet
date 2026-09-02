'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  Check,
  CheckCircle2,
  Download,
  Globe,
  Loader2,
  Package,
  Plug,
  RefreshCw,
  Sparkles,
  ArrowLeft,
} from 'lucide-react'

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

    const trimmed = storeUrl.trim()
    if (!trimmed) {
      setError('آدرس سایت را وارد کنید.')
      return
    }
    try {
      // eslint-disable-next-line no-new
      new URL(trimmed)
    } catch {
      setError('آدرس سایت نامعتبر است. مثال: https://example.com')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'WOOCOMMERCE',
          storeUrl: trimmed,
          credentials: {}, // webhook-only — the plugin pushes data, no REST keys needed
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          data.error === 'INVALID'
            ? 'آدرس سایت نامعتبر است.'
            : data.error === 'UNSAFE_STORE_URL'
              ? 'آدرس سایت به دلایل امنیتی قابل قبول نیست.'
              : data.error === 'PLAN_BLOCKED'
                ? 'پلن شما اجازه اتصال سایت را نمی‌دهد.'
                : 'خطا در ساخت اتصال.',
        )
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
      setError('خطا در ارتباط با سرور.')
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
        // Auto-advance to the next onboarding step after a short celebration.
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

  // Cache-busting query param on the plugin download link — guarantees the
  // browser always fetches the latest zip instead of serving a cached copy.
  const pluginDownloadHref = `/api/downloads/wordpress-plugin?v=${Date.now()}`

  return (
    <motion.div
      className="w-full overflow-hidden rounded-[1.5rem] border border-black/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: EASE }}
    >
      {/* Header */}
      <div className="flex items-center border-b border-[var(--border-subtle)] px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--text-primary)] text-[var(--bg-base)] shadow-[var(--shadow-control)]">
            <Plug className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              اتصال سایت وردپرس / ووکامرس
            </h2>
            <p className="text-[11px] text-[var(--text-muted)]">
              {step === 'url' && 'مرحله ۱ از ۳ — آدرس سایت'}
              {step === 'install' && 'مرحله ۲ از ۳ — نصب افزونه و اتصال'}
              {step === 'success' && 'مرحله ۳ از ۳ — اتصال موفق'}
            </p>
          </div>
        </div>
      </div>

      {/* Body — animated step transitions */}
      <div className="px-6 py-5">
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
              <div className="text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                  <Globe className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-base font-semibold text-[var(--text-primary)]">
                  آدرس سایت خود را وارد کنید
                </h3>
                <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-5 text-[var(--text-muted)]">
                  سایت وردپرسی یا فروشگاه ووکامرسی خود را وارد کنید. ما اتصال را برای شما می‌سازیم.
                </p>
              </div>

              <form onSubmit={submitUrl} className="space-y-3">
                <div>
                  <input
                    dir="ltr"
                    type="url"
                    required
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="input w-full text-center font-mono text-sm"
                    autoFocus
                  />
                </div>
                {error && (
                  <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="spatial-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-6 text-[13px] font-semibold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {submitting ? 'در حال ایجاد اتصال…' : 'ادامه'}
                </button>
              </form>
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
              {/* Confirmed URL banner */}
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                <span dir="ltr" className="truncate text-xs font-medium text-green-800">
                  {integration.storeUrl}
                </span>
              </div>

              {/* Steps */}
              <ol className="space-y-3">
                <StepRow
                  num={1}
                  title="افزونه ویجنت را دانلود و نصب کنید"
                  desc="در وردپرس: افزونه‌ها → افزودن → بارگذاری افزونه → این فایل را انتخاب کنید."
                  action={
                    <a
                      href={pluginDownloadHref}
                      download
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[var(--text-primary)] px-3 text-xs font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90"
                    >
                      <Download className="h-3.5 w-3.5" />
                      دانلود افزونه
                    </a>
                  }
                />
                <StepRow
                  num={2}
                  title="در افزونه دکمه «اتصال» را بزنید"
                  desc="به صفحه «ویجنت» در منوی وردپرس بروید و دکمه بزرگ «اتصال» را بزنید. همه چیز خودکار است."
                />
                <StepRow
                  num={3}
                  title="منتظر بمانید تا اتصال برقرار شود"
                  desc="ما به‌صورت خودکار اتصال را تشخیص می‌دهیم — نیازی به کاری ندارید."
                />
              </ol>

              {/* Live status — pulsing while polling */}
              <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
                {polling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--text-secondary)]" />
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      در انتظار اتصال افزونه…
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 text-[var(--text-muted)]" />
                    <span className="text-xs text-[var(--text-muted)]">
                      اتصال قطع شد — دوباره تلاش کنید
                    </span>
                  </>
                )}
              </div>

            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              key="success"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={{ duration: reduceMotion ? 0 : 0.3, ease: EASE }}
              className="space-y-4 text-center"
            >
              <motion.div
                initial={reduceMotion ? false : { scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.5, ease: EASE, type: 'spring', bounce: 0.5 }}
                className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-100"
              >
                <CheckCircle2 className="h-9 w-9 text-green-600" strokeWidth={2} />
              </motion.div>

              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  با موفقیت وصل شد!
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-[var(--text-secondary)]">
                  سایت شما به ویجنت متصل شد. محصولات و سفارش‌ها به‌صورت خودکار همگام می‌شوند. در حال ادامه راه‌اندازی…
                </p>
              </div>

              {/* Spinner while we auto-advance */}
              <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ادامه به مرحله بعد…
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {step !== 'success' && (
          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            <button
              type="button"
              onClick={onDismiss}
              disabled={submitting}
              className="spatial-press inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-4 text-xs font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-sm)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4 rotate-180" />
              بازگشت به محصولات و خدمات
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────

function StepRow({
  num,
  title,
  desc,
  action,
}: {
  num: number
  title: string
  desc: string
  action?: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--text-primary)] text-[11px] font-bold text-white">
        {num}
      </span>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-0.5 text-[11px] leading-5 text-[var(--text-muted)]">{desc}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </li>
  )
}

// Re-export Package icon so callers don't need to import it separately.
export { Package as PackageIcon, Sparkles as SparklesIcon, ArrowLeft as ArrowLeftIcon }
