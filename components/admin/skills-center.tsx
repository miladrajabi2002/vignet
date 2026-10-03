'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle, BookOpen, CheckCircle2, EyeOff, HeartHandshake, HelpCircle, Loader2,
  Mic, Play, Radar, RotateCcw, Scale, ShieldCheck, ShoppingCart, Sparkles, Wrench,
} from 'lucide-react'
import { Badge, Card, EmptyState, Panel, StatCard, fa, fmtDate } from '@/app/admin/(dash)/ui'
import { SKILL_REGISTRY, skillNameFa, type SkillKey } from '@/lib/skills/registry'

export interface FindingView {
  id: string
  skillKey: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  diagnosis: string
  evidence: Record<string, unknown> | null
  suggestedAction: Record<string, unknown> | null
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'
  occurrences: number
  firstSeenAt: string
  lastSeenAt: string
  resolvedNote: string | null
  agentId: string | null
  agentName: string | null
  workspaceName: string | null
  conversationId: string | null
  contactId: string | null
}

export interface RunView {
  id: string
  mode: 'FREE' | 'DEEP'
  source: string
  status: string
  error: string | null
  createdAt: string
  finishedAt: string | null
  durationMs: number
  agentsScanned: number
  conversationsScanned: number
  findingsCreated: number
  findingsUpdated: number
  findingsResolved: number
  llmRequests: number
}

export interface SkillsStatsView {
  open: number
  high: number
  acknowledged: number
  resolvedWeek: number
  bySkill: Record<string, number>
  platform: {
    conversations: number
    unansweredRate: number | null
    modelErrors: number
    assistantMessages: number
    resolutionRate: number | null
    reviews: number
  }
}

const SKILL_ICONS: Record<SkillKey, React.ComponentType<{ className?: string }>> = {
  'knowledge-gap': HelpCircle,
  'tool-failure': Wrench,
  'post-change': ShieldCheck,
  'before-after': Scale,
  'tone-coach': Mic,
  'knowledge-conflict': BookOpen,
  'preference-guard': HeartHandshake,
  'funnel-guard': ShoppingCart,
}

const SEVERITY_LABEL: Record<string, string> = { HIGH: 'بحرانی', MEDIUM: 'مهم', LOW: 'کم' }
const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'muted'> = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'muted' }
const STATUS_LABEL: Record<string, string> = { OPEN: 'باز', ACKNOWLEDGED: 'در بررسی', RESOLVED: 'رفع‌شده', DISMISSED: 'نادیده' }
const STATUS_TONE: Record<string, 'danger' | 'info' | 'success' | 'muted'> = { OPEN: 'danger', ACKNOWLEDGED: 'info', RESOLVED: 'success', DISMISSED: 'muted' }

function percentFa(rate: number | null): string {
  if (rate === null) return '—'
  return rate.toLocaleString('fa-IR', { style: 'percent', maximumFractionDigits: 1 })
}

