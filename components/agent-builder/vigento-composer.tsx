'use client'

import { useState } from 'react'
import {
  ArrowLeftRight,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Loader2,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import type { VigentoDraft } from '@/lib/ai/vigento-draft'

export function VigentoComposer({
  locale,
  currentName,
  onApply,
}: {
  locale: 'fa' | 'en'
  currentName: string
  onApply: (draft: VigentoDraft) => void
}) {
  const isFa = locale === 'fa'
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<VigentoDraft | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [source, setSource] = useState<'ai' | 'fallback' | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [applied, setApplied] = useState(false)
  const [helpful, setHelpful] = useState<boolean | null>(null)

  async function generate() {
    if (description.trim().length < 20 || loading) return
    setLoading(true)
    setError(null)
    setApplied(false)
    try {
      const response = await fetch('/api/agents/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim(), language: locale }),
      })
      const data = await response.json() as {
        draft?: VigentoDraft
        runId?: string
        source?: 'ai' | 'fallback'
      }
      if (!response.ok || !data.draft || !data.runId) {
        setError(isFa ? 'ساخت پیش‌نویس انجام نشد؛ دوباره تلاش کنید.' : 'The draft could not be generated. Try again.')
        return
      }
      setDraft(data.draft)
      setRunId(data.runId)
      setSource(data.source ?? 'fallback')
      setExpanded(true)
    } catch {
      setError(isFa ? 'ارتباط با ویجنتو برقرار نشد.' : 'Could not reach Vigento.')
    } finally {
      setLoading(false)
    }
  }

  async function sendFeedback(value: boolean) {
    setHelpful(value)
    if (!runId) return
    await fetch(`/api/agents/draft/${runId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful: value }),
    }).catch(() => {})
  }

  async function apply() {
    if (!draft || !runId || applied) return
    // No configuration changes before this explicit user action.
    onApply(draft)
    setApplied(true)
    setHelpful(true)
    await fetch(`/api/agents/draft/${runId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applied: true, helpful: true }),
    }).catch(() => {})
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-violet-500/20 bg-[var(--bg-surface)] shadow-[0_16px_50px_-30px_rgba(139,92,246,0.65)]">
      <div className="relative p-5 sm:p-6">
        <div className="pointer-events-none absolute -end-20 -top-24 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Vigento AI | هوش مصنوعی ویجنتو</h2>
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400">
                {isFa ? 'دستیار ساخت ایجنت' : 'Agent-building copilot'}
              </span>
            </div>
            <p className="mt-1 max-w-xl text-xs leading-6 text-[var(--text-secondary)]">
              {isFa
                ? 'کسب‌وکارتان، هدف ایجنت و مرزهای پاسخ را بگویید. ویجنتو یک پیش‌نویس قابل بازبینی می‌سازد و تا تأیید شما هیچ چیزی را تغییر نمی‌دهد.'
                : 'Describe the business, goal, and reply boundaries. Vigento creates a reviewable draft and changes nothing until you approve.'}
            </p>
          </div>
        </div>

        <label className="relative mt-4 block">
          <span className="sr-only">{isFa ? 'شرح ایجنت موردنیاز' : 'Describe the agent you need'}</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={4000}
            placeholder={isFa
              ? 'مثلاً برای آموزشگاه زبان یک ایجنت می‌خواهم که سطح کاربر را بپرسد، دوره مناسب را از اطلاعات واقعی پیشنهاد دهد، لینک ثبت‌نام بفرستد و موارد پرداخت را به اپراتور تحویل دهد…'
              : 'For example: I need an agent for a language school that discovers level, recommends a verified course, shares enrollment links, and hands payment issues to an operator…'}
            className="w-full resize-y rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-3 text-sm leading-7 text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/10"
          />
        </label>
        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] text-[var(--text-muted)]">
            {description.trim().length.toLocaleString(isFa ? 'fa-IR' : 'en-US')} / 4000
          </span>
          <button
            type="button"
            onClick={generate}
            disabled={loading || description.trim().length < 20}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
            {loading ? (isFa ? 'در حال طراحی…' : 'Designing…') : (isFa ? 'ساخت پیش‌نویس' : 'Generate draft')}
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-danger" role="alert">{error}</p>}
      </div>

      {draft && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-base)]/50 p-5 sm:p-6">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-start"
            aria-expanded={expanded}
          >
            <span>
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                {isFa ? 'پیش‌نمایش تغییرات' : 'Review proposed changes'}
                {source === 'fallback' && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-500">
                    {isFa ? 'نسخه امن آفلاین' : 'Safe offline fallback'}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
                {currentName
                  ? `${currentName} → ${draft.name}`
                  : (isFa ? `ایجنت جدید: ${draft.name}` : `New agent: ${draft.name}`)}
              </span>
            </span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {expanded && (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <PreviewStat icon={<ArrowLeftRight className="h-4 w-4" />} label={isFa ? 'نقش' : 'Role'} value={draft.roleTemplate} />
                <PreviewStat icon={<ShieldCheck className="h-4 w-4" />} label={isFa ? 'قوانین ممنوع' : 'Guardrails'} value={String(draft.promptConfig.dontSay.length)} />
                <PreviewStat icon={<FlaskConical className="h-4 w-4" />} label={isFa ? 'تست آماده' : 'Ready tests'} value={String(draft.evalCases.length)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">{isFa ? 'منابع پیشنهادی RAG' : 'Suggested RAG sources'}</h3>
                  <ul className="mt-3 space-y-2">
                    {draft.knowledgePlan.map((item) => (
                      <li key={`${item.type}-${item.label}`} className="flex gap-2 text-xs text-[var(--text-secondary)]">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        <span><strong className="font-medium text-[var(--text-primary)]">{item.label}</strong><span className="block text-[10px] leading-5 text-[var(--text-muted)]">{item.reason}</span></span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                  <h3 className="text-xs font-semibold text-[var(--text-primary)]">{isFa ? 'سناریوهای ارزیابی' : 'Evaluation scenarios'}</h3>
                  <ul className="mt-3 space-y-2">
                    {draft.evalCases.map((item) => (
                      <li key={item.input} className="rounded-lg bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                        <span className="line-clamp-1 text-[var(--text-primary)]">{item.input}</span>
                        <span className="mt-1 block text-[10px] text-[var(--text-muted)]">{item.expectedBehavior}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                  <span>{isFa ? 'این پیش‌نویس مفید بود؟' : 'Was this draft useful?'}</span>
                  <button type="button" onClick={() => sendFeedback(true)} aria-label={isFa ? 'مفید بود' : 'Helpful'} className={`flex h-9 w-9 items-center justify-center rounded-lg ${helpful === true ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-[var(--bg-hover)]'}`}><ThumbsUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => sendFeedback(false)} aria-label={isFa ? 'مفید نبود' : 'Not helpful'} className={`flex h-9 w-9 items-center justify-center rounded-lg ${helpful === false ? 'bg-red-500/10 text-red-500' : 'hover:bg-[var(--bg-hover)]'}`}><ThumbsDown className="h-4 w-4" /></button>
                </div>
                <button
                  type="button"
                  onClick={apply}
                  disabled={applied}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  {applied ? (isFa ? 'روی فرم اعمال شد' : 'Applied to form') : (isFa ? 'تأیید و اعمال روی فرم' : 'Approve and apply')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function PreviewStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
      <span className="text-violet-400">{icon}</span>
      <span className="min-w-0"><span className="block text-[10px] text-[var(--text-muted)]">{label}</span><span className="block truncate text-xs font-medium text-[var(--text-primary)]">{value}</span></span>
    </div>
  )
}
