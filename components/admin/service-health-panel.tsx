'use client'

import { useEffect, useState } from 'react'
import {
  Bot,
  Cloud,
  Database,
  Globe2,
  HardDrive,
  Loader2,
  Network,
  RefreshCw,
  ServerCog,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLocalizedDateTime } from '@/lib/localized-date'

type HealthState = 'healthy' | 'warning' | 'down' | 'unconfigured'
type Service = { state: HealthState; latencyMs: number | null; detail: string; creditsRemainingUSD?: number | null; usageMonthlyUSD?: number | null }
type FailedJobLog = { id: string; name: string; failedReason: string; stacktrace: string[]; data: unknown; timestamp: number; processedOn: number | null; finishedOn: number | null; attemptsMade: number }
type HealthPayload = {
  sampledAt: number
  services: { database: Service; redis: Service; storage: Service; openRouter: Service; iranRelay?: Service }
  queueMode: 'inline' | 'queue'
  queues: Array<{ name: string; waiting: number; active: number; delayed: number; failed: number; completed: number; failedJobs: FailedJobLog[] }>
  queueSummary: { failed: number; backlog: number }
  channels: Array<{ type: string; active: boolean; count: number; lastInboundAt: string | null }>
  attention: string[]
}

// Health is the one place where colour carries the meaning: a healthy and a
// down service must never look alike.
const STATE_META: Record<HealthState, { label: string; chip: string; panel: string }> = {
  healthy: { label: 'سالم', chip: 'ui-chip-ok', panel: '' },
  warning: { label: 'نیازمند بررسی', chip: 'ui-chip-warn', panel: '!border-amber-300' },
  down: { label: 'قطع', chip: 'ui-chip-danger', panel: '!border-red-300' },
  unconfigured: { label: 'تنظیم‌نشده', chip: 'ui-chip-neutral', panel: '' },
}

const QUEUE_LABELS: Record<string, string> = {
  'knowledge-ingestion': 'پردازش دانش',
  'product-embed': 'ایندکس محصولات',
  'conversation-summary': 'خلاصه گفتگو',
  notifications: 'اعلان‌ها',
  'inbound-message': 'پیام‌های ورودی',
  campaigns: 'کمپین‌ها',
}

const CHANNEL_LABELS: Record<string, string> = {
  TELEGRAM: 'تلگرام', WHATSAPP: 'واتساپ', INSTAGRAM: 'اینستاگرام', RUBIKA: 'روبیکا', BALE: 'بله', WEB_WIDGET: 'ویجت وب', CHAT_LINK: 'لینک چت', API: 'API',
}

