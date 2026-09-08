'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Search, SlidersHorizontal, Sparkles, X, Loader2, History, MessageSquare, RotateCcw } from 'lucide-react'
import { behaviorValues, draftSchema, type Draft, type ReviewResult, type Selection } from '@/lib/improvement/types'
import { useLearningCount } from '@/components/agents/learning-count'

const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2'
const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black'
const field = 'min-h-12 w-full min-w-0 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3 py-2 text-base outline-none focus:ring-2 focus:ring-black/50'
const surface = 'rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] p-4 sm:p-5'
type Preview = { baseline: string; proposed: string; historical?: string | null; question: string; testedAt: string; version: number; assessment?: { improved: boolean; reason: string } }
type Change = { id: string; kind: string; targetId: string | null; createdAt: string; revertedAt: string | null; before: Record<string, unknown>; after: Record<string, unknown> }
type Evidence = { messageId: string; message: { role: string; content: string }; review: { conversationId: string; runId: string; run: { createdAt: string } } }
type Suggestion = { conversationCount: number; monitoring?: { reviewed: number; recurring: number } | null; id: string; title: string; kind: string; diagnosis: string; priority: string; status: string; draft: Draft; version: number; preview: Preview | null; evidence: Evidence[]; changes: Change[]; knowledgeStatus?: string | null; topicKey: string }
type Run = { id: string; status: string; total: number; createdAt: string; error: string | null; reviews: { id: string; status: string }[] }
type Settings = { daily: boolean; count: number; autoBehavior: boolean; allowedPaths: ('format.length' | 'conversation.avoidRepeatedGreetings')[] }
type Overview = { runTotal: number; activeRun: Run | null; suggestionTotal: number; runs: Run[]; suggestions: Suggestion[]; pendingCount: number; settings: Settings }
type Conversation = { id: string; channel: string; status: string; messageCount: number; lastMessageAt: string | null; contactId: string | null; contact: { name: string | null; phone: string | null } | null; messages: { content: string }[] }
type Review = { id: string; conversationId: string; status: string; result: ReviewResult | null; conversation: { channel: string; contact: { name: string | null } | null } }
type Action = (body: Record<string, unknown>) => Promise<Record<string, unknown> | null>
const initialSelection: Selection = { mode: 'latest', count: 100, ids: [], search: '', attention: 'all' }
const errors: Record<string, [string, string]> = {
  RUN_ACTIVE: ['یک تحلیل در حال اجراست؛ تا پایان آن صبر کنید.', 'An analysis is already running.'],
  NO_CONVERSATIONS: ['گفتگویی با این انتخاب پیدا نشد.', 'No matching conversations.'],
  SELECTION_CHANGED: ['بعضی گفتگوها دیگر با انتخاب شما منطبق نیستند؛ انتخاب را تازه کنید.', 'The selection changed. Please select again.'],
  QUEUE_UNAVAILABLE: ['شروع تحلیل ممکن نشد؛ دوباره تلاش کنید.', 'Could not queue analysis. Please retry.'],
  AI_UNAVAILABLE: ['سرویس تحلیل فعلاً در دسترس نیست.', 'Analysis service is unavailable.'],
  MISSING_INFORMATION: ['ابتدا پاسخ و اطلاعات ناقص را تکمیل کنید.', 'Complete the missing information first.'],
  TEST_REQUIRED: ['ابتدا پاسخ را با آخرین نسخهٔ تنظیمات تست کنید.', 'Test the latest settings before applying.'],
  KNOWLEDGE_CHANGED: ['دانش از زمان بررسی تغییر کرده؛ دوباره تحلیل یا تست کنید.', 'Knowledge has changed. Review or test again.'],
  BEHAVIOR_CHANGED: ['این تنظیم قبلاً تغییر کرده؛ برای پیشنهاد تازه دوباره تحلیل کنید.', 'This setting has changed. Run a fresh analysis.'],
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

function DetailDialog({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const node = ref.current
    node?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { node?.close(); document.body.style.overflow = previous }
  }, [])
  return <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose() }} aria-labelledby="improvement-detail-title" className="fixed inset-0 m-auto h-dvh max-h-dvh w-full max-w-none overflow-hidden bg-[var(--bg-base)] p-0 text-[var(--text-primary)] backdrop:bg-black/40 sm:h-[90dvh] sm:max-w-3xl sm:rounded-2xl">
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b p-4 pt-[max(1rem,env(safe-area-inset-top))]"><h2 id="improvement-detail-title" className="text-base font-bold">{title}</h2><button type="button" onClick={onClose} className={secondary} aria-label="Close / بستن"><X className="h-5 w-5" /></button></div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
      {footer && <div className="shrink-0 border-t bg-[var(--bg-base)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
    </div>
  </dialog>
}

