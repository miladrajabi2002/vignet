'use client'

import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  Activity,
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  CheckCheck,
  CircleGauge,
  Clock3,
  Command,
  Copy,
  ExternalLink,
  Inbox,
  KeyRound,
  Loader2,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCw,
  Save,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  Webhook,
  Wifi,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { DialogShell } from '@/components/ui/dialog-shell'
import { cn } from '@/lib/utils'

export interface OperatorChannelInfo {
  id: string
  botUsername: string | null
  operatorChatId: string | null
  active: boolean
  lastError: string | null
  botTokenMasked: string | null
  createdAt: string
  updatedAt: string
}

export interface OperatorChannelStats {
  open: number
  claimed: number
  resolved7d: number
  total7d: number
  delivered7d: number
  deliveryRate: number | null
  latestAlertAt: string | null
}

interface OperatorChannelHealth {
  status: 'healthy' | 'warning' | 'error'
  checkedAt: string
  botReachable: boolean
  botUsername: string | null
  active: boolean
  chatConfigured: boolean
  webhookConfigured: boolean
  webhookMatches: boolean
  pendingUpdateCount: number
  maxConnections: number | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  configurationUpdatedAt: string
}

type BusyAction = 'connect' | 'toggle' | 'chat' | 'test' | 'remove' | null
type Feedback = { tone: 'success' | 'error' | 'info'; message: string } | null

async function fetchOperatorHealth(): Promise<OperatorChannelHealth> {
  const response = await fetch('/api/operator-channel/diagnostics', { cache: 'no-store' })
  const data = (await response.json().catch(() => null)) as {
    health?: OperatorChannelHealth
    error?: string
  } | null
  if (!response.ok || !data?.health) throw new Error(data?.error ?? 'HEALTH_CHECK_FAILED')
  return data.health
}

function localeNumber(value: number, fa: boolean): string {
  return value.toLocaleString(fa ? 'fa-IR' : 'en-US')
}

