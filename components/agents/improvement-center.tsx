'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import type { ChannelType, ConvStatus } from '@prisma/client'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Filter,
  History,
  Loader2,
  MessageSquare,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react'
import { behaviorValues, draftSchema, type Draft, type ReviewResult, type Selection } from '@/lib/improvement/types'
import { useLearningCount } from '@/components/agents/learning-count'
import { ChannelBadge } from '@/components/crm/channel-badge'
import { ContactAvatar } from '@/components/crm/contact-avatar'
import { ConversationStatusBadge } from '@/components/crm/conversation-status-badge'
import { Button } from '@/components/ui/button'
import { ConversationCardSkeleton, HistoryCardSkeleton, ReviewCardSkeleton, SuggestionCardSkeleton, Skeleton } from '@/components/ui/skeleton'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
import { Switch } from '@/components/ui/switch'
import { LocalizedDatePicker } from '@/components/ui/localized-date-picker'
import { IMPROVEMENT_ACTIVITY_EVENT } from '@/components/dashboard/improvement-activity-indicator'
import { dateKeyBoundaryISOString, dateKeyInTimeZone, formatLocalizedDateTime } from '@/lib/localized-date'
import { cn } from '@/lib/utils'

const secondary = 'spatial-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60'
const field = 'min-h-12 w-full min-w-0 rounded-xl border border-[var(--border-default)] bg-white px-3 py-2 text-base text-[var(--text-primary)] shadow-[var(--shadow-xs)] outline-none placeholder:text-[var(--text-hint)] focus:border-[var(--border-hover)] focus:ring-2 focus:ring-black/20 sm:text-sm'
const surface = 'spatial-surface rounded-[1.35rem] p-4 sm:p-5'
const inset = 'spatial-inset rounded-2xl'
type Preview = { baseline: string; proposed: string; historical?: string | null; question: string; testedAt: string; version: number; source?: 'manual' | 'automatic'; requestCount?: number; chargedIRR?: number; assessment?: { improved: boolean; reason: string } }
type Change = { id: string; kind: string; targetId: string | null; createdAt: string; revertedAt: string | null; before: Record<string, unknown>; after: Record<string, unknown> }
type Evidence = { messageId: string; message: { role: string; content: string }; review: { conversationId: string; runId: string; run: { createdAt: string } } }
type Suggestion = { conversationCount: number; monitoring?: { reviewed: number; recurring: number } | null; id: string; title: string; kind: string; diagnosis: string; priority: string; status: string; draft: Draft; version: number; preview: Preview | null; evidence: Evidence[]; changes: Change[]; knowledgeStatus?: string | null; topicKey: string }
type Run = { id: string; status: string; total: number; createdAt: string; error: string | null; source?: 'manual' | 'automatic'; chargedIRR: number; requestCount: number; reviews: { id: string; status: string }[] }
type Settings = { daily: boolean; count: number; autoBehavior: boolean; allowedPaths: ('format.length' | 'conversation.avoidRepeatedGreetings')[] }
type Pricing = { modelAlias: string; modelNameFa: string; modelNameEn: string; requestPriceIRR: number; previewRequestCount: number }
type Overview = { runTotal: number; activeRun: Run | null; suggestionTotal: number; runs: Run[]; suggestions: Suggestion[]; pendingCount: number; settings: Settings; pricing: Pricing; creditBalanceIRR: number }
type Conversation = { id: string; channel: string; status: string; messageCount: number; lastMessageAt: string | null; contactId: string | null; contact: { name: string | null; phone: string | null } | null; messages: { content: string }[] }
type Review = { id: string; conversationId: string; status: string; result: ReviewResult | null; conversation: { channel: string; contact: { name: string | null } | null } }
type Action = (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>
const initialSelection: Selection = { mode: 'latest', includeReviewed: false, count: 100, ids: [], search: '', attention: 'all' }
const errors: Record<string, [string, string]> = {
  RUN_ACTIVE: ['یک تحلیل در حال اجراست؛ تا پایان آن صبر کنید.', 'An analysis is already running.'],
  NO_CONVERSATIONS: ['گفتگویی با این انتخاب پیدا نشد.', 'No matching conversations.'],
  SELECTION_CHANGED: ['بعضی گفتگوها دیگر با انتخاب شما منطبق نیستند؛ انتخاب را تازه کنید.', 'The selection changed. Please select again.'],
  QUEUE_UNAVAILABLE: ['شروع تحلیل ممکن نشد؛ دوباره تلاش کنید.', 'Could not queue analysis. Please retry.'],
  AI_UNAVAILABLE: ['سرویس تحلیل فعلاً در دسترس نیست.', 'Analysis service is unavailable.'],
  NO_CREDIT: ['اعتبار پاسخ برای این درخواست کافی نیست؛ ابتدا کیف پول را شارژ کنید.', 'There is not enough reply credit for this request.'],
  MISSING_INFORMATION: ['ابتدا پاسخ و اطلاعات ناقص را تکمیل کنید.', 'Complete the missing information first.'],
  TEST_REQUIRED: ['ابتدا پاسخ را با آخرین نسخهٔ تنظیمات تست کنید.', 'Test the latest settings before applying.'],
  KNOWLEDGE_CHANGED: ['دانش از زمان بررسی تغییر کرده؛ دوباره تحلیل یا تست کنید.', 'Knowledge has changed. Review or test again.'],
  BEHAVIOR_CHANGED: ['این تنظیم قبلاً تغییر کرده؛ برای پیشنهاد تازه دوباره تحلیل کنید.', 'This setting has changed. Run a fresh analysis.'],
  STALE_SUGGESTION: ['این پیشنهاد قدیمی و ناسازگار بود؛ خودکار کنار گذاشته شد و دیگر نمایش داده نمی‌شود.', 'This suggestion was outdated and has been removed automatically.'],
  INGESTION_UNAVAILABLE: ['تغییر ذخیره شد، اما آماده‌سازی دانش نیاز به تلاش مجدد دارد.', 'Saved, but knowledge preparation needs a retry.'],
  INVALID_CONTENT: ['این متن برای دانش عمومی مناسب نیست یا هنوز جای خالی دارد.', 'The draft contains incomplete or non-reusable information.'],
  CONFLICT: ['نسخهٔ این مورد تغییر کرده؛ اطلاعات تازه شد.', 'This item changed. The latest version has been loaded.'],
  RATE_LIMIT: ['درخواست‌ها زیاد شده؛ کمی بعد دوباره تلاش کنید.', 'Too many requests. Please try again shortly.'],
  EVIDENCE_REQUIRED: ['گفتگوی مرجع حذف شده و این پیشنهاد قابل اعمال نیست.', 'The source conversation was removed.'],
}
const statusLabels: Record<string, [string, string]> = { PENDING: ['در انتظار', 'Pending'], PROCESSING: ['در حال بررسی', 'Reviewing'], QUEUED: ['در صف', 'Queued'], RUNNING: ['در حال تحلیل', 'Running'], DONE: ['تکمیل شد', 'Completed'], ERROR: ['نیاز به تلاش مجدد', 'Retry needed'], PARTIAL: ['بخشی نیاز به تلاش مجدد دارد', 'Partially completed'], CANCELLED: ['متوقف شد', 'Stopped'], APPLIED: ['اعمال شد', 'Applied'], DISMISSED: ['کنار گذاشته شد', 'Dismissed'], REVERTED: ['بازگردانده شد', 'Reverted'], READY: ['دانش آماده است', 'Knowledge ready'], RESOLVED: ['حل‌شده', 'Resolved'], UNRESOLVED: ['حل‌نشده', 'Unresolved'], UNKNOWN: ['نتیجه نامشخص', 'Unknown outcome'] }
const behaviorLabels: Record<string, [string, string]> = {
  doSay: ['دستور روند گفتگو', 'Conversation flow instruction'],
  'format.length': ['طول پاسخ', 'Reply length'], 'conversation.formality': ['رسمیت لحن', 'Formality'], 'conversation.followUp': ['سؤال پیگیری', 'Follow-up questions'],
  'conversation.empathy': ['همدلی', 'Empathy'], 'conversation.initiative': ['پیشنهاد گام بعد', 'Initiative'], 'conversation.avoidRepeatedGreetings': ['جلوگیری از سلام تکراری', 'Avoid repeated greetings'], 'conversation.mirrorCustomerTone': ['هماهنگی با لحن مشتری', 'Mirror customer tone'],
  short: ['کوتاه', 'Short'], medium: ['متوسط', 'Medium'], long: ['بلند', 'Long'], formal: ['رسمی', 'Formal'], balanced: ['متعادل', 'Balanced'], casual: ['خودمانی', 'Casual'], rare: ['به‌ندرت', 'Rare'], when_needed: ['فقط در صورت نیاز', 'When needed'], often: ['بیشتر', 'Often'], neutral: ['خنثی', 'Neutral'], warm: ['گرم', 'Warm'], answer_only: ['فقط پاسخ', 'Answer only'], guided: ['راهنمایی مرتبط', 'Guided'], proactive: ['پیشنهاد فعال', 'Proactive'], true: ['فعال', 'Enabled'], false: ['غیرفعال', 'Disabled'],
}

function DetailDialog({
  title,
  description,
  onClose,
  children,
  footer,
  triggerRef,
  wide = false,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  triggerRef?: { current: HTMLElement | null }
  wide?: boolean
}) {
  const [open, setOpen] = useState(true)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closing = useRef(false)
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])
  function closeWithMotion() {
    if (closing.current) return
    closing.current = true
    setOpen(false)
    closeTimer.current = setTimeout(onClose, 240)
  }
  return (
    <MobileBottomSheet
      open={open}
      title={title}
      description={description}
      closeLabel="Close / بستن"
      onClose={closeWithMotion}
      footer={footer}
      triggerRef={triggerRef}
      mobileOnly={false}
      motionPreset="detail"
      size="large"
      panelClassName={cn('max-md:h-dvh max-md:rounded-none max-md:border-0', wide ? 'md:max-w-4xl' : 'md:max-w-3xl')}
      contentClassName="space-y-5 bg-[var(--bg-base)]/70 sm:px-5 sm:py-5"
    >
      {children}
    </MobileBottomSheet>
  )
}

