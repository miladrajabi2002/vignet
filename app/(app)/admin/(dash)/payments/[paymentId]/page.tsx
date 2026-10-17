import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ADMIN_VISIBLE_RELATED_WHERE } from '@/lib/admin/reporting-scope'
import {
  CheckCircle,
  Clock,
  XCircle,
  MinusCircle,
  ChevronLeft,
  Building2,
  CreditCard,
  TrendingUp,
} from 'lucide-react'
import {
  PageHeader,
  Panel,
  Badge,
  EmptyState,
  KV,
  SectionLabel,
  fmtIRR,
  fmtUSD,
  fmtDay,
  fmtDate,
  fa,
} from '../../ui'

export const dynamic = 'force-dynamic'

// ─── BADGE LOOKUPS ────────────────────────────────────────────────

const PLAN_BADGE: Record<
  string,
  { tone: 'muted' | 'info' | 'success' | 'default'; label: string }
> = {
  TRIAL: { tone: 'muted', label: 'آزمایشی' },
  STARTER: { tone: 'info', label: 'استارتر' },
  PRO: { tone: 'success', label: 'حرفه‌ای' },
  BUSINESS: { tone: 'default', label: 'بیزینس' },
}

const GATEWAY_BADGE: Record<string, { tone: 'info' | 'default'; label: string }> = {
  ZARINPAY: { tone: 'info', label: 'زرین‌پال' },
  NOWPAYMENTS: { tone: 'default', label: 'کریپتو' },
}

const STATUS_BADGE: Record<
  string,
  { tone: 'success' | 'warning' | 'danger' | 'muted'; label: string }
> = {
  PAID: { tone: 'success', label: 'پرداخت‌شده' },
  PENDING: { tone: 'warning', label: 'در انتظار' },
  FAILED: { tone: 'danger', label: 'ناموفق' },
  EXPIRED: { tone: 'muted', label: 'منقضی' },
}

function PlanBadge({ plan, kind }: { plan: string | null; kind?: string }) {
  if (kind === 'AI_CREDIT' || !plan) {
    return <Badge tone="info">اعتبار هوش مصنوعی</Badge>
  }
  const cfg = PLAN_BADGE[plan] ?? { tone: 'muted' as const, label: plan }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

function GatewayBadge({ gateway }: { gateway: string }) {
  const cfg = GATEWAY_BADGE[gateway] ?? { tone: 'muted' as const, label: gateway }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_BADGE[status] ?? { tone: 'muted' as const, label: status }
  return <Badge tone={cfg.tone}>{cfg.label}</Badge>
}

// Status summary card — large icon + label + amount
function StatusSummary({
  status,
  amount,
  currency,
}: {
  status: string
  amount: number
  currency: string
}) {
  const cfg: Record<
    string,
    { icon: React.ReactNode; tone: 'success' | 'warning' | 'danger' | 'muted'; label: string }
  > = {
    PAID: {
      icon: <CheckCircle className="h-12 w-12 text-[var(--ok)]" />,
      tone: 'success',
      label: 'پرداخت‌شده',
    },
    PENDING: {
      icon: <Clock className="h-12 w-12 text-amber-500" />,
      tone: 'warning',
      label: 'در انتظار',
    },
    FAILED: {
      icon: <XCircle className="h-12 w-12 text-red-500" />,
      tone: 'danger',
      label: 'ناموفق',
    },
    EXPIRED: {
      icon: <MinusCircle className="h-12 w-12 text-[var(--text-muted)]" />,
      tone: 'muted',
      label: 'منقضی',
    },
  }
  const c = cfg[status] ?? cfg.PENDING
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--bg-surface)]">
        {c.icon}
      </div>
      <div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
        {currency === 'IRR' ? fmtIRR(amount) : fmtUSD(amount)}
      </div>
      <p className="text-xs text-[var(--text-muted)]">{c.label}</p>
    </div>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────

