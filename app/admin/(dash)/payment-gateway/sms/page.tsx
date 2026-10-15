import Link from 'next/link'
import { MessageSquareText } from 'lucide-react'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { GatewaySmsResolve } from '@/components/admin/gateway-admin-controls'
import { suggestPaymentsForSms } from '@/lib/payments/card/ingest'
import { AdminPagination, Badge, Card, EmptyState, FilterPills, fa, fmtDate } from '../../ui'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30
const FILTERS = [['unmatched', 'واریز بی‌سفارش'], ['matched', 'تطبیق‌خورده'], ['resolved', 'رسیدگی‌شده'], ['all', 'همه']] as const
type Filter = (typeof FILTERS)[number][0]

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' | 'info' }> = {
  MATCHED: { label: 'تطبیق خودکار', tone: 'success' },
  UNMATCHED: { label: 'بی‌سفارش', tone: 'warning' },
  RESOLVED: { label: 'رسیدگی‌شده', tone: 'info' },
  IGNORED: { label: 'نادیده', tone: 'muted' },
}

/**
 * Every forwarded deposit SMS (balance already removed). Unmatched ones can be
 * attached to the right payment here; their text is also how the reader of
 * bank messages gets better.
 */
export default async function AdminGatewaySmsPage(props: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  const searchParams = await props.searchParams
  const filter = (FILTERS.find(([key]) => key === searchParams.filter)?.[0] ?? 'unmatched') as Filter
  const page = Math.max(1, Number(searchParams.page) || 1)
  const where: Prisma.BankSmsWhereInput = filter === 'all' ? {} : { status: filter.toUpperCase() }
  const rows = await prisma.bankSms.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
    include: { workspace: { select: { id: true, name: true } }, payment: { select: { reference: true, baseAmount: true } } },
  })
  const visible = rows.slice(0, PAGE_SIZE)
  const suggestions = await Promise.all(visible.map((sms) => (sms.status === 'UNMATCHED' ? suggestPaymentsForSms(sms.workspaceId, sms.amount) : Promise.resolve([]))))
  const href = (next: { filter?: Filter; page?: number }) => {
    const params = new URLSearchParams()
    const f = next.filter ?? filter
    if (f !== 'unmatched') params.set('filter', f)
    if (next.page && next.page > 1) params.set('page', String(next.page))
    const query = params.toString()
    return query ? `/admin/payment-gateway/sms?${query}` : '/admin/payment-gateway/sms'
  }
  return (
    <div className="space-y-4">
      <div className="max-w-full overflow-x-auto"><FilterPills options={FILTERS.map(([key, label]) => ({ label, href: href({ filter: key }), active: filter === key }))} /></div>
      {visible.length === 0 ? (
        <EmptyState icon={<MessageSquareText />}>{filter === 'unmatched' ? 'واریز بی‌سفارشی نیست.' : 'پیامکی نیست.'}</EmptyState>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((sms, index) => {
            const status = STATUS[sms.status] ?? STATUS.IGNORED
            return (
              <li key={sms.id}>
                <Card pad={false} className="flex h-full flex-col gap-2.5 p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/payment-gateway/${sms.workspace.id}`} className="font-bold text-[var(--text-primary)] hover:underline">{sms.workspace.name}</Link>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span className="ms-auto text-[12px] text-[var(--text-muted)]">{fmtDate(sms.receivedAt)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    <span>{sms.amount != null ? <b className="tabular-nums">{fa(sms.amount)} تومان</b> : <span className="text-red-700">مبلغ خوانده نشد</span>}</span>
                    {sms.kind ? <span className="text-[12px] text-[var(--text-muted)]">نوع: {sms.kind}</span> : null}
                    {sms.payment ? <span className="text-[12px] text-[var(--text-secondary)]">→ <span dir="ltr" className="font-mono">#{sms.payment.reference}</span> · {fa(sms.payment.baseAmount)} تومان</span> : null}
                  </div>
                  {sms.text ? <pre dir="rtl" className="whitespace-pre-wrap rounded-control bg-[var(--bg-surface)] p-2.5 font-sans text-[12.5px] leading-6 text-[var(--text-secondary)]">{sms.text}</pre> : null}
                  {sms.status === 'UNMATCHED' ? (
                    <GatewaySmsResolve
                      smsId={sms.id}
                      suggestions={suggestions[index].map((payment) => ({ id: payment.id, label: `#${payment.reference} · ${fa(payment.payAmount)} تومان${payment.customerName ? ` · ${payment.customerName}` : ''}` }))}
                    />
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
      <AdminPagination page={page} hasNext={rows.length > PAGE_SIZE} makeHref={(next) => href({ page: next })} />
    </div>
  )
}
