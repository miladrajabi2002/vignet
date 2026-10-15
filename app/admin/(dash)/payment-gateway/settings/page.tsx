import { PaymentGatewayForm } from '@/components/admin/payment-gateway-form'
import { getPlatformGatewaySettings } from '@/lib/payments/card/platform'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentGatewaySettingsPage() {
  const settings = await getPlatformGatewaySettings(true)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
  return (
    <PaymentGatewayForm
      appUrl={appUrl}
      initial={{ enabled: settings.enabled, planMonthlyCaps: settings.planMonthlyCaps, inboundLines: settings.inboundLines, inboundSecret: settings.inboundSecret, maxAmount: settings.maxAmount }}
    />
  )
}
