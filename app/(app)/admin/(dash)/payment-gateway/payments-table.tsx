import Link from 'next/link'
import type { CardPayment } from '@prisma/client'
import { BankMark } from '@/components/payments/bank-card'
import { GatewayPaymentActions } from '@/components/admin/gateway-admin-controls'
import { Badge, TableShell, Td, Th, fa, fmtDate } from '../ui'
import { CONFIRMED_BY, PAYMENT_STATUS, purposeLabel, toman } from './shared'

export type AdminPaymentRow = CardPayment & {
  card: { bankKey: string; last4: string; deletedAt?: Date | null }
  workspace?: { id: string; name: string }
  site: { name: string } | null
}

function actionsFor(payment: AdminPaymentRow, now: Date): Array<'confirm' | 'reject' | 'cancel' | 'callback'> {
  const actions: Array<'confirm' | 'reject' | 'cancel' | 'callback'> = []
  const late = payment.status === 'EXPIRED' && payment.holdUntil > now
  if (payment.status === 'PENDING' || payment.status === 'CLAIMED' || late) actions.push('confirm')
  if (payment.status === 'PENDING' || payment.status === 'CLAIMED') actions.push('reject')
  if (payment.status === 'PENDING') actions.push('cancel')
  if (payment.callbackUrl && ['PAID', 'FAILED', 'EXPIRED'].includes(payment.status) && (!payment.callbackDoneAt || payment.callbackError)) actions.push('callback')
  return actions
}

/** Payments across businesses (or of one), with support actions; cards on phones. */
export function AdminPaymentsTable({ rows, showBusiness }: { rows: AdminPaymentRow[]; showBusiness: boolean }) {
  const now = new Date()
  return (
    <TableShell minWidth={showBusiness ? 1080 : 940}>
      <thead className="border-b border-[var(--border-subtle)]">
        <tr>
          {showBusiness ? <Th>کسب‌وکار</Th> : null}
          <Th>مبلغ</Th>
          <Th>مبلغ دقیق</Th>
          <Th>نوع</Th>
          <Th>مشتری</Th>
          <Th>کارت</Th>
          <Th>وضعیت</Th>
          <Th>زمان</Th>
          <Th>اقدام</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--border-subtle)]">
        {rows.map((payment) => {
          const status = PAYMENT_STATUS[payment.status] ?? PAYMENT_STATUS.CANCELLED
          return (
            <tr key={payment.id} className="align-middle">
              {showBusiness ? (
                <Td>{payment.workspace ? <Link href={`/admin/payment-gateway/${payment.workspace.id}`} className="font-bold text-[var(--text-primary)] hover:underline">{payment.workspace.name}</Link> : '—'}</Td>
              ) : null}
              <Td>
                <span className="block font-bold tabular-nums text-[var(--text-primary)]">{toman(payment.baseAmount)}</span>
                <span dir="ltr" className="block font-mono text-[11.5px] text-[var(--text-muted)]">#{payment.reference}</span>
              </Td>
              <Td><span dir="ltr" className="font-mono">{payment.payAmount.toLocaleString('en-US')}</span></Td>
              <Td>
                <span className="block">{purposeLabel(payment)}</span>
                {payment.reference.startsWith('TEST-') ? <Badge tone="muted">واریز آزمایشی</Badge> : null}
                {payment.site ? <span className="block text-[11.5px] text-[var(--text-muted)]">{payment.site.name}</span> : payment.description ? <span className="block max-w-[14rem] truncate text-[11.5px] text-[var(--text-muted)]" title={payment.description}>{payment.description}</span> : null}
              </Td>
              <Td>
                <span className="block">{payment.customerName ?? '—'}</span>
                {payment.customerPhone ? <span dir="ltr" className="block text-[11.5px] text-[var(--text-muted)]">{payment.customerPhone}</span> : null}
              </Td>
              <Td>
                <span className="inline-flex items-center gap-1.5"><BankMark bankKey={payment.card.bankKey} size={22} /><span dir="ltr" className="font-mono">…{payment.card.last4}</span></span>
                {payment.card.deletedAt ? <span className="block text-[11.5px] text-[var(--text-muted)]">کارت حذف‌شده</span> : null}
              </Td>
              <Td>
                <Badge tone={status.tone}>{status.label}</Badge>
                {payment.status === 'PAID' && payment.confirmedBy ? <span className="mt-1 block text-[11.5px] text-[var(--text-muted)]">{CONFIRMED_BY[payment.confirmedBy] ?? payment.confirmedBy}</span> : null}
                {payment.callbackError ? <span className="mt-1 block max-w-[12rem] truncate text-[11.5px] text-red-700" title={payment.callbackError}>کالبک: {payment.callbackError}</span> : null}
              </Td>
              <Td>
                <span className="block whitespace-nowrap">{fmtDate(payment.createdAt)}</span>
                {payment.paidAt ? <span className="block whitespace-nowrap text-[11.5px] text-emerald-700">پرداخت {fmtDate(payment.paidAt)}</span> : null}
                {payment.conversationId ? <Link href={`/admin/conversations/${payment.conversationId}`} className="ui-link text-[11.5px]">گفتگو</Link> : null}
              </Td>
              <Td><GatewayPaymentActions paymentId={payment.id} actions={actionsFor(payment, now)} /></Td>
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}

export function paymentCountLabel(total: number): string {
  return `${fa(total)} تراکنش`
}
