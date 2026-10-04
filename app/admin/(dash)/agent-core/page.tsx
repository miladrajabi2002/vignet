import {
  Activity,
  BadgeCheck,
  Cpu,
  Gauge,
  Scale,
  Sparkles,
  Timer,
  Wallet,
} from 'lucide-react'
import { UnderstandingModeForm } from '@/components/admin/understanding-mode-form'
import { getAgentCoreReport, type AgentCapabilityRow, type CountRow } from '@/lib/admin/agent-core'
import { UNDERSTANDING_DOMAINS } from '@/lib/agent/understand/mode'
import {
  Badge,
  EmptyState,
  FilterPills,
  KV,
  PageHeader,
  Panel,
  Progress,
  StatCard,
  TableShell,
  Td,
  Th,
  fa,
  fmtDate,
} from '../ui'

export const dynamic = 'force-dynamic'

const RANGES = [7, 30, 90] as const

const ACT_LABELS: Record<string, string> = {
  greeting: 'سلام',
  thanks: 'تشکر',
  goodbye: 'خداحافظی',
  defer: 'بعداً تصمیم می‌گیرم',
  smalltalk: 'گپ',
  reset_topic: 'موضوع تازه',
  product_search: 'جستجوی محصول',
  product_question: 'سؤال دربارهٔ محصول',
  variants: 'رنگ / سایز / مدل',
  compare: 'مقایسه',
  cheaper_alternative: 'ارزان‌تر',
  order_start: 'شروع سفارش',
  cart_edit: 'تغییر سبد',
  order_details: 'مشخصات سفارش',
  order_confirm: 'تأیید سفارش',
  order_decline: 'رد / اصلاح',
  order_cancel: 'لغو سفارش',
  payment_claim: 'پرداخت کردم',
  payment_link_request: 'لینک پرداخت',
  shipping_change: 'تغییر ارسال',
  order_status: 'پیگیری سفارش',
  restock_subscribe: 'خبرم کن',
  booking: 'رزرو نوبت',
  course: 'دوره',
  policy_question: 'سؤال سیاست (ارسال، مرجوعی…)',
  knowledge_question: 'سؤال از دانش',
  complaint: 'شکایت',
  human_request: 'درخواست اپراتور',
  other: 'سایر',
}

const DOMAIN_LABELS: Record<string, string> = {
  products: 'محصول',
  orders: 'سفارش',
  bookings: 'رزرو',
  courses: 'دوره',
  restock: 'خبرم کن',
  tracking: 'پیگیری',
  handoff: 'اپراتور',
  state: 'حافظه',
  insights: 'تحلیل مشتری',
  product: 'محصول',
  order: 'سفارش',
  booking: 'رزرو',
  course: 'دوره',
  closing: 'پایان گفتگو',
  general: 'عمومی',
  restock_subscribe: 'خبرم کن',
  order_status: 'پیگیری',
  human_request: 'اپراتور',
  complaint: 'شکایت',
  reset_topic: 'موضوع تازه',
}

const ERROR_LABELS: Record<string, string> = {
  NO_KEY: 'کلید OpenRouter تنظیم نیست',
  NO_BUDGET: 'سقف بودجه پر شده',
  TIMEOUT: 'پایان مهلت',
  PROVIDER: 'خطای سرویس مدل',
  MALFORMED: 'خروجی نامعتبر',
  CIRCUIT_OPEN: 'قطع موقت پس از خطاهای پیاپی',
  DISABLED: 'غیرفعال با متغیر محیطی',
}

const PURPOSE_LABELS: Record<string, string> = {
  understand: 'فهم نوبت',
  cart_plan: 'برنامهٔ سبد',
  catalog_plan: 'برنامهٔ جستجوی کاتالوگ',
  turn_analyzer: 'تحلیل نوبت (مسیر قدیمی)',
  summary: 'خلاصهٔ گفتگو',
  memory: 'حافظهٔ گفتگو',
  eval: 'ارزیابی',
}

const MODE_LABELS: Record<string, string> = { on: 'فعال', shadow: 'سایه', off: 'خاموش' }

const CHANNEL_LABELS: Record<string, string> = {
  TELEGRAM: 'تلگرام',
  WHATSAPP: 'واتساپ',
  INSTAGRAM: 'اینستاگرام',
  RUBIKA: 'روبیکا',
  BALE: 'بله',
  WEB_WIDGET: 'ویجت',
  CHAT_LINK: 'لینک گفتگو',
  API: 'API',
}

