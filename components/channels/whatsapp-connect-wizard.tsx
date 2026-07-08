'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Smartphone,
  Monitor,
  ShieldAlert,
  X,
  Phone,
  type LucideIcon,
} from 'lucide-react'

/**
 * WhatsApp connection flow — platform-managed OAuth (mirrors Instagram).
 *
 * The operator never creates a Meta App, never pastes an access token, never
 * configures a webhook. They click "اتصال واتساپ" → we redirect them to
 * Facebook's OAuth dialog with WhatsApp Embedded Signup scopes → Meta
 * redirects back to our callback → we exchange the code, list their WhatsApp
 * Business phone numbers, and either connect immediately (single number) or
 * stash the candidates in a cookie and show a picker on the channels page.
 *
 * This component renders:
 *   - a prerequisites card (shown FIRST, before any connect button)
 *   - the prominent black "اتصال واتساپ" button that starts the OAuth flow
 *   - a loading state during the round-trip to the start endpoint
 *   - a back button that closes the inline panel
 *
 * The OAuth flow itself happens off-site (on facebook.com). The channels
 * page (not this component) handles the redirect-back via query params
 * (`?wa_connected=1`, `?wa_error=...`, `?wa_pick=1`).
 */
export function WhatsAppConnectFlow({
  agentId,
  onClose,
}: {
  agentId: string
  onClose?: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vpnModalOpen, setVpnModalOpen] = useState(false)

  // VPN warning modal: BEFORE the OAuth flow starts, the operator must
  // confirm their VPN is on. Facebook's OAuth + Graph servers are blocked
  // from Iranian IPs without a VPN, so the flow will silently fail (the
  // Facebook dialog page won't even load). The modal intercepts the
  // "اتصال واتساپ" click and only proceeds once the user confirms.
  useEffect(() => {
    if (!vpnModalOpen) return
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setVpnModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [vpnModalOpen])

  // Intercept the connect button: open the VPN modal first instead of
  // starting OAuth directly. The actual OAuth start happens in `confirmVpn`.
  function onConnectClick() {
    setVpnModalOpen(true)
  }

  // User confirmed VPN is on → close the modal and start the OAuth flow.
  function confirmVpn() {
    setVpnModalOpen(false)
    void startOAuth()
  }

  async function startOAuth() {
    setBusy(true)
    setError(null)
    try {
      // Ask the backend for the signed WhatsApp OAuth dialog URL. The backend
      // verifies the user owns the agent, signs a state token (HMAC), and
      // returns the URL we should redirect the browser to.
      const res = await fetch('/api/whatsapp/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        error?: string
      }
      if (!res.ok || !data.url) {
        if (data.error === 'UNAUTHORIZED') {
          setError('ابتدا وارد شوید.')
        } else if (data.error === 'NOT_FOUND') {
          setError('این ایجنت پیدا نشد.')
        } else if (res.status === 500) {
          setError(
            'خطای سرور هنگام ساخت URL اتصال. احتمالاً متغیرهای محیطی واتساپ ' +
              '(META_APP_ID / META_APP_SECRET / WHATSAPP_REDIRECT_URI) در .env تنظیم نشده‌اند. ' +
              'راهنما: این مقادیر را از App Dashboard → Facebook Login → Settings بگیرید ' +
              'و مطمئن شوید محصول WhatsApp Business API به اپ اضافه شده است.',
          )
        } else {
          setError('شروع اتصال ناموفق بود. دوباره تلاش کنید.')
        }
        return
      }
      // Full-page redirect to Facebook's OAuth dialog. After the user
      // authorizes, Meta redirects to /api/whatsapp/oauth/callback which
      // either connects the channel immediately and redirects with
      // ?wa_connected=1, or stashes a cookie and redirects with ?wa_pick=1
      // (multiple phone numbers), or redirects with ?wa_error=... on failure.
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      // Note: if the redirect succeeded, we never reach this — the browser
      // has already navigated away. This only fires on error.
      setBusy(false)
    }
  }

  function back() {
    if (onClose) {
      onClose()
      return
    }
    // Fallback: navigate back to the channels list.
    router.push(`/agents/${agentId}/channels`)
    router.refresh()
  }

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
              اتصال واتساپ
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              با یک کلیک، مستقیم از طریق متا
            </p>
          </div>
        </div>

        {/* Prerequisites */}
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            قبل از اتصال، مطمئن شوید:
          </p>
          <ul className="space-y-2.5">
            <PrereqItem icon={CheckCircle2} tone="brand">
              برای اتصال واتساپ فقط روی دکمه زیر بزنید و در پنجرهٔ متا اجازه
              دهید. نیازی به ساخت اپ متا یا کپی توکن نیست.
            </PrereqItem>
            <PrereqItem icon={Smartphone}>
              مراحل اتصال را حتماً در <b>مرورگر</b> انجام دهید (نه داخل اپلیکیشن
              واتساپ) — در موبایل لینک را در Chrome باز کنید.
            </PrereqItem>
            <PrereqItem icon={Monitor}>
              توصیه: اتصال را روی <b>دسکتاپ</b> انجام دهید برای اطمینان از تکمیل
              فرآیند.
            </PrereqItem>
            <PrereqItem icon={CheckCircle2} tone="brand">
              شمارهٔ واتساپ Business شما باید در یک WhatsApp Business Account
              متعلق به بیزینس‌منیجر شما باشد. اگر چند شماره دارید، بعد از اتصال
              می‌توانید یکی را انتخاب کنید.
            </PrereqItem>
          </ul>
        </div>

        {/* Help link */}
        <a
          href="/docs/instagram-connection"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <BookOpen className="h-3.5 w-3.5" />
          مشکل دارید؟ راهنمای کامل
          <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
        </a>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-2.5 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={back}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            بازگشت
          </button>
          <button
            type="button"
            onClick={onConnectClick}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            {busy ? 'در حال انتقال به متا…' : 'اتصال واتساپ'}
          </button>
        </div>
      </div>

      {/* VPN warning modal — shown when the user clicks "اتصال واتساپ".
          Must be confirmed before the OAuth flow starts. */}
      {vpnModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="هشدار VPN"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setVpnModalOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] shadow-2xl">
            {/* Header strip */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--amber)]/10 px-5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--amber)]/20 text-[var(--amber)]">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-medium text-[var(--text-primary)]">
                  قبل از اتصال، VPN خود را روشن کنید
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVpnModalOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                aria-label="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Body */}
            <div className="px-5 py-5">
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                اتصال به واتساپ از سرورهای متا (Facebook) رد می‌شود که در ایران
                بدون VPN باز نمی‌شوند. اگه VPN روشن نباشه، صفحهٔ متا بالا نمیاد.
                روشنش کن، بعد ادامه بده.
              </p>
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  اگر قبلاً VPN روشن کرده‌اید و صفحهٔ متا در مرورگر باز می‌شود،
                  می‌توانید ادامه دهید.
                </p>
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
              <button
                type="button"
                onClick={() => setVpnModalOpen(false)}
                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={confirmVpn}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90"
              >
                <CheckCircle2 className="h-4 w-4" />
                روشنه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trust note */}
      <p className="text-center text-[11px] leading-relaxed text-[var(--text-tertiary)]">
        اتصال مستقیم از طریق متا انجام می‌شود — vigent هیچ رمز عبوری ذخیره
        نمی‌کند. شما هر زمان می‌توانید از داشبورد متا دسترسی را لغو کنید.
      </p>
    </div>
  )
}

