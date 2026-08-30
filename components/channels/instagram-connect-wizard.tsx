'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  ShieldCheck,
  KeyRound,
  MessagesSquare,
  Unplug,
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
  returnTo,
}: {
  agentId: string
  onClose?: () => void
  /**
   * Internal path the OAuth callback should send the user back to after
   * connecting (e.g. "/instagram" when the flow starts from the Instagram
   * workspace tab). Defaults to the agent channels page.
   */
  returnTo?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vpnModalOpen, setVpnModalOpen] = useState(false)
  const [trustModalOpen, setTrustModalOpen] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  // VPN warning modal: BEFORE the OAuth flow starts, the operator must
  // confirm their VPN is on. Instagram's OAuth + Graph servers are blocked
  // from Iranian IPs without a VPN, so the flow will silently fail (the
  // Instagram dialog page won't even load). The modal intercepts the
  // "اتصال اینستاگرام" click and only proceeds once the user confirms.
  useEffect(() => {
    if (!vpnModalOpen && !trustModalOpen) return

    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>('[data-autofocus]')
        ?.focus()
    }, 0)

    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setVpnModalOpen(false)
        setTrustModalOpen(false)
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [trustModalOpen, vpnModalOpen])

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
        body: JSON.stringify({ agentId, returnTo }),
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
        } else if (data.error === 'CHANNEL_LIMIT') {
          setError('سهمیه اتصال کانال پلن شما تکمیل شده است. یک کانال را حذف کنید یا پلن را ارتقا دهید.')
        } else if (res.status >= 500) {
          setError('سرویس اتصال اینستاگرام موقتاً در دسترس نیست. چند دقیقه دیگر دوباره تلاش کنید.')
        } else {
          setError('شروع اتصال ناموفق بود. دوباره تلاش کنید.')
        }
        return
      }
      // Full-page redirect to Instagram's OAuth dialog. After the user
      // authorizes, Meta redirects to /api/instagram/oauth/callback which
      // connects the channel immediately and redirects back to `returnTo`
      // (or the channels page) with ?ig_connected=1 (or ?ig_error=... on
      // failure).
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
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--border-default)] bg-white shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--border-subtle)] bg-[linear-gradient(135deg,#fff_0%,#fff_58%,rgba(221,42,123,0.06)_100%)] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-[0_10px_24px_-14px_rgba(221,42,123,0.85)]">
              <Camera className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  اتصال رسمی به اینستاگرام
                </h3>
                <span className="rounded-full border border-emerald-600/15 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  بدون ساخت اپ متا
                </span>
              </div>
              <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                وارد صفحه رسمی Instagram می‌شوید، دسترسی‌ها را تأیید می‌کنید و خودکار به ویجنت برمی‌گردید.
              </p>
            </div>
          </div>

          <ol className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="مراحل اتصال اینستاگرام">
            {[
              ['۱', 'ورود در Instagram'],
              ['۲', 'تأیید پیام و کامنت'],
              ['۳', 'بازگشت و شروع کار'],
            ].map(([step, label]) => (
              <li key={step} className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-white/80 px-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[var(--text-primary)] text-[10px] font-bold text-white">
                  {step}
                </span>
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">{label}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-5 sm:p-6">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs font-semibold text-[var(--text-primary)]">قبل از اتصال</p>
            <ul className="mt-3 space-y-2.5">
              <PrereqItem icon={CheckCircle2} tone="brand">
                اکانت باید <b>Business یا Creator</b> باشد؛ اکانت شخصی را از بخش Account type and tools حرفه‌ای کنید.
              </PrereqItem>
              <PrereqItem icon={Smartphone}>
                اتصال را در <b>مرورگر</b> انجام دهید؛ در موبایل لینک را با Chrome باز کنید.
              </PrereqItem>
              <PrereqItem icon={Monitor}>
                برای روند پایدارتر، دسکتاپ پیشنهاد می‌شود؛ اتصال در موبایل هم پشتیبانی می‌شود.
              </PrereqItem>
            </ul>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTrustModalOpen(true)}
              aria-haspopup="dialog"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-primary)] transition-[transform,border-color,background-color] duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] active:scale-[0.97]"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              چجوری بهتون اعتماد کنیم؟
            </button>
            <a
              href="/docs/instagram-connection"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-3 text-xs font-semibold text-[var(--text-secondary)] transition-[transform,border-color,background-color,color] duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-[0.97]"
            >
              <BookOpen className="h-4 w-4" />
              راهنمای کامل اتصال
              <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
            </a>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-xs text-danger" role="alert">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={onConnectClick}
            disabled={busy}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--text-primary)] px-5 text-sm font-semibold text-white shadow-[var(--shadow-control)] transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {busy ? 'در حال انتقال به اینستاگرام…' : 'ادامه در Instagram'}
          </button>
          <p className="mt-2 text-center text-[10px] leading-5 text-[var(--text-muted)]">
            رمز عبور را فقط در صفحه Instagram وارد می‌کنید؛ ویجنت آن را دریافت یا ذخیره نمی‌کند.
          </p>

          <button
            type="button"
            onClick={back}
            disabled={busy}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            بازگشت به کانال‌ها
          </button>
        </div>
      </div>

      {/* VPN warning modal — shown when the user clicks "اتصال اینستاگرام".
          Must be confirmed before the OAuth flow starts. */}
      {vpnModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="presentation">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setVpnModalOpen(false)}
            aria-hidden
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="instagram-vpn-title"
            aria-describedby="instagram-vpn-description"
            className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] shadow-2xl"
          >
            {/* Header strip */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--amber)]/10 px-5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--amber)]/20 text-[var(--amber)]">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <h3 id="instagram-vpn-title" className="text-sm font-medium text-[var(--text-primary)]">
                  قبل از اتصال، VPN خود را روشن کنید
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVpnModalOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70"
                aria-label="بستن"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Body */}
            <div className="px-5 py-5">
              <p id="instagram-vpn-description" className="text-sm leading-relaxed text-[var(--text-secondary)]">
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
                data-autofocus
                type="button"
                onClick={() => setVpnModalOpen(false)}
                className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border-default)] px-4 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={confirmVpn}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-black px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                روشنه
              </button>
            </div>
          </div>
            </div>,
            document.body,
          )
        : null}

      {trustModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" role="presentation">
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setTrustModalOpen(false)}
                aria-hidden
              />
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="instagram-trust-title"
                aria-describedby="instagram-trust-description"
                className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-[1.5rem] border border-[var(--border-default)] bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                      <ShieldCheck className="h-[1.1rem] w-[1.1rem]" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold text-emerald-700">اتصال شفاف و قابل لغو</p>
                      <h3 id="instagram-trust-title" className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
                        چجوری بهتون اعتماد کنیم؟
                      </h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrustModalOpen(false)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70"
                    aria-label="بستن"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-5 py-5 sm:px-6">
                  <p id="instagram-trust-description" className="text-sm leading-7 text-[var(--text-secondary)]">
                    اتصال در صفحه رسمی Instagram انجام می‌شود و قبل از تأیید، خود اینستاگرام دسترسی‌های درخواستی را به شما نشان می‌دهد.
                  </p>
                  <div className="mt-5 space-y-2.5">
                    <TrustItem icon={KeyRound} title="رمز عبور دست ما نمی‌رسد">
                      رمز را فقط در دامنه Instagram وارد می‌کنید؛ ویجنت رمز عبور شما را نمی‌بیند و ذخیره نمی‌کند.
                    </TrustItem>
                    <TrustItem icon={MessagesSquare} title="دسترسی‌ها مشخص و محدودند">
                      فقط پروفایل حرفه‌ای، پیام‌ها و کامنت‌ها برای پاسخ‌گویی و اتوماسیون درخواست می‌شوند؛ همان مواردی که در صفحه تأیید می‌بینید.
                    </TrustItem>
                    <TrustItem icon={Unplug} title="هر زمان خواستید قطعش کنید">
                      می‌توانید کانال را از ویجنت حذف کنید یا دسترسی برنامه را از تنظیمات Instagram لغو کنید.
                    </TrustItem>
                  </div>

                  <div className="mt-5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-[11px] leading-6 text-[var(--text-secondary)]">
                    مسیر قابل بررسی است: دکمه اتصال شما را به <b className="text-[var(--text-primary)]">api.instagram.com</b> می‌فرستد و پس از تأیید به ویجنت برمی‌گرداند.
                  </div>
                </div>

                <div className="flex items-center justify-end border-t border-[var(--border-subtle)] px-5 py-4 sm:px-6">
                  <button
                    data-autofocus
                    type="button"
                    onClick={() => setTrustModalOpen(false)}
                    className="inline-flex min-h-11 items-center rounded-xl bg-black px-5 text-sm font-semibold text-white transition-[transform,opacity] duration-150 hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2"
                  >
                    متوجه شدم
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function TrustItem({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] p-3.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="mt-1 text-[11px] leading-6 text-[var(--text-secondary)]">{children}</p>
      </div>
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