function localeDate(value: string | null, fa: boolean): string {
  if (!value) return fa ? 'هنوز فعالیتی ثبت نشده' : 'No activity yet'
  return new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function GlassButton({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-[background-color,border-color,opacity] duration-200 hover:border-white/25 hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function MetricCard({
  icon,
  value,
  label,
  detail,
}: {
  icon: ReactNode
  value: string
  label: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-black/[0.065] bg-white/75 p-4 shadow-[0_14px_40px_-34px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]">{value}</p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--text-secondary)]">{label}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--text-secondary)]">{icon}</span>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-[var(--text-muted)]">{detail}</p>
    </div>
  )
}

function HealthRow({
  icon,
  label,
  value,
  ok,
}: {
  icon: ReactNode
  label: string
  value: string
  ok: boolean
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 border-b border-black/[0.055] px-1 last:border-b-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[0.035] text-[var(--text-secondary)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[var(--text-primary)]">{label}</p>
        <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">{value}</p>
      </div>
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />}
    </div>
  )
}

export function OperatorChannelSetup({
  current,
  stats,
}: {
  current: OperatorChannelInfo | null
  stats: OperatorChannelStats
}) {
  const t = useTranslations('operatorChannel')
  const fa = useLocale() !== 'en'
  const router = useRouter()
  const copy = (faText: string, enText: string) => (fa ? faText : enText)

  const [info, setInfo] = useState<OperatorChannelInfo | null>(current)
  const [active, setActive] = useState(current?.active ?? true)
  const [botToken, setBotToken] = useState('')
  const [operatorChatId, setOperatorChatId] = useState(current?.operatorChatId ?? '')
  const [busy, setBusy] = useState<BusyAction>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [health, setHealth] = useState<OperatorChannelHealth | null>(null)
  const [healthLoading, setHealthLoading] = useState(Boolean(current))
  const [healthFailed, setHealthFailed] = useState(false)
  const [showTokenRotation, setShowTokenRotation] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const operatorId = info?.id ?? null

  useEffect(() => {
    if (!operatorId) {
      setHealth(null)
      setHealthLoading(false)
      return
    }

    let cancelled = false
    setHealthLoading(true)
    setHealthFailed(false)
    void fetchOperatorHealth()
      .then((result) => {
        if (!cancelled) setHealth(result)
      })
      .catch(() => {
        if (!cancelled) setHealthFailed(true)
      })
      .finally(() => {
        if (!cancelled) setHealthLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [operatorId])

  async function refreshHealth() {
    if (!info || healthLoading) return
    setHealthLoading(true)
    setHealthFailed(false)
    try {
      setHealth(await fetchOperatorHealth())
    } catch {
      setHealthFailed(true)
    } finally {
      setHealthLoading(false)
    }
  }

  async function connect() {
    if (!botToken.trim() || busy) return
    setBusy('connect')
    setFeedback(null)
    try {
      const response = await fetch('/api/operator-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botToken.trim(),
          operatorChatId: operatorChatId.trim() || undefined,
          active,
        }),
      })
      const data = (await response.json().catch(() => null)) as {
        operatorChannel?: OperatorChannelInfo
        error?: string
      } | null
      if (!response.ok || !data?.operatorChannel) {
        setFeedback({
          tone: 'error',
          message: data?.error === 'INVALID_TOKEN' ? t('invalidToken') : data?.error ?? t('saveFailed'),
        })
        return
      }
      setInfo(data.operatorChannel)
      setActive(data.operatorChannel.active)
      setOperatorChatId(data.operatorChannel.operatorChatId ?? '')
      setBotToken('')
      setShowTokenRotation(false)
      setFeedback({ tone: 'success', message: copy('تنظیمات بات با موفقیت ذخیره شد.', 'Bot settings were saved successfully.') })
      router.refresh()
    } catch {
      setFeedback({ tone: 'error', message: t('saveFailed') })
    } finally {
      setBusy(null)
    }
  }

  async function toggleActive(next: boolean) {
    if (!info || busy) return
    const previous = active
    setActive(next)
    setBusy('toggle')
    setFeedback(null)
    try {
      const response = await fetch('/api/operator-channel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      })
      const data = (await response.json().catch(() => null)) as {
        operatorChannel?: Omit<OperatorChannelInfo, 'botTokenMasked'>
      } | null
      if (!response.ok || !data?.operatorChannel) throw new Error('TOGGLE_FAILED')
      setInfo((value) => (value ? { ...value, ...data.operatorChannel, active: next } : value))
      setFeedback({
        tone: 'info',
        message: next
          ? copy('ارسال هشدارهای بات فعال شد.', 'Bot alerts are now active.')
          : copy('ارسال هشدارها موقتاً متوقف شد.', 'Bot alerts are temporarily paused.'),
      })
      router.refresh()
      void refreshHealth()
    } catch {
      setActive(previous)
      setFeedback({ tone: 'error', message: t('saveFailed') })
    } finally {
      setBusy(null)
    }
  }

  async function saveChatId() {
    if (!info || !operatorChatId.trim() || busy) return
    setBusy('chat')
    setFeedback(null)
    try {
      const response = await fetch('/api/operator-channel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorChatId: operatorChatId.trim() }),
      })
      const data = (await response.json().catch(() => null)) as {
        operatorChannel?: Omit<OperatorChannelInfo, 'botTokenMasked'>
      } | null
      if (!response.ok || !data?.operatorChannel) throw new Error('SAVE_CHAT_FAILED')
      setInfo((value) => (value ? { ...value, ...data.operatorChannel } : value))
      setFeedback({ tone: 'success', message: copy('شناسه اپراتور ذخیره شد.', 'Operator chat id was saved.') })
      router.refresh()
      void refreshHealth()
    } catch {
      setFeedback({ tone: 'error', message: t('saveFailed') })
    } finally {
      setBusy(null)
    }
  }

  async function testConnection() {
    if (!info || busy) return
    setBusy('test')
    setFeedback(null)
    try {
      const response = await fetch('/api/operator-channel/test', { method: 'POST' })
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) throw new Error(data?.error ?? 'TEST_FAILED')
      setInfo((value) => (value ? { ...value, lastError: null } : value))
      setFeedback({
        tone: 'success',
        message: copy('پیام آزمایشی با موفقیت به تلگرام ارسال شد.', 'The test message was delivered to Telegram.'),
      })
      router.refresh()
      void refreshHealth()
    } catch (error) {
      const reason = error instanceof Error ? error.message : ''
      setFeedback({
        tone: 'error',
        message: reason === 'NO_CHAT_ID'
          ? copy('ابتدا شناسه چت اپراتور را ثبت کنید.', 'Add the operator chat id first.')
          : copy('پیام آزمایشی ارسال نشد؛ وضعیت سلامت را بررسی کنید.', 'The test message failed; check connection health.'),
      })
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!info || busy) return
    setBusy('remove')
    setFeedback(null)
    try {
      const response = await fetch('/api/operator-channel', { method: 'DELETE' })
      if (!response.ok) throw new Error('REMOVE_FAILED')
      setInfo(null)
      setActive(true)
      setBotToken('')
      setOperatorChatId('')
      setHealth(null)
      setRemoveOpen(false)
      setFeedback({ tone: 'info', message: copy('اتصال بات حذف شد.', 'The bot connection was removed.') })
      router.refresh()
    } catch {
      setFeedback({ tone: 'error', message: copy('حذف اتصال انجام نشد.', 'The connection could not be removed.') })
    } finally {
      setBusy(null)
    }
  }

  async function copyUsername() {
    if (!info?.botUsername) return
    try {
      await navigator.clipboard.writeText(`@${info.botUsername}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_500)
    } catch {
      setCopied(false)
    }
  }

  const botUrl = info?.botUsername ? `https://t.me/${info.botUsername}` : null
  const headlineStatus = !info
    ? copy('آماده اتصال', 'Ready to connect')
    : active
      ? t('connected')
      : copy('متوقف', 'Paused')
  const statusTone = !info ? 'bg-white/10 text-white/65' : active ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200'
  const deliveryValue = stats.deliveryRate === null
    ? '—'
    : `${localeNumber(stats.deliveryRate, fa)}٪`

  return (
    <section id="telegram-operator" className="spatial-surface scroll-mt-28 overflow-hidden rounded-[1.75rem]">
      <div className="relative overflow-hidden bg-[#0b0b0d] px-5 py-6 text-white sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -end-24 -top-28 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 start-1/3 h-64 w-64 rounded-full bg-emerald-400/[0.07] blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
              <Bot className="h-5 w-5" />
              {info && active && <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#0b0b0d] bg-emerald-400" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">{t('title')}</h2>
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold', statusTone)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', info && active ? 'bg-emerald-300' : info ? 'bg-amber-200' : 'bg-white/45')} />
                  {headlineStatus}
                </span>
              </div>
              <p className="mt-2 max-w-2xl text-xs leading-6 text-white/55">{t('desc')}</p>
              {info?.botUsername && <p dir="ltr" className="mt-2 w-max font-mono text-[11px] text-white/35">@{info.botUsername}</p>}
            </div>
          </div>

          {info && (
            <div className="flex flex-wrap gap-2">
              {botUrl && (
                <a href={botUrl} target="_blank" rel="noreferrer" className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 text-xs font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-colors hover:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80">
                  <Send className="h-4 w-4" />
                  {copy('باز کردن بات', 'Open bot')}
                  <ExternalLink className="h-3.5 w-3.5 text-white/45" />
                </a>
              )}
              <GlassButton onClick={() => void refreshHealth()} disabled={healthLoading} aria-label={copy('بررسی دوباره سلامت اتصال', 'Refresh connection health')}>
                <RefreshCw className={cn('h-4 w-4', healthLoading && 'animate-spin motion-reduce:animate-none')} />
                {copy('بررسی زنده', 'Live check')}
              </GlassButton>
            </div>
          )}
        </div>
      </div>

      {info ? (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              icon={<Inbox className="h-4 w-4" />}
              value={localeNumber(stats.open, fa)}
              label={copy('منتظر پاسخ', 'Awaiting reply')}
              detail={copy('گفتگوهای باز در صف اپراتور', 'Open conversations in the operator queue')}
            />
            <MetricCard
              icon={<UserRoundCheck className="h-4 w-4" />}
              value={localeNumber(stats.claimed, fa)}
              label={copy('در حال پیگیری', 'In progress')}
              detail={copy('گفتگوهای قبول‌شده توسط اپراتور', 'Conversations claimed by an operator')}
            />
            <MetricCard
              icon={<CheckCheck className="h-4 w-4" />}
              value={localeNumber(stats.resolved7d, fa)}
              label={copy('حل‌شده در ۷ روز', 'Resolved in 7 days')}
              detail={copy('موارد تکمیل‌شده در هفته اخیر', 'Completed handoffs in the last week')}
            />
            <MetricCard
              icon={<Activity className="h-4 w-4" />}
              value={deliveryValue}
              label={copy('نرخ تحویل تلگرام', 'Telegram delivery rate')}
              detail={stats.total7d > 0
                ? copy(`${localeNumber(stats.delivered7d, fa)} از ${localeNumber(stats.total7d, fa)} ارجاع هفته`, `${stats.delivered7d} of ${stats.total7d} weekly handoffs`)
                : copy('پس از اولین ارجاع محاسبه می‌شود', 'Calculated after the first handoff')}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[1.4rem] border border-black/[0.065] bg-white/70 p-4 shadow-[0_18px_55px_-46px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <CircleGauge className="h-4 w-4 text-[var(--text-secondary)]" />
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{copy('سلامت و آمادگی سرویس', 'Service health and readiness')}</h3>
                  </div>
                  <p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">
                    {health?.checkedAt
                      ? copy(`آخرین بررسی: ${localeDate(health.checkedAt, fa)}`, `Last checked: ${localeDate(health.checkedAt, fa)}`)
                      : copy('وضعیت زنده از Telegram Bot API بررسی می‌شود.', 'Live status is checked through Telegram Bot API.')}
                  </p>
                </div>
                <span className={cn(
                  'inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold',
                  healthLoading
                    ? 'bg-black/[0.045] text-[var(--text-muted)]'
                    : health?.status === 'healthy'
                      ? 'bg-emerald-50 text-emerald-700'
                      : health?.status === 'error' || healthFailed
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-700',
                )}>
                  {healthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <Wifi className="h-3.5 w-3.5" />}
                  {healthLoading
                    ? copy('در حال بررسی', 'Checking')
                    : health?.status === 'healthy'
                      ? copy('سالم', 'Healthy')
                      : health?.status === 'error' || healthFailed
                        ? copy('نیازمند بررسی', 'Needs attention')
                        : copy('هشدار', 'Warning')}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-black/[0.05] bg-white/70 px-3">
                <HealthRow
                  icon={<Bot className="h-4 w-4" />}
                  label={copy('دسترسی به بات', 'Bot API access')}
                  value={healthLoading ? copy('در حال دریافت اطلاعات بات…', 'Reading bot information…') : health?.botReachable ? `@${health.botUsername ?? info.botUsername ?? '—'}` : copy('پاسخی از تلگرام دریافت نشد', 'Telegram did not respond')}
                  ok={health?.botReachable ?? true}
                />
                <HealthRow
                  icon={<Webhook className="h-4 w-4" />}
                  label="Webhook"
                  value={health?.webhookMatches ? copy('آدرس امن ویجنت ثبت شده است', 'Secure Vigent endpoint is registered') : healthLoading ? copy('در حال تطبیق آدرس…', 'Verifying endpoint…') : copy('آدرس webhook نیازمند بازبینی است', 'Webhook endpoint needs review')}
                  ok={health?.webhookMatches ?? !info.lastError}
                />
                <HealthRow
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label={copy('دسترسی اپراتور', 'Operator access')}
                  value={info.operatorChatId ? copy('شناسه چت اختصاصی ثبت شده', 'Dedicated chat id is configured') : copy('شناسه چت ثبت نشده', 'Chat id is missing')}
                  ok={Boolean(info.operatorChatId)}
                />
                <HealthRow
                  icon={active ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                  label={copy('ارسال خودکار هشدار', 'Automatic alert delivery')}
                  value={active ? copy('فعال و آماده ارسال', 'Active and ready') : copy('موقتاً متوقف', 'Temporarily paused')}
                  ok={active}
                />
              </div>

              {(health?.lastErrorMessage || info.lastError || healthFailed) && (
                <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3 text-[10px] leading-5 text-amber-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold">{copy('آخرین هشدار فنی', 'Latest technical warning')}</p>
                    <p dir="auto" className="mt-0.5 break-words text-amber-800/80">
                      {healthFailed
                        ? copy('بررسی زنده کامل نشد؛ دوباره تلاش کنید.', 'The live check did not complete; try again.')
                        : health?.lastErrorMessage ?? info.lastError}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[1.4rem] border border-black/[0.065] bg-white/70 p-4 shadow-[0_18px_55px_-46px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:p-5">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-[var(--text-secondary)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{copy('کنترل‌های مدیریتی', 'Management controls')}</h3>
              </div>
              <p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">{copy('اتصال، دسترسی اپراتور و ارسال هشدار را از یک نقطه مدیریت کنید.', 'Manage connection, operator access and alerts from one place.')}</p>

              <div className="mt-4 space-y-3">
                <div className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white/75 px-3.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-[var(--text-primary)]">{t('active')}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{active ? copy('هشدارهای جدید ارسال می‌شوند', 'New alerts are delivered') : copy('هشدار جدید ارسال نمی‌شود', 'New alerts are paused')}</p>
                  </div>
                  <Switch checked={active} onChange={(next) => void toggleActive(next)} disabled={busy !== null} aria-label={t('active')} />
                </div>

                <div className="rounded-2xl border border-black/[0.06] bg-white/75 p-3.5">
                  <label htmlFor="operator-chat-id" className="text-[11px] font-bold text-[var(--text-primary)]">{t('operatorChatId')}</label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="operator-chat-id"
                      dir="ltr"
                      type="text"
                      inputMode="numeric"
                      value={operatorChatId}
                      onChange={(event) => setOperatorChatId(event.target.value)}
                      placeholder="123456789"
                      className="input min-h-11 min-w-0 flex-1 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => void saveChatId()}
                      disabled={busy !== null || !operatorChatId.trim() || operatorChatId.trim() === (info.operatorChatId ?? '')}
                      className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 text-xs font-bold text-white shadow-[var(--shadow-control)] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {busy === 'chat' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Save className="h-4 w-4" />}
                      {copy('ذخیره', 'Save')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void testConnection()}
                    disabled={busy !== null}
                    className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 text-xs font-bold text-[var(--text-secondary)] shadow-sm hover:text-[var(--text-primary)] disabled:opacity-45"
                  >
                    {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Send className="h-4 w-4" />}
                    {t('test')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void copyUsername()}
                    className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 text-xs font-bold text-[var(--text-secondary)] shadow-sm hover:text-[var(--text-primary)]"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? copy('کپی شد', 'Copied') : copy('کپی نام بات', 'Copy bot name')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[1.4rem] border border-black/[0.065] bg-black/[0.018] p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black text-white shadow-[var(--shadow-control)]"><Command className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{copy('مرکز فرمان داخل تلگرام', 'Telegram command center')}</h3>
                  <p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">{copy('دکمه‌های شیشه‌ای بات بدون نیاز به تایپ دستور، عملیات اصلی را اجرا می‌کنند.', 'Inline Telegram controls run key operations without typing commands.')}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  [Inbox, copy('صف گفتگوهای منتظر', 'Pending conversation queue')],
                  [CircleGauge, copy('گزارش و سلامت زنده', 'Live reports and health')],
                  [UserRoundCheck, copy('قبول گفتگو با یک لمس', 'One-tap conversation claim')],
                  [CheckCheck, copy('ثبت وضعیت حل‌شده', 'One-tap resolution')],
                ].map(([Icon, label]) => {
                  const ItemIcon = Icon as typeof Inbox
                  return (
                    <div key={label as string} className="flex min-h-12 items-center gap-2.5 rounded-xl border border-black/[0.055] bg-white/65 px-3 text-[10px] font-semibold text-[var(--text-secondary)]">
                      <ItemIcon className="h-4 w-4 shrink-0" />
                      {label as string}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-black/[0.065] bg-black/[0.018] p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[var(--text-secondary)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{copy('جزئیات اتصال', 'Connection details')}</h3>
              </div>
              <dl className="mt-4 space-y-3 text-[10px]">
                <div className="flex items-center justify-between gap-3"><dt className="text-[var(--text-muted)]">{copy('آخرین ارجاع', 'Latest handoff')}</dt><dd className="text-end font-semibold text-[var(--text-secondary)]">{localeDate(stats.latestAlertAt, fa)}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-[var(--text-muted)]">{copy('آخرین تغییر تنظیمات', 'Last configuration change')}</dt><dd className="text-end font-semibold text-[var(--text-secondary)]">{localeDate(info.updatedAt, fa)}</dd></div>
                <div className="flex items-center justify-between gap-3"><dt className="text-[var(--text-muted)]">{copy('به‌روزرسانی در صف تلگرام', 'Queued Telegram updates')}</dt><dd className="font-mono font-semibold text-[var(--text-secondary)]">{localeNumber(health?.pendingUpdateCount ?? 0, fa)}</dd></div>
              </dl>

              <div className="mt-4 border-t border-black/[0.06] pt-4">
                <button
                  type="button"
                  onClick={() => setShowTokenRotation((value) => !value)}
                  className="spatial-press inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-[10px] font-bold text-[var(--text-secondary)] hover:bg-white"
                  aria-expanded={showTokenRotation}
                >
                  <RotateCw className="h-4 w-4" />
                  {copy('تعویض امن توکن بات', 'Securely rotate bot token')}
                </button>
                {showTokenRotation && (
                  <div className="mt-2 rounded-2xl border border-black/[0.07] bg-white p-3">
                    <label htmlFor="rotate-bot-token" className="text-[10px] font-bold text-[var(--text-secondary)]">{copy('توکن جدید', 'New token')}</label>
                    <input id="rotate-bot-token" dir="ltr" type="password" autoComplete="off" value={botToken} onChange={(event) => setBotToken(event.target.value)} placeholder="1234567890:AA…" className="input mt-2 min-h-11 w-full font-mono text-sm" />
                    <button type="button" onClick={() => void connect()} disabled={busy !== null || !botToken.trim()} className="spatial-press mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-black px-3 text-[10px] font-bold text-white disabled:opacity-40">
                      {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <KeyRound className="h-4 w-4" />}
                      {copy('ثبت توکن جدید', 'Save new token')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-black/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div aria-live="polite" className="min-h-5 text-xs">
              {feedback && (
                <span className={cn(
                  'inline-flex items-center gap-1.5',
                  feedback.tone === 'error' ? 'text-red-600' : feedback.tone === 'success' ? 'text-emerald-700' : 'text-[var(--text-secondary)]',
                )}>
                  {feedback.tone === 'error' ? <AlertCircle className="h-4 w-4" /> : feedback.tone === 'success' ? <Check className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                  {feedback.message}
                </span>
              )}
            </div>
            <button type="button" onClick={() => setRemoveOpen(true)} className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">
              <Trash2 className="h-4 w-4" />
              {copy('حذف اتصال بات', 'Remove bot connection')}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.4rem] border border-black/[0.065] bg-white/75 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-black/[0.045] text-[var(--text-secondary)]"><KeyRound className="h-4 w-4" /></span>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">{copy('اتصال امن بات', 'Secure bot connection')}</h3>
                <p className="mt-1 text-[10px] leading-5 text-[var(--text-muted)]">{copy('توکن به‌صورت رمزگذاری‌شده ذخیره می‌شود و هیچ‌وقت دوباره نمایش داده نمی‌شود.', 'The token is encrypted at rest and is never shown again.')}</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="operator-bot-token" className="text-xs font-bold text-[var(--text-secondary)]">{t('botToken')}</label>
                  <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 text-[10px] font-semibold text-[var(--text-muted)] underline decoration-black/20 underline-offset-4 hover:text-[var(--text-primary)]">@BotFather <ExternalLink className="h-3 w-3" /></a>
                </div>
                <input id="operator-bot-token" dir="ltr" type="password" autoComplete="off" value={botToken} onChange={(event) => { setBotToken(event.target.value); setFeedback(null) }} placeholder="1234567890:AA…" className="input min-h-12 w-full font-mono text-sm" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label htmlFor="new-operator-chat-id" className="text-xs font-bold text-[var(--text-secondary)]">{t('operatorChatId')}</label>
                  <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1 text-[10px] font-semibold text-[var(--text-muted)] underline decoration-black/20 underline-offset-4 hover:text-[var(--text-primary)]">@userinfobot <ExternalLink className="h-3 w-3" /></a>
                </div>
                <input id="new-operator-chat-id" dir="ltr" type="text" inputMode="numeric" value={operatorChatId} onChange={(event) => setOperatorChatId(event.target.value)} placeholder="123456789" className="input min-h-12 w-full font-mono text-sm" />
              </div>
              <button type="button" onClick={() => void connect()} disabled={busy !== null || !botToken.trim()} className="spatial-press inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white shadow-[var(--shadow-control)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">
                {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Send className="h-4 w-4" />}
                {busy === 'connect' ? t('connecting') : t('connect')}
              </button>
              <div aria-live="polite" className="min-h-5 text-xs">
                {feedback && <span className={feedback.tone === 'error' ? 'text-red-600' : 'text-emerald-700'}>{feedback.message}</span>}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.4rem] border border-black/[0.065] bg-black/[0.025] p-5">
            <div className="absolute -end-14 -top-14 h-36 w-36 rounded-full bg-sky-200/35 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-[var(--text-secondary)]" /><h3 className="text-sm font-bold text-[var(--text-primary)]">{copy('بعد از اتصال چه دارید؟', 'What you get after connecting')}</h3></div>
              <div className="mt-4 space-y-2">
                {[
                  copy('دکمه‌های شیشه‌ای مدیریتی داخل تلگرام', 'Inline management buttons in Telegram'),
                  copy('صف گفتگوها و گزارش عملکرد ۲۴ ساعته', 'Conversation queue and 24-hour report'),
                  copy('قبول، پیگیری و حل گفتگو با یک لمس', 'One-tap claim, follow-up and resolution'),
                  copy('کنترل زنده webhook و خطاهای اتصال', 'Live webhook and connection diagnostics'),
                  copy('توقف یا فعال‌سازی هشدارها از داخل بات', 'Pause or resume alerts from the bot'),
                ].map((item) => (
                  <div key={item} className="flex min-h-11 items-center gap-2.5 rounded-xl border border-black/[0.055] bg-white/65 px-3 text-[10px] font-semibold text-[var(--text-secondary)]">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {removeOpen && typeof document !== 'undefined' && createPortal(
        <DialogShell
          title={copy('حذف اتصال بات اپراتور', 'Remove operator bot connection')}
          subtitle={copy('Webhook تلگرام غیرفعال و تنظیمات اتصال از فضای کاری حذف می‌شود.', 'The Telegram webhook and workspace connection will be removed.')}
          onClose={() => { if (busy !== 'remove') setRemoveOpen(false) }}
        >
          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 text-xs leading-6 text-red-900">
            <div className="flex items-start gap-2.5"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{copy('پس از حذف، هشدار جدیدی به این بات ارسال نمی‌شود. تاریخچه گفتگوها و ارجاع‌های قبلی حذف نخواهد شد.', 'No new alerts will be sent to this bot. Existing conversations and handoff history will remain.')}</p></div>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" data-dialog-initial-focus onClick={() => setRemoveOpen(false)} disabled={busy === 'remove'} className="spatial-press inline-flex min-h-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-4 text-xs font-bold text-[var(--text-secondary)] disabled:opacity-50">{copy('انصراف', 'Cancel')}</button>
            <button type="button" onClick={() => void remove()} disabled={busy === 'remove'} className="spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white shadow-sm disabled:opacity-50">
              {busy === 'remove' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Trash2 className="h-4 w-4" />}
              {copy('حذف اتصال', 'Remove connection')}
            </button>
          </div>
        </DialogShell>,
        document.body,
      )}
    </section>
  )
}