function PrereqItem({
  icon: Icon,
  children,
  tone = 'default',
}: {
  icon: LucideIcon
  children: ReactNode
  tone?: 'default' | 'brand'
}) {
  return (
    <li className="flex items-start gap-2.5">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          tone === 'brand' ? 'text-[#25D366]' : 'text-[var(--text-tertiary)]'
        }`}
      />
      <span className="flex-1 text-xs leading-relaxed text-[var(--text-secondary)]">
        {children}
      </span>
    </li>
  )
}

/**
 * Backward-compat alias, mirroring the Instagram wizard's alias pattern.
 */
export const WhatsAppConnectWizard = WhatsAppConnectFlow

export default WhatsAppConnectFlow

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Multi-number picker                                                       */
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
 * on the operator's account. The callback stashed the candidate numbers in a
 * short-lived `wa_oauth_pending` cookie (server-side read by the channels page
 * and passed here as `numbers`). The operator picks one; we POST its
 * `phoneNumberId` to `/api/agents/[agentId]/channels/whatsapp-connect`, which
 * reads the cookie, persists the channel for the chosen number, subscribes the
 * WABA to the global webhook, and clears the cookie.
 *
 * On success we hard-navigate to `?wa_connected=1` (mirroring the
 * single-number callback path) so the success banner shows.
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
        } else {
          setError('اتصال ناموفق بود. دوباره تلاش کنید.')
        }
        return
      }
      // Success — replace the URL so the picker disappears and the success
      // banner shows. We strip `wa_pick=1` and add `wa_connected=1`.
      router.replace(`/agents/${agentId}/channels?wa_connected=1`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  if (!numbers.length) {
    // Defensive: the cookie was present but empty / malformed. Tell the user
    // to retry rather than rendering an empty picker.
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
