'use client'

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  Loader2,
  X,
  Plus,
  Bot,
  MessageCircle,
  MessageSquare,
  Circle,
  Send,
  Sparkles,
  ImagePlus,
  KeyRound,
  Tag,
  Search,
  ChevronDown,
  Zap,
  AlertCircle,
  Check,
  type LucideIcon,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { IphonePreview } from '@/components/instagram/iphone-preview'
import { VoiceRecorder } from '@/components/instagram/voice-recorder'
import { MediaUploader, type MediaItem } from '@/components/instagram/media-uploader'
import {
  type Automation,
  type AutomationType,
  type MatchMode,
  type StoryScope,
  type ReplyMode,
  type AutomationMessage,
  type MessageType,
  type AutomationTrigger,
  type AutomationAction,
  MATCH_MODE_LABEL,
  newMessageId,
} from '@/components/instagram/types'

// ── Internal flat form state ────────────────────────────────────────────
type PostFilter = 'ANY' | 'SPECIFIC'
type KeywordFilter = 'ANY' | 'SPECIFIC'
type DmMediaType = 'TEXT' | 'MEDIA' | 'QUICK_REPLY' | 'PRODUCT'
type MediaSubtype = 'IMAGE' | 'AUDIO' | 'VIDEO'

interface FormState {
  name: string
  active: boolean
  priority: number
  // Trigger
  keywords: string[]
  matchMode: MatchMode
  storyScope: StoryScope
  postFilter: PostFilter
  postIdsText: string
  keywordFilter: KeywordFilter
  // Action
  replyMode: ReplyMode
  messages: AutomationMessage[]
  // DM STATIC media type
  dmMediaType: DmMediaType
  mediaSubtype: MediaSubtype
  // Comment funnel
  dmOnComment: boolean
  // Story follow-up (per-automation)
  followUpEnabled: boolean
  followUpDelayMin: number
  followUpMessage: string
}

function toFormState(a: Automation | undefined, type: AutomationType): FormState {
  const base: FormState = {
    name: a?.name ?? '',
    active: a?.active ?? true,
    priority: a?.priority ?? 0,
    keywords: a?.trigger.keywords ?? [],
    matchMode: a?.trigger.matchMode ?? 'CONTAINS',
    storyScope: a?.trigger.storyScope ?? 'KEYWORD',
    postFilter: (a?.trigger.postIds?.length ?? 0) > 0 ? 'SPECIFIC' : 'ANY',
    postIdsText: (a?.trigger.postIds ?? []).join(', '),
    keywordFilter: (a?.trigger.keywords?.length ?? 0) > 0 ? 'SPECIFIC' : 'ANY',
    replyMode: a?.action.replyMode ?? defaultReplyMode(type),
    messages: a?.action.messages?.length
      ? a.action.messages.map(normalizeMessage)
      : [emptyTextMessage()],
    dmMediaType: pickDmMediaType(a?.action.messages?.[0]),
    mediaSubtype: pickMediaSubtype(a?.action.messages?.[0]),
    dmOnComment: a?.action.dmOnComment ?? false,
    followUpEnabled: a?.action.followUpEnabled ?? false,
    followUpDelayMin: a?.action.followUpDelayMin ?? 60,
    followUpMessage: a?.action.followUpMessage ?? '',
  }
  return base
}

function defaultReplyMode(type: AutomationType): ReplyMode {
  if (type === 'COMMENT') return 'MULTI_MESSAGE'
  return 'AI'
}

function emptyTextMessage(): AutomationMessage {
  return { id: newMessageId(), type: 'TEXT', text: '' }
}

function normalizeMessage(m: Partial<AutomationMessage>): AutomationMessage {
  return {
    id: m.id ?? newMessageId(),
    type: (m.type as MessageType) ?? 'TEXT',
    text: m.text ?? '',
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    productId: m.productId,
    quickReplies: Array.isArray(m.quickReplies) ? m.quickReplies.slice(0, 3) : [],
  }
}

function pickDmMediaType(m?: AutomationMessage): DmMediaType {
  if (!m) return 'TEXT'
  if (m.type === 'IMAGE' || m.type === 'AUDIO' || m.type === 'VIDEO') return 'MEDIA'
  if (m.type === 'PRODUCT') return 'PRODUCT'
  if (m.quickReplies && m.quickReplies.length > 0) return 'QUICK_REPLY'
  return 'TEXT'
}

function pickMediaSubtype(m?: AutomationMessage): MediaSubtype {
  if (m?.type === 'AUDIO') return 'AUDIO'
  if (m?.type === 'VIDEO') return 'VIDEO'
  return 'IMAGE'
}

