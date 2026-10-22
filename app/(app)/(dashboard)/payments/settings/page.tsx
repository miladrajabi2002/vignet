import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PaymentsShell } from '@/components/payments/payments-shell'
import { GatewaySettings } from '@/components/payments/gateway-settings'
import { PhoneCard } from '@/components/payments/device-setup'
import { loadGatewayOverview } from '@/lib/payments/card/dashboard'
import { loadCheckoutStore } from '@/lib/payments/card/store'
import { gatewaySetupState } from '@/lib/payments/card/setup'
import { dashboardTitle } from '@/lib/dashboard/page-title'

export const generateMetadata = dashboardTitle('تنظیمات درگاه', 'Gateway settings')

export const dynamic = 'force-dynamic'

export default async function PaymentSettingsPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const [overview, store] = await Promise.all([loadGatewayOverview(user.workspaceId), loadCheckoutStore(user.workspaceId)])
  const device = overview.devices[0] ?? null
  // Payments that ran out unpaid while the phone was silent hint that its
  // forwarding stopped, not that nobody paid.
  const missedSince = device?.lastSmsAt
    ? await prisma.cardPayment.count({
        where: { workspaceId: user.workspaceId, status: 'EXPIRED', createdAt: { gt: new Date(device.lastSmsAt) }, NOT: { reference: { startsWith: 'TEST-' } } },
      })
    : 0
  return (
    <PaymentsShell active="settings" overview={overview} locale={locale}>
      <GatewaySettings
        enabled={overview.enabled}
        settings={overview.settings}
        hasCard={overview.cards.some((card) => card.active)}
        platformEnabled={overview.platformEnabled}
        agents={overview.agents}
        store={store}
        setupDone={gatewaySetupState(overview).done}
        phone={<PhoneCard device={device} line={overview.inboundLines[0] ?? null} missedSince={missedSince} />}
      />
    </PaymentsShell>
  )
}
