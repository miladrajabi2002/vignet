'use client'

import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { Loader2, X, Plus, Bot, Shield, GitBranch } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  type Automation,
  type AutomationType,
  type MatchMode,
  type StoryScope,
  type ReplyMode,
  type GateMode,
  type AutomationTrigger,
  type AutomationAction,
  MATCH_MODE_LABEL,
  STORY_SCOPE_LABEL,
  REPLY_MODE_LABEL,
  GATE_MODE_LABEL,
} from '@/components/instagram/types'

// ── Internal flat form state (assembled into trigger/action on submit) ────
interface FormState {
  name: string
  active: boolean
  priority: number
  matchMode: MatchMode
  storyScope: StoryScope
  postIdsText: string
  replyMode: ReplyMode
  replyText: string
  dmOnComment: boolean
  followGate: boolean
  gateMode: GateMode
  gatePrompt: string
  gateConfirmKeyword: string
  gateQuickReply: string
  contentText: string
}

function toFormState(a?: Automation): FormState {
  if (!a) {
    return {
      name: '',
      active: true,
      priority: 0,
      matchMode: 'CONTAINS',
      storyScope: 'KEYWORD',
      postIdsText: '',
      replyMode: 'STATIC',
      replyText: '',
      dmOnComment: false,
      followGate: false,
      gateMode: 'SOFT',
      gatePrompt: '',
      gateConfirmKeyword: '',
      gateQuickReply: '',
      contentText: '',
    }
  }
  const tr = a.trigger
  const ac = a.action
  return {
    name: a.name,
    active: a.active,
    priority: a.priority,
    matchMode: tr.matchMode ?? 'CONTAINS',
    storyScope: tr.storyScope ?? 'KEYWORD',
    postIdsText: (tr.postIds ?? []).join(', '),
    replyMode: ac.replyMode ?? 'STATIC',
    replyText: ac.replyText ?? '',
    dmOnComment: ac.dmOnComment ?? false,
    followGate: ac.followGate ?? false,
    gateMode: ac.gateMode ?? 'SOFT',
    gatePrompt: ac.gatePrompt ?? '',
    gateConfirmKeyword: ac.gateConfirmKeyword ?? '',
    gateQuickReply: ac.gateQuickReply ?? '',
    contentText: ac.contentText ?? '',
  }
}

