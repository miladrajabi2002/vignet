import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { PaymentsShell } from '@/components/payments/payments-shell'
import { GatewaySettings } from '@/components/payments/gateway-settings'
import { loadGatewayOverview } from '@/lib/payments/card/dashboard'
import { loadCheckoutStore } from '@/lib/payments/card/store'
import { gatewaySetupState } from '@/lib/payments/card/setup'

export const dynamic = 'force-dynamic'

export default async function PaymentSettingsPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const [overview, store] = await Promise.all([loadGatewayOverview(user.workspaceId), loadCheckoutStore(user.workspaceId)])
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
      />
    </PaymentsShell>
  )
}