export function ServiceHealthPanel() {
  const [data, setData] = useState<HealthPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [queueAction, setQueueAction] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/health', { cache: 'no-store' })
      if (!response.ok) throw new Error('HEALTH_UNAVAILABLE')
      setData(await response.json() as HealthPayload)
      setOffline(false)
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  async function runQueueAction(queueName: string, action: 'retryFailed' | 'clearFailed') {
    if (action === 'clearFailed' && !window.confirm('لاگ همه پردازش‌های ناموفق این صف پاک شود؟')) return
    const actionKey = `${queueName}:${action}`
    setQueueAction(actionKey)
    try {
      const response = await fetch('/api/admin/health', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queueName, action }) })
      const payload = await response.json() as { ok?: boolean; affected?: number; error?: string }
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'QUEUE_ACTION_FAILED')
      await refresh()
    } catch (error) {
      window.alert(`عملیات انجام نشد: ${error instanceof Error ? error.message : 'خطای نامشخص'}`)
    } finally {
      setQueueAction(null)
    }
  }

  const services = data ? [
    { key: 'database', label: 'پایگاه داده', icon: Database, value: data.services.database },
    { key: 'redis', label: 'ردیس و صف‌ها', icon: Network, value: data.services.redis },
    { key: 'storage', label: 'فضای ذخیره‌سازی', icon: HardDrive, value: data.services.storage },
    { key: 'openrouter', label: 'ارائه‌دهنده هوش مصنوعی', icon: Cloud, value: data.services.openRouter },
    ...(data.services.iranRelay ? [{ key: 'iran-relay', label: 'رله ایران', icon: Globe2, value: data.services.iranRelay }] : []),
  ] : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="ui-h3">نقشه سلامت سرویس‌ها</h2>
          <p className="ui-caption">پروب زنده دیتابیس، Redis، صف‌ها، فضای ذخیره‌سازی و Provider</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="admin-toolbar-button">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          بروزرسانی
        </button>
      </div>

      {offline && <p role="alert" className="rounded-control border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-[var(--danger-ink)]">گزارش سلامت دریافت نشد. اتصال یا نشست ادمین را بررسی کنید.</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
        {services.map(({ key, label, icon: Icon, value }) => {
          const meta = STATE_META[value.state]
          return (
            <article key={key} className={cn('spatial-surface rounded-card p-4', meta.panel)}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-chip bg-[var(--bg-muted)] text-[var(--text-secondary)]"><Icon className="h-4 w-4" /></span>
                <span className={cn('ui-chip', meta.chip)}><span aria-hidden className="ui-chip-dot" />{meta.label}</span>
              </div>
              <h3 className="ui-h3 mt-3 !text-[13px]">{label}</h3>
              <p className="mt-1 min-h-9 text-[12px] leading-5 text-[var(--text-muted)]">{value.detail}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-[12px] text-[var(--text-muted)]">
                <span>{value.latencyMs === null ? '—' : `${value.latencyMs.toLocaleString('fa-IR')} میلی‌ثانیه`}</span>
                {typeof value.creditsRemainingUSD === 'number' && <span>${value.creditsRemainingUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })} اعتبار</span>}
              </div>
            </article>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <section className="spatial-surface min-w-0 overflow-hidden rounded-card">
          <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5">
            <span className="admin-icon-well h-9 w-9"><ServerCog className="h-4 w-4" /></span>
            <div className="min-w-0"><h3 className="ui-h3 !leading-6">صف‌ها و پردازشگرها</h3><p className="truncate text-[12px] text-[var(--text-muted)]">حالت اجرا: {data?.queueMode === 'inline' ? 'درون‌خطی؛ بدون پردازشگر جدا' : 'پردازشگر صف فعال'}</p></div>
            {data && <span className={cn('ui-chip ms-auto shrink-0', data.queueSummary.failed > 0 ? 'ui-chip-danger' : 'ui-chip-ok')}>{data.queueSummary.failed.toLocaleString('fa-IR')} ناموفق</span>}
          </div>
          <div className="grid gap-2 p-3 md:hidden">
            {(data?.queues ?? []).map((queue) => (
              <article key={queue.name} className="rounded-control bg-[var(--bg-surface)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-[13px] font-bold text-[var(--text-primary)]">{QUEUE_LABELS[queue.name] ?? queue.name}</h4>
                  <span className={cn('ui-chip', queue.failed > 0 ? 'ui-chip-danger' : 'ui-chip-ok')}>{queue.failed.toLocaleString('fa-IR')} ناموفق</span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-[12px] text-[var(--text-muted)]">فعال</dt><dd className="mt-1 text-sm font-bold tabular-nums">{queue.active.toLocaleString('fa-IR')}</dd></div>
                  <div><dt className="text-[12px] text-[var(--text-muted)]">در انتظار</dt><dd className="mt-1 text-sm font-bold tabular-nums">{queue.waiting.toLocaleString('fa-IR')}</dd></div>
                  <div><dt className="text-[12px] text-[var(--text-muted)]">با تأخیر</dt><dd className="mt-1 text-sm font-bold tabular-nums">{queue.delayed.toLocaleString('fa-IR')}</dd></div>
                </dl>
              </article>
            ))}
            {data && data.queues.length === 0 && <p className="py-6 text-center text-xs text-[var(--text-muted)]">{data.queueMode === 'inline' ? 'صف‌ها در حالت Inline اجرا می‌شوند.' : 'اطلاعات صف دریافت نشد.'}</p>}
          </div>
          <div className="admin-table-shell admin-scroll hidden overflow-x-auto md:block">
            <table className="w-full min-w-[560px] text-[13px] text-[var(--text-secondary)]">
              <thead className="text-[12px] font-medium text-[var(--text-muted)] [&_th]:font-medium"><tr><th className="px-5 py-3 text-start">صف</th><th className="px-3 py-3">فعال</th><th className="px-3 py-3">در انتظار</th><th className="px-3 py-3">با تأخیر</th><th className="px-3 py-3">ناموفق</th><th className="px-3 py-3">تکمیل</th></tr></thead>
              <tbody>
                {(data?.queues ?? []).map((queue) => <tr key={queue.name}><td className="px-5 py-3 font-medium text-[var(--text-primary)]">{QUEUE_LABELS[queue.name] ?? queue.name}</td><td className="px-3 py-3 text-center tabular-nums">{queue.active.toLocaleString('fa-IR')}</td><td className="px-3 py-3 text-center tabular-nums">{queue.waiting.toLocaleString('fa-IR')}</td><td className="px-3 py-3 text-center tabular-nums">{queue.delayed.toLocaleString('fa-IR')}</td><td className={cn('px-3 py-3 text-center font-bold tabular-nums', queue.failed > 0 && 'text-[var(--danger-ink)]')}>{queue.failed.toLocaleString('fa-IR')}</td><td className="px-3 py-3 text-center tabular-nums text-[var(--text-muted)]">{queue.completed.toLocaleString('fa-IR')}</td></tr>)}
                {data && data.queues.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-[var(--text-muted)]">{data.queueMode === 'inline' ? 'صف‌ها در حالت Inline اجرا می‌شوند.' : 'اطلاعات صف دریافت نشد.'}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 border-t border-[var(--border-subtle)] p-3 sm:p-4">
            {(data?.queues ?? []).filter((queue) => queue.failedJobs.length > 0).map((queue) => (
              <details key={`logs-${queue.name}`} className="group overflow-hidden rounded-control border border-red-200 bg-red-50/60">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-[var(--text-primary)]">لاگ ناموفق · {QUEUE_LABELS[queue.name] ?? queue.name}</p><p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{queue.failedJobs.length.toLocaleString('fa-IR')} مورد اخیر برای بررسی</p></div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" disabled={queueAction !== null} onClick={(event) => { event.preventDefault(); void runQueueAction(queue.name, 'retryFailed') }} className="admin-toolbar-button min-h-9 px-2.5 text-[12px]">{queueAction === `${queue.name}:retryFailed` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} تلاش مجدد</button>
                    <button type="button" disabled={queueAction !== null} onClick={(event) => { event.preventDefault(); void runQueueAction(queue.name, 'clearFailed') }} className="admin-toolbar-button min-h-9 px-2.5 text-[12px]">پاک‌کردن لاگ</button>
                  </div>
                </summary>
                <div className="space-y-2 border-t border-red-200 p-3">
                  {queue.failedJobs.map((job) => (
                    <details key={job.id} className="rounded-control border border-[var(--border-subtle)] bg-white p-3">
                      <summary className="cursor-pointer list-none text-xs leading-6"><span className="font-bold text-[var(--text-primary)]">{job.name}</span><span className="mx-2 text-[var(--text-muted)]">·</span><span className="text-[var(--text-secondary)]">{job.failedReason}</span><span className="ms-2 text-[12px] text-[var(--text-muted)]">{formatLocalizedDateTime(job.finishedOn ?? job.timestamp, 'fa')}</span></summary>
                      <div className="mt-3 grid gap-2 lg:grid-cols-2"><pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap rounded-control bg-[#111] p-3 text-left text-[12px] leading-5 text-white/75">{job.stacktrace.join('\n') || job.failedReason}</pre><pre dir="ltr" className="admin-scroll max-h-64 overflow-auto whitespace-pre-wrap rounded-control bg-[var(--bg-surface)] p-3 text-left text-[12px] leading-5 text-[var(--text-secondary)]">{JSON.stringify(job.data, null, 2)}</pre></div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
            {data && data.queues.every((queue) => queue.failedJobs.length === 0) && <p className="py-4 text-center text-xs text-[var(--text-muted)]">لاگ ناموفقی برای نمایش وجود ندارد.</p>}
          </div>
        </section>

        <section className="spatial-surface min-w-0 rounded-card p-4 sm:p-5">
          <div className="flex items-center gap-3"><span className="admin-icon-well h-9 w-9"><Bot className="h-4 w-4" /></span><div className="min-w-0"><h3 className="ui-h3 !leading-6">شبکه‌های اجتماعی</h3><p className="truncate text-[12px] text-[var(--text-muted)]">اتصال‌های ثبت‌شده در پلتفرم</p></div></div>
          <div className="mt-3 divide-y divide-[var(--border-subtle)]">
            {(data?.channels ?? []).map((channel) => <div key={`${channel.type}-${channel.active}`} className="flex min-h-11 items-center gap-3"><span aria-hidden className={cn('h-2 w-2 rounded-full', channel.active ? 'bg-emerald-500' : 'bg-black/15')} /><span className="text-[13px] text-[var(--text-secondary)]">{CHANNEL_LABELS[channel.type] ?? channel.type}{!channel.active && <span className="text-[var(--text-muted)]"> · غیرفعال</span>}</span><span className="ms-auto text-[13px] font-bold tabular-nums text-[var(--text-primary)]">{channel.count.toLocaleString('fa-IR')}</span></div>)}
            {data && data.channels.length === 0 && <p className="py-6 text-center text-xs text-[var(--text-muted)]">کانالی ثبت نشده است.</p>}
          </div>
        </section>
      </div>

      {data && data.attention.length > 0 && (
        <section className="rounded-card border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-[13px] font-bold text-amber-950"><AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden /> موارد نیازمند توجه</div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">{data.attention.map((item) => <li key={item} className="flex items-center gap-2 text-xs text-amber-900"><span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{item}</li>)}</ul>
        </section>
      )}
    </div>
  )
}
