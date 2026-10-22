import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { GatewayBusinessRow, GatewayBusinessState } from '@/lib/admin/payment-gateway'
import { Badge, Progress, TableShell, Td, Th, fa, fmtDate } from '../ui'

type Tone = 'default' | 'info' | 'muted' | 'success' | 'warning' | 'danger'

export const PLAN_FA: Record<string, string> = { TRIAL: 'آزمایشی', STARTER: 'استارتر', PRO: 'حرفه‌ای', BUSINESS: 'سازمانی' }

export const STATE_BADGE: Record<GatewayBusinessState, { label: string; tone: Tone }> = {
  live: { label: 'فعال و آماده', tone: 'success' },
  setup: { label: 'راه‌اندازی ناتمام', tone: 'warning' },
  off: { label: 'خاموش', tone: 'muted' },
  suspended: { label: 'متوقف (ادمین)', tone: 'danger' },
}

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: 'منتظر واریز', tone: 'warning' },
  CLAIMED: { label: 'منتظر بررسی', tone: 'danger' },
  PAID: { label: 'پرداخت‌شده', tone: 'success' },
  EXPIRED: { label: 'منقضی', tone: 'muted' },
  FAILED: { label: 'رد شد', tone: 'danger' },
  CANCELLED: { label: 'لغو شد', tone: 'muted' },
}

export const CONFIRMED_BY: Record<string, string> = { AUTO: 'خودکار', OWNER: 'دستی (پنل)', OPERATOR: 'ربات مدیر', ADMIN: 'ادمین' }

export function purposeLabel(payment: { purpose: string; source: string }): string {
  if (payment.purpose === 'BOOKING') return 'بیعانهٔ نوبت'
  if (payment.purpose === 'COURSE') return 'ثبت‌نام دوره'
  return payment.source === 'API' ? 'سایت (API)' : payment.source === 'LINK' ? 'لینک دستی' : 'سفارش در گفتگو'
}

export function toman(value: number): string {
  return `${fa(value)} تومان`
}

export function ago(date: Date | null): string {
  if (!date) return '—'
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000))
  if (minutes < 1) return 'همین حالا'
  if (minutes < 60) return `${fa(minutes)} دقیقه پیش`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${fa(hours)} ساعت پیش`
  return `${fa(Math.round(hours / 24))} روز پیش`
}

function attentionChips(row: GatewayBusinessRow) {
  const chips: Array<{ label: string; tone: Tone }> = []
  if (row.review) chips.push({ label: `${fa(row.review)} منتظر بررسی`, tone: 'danger' })
  if (row.unmatched) chips.push({ label: `${fa(row.unmatched)} واریز بی‌سفارش`, tone: 'warning' })
  if (row.silentDevice) chips.push({ label: 'گوشی ساکت', tone: 'danger' })
  if (row.cap != null && row.monthPaid >= row.cap * 0.9) chips.push({ label: row.monthPaid >= row.cap ? 'سقف پر شد' : 'نزدیک سقف', tone: 'warning' })
  return chips
}

/** The businesses table (stacks into cards on phones). */
export function GatewayBusinessesTable({ rows }: { rows: GatewayBusinessRow[] }) {
  return (
    <TableShell minWidth={980}>
      <thead className="border-b border-[var(--border-subtle)]">
        <tr>
          <Th>کسب‌وکار</Th>
          <Th>وضعیت</Th>
          <Th>این ماه</Th>
          <Th>حجم این ماه</Th>
          <Th>خودکار</Th>
          <Th>گوشی</Th>
          <Th>کارت</Th>
          <Th>نیاز به توجه</Th>
          <Th />
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--border-subtle)]">
        {rows.map((row) => {
          const state = STATE_BADGE[row.state]
          const chips = attentionChips(row)
          return (
            <tr key={row.workspaceId} className="align-middle hover:bg-[var(--bg-hover)]">
              <Td>
                <Link href={`/admin/payment-gateway/${row.workspaceId}`} className="block min-w-0">
                  <span className="block truncate font-bold text-[var(--text-primary)]">{row.name}</span>
                  <span className="mt-0.5 block text-[12px] text-[var(--text-muted)]"><span dir="ltr">{row.ownerPhone ?? '—'}</span> · {PLAN_FA[row.plan] ?? row.plan}</span>
                </Link>
              </Td>
              <Td><Badge tone={state.tone}>{state.label}</Badge></Td>
              <Td>
                <div className="min-w-[7rem]">
                  <span className="tabular-nums">{fa(row.monthPaid)}</span>
                  <span className="text-[var(--text-muted)]"> / {row.cap == null ? '∞' : fa(row.cap)}</span>
                  {row.cap != null ? <Progress className="mt-1" value={row.monthPaid} max={Math.max(1, row.cap)} tone={row.monthPaid >= row.cap ? 'danger' : row.monthPaid >= row.cap * 0.9 ? 'warning' : 'default'} /> : null}
                </div>
              </Td>
              <Td className="tabular-nums">{toman(row.monthVolume)}</Td>
              <Td className="tabular-nums">{row.autoRate == null ? '—' : `${fa(row.autoRate)}٪`}</Td>
              <Td>{row.devices ? <span title={row.lastSmsAt ? fmtDate(row.lastSmsAt) : undefined}>{fa(row.devices)} · {ago(row.lastSmsAt)}</span> : <span className="text-[var(--text-muted)]">وصل نشده</span>}</Td>
              <Td className="tabular-nums">
                {fa(row.activeCards)}{row.cards > row.activeCards ? <span className="text-[var(--text-muted)]"> از {fa(row.cards)}</span> : null}
                {row.deletedCards ? <span className="block text-[11.5px] text-[var(--text-muted)]">{fa(row.deletedCards)} حذف‌شده</span> : null}
              </Td>
              <Td>
                {chips.length ? <div className="flex flex-wrap gap-1">{chips.map((chip) => <Badge key={chip.label} tone={chip.tone}>{chip.label}</Badge>)}</div> : <span className="text-[var(--text-muted)]">—</span>}
              </Td>
              <Td>
                <Link href={`/admin/payment-gateway/${row.workspaceId}`} aria-label={`جزئیات ${row.name}`} className="grid size-9 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"><ChevronLeft className="size-4" aria-hidden /></Link>
              </Td>
            </tr>
          )
        })}
      </tbody>
    </TableShell>
  )
}