/** Humanized rendering of the structured evidence payloads each skill emits. */
function EvidenceDetails({ evidence }: { evidence: Record<string, unknown> }) {
  const nodes: React.ReactNode[] = []
  const samples = Array.isArray(evidence.samples) ? evidence.samples : []
  for (const sample of samples.slice(0, 5)) {
    const row = (sample ?? {}) as Record<string, unknown>
    if (typeof row.text === 'string' && row.text.trim()) {
      nodes.push(
        <li key={`s${nodes.length}`} className="border-s-2 border-[var(--border-default)] ps-3">
          <span className="text-[12px] leading-6 text-[var(--text-secondary)]">«{row.text.slice(0, 180)}»</span>
          {typeof row.at === 'string' ? <span className="ms-2 text-[12px] text-[var(--text-muted)]">{fmtDate(new Date(row.at))}</span> : null}
        </li>,
      )
    }
  }
  if (typeof evidence.claimed === 'number' && typeof evidence.presented === 'number') {
    nodes.push(
      <div key="cmp" className="flex items-center gap-2 text-[12px]">
        <span className="rounded-lg bg-red-50 px-2 py-1 font-semibold text-red-700">وعدهٔ متن: {fa(evidence.claimed)}</span>
        <span className="text-[var(--text-muted)]">در برابر</span>
        <span className="rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">کارت ارسالی: {fa(evidence.presented)}</span>
      </div>,
    )
  }
  if (typeof evidence.count === 'number') {
    nodes.push(<div key="cnt" className="text-[12px] text-[var(--text-muted)]">تعداد موارد ثبت‌شده: {fa(evidence.count)}</div>)
  }
  const violations = Array.isArray(evidence.violations) ? evidence.violations : []
  for (const violation of violations.slice(0, 3)) {
    const row = (violation ?? {}) as Record<string, unknown>
    if (typeof row.detail === 'string') {
      nodes.push(<li key={`v${nodes.length}`} className="text-[12px] leading-6 text-[var(--text-secondary)]">• {row.detail}</li>)
    }
  }
  if (typeof evidence.question === 'string' && evidence.question.trim()) {
    nodes.push(<div key="q" className="text-[12px] leading-6 text-[var(--text-secondary)]">سوال ثبت‌نشده: «{evidence.question.slice(0, 200)}»</div>)
  }
  if (typeof evidence.questionA === 'string' && typeof evidence.questionB === 'string') {
    nodes.push(
      <div key="qa" className="grid gap-2 text-[12px] sm:grid-cols-2">
        <div className="rounded-xl bg-red-50/60 p-3 leading-6 text-[var(--text-secondary)]"><b>مدخل ۱:</b> {evidence.questionA.slice(0, 160)} — {String(evidence.answerA ?? '').slice(0, 160)}</div>
        <div className="rounded-xl bg-red-50/60 p-3 leading-6 text-[var(--text-secondary)]"><b>مدخل ۲:</b> {evidence.questionB.slice(0, 160)} — {String(evidence.answerB ?? '').slice(0, 160)}</div>
      </div>,
    )
  }
  if (typeof evidence.before === 'number' && typeof evidence.after === 'number') {
    nodes.push(
      <div key="ba" className="flex items-center gap-2 text-[12px]">
        <span className="rounded-lg bg-[var(--bg-muted)] px-2 py-1 text-[var(--text-secondary)]">قبل: {percentFa(evidence.before)}</span>
        <span className="rounded-lg bg-[var(--signal-tint)] px-2 py-1 font-medium text-[var(--signal-strong)]">بعد: {percentFa(evidence.after)}</span>
      </div>,
    )
  }
  const messageIds = Array.isArray(evidence.messageIds) ? evidence.messageIds : []
  if (messageIds.length && !nodes.length) {
    nodes.push(<div key="ids" className="text-[12px] text-[var(--text-muted)]">{fa(messageIds.length)} پیام شاهد در گفتگو ثبت شده است.</div>)
  }
  if (!nodes.length) return null
  return <div className="mt-3 space-y-2 rounded-control bg-white p-3">{nodes}</div>
}

function SuggestedActionBox({ action }: { action: Record<string, unknown> }) {
  if (action.type === 'none') return null
  const description = typeof action.description === 'string' ? action.description : ''
  if (!description) return null
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <div className="min-w-0 text-[12px] leading-6 text-emerald-800">
        <b>اقدام پیشنهادی:</b> {description}
        {typeof action.path === 'string' ? <span className="ms-1 text-emerald-600/80">({action.path}{typeof action.value === 'string' ? ` = ${action.value}` : ''})</span> : null}
      </div>
    </div>
  )
}