// ── Public component ────────────────────────────────────────────────────
export function AutomationForm({
  agentId,
  channelId,
  accountUsername,
  accountAvatarUrl,
  type,
  initial,
  mode,
  onClose,
  onSaved,
}: {
  agentId: string
  channelId: string
  accountUsername: string
  accountAvatarUrl?: string
  type: AutomationType
  initial?: Automation
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved: (a: Automation) => void
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial, type))
  const [keywordInput, setKeywordInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // Auto-focus name on open.
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

  // ── Keyword tag input ─────────────────────────────────────────────────
  function addKeyword(raw: string) {
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

  function setKeywords(updater: (arr: string[]) => string[]) {
    setForm((f) => ({ ...f, keywords: updater(f.keywords) }))
  }

  function onKeywordKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addKeyword(keywordInput)
    } else if (e.key === 'Backspace' && keywordInput === '' && form.keywords.length > 0) {
      setKeywords((arr) => arr.slice(0, -1))
    }
  }

  // ── Messages manipulation (for STATIC / MULTI_MESSAGE) ───────────────
  function setFirstMessage(patch: Partial<AutomationMessage>) {
    setForm((f) => {
      const head = f.messages[0] ?? emptyTextMessage()
      const next: AutomationMessage = { ...head, ...patch }
      return { ...f, messages: [next, ...f.messages.slice(1)] }
    })
  }

  function addMultiMessage() {
    setForm((f) => ({
      ...f,
      messages: [...f.messages, emptyTextMessage()],
    }))
  }

  function updateMessage(id: string, patch: Partial<AutomationMessage>) {
    setForm((f) => ({
      ...f,
      messages: f.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))
  }

  function removeMessage(id: string) {
    setForm((f) => {
      if (f.messages.length <= 1) return f
      return { ...f, messages: f.messages.filter((m) => m.id !== id) }
    })
  }

  // ── Build payload ─────────────────────────────────────────────────────
  function buildPayload(): {
    trigger: AutomationTrigger
    action: AutomationAction
  } {
    // Trigger keywords — empty when filter = ANY (matches all messages).
    const effectiveKeywords =
      form.keywordFilter === 'SPECIFIC' ? form.keywords : []
    const effectivePostIds =
      type === 'COMMENT' && form.postFilter === 'SPECIFIC'
        ? splitTags(form.postIdsText)
        : []

    const trigger: AutomationTrigger = {
      keywords: effectiveKeywords,
      matchMode: form.matchMode,
      storyScope: type === 'STORY' ? form.storyScope : 'KEYWORD',
      postIds: effectivePostIds,
    }

    // Build action based on type + replyMode.
    let messages: AutomationMessage[] = []
    if (form.replyMode === 'STATIC' || form.replyMode === 'MULTI_MESSAGE') {
      if (type === 'DIRECT_MESSAGE') {
        // DM STATIC always has exactly one message.
        messages = [buildDmMessage()].filter((m) => m)
      } else if (type === 'STORY') {
        messages = [form.messages[0] ?? emptyTextMessage()]
      } else if (type === 'COMMENT' && form.replyMode === 'MULTI_MESSAGE') {
        messages = form.messages.filter((m) => m.text.trim() || m.mediaUrl)
      }
    }

    const action: AutomationAction = {
      replyMode: form.replyMode,
      messages,
      replyText: form.replyMode === 'STATIC' ? (form.messages[0]?.text ?? '') : '',
      dmOnComment: type === 'COMMENT' ? form.dmOnComment : false,
      followUpEnabled: type === 'STORY' ? form.followUpEnabled : false,
      followUpDelayMin: type === 'STORY' && form.followUpEnabled ? form.followUpDelayMin : undefined,
      followUpMessage: type === 'STORY' && form.followUpEnabled ? form.followUpMessage : undefined,
    }

    return { trigger, action }
  }

  /** Convert the DM form state into a single AutomationMessage. */
  function buildDmMessage(): AutomationMessage {
    const head = form.messages[0] ?? emptyTextMessage()
    if (form.dmMediaType === 'TEXT') {
      return { ...head, type: 'TEXT', quickReplies: head.quickReplies ?? [] }
    }
    if (form.dmMediaType === 'QUICK_REPLY') {
      return { ...head, type: 'TEXT', quickReplies: head.quickReplies ?? [] }
    }
    if (form.dmMediaType === 'PRODUCT') {
      return {
        ...head,
        type: 'PRODUCT',
        productId: head.productId,
        text: head.text,
      }
    }
    // MEDIA
    const t: MessageType = form.mediaSubtype
    return {
      ...head,
      type: t,
      mediaUrl: head.mediaUrl,
      mediaType: form.mediaSubtype,
      text: head.text,
      quickReplies: [],
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('نام سناریو را وارد کنید.')
      return
    }
    if (
      (form.keywordFilter === 'SPECIFIC' || type === 'DIRECT_MESSAGE') &&
      form.keywords.length === 0 &&
      form.keywordFilter === 'SPECIFIC'
    ) {
      setError('حداقل یک کلمه‌کلیدی اضافه کنید یا حالت «هر کلمه‌ای» را انتخاب کنید.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { trigger, action } = buildPayload()
      const base = `/api/agents/${agentId}/instagram/automations`
      const body = {
        type,
        name: form.name.trim(),
        active: form.active,
        priority: form.priority,
        trigger,
        action,
      }
      if (mode === 'create') {
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.automation) {
          setError(
            data?.error === 'IG_NOT_CONNECTED'
              ? 'اینستاگرام متصل نیست.'
              : 'ذخیره ناموفق بود.',
          )
          return
        }
        onSaved(data.automation as Automation)
      } else if (initial) {
        const res = await fetch(`${base}/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
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

  // ── Derived flags ─────────────────────────────────────────────────────
  const isDm = type === 'DIRECT_MESSAGE'
  const isComment = type === 'COMMENT'
  const isStory = type === 'STORY'

  // The preview needs the bot's message text and the user-side keyword.
  const previewUserText = form.keywords[0] ?? ''
  const previewMessages = useMemo<AutomationMessage[]>(() => {
    if (form.replyMode !== 'STATIC' && form.replyMode !== 'MULTI_MESSAGE') return []
    if (isComment && form.replyMode === 'MULTI_MESSAGE') {
      return form.messages.filter((m) => m.text.trim())
    }
    if (isDm) return [buildDmMessage()]
    return [form.messages[0] ?? emptyTextMessage()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isDm, isComment])

  const HeaderIcon: LucideIcon =
    type === 'DIRECT_MESSAGE' ? MessageCircle : type === 'COMMENT' ? MessageSquare : Circle

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'افزودن سناریو' : 'ویرایش سناریو'}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
        aria-hidden
      />
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-[var(--border-default)] bg-[var(--bg-base)] shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ background: 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)' }}
            >
              <HeaderIcon className="h-4 w-4" />
            </div>
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

        {/* Body — two-column on lg, stacked on mobile */}
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
            {/* ── LEFT: form fields ────────────────────────────────────── */}
            <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5 lg:border-e lg:border-[var(--border-subtle)]">
              {/* Scenario name */}
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

              {/* Active toggle */}
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

              {/* ─── Trigger section ─────────────────────────────────── */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  شرط اجرا
                </span>
                <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              </div>

              {/* COMMENT: post scope (any / specific) */}
              {isComment && (
                <SegmentedField
                  label="کدام پست‌ها؟"
                  value={form.postFilter}
                  onChange={(v) => set('postFilter', v as PostFilter)}
                  options={[
                    { value: 'ANY', label: 'هر پستی' },
                    { value: 'SPECIFIC', label: 'یک یا چند پست مشخص' },
                  ]}
                />
              )}
              {isComment && form.postFilter === 'SPECIFIC' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    شناسه پست‌ها
                  </label>
                  <input
                    dir="ltr"
                    value={form.postIdsText}
                    onChange={(e) => set('postIdsText', e.target.value)}
                    placeholder="178414… , 178414…"
                    className="input"
                  />
                  <p className="text-[11px] text-[var(--text-muted)]">
                    با کاما جدا کنید. شناسه عددی پست از URL اینستاگرام.
                  </p>
                </div>
              )}

              {/* STORY: scope (all / specific) */}
              {isStory && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    کدام استوری‌ها؟
                  </label>
                  <SegmentedField
                    value={form.storyScope}
                    onChange={(v) => set('storyScope', v as StoryScope)}
                    options={[
                      { value: 'ALL', label: 'همه استوری‌ها' },
                      { value: 'KEYWORD', label: 'کلمات خاص' },
                    ]}
                  />
                  {form.storyScope === 'ALL' && (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      به هر ریپلای یا منشن استوری پاسخ داده می‌شود.
                    </p>
                  )}
                </div>
              )}

              {/* Keyword filter (ANY / SPECIFIC) — for COMMENT and STORY (and DM, where empty = match all) */}
              {(isComment || isStory) && (
                <SegmentedField
                  label="کدام کلمات؟"
                  value={form.keywordFilter}
                  onChange={(v) => set('keywordFilter', v as KeywordFilter)}
                  options={[
                    { value: 'ANY', label: 'هر کلمه‌ای' },
                    { value: 'SPECIFIC', label: 'کلمات خاص' },
                  ]}
                />
              )}

              {/* Keywords tag input (for DM always; for COMMENT/STORY when SPECIFIC) */}
              {(isDm || form.keywordFilter === 'SPECIFIC') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    {isDm
                      ? 'کلمات کلیدی'
                      : 'کلمه‌کلیدی‌ها'}
                  </label>
                  <TagInput
                    tags={form.keywords}
                    onAdd={addKeyword}
                    onRemove={(k) => setKeywords((arr) => arr.filter((x) => x !== k))}
                    onInput={setKeywordInput}
                    inputValue={keywordInput}
                    onKeyDown={onKeywordKeyDown}
                    placeholder="کلمه را بنویس و Enter بزن…"
                  />
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {isDm
                      ? 'زمانی که کاربر کلمات زیر را در دایرکت ارسال کند، این سناریو اجرا می‌شود. خالی = همه پیام‌ها.'
                      : 'با Enter یا کاما اضافه کنید.'}
                  </p>
                </div>
              )}

              {/* Match mode (DM only — COMMENT/STORY use CONTAINS implicitly) */}
              {isDm && (
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
              )}

              {/* ─── Action section ──────────────────────────────────── */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  سپس
                </span>
                <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              </div>

              {/* Action selector — depends on type */}
              {isDm && (
                <DmActionSelector
                  value={form.replyMode}
                  onChange={(v) => set('replyMode', v)}
                />
              )}
              {isComment && (
                <CommentActionSelector
                  replyMode={form.replyMode}
                  dmOnComment={form.dmOnComment}
                  onReplyModeChange={(v) => set('replyMode', v)}
                  onDmOnCommentChange={(v) => set('dmOnComment', v)}
                />
              )}
              {isStory && (
                <StoryActionSelector
                  value={form.replyMode}
                  onChange={(v) => set('replyMode', v)}
                />
              )}

              {/* ─── DM STATIC: media type tabs ──────────────────────── */}
              {isDm && form.replyMode === 'STATIC' && (
                <DmStaticEditor
                  form={form}
                  set={set}
                  setFirstMessage={setFirstMessage}
                  channelId={channelId}
                />
              )}

              {/* ─── COMMENT MULTI_MESSAGE: list of reply options ─────── */}
              {isComment && form.replyMode === 'MULTI_MESSAGE' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    گزینه‌های پاسخ (یکی به‌صورت تصادفی ریپلای می‌شود)
                  </label>
                  {form.messages.map((m, idx) => (
                    <div key={m.id} className="flex items-start gap-2">
                      <div className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[11px] font-medium text-[var(--text-secondary)]">
                        {(idx + 1).toLocaleString('fa-IR')}
                      </div>
                      <textarea
                        value={m.text}
                        onChange={(e) => updateMessage(m.id, { text: e.target.value })}
                        placeholder="مثلاً سلام! لینک در دایرکت ارسال شد."
                        rows={2}
                        className="input resize-none"
                      />
                      {form.messages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMessage(m.id)}
                          className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--danger)]"
                          aria-label="حذف گزینه"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addMultiMessage}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    افزودن گزینه
                  </button>
                </div>
              )}

              {/* ─── COMMENT SEND_DM: DM content ─────────────────────── */}
              {isComment && form.dmOnComment && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    متن دایرکت (به کامنت‌گذار)
                  </label>
                  <textarea
                    value={form.messages[0]?.text ?? ''}
                    onChange={(e) =>
                      setFirstMessage({
                        type: 'TEXT',
                        text: e.target.value,
                      })
                    }
                    placeholder="متن دایرکتی که برای کامنت‌گذار ارسال می‌شود."
                    rows={3}
                    className="input resize-none"
                  />
                  <p className="text-[11px] text-[var(--text-muted)]">
                    کاربر پس از کامنت، این پیام را در دایرکت دریافت می‌کند.
                  </p>
                </div>
              )}

              {/* ─── STORY STATIC: reply text ────────────────────────── */}
              {isStory && form.replyMode === 'STATIC' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    متن پاسخ
                  </label>
                  <textarea
                    value={form.messages[0]?.text ?? ''}
                    onChange={(e) => setFirstMessage({ type: 'TEXT', text: e.target.value })}
                    placeholder="مثلاً ممنون از ریپلایت! برای دیدن محصول به لینک زیر برو."
                    rows={3}
                    className="input resize-none"
                  />
                </div>
              )}

              {/* ─── STORY: follow-up ────────────────────────────────── */}
              {isStory && (
                <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          پیام پیگیری
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                          یک پیام دوم، با تأخیر، پس از پاسخ اول ارسال می‌شود.
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={form.followUpEnabled}
                      onChange={(v) => set('followUpEnabled', v)}
                      aria-label="پیام پیگیری"
                    />
                  </div>
                  {form.followUpEnabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-[var(--text-secondary)]">
                            تأخیر (دقیقه)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={1440}
                            value={form.followUpDelayMin}
                            onChange={(e) =>
                              set('followUpDelayMin', Math.max(1, Number(e.target.value) || 1))
                            }
                            className="input"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                          متن پیام پیگیری
                        </label>
                        <textarea
                          value={form.followUpMessage}
                          onChange={(e) => set('followUpMessage', e.target.value)}
                          placeholder="مثلاً دیدی؟ سوالی بود در خدمتم."
                          rows={3}
                          className="input resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <p className="flex items-start gap-2 rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="leading-relaxed">{error}</span>
                </p>
              )}
            </div>

            {/* ── RIGHT: live iPhone preview ────────────────────────── */}
            <div className="hidden flex-col bg-[var(--bg-surface)] px-6 py-6 lg:flex">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[var(--text-secondary)]">پیش‌نمایش زنده</p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    همان لحظه در گوشی می‌بینید
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-base)] px-2 py-1 text-[10px] text-[var(--text-muted)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  زنده
                </div>
              </div>
              <div className="flex-1">
                <IphonePreview
                  mode={type}
                  accountUsername={accountUsername || 'vigent.bot'}
                  accountAvatarUrl={accountAvatarUrl}
                  userText={previewUserText}
                  replyMode={form.replyMode}
                  messages={previewMessages}
                  dmOnComment={form.dmOnComment}
                  followUpEnabled={form.followUpEnabled}
                  followUpDelayMin={form.followUpDelayMin}
                  followUpMessage={form.followUpMessage}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-6 py-4">
            <p className="hidden text-[11px] text-[var(--text-muted)] sm:block">
              پیش‌نمایش زنده در ستون کناری
            </p>
            <div className="flex items-center gap-2">
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
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {mode === 'create' ? 'افزودن سناریو' : 'ذخیره تغییرات'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── DM action selector (4 options with icons + descriptions) ─────────────
function DmActionSelector({
  value,
  onChange,
}: {
  value: ReplyMode
  onChange: (v: ReplyMode) => void
}) {
  const opts: { value: ReplyMode; label: string; desc: string; Icon: LucideIcon }[] = [
    { value: 'AI', label: 'پاسخ هوشمند دایرکت شود', desc: 'پاسخ توسط ایجنت هوش مصنوعی داده می‌شود', Icon: Bot },
    { value: 'SILENT', label: 'پاسخ داده‌نشود', desc: 'پیام رها می‌شود', Icon: Circle },
    { value: 'STOP_AI', label: 'پاسخ‌گویی هوش مصنوعی متوقف شود', desc: 'با دریافت کلیدواژه‌ها، پاسخ‌گویی هوش مصنوعی متوقف می‌شود', Icon: Zap },
    { value: 'STATIC', label: 'متن ثابت', desc: 'یک پاسخ ثابت ارسال شود', Icon: MessageCircle },
  ]
  return (
    <div className="grid grid-cols-1 gap-2">
      {opts.map(({ value: v, label, desc, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex items-start gap-3 rounded-xl border p-3 text-start transition-all ${
            value === v
              ? 'border-[var(--text-primary)] bg-[var(--bg-base)]'
              : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              value === v
                ? 'bg-[var(--text-primary)] text-[var(--bg-base)]'
                : 'bg-[var(--bg-base)] text-[var(--text-secondary)]'
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{desc}</p>
          </div>
          {value === v && (
            <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--text-primary)]" />
          )}
        </button>
      ))}
    </div>
  )
}

// ── COMMENT action selector (3 options) ─────────────────────────────────
function CommentActionSelector({
  replyMode,
  dmOnComment,
  onReplyModeChange,
  onDmOnCommentChange,
}: {
  replyMode: ReplyMode
  dmOnComment: boolean
  onReplyModeChange: (v: ReplyMode) => void
  onDmOnCommentChange: (v: boolean) => void
}) {
  // Map UI state to (replyMode, dmOnComment) — three discrete options.
  const picked = dmOnComment ? 'SEND_DM' : replyMode === 'SILENT' ? 'SILENT' : 'MULTI_MESSAGE'
  function pick(v: 'SILENT' | 'MULTI_MESSAGE' | 'SEND_DM') {
    if (v === 'SILENT') {
      onReplyModeChange('SILENT')
      onDmOnCommentChange(false)
    } else if (v === 'MULTI_MESSAGE') {
      onReplyModeChange('MULTI_MESSAGE')
      onDmOnCommentChange(false)
    } else {
      onReplyModeChange('SILENT')
      onDmOnCommentChange(true)
    }
  }
  const opts: { value: 'SILENT' | 'MULTI_MESSAGE' | 'SEND_DM'; label: string; desc: string; Icon: LucideIcon }[] = [
    { value: 'SILENT', label: 'پیامی ریپلای نکن', desc: 'کامنت بدون پاسخ رها می‌شود', Icon: Circle },
    { value: 'MULTI_MESSAGE', label: 'یکی از پیام‌های زیر را ریپلای کن', desc: 'به‌صورت تصادفی یکی از گزینه‌ها', Icon: MessageSquare },
    { value: 'SEND_DM', label: 'ارسال پیام در دایرکت', desc: 'به‌جای ریپلای عمومی، دایرکت بفرست', Icon: Send },
  ]
  return (
    <div className="grid grid-cols-1 gap-2">
      {opts.map(({ value: v, label, desc, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => pick(v)}
          className={`flex items-start gap-3 rounded-xl border p-3 text-start transition-all ${
            picked === v
              ? 'border-[var(--text-primary)] bg-[var(--bg-base)]'
              : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              picked === v
                ? 'bg-[var(--text-primary)] text-[var(--bg-base)]'
                : 'bg-[var(--bg-base)] text-[var(--text-secondary)]'
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{desc}</p>
          </div>
          {picked === v && (
            <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--text-primary)]" />
          )}
        </button>
      ))}
    </div>
  )
}

