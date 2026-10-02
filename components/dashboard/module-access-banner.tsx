'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, PanelRightOpen, Power } from 'lucide-react'
import { enableCapability } from '@/components/services/enable-booking'
import {
  BUSINESS_SERVICE_OPTIONS,
  getDashboardModuleLabel,
  getDashboardModules,
  type BusinessTypeValue,
  type CapabilityKey,
  type DashboardModuleKey,
} from '@/lib/verticals/registry'

// Optional sections and the capability that puts each one in the menu.
const SECTIONS: Array<{ prefix: string; module: DashboardModuleKey; capability: CapabilityKey }> = [
  { prefix: '/products', module: 'products', capability: 'products' },
  { prefix: '/menu', module: 'menu', capability: 'digital-menu' },
  { prefix: '/appointments', module: 'appointments', capability: 'bookings' },
  { prefix: '/services', module: 'services', capability: 'services' },
  { prefix: '/instagram', module: 'instagram', capability: 'instagram' },
  { prefix: '/courses', module: 'courses', capability: 'courses' },
]

const NO_CAPABILITIES: readonly CapabilityKey[] = []

/**
 * Deep links (channels → Instagram, integrations → products, …) can land on a
 * section whose capability is switched off, so it is missing from the menu
 * and the user loses their way back. Say the capability is off, and offer to
 * turn it on here or from Settings.
 */
export function ModuleAccessBanner({
  businessType,
  capabilities = NO_CAPABILITIES,
}: {
  businessType?: BusinessTypeValue | null
  capabilities?: readonly CapabilityKey[]
}) {
  const pathname = usePathname()
  const router = useRouter()
  const locale = useLocale()
  const fa = locale !== 'en'
  const t = useTranslations('dashboard')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const capabilitiesKey = capabilities.join(',')

  const section = SECTIONS.find((item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`))
  const missing = useMemo(
    () => Boolean(section) && !getDashboardModules(capabilitiesKey ? capabilitiesKey.split(',') as CapabilityKey[] : []).includes(section!.module),
    [section, capabilitiesKey],
  )
  if (!section || !missing || added === section.module) return null

  const option = BUSINESS_SERVICE_OPTIONS.find((item) => item.key === section.capability)
  const sectionLabel = getDashboardModuleLabel(section.module, businessType, locale, t(section.module))
  const optionLabel = option ? (fa ? option.fa : option.en) : sectionLabel

  async function add() {
    setBusy(true)
    setFailed(false)
    const ok = await enableCapability(section!.capability, fa ? 'fa' : 'en')
    setBusy(false)
    if (!ok) { setFailed(true); return }
    setAdded(section!.module)
    router.refresh()
  }

  return (
    <div className="mx-auto mb-4 flex max-w-6xl flex-col gap-3 rounded-2xl border border-[var(--signal-border)] bg-[var(--signal-soft)] px-4 py-3 sm:flex-row sm:items-center" role="status">
      <PanelRightOpen className="hidden h-5 w-5 shrink-0 text-[var(--signal-strong)] sm:block" />
      <div className="min-w-0 flex-1 text-[var(--signal-strong)]">
        <p className="text-[13px] font-bold">{t('moduleOffTitle', { capability: optionLabel })}</p>
        <p className="text-[12px] leading-6 opacity-80">
          {failed ? t('moduleOffFailed') : t('moduleOffBody', { section: sectionLabel })}
        </p>
      </div>
      <div className="flex gap-2">
        <Link href="/settings#settings-business-profile" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-xs font-bold text-[var(--signal-strong)] hover:bg-[var(--signal-tint)] sm:flex-none">
          {t('moduleOffSettings')}
        </Link>
        <button type="button" onClick={() => void add()} disabled={busy} className="spatial-press inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--signal-strong)] px-3.5 text-xs font-bold text-white disabled:opacity-60 sm:flex-none">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
          {t('moduleOffEnable')}
        </button>
      </div>
    </div>
  )
}
