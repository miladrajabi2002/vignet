'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { BookOpenCheck, Check, Clock3, GraduationCap, Loader2, LockKeyhole, MessageSquare, Sparkles, X, Pencil } from 'lucide-react'
import type { LearningQueueItem } from '@/lib/ai/learning-candidates'
import { ImprovementIntro } from '@/components/agents/improvement-intro'
import { useLearningCount } from '@/components/agents/learning-count'

export type LearningItem = LearningQueueItem
export interface ApprovedLearningItem {
  id: string
  question: string
  answer: string
  verifiedAt: string
  version: number
  conversationId: string | null
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'ERROR'
  expired: boolean
}
const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--border-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 disabled:cursor-not-allowed disabled:opacity-50'
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-black px-5 text-xs font-bold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40'

export function LearningCenter({ agentId, initial, initialLearnedCount, approved, unanalyzedCount, excludedCount, initialView }: {
  agentId: string
  initial: LearningItem[]
  initialLearnedCount: number
  approved: ApprovedLearningItem[]
  unanalyzedCount: number
  excludedCount: number
  initialView: 'pending' | 'approved'
}) {
  const t = useTranslations('learning')
  const locale = useLocale()
  const router = useRouter()
  const setLearningCount = useLearningCount()?.setCount
  const [items, setItems] = useState(initial)
  const [analyzing, setAnalyzing] = useState(false)
  const [counts, setCounts] = useState({ unanalyzedCount, excludedCount })
  const analysisButton = useRef<HTMLButtonElement>(null)
  const analysisBusy = analyzing
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  useEffect(() => setItems(initial), [initial])
  useEffect(() => setCounts({ unanalyzedCount, excludedCount }), [unanalyzedCount, excludedCount])
  useEffect(() => setLearningCount?.(items.length), [items.length, setLearningCount])
  useEffect(() => {
    if (!approved.some((item) => item.status === 'PENDING' || item.status === 'PROCESSING')) return
    const timer = setInterval(() => router.refresh(), 4000)
    return () => clearInterval(timer)
  }, [approved, router])

  async function refreshQueue() {
    const res = await fetch(`/api/agents/${agentId}/learning`, { cache: 'no-store' })
    if (!res.ok) throw new Error('QUEUE_UNAVAILABLE')
    const queue = await res.json() as { items: LearningItem[]; unanalyzedCount: number; excludedCount: number }
    setItems(queue.items)
    setCounts({ unanalyzedCount: queue.unanalyzedCount, excludedCount: queue.excludedCount })
  }

  async function analyze() {
    if (analysisBusy) return
    setAnalyzing(true); setError(''); setNotice('')
    try {
      const res = await fetch(`/api/agents/${agentId}/learning/analyze`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error === 'AI_UNAVAILABLE' ? t('noKey') : t('error')); return }
      // Refresh only the queue so unlocking cards never waits on unrelated
      // server panels, and unfinished edits in the other tabs stay intact.
      await refreshQueue()
      setNotice(t('analysisDone', { count: data.reviewed, remaining: data.remaining }))
    } catch { setError(t('error')) } finally { setAnalyzing(false) }
  }

  async function resolve(id: string, outcome: 'approved' | 'dismissed', queued = false) {
    setItems((current) => current.filter((item) => item.id !== id))
    setNotice(queued ? t('queuedError') : t(outcome === 'approved' ? 'approved' : 'dismissed'))
    try { await refreshQueue() } catch { setError(t('error')) }
    if (outcome === 'approved') router.refresh()
  }

  return (
    <div className="space-y-5">
      <ImprovementIntro section="learning" title={t('title')} description={t('subtitle')}>
        <ol className="grid gap-2 sm:grid-cols-3" aria-label={t('howTitle')}>
          {(['stepAnalyze', 'stepReview', 'stepApprove'] as const).map((step, index) => <li key={step} className="flex items-center gap-2 rounded-xl bg-[var(--bg-muted)] px-3 py-3 text-xs font-semibold leading-6">
            <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black text-white">{(index + 1).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>{t(step)}
          </li>)}
        </ol>
        {counts.unanalyzedCount > 0 && <p id="learning-analysis-required" className="text-sm font-semibold leading-7">{t('analysisRequired')}</p>}
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
          <button ref={analysisButton} type="button" onClick={analyze} disabled={analysisBusy || counts.unanalyzedCount === 0} aria-describedby="learning-analysis-cost learning-analysis-hint" className={primary}>
            {analysisBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" /> : <Sparkles className="h-4 w-4 shrink-0" />}
            {analysisBusy ? t('analyzing') : counts.unanalyzedCount === 0 ? t('analysisUpToDate') : t('analyze', { count: counts.unanalyzedCount })}
          </button>
          <Link className={secondary} href={`/agents/${agentId}/improve?tab=knowledge`}>{t('knowledgeLink')}</Link>
        </div>
        <p id="learning-analysis-cost" className="text-xs leading-6 text-[var(--text-secondary)]">{t('analysisCost')}</p>
        <p id="learning-analysis-hint" className="text-xs leading-6 text-[var(--text-secondary)]">{t('analysisHint')}</p>
        {counts.excludedCount > 0 && <p className="text-xs leading-6 text-[var(--text-secondary)]">{t('excludedCount', { count: counts.excludedCount })}</p>}
      </ImprovementIntro>
      {notice && <p role="status" className="rounded-xl bg-black/[0.025] p-3 text-sm leading-6">{notice}</p>}
      {error && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{error}</p>}
      <nav className="grid grid-cols-2 gap-1 rounded-2xl bg-black/[0.035] p-1" aria-label={t('summaryLabel')}>
        {(['pending', 'approved'] as const).map((view) => {
          const active = view === initialView
          const Icon = view === 'pending' ? Clock3 : BookOpenCheck
          return <Link key={view} href={`/agents/${agentId}/improve?tab=learning&view=${view}`} aria-current={active ? 'page' : undefined} className={`flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border px-2 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/70 ${active ? 'border-black/[0.065] bg-white shadow-sm' : 'border-transparent text-[var(--text-secondary)]'}`}>
            <Icon className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
            <span className="text-xs font-semibold">{t(view === 'pending' ? 'pending' : 'approvedTab')}</span>
            <span className="rounded-md bg-black/[0.045] px-1.5 py-0.5 text-xs font-semibold tabular-nums">{(view === 'pending' ? items.length : initialLearnedCount).toLocaleString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
          </Link>
        })}
      </nav>
      {initialView === 'approved' ? (
        <section className="space-y-4">
          <p className="text-sm leading-7 text-[var(--text-secondary)]">{t('approvedHint')}</p>
          {approved.length ? approved.map((item) => <ApprovedCard key={`${item.id}-${item.version}`} agentId={agentId} item={item} />) : <EmptyState title={t('approvedEmpty')} hint={t('approvedEmptyHint')} />}
        </section>
      ) : items.length ? (
        <section className="space-y-4" aria-label={t('reviewTitle')}>
          <p className="text-sm leading-7 text-[var(--text-secondary)]">{t('reviewHint')}</p>
          {items.map((item) => <LearningCard key={`${item.id}-${item.analyzed}`} agentId={agentId} item={item} analysisBusy={analysisBusy} onAnalysisRequested={() => {
            analysisButton.current?.scrollIntoView({ block: 'center', behavior: 'instant' })
            analysisButton.current?.focus({ preventScroll: true })
          }} onResolved={(outcome, queued) => resolve(item.id, outcome, queued)} />)}
        </section>
      ) : <EmptyState title={t('empty')} hint={t('emptyHint')} />}
    </div>
  )
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return <div className="spatial-surface rounded-2xl p-8 text-center"><GraduationCap className="mx-auto h-7 w-7 text-[var(--text-muted)]" /><p className="mt-3 font-semibold">{title}</p><p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">{hint}</p></div>
}

function LearningCard({ agentId, item, onResolved, analysisBusy, onAnalysisRequested }: {
  agentId: string; item: LearningItem; analysisBusy: boolean
  onAnalysisRequested: () => void
  onResolved: (outcome: 'approved' | 'dismissed', queued?: boolean) => void
}) {
  const t = useTranslations('learning')
  const [question, setQuestion] = useState(item.question)
  const [answer, setAnswer] = useState(item.operatorAnswer ?? '')
  const [action, setAction] = useState<'suggest' | 'approve' | 'dismiss' | null>(null)
  const [error, setError] = useState('')
  const busy = !!action || analysisBusy
  async function run(next: 'suggest' | 'approve' | 'dismiss') {
    if (busy || (!item.analyzed && next !== 'dismiss')) return
    setAction(next); setError('')
    try {
      const res = await fetch(`/api/agents/${agentId}/learning${next === 'dismiss' ? '' : `/${next}`}`, {
        method: next === 'dismiss' ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: item.id, question: question.trim(), answer: answer.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (next === 'approve' && data.error === 'INGESTION_UNAVAILABLE' && data.kbId) { onResolved('approved', true); return }
      if (!res.ok) {
        setError(data.error === 'LEARNING_ANALYSIS_REQUIRED' ? t('analysisRequired') : data.error === 'LEARNING_CONTENT_NOT_ELIGIBLE' || data.error === 'LEARNING_SOURCE_NOT_ELIGIBLE' ? t('ineligible') : data.error === 'AI_UNAVAILABLE' || data.error === 'NO_CREDIT' ? t('noKey') : t('error'))
        return
      }
      if (next === 'suggest') setAnswer(data.answer ?? '')
      else onResolved(next === 'approve' ? 'approved' : 'dismissed')
    } catch { setError(t('error')) } finally { setAction(null) }
  }
  return (
    <article className="spatial-surface space-y-4 rounded-[1.5rem] p-4 sm:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold"><Sparkles className="h-4 w-4" />{t(item.analyzed ? 'intentDetected' : 'needsAnalysis')}</span>
        <Link href={`/conversations/${item.conversationId}`} className={secondary}><MessageSquare className="h-4 w-4" />{t('viewConversation')}</Link>
      </header>
      {!item.analyzed && <div className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] p-4">
        <p className="flex items-start gap-2 text-sm leading-7"><LockKeyhole className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />{t('analysisRequired')}</p>
        <button type="button" onClick={onAnalysisRequested} disabled={busy} className={`${secondary} w-full sm:w-auto`}>{t('goToAnalysis')}</button>
      </div>}
      {item.summary && <p className="break-words rounded-xl bg-black/[0.025] p-4 text-sm leading-7">{item.summary}</p>}
      <details className="rounded-xl bg-[var(--bg-muted)] px-4 py-2"><summary className="min-h-9 cursor-pointer py-2 text-xs font-semibold">{t('originalQuestion')}</summary><p className="whitespace-pre-wrap break-words py-2 text-sm leading-7">{item.originalQuestion}</p></details>
      {item.analyzed && <>
      <label className="block text-sm font-semibold" htmlFor={`learning-question-${item.id}`}>{t('intentLabel')}</label>
      <textarea id={`learning-question-${item.id}`} value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} maxLength={2000} disabled={busy} className="input resize-y text-base leading-7 sm:text-sm" />
      <p className="text-xs leading-6 text-[var(--text-muted)]">{t('intentHint')}</p>
      <label className="block text-sm font-semibold" htmlFor={`learning-answer-${item.id}`}>{t('answerLabel')}{item.operatorAnswer ? ` · ${t('fromOperator')}` : ''}</label>
      <textarea id={`learning-answer-${item.id}`} value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} maxLength={8000} disabled={busy} placeholder={t('answerPlaceholder')} className="input min-h-32 resize-y text-base leading-7 sm:text-sm" />
      </>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="grid gap-2 border-t border-[var(--border-default)] pt-4 sm:flex sm:flex-wrap">
        <button type="button" disabled={busy || !item.analyzed || question.trim().length < 3 || answer.trim().length < 3} onClick={() => run('approve')} className={primary}>{action === 'approve' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}{t(action === 'approve' ? 'approving' : 'approve')}</button>
        <button type="button" disabled={busy || !item.analyzed || question.trim().length < 3} onClick={() => run('suggest')} className={secondary}>{action === 'suggest' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Sparkles className="h-4 w-4" />}{t(action === 'suggest' ? 'suggesting' : 'suggest')}</button>
        <button type="button" disabled={busy} onClick={() => run('dismiss')} className={`${secondary} sm:ms-auto`}><X className="h-4 w-4" />{t(action === 'dismiss' ? 'dismissing' : 'dismiss')}</button>
      </div>
    </article>
  )
}

function ApprovedCard({ agentId, item }: { agentId: string; item: ApprovedLearningItem }) {
  const t = useTranslations('learning')
  const locale = useLocale()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [question, setQuestion] = useState(item.question)
  const [answer, setAnswer] = useState(item.answer)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/agents/${agentId}/learning/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, answer, version: item.version }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error === 'LEARNING_CONTENT_NOT_ELIGIBLE' ? t('ineligible') : data.error === 'VERSION_CONFLICT' ? t('versionConflict') : data.saved ? t('queuedError') : t('error')); if (data.saved) router.refresh(); return }
      setEditing(false); router.refresh()
    } catch { setError(t('error')) } finally { setBusy(false) }
  }
  return <article className="spatial-surface space-y-3 rounded-[1.5rem] p-5 sm:p-6">
    <header className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
      <BookOpenCheck className="h-4 w-4" /><span>{t(item.expired ? 'expired' : `status${item.status}`)}</span>
      <span className="ms-auto">{new Date(item.verifiedAt).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US')}</span>
    </header>
    {editing ? <>
      <label className="block text-sm font-semibold" htmlFor={`approved-q-${item.id}`}>{t('intentLabel')}</label>
      <textarea id={`approved-q-${item.id}`} className="input resize-y text-base leading-7 sm:text-sm" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} rows={2} disabled={busy} />
      <label className="block text-sm font-semibold" htmlFor={`approved-a-${item.id}`}>{t('answerLabel')}</label>
      <textarea id={`approved-a-${item.id}`} className="input resize-y text-base leading-7 sm:text-sm" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={8000} rows={4} disabled={busy} />
    </> : <><h3 className="text-sm font-bold leading-7">{item.question}</h3><p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--text-secondary)]">{item.answer}</p></>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <div className="grid gap-2 sm:flex sm:flex-wrap">
      {editing ? <><button type="button" disabled={busy || question.trim().length < 3 || answer.trim().length < 3} onClick={save} className={primary}>{busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Check className="h-4 w-4" />}{t('saveChanges')}</button><button type="button" disabled={busy} className={secondary} onClick={() => { setEditing(false); setQuestion(item.question); setAnswer(item.answer); setError('') }}>{t('cancel')}</button></> : <button type="button" onClick={() => setEditing(true)} className={secondary}><Pencil className="h-4 w-4" />{t('editApproved')}</button>}
      {!editing && item.status === 'ERROR' && <button type="button" disabled={busy} onClick={save} className={secondary}>{t('retryIngestion')}</button>}
      {item.conversationId && <Link href={`/conversations/${item.conversationId}`} className={secondary}>{t('viewConversation')}</Link>}
    </div>
  </article>
}
