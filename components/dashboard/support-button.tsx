'use client'

import { useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { Check, Copy, Headphones, Phone, Send } from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164,
  SUPPORT_TELEGRAM_URL,
} from '@/lib/marketing/contact'

export function SupportButton() {
  const fa = useLocale() !== 'en'
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(SUPPORT_PHONE_DISPLAY)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={fa ? 'پشتیبانی ویجنت' : 'Vigent support'}
        title={fa ? 'پشتیبانی' : 'Support'}
        className="spatial-press inline-flex h-12 w-12 items-center justify-center rounded-[1.15rem] border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[0_5px_18px_rgba(0,0,0,0.035)] transition-colors hover:border-black/[0.12] hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 xl:h-14 xl:w-14 xl:rounded-[1.35rem]"
      >
        <Headphones aria-hidden="true" className="h-4 w-4" />
      </button>

      <MobileBottomSheet
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        mobileOnly={false}
        title={fa ? 'پشتیبانی ویجنت' : 'Vigent support'}
        description={fa ? 'ارتباط مستقیم با تیم پشتیبانی در تلگرام' : 'Message the support team directly on Telegram'}
        closeLabel={fa ? 'بستن پنجره پشتیبانی' : 'Close support dialog'}
      >
        <div dir={fa ? 'rtl' : 'ltr'}>
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black text-white">
              <Send aria-hidden="true" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {fa ? 'برای پشتیبانی در تلگرام پیام بدهید' : 'Message us on Telegram for support'}
              </p>
              <p className="mt-1 text-xs leading-6 text-[var(--text-secondary)]">
                {fa
                  ? 'شماره زیر را در تلگرام باز کنید و موضوع یا تصویر خطا را بفرستید؛ پاسخ‌گویی مستقیم انجام می‌شود.'
                  : 'Open the number below in Telegram and send your question or a screenshot of the issue.'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl border border-black/10 bg-white px-3.5 shadow-[var(--shadow-xs)]">
            <Phone aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <bdi dir="ltr" className="min-w-0 flex-1 text-sm font-bold tabular-nums text-[var(--text-primary)]">
              {SUPPORT_PHONE_DISPLAY}
            </bdi>
            <button
              type="button"
              onClick={copyPhone}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-black/[0.045] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
            >
              {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
              {copied ? (fa ? 'کپی شد' : 'Copied') : (fa ? 'کپی' : 'Copy')}
            </button>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href={SUPPORT_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="spatial-press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white shadow-[var(--shadow-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              <Send aria-hidden="true" className="h-4 w-4" />
              {fa ? 'باز کردن تلگرام' : 'Open Telegram'}
            </a>
            <a
              href={`tel:${SUPPORT_PHONE_E164}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/12 bg-white px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-black/[0.035] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60"
            >
              <Phone aria-hidden="true" className="h-4 w-4" />
              {fa ? 'تماس تلفنی' : 'Call support'}
            </a>
          </div>
        </div>
      </MobileBottomSheet>
    </>
  )
}