export function ImprovementCenter({ agentId }: { agentId: string }) {
  const fa = useLocale() !== 'en'
  const t = (f: string, e: string) => fa ? f : e
  const label = (value: string) => statusLabels[value]?.[fa ? 0 : 1] ?? value
  const number = (v: number) => v.toLocaleString(fa ? 'fa-IR' : 'en-US')
  const date = (v: string) => formatLocalizedDateTime(v, fa ? 'fa' : 'en')
  const base = `/api/agents/${agentId}/improvement`
  const [data, setData] = useState<Overview | null>(null)
  const [tab, setTab] = useState<'suggestions' | 'conversations' | 'history'>('suggestions')
  const [suggestionPage, setSuggestionPage] = useState(1)
  const [runPage, setRunPage] = useState(1)
  const historyView = tab === 'history'
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const [selectOpen, setSelectOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const analysisTriggerRef = useRef<HTMLButtonElement>(null)
  const automationTriggerRef = useRef<HTMLButtonElement>(null)
  const filtersTriggerRef = useRef<HTMLButtonElement>(null)
  const suggestionTriggerRef = useRef<HTMLButtonElement>(null)
  const resultsTriggerRef = useRef<HTMLButtonElement>(null)
  const [selection, setSelection] = useState<Selection>(initialSelection)
  const [estimate, setEstimate] = useState<{ count: number; estimatedCreditIRR: number; requestCount: number; requestPriceIRR: number; modelNameFa: string; modelNameEn: string } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([]), [total, setTotal] = useState(0), [page, setPage] = useState(1), [searching, setSearching] = useState(false)
  const [runId, setRunId] = useState<string | null>(null), [reviews, setReviews] = useState<Review[]>([]), [reviewPage, setReviewPage] = useState(1), [reviewTotal, setReviewTotal] = useState(0)
  const setCount = useLearningCount()?.setCount
  const refresh = useCallback(async () => {
    const response = await fetch(`${base}?suggestionPage=${suggestionPage}&history=${historyView ? '1' : '0'}&runPage=${runPage}`, { cache: 'no-store' })
    if (!response.ok) throw new Error('FAILED')
    const fresh: Overview = await response.json()
    setData(fresh); setCount?.(fresh.pendingCount)
  }, [base, setCount, suggestionPage, historyView, runPage])
  useEffect(() => {
    let mounted = true
    const update = () => refresh().catch(() => { if (mounted) setError(fa ? 'دریافت اطلاعات ممکن نشد؛ دوباره تلاش کنید.' : 'Could not load data. Please retry.') })
    void update()
    const timer = setInterval(() => { if (!document.hidden) void update() }, 7000)
    return () => { mounted = false; clearInterval(timer) }
  }, [refresh, fa])
  useEffect(() => { setEstimate(null) }, [selection])
  useEffect(() => { setSuggestionPage(1) }, [historyView])
  useEffect(() => {
    if (!(selectOpen || tab === 'conversations')) return
    const abort = new AbortController()
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: String(page), search: selection.search, attention: selection.attention })
        params.set('includeReviewed', String(selection.includeReviewed))
        for (const key of ['channel', 'from', 'to', 'contactId'] as const) if (selection[key]) params.set(key, selection[key]!)
        const r = await fetch(`${base}/conversations?${params}`, { signal: abort.signal })
        if (!r.ok) throw new Error('FAILED')
        const response = await r.json(); setConversations(response.conversations); setTotal(response.total)
      } catch { if (!abort.signal.aborted) setError(fa ? 'جستجو انجام نشد.' : 'Search failed.') }
      finally { if (!abort.signal.aborted) setSearching(false) }
    }, 300)
    return () => { abort.abort(); clearTimeout(timer) }
  }, [selection, page, selectOpen, tab, base, fa])
  useEffect(() => {
    if (!runId) return
    const abort = new AbortController()
    void fetch(`${base}?runId=${runId}&page=${reviewPage}`, { signal: abort.signal }).then(async (r) => {
      if (!r.ok) throw new Error('FAILED')
      const d = await r.json(); setReviews(d.reviews); setReviewTotal(d.total)
    }).catch(() => { if (!abort.signal.aborted) setError(fa ? 'نتیجه‌ها دریافت نشد.' : 'Could not load reviews.') })
    return () => abort.abort()
  }, [base, runId, reviewPage, data, fa])

  const act: Action = async (body) => {
    if (busyRef.current) return null
    busyRef.current = true; setBusy(String(body.action)); setError(''); setNotice('')
    try {
      const r = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const result = await r.json()
      if (!r.ok) throw new Error(result.error || 'FAILED')
      if (body.action !== 'estimate') {
        await refresh()
        if (['start', 'retry', 'cancel'].includes(String(body.action))) window.dispatchEvent(new Event(IMPROVEMENT_ACTIVITY_EVENT))
        setNotice(t('انجام شد.', 'Done.'))
      }
      return result
    } catch (e) {
      const code = e instanceof Error ? e.message : 'FAILED'
      setError(errors[code]?.[fa ? 0 : 1] ?? t('انجام نشد؛ دوباره تلاش کنید.', 'Could not complete. Please retry.'))
      await refresh().catch(() => {})
      return null
    } finally { busyRef.current = false; setBusy('') }
  }
  function updateSelection(patch: Partial<Selection>) { setSelection((s) => ({ ...s, ...patch })); setPage(1) }
  function toggle(id: string) { setSelection((s) => ({ ...s, mode: 'selected', ids: s.ids.includes(id) ? s.ids.filter((v) => v !== id) : [...s.ids, id].slice(0, 500) })) }
  const activeRun = data?.activeRun
  const pending = (data?.suggestions ?? []).filter((s) => s.status === 'PENDING').sort((a, b) => ['HIGH', 'MEDIUM', 'LOW'].indexOf(a.priority) - ['HIGH', 'MEDIUM', 'LOW'].indexOf(b.priority))
  const selected = data?.suggestions.find((s) => s.id === selectedId)
  const activeFilterCount = [
    selection.channel,
    selection.attention !== 'all' ? selection.attention : undefined,
    selection.from,
    selection.to,
    selection.contactId,
  ].filter(Boolean).length
  const attentionLabel = selection.attention === 'unanswered'
    ? t('بی‌پاسخ', 'Unanswered')
    : selection.attention === 'handoff'
      ? t('ارجاع‌شده', 'Handed off')
      : selection.attention === 'low_rating'
        ? t('امتیاز پایین', 'Low rating')
        : ''
  const filters = (
    <div className={`${surface} space-y-3 p-3 sm:p-4`}>
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t('جستجوی گفتگو', 'Search conversations')}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input
            className={`${field} ps-10`}
            value={selection.search}
            onChange={(event) => updateSelection({ search: event.target.value })}
            placeholder={t('جستجو در پیام، نام یا شماره…', 'Search messages, names or phone…')}
          />
        </label>
        <Button
          variant="secondary"
          className="relative shrink-0 px-3 sm:px-4"
          aria-haspopup="dialog"
          aria-expanded={filtersOpen}
          onClick={(event) => {
            filtersTriggerRef.current = event.currentTarget
            setFiltersOpen(true)
          }}
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('فیلترها', 'Filters')}</span>
          {activeFilterCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold text-white">
              {number(activeFilterCount)}
            </span>
          )}
        </Button>
      </div>
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2" aria-label={t('فیلترهای فعال', 'Active filters')}>
          {selection.channel && <FilterChip label={selection.channel} onRemove={() => updateSelection({ channel: undefined })} fa={fa} />}
          {attentionLabel && <FilterChip label={attentionLabel} onRemove={() => updateSelection({ attention: 'all' })} fa={fa} />}
          {(selection.from || selection.to) && <FilterChip label={t('بازهٔ زمانی', 'Date range')} onRemove={() => updateSelection({ from: undefined, to: undefined })} fa={fa} />}
          {selection.contactId && <FilterChip label={t('یک مشتری', 'One customer')} onRemove={() => updateSelection({ contactId: undefined })} fa={fa} />}
        </div>
      )}
    </div>
  )
  const conversationList = (
    <div className="space-y-3" aria-busy={searching}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {searching ? t('در حال جستجو…', 'Searching…') : t(`${number(total)} گفتگو`, `${number(total)} conversations`)}
          </p>
          {!!selection.ids.length && <p className="mt-0.5 text-xs text-[var(--text-muted)]">{number(selection.ids.length)} {t('گفتگو انتخاب شده', 'conversations selected')}</p>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={searching || !conversations.length}
          onClick={() => setSelection((current) => ({
            ...current,
            mode: 'selected',
            ids: [...new Set([...current.ids, ...conversations.map((conversation) => conversation.id)])].slice(0, 500),
          }))}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {t('انتخاب این صفحه', 'Select this page')}
        </Button>
      </div>
      {searching && (
        <div className="space-y-3" role="status">
          <span className="sr-only">{t('گفتگوها در حال دریافت‌اند…', 'Loading conversations…')}</span>
          {Array.from({ length: 4 }).map((_, index) => (
            <ConversationCardSkeleton key={`conversation-skeleton-${index}`} delay={index * -130} />
          ))}
        </div>
      )}
      {!searching && !conversations.length && (
        <div className={`${surface} py-9 text-center`}>
          <MessageSquare className="mx-auto h-6 w-6 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold">{t('گفتگویی پیدا نشد', 'No conversations found')}</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-[var(--text-muted)]">{t('عبارت جستجو یا فیلترها را تغییر دهید.', 'Change the search term or filters.')}</p>
        </div>
      )}
      {!searching && conversations.map((conversation) => {
        const who = conversation.contact?.name || conversation.contact?.phone || t('مشتری بدون نام', 'Unnamed customer')
        const checked = selection.ids.includes(conversation.id)
        const status = conversation.status as ConvStatus
        const statusText = status === 'OPEN'
          ? t('باز', 'Open')
          : status === 'HANDED_OFF'
            ? t('ارجاع‌شده', 'Handed off')
            : t('حل‌شده', 'Resolved')
        return (
          <article
            key={conversation.id}
            className={cn(
              'spatial-surface overflow-hidden rounded-[1.35rem] transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none',
              checked && 'border-black/25 shadow-[0_12px_32px_rgba(17,17,17,0.09)]',
            )}
          >
            <div className="flex min-w-0 items-start gap-3 p-3.5 sm:p-4">
              <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl hover:bg-[var(--bg-hover)]">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded accent-black"
                  checked={checked}
                  onChange={() => toggle(conversation.id)}
                  aria-label={t('انتخاب گفتگو با ', 'Select conversation with ') + who}
                />
              </label>
              <ContactAvatar alt={who} size="md" className="bg-[var(--bg-surface)]" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p dir="auto" className="truncate text-sm font-bold text-[var(--text-primary)]">{who}</p>
                  <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                    {conversation.lastMessageAt ? date(conversation.lastMessageAt) : t('بدون پیام', 'No messages')}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <ConversationStatusBadge status={status} label={statusText} attention={status === 'HANDED_OFF'} />
                  <ChannelBadge type={conversation.channel as ChannelType} />
                  <span className="text-[11px] text-[var(--text-muted)]">{number(conversation.messageCount)} {t('پیام', 'messages')}</span>
                </div>
                <p dir="auto" className="mt-2 line-clamp-2 break-words text-sm leading-6 text-[var(--text-secondary)]">
                  {conversation.messages[0]?.content || t('پیش‌نمایش پیام در دسترس نیست.', 'No message preview available.')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-t border-[var(--border-subtle)] px-3 py-2">
              <Link className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60" href={`/conversations/${conversation.id}`} target="_blank">
                {t('مشاهده گفتگو', 'Open conversation')}
                <ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" aria-hidden="true" />
              </Link>
              {conversation.contactId && (
                <button type="button" className="min-h-10 rounded-xl px-3 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60" onClick={() => updateSelection({ contactId: conversation.contactId! })}>
                  {t('فقط گفتگوهای این مشتری', 'Only this customer')}
                </button>
              )}
            </div>
          </article>
        )
      })}
      <Pagination page={page} total={total} setPage={setPage} fa={fa} />
    </div>
  )
  const processedCount = activeRun?.reviews.filter((review) => ['DONE', 'ERROR'].includes(review.status)).length ?? 0
  const successfulCount = activeRun?.reviews.filter((review) => review.status === 'DONE').length ?? 0
  const activePercent = Math.min(100, Math.round((processedCount / Math.max(activeRun?.total ?? 1, 1)) * 100))
  const automationEnabled = Boolean(data?.settings.daily || data?.settings.autoBehavior)
  const estimateInsufficient = Boolean(estimate && data && estimate.estimatedCreditIRR > data.creditBalanceIRR)

  return <div className="min-w-0 space-y-4 pb-4">
    <section className="spatial-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.95rem] bg-black text-white shadow-[var(--shadow-control)]">
            <WandSparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-[var(--text-primary)]">{t('تحلیل و بهبود', 'Analyze & improve')}</h2>
              {automationEnabled && <StatusPill tone="success">{t('خودکارسازی فعال', 'Automation on')}</StatusPill>}
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
              {t('گفتگوها را بررسی کنید، مشکل‌های تکراری را پیدا کنید و دانش یا رفتار ایجنت را با شواهد واقعی بهتر کنید.', 'Review conversations, find recurring problems, and improve agent knowledge or behavior using real evidence.')}
            </p>
            {data && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                <span>{number(data.pendingCount)} {t('پیشنهاد آمادهٔ بررسی', 'suggestions ready')}</span>
                <span className="hidden h-1 w-1 rounded-full bg-black/20 sm:block" aria-hidden="true" />
                <span>{number(data.runTotal)} {t('نوبت تحلیل ثبت‌شده', 'analysis runs')}</span>
              </div>
            )}
            {!data && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" aria-hidden="true">
                <Skeleton delay={-100} className="h-3 w-28 rounded-full" />
                <Skeleton delay={-220} className="h-3 w-24 rounded-full" />
                <Skeleton delay={-340} className="h-3 w-48 rounded-full" />
              </div>
            )}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-[1fr_auto] gap-2 sm:flex">
          <Button
            disabled={!!activeRun || !data}
            className="min-w-0 sm:min-w-40"
            onClick={(event) => {
              analysisTriggerRef.current = event.currentTarget
              setError('')
              setEstimate(null)
              setSelection(initialSelection)
              setSelectOpen(true)
            }}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t('تحلیل گفتگوها', 'Analyze conversations')}
          </Button>
          <Button ref={automationTriggerRef} variant="secondary" disabled={!data} onClick={() => { setError(''); setSettingsOpen(true) }}>
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('خودکارسازی', 'Automation')}</span>
            <span className="sm:hidden">{t('خودکار', 'Auto')}</span>
          </Button>
        </div>
      </div>
    </section>
    {error && (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm leading-6 text-red-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">{error}</p>
        <button className="min-h-9 shrink-0 rounded-lg px-2 font-semibold underline underline-offset-4" onClick={() => void refresh().then(() => setError('')).catch(() => {})}>{t('تلاش مجدد', 'Retry')}</button>
      </div>
    )}
    {notice && (
      <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
        <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        {notice}
      </div>
    )}
    {activeRun && (
      <section className={`${surface} space-y-3.5`} aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /></span>
            <div><p className="text-sm font-bold">{label(activeRun.status)} · {activeRun.source === 'automatic' ? t('تحلیل خودکار', 'Automatic analysis') : t('تحلیل دستی', 'Manual analysis')}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{number(successfulCount)} {t('از', 'of')} {number(activeRun.total)} {t('گفتگو بررسی شده', 'conversations reviewed')}</p></div>
          </div>
          <div className="flex items-center gap-3"><span className="text-xl font-black tabular-nums">{number(activePercent)}{fa ? '٪' : '%'}</span><Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void act({ action: 'cancel', id: activeRun.id })}>{t('توقف تحلیل', 'Stop analysis')}</Button></div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/[0.07]" role="progressbar" aria-valuemin={0} aria-valuemax={activeRun.total} aria-valuenow={processedCount}>
          <div className="h-full rounded-full bg-black transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.min(100, (processedCount / Math.max(activeRun.total, 1)) * 100)}%` }} />
        </div>
        <p className="text-xs leading-6 text-[var(--text-muted)]">{t(`تحلیل در پس‌زمینه ادامه دارد؛ تا این لحظه ${number(activeRun.requestCount)} درخواست موفق و ${number(activeRun.chargedIRR / 10)} تومان مصرف ثبت شده است.`, `Analysis continues in the background; ${number(activeRun.requestCount)} successful requests and ${number(activeRun.chargedIRR / 10)} toman have been recorded so far.`)}</p>
      </section>
    )}
    <div role="tablist" aria-label={t('بخش‌های تحلیل', 'Analysis sections')} className="spatial-control grid grid-cols-3 gap-1 rounded-[1.25rem] p-1.5">{([['suggestions', 'پیشنهادها', 'Suggestions', Sparkles], ['conversations', 'گفتگوها', 'Conversations', MessageSquare], ['history', 'سابقه', 'History', History]] as const).map(([key, f, e, Icon], i) => <button role="tab" type="button" id={`analysis-tab-${key}`} aria-controls={`analysis-panel-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} key={key} onClick={() => setTab(key)} onKeyDown={(event) => {
      const keys = ['suggestions', 'conversations', 'history'] as const
      let n = i
      if (event.key === 'Home') n = 0
      else if (event.key === 'End') n = 2
      else if (event.key === 'ArrowLeft') n = (i + (fa ? 1 : 2)) % 3
      else if (event.key === 'ArrowRight') n = (i + (fa ? 2 : 1)) % 3
      else return
      event.preventDefault(); setTab(keys[n]); document.getElementById(`analysis-tab-${keys[n]}`)?.focus()
    }} className={cn(
      'flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-2xl px-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 motion-reduce:transition-none sm:gap-2 sm:text-sm',
      tab === key ? 'bg-black text-white shadow-[var(--shadow-control)]' : 'text-[var(--text-secondary)] hover:bg-black/[0.04]',
    )}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" />{t(f, e)}{key === 'suggestions' && !!data?.pendingCount && <span className={cn('ms-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold', tab === key ? 'bg-white text-black' : 'bg-black text-white')}>{number(data.pendingCount)}</span>}</button>)}</div>
    {!data && (
      <div role="status" className="space-y-3">
        <span className="sr-only">{t('در حال دریافت اطلاعات…', 'Loading…')}</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
          <Skeleton delay={-100} className="h-3 w-28 rounded-full" />
          <span className="hidden h-1 w-1 rounded-full bg-black/15 sm:block" aria-hidden="true" />
          <Skeleton delay={-220} className="h-3 w-24 rounded-full" />
          <span className="hidden h-1 w-1 rounded-full bg-black/15 sm:block" aria-hidden="true" />
          <Skeleton delay={-340} className="h-3 w-44 rounded-full" />
        </div>
        {tab === 'conversations'
          ? Array.from({ length: 4 }).map((_, index) => (
              <ConversationCardSkeleton key={`conversation-loading-${index}`} delay={index * -130} />
            ))
          : tab === 'history'
            ? Array.from({ length: 3 }).map((_, index) => (
                <HistoryCardSkeleton key={`history-loading-${index}`} delay={index * -160} />
              ))
            : Array.from({ length: 3 }).map((_, index) => (
                <SuggestionCardSkeleton key={`suggestion-loading-${index}`} delay={index * -160} />
              ))}
      </div>
    )}
    <section role="tabpanel" id="analysis-panel-suggestions" aria-labelledby="analysis-tab-suggestions" hidden={tab !== 'suggestions'} className="space-y-3">
      {data && pending.length > 0 && (
        <div className="flex items-end justify-between gap-3 px-1 pb-1 pt-1">
          <div><h3 className="text-sm font-bold">{t('پیشنهادهای آمادهٔ بررسی', 'Suggestions ready for review')}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{t('موارد مهم‌تر بالاتر نمایش داده می‌شوند.', 'Higher priority items appear first.')}</p></div>
          <span className="text-xs font-semibold text-[var(--text-muted)]">{number(data.pendingCount)} {t('مورد', 'items')}</span>
        </div>
      )}
      {data && !pending.length && (
        <div className={`${surface} py-11 text-center`}>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-black/[0.04] text-[var(--text-secondary)]"><CircleCheck className="h-6 w-6" aria-hidden="true" /></span>
          <p className="mt-4 font-bold">{t('همه‌چیز بررسی شده است', 'Everything is reviewed')}</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[var(--text-secondary)]">{t('پیشنهادی در انتظار نیست. برای پیدا کردن فرصت‌های تازه، یک تحلیل جدید شروع کنید.', 'Nothing is waiting for review. Start a new analysis to find fresh opportunities.')}</p>
        </div>
      )}
      {pending.map((suggestion) => {
        const isKnowledge = suggestion.kind === 'KNOWLEDGE'
        const isBehavior = suggestion.kind === 'BEHAVIOR'
        return (
          <button
            key={suggestion.id}
            type="button"
            className="spatial-surface spatial-press block w-full overflow-hidden rounded-[1.35rem] p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 sm:p-5"
            onClick={(event) => {
              suggestionTriggerRef.current = event.currentTarget
              setError('')
              setSelectedId(suggestion.id)
            }}
          >
            <div className="flex items-start gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--text-secondary)]">
                {isKnowledge ? <BookOpen className="h-4 w-4" aria-hidden="true" /> : isBehavior ? <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> : <MessageSquare className="h-4 w-4" aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill>{isKnowledge ? t('دانش', 'Knowledge') : isBehavior ? t('رفتار و لحن', 'Behavior') : t('روند و ابزار', 'Flow & tools')}</StatusPill>
                  <StatusPill>{suggestion.draft.scope === 'CUSTOMER' ? t('برای این مشتری', 'This customer') : t('برای همه', 'All customers')}</StatusPill>
                  <StatusPill tone={suggestion.priority === 'HIGH' ? 'warning' : 'neutral'}>{suggestion.priority === 'HIGH' ? t('اولویت بالا', 'High priority') : suggestion.priority === 'MEDIUM' ? t('اولویت متوسط', 'Medium priority') : t('اولویت پایین', 'Low priority')}</StatusPill>
                </div>
                <h3 className="mt-3 text-[15px] font-bold leading-7 text-[var(--text-primary)]">{suggestion.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm leading-7 text-[var(--text-secondary)]">{suggestion.diagnosis}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                  <span className="text-xs text-[var(--text-muted)]">{number(suggestion.conversationCount)} {t('گفتگوی مرتبط', 'related conversations')}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">{suggestion.draft.missing ? t('تکمیل اطلاعات', 'Complete information') : t('بررسی پیشنهاد', 'Review suggestion')}<ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" aria-hidden="true" /></span>
                </div>
              </div>
            </div>
          </button>
        )
      })}
      <Pagination page={suggestionPage} total={data?.suggestionTotal ?? 0} setPage={setSuggestionPage} fa={fa} />
    </section>
    <section role="tabpanel" id="analysis-panel-conversations" aria-labelledby="analysis-tab-conversations" hidden={tab !== 'conversations'} className="space-y-4">
      <div className="flex items-end justify-between gap-3 px-1 pt-1">
        <div><h3 className="text-sm font-bold">{t('انتخاب گفتگو برای تحلیل', 'Choose conversations to analyze')}</h3><p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{t('با جستجو و فیلتر، گفتگوهای مرتبط را پیدا کنید.', 'Use search and filters to find relevant conversations.')}</p></div>
      </div>
      {filters}
      {conversationList}
      <div className="spatial-control sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-2xl p-2.5">
        <p className="hidden ps-2 text-xs text-[var(--text-muted)] sm:block">{selection.ids.length ? t(`${number(selection.ids.length)} گفتگو برای تحلیل انتخاب شده`, `${number(selection.ids.length)} conversations selected`) : t('حداقل یک گفتگو انتخاب کنید', 'Select at least one conversation')}</p>
        <Button
          className="w-full sm:ms-auto sm:w-auto sm:min-w-56"
          disabled={!selection.ids.length || !!activeRun}
          onClick={(event) => {
            analysisTriggerRef.current = event.currentTarget
            setError('')
            setEstimate(null)
            updateSelection({ mode: 'selected' })
            setSelectOpen(true)
          }}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {selection.ids.length ? t(`تحلیل ${number(selection.ids.length)} گفتگو`, `Analyze ${number(selection.ids.length)} conversations`) : t('تحلیل گفتگوهای انتخابی', 'Analyze selected conversations')}
        </Button>
      </div>
    </section>
    <section role="tabpanel" id="analysis-panel-history" aria-labelledby="analysis-tab-history" hidden={tab !== 'history'} className="space-y-4">
      <div className="px-1 pt-1"><h3 className="text-sm font-bold">{t('سابقهٔ تحلیل و تغییرها', 'Analysis and change history')}</h3><p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{t('نتیجهٔ هر نوبت را ببینید یا تغییرهای اعمال‌شده را بازگردانید.', 'Inspect each run or revert applied changes.')}</p></div>
      {data?.runs.map((run) => (
        <article key={run.id} className={`${surface} space-y-3.5`}>
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--text-secondary)]"><Clock3 className="h-4 w-4" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{number(run.reviews.filter((review) => review.status === 'DONE').length)} {t('از', 'of')} {number(run.total)} {t('گفتگو بررسی شد', 'conversations reviewed')}</p><StatusPill tone={run.status === 'DONE' ? 'success' : ['ERROR', 'PARTIAL'].includes(run.status) ? 'warning' : 'neutral'}>{label(run.status)}</StatusPill></div><p className="mt-1 text-xs text-[var(--text-muted)]">{run.source === 'automatic' ? t('تحلیل خودکار', 'Automatic analysis') : t('تحلیل دستی', 'Manual analysis')} · {date(run.createdAt)} · {number(run.requestCount)} {t('درخواست AI', 'AI requests')} · {number(run.chargedIRR / 10)} {t('تومان', 'toman')}</p>{run.error === 'NO_CREDIT' && <p className="mt-1 text-xs font-semibold text-amber-700">{t('به‌دلیل کافی نبودن اعتبار متوقف شد.', 'Stopped because credit was insufficient.')}</p>}</div>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-3">
            <Button variant="secondary" size="sm" onClick={(event) => { resultsTriggerRef.current = event.currentTarget; setRunId(run.id); setReviewPage(1); setReviews([]) }}>{t('نتیجهٔ هر گفتگو', 'Individual results')}</Button>
            {['PARTIAL', 'ERROR'].includes(run.status) && <Button variant="secondary" size="sm" disabled={!!busy || !!activeRun} onClick={() => void act({ action: 'retry', id: run.id })}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t('ادامهٔ موارد ناموفق', 'Retry unfinished reviews')}</Button>}
          </div>
        </article>
      ))}
      <Pagination page={runPage} total={data?.runTotal ?? 0} setPage={setRunPage} fa={fa} />
      {!!data?.suggestions.filter((suggestion) => suggestion.status !== 'PENDING').length && <div className="px-1 pt-2"><h3 className="text-sm font-bold">{t('تغییرهای بررسی‌شده', 'Reviewed changes')}</h3></div>}
      {data?.suggestions.filter((suggestion) => suggestion.status !== 'PENDING').map((suggestion) => <button key={suggestion.id} type="button" className="spatial-surface spatial-press flex w-full items-center gap-3 rounded-[1.35rem] p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60" onClick={(event) => { suggestionTriggerRef.current = event.currentTarget; setSelectedId(suggestion.id) }}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-black/[0.045]"><Check className="h-4 w-4" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="text-xs text-[var(--text-muted)]">{label(suggestion.status)}{suggestion.knowledgeStatus ? ` · ${label(suggestion.knowledgeStatus)}` : ''}</span><span className="mt-1 block truncate text-sm font-semibold">{suggestion.title}</span></span><ChevronLeft className="h-4 w-4 shrink-0 text-[var(--text-hint)] ltr:rotate-180" aria-hidden="true" /></button>)}
      {data && !data.runs.length && <div className={`${surface} py-9 text-center`}><History className="mx-auto h-6 w-6 text-[var(--text-muted)]" aria-hidden="true" /><p className="mt-3 text-sm font-semibold">{t('هنوز تحلیلی ثبت نشده است.', 'No analyses yet.')}</p></div>}
      <Pagination page={suggestionPage} total={data?.suggestionTotal ?? 0} setPage={setSuggestionPage} fa={fa} />
    </section>
    {selectOpen && <DetailDialog
      title={t('انتخاب گفتگوها برای تحلیل', 'Select conversations to analyze')}
      description={t('هر گفتگو به‌صورت جداگانه بررسی می‌شود', 'Every conversation is reviewed separately')}
      triggerRef={analysisTriggerRef}
      wide
      onClose={() => setSelectOpen(false)}
      footer={<div className="space-y-2.5">
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-700">{error}</p>}
        {estimate && <div className={cn('flex items-start gap-2 rounded-xl px-3 py-2.5', estimateInsufficient ? 'bg-amber-50 text-amber-900' : 'bg-black/[0.035]')}><CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div className="min-w-0 text-xs leading-6"><p><strong>{number(estimate.count)} {t('گفتگو', 'conversations')}</strong> · {number(estimate.requestCount)} {t('درخواست AI', 'AI requests')}</p><p>{fa ? estimate.modelNameFa : estimate.modelNameEn} · {number(estimate.requestPriceIRR / 10)} {t('تومان برای هر درخواست موفق', 'toman per successful request')} · <strong>{number(estimate.estimatedCreditIRR / 10)} {t('تومان مجموع برآورد', 'toman estimated total')}</strong></p>{estimateInsufficient && <p className="font-semibold">{t('اعتبار فعلی کافی نیست.', 'Current credit is insufficient.')} <Link className="underline underline-offset-4" href="/billing">{t('افزایش اعتبار', 'Add credit')}</Link></p>}</div></div>}
        <Button
          className="w-full"
          loading={!!busy}
          disabled={!!activeRun || estimateInsufficient || (selection.mode === 'selected' && !selection.ids.length)}
          onClick={async () => {
            if (!estimate) {
              const result = await act({ action: 'estimate', selection })
              if (result) setEstimate(result as { count: number; estimatedCreditIRR: number; requestCount: number; requestPriceIRR: number; modelNameFa: string; modelNameEn: string })
            } else {
              const result = await act({ action: 'start', selection })
              if (result) { setSelectOpen(false); setTab('suggestions') }
            }
          }}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {estimate ? t('شروع تحلیل', 'Start analysis') : t('بررسی انتخاب و مصرف', 'Review selection and usage')}
        </Button>
      </div>}
    >
      <div className={`${inset} p-1.5`} role="radiogroup" aria-label={t('روش انتخاب گفتگو', 'Conversation selection method')}>
        <div className="grid grid-cols-2 gap-1">
          {(['latest', 'selected'] as const).map((mode) => <button type="button" role="radio" aria-checked={selection.mode === mode} className={cn('min-h-12 rounded-xl px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 motion-reduce:transition-none', selection.mode === mode ? 'bg-black text-white shadow-[var(--shadow-control)]' : 'text-[var(--text-secondary)] hover:bg-white/70')} key={mode} onClick={() => updateSelection({ mode })}>{mode === 'latest' ? t('آخرین گفتگوها', 'Latest conversations') : t('انتخاب دستی', 'Manual selection')}</button>)}
        </div>
      </div>
      {selection.mode === 'latest' && (
        <section className={`${surface} space-y-4`}>
          <div><h3 className="text-sm font-bold">{t('چه تعداد بررسی شود؟', 'How many should be reviewed?')}</h3><p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{t('به‌طور پیش‌فرض فقط گفتگوهای جدید یا گفتگوهایی که بعد از آخرین تحلیل پیام تازه دارند انتخاب می‌شوند.', 'By default, only new conversations or conversations updated since their last analysis are selected.')}</p></div>
          <label className="block space-y-2 text-sm"><span className="text-xs font-semibold text-[var(--text-secondary)]">{t('تعداد گفتگو؛ حداکثر ۵۰۰', 'Conversation count; maximum 500')}</span><input type="number" min={1} max={500} className={field} value={selection.count} onChange={(event) => updateSelection({ count: Math.max(1, Math.min(500, Number(event.target.value) || 1)) })} /></label>
          <div className="grid grid-cols-3 gap-2">{[50, 100, 200].map((count) => <button key={count} type="button" className={cn('min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60', selection.count === count ? 'border-black bg-black text-white' : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')} onClick={() => updateSelection({ count })}>{number(count)}</button>)}</div>
        </section>
      )}
      <section className={`${inset} flex items-start gap-3 p-3.5`}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('تحلیل دوبارهٔ گفتگوی بدون تغییر', 'Re-analyze unchanged conversations')}</p>
          <p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{t('خاموش بماند تا بابت گفتگویی که قبلاً کامل تحلیل شده دوباره هزینه نپردازید.', 'Keep this off to avoid paying again for a conversation that was already fully analyzed.')}</p>
        </div>
        <Switch checked={selection.includeReviewed} onChange={(includeReviewed) => updateSelection({ includeReviewed })} aria-label={t('اجازه تحلیل دوباره گفتگوهای بدون تغییر', 'Allow re-analysis of unchanged conversations')} />
      </section>
      {filters}
      {selection.mode === 'selected' && <><div className="flex min-h-11 items-center justify-between gap-3 px-1"><span className="text-sm font-semibold">{number(selection.ids.length)} {t('انتخاب‌شده', 'selected')}</span><Button variant="ghost" size="sm" onClick={() => updateSelection({ ids: [] })}>{t('پاک کردن انتخاب‌ها', 'Clear selection')}</Button></div>{conversationList}</>}
      <p className="px-1 text-xs leading-6 text-[var(--text-muted)]">{t('این کار یک تحلیل تازه و پولی است؛ فقط پس از نمایش برآورد و زدن «شروع تحلیل» اجرا می‌شود. درخواست ناموفق هزینه ندارد.', 'This is a new paid analysis. It runs only after the estimate is shown and you press Start analysis. Failed requests are not charged.')}</p>
    </DetailDialog>}
    {selected && data && <SuggestionDetail key={`${selected.id}-${selected.version}`} item={selected} pricing={data.pricing} agentId={agentId} fa={fa} busy={busy} error={error} act={act} triggerRef={suggestionTriggerRef} onClose={() => setSelectedId(null)} />}
    {settingsOpen && data && <AutomationDialog initial={data.settings} pricing={data.pricing} fa={fa} busy={busy} error={error} act={act} triggerRef={automationTriggerRef} onClose={() => setSettingsOpen(false)} />}
    {filtersOpen && <ConversationFilterDialog selection={selection} fa={fa} activeCount={activeFilterCount} triggerRef={filtersTriggerRef} update={updateSelection} onClose={() => setFiltersOpen(false)} />}
    {runId && <DetailDialog title={t('نتیجهٔ بررسی گفتگوها', 'Conversation review results')} description={t(`${number(reviewTotal)} گفتگوی بررسی‌شده`, `${number(reviewTotal)} reviewed conversations`)} triggerRef={resultsTriggerRef} wide onClose={() => setRunId(null)}>
      {reviews.map((review) => <article key={review.id} className={`${surface} space-y-3.5`}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold">{review.conversation.contact?.name || t('مشتری بدون نام', 'Unnamed customer')}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{review.conversation.channel}</p></div><StatusPill tone={review.status === 'DONE' ? 'success' : review.status === 'ERROR' ? 'warning' : 'neutral'}>{label(review.status)}</StatusPill></div>
        {review.result && <><div className={`${inset} p-3.5`}><div className="flex flex-wrap items-center gap-2"><StatusPill tone={review.result.outcome === 'RESOLVED' ? 'success' : review.result.outcome === 'UNRESOLVED' ? 'warning' : 'neutral'}>{label(review.result.outcome)}</StatusPill></div><p className="mt-3 text-xs font-bold text-[var(--text-muted)]">{t('نیاز مشتری', 'Customer intent')}</p><p className="mt-1 text-sm leading-7 text-[var(--text-primary)]">{review.result.intent || t('نامشخص', 'Unknown')}</p><p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{review.result.summary}</p></div>{!!review.result.strengths.length && <div><p className="text-xs font-bold text-[var(--text-muted)]">{t('نقاط قوت', 'Strengths')}</p><div className="mt-2 space-y-2">{review.result.strengths.map((rawStrength, index) => { const strength = typeof rawStrength === 'string' ? { title: rawStrength, messageIds: [] as string[] } : rawStrength; return <div key={`${strength.title}-${index}`} className="text-sm leading-7 text-[var(--text-secondary)]"><span>{strength.title}</span>{strength.messageIds.map((messageId) => <Link key={messageId} className="ms-2 text-[11px] font-bold underline underline-offset-4" target="_blank" href={`/conversations/${review.conversationId}#message-${messageId}`}>{t('شاهد', 'Evidence')}</Link>)}</div> })}</div></div>}{review.result.findings.map((finding, index) => <div key={index} className="border-t border-[var(--border-subtle)] pt-3"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{finding.title}</p><StatusPill>{finding.scope === 'CUSTOMER' ? t('برای این مشتری', 'This customer') : t('برای همهٔ مشتریان', 'All customers')}</StatusPill></div><p className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{finding.diagnosis}</p><div className="mt-1 flex flex-wrap gap-2">{finding.messageIds.map((messageId) => <Link key={messageId} className="text-[11px] font-bold underline underline-offset-4" target="_blank" href={`/conversations/${review.conversationId}#message-${messageId}`}>{t('مشاهده پیام شاهد', 'Open evidence message')}</Link>)}</div></div>)}</>}
        <Link className={`${secondary} w-full sm:w-auto`} href={`/conversations/${review.conversationId}`} target="_blank">{t('مشاهده گفتگو', 'Open conversation')}<ArrowLeft className="h-4 w-4 ltr:rotate-180" aria-hidden="true" /></Link>
      </article>)}
      {!reviews.length && (
        <div className="space-y-3" role="status">
          <span className="sr-only">{t('در حال دریافت نتیجه‌ها…', 'Loading results…')}</span>
          {Array.from({ length: 3 }).map((_, index) => (
            <ReviewCardSkeleton key={`review-skeleton-${index}`} delay={index * -150} />
          ))}
        </div>
      )}
      <Pagination page={reviewPage} total={reviewTotal} setPage={setReviewPage} fa={fa} />
    </DetailDialog>}
  </div>
}

