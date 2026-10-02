'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { BookOpen, Check, Copy, Headphones, Phone, Send, Sparkles } from 'lucide-react'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import {
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_E164,
  SUPPORT_TELEGRAM_URL,
} from '@/lib/marketing/contact'

/**
 * Header support entry. The sheet leads with the two ways to reach a person
 * (call, Telegram message) as equal, tappable rows, then the number itself
 * with copy, then self-serve links. It is a bottom sheet on phones and a
 * centred dialog on larger screens (MobileBottomSheet, mobileOnly=false).
 */
export function SupportButton() {
  const fa = useLocale() !== 'en'
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const phone = fa ? SUPPORT_PHONE_DISPLAY.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]) : SUPPORT_PHONE_DISPLAY

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(SUPPORT_PHONE_DISPLAY)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      setCopied(false)
    }
  }

  const row = 'spatial-press flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-white px-3.5 text-start shadow-[var(--shadow-xs)] hover:border-[var(--border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]'

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={fa ? 'پشتیبانی ویجنت' : 'Vigent support'}
        title={fa ? 'پشتیبانی' : 'Support'}
        className="spatial-press inline-flex h-12 w-12 items-center justify-center rounded-card border border-black/[0.07] bg-white/80 text-[var(--text-muted)] shadow-[var(--elev-1)] transition-colors hover:border-black/[0.12] hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 xl:h-14 xl:w-14 xl:rounded-card"
      >
        <Headphones aria-hidden="true" className="h-4 w-4" />
      </button>

      <MobileBottomSheet
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        mobileOnly={false}
        title={fa ? 'پشتیبانی ویجنت' : 'Vigent support'}
        description={fa ? 'یک نفر از تیم ما جواب می‌دهد؛ هر راهی راحت‌تر است.' : 'A real person from our team answers — pick whichever is easier.'}
        closeLabel={fa ? 'بستن پنجره پشتیبانی' : 'Close support dialog'}
      >
        <div dir={fa ? 'rtl' : 'ltr'} className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <a href={`tel:${SUPPORT_PHONE_E164}`} className={row}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--text-primary)] text-white"><Phone aria-hidden="true" className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'تماس تلفنی' : 'Call us'}</span>
                <span className="block text-[12px] text-[var(--text-muted)]">{fa ? 'سریع‌ترین راه' : 'The fastest way'}</span>
              </span>
            </a>
            <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={row}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-[#0369a1]"><Send aria-hidden="true" className="h-[18px] w-[18px] -rotate-12" /></span>
              <span className="min-w-0">
                <span className="block text-[15px] font-bold text-[var(--text-primary)]">{fa ? 'پیام در تلگرام' : 'Message on Telegram'}</span>
                <span className="block text-[12px] text-[var(--text-muted)]">{fa ? 'با اسکرین‌شات خطا' : 'Send a screenshot'}</span>
              </span>
            </a>
          </div>

          <div className="flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--bg-surface)] px-3.5">
            <span className="text-[12px] text-[var(--text-muted)]">{fa ? 'شماره پشتیبانی' : 'Support number'}</span>
            <bdi dir="ltr" className="ms-auto text-[15px] font-bold tabular-nums text-[var(--text-primary)]">{phone}</bdi>
            <button
              type="button"
              onClick={copyPhone}
              aria-label={fa ? 'کپی شماره پشتیبانی' : 'Copy support number'}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-[var(--ok)]" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
              {copied ? (fa ? 'کپی شد' : 'Copied') : (fa ? 'کپی' : 'Copy')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] pt-3">
            <Link href="/vigento" onClick={() => setOpen(false)} className="spatial-press flex min-h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
              <Sparkles aria-hidden="true" className="h-4 w-4 text-[var(--signal)]" />
              {fa ? 'پرسیدن از ویجنتو' : 'Ask Vigento'}
            </Link>
            <Link href="/docs" onClick={() => setOpen(false)} className="spatial-press flex min-h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
              <BookOpen aria-hidden="true" className="h-4 w-4" />
              {fa ? 'مستندات' : 'Docs'}
            </Link>
          </div>
        </div>
      </MobileBottomSheet>
    </>
  )
}
