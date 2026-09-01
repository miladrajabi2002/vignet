'use client'

import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { CampaignComposer } from '@/components/crm/campaign-composer'
import type { CampaignAudienceInput } from '@/lib/campaigns/audience'

export function CampaignLaunchButton({
  audience,
  locale,
  disabled = false,
  label,
  compactOnMobile = false,
}: {
  audience: CampaignAudienceInput
  locale: 'fa' | 'en'
  disabled?: boolean
  label?: string
  compactOnMobile?: boolean
}) {
  const [open, setOpen] = useState(false)
  const buttonLabel = label ?? (locale === 'fa' ? 'ارسال پیام' : 'Send message')
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={buttonLabel}
        title={buttonLabel}
        className={`spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${compactOnMobile ? 'w-11 px-0 sm:w-auto sm:px-4' : 'px-4'}`}
      >
        <Megaphone className="h-4 w-4" aria-hidden="true" />
        <span className={compactOnMobile ? 'hidden sm:inline' : undefined}>
          {buttonLabel}
        </span>
      </button>
      {open && <CampaignComposer audience={audience} locale={locale} onClose={() => setOpen(false)} />}
    </>
  )
}
