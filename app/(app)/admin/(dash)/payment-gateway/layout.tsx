import type { ReactNode } from 'react'
import { WalletCards } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { GatewayAdminTabs } from '@/components/admin/gateway-admin-controls'
import { PageHeader } from '../ui'

export const dynamic = 'force-dynamic'

/** Admin «درگاه پرداخت»: one header and five sections. */
export default async function AdminPaymentGatewayLayout({ children }: { children: ReactNode }) {
  const [review, unmatched] = await Promise.all([
    prisma.cardPayment.count({ where: { status: 'CLAIMED' } }).catch(() => 0),
    prisma.bankSms.count({ where: { status: 'UNMATCHED' } }).catch(() => 0),
  ])
  return (
    <div className="space-y-5">
      <PageHeader
        title="درگاه پرداخت"
        subtitle="کارت‌به‌کارت خودکار کسب‌وکارها: پرداخت‌ها، گوشی‌ها، کارت‌ها، پیامک‌ها و سقف پلن‌ها"
        icon={WalletCards}
      />
      <GatewayAdminTabs badges={{ '/admin/payment-gateway/payments': review, '/admin/payment-gateway/sms': unmatched }} />
      {children}
    </div>
  )
}
