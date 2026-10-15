import { WalletCards } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { PaymentGatewayForm } from '@/components/admin/payment-gateway-form'
import { getPlatformGatewaySettings, monthStart } from '@/lib/payments/card/platform'
import { PageHeader, Panel, fa, fmtDate } from '../ui'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentGatewayPage() {
  const since = monthStart()
  const [settings, enabledCount, paid, auto, claimed, unmatched] = await Promise.all([
    getPlatformGatewaySettings(true),
    prisma.workspace.count({ where: { payGatewayEnabled: true } }),
    prisma.cardPayment.aggregate({ where: { status: 'PAID', paidAt: { gte: since } }, _count: true, _sum: { baseAmount: true } }),
    prisma.cardPayment.count({ where: { status: 'PAID', paidAt: { gte: since }, confirmedBy: 'AUTO' } }),
    prisma.cardPayment.count({ where: { status: 'CLAIMED' } }),
    prisma.bankSms.findMany({ where: { status: 'UNMATCHED' }, orderBy: { receivedAt: 'desc' }, take: 15, include: { workspace: { select: { name: true } } } }),
  ])
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://vigent.ir').replace(/\/$/, '')
  return (
    <div className="space-y-6">
      <PageHeader title="درگاه پرداخت" subtitle="کارت‌به‌کارت خودکار با پیامک بانک: سقف پلن‌ها، سامانهٔ پیامکی و وضعیت" icon={WalletCards} />
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['کسب‌وکار با درگاه روشن', fa(enabledCount)],
          ['پرداخت تأییدشدهٔ این ماه', fa(paid._count)],
          ['تأیید خودکار', paid._count ? `${fa(Math.round((auto / paid._count) * 100))}٪` : '—'],
          ['منتظر بررسی صاحب کسب‌وکار', fa(claimed)],
        ].map(([label, value]) => (
          <div key={label} className="spatial-surface rounded-card p-4">
            <p className="text-[12.5px] text-[var(--text-muted)]">{label}</p>
            <p className="mt-1 text-[22px] font-bold">{value}</p>
          </div>
        ))}
      </div>
      <PaymentGatewayForm
        appUrl={appUrl}
        initial={{ enabled: settings.enabled, planMonthlyCaps: settings.planMonthlyCaps, inboundLines: settings.inboundLines, inboundSecret: settings.inboundSecret, maxAmount: settings.maxAmount }}
      />
      <Panel title="واریزهای بدون سفارش (برای بهتر کردن خواندن پیامک)">
        {unmatched.length === 0 ? (
          <p className="text-[13px] text-[var(--text-muted)]">موردی نیست.</p>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {unmatched.map((sms) => (
              <li key={sms.id} className="py-2.5 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{sms.workspace.name}</b>
                  <span className="text-[var(--text-muted)]">{sms.amount != null ? `${fa(sms.amount)} تومان` : 'مبلغ خوانده نشد'}</span>
                  <span className="ms-auto text-[12px] text-[var(--text-muted)]">{fmtDate(sms.receivedAt)}</span>
                </div>
                <pre dir="rtl" className="mt-1.5 whitespace-pre-wrap rounded-control bg-[var(--bg-surface)] p-2 text-[12px] leading-6 text-[var(--text-secondary)]">{sms.text}</pre>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
