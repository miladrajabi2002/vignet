'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useRouter } from 'next/navigation'
import {
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  QrCode,
  KeyRound,
  RefreshCw,
  Zap,
} from 'lucide-react'

/**
 * WhatsApp QR-bridge connection flow.
 *
 * The operator scans a QR code with their phone (WhatsApp → Linked devices →
 * Link a device), OR enters their phone number to receive an 8-char pairing
 * code they type into the same WhatsApp screen. Either way, once their phone
 * connects, the bridge holds the WhatsApp Web session and forwards every
 * inbound message to the AI agent.
 *
 * Lifecycle (all via HTTP polling — no websocket needed):
 *   1. POST /api/agents/[id]/channels/whatsapp-qr/start
 *      → backend creates a bridge session id, asks the bridge to spin up a
 *        Baileys socket, returns { sessionId }
 *   2. GET  /api/agents/[id]/channels/whatsapp-qr/status?sessionId=…
 *      → polled every 2s. Returns { state, qr?, pairingCode?, phone?, name? }
 *        state goes: starting → qr|pairing → connecting → open
 *   3. PUT  /api/agents/[id]/channels/whatsapp-qr/start   (body: { sessionId })
 *      → once state === 'open', persist the AgentChannel row with mode='QR'
 *
 * The QR string from the bridge is rendered client-side with the `qrcode`
 * npm package (already a dependency). QR strings rotate every ~20s on
 * WhatsApp's side; the poll picks up the new string and re-renders.
 *
 * The OAuth (Meta) flow is kept as a secondary "advanced" option for users
 * who already have a verified WhatsApp Business Account — accessible via a
 * small link at the bottom of the card.
 */

type QrState =
  | 'idle' // before /start is called
  | 'starting' // bridge is spinning up the socket
  | 'qr' // QR emitted, waiting for scan
  | 'pairing' // phone-number pairing requested, waiting for code entry on phone
  | 'connecting' // phone scanned QR / accepted pairing, WA logging us in
  | 'open' // connected!
  | 'closed' // logged out or fatally disconnected
  | 'error' // local error (bridge unreachable, etc.)

interface StatusResponse {
  ok: boolean
  state?: QrState
  qr?: string | null
  pairingCode?: string | null
  phone?: string | null
  name?: string | null
  error?: string | null
  persisted?: boolean
  detail?: string
}

const POLL_INTERVAL_MS = 2000
const QR_TIMEOUT_MS = 90_000 // give up after 90s with no connection