// ── STORY action selector (4 options like DM, no MULTI_MESSAGE) ──────────
function StoryActionSelector({
  value,
  onChange,
}: {
  value: ReplyMode
  onChange: (v: ReplyMode) => void
}) {
  const opts: { value: ReplyMode; label: string; desc: string; Icon: LucideIcon }[] = [
    { value: 'AI', label: 'پاسخ هوشمند', desc: 'ایجنت هوش مصنوعی پاسخ می‌دهد', Icon: Bot },
    { value: 'STATIC', label: 'متن ثابت', desc: 'یک پاسخ ثابت ارسال شود', Icon: MessageCircle },
    { value: 'SILENT', label: 'بدون پاسخ', desc: 'استوری بدون پاسخ رها می‌شود', Icon: Circle },
    { value: 'STOP_AI', label: 'توقف هوش مصنوعی', desc: 'پاسخ‌گویی AI برای این کاربر متوقف شود', Icon: Zap },
  ]
  return (
    <div className="grid grid-cols-1 gap-2">
      {opts.map(({ value: v, label, desc, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`flex items-start gap-3 rounded-xl border p-3 text-start transition-all ${
            value === v
              ? 'border-[var(--text-primary)] bg-[var(--bg-base)]'
              : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]'
          }`}
        >
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              value === v
                ? 'bg-[var(--text-primary)] text-[var(--bg-base)]'
                : 'bg-[var(--bg-base)] text-[var(--text-secondary)]'
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{desc}</p>
          </div>
          {value === v && (
            <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--text-primary)]" />
          )}
        </button>
      ))}
    </div>
  )
}

