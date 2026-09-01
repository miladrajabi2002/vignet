'use client'

import { useEffect, useState } from 'react'
import {
  Bot,
  Cloud,
  Database,
  HardDrive,
  Loader2,
  Network,
  RefreshCw,
  ServerCog,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLocalizedDateTime } from '@/lib/localized-date'

type HealthState = 'healthy' | 'warning' | 'down' | 'unconfigured'
type Service = { state: HealthState; latencyMs: number | null; detail: string; creditsRemainingUSD?: number | null; usageMonthlyUSD?: number | null }
type FailedJobLog = { id: string; name: string; failedReason: string; stacktrace: string[]; data: unknown; timestamp: number; processedOn: number | null; finishedOn: number | null; attemptsMade: number }
type HealthPayload = {
  sampledAt: number
  services: { database: Service; redis: Service; storage: Service; openRouter: Service }
  queueMode: 'inline' | 'queue'
  queues: Array<{ name: string; waiting: number; active: number; delayed: number; failed: number; completed: number; failedJobs: FailedJobLog[] }>
  queueSummary: { failed: number; backlog: number }
  channels: Array<{ type: string; active: boolean; count: number; lastInboundAt: string | null }>
  attention: string[]
}

const STATE_META: Record<HealthState, { label: string; dot: string; panel: string }> = {
  healthy: { label: 'سالم', dot: 'bg-black', panel: 'border-black/10 bg-white' },
  warning: { label: 'نیازمند بررسی', dot: 'bg-zinc-500', panel: 'border-black/15 bg-zinc-50' },
  down: { label: 'قطع', dot: 'bg-black', panel: 'border-black/25 bg-zinc-100' },
  unconfigured: { label: 'تنظیم‌نشده', dot: 'bg-zinc-400', panel: 'border-zinc-200 bg-zinc-50' },
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
  ] : []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-black">نقشه سلامت سرویس‌ها</p>
          <p className="mt-1 text-[11px] text-black/45">پروب زنده دیتابیس، Redis، صف‌ها، فضای ذخیره‌سازی و Provider</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="admin-toolbar-button">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          بروزرسانی
        </button>
      </div>

      {offline && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">گزارش سلامت دریافت نشد. اتصال یا نشست ادمین را بررسی کنید.</p>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {services.map(({ key, label, icon: Icon, value }) => {
          const meta = STATE_META[value.state]
          return (
            <article key={key} className={cn('rounded-[1.35rem] border p-4 shadow-[0_14px_38px_-34px_rgba(0,0,0,.7)]', meta.panel)}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-black shadow-sm"><Icon className="h-4 w-4" /></span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/80 px-2 py-1 text-[10px] font-bold text-black/55"><span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />{meta.label}</span>
              </div>
              <h3 className="mt-4 text-sm font-black text-black">{label}</h3>
              <p className="mt-1 min-h-9 text-[11px] leading-5 text-black/50">{value.detail}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-black/40">
                <span>{value.latencyMs === null ? '—' : `${value.latencyMs.toLocaleString('fa-IR')} میلی‌ثانیه`}</span>
                {typeof value.creditsRemainingUSD === 'number' && <span>${value.creditsRemainingUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })} اعتبار</span>}
              </div>
            </article>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <section className="admin-panel overflow-hidden rounded-[1.5rem]">
          <div className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3.5 sm:px-5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-black text-white"><ServerCog className="h-4 w-4" /></span>
            <div><h3 className="text-sm font-black text-black">صف‌ها و پردازشگرها</h3><p className="mt-0.5 text-[10px] text-black/40">حالت اجرا: {data?.queueMode === 'inline' ? 'درون‌خطی؛ بدون پردازشگر جدا' : 'پردازشگر صف فعال'}</p></div>
            {data && <span className="ms-auto rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold text-zinc-800">{data.queueSummary.failed.toLocaleString('fa-IR')} ناموفق</span>}
          </div>
          <div className="grid gap-2 p-3 md:hidden">
            {(data?.queues ?? []).map((queue) => (
              <article key={queue.name} className="rounded-2xl border border-black/[0.07] bg-zinc-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-xs font-black text-black">{QUEUE_LABELS[queue.name] ?? queue.name}</h4>
                  <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold', queue.failed > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700')}>{queue.failed.toLocaleString('fa-IR')} ناموفق</span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-[9px] text-black/35">فعال</dt><dd className="mt-1 text-sm font-bold tabular-nums">{queue.active.toLocaleString('fa-IR')}</dd></div>
                  <div><dt className="text-[9px] text-black/35">در انتظار</dt><dd className="mt-1 text-sm font-bold tabular-nums">{queue.waiting.toLocaleString('fa-IR')}</dd></div>
                  <div><dt className="text-[9px] text-black/35">با تأخیر</dt><dd className="mt-1 text-sm font-bold tabular-nums">{queue.delayed.toLocaleString('fa-IR')}</dd></div>
                </dl>
              </article>
            ))}
            {data && data.queues.length === 0 && <p className="py-6 text-center text-xs text-black/40">{data.queueMode === 'inline' ? 'صف‌ها در حالت Inline اجرا می‌شوند.' : 'اطلاعات صف دریافت نشد.'}</p>}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="bg-black/[0.025] text-[10px] text-black/40"><tr><th className="px-5 py-3 text-start">صف</th><th className="px-3 py-3">فعال</th><th className="px-3 py-3">در انتظار</th><th className="px-3 py-3">با تأخیر</th><th className="px-3 py-3">ناموفق</th><th className="px-3 py-3">تکمیل</th></tr></thead>
              <tbody className="divide-y divide-black/[0.055]">
                {(data?.queues ?? []).map((queue) => <tr key={queue.name}><td className="px-5 py-3 font-bold text-black">{QUEUE_LABELS[queue.name] ?? queue.name}</td><td className="px-3 py-3 text-center tabular-nums">{queue.active.toLocaleString('fa-IR')}</td><td className="px-3 py-3 text-center tabular-nums">{queue.waiting.toLocaleString('fa-IR')}</td><td className="px-3 py-3 text-center tabular-nums">{queue.delayed.toLocaleString('fa-IR')}</td><td className={cn('px-3 py-3 text-center font-bold tabular-nums', queue.failed > 0 && 'text-red-600')}>{queue.failed.toLocaleString('fa-IR')}</td><td className="px-3 py-3 text-center tabular-nums text-black/45">{queue.completed.toLocaleString('fa-IR')}</td></tr>)}
                {data && data.queues.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-black/40">{data.queueMode === 'inline' ? 'صف‌ها در حالت Inline اجرا می‌شوند.' : 'اطلاعات صف دریافت نشد.'}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 border-t border-black/[0.06] p-3 sm:p-4">
            {(data?.queues ?? []).filter((queue) => queue.failedJobs.length > 0).map((queue) => (
              <details key={`logs-${queue.name}`} className="group overflow-hidden rounded-2xl border border-black/[0.08] bg-zinc-50/70">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold text-black">لاگ ناموفق · {QUEUE_LABELS[queue.name] ?? queue.name}</p><p className="mt-0.5 text-[10px] text-black/40">{queue.failedJobs.length.toLocaleString('fa-IR')} مورد اخیر برای بررسی</p></div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" disabled={queueAction !== null} onClick={(event) => { event.preventDefault(); void runQueueAction(queue.name, 'retryFailed') }} className="admin-toolbar-button min-h-9 px-2.5 text-[10px]">{queueAction === `${queue.name}:retryFailed` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} تلاش مجدد</button>
                    <button type="button" disabled={queueAction !== null} onClick={(event) => { event.preventDefault(); void runQueueAction(queue.name, 'clearFailed') }} className="admin-toolbar-button min-h-9 px-2.5 text-[10px]">پاک‌کردن لاگ</button>
                  </div>
                </summary>
                <div className="space-y-2 border-t border-black/[0.06] p-3">
                  {queue.failedJobs.map((job) => (
                    <details key={job.id} className="rounded-xl border border-black/[0.07] bg-white p-3">
                      <summary className="cursor-pointer list-none text-xs"><span className="font-bold text-black">{job.name}</span><span className="mx-2 text-black/25">·</span><span className="text-black/55">{job.failedReason}</span><span className="ms-2 text-[10px] text-black/35">{formatLocalizedDateTime(job.finishedOn ?? job.timestamp, 'fa')}</span></summary>
                      <div className="mt-3 grid gap-2 lg:grid-cols-2"><pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black p-3 text-left text-[10px] leading-5 text-white/70">{job.stacktrace.join('\n') || job.failedReason}</pre><pre dir="ltr" className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-black/[0.08] bg-zinc-50 p-3 text-left text-[10px] leading-5 text-black/60">{JSON.stringify(job.data, null, 2)}</pre></div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
            {data && data.queues.every((queue) => queue.failedJobs.length === 0) && <p className="py-4 text-center text-xs text-black/40">لاگ ناموفقی برای نمایش وجود ندارد.</p>}
          </div>
        </section>

        <section className="admin-panel rounded-[1.5rem] p-4 sm:p-5">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-black text-white"><Bot className="h-4 w-4" /></span><div><h3 className="text-sm font-black text-black">شبکه‌های اجتماعی</h3><p className="mt-0.5 text-[10px] text-black/40">اتصال‌های ثبت‌شده در پلتفرم</p></div></div>
          <div className="mt-4 space-y-2">
            {(data?.channels ?? []).map((channel) => <div key={`${channel.type}-${channel.active}`} className="flex min-h-11 items-center gap-3 rounded-xl border border-black/[0.06] bg-black/[0.018] px-3"><span className={cn('h-2 w-2 rounded-full', channel.active ? 'bg-emerald-500' : 'bg-zinc-300')} /><span className="text-xs font-semibold text-black/65">{CHANNEL_LABELS[channel.type] ?? channel.type}</span><span className="ms-auto text-xs font-bold tabular-nums text-black">{channel.count.toLocaleString('fa-IR')}</span></div>)}
            {data && data.channels.length === 0 && <p className="py-6 text-center text-xs text-black/40">کانالی ثبت نشده است.</p>}
          </div>
        </section>
      </div>

      {data && data.attention.length > 0 && (
        <section className="rounded-[1.4rem] border border-black/10 bg-zinc-50 p-4">
          <div className="flex items-center gap-2 text-xs font-black text-black"><ServerCog className="h-4 w-4" /> موارد نیازمند توجه</div>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">{data.attention.map((item) => <li key={item} className="flex items-center gap-2 text-xs text-black/65"><span className="h-1.5 w-1.5 rounded-full bg-black" />{item}</li>)}</ul>
        </section>
      )}
    </div>
  )
}
