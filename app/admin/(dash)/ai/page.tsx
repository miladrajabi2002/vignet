import Link from 'next/link'
import {
  Activity,
  Banknote,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  DatabaseZap,
  KeyRound,
  LockKeyhole,
  MessagesSquare,
  Route,
  ServerCog,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { AiModelPolicyForm } from '@/components/admin/ai-model-policy-form'
import { TrendChart } from '@/components/admin/trend-chart'
import { cn } from '@/lib/utils'
import {
  getCurrentMonthAiSpendUSD,
  getAiUsageReport,
  getOpenRouterAccountUsage,
  getOpenRouterConfigStatus,
  type AiModelUsage,
  type AiWorkspaceUsage,
  type OpenRouterConfigStatus,
  type OpenRouterAccountUsage,
  type RecentAiUsage,
} from '@/lib/admin/ai-usage'
import { getPlatformAiConfig } from '@/lib/ai/platform-config'
import { getPlatformCommercialConfig } from '@/lib/platform/commercial-config'
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Panel,
  StatCard,
  TableShell,
  Td,
  Th,
  fa,
  fmtDate,
} from '../ui'

export const dynamic = 'force-dynamic'

type UsageRange = '7d' | '30d' | 'monthly'

const RANGE_DAYS: Record<UsageRange, number> = {
  '7d': 7,
  '30d': 30,
  monthly: 365,
}

const RANGE_LABELS: Record<UsageRange, string> = {
  '7d': '۷ روز',
  '30d': '۳۰ روز',
  monthly: '۱۲ ماه',
}

const TYPE_LABELS: Record<string, string> = {
  CHAT: 'گفتگو',
  EMBEDDING: 'پایگاه دانش',
  TTS: 'تبدیل متن به صدا',
  STT: 'تبدیل صدا به متن',
  SUMMARY: 'خلاصه‌سازی',
  LEARNING: 'یادگیری',
  VIGENTO_DRAFT: 'ویجنتو',
}

const PLAN_LABELS: Record<string, string> = {
  TRIAL: 'آزمایشی',
  STARTER: 'استارتر',
  PRO: 'حرفه‌ای',
  BUSINESS: 'سازمانی',
}

function parseRange(value: string | undefined): UsageRange {
  if (value === '7d' || value === 'monthly') return value
  return '30d'
}

function formatProviderUSD(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'ثبت نشده'
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })}`
}

function formatRequestUSD(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'ثبت نشده'
  if (value > 0 && value < 0.000001) return '<$0.000001'
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: value > 0 && value < 0.001 ? 6 : 3,
    maximumFractionDigits: 6,
  })}`
}

function formatRial(value: number): string {
  return `${Math.round(value / 10).toLocaleString('fa-IR')} تومان`
}

function totalTokens(row: {
  promptTokens: number
  completionTokens: number
}): number {
  return row.promptTokens + row.completionTokens
}

function RangeTabs({ current }: { current: UsageRange }) {
  return (
    <div
      className="spatial-control inline-flex rounded-xl p-1"
      aria-label="بازه گزارش مصرف"
    >
      {(Object.keys(RANGE_DAYS) as UsageRange[]).map((range) => (
        <Link
          key={range}
          href={`/admin/ai?range=${range}`}
          scroll={false}
          aria-current={current === range ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-10 items-center rounded-lg px-3 text-[11px] font-bold transition-[background-color,color,transform,box-shadow] duration-200 active:scale-[.97]',
            current === range
              ? 'bg-black text-white shadow-[var(--shadow-control)]'
              : 'text-black/45 hover:bg-black/[0.045] hover:text-black',
          )}
        >
          {RANGE_LABELS[range]}
        </Link>
      ))}
    </div>
  )
}

