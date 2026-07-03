import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import {
  CheckCircle,
  Clock,
  XCircle,
  MinusCircle,
  ChevronRight,
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
  BUSINESS: { tone: 'default', label: 'سازمانی' },
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

function PlanBadge({ plan }: { plan: string }) {
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
      icon: <CheckCircle className="h-12 w-12 text-emerald-500" />,
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
      icon: <MinusCircle className="h-12 w-12 text-zinc-400" />,
      tone: 'muted',
      label: 'منقضی',
    },
  }
  const c = cfg[status] ?? cfg.PENDING
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-50">
        {c.icon}
      </div>
      <div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
        {currency === 'IRR' ? fmtIRR(amount) : fmtUSD(amount)}
      </div>
      <p className="text-xs text-zinc-500">{c.label}</p>
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

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
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
            <span className="text-zinc-500">{fmtDay(payment.createdAt)}</span>
          </span>
        }
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'پرداخت‌ها', href: '/admin/payments' },
          { label: `#${shortId}` },
        ]}
        action={
          <Link
            href="/admin/payments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
          >
            <ChevronRight className="h-4 w-4" />
            بازگشت به پرداخت‌ها
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* LEFT — col-span-2 */}
        <div className="space-y-5 lg:col-span-2">
          {/* Payment details panel */}
          <Panel title="جزئیات پرداخت">
            <SectionLabel>اطلاعات فاکتور</SectionLabel>
            <div className="divide-y divide-zinc-100">
              <KV label="شناسه پرداخت" mono>
                <span className="truncate">{payment.id}</span>
              </KV>
              <KV label="درگاه">
                <GatewayBadge gateway={payment.gateway} />
              </KV>
              <KV label="پلن">
                <PlanBadge plan={payment.plan} />
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
                  <span className="text-xs text-zinc-400">· {fmtDate(payment.createdAt)}</span>
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
            <div className="divide-y divide-zinc-100">
              <KV label="نام">
                <Link
                  href={`/admin/workspaces/${payment.workspace.id}`}
                  className="font-medium text-zinc-900 hover:underline"
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
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
              >
                <Building2 className="h-3.5 w-3.5" />
                مشاهده کسب‌وکار
              </Link>
            </div>
          </Panel>

          {/* Callback payload panel */}
          <Panel title="پاسخ درگاه (callbackPayload)">
            {payment.callbackPayload ? (
              <pre className="overflow-x-auto rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-600">
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
            <ul className="space-y-1.5">
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
        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
      >
        <span className="text-zinc-400">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-4 w-4 text-zinc-300" />
      </Link>
    </li>
  )
}