function StatusPill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' }) {
  return <span className={cn(
    'inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold leading-5',
    tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
    tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-800',
    tone === 'neutral' && 'border-[var(--border-default)] bg-white text-[var(--text-secondary)]',
  )}>{children}</span>
}

function FilterChip({ label, onRemove, fa }: { label: string; onRemove: () => void; fa: boolean }) {
  return <button type="button" onClick={onRemove} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)] px-2.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60">
    <span>{label}</span><X className="h-3 w-3" aria-hidden="true" /><span className="sr-only">{fa ? 'حذف فیلتر' : 'Remove filter'}</span>
  </button>
}

function ConversationFilterDialog({
  selection,
  fa,
  activeCount,
  triggerRef,
  update,
  onClose,
}: {
  selection: Selection
  fa: boolean
  activeCount: number
  triggerRef: { current: HTMLElement | null }
  update: (patch: Partial<Selection>) => void
  onClose: () => void
}) {
  const t = (f: string, e: string) => fa ? f : e
  const inputDate = (value?: string) => value ? dateKeyInTimeZone(value) : ''
  return <DetailDialog
    title={t('فیلتر گفتگوها', 'Conversation filters')}
    description={activeCount ? t(`${activeCount.toLocaleString('fa-IR')} فیلتر فعال`, `${activeCount} active filters`) : t('نتیجه‌ها را دقیق‌تر کنید', 'Narrow the results')}
    triggerRef={triggerRef}
    onClose={onClose}
    footer={<div className="grid grid-cols-[auto_1fr] gap-2 sm:flex sm:justify-end"><Button variant="secondary" disabled={!activeCount} onClick={() => update({ channel: undefined, attention: 'all', from: undefined, to: undefined, contactId: undefined })}>{t('پاک کردن', 'Clear')}</Button><Button className="sm:min-w-32" onClick={onClose}><Check className="h-4 w-4" aria-hidden="true" />{t('نمایش نتیجه‌ها', 'Show results')}</Button></div>}
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm"><span className="text-xs font-semibold text-[var(--text-secondary)]">{t('کانال گفتگو', 'Conversation channel')}</span><select className={field} value={selection.channel ?? ''} onChange={(event) => update({ channel: (event.target.value || undefined) as Selection['channel'] })}><option value="">{t('همهٔ کانال‌ها', 'All channels')}</option>{['TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'RUBIKA', 'BALE', 'WEB_WIDGET', 'CHAT_LINK', 'API'].map((channel) => <option key={channel} value={channel}>{channel}</option>)}</select></label>
      <label className="space-y-2 text-sm"><span className="text-xs font-semibold text-[var(--text-secondary)]">{t('نیاز به توجه', 'Needs attention')}</span><select className={field} value={selection.attention} onChange={(event) => update({ attention: event.target.value as Selection['attention'] })}><option value="all">{t('همهٔ گفتگوها', 'All conversations')}</option><option value="unanswered">{t('بی‌پاسخ', 'Unanswered')}</option><option value="handoff">{t('ارجاع به اپراتور', 'Handed off')}</option><option value="low_rating">{t('امتیاز پایین', 'Low rating')}</option></select></label>
      {(['from', 'to'] as const).map((key) => <div key={key} className="space-y-2 text-sm"><span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{key === 'from' ? t('از تاریخ', 'From date') : t('تا تاریخ', 'To date')}</span><LocalizedDatePicker value={inputDate(selection[key])} onValueChange={(value) => update({ [key]: value ? dateKeyBoundaryISOString(value, key === 'to') : undefined })} locale={fa ? 'fa' : 'en'} ariaLabel={key === 'from' ? t('انتخاب تاریخ شروع', 'Choose start date') : t('انتخاب تاریخ پایان', 'Choose end date')} placeholder={key === 'from' ? t('از تاریخ', 'From date') : t('تا تاریخ', 'To date')} /></div>)}
    </div>
    {selection.contactId && <div className={`${inset} flex items-center justify-between gap-3 p-3.5`}><div><p className="text-sm font-semibold">{t('فقط گفتگوهای یک مشتری', 'Only one customer')}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{t('این فیلتر از کارت گفتگو فعال شده است.', 'This filter was set from a conversation card.')}</p></div><Button variant="ghost" size="sm" onClick={() => update({ contactId: undefined })}>{t('حذف', 'Remove')}</Button></div>}
  </DetailDialog>
}