export function ImprovementCenter({ agentId }: { agentId: string }) {
  const fa = useLocale() !== 'en'
  const t = (f: string, e: string) => fa ? f : e
  const label = (value: string) => statusLabels[value]?.[fa ? 0 : 1] ?? value
  const number = (v: number) => v.toLocaleString(fa ? 'fa-IR' : 'en-US')
  const date = (v: string) => new Date(v).toLocaleString(fa ? 'fa-IR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })
  const base = `/api/agents/${agentId}/improvement`
  const [data, setData] = useState<Overview | null>(null)
  const [tab, setTab] = useState<'suggestions' | 'conversations' | 'history'>('suggestions')
  const [suggestionPage, setSuggestionPage] = useState(1)
  const [runPage, setRunPage] = useState(1)
  const historyView = tab === 'history'
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState('')
  const busyRef = useRef(false)
  const [selectOpen, setSelectOpen] = useState(false), [settingsOpen, setSettingsOpen] = useState(false)
  const [selection, setSelection] = useState<Selection>(initialSelection)
  const [estimate, setEstimate] = useState<{ count: number; estimatedTokens: number } | null>(null)
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
      if (body.action !== 'estimate') { await refresh(); setNotice(t('انجام شد.', 'Done.')) }
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
  const filters = <div className="space-y-3">
    <label className="relative block"><span className="sr-only">{t('جستجوی گفتگو', 'Search conversations')}</span><Search className="pointer-events-none absolute start-3 top-4 h-4 w-4" /><input className={`${field} ps-10`} value={selection.search} onChange={(e) => updateSelection({ search: e.target.value })} placeholder={t('متن پیام، نام یا شماره مشتری…', 'Message, customer name or phone…')} /></label>
    <details className="rounded-xl border p-3"><summary className="min-h-8 cursor-pointer text-sm font-medium">{t('فیلتر گفتگوها', 'Conversation filters')}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm"><span>{t('کانال', 'Channel')}</span><select className={field} value={selection.channel ?? ''} onChange={(e) => updateSelection({ channel: (e.target.value || undefined) as Selection['channel'] })}><option value="">{t('همه کانال‌ها', 'All channels')}</option>{['TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'RUBIKA', 'BALE', 'WEB_WIDGET', 'CHAT_LINK', 'API'].map((c) => <option key={c}>{c}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t('وضعیت', 'Status')}</span><select className={field} value={selection.attention} onChange={(e) => updateSelection({ attention: e.target.value as Selection['attention'] })}>{[['all', 'همه', 'All'], ['unanswered', 'بی‌پاسخ', 'Unanswered'], ['handoff', 'ارجاع به اپراتور', 'Handed off'], ['low_rating', 'امتیاز پایین', 'Low rating']].map(([v, f, e]) => <option key={v} value={v}>{t(f, e)}</option>)}</select></label>
      {(['from', 'to'] as const).map((key) => <label key={key} className="space-y-1 text-sm"><span>{key === 'from' ? t('از تاریخ (میلادی)', 'From date') : t('تا تاریخ (میلادی)', 'To date')}</span><input type="date" className={field} value={selection[key] ? new Date(new Date(selection[key]!).getTime() - new Date(selection[key]!).getTimezoneOffset() * 60000).toISOString().slice(0, 10) : ''} onChange={(e) => updateSelection({ [key]: e.target.value ? new Date(`${e.target.value}T${key === 'from' ? '00:00:00' : '23:59:59'}`).toISOString() : undefined })} /></label>)}
      {selection.contactId && <button className={secondary} onClick={() => updateSelection({ contactId: undefined })}>{t('حذف فیلتر مشتری', 'Clear customer filter')}</button>}
    </div></details>
  </div>
  const conversationList = <div className="space-y-3" aria-busy={searching}>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{searching ? t('در حال جستجو…', 'Searching…') : t(`${number(total)} گفتگو`, `${number(total)} conversations`)}</span><button className={secondary} disabled={searching || !conversations.length} onClick={() => setSelection((s) => ({ ...s, mode: 'selected', ids: [...new Set([...s.ids, ...conversations.map((c) => c.id)])].slice(0, 500) }))}>{t('انتخاب این صفحه', 'Select this page')}</button></div>
    {!searching && !conversations.length && <p className={`${surface} text-sm`}>{t('گفتگویی پیدا نشد؛ جستجو یا فیلتر را تغییر دهید.', 'No conversations found. Change the search or filters.')}</p>}
    {conversations.map((c) => <article key={c.id} className="rounded-xl border p-3"><div className="flex items-start gap-3"><label className="flex min-h-11 min-w-11 items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-black" checked={selection.ids.includes(c.id)} onChange={() => toggle(c.id)} aria-label={t('انتخاب گفتگو با ', 'Select conversation with ') + (c.contact?.name ?? c.id)} /></label><div className="min-w-0 flex-1"><p className="font-semibold">{c.contact?.name || t('مشتری بدون نام', 'Unnamed customer')}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{c.channel} · {number(c.messageCount)} {t('پیام', 'messages')}</p><p className="mt-2 line-clamp-2 break-words text-sm leading-6">{c.messages[0]?.content}</p><div className="mt-2 flex flex-wrap gap-2"><Link className={secondary} href={`/conversations/${c.id}`} target="_blank">{t('مشاهده گفتگو', 'Open conversation')}</Link>{c.contactId && <button className={secondary} onClick={() => updateSelection({ contactId: c.contactId! })}>{t('گفتگوهای این مشتری', 'This customer’s conversations')}</button>}</div></div></div></article>)}
    <Pagination page={page} total={total} setPage={setPage} fa={fa} />
  </div>
  return <div className="min-w-0 space-y-4">
    <section className={`${surface} space-y-3`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5" />{t('تحلیل و بهبود', 'Analyze & improve')}</h2><button className={secondary} onClick={() => setSettingsOpen(true)} disabled={!data}><SlidersHorizontal className="h-4 w-4" />{t('خودکارسازی', 'Automation')}</button></div><p className="max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">{t('گفتگوها را بررسی کنید، علت مشکل را پیدا کنید و دانش یا رفتار ایجنت را از همین‌جا بهتر کنید.', 'Review conversations, understand their problems, and improve agent knowledge and behavior here.')}</p><button className={`${primary} w-full sm:w-auto`} disabled={!!activeRun || !data} onClick={() => { setSelection(initialSelection); setSelectOpen(true) }}><Sparkles className="h-4 w-4" />{t('تحلیل گفتگوها', 'Analyze conversations')}</button></section>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">{error}<button className="ms-3 underline" onClick={() => void refresh().then(() => setError('')).catch(() => {})}>{t('تلاش مجدد', 'Retry')}</button></div>}
    {notice && <p role="status" className="text-sm text-[var(--text-secondary)]">{notice}</p>}
    {activeRun && <section className={`${surface} space-y-3`} aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />{label(activeRun.status)}</span><button className={secondary} disabled={!!busy} onClick={() => void act({ action: 'cancel', id: activeRun.id })}>{t('توقف تحلیل', 'Stop analysis')}</button></div><progress className="h-2 w-full accent-black" value={activeRun.reviews.filter((r) => ['DONE', 'ERROR'].includes(r.status)).length} max={activeRun.total} /><p className="text-sm">{number(activeRun.reviews.filter((r) => r.status === 'DONE').length)} {t('از', 'of')} {number(activeRun.total)} {t('گفتگو بررسی شد؛ می‌توانید صفحه را ببندید.', 'reviewed; you can close this page.')}</p></section>}
    <div role="tablist" aria-label={t('بخش‌های تحلیل', 'Analysis sections')} className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--bg-muted)] p-1">{([['suggestions', 'پیشنهادها', 'Suggestions', Sparkles], ['conversations', 'گفتگوها', 'Conversations', MessageSquare], ['history', 'سابقه', 'History', History]] as const).map(([key, f, e, Icon], i) => <button role="tab" type="button" id={`analysis-tab-${key}`} aria-controls={`analysis-panel-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} key={key} onClick={() => setTab(key)} onKeyDown={(event) => {
      const keys = ['suggestions', 'conversations', 'history'] as const
      let n = i
      if (event.key === 'Home') n = 0
      else if (event.key === 'End') n = 2
      else if (event.key === 'ArrowLeft') n = (i + (fa ? 1 : 2)) % 3
      else if (event.key === 'ArrowRight') n = (i + (fa ? 2 : 1)) % 3
      else return
      event.preventDefault(); setTab(keys[n]); document.getElementById(`analysis-tab-${keys[n]}`)?.focus()
    }} className={`flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-lg px-1 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-black sm:text-sm ${tab === key ? 'bg-[var(--bg-base)] shadow-sm' : 'text-[var(--text-secondary)]'}`}><Icon className="hidden h-4 w-4 sm:block" />{t(f, e)}{key === 'suggestions' && !!data?.pendingCount && <span className="ms-1">{number(data.pendingCount)}</span>}</button>)}</div>
    {!data && <p role="status" className={`${surface} animate-pulse motion-reduce:animate-none`}>{t('در حال دریافت اطلاعات…', 'Loading…')}</p>}
    <section role="tabpanel" id="analysis-panel-suggestions" aria-labelledby="analysis-tab-suggestions" hidden={tab !== 'suggestions'} className="space-y-3">
      {data && !pending.length && <div className={`${surface} py-10 text-center`}><Sparkles className="mx-auto h-7 w-7" /><p className="mt-3 font-semibold">{t('پیشنهادی در انتظار نیست', 'No pending suggestions')}</p><p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{t('یک تحلیل شروع کنید؛ نتیجهٔ هر گفتگو و اصلاح‌های پیشنهادی اینجا ظاهر می‌شوند.', 'Start an analysis to see conversation findings and proposed improvements.')}</p></div>}
      {pending.map((s) => <button key={s.id} className={`${surface} block w-full text-start focus-visible:ring-2 focus-visible:ring-black`} onClick={() => setSelectedId(s.id)}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-[var(--text-secondary)]">{s.kind === 'KNOWLEDGE' ? t('دانش', 'Knowledge') : s.kind === 'BEHAVIOR' ? t('رفتار و لحن', 'Behavior') : t('روند و ابزار', 'Flow & tools')} · {s.priority === 'HIGH' ? t('اولویت بالا', 'High priority') : s.priority === 'MEDIUM' ? t('اولویت متوسط', 'Medium priority') : t('اولویت پایین', 'Low priority')}</span><span className="text-xs">{number(s.conversationCount)} {t('گفتگو', 'conversations')}</span></div><h3 className="mt-3 font-bold">{s.title}</h3><p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--text-secondary)]">{s.diagnosis}</p><span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">{s.draft.missing ? t('تکمیل اطلاعات', 'Complete information') : t('بررسی پیشنهاد', 'Review suggestion')}<ArrowLeft className="h-4 w-4 ltr:rotate-180" /></span></button>)}
      <Pagination page={suggestionPage} total={data?.suggestionTotal ?? 0} setPage={setSuggestionPage} fa={fa} />
    </section>
    <section role="tabpanel" id="analysis-panel-conversations" aria-labelledby="analysis-tab-conversations" hidden={tab !== 'conversations'} className="space-y-4">{filters}{conversationList}<button className={`${primary} sticky bottom-[max(1rem,env(safe-area-inset-bottom))] w-full shadow-lg sm:w-auto`} disabled={!selection.ids.length || !!activeRun} onClick={() => { updateSelection({ mode: 'selected' }); setSelectOpen(true) }}>{t(`تحلیل ${number(selection.ids.length)} گفتگوی انتخاب‌شده`, `Analyze ${number(selection.ids.length)} selected conversations`)}</button></section>
    <section role="tabpanel" id="analysis-panel-history" aria-labelledby="analysis-tab-history" hidden={tab !== 'history'} className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">{t('تحلیل‌ها، تغییرها و بازگشت به نسخهٔ قبل', 'Analyses, changes, and rollback')}</p>
      {data?.runs.map((r) => <article key={r.id} className={`${surface} space-y-3`}><div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-semibold">{number(r.total)} {t('گفتگو', 'conversations')} · {label(r.status)}</span><span className="text-xs text-[var(--text-muted)]">{date(r.createdAt)}</span></div><div className="flex flex-wrap gap-2"><button className={secondary} onClick={() => { setRunId(r.id); setReviewPage(1); setReviews([]) }}>{t('نتیجهٔ هر گفتگو', 'Individual results')}</button>{['PARTIAL', 'ERROR'].includes(r.status) && <button className={secondary} disabled={!!busy || !!activeRun} onClick={() => void act({ action: 'retry', id: r.id })}><RotateCcw className="h-4 w-4" />{t('ادامهٔ موارد ناموفق', 'Retry unfinished reviews')}</button>}</div></article>)}
      <Pagination page={runPage} total={data?.runTotal ?? 0} setPage={setRunPage} fa={fa} />
      {data?.suggestions.filter((s) => s.status !== 'PENDING').map((s) => <button key={s.id} className={`${surface} block w-full text-start`} onClick={() => setSelectedId(s.id)}><span className="text-xs text-[var(--text-secondary)]">{label(s.status)}{s.knowledgeStatus ? ` · ${label(s.knowledgeStatus)}` : ''}</span><p className="mt-2 font-semibold">{s.title}</p></button>)}
      {data && !data.runs.length && <p className={surface}>{t('هنوز تحلیلی ثبت نشده است.', 'No analyses yet.')}</p>}
      <Pagination page={suggestionPage} total={data?.suggestionTotal ?? 0} setPage={setSuggestionPage} fa={fa} />
      <Link className={secondary} href={`/agents/${agentId}/improve?tab=learning&view=approved`}>{t('آرشیو یادگیری قبلی', 'Previous learning archive')}</Link>
    </section>
    {selectOpen && <DetailDialog title={t('انتخاب گفتگوها برای تحلیل', 'Select conversations to analyze')} onClose={() => setSelectOpen(false)} footer={<div className="space-y-2">{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{estimate && <p className="text-xs leading-6">{number(estimate.count)} {t('گفتگو · برآورد تقریبی مصرف:', 'conversations · Approximate token usage:')} {number(estimate.estimatedTokens)} {t('توکن. مصرف واقعی به طول گفتگو و پاسخ تحلیل بستگی دارد.', 'tokens. Actual usage depends on conversation and analysis length.')}</p>}<button className={`${primary} w-full`} disabled={!!busy || !!activeRun || (selection.mode === 'selected' && !selection.ids.length)} onClick={async () => {
      if (!estimate) { const r = await act({ action: 'estimate', selection }); if (r) setEstimate(r as typeof estimate & { count: number; estimatedTokens: number }) }
      else { const r = await act({ action: 'start', selection }); if (r) { setSelectOpen(false); setTab('suggestions') } }
    }}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{estimate ? t('شروع تحلیل', 'Start analysis') : t('بررسی انتخاب و مصرف', 'Review selection and usage')}</button></div>}>
      <p className="text-sm leading-7 text-[var(--text-secondary)]">{t('هر گفتگو جدا بررسی می‌شود. پیام‌های پس از شروع تحلیل وارد این نوبت نمی‌شوند.', 'Each conversation is reviewed separately. Messages arriving after the start belong to the next run.')}</p>
      <div className="grid grid-cols-2 gap-2">{(['latest', 'selected'] as const).map((mode) => <button className={selection.mode === mode ? primary : secondary} key={mode} onClick={() => updateSelection({ mode })}>{mode === 'latest' ? t('آخرین گفتگوها', 'Latest conversations') : t('انتخاب دستی', 'Manual selection')}</button>)}</div>
      {selection.mode === 'latest' && <label className="block space-y-2 text-sm"><span>{t('تعداد گفتگو (حداکثر ۵۰۰)', 'Number of conversations (max 500)')}</span><input type="number" min={1} max={500} className={field} value={selection.count} onChange={(e) => updateSelection({ count: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })} /><span className="flex gap-2">{[50, 100, 200].map((n) => <button key={n} type="button" className={secondary} onClick={() => updateSelection({ count: n })}>{number(n)}</button>)}</span></label>}
      {filters}{selection.mode === 'selected' && <><div className="flex items-center justify-between text-sm"><span>{number(selection.ids.length)} {t('انتخاب‌شده', 'selected')}</span><button className={secondary} onClick={() => updateSelection({ ids: [] })}>{t('پاک کردن انتخاب‌ها', 'Clear selection')}</button></div>{conversationList}</>}
    </DetailDialog>}
    {selected && <SuggestionDetail key={`${selected.id}-${selected.version}`} item={selected} agentId={agentId} fa={fa} busy={busy} error={error} act={act} onClose={() => setSelectedId(null)} />}
    {settingsOpen && data && <AutomationDialog initial={data.settings} fa={fa} busy={busy} error={error} act={act} onClose={() => setSettingsOpen(false)} />}
    {runId && <DetailDialog title={t('نتیجهٔ بررسی گفتگوها', 'Conversation review results')} onClose={() => setRunId(null)}>{reviews.map((r) => <article key={r.id} className={`${surface} space-y-3`}><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">{r.conversation.contact?.name || t('مشتری بدون نام', 'Unnamed customer')}</h3><span className="text-xs">{label(r.status)}</span></div>{r.result && <><p className="text-xs">{label(r.result.outcome)}</p><p className="text-sm leading-7">{r.result.summary}</p>{!!r.result.strengths.length && <p className="text-sm leading-7 text-[var(--text-secondary)]">{t('نقاط قوت: ', 'Strengths: ')}{r.result.strengths.join(' · ')}</p>}{r.result.findings.map((f, i) => <div key={i} className="border-t pt-2"><p className="text-sm font-semibold">{f.title}</p><p className="mt-1 text-sm leading-7 text-[var(--text-secondary)]">{f.diagnosis}</p></div>)}</>}<Link className={secondary} href={`/conversations/${r.conversationId}`} target="_blank">{t('مشاهده گفتگو', 'Open conversation')}</Link></article>)}{!reviews.length && <p role="status">{t('در حال دریافت نتیجه‌ها…', 'Loading results…')}</p>}<Pagination page={reviewPage} total={reviewTotal} setPage={setReviewPage} fa={fa} /></DetailDialog>}
  </div>
}

function Pagination({ page, total, setPage, fa }: { page: number; total: number; setPage: (p: number) => void; fa: boolean }) {
  if (total <= 25) return null
  return <div className="flex items-center justify-between gap-3"><button className={secondary} disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronRight className="h-4 w-4 ltr:rotate-180" />{fa ? 'قبلی' : 'Previous'}</button><span className="text-xs">{page.toLocaleString(fa ? 'fa-IR' : 'en-US')} / {Math.ceil(total / 25).toLocaleString(fa ? 'fa-IR' : 'en-US')}</span><button className={secondary} disabled={page * 25 >= total} onClick={() => setPage(page + 1)}>{fa ? 'بعدی' : 'Next'}<ChevronLeft className="h-4 w-4 ltr:rotate-180" /></button></div>
}

function SuggestionDetail({ item: s, agentId, fa, busy, error, act, onClose }: { item: Suggestion; agentId: string; fa: boolean; busy: string; error: string; act: Action; onClose: () => void }) {
  const t = (f: string, e: string) => fa ? f : e
  const [draft, setDraft] = useState<Draft>(() => draftSchema.parse(s.draft))
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftSchema.parse(s.draft))
  const preview = s.preview
  const pending = s.status === 'PENDING'
  const change = s.changes.find((c) => !c.revertedAt)
  const behaviorLabel = (v: unknown) => Array.isArray(v) ? v.join(' · ') : behaviorLabels[String(v)]?.[fa ? 0 : 1] ?? String(v ?? '')
  return <DetailDialog title={s.title} onClose={onClose} footer={<div className="space-y-2">{error && <p role="alert" className="text-sm leading-6 text-red-700">{error}</p>}{pending ? <div className="grid grid-cols-2 gap-2"><button className={secondary} disabled={!!busy || !dirty} onClick={() => void act({ action: 'save', id: s.id, version: s.version, draft })}>{t('ذخیرهٔ اصلاح', 'Save draft')}</button><button className={primary} disabled={!!busy || dirty || (s.kind !== 'TOOL' && !!draft.missing)} onClick={() => void act({ action: s.kind === 'TOOL' || preview ? 'apply' : 'preview', id: s.id, version: s.version })}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{s.kind === 'TOOL' ? t('ثبت رسیدگی دستی', 'Mark manually handled') : preview ? t('اعمال تغییر', 'Apply change') : t('تست پاسخ', 'Test response')}</button></div> : change && <button className={`${secondary} w-full`} disabled={!!busy} onClick={() => void act({ action: 'revert', id: change.id })}><RotateCcw className="h-4 w-4" />{t('بازگشت به قبل از این تغییر', 'Revert this change')}</button>}{dirty && <p className="text-xs text-[var(--text-secondary)]">{t('قبل از تست، اصلاح‌ها را ذخیره کنید.', 'Save edits before testing.')}</p>}</div>}>
    <span className="inline-block rounded-full bg-[var(--bg-muted)] px-3 py-1 text-xs">{t('دامنه: همهٔ مشتریان این ایجنت', 'Scope: all customers of this agent')}</span><p className="text-sm leading-8">{s.diagnosis}</p>
    {s.kind === 'KNOWLEDGE' && <div className="space-y-4"><label className="block space-y-2 text-sm"><span>{t('سؤال یا موضوع دانش', 'Knowledge question')}</span><textarea className={field} rows={2} maxLength={2000} disabled={!pending} value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} /></label>{draft.missing && <p className="rounded-xl bg-amber-50 p-3 text-sm leading-7 text-amber-900">{draft.missing}</p>}<label className="block space-y-2 text-sm"><span>{t('پاسخ معتبر کسب‌وکار', 'Verified business answer')}</span><textarea className={`${field} leading-8`} rows={7} maxLength={8000} disabled={!pending} value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} /></label>{pending && !!draft.missing && <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-black" disabled={draft.answer.trim().length < 3} onChange={() => setDraft({ ...draft, missing: '' })} />{t('اطلاعات لازم را در پاسخ تکمیل کردم.', 'I completed the required facts in the answer.')}</label>}{draft.targetKnowledgeId && <p className="text-xs leading-6">{t('این تغییر، پاسخ موجود را به‌روزرسانی می‌کند.', 'This updates an existing knowledge answer.')}</p>}</div>}
    {s.kind === 'BEHAVIOR' && draft.behaviorPath && <div className={`${surface} space-y-3`}><h3 className="font-semibold">{behaviorLabel(draft.behaviorPath)}</h3><p className="text-sm">{t('مقدار فعلی در زمان تحلیل: ', 'Value at analysis time: ')}{Array.isArray(draft.baseline) ? t(`${draft.baseline.length} دستور موجود حفظ می‌شود.`, `${draft.baseline.length} existing instructions are preserved.`) : behaviorLabel(draft.baseline)}</p><label className="block space-y-2 text-sm"><span>{t('مقدار پیشنهادی', 'Proposed value')}</span>{draft.behaviorPath === 'doSay' ? <textarea className={`${field} leading-8`} rows={4} maxLength={500} disabled={!pending} value={String(draft.behaviorValue ?? '')} onChange={(e) => setDraft({ ...draft, behaviorValue: e.target.value })} /> : <select disabled={!pending} className={field} value={String(draft.behaviorValue)} onChange={(e) => setDraft({ ...draft, behaviorValue: e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value })}>{behaviorValues[draft.behaviorPath].map((v) => <option key={String(v)} value={String(v)}>{behaviorLabel(v)}</option>)}</select>}</label></div>}
    {s.kind === 'TOOL' && <div className="space-y-3"><p className="text-sm leading-7">{draft.missing || t('این مورد نیاز به رسیدگی در تنظیمات یا منبع اصلی دارد. پس از اصلاح، رسیدگی را ثبت کنید.', 'Handle this in the source or settings, then record completion.')}</p><label className="block space-y-2 text-sm"><span>{t('یادداشت رسیدگی', 'Resolution note')}</span><textarea className={field} rows={3} value={draft.answer} disabled={!pending} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} /></label><div className="flex flex-wrap gap-2"><Link target="_blank" className={secondary} href={`/agents/${agentId}/improve?tab=knowledge`}>{t('دانش ایجنت', 'Knowledge')}</Link><Link target="_blank" className={secondary} href={`/agents/${agentId}/settings`}>{t('تنظیمات ایجنت', 'Agent settings')}</Link></div></div>}
    {!!s.evidence.length && <details className="rounded-xl border p-3"><summary className="min-h-9 cursor-pointer text-sm font-semibold">{t('نمونهٔ شواهد از گفتگوها', 'Conversation evidence sample')} ({s.evidence.length.toLocaleString(fa ? 'fa-IR' : 'en-US')})</summary><div className="mt-3 space-y-3">{s.evidence.map((e, i) => <div key={`${e.messageId}-${i}`} className="border-t pt-3"><blockquote dir="auto" className="whitespace-pre-wrap break-words text-sm leading-7">{e.message.content}</blockquote><Link target="_blank" className="mt-2 inline-flex min-h-11 items-center text-sm underline" href={`/conversations/${e.review.conversationId}`}>{t('باز کردن گفتگوی مرجع', 'Open source conversation')}</Link></div>)}</div></details>}
    {preview && <section className="space-y-3"><h3 className="font-bold">{t('مقایسهٔ پاسخ', 'Response comparison')}</h3><p className="text-xs leading-6 text-[var(--text-secondary)]">{t('آزمایش با دانش و تنظیمات فعلی و حداکثر ۴۰ پیام قبل از سؤال انجام شده؛ پیام‌های بعدی و ابزارهای زندهٔ سفارش و محصول وارد تست نمی‌شوند. این پاسخ برای مشتری ارسال نشده است.', 'Tested with current knowledge and settings and up to 40 prior messages. Later messages and live order/product tools are excluded. No response was sent to the customer.')}</p><blockquote className="rounded-xl bg-[var(--bg-muted)] p-3 text-sm leading-7">{preview.question}</blockquote>{preview.historical && <details className="rounded-xl border p-3"><summary className="min-h-9 cursor-pointer text-sm">{t('پاسخ ثبت‌شده در گفتگوی اصلی', 'Actual historical reply')}</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{preview.historical}</p></details>}<div className="grid gap-3 sm:grid-cols-2">{[[t('بدون تغییر پیشنهادی', 'Without proposed change'), preview.baseline], [t('با تغییر پیشنهادی', 'With proposed change'), preview.proposed]].map(([title, value]) => <div key={title} className={surface}><h4 className="text-sm font-bold">{title}</h4><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-8">{value}</p></div>)}</div>{preview.assessment && <p className="text-sm leading-7">{t('ارزیابی آزمایشی: ', 'Test assessment: ')}{preview.assessment.reason}</p>}{pending && <button className={secondary} disabled={!!busy || dirty} onClick={() => void act({ action: 'preview', id: s.id, version: s.version })}>{t('تست دوباره', 'Test again')}</button>}</section>}
    {s.knowledgeStatus && <div className={`${surface} space-y-2`}><p className="text-sm">{statusLabels[s.knowledgeStatus]?.[fa ? 0 : 1] ?? s.knowledgeStatus}</p>{s.knowledgeStatus === 'ERROR' && change && <button className={secondary} disabled={!!busy} onClick={() => void act({ action: 'ingest', id: change.id })}>{t('تلاش مجدد آماده‌سازی دانش', 'Retry knowledge preparation')}</button>}</div>}
    {s.monitoring && <section className={`${surface} space-y-2`}><h3 className="text-sm font-bold">{t('پیگیری پس از تغییر', 'Follow-up after the change')}</h3><p className="text-sm leading-7">{s.monitoring.reviewed ? t(`از ${s.monitoring.reviewed.toLocaleString('fa-IR')} گفتگوی بررسی‌شده پس از تغییر، این مشکل در ${s.monitoring.recurring.toLocaleString('fa-IR')} گفتگو دوباره دیده شده است.`, `Among ${s.monitoring.reviewed} conversations reviewed after the change, this issue recurred in ${s.monitoring.recurring}.`) : t('هنوز گفتگوی جدیدی پس از این تغییر تحلیل نشده است.', 'No new conversations have been analyzed since this change.')}</p><p className="text-xs leading-6 text-[var(--text-secondary)]">{t('این شمارش مربوط به نمونهٔ تحلیل‌شده است؛ به‌تنهایی اثبات رضایت مشتری یا اثر قطعی تغییر نیست.', 'These observations cover the reviewed sample; they do not establish satisfaction or causality.')}</p></section>}
    {!!s.changes.length && <details className="rounded-xl border p-3"><summary className="min-h-9 cursor-pointer text-sm">{t('سابقهٔ این تغییر', 'Change history')}</summary>{s.changes.map((c) => <div key={c.id} className="mt-3 space-y-2 text-sm"><p>{new Date(c.createdAt).toLocaleString(fa ? 'fa-IR' : 'en-US')} · {c.revertedAt ? t('بازگردانده شده', 'Reverted') : t('اعمال شده', 'Applied')}</p>{typeof c.before.answer === 'string' && <p className="whitespace-pre-wrap leading-7">{t('پاسخ قبلی: ', 'Previous answer: ')}{c.before.answer}</p>}</div>)}</details>}
    {pending && <button className={secondary} disabled={!!busy} onClick={async () => { if (await act({ action: 'dismiss', id: s.id, version: s.version })) onClose() }}><X className="h-4 w-4" />{t('کنار گذاشتن پیشنهاد', 'Dismiss suggestion')}</button>}
  </DetailDialog>
}

function AutomationDialog({ initial, fa, busy, error, act, onClose }: { initial: Settings; fa: boolean; busy: string; error: string; act: Action; onClose: () => void }) {
  const [settings, setSettings] = useState(initial)
  const t = (f: string, e: string) => fa ? f : e
  return <DetailDialog title={t('بهبود خودکار', 'Automatic improvement')} onClose={onClose} footer={<div className="space-y-2">{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button className={`${primary} w-full`} disabled={!!busy} onClick={async () => { if (await act({ action: 'settings', settings })) onClose() }}><Check className="h-4 w-4" />{t('ذخیره تنظیمات', 'Save settings')}</button></div>}>
    <label className="flex min-h-12 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-black" checked={settings.daily} onChange={(e) => setSettings({ ...settings, daily: e.target.checked })} />{t('تحلیل روزانهٔ گفتگوهای تازه', 'Analyze new conversations daily')}</label><p className="text-sm leading-7 text-[var(--text-secondary)]">{t('گفتگوهای تازه یا دارای پیام جدید بررسی می‌شوند؛ نتیجه‌ها در همین بخش می‌آیند. این گزینه مصرف تحلیل دارد.', 'New or updated conversations are reviewed and results appear here. This uses analysis tokens.')}</p>
    {settings.daily && <label className="block space-y-2 text-sm"><span>{t('حداکثر گفتگو در هر روز', 'Daily conversation limit')}</span><input className={field} type="number" min={1} max={100} value={settings.count} onChange={(e) => setSettings({ ...settings, count: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} /></label>}
    <label className="flex min-h-12 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-black" checked={settings.autoBehavior} onChange={(e) => setSettings({ ...settings, autoBehavior: e.target.checked })} />{t('اعمال خودکار تغییرهای رفتاری مجاز', 'Automatically apply allowed behavior changes')}</label><p className="text-sm leading-7 text-[var(--text-secondary)]">{t('فقط تنظیم‌های انتخاب‌شده، با شواهد حداقل ۳ گفتگو و ارزیابی آزمایشی مثبت اعمال می‌شوند. افزودن واقعیت کسب‌وکار و تغییر ابزارها نیاز به بررسی شما دارد. سابقه و بازگشت همیشه در دسترس است.', 'Only selected settings with evidence from at least 3 conversations and a positive test assessment are applied. Business facts and tools require your review. Changes can be inspected and reverted.')}</p>
    {settings.autoBehavior && (['format.length', 'conversation.avoidRepeatedGreetings'] as const).map((path) => <label key={path} className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5 accent-black" checked={settings.allowedPaths.includes(path)} onChange={(e) => setSettings({ ...settings, allowedPaths: e.target.checked ? [...settings.allowedPaths, path] : settings.allowedPaths.filter((p) => p !== path) })} />{behaviorLabels[path][fa ? 0 : 1]}</label>)}
  </DetailDialog>
}
