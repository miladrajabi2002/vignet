import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { PaymentsShell } from '@/components/payments/payments-shell'
import { DeviceSetup } from '@/components/payments/device-setup'
import { loadGatewayOverview } from '@/lib/payments/card/dashboard'

export const dynamic = 'force-dynamic'

export default async function PaymentDevicesPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const overview = await loadGatewayOverview(user.workspaceId)
  const activeCards = overview.cards.filter((card) => card.active)
  return (
    <PaymentsShell active="devices" overview={overview} locale={locale}>
      <DeviceSetup
        devices={overview.devices}
        inboundLines={overview.inboundLines}
        hasCard={activeCards.length > 0}
        cardBanks={[...new Set(activeCards.map((card) => card.bankKey))]}
      />
    </PaymentsShell>
  )
}