function AccountStatus({
  config,
  account,
}: {
  config: OpenRouterConfigStatus
  account: OpenRouterAccountUsage
}) {
  const connected = account.status === 'connected'
  const connectionLabel = connected
    ? 'متصل و آماده'
    : account.status === 'unavailable'
      ? 'اتصال زنده ناموفق'
      : 'کلید تنظیم نشده'

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
        <div className="relative overflow-hidden border-b border-zinc-200 bg-[radial-gradient(circle_at_12%_0%,#fff_0%,#fafafa_42%,#f4f4f5_100%)] p-5 text-zinc-950 sm:p-6 lg:border-b-0 lg:border-l">
          <div className="pointer-events-none absolute -start-16 -top-20 h-48 w-48 rounded-full bg-black/[0.035] blur-3xl" />
          <div className="relative flex items-start gap-4">
            <span className="admin-icon-well h-12 w-12 rounded-2xl">
              <KeyRound className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold">حساب اصلی OpenRouter</h2>
                <Badge
                  tone={connected ? 'success' : 'danger'}
                  className={connected ? 'bg-zinc-900 text-white ring-zinc-900' : undefined}
                >
                  {connected ? (
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {connectionLabel}
                </Badge>
              </div>
              <p className="mt-2 max-w-xl text-sm leading-7 text-zinc-600">
                تمام درخواست‌های مشتریان از حساب پلتفرم عبور می‌کند. کلید فقط در محیط امن
                سرور خوانده می‌شود و هیچ مقدار یا بخشی از آن در این صفحه نمایش داده نمی‌شود.
              </p>
            </div>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-white/80 px-3 text-zinc-700 ring-1 ring-zinc-200">
              <Route className="h-4 w-4 text-zinc-500" aria-hidden="true" />
              مسیریابی: <bdi dir="ltr" className="font-mono">{config.providerSort}</bdi>
            </span>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-white/80 px-3 text-zinc-700 ring-1 ring-zinc-200">
              <ShieldCheck className="h-4 w-4 text-zinc-500" aria-hidden="true" />
              نگهداری صفر داده: {config.zeroDataRetention ? 'فعال' : 'غیرفعال'}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 p-5 sm:p-6">
          <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3.5 ring-1 ring-zinc-200">
            <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-zinc-700" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-zinc-950">مدیریت امن تنظیمات</p>
              <p className="mt-1 text-xs leading-6 text-zinc-600">
                شناسهٔ واقعی ارائه‌دهنده از محیط امن سرور خوانده می‌شود. سیاست فعال‌بودن
                مدل‌ها و سقف هزینه جداگانه و بدون دسترسی به کلید قابل مدیریت است.
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <dt className="text-zinc-500">مصرف کلید در ماه جاری</dt>
              <dd dir="ltr" className="mt-1 text-left font-mono font-bold text-zinc-900">
                {formatProviderUSD(account.usageMonthlyUSD)}
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <dt className="text-zinc-500">مصرف امروز</dt>
              <dd dir="ltr" className="mt-1 text-left font-mono font-bold text-zinc-900">
                {formatProviderUSD(account.usageDailyUSD)}
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <dt className="text-zinc-500">ماندهٔ سقف کلید</dt>
              <dd dir="ltr" className="mt-1 text-left font-mono font-bold text-zinc-900">
                {account.keyLimitRemainingUSD === null
                  ? account.keyLimitUSD === null && connected ? 'نامحدود' : 'ثبت نشده'
                  : formatProviderUSD(account.keyLimitRemainingUSD)}
              </dd>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <dt className="text-zinc-500">ماندهٔ اعتبار حساب</dt>
              <dd dir="ltr" className="mt-1 text-left font-mono font-bold text-zinc-900">
                {account.accountCreditsAvailable
                  ? formatProviderUSD(account.totalCreditsRemainingUSD)
                  : 'نیازمند دسترسی مدیریتی'}
              </dd>
            </div>
          </dl>
          {account.keyLabel && (
            <p className="truncate text-[11px] text-zinc-400">
              برچسب کلید: <bdi dir="ltr" className="font-mono">{account.keyLabel}</bdi>
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

function ManagedModels({ config }: { config: OpenRouterConfigStatus }) {
  return (
    <Panel
      title="مدل‌های مدیریت‌شده"
      subtitle="چهار سطح پایدار برای ایجنت‌ها؛ شناسه فعال هر سطح مستقیماً از سیاست ذخیره‌شده پنل خوانده می‌شود"
      action={<Badge tone="info">۴ مدل تعریف‌شده</Badge>}
    >
      <div className="grid gap-2 xl:grid-cols-4">
        {config.models.map((model, index) => (
          <article
            key={model.alias}
            className="flex min-w-0 flex-col rounded-xl border border-zinc-200 bg-zinc-50/70 p-3"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-bold text-zinc-700">
                {(index + 1).toLocaleString('fa-IR')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="truncate whitespace-nowrap text-xs font-bold text-zinc-900" title={model.name}>{model.name}</h3>
                  <Badge tone={model.configurationSource === 'panel' ? 'success' : model.configurationSource === 'environment' ? 'warning' : 'muted'}>
                    {model.configurationSource === 'panel' ? 'تنظیم پنل' : model.configurationSource === 'environment' ? 'تنظیم محیطی' : 'مقدار پیش‌فرض'}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{model.providerLabel}</p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-6 text-zinc-600">{model.description}</p>
            <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
              <p className="text-[11px] text-zinc-400">شناسهٔ فعال OpenRouter</p>
              <code
                dir="ltr"
                className="mt-1 block break-all text-left font-mono text-[11px] leading-5 text-zinc-800"
              >
                {model.providerId}
              </code>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-white p-2.5 ring-1 ring-zinc-200">
                <dt className="text-zinc-400">قیمت هر پاسخ</dt>
                <dd className="mt-1 font-semibold text-zinc-900">
                  {formatRial(model.replyPriceIRR)}
                </dd>
              </div>
              <div className="rounded-xl bg-white p-2.5 ring-1 ring-zinc-200">
                <dt className="text-zinc-400">منبع تنظیم</dt>
                <dd className="mt-1 font-semibold text-zinc-900">
                  {model.configurationSource === 'panel' ? 'پنل مدیریت' : model.configurationSource === 'environment' ? 'محیط سرور' : 'پیش‌فرض سیستم'}
                </dd>
              </div>
            </dl>

            <div className="mt-auto pt-3">
              <p className="text-[11px] text-zinc-500">این کارت از همان منبعی خوانده می‌شود که اجرای واقعی درخواست‌ها استفاده می‌کند.</p>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  )
}

function ModelUsageTable({
  rows,
  config,
}: {
  rows: AiModelUsage[]
  config: OpenRouterConfigStatus
}) {
  if (rows.length === 0) {
    return <EmptyState icon={<Bot className="h-8 w-8" />}>هنوز مصرفی ثبت نشده است</EmptyState>
  }

  const aliasFor = (modelId: string) =>
    config.models.find((model) => model.providerId === modelId || model.alias === modelId)

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => {
          const managed = aliasFor(row.model)
          return (
            <article key={row.model} className="rounded-2xl border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-900">
                    {managed?.name ?? 'مدل ثبت‌شده'}
                  </p>
                  <code dir="ltr" className="mt-1 block break-all text-left text-[11px] text-zinc-500">
                    {row.model}
                  </code>
                </div>
                <Badge tone={managed ? 'info' : 'muted'}>{managed?.alias ?? 'سایر'}</Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-xs">
                <div><dt className="text-zinc-400">درخواست</dt><dd className="mt-1 font-semibold">{fa(row.requests)}</dd></div>
                <div><dt className="text-zinc-400">توکن</dt><dd className="mt-1 font-semibold">{fa(totalTokens(row))}</dd></div>
                <div><dt className="text-zinc-400">هزینه واقعی</dt><dd dir="ltr" className="mt-1 text-left font-semibold">{formatProviderUSD(row.providerCostUSD)}</dd></div>
                <div><dt className="text-zinc-400">مبلغ کسرشده</dt><dd className="mt-1 font-semibold">{formatRial(row.chargedIRR)}</dd></div>
              </dl>
            </article>
          )
        })}
      </div>

      <div className="hidden md:block">
        <TableShell minWidth={800}>
          <thead className="border-b border-zinc-200 bg-zinc-50/70">
            <tr>
              <Th>مدل ثبت‌شده</Th>
              <Th>درخواست</Th>
              <Th>ورودی / خروجی</Th>
              <Th>توکن استدلال / کش</Th>
              <Th>هزینه واقعی</Th>
              <Th>مبلغ کسرشده</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => {
              const managed = aliasFor(row.model)
              return (
                <tr key={row.model} className="transition-colors hover:bg-zinc-50">
                  <Td>
                    <div className="max-w-64">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900">{managed?.name ?? 'سایر'}</span>
                        {managed && <Badge tone="info">{managed.alias}</Badge>}
                      </div>
                      <code dir="ltr" className="mt-1 block truncate text-left text-[11px] text-zinc-400" title={row.model}>
                        {row.model}
                      </code>
                    </div>
                  </Td>
                  <Td className="tabular-nums">{fa(row.requests)}</Td>
                  <Td className="tabular-nums">{fa(row.promptTokens)} / {fa(row.completionTokens)}</Td>
                  <Td className="tabular-nums">{fa(row.reasoningTokens)} / {fa(row.cachedTokens)}</Td>
                  <Td><bdi dir="ltr" className="font-mono text-xs font-semibold">{formatProviderUSD(row.providerCostUSD)}</bdi></Td>
                  <Td className="font-semibold text-zinc-900">{formatRial(row.chargedIRR)}</Td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      </div>
    </>
  )
}

function WorkspaceUsageTable({ rows }: { rows: AiWorkspaceUsage[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={<Users className="h-8 w-8" />}>هنوز مصرفی برای کاربران ثبت نشده است</EmptyState>
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <article key={row.workspaceId} className="rounded-2xl border border-zinc-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/admin/workspaces/${row.workspaceId}`} className="text-sm font-bold text-zinc-900 hover:underline">
                  {row.workspaceName}
                </Link>
                <p className="mt-1 truncate text-xs text-zinc-500">
                  {row.ownerLabel ?? 'مالک نامشخص'} · {fa(row.userCount)} عضو
                </p>
              </div>
              <Badge tone="muted">{PLAN_LABELS[row.plan] ?? row.plan}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-xs">
              <div><dt className="text-zinc-400">درخواست</dt><dd className="mt-1 font-semibold">{fa(row.requests)}</dd></div>
              <div><dt className="text-zinc-400">توکن</dt><dd className="mt-1 font-semibold">{fa(totalTokens(row))}</dd></div>
              <div><dt className="text-zinc-400">هزینه واقعی</dt><dd dir="ltr" className="mt-1 text-left font-semibold">{formatProviderUSD(row.providerCostUSD)}</dd></div>
              <div><dt className="text-zinc-400">کسر از اعتبار</dt><dd className="mt-1 font-semibold">{formatRial(row.chargedIRR)}</dd></div>
            </dl>
            <p className="mt-4 flex items-center gap-1.5 border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              آخرین مصرف {fmtDate(row.lastUsedAt)}
            </p>
          </article>
        ))}
      </div>

      <div className="hidden md:block">
        <TableShell minWidth={860}>
          <thead className="border-b border-zinc-200 bg-zinc-50/70">
            <tr>
              <Th>کسب‌وکار / کاربر مالک</Th>
              <Th>پلن</Th>
              <Th>درخواست</Th>
              <Th>توکن ورودی / خروجی</Th>
              <Th>هزینه واقعی</Th>
              <Th>کسر از اعتبار</Th>
              <Th>آخرین مصرف</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.workspaceId} className="transition-colors hover:bg-zinc-50">
                <Td>
                  <Link href={`/admin/workspaces/${row.workspaceId}`} className="font-semibold text-zinc-900 hover:underline">
                    {row.workspaceName}
                  </Link>
                  <p className="mt-0.5 max-w-52 truncate text-[11px] text-zinc-400">
                    {row.ownerLabel ?? 'مالک نامشخص'} · {fa(row.userCount)} عضو
                  </p>
                </Td>
                <Td><Badge tone="muted">{PLAN_LABELS[row.plan] ?? row.plan}</Badge></Td>
                <Td className="tabular-nums">{fa(row.requests)}</Td>
                <Td className="tabular-nums">{fa(row.promptTokens)} / {fa(row.completionTokens)}</Td>
                <Td><bdi dir="ltr" className="font-mono text-xs font-semibold">{formatProviderUSD(row.providerCostUSD)}</bdi></Td>
                <Td className="font-semibold text-zinc-900">{formatRial(row.chargedIRR)}</Td>
                <Td className="whitespace-nowrap text-xs text-zinc-500">{fmtDate(row.lastUsedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </div>
    </>
  )
}

function RecentUsageList({ rows }: { rows: RecentAiUsage[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={<Activity className="h-8 w-8" />}>درخواستی ثبت نشده است</EmptyState>
  }

  return (
    <ul className="divide-y divide-zinc-100">
      {rows.map((row) => (
        <li key={row.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/workspaces/${row.workspaceId}`} className="truncate text-sm font-semibold text-zinc-900 hover:underline">
                  {row.workspaceName}
                </Link>
                <Badge tone="muted">{TYPE_LABELS[row.type] ?? row.type}</Badge>
              </div>
              <p dir="ltr" className="mt-1 truncate text-left font-mono text-[11px] text-zinc-400">
                {row.model ?? 'model-not-recorded'}
              </p>
            </div>
            <div className="text-end">
              <p className="text-xs font-semibold text-zinc-900">
                {fa(totalTokens(row))} توکن
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">{fmtDate(row.date)}</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
            <span>هزینه دقیق OpenRouter: <bdi dir="ltr" className="font-mono font-semibold text-zinc-800">{formatRequestUSD(row.providerCostUSD)}</bdi></span>
            <span>کسرشده: <strong className="font-semibold text-zinc-700">{formatRial(row.chargedIRR)}</strong></span>
            {row.reasoningTokens > 0 && <span>استدلال: {fa(row.reasoningTokens)}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const range = parseRange(params.range)
  const days = RANGE_DAYS[range]
  const [report, platformPolicy, commercialConfig, currentMonthSpendUSD, openRouterAccount] = await Promise.all([
    getAiUsageReport(days),
    getPlatformAiConfig(),
    getPlatformCommercialConfig(),
    getCurrentMonthAiSpendUSD(),
    getOpenRouterAccountUsage(),
  ])
  const config = getOpenRouterConfigStatus(platformPolicy, commercialConfig)
  const costCoverage = report.totals.requests > 0
    ? Math.round((report.totals.pricedRequests / report.totals.requests) * 100)
    : 0
  const averageProviderCost = report.totals.pricedRequests > 0
    ? report.totals.providerCostUSD / report.totals.pricedRequests
    : 0
  const averageCharge = report.totals.requests > 0
    ? Math.round(report.totals.chargedIRR / report.totals.requests)
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدل‌ها و سیاست AI"
        subtitle="سلامت اتصال، مدل‌های فعال، مصرف کاربران و هزینهٔ واقعی OpenRouter"
        breadcrumbs={[
          { label: 'داشبورد', href: '/admin' },
          { label: 'هوش مصنوعی' },
        ]}
        action={<RangeTabs current={range} />}
      />

      <AccountStatus config={config} account={openRouterAccount} />

      <AiModelPolicyForm
        models={config.models.map((model) => ({
          alias: model.alias,
          name: model.name,
          providerLabel: model.providerLabel,
          providerId: model.providerId,
          description: model.description,
        }))}
        initialPolicy={platformPolicy}
        currentMonthSpendUSD={currentMonthSpendUSD}
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="درخواست موفق"
          value={fa(report.totals.requests)}
          sub={`${RANGE_LABELS[range]} اخیر`}
          icon={<MessagesSquare className="h-5 w-5" />}
          tone="info"
        />
        <StatCard
          label="هزینه واقعی OpenRouter"
          value={formatProviderUSD(report.totals.providerCostUSD)}
          sub={`میانگین ${formatProviderUSD(averageProviderCost)}`}
          icon={<CircleDollarSign className="h-5 w-5" />}
        />
        <StatCard
          label="کسرشده از اعتبار کاربران"
          value={formatRial(report.totals.chargedIRR)}
          sub={`میانگین ${formatRial(averageCharge)}`}
          icon={<Banknote className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="پوشش ثبت هزینه"
          value={`${fa(costCoverage)}٪`}
          sub={`${fa(report.totals.pricedRequests)} لاگ دارای هزینه`}
          icon={<DatabaseZap className="h-5 w-5" />}
          tone={costCoverage >= 95 || report.totals.requests === 0 ? 'success' : 'warning'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TrendChart
           title={`روند کسر اعتبار — ${RANGE_LABELS[range]}`}
           subtitle="مجموع مبلغ ریالی ثبت‌شده برای پاسخ‌های موفق"
           data={report.daily.map((row) => ({ day: row.day, value: row.chargedIRR }))}
          color="#18181b"
          variant="area"
          format="irr"
          height={210}
        />
        <TrendChart
          title={`هزینه واقعی OpenRouter — ${RANGE_LABELS[range]}`}
          subtitle="جمع دقیق UsageLog.cost، بدون تخمین قیمت مدل"
          data={report.daily.map((row) => ({ day: row.day, value: row.providerCostUSD }))}
          color="#71717a"
          variant="area"
          format="usd"
          height={210}
        />
      </div>

      <table className="sr-only">
        <caption>جدول جایگزین نمودارهای روزانه مصرف هوش مصنوعی</caption>
         <thead><tr><th>روز</th><th>درخواست</th><th>مبلغ تومان</th><th>هزینه دلار</th></tr></thead>
        <tbody>
          {report.daily.map((row) => (
            <tr key={row.day}>
              <td>{row.day}</td><td>{row.requests}</td><td>{Math.round(row.chargedIRR / 10)}</td><td>{row.providerCostUSD}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ManagedModels config={config} />

      <Panel
        title="مصرف به تفکیک مدل"
        subtitle="هزینهٔ ارائه‌دهنده و مبلغ کسرشده مستقل نمایش داده می‌شوند؛ تبدیل ارز فرض نشده است"
      >
        <ModelUsageTable rows={report.models} config={config} />
      </Panel>

      <Panel
        title="مصرف کسب‌وکارها و کاربران"
        subtitle="لاگ مصرف در سطح کسب‌وکار ثبت می‌شود؛ کاربر مالک و تعداد اعضا برای شناسایی نمایش داده شده‌اند"
        action={<Badge tone="muted">۵۰ کسب‌وکار پرمصرف</Badge>}
      >
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-6 text-zinc-700">
          <Users className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            چون UsageLog شناسهٔ کاربر ندارد، مصرف اعضای یک کسب‌وکار قابل تفکیک قطعی نیست.
            اعداد این جدول دقیقاً مجموع workspace هستند و به‌اشتباه به یک عضو نسبت داده نمی‌شوند.
          </p>
        </div>
        <WorkspaceUsageTable rows={report.workspaces} />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="آخرین درخواست‌های موفق"
          subtitle="کنترل سریع هزینه، مدل و مبلغ کسرشده برای هر لاگ"
        >
          <RecentUsageList rows={report.recent} />
        </Panel>

        <Panel title="راهنمای تغییر ایمن" subtitle="تنظیمات مدل بدون ذخیره‌سازی کلید در دیتابیس">
          <ol className="space-y-4">
            {[
              ['شناسه مدل را ویرایش کنید', 'در بخش سیاست اجرای مدل‌ها، شناسه OpenRouter سطح موردنظر را مستقیماً تغییر دهید.'],
              ['تنظیمات را ذخیره کنید', 'با ذخیره فرم، سیاست دیتابیس و کارت‌های مدل‌های مدیریت‌شده هم‌زمان تازه می‌شوند.'],
              ['مدل ویجنتو را تعیین کنید', 'مدل اختصاصی دستیار مدیریتی را مستقل از مدل پیش‌فرض کاربران انتخاب کنید.'],
              ['یک پاسخ آزمایشی بگیرید', 'هزینه دقیق درخواست پس از ثبت UsageLog در نمودار و فهرست آخرین درخواست‌ها دیده می‌شود.'],
            ].map(([title, description], index) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xs font-bold text-zinc-700">
                  {(index + 1).toLocaleString('fa-IR')}
                </span>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">{title}</p>
                  <p className="mt-1 text-xs leading-6 text-zinc-500">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-zinc-700">
            <span className="admin-icon-well shrink-0"><ServerCog className="h-4 w-4" aria-hidden="true" /></span>
            <p className="text-xs leading-6">
              هیچ فرم و API برای خواندن یا بازنویسی OPENROUTER_API_KEY ساخته نشده است. این
              محدودیت بخشی از طراحی امنیتی پنل است، نه کمبود رابط کاربری.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