/** What the core can read and do on every turn (the closed act list). */
const CORE_ABILITIES: Array<{ title: string; items: string[] }> = [
  {
    title: 'انتخاب و مشاورهٔ محصول',
    items: [
      'جستجو با ویژگی، بودجه (حداقل/حداکثر)، مرتب‌سازی و کد محصول — قیمت فقط وقتی پذیرفته می‌شود که در پیام آمده باشد',
      '«همین»، «دومی»، «اون قرمزه» به کارت دقیق کاتالوگ وصل می‌شود؛ مرجع نامعتبر رد و سؤال کوتاه پرسیده می‌شود',
      'سؤال از ویژگی (قیمت، موجودی، جنس، ابعاد، گارانتی، ارسال…) دربارهٔ محصول فعال یا محصولی که قبلاً دیده شده',
      'مقایسه، رنگ/سایز/مدل، ارزان‌تر از همین، اطلاع از موجود شدن',
      'حافظهٔ محصول: ۱۲ محصول اخیرِ دیده‌شده یا نام‌برده با منبع (کارت، نام، سبد) — بعد از تغییر موضوع هم «همون مبل اولی» پیدا می‌شود',
    ],
  },
  {
    title: 'سفارش و سبد',
    items: [
      'شروع سفارش چندقلمی با تعداد و تنوع، تغییر سبد (افزودن، حذف، تعداد، تنوع)',
      'مشخصات (نام، موبایل، شهر، آدرس، کدپستی) فقط وقتی پذیرفته می‌شود که عیناً در پیام باشد',
      'کد تخفیف، روش ارسال، لینک پرداخت، «پرداخت کردم»',
      'لغو کل سفارش فقط با تأیید دوباره — «اینو حذف کن» دیگر کل سفارش را لغو نمی‌کند',
    ],
  },
  {
    title: 'رزرو، دوره، پیگیری و پشتیبانی',
    items: [
      'رزرو نوبت فقط وقتی مشتری واقعاً نوبت بخواهد («فردا میرسه؟» دیگر وارد رزرو نمی‌شود)',
      'ثبت‌نام و سؤال دوره، پیگیری سفارش با کد',
      'سؤال سیاست‌ها و سؤال آزاد از پایگاه دانش، شکایت با شدت، درخواست اپراتور',
      'قابلیتی که ایجنت ندارد صادقانه گفته می‌شود و قولش داده نمی‌شود',
    ],
  },
]

function pct(part: number, whole: number): string {
  if (!whole) return '—'
  return `${Math.round((part / whole) * 100).toLocaleString('fa-IR')}٪`
}

function usd(value: number | null | undefined, digits = 5): string {
  if (value == null) return '—'
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: value > 0 && value < 0.01 ? 4 : 2 })}`
}

function ms(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value).toLocaleString('fa-IR')} ms`
}

function Bars({ rows, labels, total }: { rows: CountRow[]; labels: Record<string, string>; total?: number }) {
  if (!rows.length) return <p className="ui-caption">هنوز داده‌ای ثبت نشده است.</p>
  const max = total ?? Math.max(...rows.map((row) => row.count))
  return (
    <ul className="space-y-2.5">
      {rows.slice(0, 14).map((row) => (
        <li key={row.key}>
          <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
            <span className="min-w-0 truncate text-[var(--text-primary)]">{labels[row.key] ?? row.key}</span>
            <span className="shrink-0 tabular-nums text-[var(--text-muted)]">{fa(row.count)}</span>
          </div>
          <Progress value={row.count} max={max || 1} />
        </li>
      ))}
    </ul>
  )
}

function diffLabel(kind: string): string {
  const sign = kind.startsWith('+') ? 'فقط مدل: ' : kind.startsWith('-') ? 'فقط مسیر قدیمی: ' : ''
  const key = kind.replace(/^[+-]/, '')
  return `${sign}${DOMAIN_LABELS[key] ?? ACT_LABELS[key] ?? key}`
}

