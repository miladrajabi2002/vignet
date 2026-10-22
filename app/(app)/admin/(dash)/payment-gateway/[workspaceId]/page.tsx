import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, Banknote, Clock, ExternalLink, Smartphone, Zap } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { BankCardFace, BankMark } from '@/components/payments/bank-card'
import { GatewayActiveToggle, GatewayBusinessControls, GatewaySmsResolve } from '@/components/admin/gateway-admin-controls'
import { bankByKey } from '@/lib/payments/card/bins'
import { NOT_TEST } from '@/lib/payments/card/dashboard'
import { effectiveMonthlyCap, getPlatformGatewaySettings, monthStart } from '@/lib/payments/card/platform'
import { readPayGatewaySettings } from '@/lib/payments/card/settings'
import { suggestPaymentsForSms } from '@/lib/payments/card/ingest'
import { receivedTodayByCard } from '@/lib/payments/card/service'
import { Badge, EmptyState, KV, Panel, StatCard, fa, fmtDate } from '../../ui'
import { AdminPaymentsTable } from '../payments-table'
import { PLAN_FA, STATE_BADGE, ago, toman } from '../shared'

export const dynamic = 'force-dynamic'

export default async function AdminGatewayBusinessPage(props: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await props.params
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      plan: true,
      payGatewayEnabled: true,
      payGatewaySettings: true,
      payGatewaySuspendedAt: true,
      payGatewaySuspendReason: true,
      payGatewayCapOverride: true,
      owner: { select: { id: true, phone: true, name: true } },
    },
  })
  if (!workspace) notFound()

  const since = monthStart()
  const [platform, cards, deletedCards, devices, sites, payments, sms, month, auto, created, timing, received, agents] = await Promise.all([
    getPlatformGatewaySettings(true),
    prisma.payCard.findMany({ where: { workspaceId, deletedAt: null }, orderBy: { sortOrder: 'asc' } }),
    prisma.payCard.findMany({
      where: { workspaceId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: { id: true, bankKey: true, last4: true, holderName: true, deletedAt: true, _count: { select: { payments: { where: { ...NOT_TEST, status: 'PAID' } } } } },
    }),
    prisma.payDevice.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { messages: true } } } }),
    prisma.paySite.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' }, include: { _count: { select: { payments: true } } } }),
    prisma.cardPayment.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 40, include: { card: { select: { bankKey: true, last4: true, deletedAt: true } }, site: { select: { name: true } } } }),
    prisma.bankSms.findMany({ where: { workspaceId }, orderBy: { receivedAt: 'desc' }, take: 15 }),
    prisma.cardPayment.aggregate({ where: { workspaceId, ...NOT_TEST, status: 'PAID', paidAt: { gte: since } }, _count: { _all: true }, _sum: { baseAmount: true } }),
    prisma.cardPayment.count({ where: { workspaceId, ...NOT_TEST, status: 'PAID', paidAt: { gte: since }, confirmedBy: 'AUTO' } }),
    prisma.cardPayment.count({ where: { workspaceId, ...NOT_TEST, createdAt: { gte: since } } }),
    prisma.$queryRaw<Array<{ minutes: number | null }>>`SELECT AVG(EXTRACT(EPOCH FROM ("paidAt" - "createdAt")) / 60)::float AS minutes FROM "CardPayment" WHERE "workspaceId" = ${workspaceId} AND status = 'PAID' AND "paidAt" >= ${since} AND reference NOT LIKE 'TEST-%'`,
    receivedTodayByCard(workspaceId),
    prisma.agent.findMany({ where: { workspaceId }, select: { id: true, name: true, cardPayEnabled: true, payLinkEnabled: true, orderCaptureEnabled: true } }),
  ])
  const settings = readPayGatewaySettings(workspace.payGatewaySettings)
  const planCap = platform.planMonthlyCaps[workspace.plan]
  const cap = effectiveMonthlyCap(platform.planMonthlyCaps, workspace.plan, workspace.payGatewayCapOverride)
  const connected = devices.some((device) => device.active && device.connectedAt)
  const state = workspace.payGatewaySuspendedAt ? 'suspended' : !workspace.payGatewayEnabled ? 'off' : cards.some((card) => card.active) && connected ? 'live' : 'setup'
  const unmatched = sms.filter((row) => row.status === 'UNMATCHED')
  const suggestions = await Promise.all(unmatched.map((row) => suggestPaymentsForSms(workspaceId, row.amount)))
  const avgMinutes = timing[0]?.minutes

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/admin/payment-gateway/businesses" className="ui-link text-[12.5px]">→ همهٔ کسب‌وکارها</Link>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 text-xl font-extrabold text-[var(--text-primary)]">
            {workspace.name}
            <Badge tone={STATE_BADGE[state].tone}>{STATE_BADGE[state].label}</Badge>
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{PLAN_FA[workspace.plan] ?? workspace.plan} · مالک {workspace.owner?.name ?? '—'} <span dir="ltr">{workspace.owner?.phone ?? ''}</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/workspaces/${workspace.id}`} className="admin-toolbar-button min-h-10 px-3.5 text-[13px]">پروفایل کسب‌وکار<ExternalLink className="size-3.5" aria-hidden /></Link>
          {workspace.owner ? <Link href={`/admin/users/${workspace.owner.id}`} className="admin-toolbar-button min-h-10 px-3.5 text-[13px]">کاربر</Link> : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="پرداخت این ماه" value={fa(month._count._all)} sub={cap == null ? 'بدون سقف' : `از سقف ${fa(cap)}${workspace.payGatewayCapOverride != null ? ' (اختصاصی)' : ''}`} icon={<BadgeCheck />} tone={cap != null && month._count._all >= cap ? 'danger' : 'default'} />
        <StatCard label="حجم این ماه" value={toman(month._sum.baseAmount ?? 0)} icon={<Banknote />} />
        <StatCard label="تأیید خودکار" value={month._count._all ? `${fa(Math.round((auto / month._count._all) * 100))}٪` : '—'} sub={created ? `نرخ پرداخت ${fa(Math.round((month._count._all / created) * 100))}٪` : undefined} icon={<Zap />} />
        <StatCard label="میانگین زمان پرداخت" value={avgMinutes == null ? '—' : `${fa(Math.round(avgMinutes))} دقیقه`} sub={`مهلت ${fa(settings.ttlMinutes)} دقیقه`} icon={<Clock />} />
      </div>

      <Panel title="مدیریت" subtitle="کلید درگاه، سقف ماهانه و توقف از طرف ویجنت">
        <GatewayBusinessControls
          workspaceId={workspace.id}
          enabled={workspace.payGatewayEnabled}
          suspended={Boolean(workspace.payGatewaySuspendedAt)}
          suspendReason={workspace.payGatewaySuspendReason}
          capOverride={workspace.payGatewayCapOverride}
          planCap={planCap}
        />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="کارت‌های مقصد" subtitle="شماره کامل فقط برای مشتری‌ها فرستاده می‌شود؛ این‌جا پوشیده است">
          {cards.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {cards.map((card) => (
                <li key={card.id} className="space-y-2">
                  <BankCardFace bankKey={card.bankKey} pan={`${card.bin.slice(0, 4)} ${card.bin.slice(4)}•• •••• ${card.last4}`} holder={card.holderName} lang="fa" size="sm" muted={!card.active} />
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="text-[var(--text-secondary)]">{bankByKey(card.bankKey).fa} · امروز {toman(received.get(card.id) ?? 0)}{card.dailyCap ? ` از ${toman(card.dailyCap)}` : ''}</span>
                    <GatewayActiveToggle kind="cards" id={card.id} active={card.active} label={`کارت ••${card.last4} در چرخه`} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {card.verifiedAt ? <Badge tone="success">واریز تأییدشده دارد</Badge> : <Badge tone="muted">هنوز واریزی تأیید نشده</Badge>}
                    {!card.active ? <Badge tone="warning">بیرون از چرخه</Badge> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : <EmptyState>{deletedCards.length ? 'کارت فعالی نمانده؛ همهٔ کارت‌ها حذف شده‌اند.' : 'کارتی اضافه نشده است.'}</EmptyState>}
          {deletedCards.length ? (
            <details className="mt-4 border-t border-[var(--border-subtle)] pt-3">
              <summary className="cursor-pointer text-[13px] font-bold text-[var(--text-secondary)]">کارت‌های حذف‌شده · {fa(deletedCards.length)}</summary>
              <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
                {deletedCards.map((card) => (
                  <li key={card.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[12.5px]">
                    <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]"><BankMark bankKey={card.bankKey} size={20} /><span dir="ltr" className="font-mono">…{card.last4}</span></span>
                    <span className="text-[var(--text-secondary)]">{bankByKey(card.bankKey).fa}{card.holderName ? ` · ${card.holderName}` : ''}</span>
                    <span className="ms-auto text-[var(--text-muted)]">{fa(card._count.payments)} پرداخت · حذف {card.deletedAt ? fmtDate(card.deletedAt) : '—'}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Panel>

        <Panel title="گوشی‌های دریافت پیامک" subtitle="فقط پیامک همین شماره‌ها/نشانی‌ها خوانده می‌شود">
          {devices.length ? (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {devices.map((device) => (
                <li key={device.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--text-secondary)]"><Smartphone className="size-4.5" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[var(--text-primary)]">{device.name} <span className="text-[12px] font-normal text-[var(--text-muted)]">· {device.platform === 'IOS' ? 'آیفون' : 'اندروید'} · {device.method === 'URL' ? 'لینک' : 'پیامک'}</span></p>
                    <p className="text-[12.5px] text-[var(--text-secondary)]">
                      {device.phone ? <span dir="ltr">{device.phone}</span> : 'بدون شماره'} · آخرین پیامک {ago(device.lastSmsAt)} · {fa(device._count.messages)} پیامک
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {device.verifiedAt ? <Badge tone="success">تأییدشده با واریز</Badge> : device.connectedAt ? <Badge tone="info">وصل</Badge> : <Badge tone="warning">هنوز پیامکی نرسیده</Badge>}
                      {device.silentClaims > 0 ? <Badge tone="danger">{fa(device.silentClaims)} ادعای بی‌پیامک</Badge> : null}
                    </div>
                  </div>
                  <GatewayActiveToggle kind="devices" id={device.id} active={device.active} label={`پذیرفتن پیامک ${device.name}`} />
                </li>
              ))}
            </ul>
          ) : <EmptyState>گوشی‌ای ثبت نشده است.</EmptyState>}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="تنظیمات و روش پرداخت ایجنت‌ها">
          <div className="divide-y divide-[var(--border-subtle)]">
            <KV label="مهلت پرداخت">{fa(settings.ttlMinutes)} دقیقه</KV>
            <KV label="دکمهٔ «پرداخت کردم»">{settings.manualClaim ? 'نمایش داده می‌شود' : 'خاموش'}</KV>
            <KV label="نام صاحب کارت">{settings.showHolderName ? 'نمایش' : 'پنهان'}</KV>
            {agents.map((agent) => (
              <KV key={agent.id} label={`ایجنت ${agent.name}`}>
                {agent.cardPayEnabled && agent.payLinkEnabled ? 'درگاه ویجنت + سایت' : agent.cardPayEnabled ? 'درگاه ویجنت' : agent.payLinkEnabled ? 'سایت ووکامرس' : agent.orderCaptureEnabled ? 'اپراتور' : 'سفارش در چت خاموش'}
              </KV>
            ))}
          </div>
        </Panel>
        <Panel title="سایت‌های متصل (API)">
          {sites.length ? (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {sites.map((site) => (
                <li key={site.id} className="flex flex-wrap items-center gap-2 py-2.5 text-[13px]">
                  <b className="text-[var(--text-primary)]">{site.name}</b>
                  {site.domain ? <span dir="ltr" className="text-[var(--text-muted)]">{site.domain}</span> : null}
                  <span dir="ltr" className="font-mono text-[12px] text-[var(--text-muted)]">{site.keyHint}</span>
                  <span className="ms-auto text-[12px] text-[var(--text-secondary)]">{fa(site._count.payments)} پرداخت · {site.lastUsedAt ? `آخرین استفاده ${fmtDate(site.lastUsedAt)}` : 'استفاده نشده'}</span>
                  {!site.active ? <Badge tone="muted">غیرفعال</Badge> : null}
                </li>
              ))}
            </ul>
          ) : <EmptyState>سایتی وصل نشده است.</EmptyState>}
        </Panel>
      </div>

      {unmatched.length ? (
        <Panel title="واریزهای بی‌سفارش" subtitle="به پرداخت درست وصل کنید تا تأیید شود">
          <ul className="divide-y divide-[var(--border-subtle)]">
            {unmatched.map((row, index) => (
              <li key={row.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <b className="tabular-nums">{row.amount != null ? toman(row.amount) : 'مبلغ خوانده نشد'}</b>
                  <span className="ms-auto text-[12px] text-[var(--text-muted)]">{fmtDate(row.receivedAt)}</span>
                </div>
                <pre dir="rtl" className="whitespace-pre-wrap rounded-control bg-[var(--bg-surface)] p-2 font-sans text-[12.5px] leading-6 text-[var(--text-secondary)]">{row.text}</pre>
                <GatewaySmsResolve smsId={row.id} suggestions={suggestions[index].map((payment) => ({ id: payment.id, label: `#${payment.reference} · ${fa(payment.payAmount)} تومان${payment.customerName ? ` · ${payment.customerName}` : ''}` }))} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel title="تراکنش‌ها" subtitle="۴۰ تراکنش آخر" href={`/admin/payment-gateway/payments?q=${encodeURIComponent(workspace.name)}`} linkLabel="جستجوی همه">
        {payments.length ? <AdminPaymentsTable rows={payments} showBusiness={false} /> : <EmptyState>هنوز تراکنشی ساخته نشده است.</EmptyState>}
      </Panel>

      <Panel title="آخرین پیامک‌ها" subtitle="مانده حساب پیش از ذخیره حذف می‌شود">
        {sms.length ? (
          <ul className="grid gap-2.5 md:grid-cols-2">
            {sms.map((row) => (
              <li key={row.id} className="rounded-2xl border border-[var(--border-subtle)] p-3 text-[12.5px]">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <Badge tone={row.status === 'MATCHED' ? 'success' : row.status === 'UNMATCHED' ? 'warning' : 'muted'}>{row.status === 'MATCHED' ? 'تطبیق خودکار' : row.status === 'UNMATCHED' ? 'بی‌سفارش' : row.status === 'RESOLVED' ? 'رسیدگی‌شده' : 'نادیده'}</Badge>
                  {row.amount != null ? <span className="tabular-nums">{toman(row.amount)}</span> : null}
                  <span className="ms-auto text-[var(--text-muted)]">{fmtDate(row.receivedAt)}</span>
                </div>
                <pre dir="rtl" className="whitespace-pre-wrap font-sans leading-6 text-[var(--text-secondary)]">{row.text}</pre>
              </li>
            ))}
          </ul>
        ) : <EmptyState>هنوز پیامکی نرسیده است.</EmptyState>}
      </Panel>
    </div>
  )
}