export default async function AdminPaymentDetailPage(
  props: {
    params: Promise<{ paymentId: string }>
  },
) {
  const { paymentId } = await props.params

  const payment = await prisma.payment.findFirst({
    where: { ...ADMIN_VISIBLE_RELATED_WHERE, id: paymentId },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          reportEmail: true,
          _count: { select: { payments: true } },
        },
      },
    },
  })

  if (!payment) notFound()

  const shortId = payment.id.slice(-8)
  const amountDisplay =
    payment.currency === 'IRR' ? fmtIRR(payment.amount) : fmtUSD(payment.amount)

  return (
    <div className="space-y-6">
      <PageHeader
        title={`فاکتور #${shortId}`}
        subtitle={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={payment.status} />
            <span className="text-[var(--text-muted)]">{fmtDay(payment.createdAt)}</span>
          </span>
        }
        back={{ href: '/admin/payments', label: 'پرداخت‌ها' }}
        icon={CreditCard}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* LEFT — col-span-2 */}
        <div className="space-y-5 lg:col-span-2">
          {/* Payment details panel */}
          <Panel title="جزئیات پرداخت">
            <SectionLabel>اطلاعات فاکتور</SectionLabel>
            <div className="divide-y divide-[var(--border-subtle)]">
              <KV label="شناسه پرداخت" mono>
                <span className="truncate">{payment.id}</span>
              </KV>
              <KV label="درگاه">
                <GatewayBadge gateway={payment.gateway} />
              </KV>
              <KV label="پلن">
                <PlanBadge plan={payment.plan} kind={payment.kind} />
              </KV>
              <KV label="مبلغ">
                <span className="tabular-nums">{amountDisplay}</span>
              </KV>
              <KV label="واحد">
                <span>{payment.currency}</span>
              </KV>
              <KV label="وضعیت">
                <StatusBadge status={payment.status} />
              </KV>
              <KV label="تاریخ ایجاد">
                <span>
                  {fmtDay(payment.createdAt)}{' '}
                  <span className="text-xs text-[var(--text-muted)]">· {fmtDate(payment.createdAt)}</span>
                </span>
              </KV>
              <KV label="تاریخ پرداخت">
                <span>{payment.paidAt ? fmtDay(payment.paidAt) : '—'}</span>
              </KV>
              <KV label="شناسه مرجع" mono>
                <span className="block max-w-[16rem] truncate" title={payment.authority ?? ''}>
                  {payment.authority ?? '—'}
                </span>
              </KV>
              <KV label="شناسه تراکنش" mono>
                <span className="block max-w-[16rem] truncate" title={payment.externalId ?? ''}>
                  {payment.externalId ?? '—'}
                </span>
              </KV>
            </div>
          </Panel>

          {/* Workspace info panel */}
          <Panel title="اطلاعات کسب‌وکار">
            <div className="divide-y divide-[var(--border-subtle)]">
              <KV label="نام">
                <Link
                  href={`/admin/workspaces/${payment.workspace.id}`}
                  className="ui-link"
                >
                  {payment.workspace.name}
                </Link>
              </KV>
              <KV label="اسلاگ" mono>
                <span className="truncate">{payment.workspace.slug}</span>
              </KV>
              <KV label="پلن فعلی">
                <PlanBadge plan={payment.workspace.plan} />
              </KV>
              <KV label="ایمیل گزارش">
                <span>{payment.workspace.reportEmail ?? '—'}</span>
              </KV>
              <KV label="تعداد کل پرداخت‌ها">
                <span className="tabular-nums">{fa(payment.workspace._count.payments)}</span>
              </KV>
            </div>
            <div className="mt-4">
              <Link
                href={`/admin/workspaces/${payment.workspace.id}`}
                className="admin-toolbar-button"
              >
                <Building2 className="h-3.5 w-3.5" />
                مشاهده کسب‌وکار
              </Link>
            </div>
          </Panel>

          {/* Callback payload panel */}
          <Panel title="پاسخ درگاه (callbackPayload)">
            {payment.callbackPayload ? (
              <pre dir="ltr" className="admin-scroll overflow-x-auto rounded-control bg-[var(--bg-surface)] p-4 text-left text-xs leading-relaxed text-[var(--text-secondary)]">
                {JSON.stringify(payment.callbackPayload, null, 2)}
              </pre>
            ) : (
              <EmptyState>بدون داده پاسخ</EmptyState>
            )}
          </Panel>
        </div>

        {/* RIGHT — col-span-1 */}
        <div className="space-y-5">
          {/* Status summary */}
          <Panel title="خلاصه">
            <StatusSummary
              status={payment.status}
              amount={payment.amount}
              currency={payment.currency}
            />
          </Panel>

          {/* Related actions */}
          <Panel title="عملیات مرتبط">
            <ul className="-mx-2 -mb-2 divide-y divide-[var(--border-subtle)]">
              <RelatedLink
                href={`/admin/workspaces/${payment.workspace.id}`}
                icon={<Building2 className="h-4 w-4" />}
                label="مشاهده کسب‌وکار"
              />
              <RelatedLink
                href="/admin/payments"
                icon={<CreditCard className="h-4 w-4" />}
                label="مشاهده همه پرداخت‌ها"
              />
              <RelatedLink
                href="/admin/revenue"
                icon={<TrendingUp className="h-4 w-4" />}
                label="گزارش درآمد"
              />
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function RelatedLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: React.ReactNode
  label: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center gap-2.5 rounded-control px-2 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
      >
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronLeft className="h-4 w-4 text-[var(--text-hint)]" aria-hidden />
      </Link>
    </li>
  )
}