// ── DM STATIC editor: media-type tabs + per-type inputs ──────────────────
function DmStaticEditor({
  form,
  set,
  setFirstMessage,
  channelId,
}: {
  form: FormState
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void
  setFirstMessage: (patch: Partial<AutomationMessage>) => void
  channelId: string
}) {
  const head = form.messages[0] ?? emptyTextMessage()
  const tabs: { value: DmMediaType; label: string; Icon: LucideIcon }[] = [
    { value: 'TEXT', label: 'متن', Icon: MessageCircle },
    { value: 'MEDIA', label: 'عکس، وویس و ویدیو', Icon: ImagePlus },
    { value: 'QUICK_REPLY', label: 'کلید', Icon: KeyRound },
    { value: 'PRODUCT', label: 'ویترین محصولات', Icon: Tag },
  ]

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--text-secondary)]">نوع پاسخ</p>
      </div>
      {/* Media type tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-1">
        {tabs.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => set('dmMediaType', value)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              form.dmMediaType === value
                ? 'bg-[var(--white)] text-[var(--bg-base)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* TEXT */}
      {form.dmMediaType === 'TEXT' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">متن پاسخ</label>
          <textarea
            value={head.text}
            onChange={(e) => setFirstMessage({ type: 'TEXT', text: e.target.value })}
            placeholder="مثلاً سلام! برای مشاهده قیمت‌ها به دایرکت مراجعه کنید."
            rows={3}
            className="input resize-none"
          />
        </div>
      )}

      {/* MEDIA */}
      {form.dmMediaType === 'MEDIA' && (
        <div className="space-y-3">
          <div className="flex gap-1">
            {(['IMAGE', 'AUDIO', 'VIDEO'] as MediaSubtype[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set('mediaSubtype', s)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                  form.mediaSubtype === s
                    ? 'bg-[var(--bg-base)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {s === 'IMAGE' ? 'عکس' : s === 'AUDIO' ? 'وویس' : 'ویدیو'}
              </button>
            ))}
          </div>

          {form.mediaSubtype === 'AUDIO' ? (
            <div className="space-y-2">
              <VoiceRecorder
                onRecorded={(_blob, url) =>
                  setFirstMessage({ type: 'AUDIO', mediaUrl: url, mediaType: 'AUDIO' })
                }
                onCleared={() =>
                  setFirstMessage({ type: 'AUDIO', mediaUrl: undefined, mediaType: 'AUDIO' })
                }
              />
              {head.mediaUrl && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--text-secondary)]">
                    یا URL صوت (اختیاری)
                  </label>
                  <input
                    dir="ltr"
                    value={head.mediaUrl?.startsWith('blob:') ? '' : (head.mediaUrl ?? '')}
                    onChange={(e) =>
                      setFirstMessage({
                        type: 'AUDIO',
                        mediaUrl: e.target.value,
                        mediaType: 'AUDIO',
                      })
                    }
                    placeholder="https://cdn.example.com/voice.mp3"
                    className="input"
                  />
                </div>
              )}
            </div>
          ) : (
            <MediaUploader
              maxImages={form.mediaSubtype === 'IMAGE' ? 1 : 1}
              onChange={(items: MediaItem[]) => {
                if (items.length === 0) {
                  setFirstMessage({
                    type: form.mediaSubtype,
                    mediaUrl: undefined,
                    mediaType: form.mediaSubtype,
                  })
                  return
                }
                const first = items[0]
                setFirstMessage({
                  type: form.mediaSubtype,
                  mediaUrl: first.url,
                  mediaType: form.mediaSubtype,
                  text: first.caption ?? head.text,
                })
              }}
            />
          )}

          {/* Caption for image/video */}
          {(form.mediaSubtype === 'IMAGE' || form.mediaSubtype === 'VIDEO') && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                کپشن (اختیاری)
              </label>
              <input
                value={head.text}
                onChange={(e) => setFirstMessage({ text: e.target.value })}
                placeholder="مثلاً تخفیف ویژه تا پایان هفته"
                className="input"
              />
            </div>
          )}
        </div>
      )}

      {/* QUICK_REPLY */}
      {form.dmMediaType === 'QUICK_REPLY' && (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">متن اصلی</label>
            <textarea
              value={head.text}
              onChange={(e) => setFirstMessage({ type: 'TEXT', text: e.target.value })}
              placeholder="مثلاً چه اطلاعاتی نیاز داری؟"
              rows={2}
              className="input resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              دکمه‌های سریع (حداکثر ۳)
            </label>
            <QuickRepliesEditor
              replies={head.quickReplies ?? []}
              onChange={(replies) => setFirstMessage({ quickReplies: replies })}
            />
          </div>
        </div>
      )}

      {/* PRODUCT */}
      {form.dmMediaType === 'PRODUCT' && (
        <div className="space-y-3">
          <ProductPicker
            channelId={channelId}
            selectedId={head.productId}
            onSelect={(p) =>
              setFirstMessage({
                type: 'PRODUCT',
                productId: p.id,
                text: head.text,
              })
            }
          />
          {head.productId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                متن همراه (اختیاری)
              </label>
              <input
                value={head.text}
                onChange={(e) => setFirstMessage({ text: e.target.value })}
                placeholder="مثلاً این محصول رو دیدی؟"
                className="input"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Quick replies editor (up to 3 chips) ─────────────────────────────────
function QuickRepliesEditor({
  replies,
  onChange,
}: {
  replies: string[]
  onChange: (r: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (!v || replies.length >= 3 || replies.includes(v)) return
    onChange([...replies, v])
    setDraft('')
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {replies.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--text-primary)] border border-[var(--border-default)]"
          >
            {r}
            <button
              type="button"
              onClick={() => onChange(replies.filter((x) => x !== r))}
              className="text-[var(--text-muted)] hover:text-[var(--danger)]"
              aria-label={`حذف ${r}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {replies.length === 0 && (
          <span className="text-[11px] text-[var(--text-muted)]">هنوز دکمه‌ای اضافه نشده.</span>
        )}
      </div>
      {replies.length < 3 && (
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder="مثلاً قیمت‌ها"
            maxLength={40}
            className="input"
          />
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Plus className="h-3.5 w-3.5" />
            افزودن
          </button>
        </div>
      )}
    </div>
  )
}

// ── Product picker (search + select from /api/products) ──────────────────
interface ProductLite {
  id: string
  name: string
  price: number | null
  images: string[]
}

function ProductPicker({
  channelId,
  selectedId,
  onSelect,
}: {
  channelId: string
  selectedId?: string
  onSelect: (p: ProductLite) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ProductLite[]>([])
  const [selected, setSelected] = useState<ProductLite | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load initial 8 products when first opened (or when channelId changes).
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/products?sort=newest`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const list: ProductLite[] = (d.products ?? []).slice(0, 20).map((p: ProductLite) => p)
        setItems(list)
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [open, channelId])

  // Debounced search.
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) return
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      fetch(`/api/products?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setItems((d.products ?? []).slice(0, 20)))
        .catch(() => {})
        .finally(() => setLoading(false))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q, open])

  // Resolve the selected product (for the chip display).
  useEffect(() => {
    if (!selectedId) {
      setSelected(null)
      return
    }
    // Try from the already-loaded items first, then fetch.
    const found = items.find((p) => p.id === selectedId)
    if (found) {
      setSelected(found)
      return
    }
    fetch(`/api/products/${selectedId}`)
      .then((r) => r.json())
      .then((d) => d.product && setSelected(d.product as ProductLite))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return (
    <div className="space-y-2">
      {selected ? (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-2.5">
          <ProductThumb product={selected} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-[var(--text-primary)]">
              {selected.name}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {selected.price != null
                ? `${selected.price.toLocaleString('fa-IR')} تومان`
                : 'بدون قیمت'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(null)
              onSelect({ id: '', name: '', price: null, images: [] })
            }}
            className="text-[var(--text-muted)] hover:text-[var(--danger)]"
            aria-label="حذف انتخاب"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
        >
          <span className="inline-flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            انتخاب محصول
          </span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}

      {open && !selected && (
        <div className="overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] shadow-lg">
          <div className="border-b border-[var(--border-subtle)] p-2">
            <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="جستجوی محصول…"
                className="flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-hint)]"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                در حال بارگذاری…
              </div>
            )}
            {!loading && items.length === 0 && (
              <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                محصولی پیدا نشد.
              </p>
            )}
            {!loading &&
              items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelected(p)
                    onSelect(p)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 border-b border-[var(--border-subtle)] px-3 py-2 text-start transition-colors last:border-0 hover:bg-[var(--bg-hover)]"
                >
                  <ProductThumb product={p} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {p.price != null
                        ? `${p.price.toLocaleString('fa-IR')} تومان`
                        : 'بدون قیمت'}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ProductThumb({ product }: { product: ProductLite }) {
  const img = product.images?.[0]
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt={product.name} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ background: 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)' }}
    >
      <Tag className="h-4 w-4" />
    </div>
  )
}

// ── Reusable: segmented control ──────────────────────────────────────────
function SegmentedField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label?: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
      )}
      <div className="inline-flex w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              value === o.value
                ? 'bg-[var(--white)] text-[var(--bg-base)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Tag input (keywords) ─────────────────────────────────────────────────
function TagInput({
  tags,
  onAdd,
  onRemove,
  onInput,
  inputValue,
  onKeyDown,
  placeholder,
}: {
  tags: string[]
  onAdd: (raw: string) => void
  onRemove: (k: string) => void
  onInput: (v: string) => void
  inputValue: string
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] px-2.5 py-2 focus-within:border-[var(--border-strong)]">
      {tags.map((k) => (
        <span
          key={k}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-primary)]"
        >
          {k}
          <button
            type="button"
            onClick={() => onRemove(k)}
            className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            aria-label={`حذف ${k}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={(e) => onInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => onAdd(inputValue)}
        placeholder={tags.length ? '' : placeholder}
        className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-hint)]"
      />
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────
function splitTags(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