export function WhatsAppQrConnect({
  agentId,
  onClose,
  onSwitchToOAuth,
}: {
  agentId: string
  onClose?: () => void
  onSwitchToOAuth?: () => void
}) {
  const router = useRouter()
  const [state, setState] = useState<QrState>('idle')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null)
  const [connectedName, setConnectedName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedAtRef = useRef<number | null>(null)

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [])

  // ── Render the QR string into a data URL (client-side) ────────────────────
  const renderQr = useCallback(async (qrStr: string) => {
    try {
      const dataUrl = await QRCode.toDataURL(qrStr, {
        margin: 1,
        width: 256,
        color: { dark: '#0a0a0a', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      })
      setQrDataUrl(dataUrl)
    } catch {
      setQrDataUrl(null)
    }
  }, [])

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  // ── Persist the channel once the phone connects ───────────────────────────
  // phone/name are passed in from the poll response so this callback has no
  // dependency on the connectedPhone/connectedName state (which would otherwise
  // re-create it on every status update and cascade through pollStatus → start).
  const persist = useCallback(
    async (sid: string, phoneInfo?: string, nameInfo?: string) => {
      try {
        const res = await fetch(
          `/api/agents/${agentId}/channels/whatsapp-qr/start`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sid }),
          },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          phone?: string
          name?: string
          error?: string
        }
        if (res.ok && data.ok) {
          setConnectedPhone(data.phone ?? phoneInfo ?? null)
          setConnectedName(data.name ?? nameInfo ?? null)
          // Refresh server data so the channels page shows the new connection.
          router.refresh()
        } else if (data.error === 'CHANNEL_LIMIT') {
          setState('error')
          setError('سهمیه اتصال کانال پلن شما تکمیل شده است. یک کانال را حذف کنید یا پلن را ارتقا دهید.')
        }
      } catch {
        /* best-effort — the channel may still be persisted server-side */
      }
    },
    [agentId, router],
  )

  // ── Poll the bridge for status ────────────────────────────────────────────
  const pollStatus = useCallback(
    async (sid: string) => {
      try {
        const res = await fetch(
          `/api/agents/${agentId}/channels/whatsapp-qr/status?sessionId=${encodeURIComponent(sid)}`,
        )
        const data = (await res.json().catch(() => ({}))) as StatusResponse
        if (!data.ok) {
          // Network blip — keep the last state, don't error out yet.
          return
        }
        const s = (data.state ?? 'closed') as QrState
        setState(s)

        if (data.qr) {
          void renderQr(data.qr)
        } else if (s !== 'qr') {
          setQrDataUrl(null)
        }

        if (data.pairingCode) {
          setPairingCode(data.pairingCode)
        } else if (s !== 'pairing') {
          setPairingCode(null)
        }

        if (s === 'open') {
          setConnectedPhone(data.phone ?? null)
          setConnectedName(data.name ?? null)
          stopPolling()
          // Persist the channel (PUT /start), passing the phone/name we just
          // got so the persist callback doesn't need to read them from state.
          void persist(sid, data.phone ?? undefined, data.name ?? undefined)
        }

        if (s === 'closed' && data.error) {
          setError(
            data.error === 'BRIDGE_UNREACHABLE'
              ? 'سرویس واتساپ قطع شد.'
              : `اتصال بسته شد. ${data.error}`,
          )
        }
      } catch {
        /* swallow — polling is best-effort */
      }
    },
    [agentId, renderQr, stopPolling, persist],
  )

  // ── Start a session (QR or phone-pairing) ─────────────────────────────────
  const start = useCallback(
    async (opts?: { phone?: string }) => {
      setBusy(true)
      setError(null)
      setQrDataUrl(null)
      setPairingCode(null)
      setConnectedPhone(null)
      setConnectedName(null)
      setState('starting')
      startedAtRef.current = Date.now()

      try {
        const res = await fetch(
          `/api/agents/${agentId}/channels/whatsapp-qr/start`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(opts?.phone ? { phone: opts.phone } : {}),
          },
        )
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          sessionId?: string
          error?: string
          detail?: string
        }
        if (!res.ok || !data.ok || !data.sessionId) {
          setState('error')
          setError(
            data.error === 'CHANNEL_LIMIT'
              ? 'سهمیه اتصال کانال پلن شما تکمیل شده است. یک کانال را حذف کنید یا پلن را ارتقا دهید.'
              : data.detail ??
              (data.error === 'BRIDGE_UNREACHABLE'
                ? 'سرویس واتساپ در دسترس نیست. مطمئن شوید whatsapp-bridge روی پورت 3040 در حال اجرا است.'
                : 'شروع اتصال ناموفق بود. دوباره تلاش کنید.'),
          )
          return
        }
        // Start polling.
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(
          () => pollStatus(data.sessionId!),
          POLL_INTERVAL_MS,
        )
        if (tickRef.current) clearInterval(tickRef.current)
        tickRef.current = setInterval(() => {
          if (startedAtRef.current) {
            const el = Date.now() - startedAtRef.current
            if (el > QR_TIMEOUT_MS) {
              setError(
                'اتصال در زمان مقرر انجام نشد. لطفاً دوباره تلاش کنید.',
              )
              setState('error')
              stopPolling()
            }
          }
        }, 1000)
        // Immediate first poll (don't wait the full interval).
        void pollStatus(data.sessionId)
      } catch (e) {
        setState('error')
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [agentId, pollStatus, stopPolling],
  )

  // ── User actions ──────────────────────────────────────────────────────────
  function handleStartQr() {
    void start()
  }
  function handleStartPairing() {
    const cleaned = phone.replace(/[^\d+]/g, '')
    if (!/^\+?\d{6,15}$/.test(cleaned)) {
      setError('شمارهٔ تلفن معتبر وارد کنید. مثال: +989121234567')
      return
    }
    void start({ phone: cleaned })
  }
  function handleCancel() {
    stopPolling()
    setState('idle')
    setQrDataUrl(null)
    setPairingCode(null)
    setError(null)
    if (onClose) onClose()
  }
  function handleRetry() {
    stopPolling()
    setState('idle')
    setQrDataUrl(null)
    setPairingCode(null)
    setError(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const showQr = state === 'qr' && qrDataUrl
  const showPairing = state === 'pairing' && pairingCode
  const showConnecting = state === 'connecting' || state === 'starting'
  const showOpen = state === 'open'
  const showError = state === 'error' || (state === 'closed' && error)

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              اتصال واتساپ با QR
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              بدون نیاز به اپ متا، VPN یا تأیید کسب‌وکار — فقط اسکن QR
            </p>
          </div>
        </div>

        {/* Idle: choose QR or phone pairing */}
        {state === 'idle' && (
          <div className="mt-4 space-y-4">
            {/* QR scan option (primary) */}
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/10 text-[#25D366]">
                  <QrCode className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    روش ۱: اسکن QR
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                    یک QR نمایش داده می‌شود. در گوشی‌تان وارد{' '}
                    <b>WhatsApp → Settings → Linked devices → Link a device</b>{' '}
                    بشید و QR رو اسکن کنید.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartQr}
                disabled={busy}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                {busy ? 'در حال شروع…' : 'نمایش QR'}
              </button>
            </div>

            {/* Phone pairing option */}
            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--text-primary)]/10 text-[var(--text-primary)]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    روش ۲: اتصال با شماره تلفن
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                    اگر روی موبایل هستید و نمی‌تونید QR رو اسکن کنید، شماره رو
                    وارد کنید تا یک کد ۸ رقمی دریافت کنید. این کد رو در همان
                    صفحهٔ Linked devices → <b>Link with phone number</b> وارد
                    کنید.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  dir="ltr"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+989121234567"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
                <button
                  type="button"
                  onClick={handleStartPairing}
                  disabled={busy || !phone.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  دریافت کد
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Tip */}
            <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[#25D366]" />
              <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                این روش از پروتکل WhatsApp Web استفاده می‌کنه. واتساپ روی گوشی
                شما باید فعال باشه و هر ۱۴ روز حداقل یک‌بار آنلاین بشه (در غیر
                این صورت session منقضی می‌شه و باید دوباره اسکن کنید).
              </p>
            </div>

            {/* Footer: switch to OAuth + back */}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                onClick={handleCancel}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                بازگشت
              </button>
              {onSwitchToOAuth && (
                <button
                  type="button"
                  onClick={onSwitchToOAuth}
                  className="inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                >
                  اتصال رسمی متا (OAuth)
                  <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Starting / Connecting spinner */}
        {showConnecting && !showQr && !showPairing && (
          <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#25D366]" />
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              {state === 'starting'
                ? 'در حال آماده‌سازی اتصال…'
                : 'در حال اتصال به واتساپ…'}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              ممکن است چند ثانیه طول بکشد.
            </p>
            <button
              type="button"
              onClick={handleCancel}
              className="mt-4 text-xs text-[var(--text-secondary)] hover:text-danger"
            >
              انصراف
            </button>
          </div>
        )}

        {/* QR display */}
        {showQr && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col items-center">
              <div className="rounded-2xl bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl ?? undefined}
                  alt="WhatsApp QR"
                  width={240}
                  height={240}
                  className="h-60 w-60"
                />
              </div>
              <p className="mt-3 text-center text-xs leading-relaxed text-[var(--text-secondary)]">
                روی گوشی: <b>WhatsApp</b> ← <b>Settings</b> ←{' '}
                <b>Linked devices</b> ← <b>Link a device</b>، سپس این QR رو
                اسکن کنید.
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                QR هر ~۲۰ ثانیه تجدید می‌شود. اگر منقضی شد، دوباره اسکن کنید.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                QR جدید
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-[var(--text-secondary)] hover:text-danger"
              >
                انصراف
              </button>
            </div>
          </div>
        )}

        {/* Pairing code display */}
        {showPairing && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border-2 border-dashed border-[#25D366]/40 bg-[#25D366]/5 p-6">
                <p className="text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                  کد اتصال
                </p>
                <p
                  dir="ltr"
                  className="mt-2 text-center font-mono text-3xl font-bold tracking-[0.3em] text-[var(--text-primary)]"
                >
                  {pairingCode}
                </p>
              </div>
              <p className="mt-4 max-w-xs text-center text-xs leading-relaxed text-[var(--text-secondary)]">
                روی گوشی: <b>WhatsApp</b> ← <b>Settings</b> ←{' '}
                <b>Linked devices</b> ← <b>Link a device</b> ←{' '}
                <b>Link with phone number</b>، سپس این کد رو وارد کنید.
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                کد تا ۶۰ ثانیه معتبر است.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                کد جدید
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-[var(--text-secondary)] hover:text-danger"
              >
                انصراف
              </button>
            </div>
          </div>
        )}

        {/* Success — connected */}
        {showOpen && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-col items-center py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366]/10">
                <CheckCircle2 className="h-8 w-8 text-[#25D366]" />
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--text-primary)]">
                واتساپ متصل شد!
              </p>
              {connectedPhone && (
                <p
                  dir="ltr"
                  className="mt-1 text-xs text-[var(--text-secondary)]"
                >
                  {connectedPhone}
                  {connectedName ? ` · ${connectedName}` : ''}
                </p>
              )}
              <p className="mt-2 max-w-xs text-center text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                حالا پیام‌های جدید واتساپ به‌صورت خودکار به ایجنت شما ارسال
                می‌شوند و پاسخ هوش مصنوعی برای مخاطب ارسال می‌گردد.
              </p>
            </div>
            <div className="flex justify-center border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                onClick={() => {
                  handleCancel()
                  router.refresh()
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90"
              >
                <CheckCircle2 className="h-4 w-4" />
                تمام
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {showError && (
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">اتصال ناموفق بود.</p>
                <p className="mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 py-1.5 text-xs font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                تلاش دوباره
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-[var(--text-secondary)] hover:text-danger"
              >
                انصراف
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Trust note */}
      <p className="text-center text-[11px] leading-relaxed text-[var(--text-tertiary)]">
        vigent هیچ رمز عبوری ذخیره نمی‌کند. session واتساپ روی سرور خود شما (در
        whatsapp-bridge) نگهداری می‌شود و هر زمان می‌توانید از داشبورد قطع کنید.
      </p>
    </div>
  )
}

