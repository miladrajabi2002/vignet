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
}: {
  audience: CampaignAudienceInput
  locale: 'fa' | 'en'
  disabled?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-black px-4 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Megaphone className="h-4 w-4" aria-hidden="true" />
        {label ?? (locale === 'fa' ? 'ارسال پیام' : 'Send message')}
      </button>
      {open && <CampaignComposer audience={audience} locale={locale} onClose={() => setOpen(false)} />}
    </>
  )
}
