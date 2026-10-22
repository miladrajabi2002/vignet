import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import { requireUser } from '@/lib/session'
import { PaymentsShell } from '@/components/payments/payments-shell'
import { DeviceSetup } from '@/components/payments/device-setup'
import { loadGatewayOverview } from '@/lib/payments/card/dashboard'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('گوشی پیامک درگاه', 'Gateway SMS phone')

export const dynamic = 'force-dynamic'

/** The SMS phone's questions and guide once the gateway is live; reached from Settings. */
export default async function PaymentDevicesPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const fa = locale === 'fa'
  const overview = await loadGatewayOverview(user.workspaceId)
  return (
    <PaymentsShell active="devices" overview={overview} locale={locale}>
      <Link href="/payments/settings" className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />{fa ? 'بازگشت به تنظیمات' : 'Back to settings'}
      </Link>
      <DeviceSetup devices={overview.devices} inboundLines={overview.inboundLines} hasCard={overview.cards.some((card) => card.active)} agents={overview.agents} />
    </PaymentsShell>
  )
}
