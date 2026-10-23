'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { UserCheck } from 'lucide-react'

/**
 * Audience ↔ customer (Contact.identifiedAt). An audience row only messaged or
 * ran an Instagram scenario; the owner can move it into the customers list.
 */
export function ContactCustomerToggle({ contactId, identified }: { contactId: string; identified: boolean }) {
  const t = useTranslations('contacts')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identified: !identified }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error === 'CUSTOMER_LIMIT' ? t('detail.markLimit') : t('detail.markFailed'))
        return
      }
      router.refresh()
    } catch {
      setError(t('detail.markFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (identified) {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className="text-[12px] text-[var(--text-muted)] underline-offset-4 hover:underline disabled:opacity-60"
      >
        {t('detail.unmarkCustomer')}
      </button>
    )
  }

  return (
    <section className="rounded-card border border-amber-200 bg-amber-50/70 p-4 sm:p-5" aria-labelledby="audience-title">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[12rem] flex-1">
          <h2 id="audience-title" className="text-[14px] font-semibold text-[var(--text-primary)]">{t('detail.audienceTitle')}</h2>
          <p className="mt-1 text-[12.5px] leading-6 text-[var(--text-secondary)]">{t('detail.audienceHint')}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="spatial-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--text-primary)] px-4 text-[13px] font-semibold text-white shadow-[var(--shadow-control)] disabled:opacity-60"
        >
          <UserCheck className="size-4" aria-hidden />
          {t('detail.markCustomer')}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-[12.5px] text-red-700">{error}</p>}
    </section>
  )
}