/**
 * Backward-compat re-export. The channels page imports `WhatsAppConnectFlow`
 * and `WhatsAppNumberPicker` from this file; we keep those names working and
 * add the new QR flow as the default.
 */
export { WhatsAppQrConnect as WhatsAppConnectFlow }
export default WhatsAppQrConnect

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Multi-number picker (OAuth flow — kept for backward compat)               */
/* ─────────────────────────────────────────────────────────────────────────── */

/** Shape of a pending WhatsApp phone number, as stashed in the
 *  `wa_oauth_pending` cookie by `/api/whatsapp/oauth/callback`. */
export interface PendingWhatsappNumber {
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber?: string
  verifiedName?: string
}

/**
 * Renders when Meta's OAuth callback found MORE than one WhatsApp phone number
 * on the operator's account. Kept verbatim from the original implementation —
 * only used by the OAuth flow.
 */
export function WhatsAppNumberPicker({
  agentId,
  numbers,
}: {
  agentId: string
  numbers: PendingWhatsappNumber[]
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(num: PendingWhatsappNumber) {
    setBusyId(num.phoneNumberId)
    setError(null)
    try {
      const res = await fetch(
        `/api/agents/${agentId}/channels/whatsapp-connect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumberId: num.phoneNumberId }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!res.ok || !data.ok) {
        if (data.error === 'NO_PENDING_OAUTH') {
          setError(
            'نشست انتخاب شماره منقضی شده است. لطفاً دوباره روی «اتصال واتساپ» بزنید.',
          )
        } else if (data.error === 'NUMBER_NOT_FOUND') {
          setError('شمارهٔ انتخاب‌شده معتبر نیست. دوباره تلاش کنید.')
        } else if (data.error === 'UNAUTHORIZED') {
          setError('ابتدا وارد شوید.')
        } else if (data.error === 'CHANNEL_LIMIT') {
          setError('سهمیه اتصال کانال پلن شما تکمیل شده است. یک کانال را حذف کنید یا پلن را ارتقا دهید.')
        } else {
          setError('اتصال ناموفق بود. دوباره تلاش کنید.')
        }
        return
      }
      router.replace(`/agents/${agentId}/channels?wa_connected=1`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  if (!numbers.length) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-danger">
            شمارهٔ واتساپی پیدا نشد.
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-danger/80">
            ممکن است نشست منقضی شده باشد. به کارت واتساپ برگردید و دوباره روی
            «اتصال واتساپ» بزنید.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white">
          <Phone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            شمارهٔ واتساپ خود را انتخاب کنید
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            چند شمارهٔ واتساپ Business در حساب متای شما پیدا شد. یکی را برای
            اتصال انتخاب کنید.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {numbers.map((num) => {
          const label =
            num.verifiedName?.trim() ||
            num.displayPhoneNumber ||
            num.phoneNumberId
          const sub = num.displayPhoneNumber
            ? num.verifiedName
              ? num.displayPhoneNumber
              : 'واتساپ Business'
            : `ID: ${num.phoneNumberId}`
          const isBusy = busyId === num.phoneNumberId
          return (
            <li
              key={num.phoneNumberId}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/10 text-[#25D366]">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p
                    dir="auto"
                    className="truncate text-sm font-medium text-[var(--text-primary)]"
                  >
                    {label}
                  </p>
                  <p
                    dir="ltr"
                    className="truncate text-xs text-[var(--text-secondary)]"
                  >
                    {sub}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => pick(num)}
                disabled={busyId !== null}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {isBusy ? 'در حال اتصال…' : 'اتصال'}
              </button>
            </li>
          )
        })}
      </ul>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--text-tertiary)]">
        این نشست ۱۰ دقیقه اعتبار دارد. اگر منقضی شد، دوباره روی «اتصال واتساپ» بزنید.
      </p>
    </div>
  )
}
