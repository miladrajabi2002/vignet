import Link from 'next/link'
import { AlertTriangle, BadgeCheck, Banknote, Percent, Store, Zap } from 'lucide-react'
import { TrendChart, BarList } from '@/components/admin/trend-chart'
import { filterGatewayBusinesses, loadGatewayBusinesses, loadGatewaySummary } from '@/lib/admin/payment-gateway'
import { getPlatformGatewaySettings } from '@/lib/payments/card/platform'
import { EmptyState, Panel, StatCard, fa } from '../ui'
import { GatewayBusinessesTable, toman } from './shared'

export const dynamic = 'force-dynamic'

export default async function AdminPaymentGatewayPage() {
  const [summary, businesses, platform] = await Promise.all([loadGatewaySummary(), loadGatewayBusinesses(), getPlatformGatewaySettings(true)])
  const live = businesses.filter((row) => row.state === 'live').length
  const attention = filterGatewayBusinesses(businesses, 'attention', '')
  const top = [...businesses].sort((a, b) => b.monthVolume - a.monthVolume).filter((row) => row.monthVolume > 0).slice(0, 8)
  const silent = businesses.filter((row) => row.silentDevice).length

  return (
    <div className="space-y-5">
      {!platform.enabled && (
        <p role="status" className="rounded-card border border-amber-200 bg-amber-50 p-3.5 text-sm leading-7 text-amber-900">
          درگاه پرداخت برای همهٔ کسب‌وکارها خاموش است؛ هیچ کارتی برای مشتری فرستاده نمی‌شود. <Link href="/admin/payment-gateway/settings" className="ui-link">تنظیمات</Link>
        </p>
      )}
      {!platform.inboundLines.length && (
        <p role="status" className="rounded-card border border-amber-200 bg-amber-50 p-3.5 text-sm leading-7 text-amber-900">
          هنوز شمارهٔ خط پیامکی ثبت نشده؛ گوشی‌هایی که پیامک را با «فوروارد پیامکی» می‌فرستند جایی برای فرستادن ندارند. <Link href="/admin/payment-gateway/settings" className="ui-link">ثبت خط و وب‌هوک</Link>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="کسب‌وکار فعال" value={fa(live)} sub={`از ${fa(businesses.length)} کسب‌وکار با درگاه`} icon={<Store />} />
        <StatCard label="پرداخت تأییدشدهٔ این ماه" value={fa(summary.monthPaid)} icon={<BadgeCheck />} series={summary.series.map((point) => point.count)} />
        <StatCard label="حجم این ماه" value={toman(summary.monthVolume)} icon={<Banknote />} series={summary.series.map((point) => point.volume)} />
        <StatCard label="تأیید خودکار" value={summary.autoRate == null ? '—' : `${fa(summary.autoRate)}٪`} sub="بدون دخالت صاحب کسب‌وکار" icon={<Zap />} />
        <StatCard label="نرخ پرداخت" value={summary.conversion == null ? '—' : `${fa(summary.conversion)}٪`} sub={`${fa(summary.expired)} منقضی این ماه`} icon={<Percent />} />
        <StatCard
          label="منتظر تصمیم"
          value={fa(summary.claimed + summary.unmatched)}
          sub={`${fa(summary.claimed)} بررسی · ${fa(summary.unmatched)} واریز بی‌سفارش${silent ? ` · ${fa(silent)} گوشی ساکت` : ''}`}
          tone={summary.claimed + summary.unmatched + silent > 0 ? 'danger' : 'default'}
          icon={<AlertTriangle />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <TrendChart title="حجم پرداخت‌های تأییدشده" subtitle="۳۰ روز اخیر · تومان" data={summary.series.map((point) => ({ day: point.day, value: point.volume }))} variant="area" format="toman" />
        <BarList title="پرکارترین کسب‌وکارها" subtitle="حجم این ماه" data={top.map((row) => ({ label: row.name, value: row.monthVolume }))} format="toman" />
      </div>

      <Panel title="نیاز به توجه" subtitle="پرداخت منتظر بررسی، واریز بی‌سفارش، گوشی ساکت یا نزدیک سقف" href="/admin/payment-gateway/businesses?filter=attention" linkLabel="همه">
        {attention.length ? <GatewayBusinessesTable rows={attention.slice(0, 10)} /> : <EmptyState>همه‌چیز مرتب است؛ موردی نیاز به رسیدگی ندارد.</EmptyState>}
      </Panel>
    </div>
  )
}
