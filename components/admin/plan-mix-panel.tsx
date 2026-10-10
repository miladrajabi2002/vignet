import Link from 'next/link'
import { Panel, fa } from '@/app/admin/(dash)/ui'
import { PLAN_COLOR } from '@/components/admin/chart-palette'
import type { PlanMixRow } from '@/lib/admin/charts'

function share(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0
}

/** A Rial amount as a Toman figure with a small, quiet unit beside it. */
function Toman({ irr }: { irr: number }) {
  return (
    <>
      <span className="whitespace-nowrap">{fa(Math.round(irr / 10))}</span>{' '}
      <span className="whitespace-nowrap text-[12px] font-normal text-[var(--text-muted)]">تومان</span>
    </>
  )
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 flex-1 basis-[6.5rem] rounded-control bg-[var(--bg-surface)] px-3 py-2.5">
      <dt className="text-[12px] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-base font-bold leading-tight tabular-nums text-[var(--text-primary)]">{children}</dd>
    </div>
  )
}

/**
 * Who is on each plan and what they have paid: the headline figures, the
 * customer mix as one stacked bar, then a row per plan with its share of the
 * revenue. Each row opens the users list filtered to that plan.
 */
export function PlanMixPanel({ rows }: { rows: PlanMixRow[] }) {
  const totalCustomers = rows.reduce((sum, row) => sum + row.customerCount, 0)
  const totalRevenueIRR = rows.reduce((sum, row) => sum + row.revenueIRR, 0)
  const paidCustomers = rows
    .filter((row) => row.key !== 'TRIAL')
    .reduce((sum, row) => sum + row.customerCount, 0)
  const populated = rows.filter((row) => row.customerCount > 0)

  return (
    <Panel
      title="مشتریان و درآمد هر پلن"
      subtitle="تعداد مشتریان هر پلن و مجموع پرداخت‌های موفق آن‌ها تا امروز"
      href="/admin/revenue"
      linkLabel="جزئیات درآمد"
      className="flex h-full flex-col"
    >
      <dl className="flex flex-wrap gap-2">
        <Figure label="کل مشتریان">{fa(totalCustomers)}</Figure>
        <Figure label="مشتری پولی">
          {fa(paidCustomers)}{' '}
          <span className="text-[12px] font-normal text-[var(--text-muted)]">
            {fa(share(paidCustomers, totalCustomers))}٪ از کل
          </span>
        </Figure>
        <Figure label="درآمد کل">
          <Toman irr={totalRevenueIRR} />
        </Figure>
      </dl>

      {populated.length > 0 && (
        <div
          role="img"
          aria-label={`ترکیب مشتریان: ${populated
            .map((row) => `${row.label} ${fa(row.customerCount)}`)
            .join('، ')}`}
          className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full"
        >
          {populated.map((row) => (
            <span
              key={row.key}
              title={`${row.label}: ${fa(row.customerCount)} مشتری`}
              className="min-w-1.5 basis-0"
              style={{ flexGrow: row.customerCount, background: PLAN_COLOR[row.key] }}
            />
          ))}
        </div>
      )}

      <ul className="-mx-2 mt-2 flex flex-1 flex-col divide-y divide-[var(--border-subtle)]" aria-label="مشتریان و درآمد به تفکیک پلن">
        {rows.map((row) => {
          const revenueShare = share(row.revenueIRR, totalRevenueIRR)

          return (
            <li key={row.key} className="flex flex-1 items-stretch">
              <Link
                href={`/admin/users?plan=${row.key}`}
                className="flex w-full flex-col justify-center gap-1.5 rounded-control px-2 py-2.5 transition-colors hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: PLAN_COLOR[row.key] }}
                    />
                    <span className="truncate text-sm font-medium text-[var(--text-primary)]">{row.label}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--text-primary)]">
                    <Toman irr={row.revenueIRR} />
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-3 text-[12px] tabular-nums text-[var(--text-muted)]">
                  <span>
                    <strong className="text-[13px] font-bold text-[var(--text-primary)]">{fa(row.customerCount)}</strong>{' '}
                    مشتری
                    <span aria-hidden className="mx-1.5 text-[var(--text-hint)]">·</span>
                    {fa(share(row.customerCount, totalCustomers))}٪ از کل
                  </span>
                  <span className="shrink-0">{fa(revenueShare)}٪ از درآمد</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]" aria-hidden>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${revenueShare}%`, background: PLAN_COLOR[row.key] }}
                  />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