function FindingCard({ finding, onStatus }: { finding: FindingView; onStatus: (id: string, status: FindingView['status']) => void }) {
  const Icon = SKILL_ICONS[finding.skillKey as SkillKey] ?? Radar
  const closed = finding.status === 'RESOLVED' || finding.status === 'DISMISSED'
  return (
    <Card className={closed ? 'opacity-75' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-white text-[var(--text-secondary)]"><Icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold leading-6 text-[var(--text-primary)]">{finding.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--text-muted)]">
              <span>{skillNameFa(finding.skillKey)}</span>
              {finding.agentName ? <span>· ایجنت «{finding.agentName}»</span> : null}
              {finding.workspaceName ? <span>· {finding.workspaceName}</span> : null}
              <span>· {finding.occurrences > 1 ? `${fa(finding.occurrences)} بار دیده‌شده` : 'یک بار'}</span>
              <span>· آخرین بار {fmtDate(new Date(finding.lastSeenAt))}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={SEVERITY_TONE[finding.severity]}>{SEVERITY_LABEL[finding.severity]}</Badge>
          <Badge tone={STATUS_TONE[finding.status]}>{STATUS_LABEL[finding.status]}</Badge>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line text-[12.5px] leading-7 text-[var(--text-secondary)]">{finding.diagnosis}</p>
      {finding.evidence ? <EvidenceDetails evidence={finding.evidence} /> : null}
      {finding.suggestedAction ? <SuggestedActionBox action={finding.suggestedAction} /> : null}
      {finding.resolvedNote && closed ? (
        <p className="mt-3 rounded-control bg-white p-2.5 text-[12px] leading-5 text-[var(--text-muted)]">✓ {finding.resolvedNote}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {finding.conversationId ? (
          <Link href={`/admin/conversations/${finding.conversationId}`} className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-black">مشاهدهٔ گفتگو</Link>
        ) : null}
        {finding.agentId ? (
          <Link href={`/admin/agents/${finding.agentId}`} className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-black">ایجنت</Link>
        ) : null}
        <span className="flex-1" />
        {finding.status === 'OPEN' ? (
          <button type="button" onClick={() => onStatus(finding.id, 'ACKNOWLEDGED')} className="rounded-lg bg-[var(--bg-muted)] px-3 py-1.5 text-[12px] font-bold text-[var(--text-secondary)] transition-colors hover:bg-black/10">در بررسی</button>
        ) : null}
        {!closed ? (
          <>
            <button type="button" onClick={() => onStatus(finding.id, 'RESOLVED')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />رفع شد</button>
            <button type="button" onClick={() => onStatus(finding.id, 'DISMISSED')} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"><EyeOff className="h-3.5 w-3.5" />نادیده</button>
          </>
        ) : (
          <button type="button" onClick={() => onStatus(finding.id, 'OPEN')} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-black"><RotateCcw className="h-3.5 w-3.5" />بازگشانی</button>
        )}
      </div>
    </Card>
  )
}

export function SkillsCenter({ findings, runs, stats }: { findings: FindingView[]; runs: RunView[]; stats: SkillsStatsView }) {
  const router = useRouter()
  const [localFindings, setLocalFindings] = useState(findings)
  const [busyMode, setBusyMode] = useState<'FREE' | 'DEEP' | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [skillFilter, setSkillFilter] = useState<'ALL' | SkillKey>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'RESOLVED' | 'ALL'>('ACTIVE')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => setLocalFindings(findings), [findings])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const startRun = useCallback(async (mode: 'FREE' | 'DEEP') => {
    if (busyMode) return
    setBusyMode(mode)
    setRunError(null)
    try {
      const response = await fetch('/api/admin/skills/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? 'FAILED')
      }
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const poll = await fetch('/api/admin/skills', { cache: 'no-store' })
          if (!poll.ok) return
          const data = (await poll.json()) as { activeRun: { id: string } | null }
          if (!data.activeRun) {
            if (pollRef.current) clearInterval(pollRef.current)
            pollRef.current = null
            setBusyMode(null)
            router.refresh()
          }
        } catch { /* transient polling errors are fine */ }
      }, 4000)
    } catch (error) {
      const code = error instanceof Error ? error.message : 'FAILED'
      setRunError(code === 'RUN_ACTIVE' ? 'یک اجرا در جریان است؛ چند لحظه صبر کنید.' : 'اجرا ناموفق بود.')
      setBusyMode(null)
    }
  }, [busyMode, router])

  const updateStatus = useCallback(async (id: string, status: FindingView['status']) => {
    setLocalFindings((current) => current.map((f) => (f.id === id ? { ...f, status } : f)))
    try {
      await fetch('/api/admin/skills', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
    } catch {
      router.refresh() // fall back to server truth
    }
  }, [router])

  const visible = useMemo(() => {
    return localFindings.filter((f) => {
      if (skillFilter !== 'ALL' && f.skillKey !== skillFilter) return false
      if (statusFilter === 'ACTIVE' && (f.status === 'RESOLVED' || f.status === 'DISMISSED')) return false
      if (statusFilter === 'RESOLVED' && f.status !== 'RESOLVED' && f.status !== 'DISMISSED') return false
      return true
    })
  }, [localFindings, skillFilter, statusFilter])

  const activeCount = stats.open + stats.acknowledged

  return (
    <div className="space-y-6">
      {busyMode ? (
        <div role="status" className="flex items-center gap-3 rounded-control border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-medium text-amber-900">
          <Loader2 className="h-4 w-4 animate-spin" />
          اسکیل‌ها در حال اجرای {busyMode === 'DEEP' ? 'تحلیل عمیق' : 'رایگان'} هستند — این صفحه خودش تازه می‌شود.
        </div>
      ) : null}
      {runError ? (
        <div role="alert" className="flex items-center gap-2 rounded-control border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-[var(--danger-ink)]">
          <AlertTriangle className="h-4 w-4" />{runError}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 min-[1380px]:grid-cols-4">
        <StatCard label="یافته‌های باز" value={fa(stats.open)} sub={`${fa(activeCount)} مورد در صف رسیدگی`} tone={stats.open > 0 ? 'warning' : 'success'} icon={<Radar className="h-4 w-4" />} />
        <StatCard label="بحرانی (HIGH)" value={fa(stats.high)} sub="نیازمند رسیدگی فوری" tone={stats.high > 0 ? 'danger' : 'default'} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="رفع‌شده در ۷ روز" value={fa(stats.resolvedWeek)} sub="حل‌شده توسط شما یا خودکار" tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard
          label="سلامت گفتگوهای ۷ روز"
          value={percentFa(stats.platform.resolutionRate)}
          sub={`${fa(stats.platform.conversations)} گفتگو · بی‌پاسخی ${percentFa(stats.platform.unansweredRate)} · ${fa(stats.platform.modelErrors)} خطای مدل`}
          tone="info"
          icon={<Scale className="h-4 w-4" />}
        />
      </div>

      <Panel
        title="اسکیل‌ها"
        subtitle="۵ اسکیل رایگان هر ۶ ساعت خودکار اجرا می‌شوند؛ ۲ اسکیل عمیق فقط با دستور شما و از بودجهٔ AI پلتفرم"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => startRun('FREE')}
              disabled={busyMode !== null}
              className="admin-primary-button min-h-10 px-3.5 text-[12px]"
            >
              {busyMode === 'FREE' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              اجرای اسکیل‌های رایگان
            </button>
            <button
              type="button"
              onClick={() => startRun('DEEP')}
              disabled={busyMode !== null}
              className="admin-toolbar-button disabled:opacity-50"
              title="هزینه از بودجهٔ AI پلتفرم — نه کیف پول کاربران"
            >
              {busyMode === 'DEEP' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              تحلیل عمیق (لحن + تناقض دانش)
            </button>
          </div>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SKILL_REGISTRY.map((skill) => {
            const Icon = SKILL_ICONS[skill.key]
            const openCount = stats.bySkill[skill.key] ?? 0
            return (
              <button
                key={skill.key}
                type="button"
                onClick={() => setSkillFilter((current) => (current === skill.key ? 'ALL' : skill.key))}
                className={`admin-card spatial-surface rounded-card border p-4 text-start transition-[border-color] duration-200 hover:!border-[var(--border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${skillFilter === skill.key ? '!border-[var(--signal)] !bg-[var(--signal-soft)]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#111] text-white"><Icon className="h-4 w-4" /></span>
                  <Badge tone={skill.cost === 'FREE' ? 'success' : 'warning'}>{skill.cost === 'FREE' ? 'رایگان' : 'عمیق (هزینه AI)'}</Badge>
                </div>
                <h3 className="mt-3 text-[13px] font-bold text-[var(--text-primary)]">{skill.nameFa}</h3>
                <p className="mt-1.5 text-[12px] leading-5 text-[var(--text-muted)]">{skill.descFa}</p>
                <p className="mt-3 text-[12px] font-semibold text-[var(--text-muted)]">
                  {openCount > 0 ? `${fa(openCount)} یافتهٔ باز — کلیک برای فیلتر` : 'یافتهٔ بازی ندارد'}
                </p>
              </button>
            )
          })}
        </div>
      </Panel>

      <Panel
        title="یافته‌ها"
        subtitle={`${fa(visible.length)} مورد نمایش داده می‌شود`}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {skillFilter !== 'ALL' ? (
              <button type="button" onClick={() => setSkillFilter('ALL')} className="ui-chip ui-chip-signal min-h-9">حذف فیلتر اسکیل</button>
            ) : null}
            <div role="tablist" aria-label="وضعیت یافته‌ها" className="ui-seg inline-grid grid-flow-col text-[12px]">
              {(['ACTIVE', 'RESOLVED', 'ALL'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                  className="ui-seg-tab min-h-9 whitespace-nowrap px-3"
                >
                  {value === 'ACTIVE' ? 'در رسیدگی' : value === 'RESOLVED' ? 'بسته‌شده' : 'همه'}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {visible.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map((finding) => <FindingCard key={finding.id} finding={finding} onStatus={updateStatus} />)}
          </div>
        ) : (
          <EmptyState icon={<Radar className="h-8 w-8" />}>
            یافته‌ای در این نمایش نیست — سیستم سالم است یا هنوز اجرا نشده‌اید.
          </EmptyState>
        )}
      </Panel>

      <Panel title="تاریخچهٔ اجرا" subtitle="اجرای خودکار هر ۶ ساعت + اجراهای دستی شما">
        {runs.length ? (
          <div className="space-y-2">
            {runs.map((run) => (
              <div key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-[var(--bg-surface)] px-3.5 py-2.5 text-[12px] text-[var(--text-secondary)]">
                <Badge tone={run.status === 'DONE' ? 'success' : run.status === 'ERROR' ? 'danger' : 'info'}>
                  {run.status === 'DONE' ? 'کامل' : run.status === 'ERROR' ? `خطا${run.error ? ` (${run.error})` : ''}` : 'در جریان'}
                </Badge>
                <span className="font-bold text-[var(--text-primary)]">{run.mode === 'DEEP' ? 'تحلیل عمیق' : 'رایگان'}</span>
                <span>{run.source === 'scheduled' ? 'خودکار' : 'دستی'}</span>
                <span>{fmtDate(new Date(run.createdAt))}</span>
                <span>· {fa(run.agentsScanned)} ایجنت، {fa(run.conversationsScanned)} گفتگو</span>
                {run.findingsCreated ? <span className="text-emerald-700">· {fa(run.findingsCreated)} یافتهٔ جدید</span> : null}
                {run.findingsResolved ? <span className="text-emerald-700">· {fa(run.findingsResolved)} بسته‌شده</span> : null}
                {run.llmRequests ? <span className="text-amber-700">· {fa(run.llmRequests)} درخواست AI</span> : null}
                {run.durationMs ? <span className="text-[var(--text-muted)]">· {fa(Math.round(run.durationMs / 1000))} ثانیه</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState>هنوز اجرایی ثبت نشده است.</EmptyState>
        )}
      </Panel>
    </div>
  )
}