/** Parse comma/Enter-separated tag input into a clean string list. */
function splitTags(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function AutomationForm({
  agentId,
  type,
  initial,
  mode,
  onClose,
  onSaved,
}: {
  agentId: string
  /** Type is fixed per-tab; the form never switches it. */
  type: AutomationType
  initial?: Automation
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved: (a: Automation) => void
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial))
  const [keywords, setKeywords] = useState<string[]>(() => initial?.trigger.keywords ?? [])
  const [keywordInput, setKeywordInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Auto-focus the name field on open.
  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  // Close on Escape.
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  // Lock body scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  function addKeyword(raw: string) {
    // Allow pasting "a, b, c" — split on comma/newline and add each piece.
    const pieces = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (pieces.length === 0) return
    setKeywords((arr) => {
      const next = arr.slice()
      for (const p of pieces) {
        if (!next.some((k) => k === p)) next.push(p)
      }
      return next
    })
    setKeywordInput('')
  }

  function onKeywordKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      // addKeyword splits on comma internally, so pasting "a, b, c" + Enter works.
      addKeyword(keywordInput)
    } else if (e.key === 'Backspace' && keywordInput === '' && keywords.length > 0) {
      setKeywords((arr) => arr.slice(0, -1))
    }
  }

  function buildPayload(): {
    trigger: AutomationTrigger
    action: AutomationAction
  } {
    const postIds =
      type === 'COMMENT' ? splitTags(form.postIdsText) : []

    const trigger: AutomationTrigger = {
      keywords,
      matchMode: form.matchMode,
      storyScope: type === 'STORY' ? form.storyScope : 'KEYWORD',
      postIds,
    }

    const useDmOnComment = type === 'COMMENT' ? form.dmOnComment : false
    const action: AutomationAction = {
      replyMode: form.replyMode,
      replyText: form.replyMode === 'STATIC' ? form.replyText : '',
      dmOnComment: useDmOnComment,
      followGate: form.followGate,
      gateMode: form.gateMode,
      gatePrompt: form.followGate ? form.gatePrompt : '',
      gateConfirmKeyword: form.followGate ? form.gateConfirmKeyword : '',
      gateQuickReply: form.followGate ? form.gateQuickReply : '',
      contentText: form.followGate || useDmOnComment ? form.contentText : '',
      aiAgentEnabled: form.replyMode === 'AI',
    }

    return { trigger, action }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('نام سناریو را وارد کنید.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { trigger, action } = buildPayload()
      const base = `/api/agents/${agentId}/instagram/automations`
      if (mode === 'create') {
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            name: form.name.trim(),
            active: form.active,
            priority: form.priority,
            trigger,
            action,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.automation) {
          setError(data?.error === 'IG_NOT_CONNECTED' ? 'اینستاگرام متصل نیست.' : 'ذخیره ناموفق بود.')
          return
        }
        onSaved(data.automation as Automation)
      } else if (initial) {
        const res = await fetch(`${base}/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            active: form.active,
            priority: form.priority,
            trigger,
            action,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.automation) {
          setError('ذخیره ناموفق بود.')
          return
        }
        onSaved(data.automation as Automation)
      }
    } finally {
      setBusy(false)
    }
  }

  // ── Derived flags for conditional rendering ───────────────────────────
  const isComment = type === 'COMMENT'
  const isStory = type === 'STORY'
  const showContentText = form.followGate || (isComment && form.dmOnComment)
  const contentTextLabel = form.followGate
    ? 'محتوای نهایی (پس از تکمیل دروازه)'
    : 'متن دایرکت (به کامنت‌گذار)'
  const contentTextHint = form.followGate
    ? 'این محتوا پس از آنکه کاربر دروازه فالو را تکمیل کرد، برایش ارسال می‌شود.'
    : 'این متن به‌صورت دایرکت برای کاربری که کامنت گذاشته ارسال می‌شود.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'افزودن سناریو' : 'ویرایش سناریو'}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
        aria-hidden
      />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-[var(--border-default)] bg-[var(--bg-base)] shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-base font-medium text-[var(--text-primary)]">
              {mode === 'create' ? 'افزودن سناریو' : 'ویرایش سناریو'}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {type === 'DIRECT_MESSAGE' && 'پاسخ خودکار به پیام‌های مستقیم'}
              {type === 'COMMENT' && 'پاسخ خودکار به کامنت پست‌ها'}
              {type === 'STORY' && 'پاسخ خودکار به استوری‌ها'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {/* Common: name + active */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                نام سناریو
              </label>
              <input
                ref={nameRef}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="مثلاً پاسخ به سؤال قیمت"
                maxLength={120}
                className="input"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">فعال</p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  سناریوهای غیرفعال اجرا نمی‌شوند.
                </p>
              </div>
              <Switch
                checked={form.active}
                onChange={(v) => set('active', v)}
                aria-label="فعال بودن سناریو"
              />
            </div>

            {/* Keywords */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                کلمه‌کلیدی‌ها
              </label>
              <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-2 focus-within:border-[var(--border-strong)]">
                {keywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-primary)]"
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() => setKeywords((arr) => arr.filter((x) => x !== k))}
                      className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                      aria-label={`حذف ${k}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={onKeywordKeyDown}
                  onBlur={() => addKeyword(keywordInput)}
                  placeholder={keywords.length ? '' : 'کلمه را بنویس و Enter بزن…'}
                  className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-hint)]"
                />
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                با Enter یا کاما اضافه کنید. خالی بگذارید تا روی همه پیام‌ها اعمال شود.
              </p>
            </div>

            {/* Match mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                نحوه تطبیق کلمه‌کلیدی
              </label>
              <select
                value={form.matchMode}
                onChange={(e) => set('matchMode', e.target.value as MatchMode)}
                className="input"
              >
                {(Object.keys(MATCH_MODE_LABEL) as MatchMode[]).map((m) => (
                  <option key={m} value={m}>
                    {MATCH_MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>

            {/* Type-specific trigger fields */}
            {isComment && (
              <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      ارسال دایرکت به کامنت‌گذار
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                      علاوه بر پاسخ عمومی به کامنت، یک پیام خصوصی هم به کاربر بفرست.
                    </p>
                  </div>
                  <Switch
                    checked={form.dmOnComment}
                    onChange={(v) => set('dmOnComment', v)}
                    aria-label="ارسال دایرکت به کامنت‌گذار"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    شناسه پست‌ها (اختیاری)
                  </label>
                  <input
                    dir="ltr"
                    value={form.postIdsText}
                    onChange={(e) => set('postIdsText', e.target.value)}
                    placeholder="178414… , 178414…"
                    className="input"
                  />
                  <p className="text-[11px] text-[var(--text-muted)]">
                    با کاما جدا کنید. خالی = همه پست‌ها.
                  </p>
                </div>
              </div>
            )}

            {isStory && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  محدوده استوری
                </label>
                <select
                  value={form.storyScope}
                  onChange={(e) => set('storyScope', e.target.value as StoryScope)}
                  className="input"
                >
                  {(Object.keys(STORY_SCOPE_LABEL) as StoryScope[]).map((s) => (
                    <option key={s} value={s}>
                      {STORY_SCOPE_LABEL[s]}
                    </option>
                  ))}
                </select>
                {form.storyScope === 'ALL' && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    به هر استوری که پیج شما را منشن کند یا ریپلای بزند، پاسخ داده می‌شود.
                  </p>
                )}
              </div>
            )}

            {/* Action section divider */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                پاسخ
              </span>
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                نوع پاسخ
              </label>
              <select
                value={form.replyMode}
                onChange={(e) => set('replyMode', e.target.value as ReplyMode)}
                className="input"
              >
                {(Object.keys(REPLY_MODE_LABEL) as ReplyMode[]).map((m) => (
                  <option key={m} value={m}>
                    {REPLY_MODE_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>

            {form.replyMode === 'STATIC' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  {isComment ? 'متن پاسخ عمومی (به کامنت)' : 'متن پاسخ'}
                </label>
                <textarea
                  value={form.replyText}
                  onChange={(e) => set('replyText', e.target.value)}
                  placeholder="مثلاً سلام! برای مشاهده قیمت‌ها به دایرکت مراجعه کنید."
                  rows={3}
                  className="input resize-none"
                />
              </div>
            )}

            {form.replyMode === 'AI' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  پاسخ توسط ایجنت هوش مصنوعی این پیج داده می‌شود. ایجنت بر اساس دانش،
                  شخصیت و کاتالوگ تنظیم‌شده، پاسخی طبیعی و متناسب تولید می‌کند.
                </p>
              </div>
            )}

            {form.replyMode === 'FLOW' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3.5">
                <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  پاسخ بر اساس فلو طراحی‌شده در «طراحی گفتگو» داده می‌شود.
                </p>
              </div>
            )}

            {/* DM content for comment funnel (only when no follow gate owns contentText) */}
            {isComment && form.dmOnComment && !form.followGate && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  {contentTextLabel}
                </label>
                <textarea
                  value={form.contentText}
                  onChange={(e) => set('contentText', e.target.value)}
                  placeholder="متن دایرکتی که برای کامنت‌گذار ارسال می‌شود."
                  rows={3}
                  className="input resize-none"
                />
                <p className="text-[11px] text-[var(--text-muted)]">{contentTextHint}</p>
              </div>
            )}

            {/* Follow gate */}
            <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      دروازه فالو
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                      کاربر باید پیج را فالو کند تا محتوا را دریافت کند.
                    </p>
                  </div>
                </div>
                <Switch
                  checked={form.followGate}
                  onChange={(v) => set('followGate', v)}
                  aria-label="دروازه فالو"
                />
              </div>

              {form.followGate && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      نوع دروازه
                    </label>
                    <select
                      value={form.gateMode}
                      onChange={(e) => set('gateMode', e.target.value as GateMode)}
                      className="input"
                    >
                      {(Object.keys(GATE_MODE_LABEL) as GateMode[]).map((g) => (
                        <option key={g} value={g}>
                          {GATE_MODE_LABEL[g]}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                      {form.gateMode === 'SOFT'
                        ? 'نرم: کاربر کلمه تأیید را می‌فرستد و محتوا دریافت می‌کند (اعتماد).'
                        : 'سخت: کاربر باید پیج را در یک استوری منشن کند؛ تأیید خودکار از طریق وب‌هوک.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-secondary)]">
                      پیام دروازه
                    </label>
                    <textarea
                      value={form.gatePrompt}
                      onChange={(e) => set('gatePrompt', e.target.value)}
                      placeholder="مثلاً برای دریافت لینک، پیج را فالو کنید و «فالو کردم» را بفرستید."
                      rows={3}
                      className="input resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">
                        کلمه تأیید
                      </label>
                      <input
                        value={form.gateConfirmKeyword}
                        onChange={(e) => set('gateConfirmKeyword', e.target.value)}
                        placeholder="فالو کردم"
                        className="input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">
                        دکمه سریع
                      </label>
                      <input
                        value={form.gateQuickReply}
                        onChange={(e) => set('gateQuickReply', e.target.value)}
                        placeholder="فالو کردم"
                        className="input"
                      />
                    </div>
                  </div>

                  {showContentText && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">
                        {contentTextLabel}
                      </label>
                      <textarea
                        value={form.contentText}
                        onChange={(e) => set('contentText', e.target.value)}
                        placeholder="محتوایی که پس از تکمیل دروازه ارسال می‌شود."
                        rows={3}
                        className="input resize-none"
                      />
                      <p className="text-[11px] text-[var(--text-muted)]">{contentTextHint}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={busy || !form.name.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-4 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {mode === 'create' ? 'افزودن' : 'ذخیره'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
