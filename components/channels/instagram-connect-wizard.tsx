'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Camera,
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
  type LucideIcon,
} from 'lucide-react'

/**
 * Instagram connection flow — platform-managed OAuth (the Vardast/ManyChat model).
 *
 * The operator never creates a Meta App, never pastes a token, never configures
 * a webhook. They click "اتصال اینستاگرام" → we redirect them directly to
 * Instagram's OAuth dialog (api.instagram.com) → Meta redirects back to our
 * callback → we exchange the code, fetch the IG profile, and persist the channel.
 *
 * This component renders:
 *   - a prerequisites card (shown FIRST, before any connect button)
 *   - the prominent black "اتصال اینستاگرام" button that starts the OAuth flow
 *   - a loading state during the round-trip to the start endpoint
 *   - a back button that closes the inline panel
 *
 * The OAuth flow itself happens off-site (on api.instagram.com). The channels
 * page (not this component) handles the redirect-back via query params
 * (`?ig_connected=1`, `?ig_error=...`).
 */
export function InstagramConnectFlow({
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
  // confirm their VPN is on. Instagram's OAuth + Graph servers are blocked
  // from Iranian IPs without a VPN, so the flow will silently fail (the
  // Instagram dialog page won't even load). The modal intercepts the
  // "اتصال اینستاگرام" click and only proceeds once the user confirms.
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
      // Ask the backend for the signed Instagram OAuth dialog URL. The backend
      // verifies the user owns the agent, signs a state token (HMAC), and
      // returns the URL we should redirect the browser to.
      const res = await fetch('/api/instagram/oauth/start', {
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
            'خطای سرور هنگام ساخت URL اتصال. احتمالاً INSTAGRAM_APP_ID یا INSTAGRAM_APP_SECRET در .env تنظیم نشده. ' +
              'راهنما: این مقادیر را از App Dashboard → Instagram → API Setup with Instagram Login بگیرید ' +
              '(با Facebook App ID فرق دارد!).',
          )
        } else {
          setError('شروع اتصال ناموفق بود. دوباره تلاش کنید.')
        }
        return
      }
      // Full-page redirect to Instagram's OAuth dialog. After the user
      // authorizes, Meta redirects to /api/instagram/oauth/callback which
      // connects the channel immediately and redirects to the channels page
      // with ?ig_connected=1 (or ?ig_error=... on failure).
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white">
            <Camera className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              اتصال اینستاگرام
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              با یک کلیک، مستقیم از طریق اینستاگرام
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
              اکانت اینستاگرام شما باید از نوع{' '}
              <b>Business یا Creator</b> باشد (اکانت شخصی قابل اتصال نیست). برای
              تغییر: اپ اینستاگرام → تنظیمات → Account type and tools → Switch to
              professional account
            </PrereqItem>
            <PrereqItem icon={Smartphone}>
              مراحل اتصال را حتماً در <b>مرورگر</b> انجام دهید (نه داخل اپلیکیشن
              اینستاگرام) — در موبایل لینک را در Chrome باز کنید.
            </PrereqItem>
            <PrereqItem icon={Monitor}>
              توصیه: اتصال را روی <b>دسکتاپ</b> انجام دهید برای اطمینان از تکمیل
              فرآیند.
            </PrereqItem>
            <PrereqItem icon={CheckCircle2} tone="brand">
              نیازی به فیسبوک یا ساخت اپ متا نیست — فقط دکمه اتصال را بزنید و
              اجازه دسترسی بدهید.
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
              <Camera className="h-4 w-4" />
            )}
            {busy ? 'در حال انتقال به اینستاگرام…' : 'اتصال اینستاگرام'}
          </button>
        </div>
      </div>

      {/* VPN warning modal — shown when the user clicks "اتصال اینستاگرام".
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
                اتصال به اینستاگرام از سرورهای متا رد می‌شود که در ایران بدون VPN باز
                نمی‌شوند. اگه VPN روشن نباشه، صفحه اینستاگرام بالا نمیاد. روشنش کن،
                بعد ادامه بده.
              </p>
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  اگر قبلاً VPN روشن کرده‌اید و صفحه اینستاگرام در مرورگر باز می‌شود،
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
        اتصال مستقیم از طریق اینستاگرام انجام می‌شود — vigent هیچ رمز عبوری ذخیره نمی‌کند.
        شما هر زمان می‌توانید از داشبورد اینستاگرام دسترسی را لغو کنید.
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
          tone === 'brand' ? 'text-[#dd2a7b]' : 'text-[var(--text-tertiary)]'
        }`}
      />
      <span className="flex-1 text-xs leading-relaxed text-[var(--text-secondary)]">
        {children}
      </span>
    </li>
  )
}

/**
 * Backward-compat alias. The previous wizard was exported as
 * `InstagramConnectWizard`; messenger-channel.tsx imports that name. Keep the
 * alias so any stray import still resolves to the new flow.
 */
export const InstagramConnectWizard = InstagramConnectFlow