function Flag({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <Badge tone={on ? 'success' : 'muted'}>{children}</Badge>
}

function AgentRow({ agent }: { agent: AgentCapabilityRow }) {
  return (
    <tr>
      <Td>
        <div className="max-w-56">
          <p className="truncate font-semibold text-[var(--text-primary)]">{agent.name}</p>
          <p className="truncate text-[12px] text-[var(--text-muted)]">{agent.workspaceName}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {!agent.active && <Badge tone="warning">غیرفعال</Badge>}
            <Badge tone={agent.effectiveMode === 'on' ? 'info' : 'muted'}>فهم: {MODE_LABELS[agent.effectiveMode]}</Badge>
          </div>
        </div>
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          <Flag on={agent.productAccess}>کاتالوگ {agent.productAccess ? `(${fa(agent.inStockProducts)}/${fa(agent.products)})` : ''}</Flag>
          <Flag on={agent.knowledgeReady > 0}>دانش {fa(agent.knowledgeReady)}/{fa(agent.knowledgeTotal)}</Flag>
        </div>
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          <Flag on={agent.orderCapture}>ثبت سفارش</Flag>
          <Flag on={agent.payLink}>لینک پرداخت</Flag>
          <Flag on={agent.restock}>خبرم کن</Flag>
          <Flag on={agent.tracking}>پیگیری</Flag>
          <Flag on={agent.orderUpdates}>اطلاع وضعیت</Flag>
          <Flag on={agent.cartHold}>یادآوری سبد</Flag>
        </div>
      </Td>
      <Td>
        <div className="flex flex-wrap gap-1">
          <Flag on={agent.modules.bookings && agent.services > 0}>رزرو {agent.modules.bookings ? `(${fa(agent.services)} خدمت)` : '—'}</Flag>
          <Flag on={agent.modules.courses && agent.courses > 0}>دوره {agent.modules.courses ? `(${fa(agent.courses)})` : '—'}</Flag>
          <Flag on={agent.handoff}>اپراتور</Flag>
        </div>
      </Td>
      <Td>
        <div className="flex max-w-40 flex-wrap gap-1">
          {agent.channels.length
            ? agent.channels.map((channel) => <Badge key={channel} tone="default">{CHANNEL_LABELS[channel] ?? channel}</Badge>)
            : <span className="text-[12px] text-[var(--text-muted)]">—</span>}
        </div>
      </Td>
      <Td className="tabular-nums">{fa(agent.conversations)}</Td>
    </tr>
  )
}

export default async function AgentCorePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const params = await searchParams
  const requested = Number(params.days)
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 7
  const report = await getAgentCoreReport(days)
  const { understanding: u, cost, quality: q, rollout } = report
  const read = u.total - u.skipped
  const answeredTotal = q ? q.answered.y + q.answered.p + q.answered.n : 0
  const perReplyTrend = cost?.perReply.current != null && cost.perReply.previous
    ? Math.round(((cost.perReply.current - cost.perReply.previous) / cost.perReply.previous) * 100)
    : null
  const workspaceOptions = [...new Map(report.agents.map((agent) => [agent.workspaceId, { id: agent.workspaceId, name: agent.workspaceName }])).values()]
  for (const item of rollout.workspaces) {
    if (!workspaceOptions.some((option) => option.id === item.id)) workspaceOptions.push({ id: item.id, name: item.name })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="هستهٔ ایجنت"
        subtitle="فهم هر نوبت، هزینهٔ واقعی هر پاسخ، کیفیت جواب‌ها و دسترسی دقیق هر ایجنت"
        icon={Cpu}
        action={(
          <FilterPills
            options={RANGES.map((range) => ({
              label: `${range.toLocaleString('fa-IR')} روز`,
              href: `/admin/agent-core?days=${range}`,
              active: range === days,
            }))}
          />
        )}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="نوبت‌های فهمیده‌شده"
          value={pct(u.ok, read)}
          sub={`${fa(u.ok)} از ${fa(read)} نوبت · ${fa(u.skipped)} مسیر سریع`}
          icon={<Sparkles className="h-4 w-4" />}
          tone={read && u.ok / read < 0.9 ? 'warning' : 'success'}
          series={u.daily.map((day) => day.ok)}
          seriesLabels={u.daily.map((day) => day.day)}
        />
        <StatCard
          label="هزینهٔ هر نوبت"
          value={usd(cost?.avgTotalUSD ?? null)}
          sub={cost ? `پاسخ ${usd(cost.avgReplyUSD)} + جانبی ${usd(cost.avgAuxUSD)}` : 'داده‌ای نیست'}
          icon={<Wallet className="h-4 w-4" />}
          tone="info"
        />
        <StatCard
          label="پاسخ کامل"
          value={q ? pct(q.answered.y, answeredTotal) : '—'}
          sub={q ? `ناقص ${pct(q.answered.p, answeredTotal)} · بی‌پاسخ ${pct(q.answered.n, answeredTotal)}` : undefined}
          icon={<BadgeCheck className="h-4 w-4" />}
          tone={q && answeredTotal && q.answered.n / answeredTotal > 0.1 ? 'warning' : 'success'}
        />
        <StatCard
          label="هم‌نظری با مسیر قدیمی"
          value={pct(u.agreed, u.compared)}
          sub={`${fa(u.compared - u.agreed)} نوبت متفاوت — نمونه‌ها پایین صفحه`}
          icon={<Scale className="h-4 w-4" />}
        />
        <StatCard
          label="تأخیر فهم (p95)"
          value={ms(u.latencyP95)}
          sub={`میانه ${ms(u.latencyP50)}`}
          icon={<Timer className="h-4 w-4" />}
          tone={u.latencyP95 != null && u.latencyP95 > 4000 ? 'warning' : 'default'}
        />
      </div>

      <UnderstandingModeForm initial={rollout.config} workspaces={workspaceOptions} envMode={rollout.envMode} />
      {rollout.envDisabled && (
        <p className="rounded-control bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          AGENT_UNDERSTANDING_DISABLED روی سرور فعال است؛ هیچ فراخوانی فهم انجام نمی‌شود و همهٔ نوبت‌ها با مسیر قدیمی جواب می‌گیرند.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="دقت و سلامت فهم" subtitle={`از ${fmtDate(report.since)}`}>
          {!u.available ? (
            <EmptyState icon={<Activity />}>جدول لاگ فهم هنوز ساخته نشده است؛ migrate deploy را اجرا کنید.</EmptyState>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              <KV label="کل نوبت‌ها">{fa(u.total)}</KV>
              <KV label="خوانش معتبر / برگشت به مسیر قدیمی">{fa(u.ok)} / {fa(u.fallback)}</KV>
              <KV label="میانگین اطمینان مدل">{u.avgConfidence == null ? '—' : `${Math.round(u.avgConfidence * 100).toLocaleString('fa-IR')}٪`}</KV>
              <KV label="اطمینان زیر کف (اقدام تغییردهنده مسدود)">{fa(u.lowConfidence)}</KV>
              <KV label="هزینهٔ کل فهم">{usd(u.costUSD, 4)}</KV>
              <KV label="هزینهٔ هر فراخوانی فهم">{usd(u.avgCostUSD)}</KV>
              <KV label="حالت‌ها">{u.byMode.map((row) => `${MODE_LABELS[row.key] ?? row.key}: ${fa(row.count)}`).join(' · ') || '—'}</KV>
              {u.errors.length > 0 && (
                <div className="py-2.5">
                  <p className="mb-2 text-xs text-[var(--text-muted)]">دلیل برگشت به مسیر قدیمی</p>
                  <Bars rows={u.errors} labels={ERROR_LABELS} />
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="مشتری‌ها چه خواستند" subtitle="توزیع کنش‌های خوانده‌شده (بعد از راستی‌آزمایی)">
          <Bars rows={u.acts} labels={ACT_LABELS} />
        </Panel>

        <Panel title="حوزه‌هایی که از فهم تصمیم گرفتند" subtitle="و جاهایی که با مسیر قدیمی فرق داشت">
          <Bars rows={u.routed} labels={DOMAIN_LABELS} />
          {u.diffs.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs text-[var(--text-muted)]">تفاوت‌ها با مسیر قدیمی</p>
              <Bars rows={u.diffs.map((row) => ({ key: row.key, count: row.count }))} labels={Object.fromEntries(u.diffs.map((row) => [row.key, diffLabel(row.key)]))} />
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="هزینه" subtitle="هر نوبت = پاسخ اصلی + همهٔ فراخوانی‌های جانبی همان نوبت">
          {!cost ? (
            <EmptyState icon={<Wallet />}>گزارش هزینه خوانده نشد.</EmptyState>
          ) : (
            <>
              <div className="divide-y divide-[var(--border-subtle)]">
                <KV label="نوبت‌های دارای دفتر هزینه">{fa(cost.turns)}</KV>
                <KV label="میانگین / میانه / p95 هر نوبت">{usd(cost.avgTotalUSD)} / {usd(cost.p50TotalUSD)} / {usd(cost.p95TotalUSD)}</KV>
                <KV label="سهم پاسخ اصلی / جانبی">{usd(cost.avgReplyUSD)} / {usd(cost.avgAuxUSD)}</KV>
                <KV label="کل هزینهٔ AI گفتگو ÷ تعداد پاسخ (این بازه)">
                  {usd(cost.perReply.current)}
                  {perReplyTrend != null && (
                    <Badge tone={perReplyTrend <= 0 ? 'success' : 'warning'} className="ms-2">
                      {perReplyTrend > 0 ? '+' : ''}{perReplyTrend.toLocaleString('fa-IR')}٪ نسبت به بازهٔ قبل
                    </Badge>
                  )}
                </KV>
                <KV label="همان شاخص در بازهٔ قبل">{usd(cost.perReply.previous)} ({fa(cost.perReply.previousReplies)} پاسخ)</KV>
                <KV label="پاسخ‌های اصلی">{fa(cost.reply.calls)} فراخوانی · {usd(cost.reply.costUSD, 4)}</KV>
              </div>
              {cost.cache.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-[var(--text-muted)]">
                    کش پرامپت: سهم توکن‌های ورودی که از کش سرویس‌دهنده خوانده شد (ارزان‌تر حساب می‌شود). عدد بالاتر یعنی بخش ثابت پرامپت درست اول آمده است.
                  </p>
                  <ul className="space-y-2.5">
                    {cost.cache.map((row) => (
                      <li key={row.key}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-[12px]">
                          <span className="text-[var(--text-primary)]">{row.key === 'reply' ? 'پاسخ اصلی' : PURPOSE_LABELS[row.key] ?? row.key}</span>
                          <span className="tabular-nums text-[var(--text-muted)]">{pct(row.cachedTokens, row.promptTokens)} از {fa(row.promptTokens)} توکن</span>
                        </div>
                        <Progress value={row.cachedTokens} max={row.promptTokens || 1} tone="success" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4">
                <TableShell minWidth={480} bare>
                  <thead>
                    <tr>
                      <Th>فراخوانی جانبی</Th>
                      <Th>تعداد</Th>
                      <Th>توکن ورودی / خروجی</Th>
                      <Th>هزینه</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {cost.purposes.length ? cost.purposes.map((row) => (
                      <tr key={row.purpose}>
                        <Td className="text-[var(--text-primary)]">{PURPOSE_LABELS[row.purpose] ?? row.purpose}</Td>
                        <Td className="tabular-nums">{fa(row.calls)}</Td>
                        <Td className="tabular-nums">{fa(row.promptTokens)} / {fa(row.completionTokens)}</Td>
                        <Td><bdi dir="ltr" className="font-mono text-xs">{usd(row.costUSD, 4)}</bdi></Td>
                      </tr>
                    )) : (
                      <tr><Td className="text-center" >هنوز فراخوانی جانبی با برچسب ثبت نشده است.</Td></tr>
                    )}
                  </tbody>
                </TableShell>
              </div>
            </>
          )}
        </Panel>

        <Panel title="کیفیت پاسخ و مشتری" subtitle="از خط وضعیت هر پاسخ و تحلیل گفتگوها">
          {!q ? (
            <EmptyState icon={<Gauge />}>گزارش کیفیت خوانده نشد.</EmptyState>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              <KV label="گفتگوهای فعال / پاسخ‌های ایجنت">{fa(q.conversations)} / {fa(q.assistantTurns)}</KV>
              <KV label="پاسخ کامل / ناقص / بی‌پاسخ">{pct(q.answered.y, answeredTotal)} / {pct(q.answered.p, answeredTotal)} / {pct(q.answered.n, answeredTotal)}</KV>
              <KV label="پاسخ‌های علامت‌خورده «بی‌جواب»">{fa(q.unanswered)} ({pct(q.unanswered, q.assistantTurns)})</KV>
              <KV label="حال مشتری: مثبت / خنثی / ناراضی / عصبانی">
                {pct(q.mood.pos, q.withSignal)} / {pct(q.mood.neu, q.withSignal)} / {pct(q.mood.neg, q.withSignal)} / {pct(q.mood.ang, q.withSignal)}
              </KV>
              <KV label="مرحلهٔ خرید پیام‌ها (۰ تا ۳)">
                {[q.buy.b0, q.buy.b1, q.buy.b2, q.buy.b3].map((value) => pct(value, q.withSignal)).join(' / ')}
              </KV>
              <KV label="میانگین رضایت گفتگوها">{q.satisfactionAvg == null ? '—' : `${Math.round(q.satisfactionAvg).toLocaleString('fa-IR')} از ۱۰۰`}</KV>
              <KV label="گفتگوهای ناراضی (رضایت زیر ۴۰)">{fa(q.dissatisfied)} ({pct(q.dissatisfied, q.satisfactionRated)})</KV>
              <KV label="میانگین احتمال خرید / خریدار داغ (۷۰٪+)">
                {q.buyerAvg == null ? '—' : `${Math.round(q.buyerAvg).toLocaleString('fa-IR')}٪`} / {fa(q.hotBuyers)}
              </KV>
              <KV label="سفارش ثبت‌شده / پرداخت‌شده">{fa(q.ordersFiled)} / {fa(q.ordersPaid)}</KV>
              <KV label="لینک پرداخت ارسال‌شده / لغو">{fa(q.linksSent)} / {fa(q.cancelled)}</KV>
              <KV label="انتقال به اپراتور">{fa(q.handoffs)} ({pct(q.handoffs, q.conversations)} گفتگوها)</KV>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="دسترسی و قابلیت هر ایجنت" subtitle="همان چیزی که هسته در هر نوبت می‌بیند: سوییچ ایجنت × ماژول‌های کسب‌وکار × دادهٔ واقعی">
        {report.agents.length ? (
          <TableShell minWidth={980} bare>
            <thead>
              <tr>
                <Th>ایجنت</Th>
                <Th>کاتالوگ (موجود/کل) و دانش (آماده/کل)</Th>
                <Th>فروش</Th>
                <Th>رزرو، دوره، اپراتور</Th>
                <Th>کانال‌ها</Th>
                <Th>گفتگو در بازه</Th>
              </tr>
            </thead>
            <tbody>
              {report.agents.map((agent) => <AgentRow key={agent.id} agent={agent} />)}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState icon={<Cpu />}>ایجنتی برای نمایش نیست.</EmptyState>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="نمونهٔ نوبت‌هایی که مدل و مسیر قدیمی متفاوت خواندند" subtitle="برای بازبینی دستی؛ تصمیم در حالت «فعال» با مدل است">
          {u.disagreements.length ? (
            <ul className="space-y-3">
              {u.disagreements.map((row) => (
                <li key={row.id} className="rounded-control bg-[var(--bg-surface)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-muted)]">
                    <span>{fmtDate(row.createdAt)}</span>
                    {row.confidence != null && <span>اطمینان {Math.round(row.confidence * 100).toLocaleString('fa-IR')}٪</span>}
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-[13px] text-[var(--text-primary)]">{row.message ?? '—'}</p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[12px]">
                    <span className="text-[var(--text-muted)]">مدل:</span>
                    {row.acts.length ? row.acts.map((act) => <Badge key={`m-${act}`} tone="info">{ACT_LABELS[act] ?? act}</Badge>) : <Badge tone="muted">—</Badge>}
                    <span className="ms-2 text-[var(--text-muted)]">قدیمی:</span>
                    {row.legacyActs.length ? row.legacyActs.map((act) => <Badge key={`l-${act}`} tone="muted">{ACT_LABELS[act] ?? act}</Badge>) : <Badge tone="muted">—</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Scale />}>در این بازه نوبت متفاوتی ثبت نشده است.</EmptyState>
          )}
        </Panel>

        <Panel title="هسته در هر نوبت چه کاری می‌تواند بکند" subtitle="فهرست بستهٔ کنش‌ها؛ هر چیز خارج از آن «سایر» خوانده می‌شود و پاسخ عادی می‌گیرد">
          <div className="space-y-4">
            {CORE_ABILITIES.map((group) => (
              <div key={group.title}>
                <p className="text-[13px] font-semibold text-[var(--text-primary)]">{group.title}</p>
                <ul className="mt-1.5 list-disc space-y-1 ps-5 text-[12px] leading-6 text-[var(--text-secondary)]">
                  {group.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            ))}
            <p className="ui-caption">
              حوزه‌های قابل کنترل: {UNDERSTANDING_DOMAINS.map((domain) => DOMAIN_LABELS[domain] ?? domain).join('، ')}.
              ارزیابی دقت روی سرور: <code dir="ltr">npx tsx -r dotenv/config scripts/eval-understanding.ts --system both</code>
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}