function Pagination({ page, total, setPage, fa }: { page: number; total: number; setPage: (p: number) => void; fa: boolean }) {
  if (total <= 25) return null
  return <nav className="flex items-center justify-between gap-3 px-1 pt-1" aria-label={fa ? 'صفحه‌بندی' : 'Pagination'}><Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronRight className="h-4 w-4 ltr:rotate-180" aria-hidden="true" />{fa ? 'قبلی' : 'Previous'}</Button><span className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">{page.toLocaleString(fa ? 'fa-IR' : 'en-US')} / {Math.ceil(total / 25).toLocaleString(fa ? 'fa-IR' : 'en-US')}</span><Button variant="secondary" size="sm" disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>{fa ? 'بعدی' : 'Next'}<ChevronLeft className="h-4 w-4 ltr:rotate-180" aria-hidden="true" /></Button></nav>
}

function SuggestionDetail({ item: s, pricing, agentId, fa, busy, error, act, triggerRef, onClose }: { item: Suggestion; pricing: Pricing; agentId: string; fa: boolean; busy: string; error: string; act: Action; triggerRef: { current: HTMLElement | null }; onClose: () => void }) {
  const t = (f: string, e: string) => fa ? f : e
  const number = (value: number) => value.toLocaleString(fa ? 'fa-IR' : 'en-US')
  const [draft, setDraft] = useState<Draft>(() => draftSchema.parse(s.draft))
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftSchema.parse(s.draft))
  const preview = s.preview
  const pending = s.status === 'PENDING'
  const change = s.changes.find((c) => !c.revertedAt)
  const behaviorLabel = (v: unknown) => Array.isArray(v) ? v.join(' · ') : behaviorLabels[String(v)]?.[fa ? 0 : 1] ?? String(v ?? '')
  const previewPassed = preview?.assessment?.improved === true
  const testCost = pricing.previewRequestCount * pricing.requestPriceIRR / 10
  const originalReply = preview?.historical || preview?.baseline
  const waitingForInformation =
    (s.kind === 'KNOWLEDGE' && (Boolean(draft.missing) || draft.question.trim().length < 3 || draft.answer.trim().length < 3)) ||
    (s.kind === 'BEHAVIOR' && draft.scope === 'CUSTOMER' && (Boolean(draft.missing) || draft.answer.trim().length < 3))
  const primaryDisabled = waitingForInformation || (Boolean(preview) && !previewPassed)
  const primaryAction = s.kind === 'TOOL' || preview ? 'apply' : 'preview'
  const primaryLabel = s.kind === 'TOOL'
    ? t('تأیید رفع مشکل', 'Confirm resolved')
    : preview
      ? previewPassed ? t('اعمال تغییر', 'Apply change') : t('پیشنهاد را ویرایش کنید', 'Edit the suggestion')
      : waitingForInformation ? t('ابتدا اطلاعات را تکمیل کنید', 'Complete the information first') : t(`تست و ارزیابی · ${number(testCost)} تومان`, `Test & evaluate · ${number(testCost)} toman`)
  const detailFooter = <div className="space-y-2.5">
    {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-700">{error}</p>}
    {pending ? <>
      {dirty ? (
        <Button className="w-full" loading={!!busy} onClick={() => void act({ action: 'save', id: s.id, version: s.version, draft })}>
          <Check className="h-4 w-4" aria-hidden="true" />{t('ذخیره تغییرات', 'Save changes')}
        </Button>
      ) : (
        <Button className="w-full" loading={!!busy} disabled={primaryDisabled} onClick={() => void act({ action: primaryAction, id: s.id, version: s.version })}>
          {primaryLabel}
        </Button>
      )}
      {!preview && s.kind !== 'TOOL' && !waitingForInformation && <p className="text-[11px] leading-5 text-[var(--text-muted)]">{t(`نسخهٔ فعلی فقط یک‌بار و پیش از اعمال ارزیابی می‌شود: ${number(pricing.previewRequestCount)} درخواست AI و ${number(testCost)} تومان. بدون زدن دکمه هزینه‌ای کم نمی‌شود.`, `The current version is evaluated once before applying: ${number(pricing.previewRequestCount)} AI requests and ${number(testCost)} toman. Nothing is charged until you press the button.`)}</p>}
      {waitingForInformation && !dirty && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">{t('پاسخ معتبر را وارد کنید، تأیید تکمیل اطلاعات را بزنید و تغییرات را ذخیره کنید.', 'Enter a verified answer, confirm the missing information is complete, and save your changes.')}</p>}
      {preview && !previewPassed && !dirty && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">{t('این نسخه بهتر ارزیابی نشد. متن پیشنهاد را ویرایش کنید؛ دکمهٔ ذخیره بلافاصله فعال می‌شود.', 'This version was not rated better. Edit the suggestion and the save button will become available immediately.')}</p>}
    </> : change && <Button variant="secondary" className="w-full" disabled={!!busy} onClick={() => void act({ action: 'revert', id: change.id })}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t('بازگشت به قبل از این تغییر', 'Revert this change')}</Button>}
  </div>
  return <DetailDialog title={s.title} description={s.kind === 'KNOWLEDGE' ? t('پیشنهاد بهبود دانش', 'Knowledge improvement') : s.kind === 'BEHAVIOR' ? t('پیشنهاد رفتار و لحن', 'Behavior improvement') : t('پیشنهاد روند و ابزار', 'Flow and tool improvement')} triggerRef={triggerRef} wide onClose={onClose} footer={detailFooter}>
    <div className={`${surface} space-y-3`}><div className="flex flex-wrap gap-2"><StatusPill>{draft.scope === 'CUSTOMER' ? t('دامنه: فقط همین مشتری', 'Scope: this customer only') : t('دامنه: همهٔ مشتریان این ایجنت', 'Scope: all customers of this agent')}</StatusPill><StatusPill tone={s.priority === 'HIGH' ? 'warning' : 'neutral'}>{s.priority === 'HIGH' ? t('اولویت بالا', 'High priority') : s.priority === 'MEDIUM' ? t('اولویت متوسط', 'Medium priority') : t('اولویت پایین', 'Low priority')}</StatusPill></div><p className="text-sm leading-8 text-[var(--text-secondary)]">{s.diagnosis}</p></div>
    {s.kind === 'KNOWLEDGE' && <div className="space-y-4"><label className="block space-y-2 text-sm"><span>{t('سؤال یا موضوع دانش', 'Knowledge question')}</span><textarea className={field} rows={2} maxLength={2000} disabled={!pending} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} /></label>{draft.missing && <p className="rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-900">{draft.missing}</p>}<label className="block space-y-2 text-sm"><span>{t('پاسخ معتبر کسب‌وکار', 'Verified business answer')}</span><textarea className={`${field} leading-8`} rows={7} maxLength={8000} disabled={!pending} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} /></label>{pending && !!draft.missing && <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-black" disabled={draft.answer.trim().length < 3} onChange={() => setDraft({ ...draft, missing: '' })} />{t('اطلاعات لازم را در پاسخ تکمیل کردم.', 'I completed the required facts in the answer.')}</label>}{draft.targetKnowledgeId && <p className="text-xs leading-6">{t('این تغییر، پاسخ موجود را به‌روزرسانی می‌کند.', 'This updates an existing knowledge answer.')}</p>}</div>}
    {s.kind === 'BEHAVIOR' && draft.behaviorPath && <div className={`${surface} space-y-3`}><h3 className="font-semibold">{behaviorLabel(draft.behaviorPath)}</h3><p className="text-sm">{t('مقدار فعلی در زمان تحلیل: ', 'Value at analysis time: ')}{Array.isArray(draft.baseline) ? t(`${draft.baseline.length} دستور موجود حفظ می‌شود.`, `${draft.baseline.length} existing instructions are preserved.`) : behaviorLabel(draft.baseline)}</p><label className="block space-y-2 text-sm"><span>{t('مقدار پیشنهادی', 'Proposed value')}</span>{draft.behaviorPath === 'doSay' ? <textarea className={`${field} leading-8`} rows={4} maxLength={500} disabled={!pending} value={String(draft.behaviorValue ?? '')} onChange={(e) => setDraft({ ...draft, behaviorValue: e.target.value })} /> : <select disabled={!pending} className={field} value={String(draft.behaviorValue)} onChange={(e) => setDraft({ ...draft, behaviorValue: e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value })}>{behaviorValues[draft.behaviorPath].map((v) => <option key={String(v)} value={String(v)}>{behaviorLabel(v)}</option>)}</select>}</label></div>}
    {s.kind === 'BEHAVIOR' && draft.scope === 'CUSTOMER' && <div className={`${surface} space-y-3`}><div><h3 className="font-semibold">{t('ترجیح تعامل این مشتری', 'This customer’s interaction preference')}</h3><p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{t('فقط در پروفایل همین مشتری ثبت می‌شود و وارد دانش یا رفتار عمومی ایجنت نخواهد شد.', 'Stored only on this customer profile; it never enters shared knowledge or global agent behavior.')}</p></div><label className="block space-y-2 text-sm"><span>{t('ترجیح صریح', 'Explicit preference')}</span><textarea className={`${field} leading-8`} rows={4} maxLength={500} disabled={!pending} value={draft.answer} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} /></label></div>}
    {s.kind === 'TOOL' && <div className="space-y-3"><p className="text-sm leading-7">{draft.missing || t('این مورد نیاز به رسیدگی در تنظیمات یا منبع اصلی دارد. پس از اصلاح، رسیدگی را ثبت کنید.', 'Handle this in the source or settings, then record completion.')}</p><label className="block space-y-2 text-sm"><span>{t('یادداشت رسیدگی', 'Resolution note')}</span><textarea className={field} rows={3} value={draft.answer} disabled={!pending} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} /></label><div className="flex flex-wrap gap-2"><Link target="_blank" className={secondary} href={`/agents/${agentId}/improve?tab=knowledge`}>{t('دانش ایجنت', 'Knowledge')}</Link><Link target="_blank" className={secondary} href={`/agents/${agentId}/settings`}>{t('تنظیمات ایجنت', 'Agent settings')}</Link></div></div>}
    {!!s.evidence.length && <details className="spatial-surface overflow-hidden rounded-[1.25rem]"><summary className="flex min-h-12 cursor-pointer items-center px-4 py-3 text-sm font-semibold">{t('نمونهٔ شواهد از گفتگوها', 'Conversation evidence sample')} ({s.evidence.length.toLocaleString(fa ? 'fa-IR' : 'en-US')})</summary><div className="space-y-3 border-t border-[var(--border-subtle)] px-4 pb-4">{s.evidence.map((e, i) => <div key={`${e.messageId}-${i}`} className="pt-3"><blockquote dir="auto" className={`${inset} whitespace-pre-wrap break-words p-3.5 text-sm leading-7 text-[var(--text-secondary)]`}>{e.message.content}</blockquote><Link target="_blank" className="mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]" href={`/conversations/${e.review.conversationId}#message-${e.messageId}`}>{t('رفتن به پیام شاهد', 'Open evidence message')}<ArrowLeft className="h-3.5 w-3.5 ltr:rotate-180" aria-hidden="true" /></Link></div>)}</div></details>}
    {preview && <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="font-bold">{t('قبل و بعد از تغییر', 'Before and after')}</h3><p className="mt-1 text-xs text-[var(--text-muted)]">{preview.source === 'automatic' ? t('تست خودکار', 'Automatic test') : t('تست دستی', 'Manual test')}</p></div>
        <StatusPill>{number(preview.requestCount ?? pricing.previewRequestCount)} {t('درخواست AI', 'AI requests')} · {number((preview.chargedIRR ?? pricing.previewRequestCount * pricing.requestPriceIRR) / 10)} {t('تومان', 'toman')}</StatusPill>
      </div>
      <div className={`${inset} p-3.5`}><p className="text-[11px] font-bold text-[var(--text-muted)]">{t('پیام مشتری', 'Customer message')}</p><blockquote className="mt-1.5 whitespace-pre-wrap text-sm leading-7 text-[var(--text-primary)]">{preview.question}</blockquote></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={`${surface} border border-[var(--border-default)]`}><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold">{t('پاسخ واقعی ایجنت', 'Actual agent reply')}</h4><StatusPill>{t('قبل', 'Before')}</StatusPill></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-8 text-[var(--text-secondary)]">{originalReply}</p></div>
        <div className={cn(surface, 'border', previewPassed ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/35')}><div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold">{t('پاسخ پیشنهادی جدید', 'New proposed reply')}</h4><StatusPill tone={previewPassed ? 'success' : 'warning'}>{t('بعد', 'After')}</StatusPill></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-8 text-[var(--text-primary)]">{preview.proposed}</p></div>
      </div>
      {preview.assessment && <div className={cn('flex items-start gap-2.5 rounded-xl border p-3.5 text-sm leading-7', previewPassed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950')}>{previewPassed ? <CircleCheck className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />}<div><p className="font-bold">{previewPassed ? t('این پاسخ بهتر ارزیابی شد', 'This reply was rated better') : t('این پیشنهاد هنوز بهتر نیست', 'This suggestion is not better yet')}</p><p className="mt-1">{preview.assessment.reason}</p></div></div>}
      <p className="text-xs leading-6 text-[var(--text-muted)]">{t('این پیش‌نمایش برای مشتری ارسال نشده و ابزار زنده‌ای را اجرا نکرده است.', 'This preview was not sent to the customer and did not execute live tools.')}</p>
    </section>}
    {s.knowledgeStatus && <div className={`${surface} space-y-2`}><p className="text-sm">{statusLabels[s.knowledgeStatus]?.[fa ? 0 : 1] ?? s.knowledgeStatus}</p>{s.knowledgeStatus === 'ERROR' && change && <button className={secondary} disabled={!!busy} onClick={() => void act({ action: 'ingest', id: change.id })}>{t('تلاش مجدد آماده‌سازی دانش', 'Retry knowledge preparation')}</button>}</div>}
    {s.monitoring && <section className={`${surface} space-y-2`}><h3 className="text-sm font-bold">{t('پیگیری پس از تغییر', 'Follow-up after the change')}</h3><p className="text-sm leading-7">{s.monitoring.reviewed ? t(`از ${s.monitoring.reviewed.toLocaleString('fa-IR')} گفتگوی بررسی‌شده پس از تغییر، این مشکل در ${s.monitoring.recurring.toLocaleString('fa-IR')} گفتگو دوباره دیده شده است.`, `Among ${s.monitoring.reviewed} conversations reviewed after the change, this issue recurred in ${s.monitoring.recurring}.`) : t('هنوز گفتگوی جدیدی پس از این تغییر تحلیل نشده است.', 'No new conversations have been analyzed since this change.')}</p><p className="text-xs leading-6 text-[var(--text-secondary)]">{t('این شمارش مربوط به نمونهٔ تحلیل‌شده است؛ به‌تنهایی اثبات رضایت مشتری یا اثر قطعی تغییر نیست.', 'These observations cover the reviewed sample; they do not establish satisfaction or causality.')}</p></section>}
    {!!s.changes.length && <details className="rounded-xl border p-3"><summary className="min-h-9 cursor-pointer text-sm">{t('سابقهٔ این تغییر', 'Change history')}</summary>{s.changes.map((c) => <div key={c.id} className="mt-3 space-y-2 text-sm"><p>{formatLocalizedDateTime(c.createdAt, fa ? 'fa' : 'en')} · {c.revertedAt ? t('بازگردانده شده', 'Reverted') : t('اعمال شده', 'Applied')}</p>{typeof c.before.answer === 'string' && <p className="whitespace-pre-wrap leading-7">{t('پاسخ قبلی: ', 'Previous answer: ')}{c.before.answer}</p>}</div>)}</details>}
    {pending && <Button variant="danger" className="w-full" disabled={!!busy} onClick={async () => { if (await act({ action: 'dismiss', id: s.id, version: s.version })) onClose() }}><Trash2 className="h-4 w-4" aria-hidden="true" />{t('حذف پیشنهاد', 'Delete suggestion')}</Button>}
  </DetailDialog>
}

function AutomationDialog({ initial, pricing, fa, busy, error, act, triggerRef, onClose }: { initial: Settings; pricing: Pricing; fa: boolean; busy: string; error: string; act: Action; triggerRef: { current: HTMLElement | null }; onClose: () => void }) {
  const [settings, setSettings] = useState(initial)
  const t = (f: string, e: string) => fa ? f : e
  return <DetailDialog
    title={t('خودکارسازی تحلیل و بهبود', 'Analysis and improvement automation')}
    description={t('زمان‌بندی و محدودهٔ تغییرهای خودکار', 'Schedule and scope automatic changes')}
    triggerRef={triggerRef}
    onClose={onClose}
    footer={<div className="space-y-2">{error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-6 text-red-700">{error}</p>}<Button className="w-full" loading={!!busy} onClick={async () => { if (await act({ action: 'settings', settings })) onClose() }}><Check className="h-4 w-4" aria-hidden="true" />{t('ذخیره تنظیمات', 'Save settings')}</Button></div>}
  >
    <div className={`${inset} flex items-start gap-3 p-4`}><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" /><div><p className="text-sm font-bold">{t('کنترل تغییرها دست شماست', 'You stay in control')}</p><p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{t('نتیجهٔ همهٔ تحلیل‌ها و تغییرهای خودکار در سابقه ثبت می‌شود و قابل بازگشت است.', 'Every analysis and automatic change is recorded in history and can be reverted.')}</p></div></div>

    <section className={`${surface} space-y-4`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--text-secondary)]"><CalendarDays className="h-4 w-4" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">{t('تحلیل روزانه', 'Daily analysis')}</p><p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{t(`گفتگوهای تازه یا دارای پیام جدید بررسی می‌شوند. هر درخواست موفق مدل ${pricing.modelNameFa}، ${(pricing.requestPriceIRR / 10).toLocaleString('fa-IR')} تومان خودکار از اعتبار کم می‌کند.`, `New or updated conversations are reviewed. Each successful ${pricing.modelNameEn} request automatically deducts ${(pricing.requestPriceIRR / 10).toLocaleString('en-US')} toman.`)}</p></div>
        <div className="flex min-h-11 items-center"><Switch checked={settings.daily} onChange={(daily) => setSettings({ ...settings, daily })} aria-label={t('تحلیل روزانه', 'Daily analysis')} /></div>
      </div>
      {settings.daily && <div className={`${inset} space-y-3 p-3.5`}><label className="block space-y-2 text-sm"><span className="text-xs font-semibold text-[var(--text-secondary)]">{t('حداکثر گفتگو در هر روز', 'Daily conversation limit')}</span><input className={field} type="number" min={1} max={100} value={settings.count} onChange={(event) => setSettings({ ...settings, count: Math.max(1, Math.min(100, Number(event.target.value) || 1)) })} /></label><div className="grid grid-cols-3 gap-2">{[25, 50, 100].map((count) => <button key={count} type="button" className={cn('min-h-10 rounded-xl border bg-white text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60', settings.count === count ? 'border-black bg-black text-white' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')} onClick={() => setSettings({ ...settings, count })}>{count.toLocaleString(fa ? 'fa-IR' : 'en-US')}</button>)}</div></div>}
    </section>

    <section className={`${surface} space-y-4`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/[0.045] text-[var(--text-secondary)]"><WandSparkles className="h-4 w-4" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">{t('شیوهٔ اعمال تغییر', 'Change application mode')}</p><p className="mt-1 text-xs leading-6 text-[var(--text-muted)]">{t('دانش، ابزار و ترجیح مخصوص مشتری همیشه برای بررسی می‌مانند؛ خودکارسازی فقط به رفتارهای مجاز محدود است.', 'Knowledge, tools and customer-specific preferences always require review; automation is limited to allowed behaviors.')}</p></div>
      </div>
      <div className={`${inset} grid grid-cols-2 gap-1.5 p-1.5`} role="radiogroup" aria-label={t('شیوهٔ اعمال تغییر', 'Change application mode')}>
        <button type="button" role="radio" aria-checked={!settings.autoBehavior} onClick={() => setSettings({ ...settings, autoBehavior: false })} className={cn('min-h-12 rounded-xl px-2 text-xs font-bold transition-colors', !settings.autoBehavior ? 'bg-black text-white' : 'text-[var(--text-secondary)] hover:bg-white')}>{t('بررسی قبل از اعمال', 'Review before applying')}</button>
        <button type="button" role="radio" aria-checked={settings.autoBehavior} onClick={() => setSettings({ ...settings, autoBehavior: true })} className={cn('min-h-12 rounded-xl px-2 text-xs font-bold transition-colors', settings.autoBehavior ? 'bg-black text-white' : 'text-[var(--text-secondary)] hover:bg-white')}>{t('اعمال خودکار مجازها', 'Auto-apply allowed')}</button>
      </div>
      {settings.autoBehavior && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900">{t(`تست خودکار هر پیشنهاد ${pricing.previewRequestCount.toLocaleString('fa-IR')} درخواست موفق (${(pricing.previewRequestCount * pricing.requestPriceIRR / 10).toLocaleString('fa-IR')} تومان) دارد.`, `Each automatic suggestion test uses ${pricing.previewRequestCount} successful requests (${(pricing.previewRequestCount * pricing.requestPriceIRR / 10).toLocaleString('en-US')} toman).`)}</p>}
      {settings.autoBehavior && <div className="space-y-2"><p className="text-xs font-semibold text-[var(--text-secondary)]">{t('تغییرهای مجاز', 'Allowed changes')}</p>{(['format.length', 'conversation.avoidRepeatedGreetings'] as const).map((path) => {
        const checked = settings.allowedPaths.includes(path)
        return <button key={path} type="button" role="checkbox" aria-checked={checked} className={cn('flex min-h-12 w-full items-center gap-3 rounded-xl border bg-white px-3 text-start text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60', checked ? 'border-black/25 text-[var(--text-primary)]' : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]')} onClick={() => setSettings({ ...settings, allowedPaths: checked ? settings.allowedPaths.filter((item) => item !== path) : [...settings.allowedPaths, path] })}><span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-md border', checked ? 'border-black bg-black text-white' : 'border-[var(--border-hover)]')} aria-hidden="true">{checked && <Check className="h-3.5 w-3.5" />}</span>{behaviorLabels[path][fa ? 0 : 1]}</button>
      })}</div>}
    </section>

    <p className="px-1 text-xs leading-6 text-[var(--text-muted)]">{t('افزودن اطلاعات کسب‌وکار، تغییر دانش و تنظیم ابزارها همیشه برای بررسی شما باقی می‌ماند.', 'Business facts, knowledge changes, and tool settings always remain for your review.')}</p>
  </DetailDialog>
}
