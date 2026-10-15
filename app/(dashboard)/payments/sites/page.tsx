import { getLocale } from 'next-intl/server'
import { requireUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { PaymentsShell } from '@/components/payments/payments-shell'
import { SitesManager } from '@/components/payments/sites-manager'
import { loadGatewayOverview } from '@/lib/payments/card/dashboard'

export const dynamic = 'force-dynamic'

export default async function PaymentSitesPage() {
  const user = await requireUser()
  const locale = (await getLocale()) === 'en' ? 'en' : 'fa'
  const [overview, sites] = await Promise.all([
    loadGatewayOverview(user.workspaceId),
    prisma.paySite.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { payments: true } } } }),
  ])
  return (
    <PaymentsShell active="sites" overview={overview} locale={locale}>
      <SitesManager
        sites={sites.map((site) => ({
          id: site.id,
          name: site.name,
          domain: site.domain,
          keyHint: site.keyHint,
          active: site.active,
          lastUsedAt: site.lastUsedAt?.toISOString() ?? null,
          payments: site._count.payments,
        }))}
      />
    </PaymentsShell>
  )
}
