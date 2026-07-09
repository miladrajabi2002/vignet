'use client'

import {
        useState,
        useRef,
        useMemo,
        useEffect,
        type FormEvent,
        type KeyboardEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
        ArrowRight,
        ArrowUp,
        ArrowDown,
        Trash2,
        Type,
        ShoppingBag,
        Shield,
        Mic,
        Film,
        Link2,
        type LucideIcon,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { IphonePreview } from '@/components/instagram/iphone-preview'
import { MediaUploader, type MediaItem } from '@/components/instagram/media-uploader'
import { VoiceRecorder } from '@/components/instagram/voice-recorder'
import {
        type Automation,
        type AutomationType,
        type MatchMode,
        type StoryScope,
        type ReplyMode,
        type GateMode,
        type QuickReplyButton,
        type AutomationMessage,
        type MessageType,
        type AutomationTrigger,
        type AutomationAction,
        MATCH_MODE_DESC,
        newMessageId,
} from '@/components/instagram/types'

// ── Internal flat form state ────────────────────────────────────────────
type PostFilter = 'ANY' | 'SPECIFIC'
type KeywordFilter = 'ANY' | 'SPECIFIC'

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
        // Comment funnel
        dmOnComment: boolean
        // Follow gate (collapsed by default)
        followGate: boolean
        gateMode: GateMode
        gateButtonType: 'button' | 'quick_reply'
        gatePrompt: string
        gateQuickReply: string
        gateConfirmKeyword: string
        contentText: string
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
                        : type === 'COMMENT'
                                ? [emptyTextMessage()]
                                : [],
                dmOnComment: a?.action.dmOnComment ?? false,
                followGate: a?.action.followGate ?? false,
                gateMode: a?.action.gateMode ?? 'SOFT',
                gateButtonType: a?.action.gateButtonType ?? 'button',
                gatePrompt: a?.action.gatePrompt ?? '',
                gateQuickReply: a?.action.gateQuickReply ?? '',
                gateConfirmKeyword: a?.action.gateConfirmKeyword ?? '',
                contentText: a?.action.contentText ?? '',
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
        // Buttons may be in the new object form ({title, url?}) or the legacy
        // plain-string form (treated as a postback button with that title).
        // Normalize everything to the object form so the rest of the UI and
        // the buildPayload() pipeline can assume `QuickReplyButton[]`.
        function toButton(b: QuickReplyButton | string): QuickReplyButton {
                return typeof b === 'string' ? { title: b } : { title: b.title, url: b.url }
        }
        const rawButtons: Array<QuickReplyButton | string> = Array.isArray(m.buttons)
                ? m.buttons
                : Array.isArray(m.quickReplies)
                        ? m.quickReplies
                        : []
        return {
                id: m.id ?? newMessageId(),
                type: (m.type as MessageType) ?? 'TEXT',
                text: m.text ?? '',
                mediaUrl: m.mediaUrl,
                mediaType: m.mediaType,
                productId: m.productId,
                buttons: rawButtons.slice(0, 3).map(toButton),
        }
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
}: {
        agentId: string
        channelId: string
        accountUsername: string
        accountAvatarUrl?: string
        type: AutomationType
        initial?: Automation
        mode: 'create' | 'edit'
}) {
        const router = useRouter()
        const [form, setForm] = useState<FormState>(() => toFormState(initial, type))
        const [keywordInput, setKeywordInput] = useState('')
        const [busy, setBusy] = useState(false)
        const [error, setError] = useState<string | null>(null)
        const nameRef = useRef<HTMLInputElement>(null)

        // Auto-focus name on mount.
        useEffect(() => {
                nameRef.current?.focus()
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

        // ── Messages manipulation (Message Builder) ───────────────────────────
        function addMessage(t: MessageType) {
                setForm((f) => {
                        const msg: AutomationMessage =
                                t === 'QUICK_REPLY'
                                        ? { id: newMessageId(), type: 'QUICK_REPLY', text: '', buttons: [] }
                                        : t === 'PRODUCT'
                                                ? { id: newMessageId(), type: 'PRODUCT', text: '', productId: undefined }
                                                : { id: newMessageId(), type: t, text: '' }
                        return { ...f, messages: [...f.messages, msg] }
                })
        }

        function updateMessage(id: string, patch: Partial<AutomationMessage>) {
                setForm((f) => ({
                        ...f,
                        messages: f.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
                }))
        }

        function removeMessage(id: string) {
                setForm((f) => ({
                        ...f,
                        messages: f.messages.filter((m) => m.id !== id),
                }))
        }

        function moveMessage(id: string, dir: -1 | 1) {
                setForm((f) => {
                        const idx = f.messages.findIndex((m) => m.id === id)
                        if (idx === -1) return f
                        const next = idx + dir
                        if (next < 0 || next >= f.messages.length) return f
                        const arr = f.messages.slice()
                        const [item] = arr.splice(idx, 1)
                        arr.splice(next, 0, item)
                        return { ...f, messages: arr }
                })
        }

        // For COMMENT MULTI_MESSAGE: add/remove a TEXT-only option.
        function addMultiMessageOption() {
                setForm((f) => ({
                        ...f,
                        messages: [...f.messages, emptyTextMessage()],
                }))
        }

        function removeMultiMessageOption(id: string) {
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
                const effectiveKeywords = form.keywordFilter === 'SPECIFIC' ? form.keywords : []
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

                // Build messages based on type + replyMode.
                let messages: AutomationMessage[] = []
                if (form.replyMode === 'STATIC' || form.replyMode === 'MULTI_MESSAGE') {
                        if (type === 'DIRECT_MESSAGE' || type === 'STORY') {
                                messages = form.messages
                        } else if (type === 'COMMENT' && form.replyMode === 'MULTI_MESSAGE') {
                                messages = form.messages.filter((m) => m.text.trim() || m.mediaUrl)
                        } else if (type === 'COMMENT' && form.dmOnComment) {
                                // SEND_DM: a single message sent in DM.
                                messages = form.messages
                        }
                }

                // Strip client-only fields and clean up empty buttons.
                const cleanedMessages = messages.map((m) => {
                        const out: Record<string, unknown> = {
                                type: m.type,
                        }
                        if (m.text?.trim()) out.text = m.text
                        if (m.mediaUrl) out.mediaUrl = m.mediaUrl
                        if (m.productId) out.productId = m.productId
                        if (m.buttons && m.buttons.length > 0) {
                                // Drop empty-title buttons; keep at most 3 (Instagram limit).
                                const cleanButtons = m.buttons
                                        .filter((b) => b && typeof b === 'object' && b.title && b.title.trim())
                                        .slice(0, 3)
                                        .map((b) => {
                                                const btn: QuickReplyButton = { title: b.title.trim() }
                                                if (b.url && b.url.trim()) btn.url = b.url.trim()
                                                return btn
                                        })
                                if (cleanButtons.length > 0) out.buttons = cleanButtons
                        }
                        if (m.buttonType) out.buttonType = m.buttonType
                        return out as unknown as AutomationMessage
                })

                const action: AutomationAction = {
                        replyMode: form.replyMode,
                        messages: cleanedMessages,
                        replyText:
                                form.replyMode === 'STATIC' && form.messages[0]?.text
                                        ? form.messages[0].text
                                        : '',
                        dmOnComment: type === 'COMMENT' ? form.dmOnComment : false,
                        // Follow gate — save all fields so the engine can build the gate row
                        // and verify fulfillment on the user's reply. When the gate is OFF,
                        // send the fields anyway so re-enabling later keeps the user's draft.
                        followGate: form.followGate,
                        gateMode: form.gateMode,
                        gateButtonType: form.gateButtonType,
                        gatePrompt: form.gatePrompt,
                        gateQuickReply: form.gateQuickReply,
                        gateConfirmKeyword: form.gateConfirmKeyword,
                        contentText: form.contentText,
                }

                return { trigger, action }
        }

        // ── Submit ────────────────────────────────────────────────────────────
        async function submit(e: FormEvent) {
                e.preventDefault()
                if (!form.name.trim()) {
                        setError('نام سناریو را وارد کنید.')
                        return
                }
                if (form.keywordFilter === 'SPECIFIC' && form.keywords.length === 0) {
                        setError('حداقل یک کلمه‌کلیدی اضافه کنید یا حالت «هر کلمه‌ای» را انتخاب کنید.')
                        return
                }
                // For STATIC with no messages, suggest adding one.
                if (
                        form.replyMode === 'STATIC' &&
                        (type === 'DIRECT_MESSAGE' || type === 'STORY') &&
                        form.messages.length === 0
                ) {
                        setError('حداقل یک پیام به دنباله اضافه کنید.')
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
                                                        : data?.details
                                                                ? 'ذخیره ناموفق بود. ورودی‌ها را بررسی کنید.'
                                                                : 'ذخیره ناموفق بود.',
                                        )
                                        return
                                }
                                router.push(`/agents/${agentId}/instagram`)
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
                                router.push(`/agents/${agentId}/instagram`)
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
                if (isComment && form.dmOnComment) {
                        return form.messages
                }
                return form.messages
        }, [form, isComment])

        const HeaderIcon: LucideIcon =
                type === 'DIRECT_MESSAGE' ? MessageCircle : type === 'COMMENT' ? MessageSquare : Circle

        const showBuilder = isDm
                ? form.replyMode === 'STATIC'
                : isStory
                        ? form.replyMode === 'STATIC'
                        : isComment
                                ? form.replyMode === 'MULTI_MESSAGE' || form.dmOnComment
                                : false

        return (
                <div className="mx-auto max-w-7xl">
                        {/* Back link */}
                        <div className="mb-4">
                                <Link
                                        href={`/agents/${agentId}/instagram`}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                                >
                                        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                                        بازگشت به اتوماسیون
                                </Link>
                        </div>

                        {/* Page header */}
                        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
                                <div className="flex items-start gap-3">
                                        <div
                                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                                                style={{ background: 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)' }}
                                        >
                                                <HeaderIcon className="h-5 w-5" />
                                        </div>
                                        <div>
                                                <h1 className="text-xl font-medium text-[var(--text-primary)]">
                                                        {mode === 'create' ? 'افزودن سناریو' : 'ویرایش سناریو'}
                                                </h1>
                                                <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                                                        {type === 'DIRECT_MESSAGE' && 'پاسخ خودکار به پیام‌های مستقیم'}
                                                        {type === 'COMMENT' && 'پاسخ خودکار به کامنت پست‌ها'}
                                                        {type === 'STORY' && 'پاسخ خودکار به استوری‌ها'}
                                                </p>
                                        </div>
                                </div>
                        </header>

                        <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                                {/* ── LEFT: form fields ────────────────────────────────────── */}
                                <div className="space-y-6">
                                        {/* Scenario name */}
                                        <Section title="مشخصات سناریو">
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
                                        </Section>

                                        {/* ─── Trigger section ─────────────────────────────────── */}
                                        <Section title="شرط اجرا" Icon={Zap}>
                                                {/* COMMENT: post scope (any / specific) */}
                                                {isComment && (
                                                        <SegmentedField
                                                                label="کدام پست‌ها؟"
                                                                value={form.postFilter}
                                                                onChange={(v) => set('postFilter', v as PostFilter)}
                                                                options={[
                                                                        { value: 'ANY', label: 'هر پستی' },
                                                                        { value: 'SPECIFIC', label: 'پست‌های مشخص' },
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

                                                {/* Keyword filter (ANY / SPECIFIC) — for COMMENT and STORY */}
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

                                                {/* Keywords tag input — for DM always; for COMMENT/STORY when SPECIFIC */}
                                                {(isDm || form.keywordFilter === 'SPECIFIC') && (
                                                        <div className="space-y-1.5">
                                                                <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                                        کلمات کلیدی
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

                                                {/* Match mode — SEGMENTED CONTROL (DM only) */}
                                                {isDm && (
                                                        <div className="space-y-1.5">
                                                                <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                                        نحوه تطبیق کلمه‌کلیدی
                                                                </label>
                                                                <MatchModeSelector
                                                                        value={form.matchMode}
                                                                        onChange={(v) => set('matchMode', v)}
                                                                />
                                                        </div>
                                                )}
                                        </Section>

                                        {/* ─── Action section ──────────────────────────────────── */}
                                        <Section title="سپس" Icon={Sparkles}>
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
                                        </Section>

                                        {/* ─── MESSAGE BUILDER (DM/STORY STATIC, COMMENT SEND_DM) ── */}
                                        {showBuilder && form.replyMode === 'STATIC' && (
                                                <Section title="دنباله پیام‌ها" Icon={MessageCircle}>
                                                        <MessageBuilder
                                                                messages={form.messages}
                                                                channelId={channelId}
                                                                onAdd={addMessage}
                                                                onUpdate={updateMessage}
                                                                onRemove={removeMessage}
                                                                onMove={moveMessage}
                                                        />
                                                        <p className="text-[11px] text-[var(--text-muted)]">
                                                                پیام‌ها به‌ترتیب ارسال می‌شوند. می‌توانید متن، عکس، وویس، ویدیو، کلید و ویترین محصول را به دنباله اضافه کنید.
                                                        </p>
                                                </Section>
                                        )}

                                        {/* ─── COMMENT SEND_DM: also show message builder ────── */}
                                        {isComment && form.dmOnComment && (
                                                <Section title="متن دایرکت" Icon={Send}>
                                                        <div className="space-y-1.5">
                                                                <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                                        متن دایرکت (به کامنت‌گذار)
                                                                </label>
                                                                <textarea
                                                                        value={form.messages[0]?.text ?? ''}
                                                                        onChange={(e) =>
                                                                                updateMessage(form.messages[0]?.id ?? '', {
                                                                                        type: 'TEXT',
                                                                                        text: e.target.value,
                                                                                })
                                                                        }
                                                                        onFocus={() => {
                                                                                if (form.messages.length === 0) {
                                                                                        addMessage('TEXT')
                                                                                }
                                                                        }}
                                                                        placeholder="متن دایرکتی که برای کامنت‌گذار ارسال می‌شود."
                                                                        rows={3}
                                                                        className="input resize-none"
                                                                />
                                                                <p className="text-[11px] text-[var(--text-muted)]">
                                                                        کاربر پس از کامنت، این پیام را در دایرکت دریافت می‌کند.
                                                                </p>
                                                        </div>
                                                </Section>
                                        )}

                                        {/* ─── COMMENT MULTI_MESSAGE: list of reply options ─────── */}
                                        {isComment && form.replyMode === 'MULTI_MESSAGE' && (
                                                <Section title="گزینه‌های پاسخ" Icon={MessageSquare}>
                                                        <div className="space-y-2">
                                                                <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                                        یکی به‌صورت تصادفی ریپلای می‌شود
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
                                                                                                onClick={() => removeMultiMessageOption(m.id)}
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
                                                                        onClick={addMultiMessageOption}
                                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                                                                >
                                                                        <Plus className="h-3.5 w-3.5" />
                                                                        افزودن گزینه
                                                                </button>
                                                        </div>
                                                </Section>
                                        )}

                                        {/* ─── Follow gate (collapsed by default) ─────────────────── */}
                                        <Section title="شرط دنبال کردن" Icon={Shield}>
                                                <div className="flex items-start justify-between gap-3">
                                                        <div className="flex min-w-0 items-start gap-2.5">
                                                                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                                                                <div className="min-w-0">
                                                                        <p className="text-sm font-medium text-[var(--text-primary)]">
                                                                                شرط فالو داشتن پیج
                                                                        </p>
                                                                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                                                                                اگر کاربر فالو داشته باشد، پاسخ ارسال می‌شود. در غیر این‌صورت از او می‌خواهیم اول فالو کند.
                                                                        </p>
                                                                </div>
                                                        </div>
                                                        <Switch
                                                                checked={form.followGate}
                                                                onChange={(v) => set('followGate', v)}
                                                                aria-label="شرط فالو"
                                                        />
                                                </div>
                                                {form.followGate && (
                                                        <div className="space-y-3">
                                                                <p className="rounded-lg bg-[var(--bg-base)] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                                                                        وقتی کاربر پیام می‌دهد و فالو نیست، این پیام برایش ارسال می‌شود. بعد از فالو کردن و زدن دکمه «دنبال کردم»، محتوای زیر برایش ارسال می‌شود.
                                                                </p>
                                                                <div className="space-y-1.5">
                                                                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                                                پیام درخواست فالو
                                                                        </label>
                                                                        <textarea
                                                                                value={form.gatePrompt}
                                                                                onChange={(e) => set('gatePrompt', e.target.value)}
                                                                                placeholder="لطفاً ابتدا صفحه ما را دنبال کنید&#10;بعد از دنبال کردن، بر روی دکمه زیر کلیک کنید"
                                                                                rows={3}
                                                                                className="input resize-none"
                                                                        />
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                                                متن دکمه
                                                                        </label>
                                                                        <input
                                                                                value={form.gateQuickReply}
                                                                                onChange={(e) => set('gateQuickReply', e.target.value)}
                                                                                placeholder="دنبال کردم"
                                                                                className="input"
                                                                        />
                                                                </div>
                                                        </div>
                                                )}
                                        </Section>

                                        {error && (
                                                <p className="flex items-start gap-2 rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
                                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                        <span className="leading-relaxed">{error}</span>
                                                </p>
                                        )}

                                        {/* Footer */}
                                        <div className="sticky bottom-0 z-10 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)]/95 px-4 py-3 backdrop-blur">
                                                <p className="hidden text-[11px] text-[var(--text-muted)] sm:block">
                                                        پیش‌نمایش زنده در ستون کناری
                                                </p>
                                                <div className="flex items-center gap-2">
                                                        <Link
                                                                href={`/agents/${agentId}/instagram`}
                                                                className="rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                                                        >
                                                                انصراف
                                                        </Link>
                                                        <button
                                                                type="submit"
                                                                disabled={busy || !form.name.trim()}
                                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--white)] px-5 py-2 text-sm font-medium text-[var(--bg-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
                                                        >
                                                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                                                {mode === 'create' ? 'افزودن سناریو' : 'ذخیره تغییرات'}
                                                        </button>
                                                </div>
                                        </div>
                                </div>

                                {/* ── RIGHT: sticky live iPhone preview ──────────────────── */}
                                <div className="hidden lg:block">
                                        <div className="sticky top-24">
                                                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
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
                                                        <IphonePreview
                                                                mode={type}
                                                                accountUsername={accountUsername || 'vigent.bot'}
                                                                accountAvatarUrl={accountAvatarUrl}
                                                                userText={previewUserText}
                                                                replyMode={form.replyMode}
                                                                messages={previewMessages}
                                                                dmOnComment={form.dmOnComment}
                                                                followGate={form.followGate}
                                                        />
                                                </div>
                                        </div>
                                </div>

                                {/* On mobile: collapsible preview */}
                                <div className="lg:hidden">
                                        <MobilePreviewToggle
                                                {...{
                                                        mode: type,
                                                        accountUsername: accountUsername || 'vigent.bot',
                                                        accountAvatarUrl,
                                                        userText: previewUserText,
                                                        replyMode: form.replyMode,
                                                        messages: previewMessages,
                                                        dmOnComment: form.dmOnComment,
                                                        followGate: form.followGate,
                                                }}
                                        />
                                </div>
                        </form>
                </div>
        )
}

// ── Mobile preview (collapsible) ─────────────────────────────────────────
function MobilePreviewToggle(props: React.ComponentProps<typeof IphonePreview>) {
        const [open, setOpen] = useState(false)
        return (
                <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                        <button
                                type="button"
                                onClick={() => setOpen((v) => !v)}
                                className="flex w-full items-center justify-between"
                        >
                                <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                                        پیش‌نمایش زنده
                                </span>
                                <ChevronDown
                                        className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
                                />
                        </button>
                        {open && (
                                <div className="mt-4">
                                        <IphonePreview {...props} />
                                </div>
                        )}
                </div>
        )
}

// ── Section wrapper ───────────────────────────────────────────────────────
function Section({
        title,
        Icon,
        collapsible = false,
        defaultCollapsed = false,
        children,
}: {
        title: string
        Icon?: LucideIcon
        collapsible?: boolean
        defaultCollapsed?: boolean
        children: React.ReactNode
}) {
        const [open, setOpen] = useState(!defaultCollapsed)
        if (!collapsible) {
                return (
                        <section className="space-y-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
                                <div className="flex items-center gap-2">
                                        {Icon && (
                                                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)]">
                                                        <Icon className="h-3.5 w-3.5" />
                                                </div>
                                        )}
                                        <h2 className="text-sm font-medium text-[var(--text-primary)]">{title}</h2>
                                </div>
                                {children}
                        </section>
                )
        }
        return (
                <section className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)]">
                        <button
                                type="button"
                                onClick={() => setOpen((v) => !v)}
                                className="flex w-full items-center justify-between gap-2 px-5 py-4 text-start"
                        >
                                <div className="flex items-center gap-2">
                                        {Icon && (
                                                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)]">
                                                        <Icon className="h-3.5 w-3.5" />
                                                </div>
                                        )}
                                        <h2 className="text-sm font-medium text-[var(--text-primary)]">{title}</h2>
                                </div>
                                <ChevronDown
                                        className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
                                />
                        </button>
                        {open && <div className="space-y-4 border-t border-[var(--border-subtle)] px-5 py-5">{children}</div>}
                </section>
        )
}

// ── Match mode segmented control ─────────────────────────────────────────
function MatchModeSelector({
        value,
        onChange,
}: {
        value: MatchMode
        onChange: (v: MatchMode) => void
}) {
        const opts: { value: MatchMode; label: string; desc: string }[] = [
                { value: 'EXACT', label: 'دقیق', desc: MATCH_MODE_DESC.EXACT },
                { value: 'CONTAINS', label: 'شامل', desc: MATCH_MODE_DESC.CONTAINS },
                { value: 'STARTS_WITH', label: 'شروع با', desc: MATCH_MODE_DESC.STARTS_WITH },
        ]
        return (
                <div className="grid grid-cols-3 gap-2">
                        {opts.map(({ value: v, label, desc }) => {
                                const active = value === v
                                return (
                                        <button
                                                key={v}
                                                type="button"
                                                onClick={() => onChange(v)}
                                                title={desc}
                                                className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center transition-all ${
                                                        active
                                                                ? 'border-[var(--text-primary)] bg-[var(--bg-base)] shadow-sm'
                                                                : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-hover)]'
                                                }`}
                                        >
                                                <span
                                                        className={`text-xs font-medium ${
                                                                active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
                                                        }`}
                                                >
                                                        {label}
                                                </span>
                                        </button>
                                )
                        })}
                </div>
        )
}

// ── DM action selector (2x2 grid) ─────────────────────────────────────────
function DmActionSelector({
        value,
        onChange,
}: {
        value: ReplyMode
        onChange: (v: ReplyMode) => void
}) {
        const opts: { value: ReplyMode; label: string; desc: string; Icon: LucideIcon }[] = [
                {
                        value: 'AI',
                        label: 'پاسخ هوشمند (ایجنت)',
                        desc: 'ایجنت هوش مصنوعی پاسخ می‌دهد',
                        Icon: Bot,
                },
                {
                        value: 'SILENT',
                        label: 'پاسخ داده‌نشود',
                        desc: 'پیام رها می‌شود',
                        Icon: Circle,
                },
                {
                        value: 'STOP_AI',
                        label: 'توقف پاسخ‌گویی هوش مصنوعی',
                        desc: 'پاسخ‌گویی AI برای این کاربر متوقف شود',
                        Icon: Zap,
                },
                {
                        value: 'STATIC',
                        label: 'پیام سفارشی',
                        desc: 'دنباله‌ای از پیام‌های ثابت ارسال شود',
                        Icon: MessageCircle,
                },
        ]
        return (
                <div className="grid grid-cols-2 gap-2">
                        {opts.map(({ value: v, label, desc, Icon }) => {
                                const active = value === v
                                return (
                                        <button
                                                key={v}
                                                type="button"
                                                onClick={() => onChange(v)}
                                                className={`group flex flex-col items-start gap-2 rounded-xl border p-3 text-start transition-all ${
                                                        active
                                                                ? 'border-[var(--text-primary)] bg-[var(--bg-base)] shadow-sm'
                                                                : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-hover)]'
                                                }`}
                                        >
                                                <div
                                                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                                                active
                                                                        ? 'bg-[var(--text-primary)] text-[var(--bg-base)]'
                                                                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                                                        }`}
                                                >
                                                        <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                        <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">
                                                                {label}
                                                        </p>
                                                        <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                                                                {desc}
                                                        </p>
                                                </div>
                                                {active && <Check className="absolute end-2 top-2 h-3.5 w-3.5 text-[var(--text-primary)]" />}
                                        </button>
                                )
                        })}
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
                { value: 'SILENT', label: 'ریپلای نکن', desc: 'کامنت بدون پاسخ رها می‌شود', Icon: Circle },
                { value: 'MULTI_MESSAGE', label: 'یکی از پیام‌ها', desc: 'به‌صورت تصادفی یکی از گزینه‌ها', Icon: MessageSquare },
                { value: 'SEND_DM', label: 'ارسال در دایرکت', desc: 'به‌جای ریپلای عمومی، دایرکت بفرست', Icon: Send },
        ]
        return (
                <div className="grid grid-cols-1 gap-2">
                        {opts.map(({ value: v, label, desc, Icon }) => {
                                const active = picked === v
                                return (
                                        <button
                                                key={v}
                                                type="button"
                                                onClick={() => pick(v)}
                                                className={`flex items-start gap-3 rounded-xl border p-3 text-start transition-all ${
                                                        active
                                                                ? 'border-[var(--text-primary)] bg-[var(--bg-base)] shadow-sm'
                                                                : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-hover)]'
                                                }`}
                                        >
                                                <div
                                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                                                active
                                                                        ? 'bg-[var(--text-primary)] text-[var(--bg-base)]'
                                                                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                                                        }`}
                                                >
                                                        <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                                                        <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">{desc}</p>
                                                </div>
                                                {active && <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--text-primary)]" />}
                                        </button>
                                )
                        })}
                </div>
        )
}

// ── STORY action selector (2x2 grid) ──────────────────────────────────────
function StoryActionSelector({
        value,
        onChange,
}: {
        value: ReplyMode
        onChange: (v: ReplyMode) => void
}) {
        const opts: { value: ReplyMode; label: string; desc: string; Icon: LucideIcon }[] = [
                { value: 'AI', label: 'پاسخ هوشمند', desc: 'ایجنت هوش مصنوعی پاسخ می‌دهد', Icon: Bot },
                { value: 'STATIC', label: 'پیام سفارشی', desc: 'دنباله‌ای از پیام‌های ثابت', Icon: MessageCircle },
                { value: 'SILENT', label: 'بدون پاسخ', desc: 'استوری بدون پاسخ رها می‌شود', Icon: Circle },
                { value: 'STOP_AI', label: 'توقف هوش مصنوعی', desc: 'پاسخ‌گویی AI برای این کاربر متوقف شود', Icon: Zap },
        ]
        return (
                <div className="grid grid-cols-2 gap-2">
                        {opts.map(({ value: v, label, desc, Icon }) => {
                                const active = value === v
                                return (
                                        <button
                                                key={v}
                                                type="button"
                                                onClick={() => onChange(v)}
                                                className={`group flex flex-col items-start gap-2 rounded-xl border p-3 text-start transition-all ${
                                                        active
                                                                ? 'border-[var(--text-primary)] bg-[var(--bg-base)] shadow-sm'
                                                                : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-hover)]'
                                                }`}
                                        >
                                                <div
                                                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                                                                active
                                                                        ? 'bg-[var(--text-primary)] text-[var(--bg-base)]'
                                                                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                                                        }`}
                                                >
                                                        <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                        <p className="text-xs font-medium text-[var(--text-primary)] leading-tight">
                                                                {label}
                                                        </p>
                                                        <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                                                                {desc}
                                                        </p>
                                                </div>
                                                {active && <Check className="absolute end-2 top-2 h-3.5 w-3.5 text-[var(--text-primary)]" />}
                                        </button>
                                )
                        })}
                </div>
        )
}

// ── Message Builder (the key feature) ────────────────────────────────────
function MessageBuilder({
        messages,
        channelId,
        onAdd,
        onUpdate,
        onRemove,
        onMove,
}: {
        messages: AutomationMessage[]
        channelId: string
        onAdd: (t: MessageType) => void
        onUpdate: (id: string, patch: Partial<AutomationMessage>) => void
        onRemove: (id: string) => void
        onMove: (id: string, dir: -1 | 1) => void
}) {
        // All six message types the builder supports. AUDIO and VIDEO are now
        // first-class options (previously only IMAGE existed, with a misleading
        // "عکس، وویس، ویدیو" label that only ever created an IMAGE entry).
        const addOptions: { value: MessageType; label: string; Icon: LucideIcon }[] = [
                { value: 'TEXT', label: 'متن', Icon: Type },
                { value: 'IMAGE', label: 'عکس', Icon: ImagePlus },
                { value: 'AUDIO', label: 'صوت', Icon: Mic },
                { value: 'VIDEO', label: 'ویدیو', Icon: Film },
                { value: 'QUICK_REPLY', label: 'کلید', Icon: KeyRound },
                { value: 'PRODUCT', label: 'محصول', Icon: ShoppingBag },
        ]

        return (
                <div className="space-y-3">
                        {/* Header: count badge + hint — makes it OBVIOUS the user can stack messages. */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-base)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                                        <MessageCircle className="h-3 w-3" />
                                        {messages.length > 0
                                                ? `${messages.length.toLocaleString('fa-IR')} پیام`
                                                : 'بدون پیام'}
                                </span>
                                <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                                        چند پیام پشت‌سر هم — به‌ترتیب ارسال می‌شوند.
                                </p>
                        </div>

                        {messages.length === 0 && (
                                <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-base)] p-6 text-center">
                                        <MessageCircle className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
                                        <p className="mt-2 text-xs text-[var(--text-secondary)]">
                                                هنوز پیامی اضافه نشده. با یکی از دکمه‌های زیر شروع کنید.
                                        </p>
                                </div>
                        )}

                        {messages.map((m, idx) => (
                                <MessageCard
                                        key={m.id}
                                        message={m}
                                        index={idx}
                                        total={messages.length}
                                        channelId={channelId}
                                        onUpdate={(patch) => onUpdate(m.id, patch)}
                                        onRemove={() => onRemove(m.id)}
                                        onMoveUp={() => onMove(m.id, -1)}
                                        onMoveDown={() => onMove(m.id, 1)}
                                />
                        ))}

                        {/* Add-message buttons — one per type, always visible. Each button
                            is a self-contained pill with the type's icon + label, so the user
                            sees at a glance every kind of message they can add. No hidden
                            dropdown, no guessing. */}
                        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                                <p className="mb-2.5 text-[11px] font-medium text-[var(--text-secondary)]">
                                        افزودن پیام
                                </p>
                                <div className="grid grid-cols-3 gap-1.5">
                                        {addOptions.map(({ value, label, Icon }) => (
                                                <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => onAdd(value)}
                                                        className="group flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-2.5 text-[10px] font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-95"
                                                >
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-base)] text-[var(--text-secondary)] transition-colors group-hover:bg-[var(--white)] group-hover:text-[var(--bg-base)]">
                                                                <Icon className="h-3.5 w-3.5" />
                                                        </span>
                                                        {label}
                                                </button>
                                        ))}
                                </div>
                        </div>
                </div>
        )
}

function MessageCard({
        message,
        index,
        total,
        channelId,
        onUpdate,
        onRemove,
        onMoveUp,
        onMoveDown,
}: {
        message: AutomationMessage
        index: number
        total: number
        channelId: string
        onUpdate: (patch: Partial<AutomationMessage>) => void
        onRemove: () => void
        onMoveUp: () => void
        onMoveDown: () => void
}) {
        // Voice-recorder upload state — local to this card so each card tracks
        // its own upload independently.
        const [voiceUploading, setVoiceUploading] = useState(false)
        const [voiceError, setVoiceError] = useState<string | null>(null)

        const typeLabel =
                message.type === 'TEXT'
                        ? 'متن'
                        : message.type === 'IMAGE'
                                ? 'عکس'
                                : message.type === 'AUDIO'
                                        ? 'وویس'
                                        : message.type === 'VIDEO'
                                                ? 'ویدیو'
                                                : message.type === 'QUICK_REPLY'
                                                        ? 'کلید'
                                                        : 'محصول'
        const TypeIcon =
                message.type === 'TEXT'
                        ? Type
                        : message.type === 'IMAGE'
                                ? ImagePlus
                                : message.type === 'AUDIO'
                                        ? Mic
                                        : message.type === 'VIDEO'
                                                ? Film
                                                : message.type === 'QUICK_REPLY'
                                                        ? KeyRound
                                                        : ShoppingBag

        // Synthesize a MediaItem[] from the existing `message.mediaUrl` so the
        // MediaUploader shows a preview on edit instead of rendering empty.
        // Per the updated MediaItem contract: `file` is null for `initial`
        // items reconstructed from an existing S3 URL, and `remoteUrl` carries
        // the real S3 URL (so `item.remoteUrl ?? item.url` is the saved URL).
        const initialItems: MediaItem[] | undefined = useMemo((): MediaItem[] | undefined => {
                if (!message.mediaUrl) return undefined
                const kind: MediaItem['kind'] =
                        message.type === 'AUDIO' ? 'AUDIO' : message.type === 'VIDEO' ? 'VIDEO' : 'IMAGE'
                const item: MediaItem = {
                        id: `existing-${message.id}`,
                        kind,
                        file: null,
                        url: message.mediaUrl,
                        remoteUrl: message.mediaUrl,
                        uploaded: true,
                        progress: 100,
                        error: null,
                }
                return [item]
        }, [message.id, message.mediaUrl, message.type])

        // Upload a recorded voice blob to S3 via the shared IG uploads endpoint,
        // then store the returned HTTPS URL in `message.mediaUrl`.
        async function uploadVoice(blob: Blob) {
                setVoiceUploading(true)
                setVoiceError(null)
                try {
                        const formData = new FormData()
                        formData.append(
                                'files',
                                new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' }),
                        )
                        const res = await fetch('/api/uploads/instagram', { method: 'POST', body: formData })
                        const data = (await res.json().catch(() => ({}))) as {
                                files?: Array<{ url: string }>
                                error?: string
                        }
                        if (!res.ok || !data.files?.[0]?.url) {
                                setVoiceError(data?.error || 'آپلود صوت ناموفق بود.')
                                return
                        }
                        onUpdate({ mediaUrl: data.files[0].url })
                } catch {
                        setVoiceError('آپلود صوت ناموفق بود.')
                } finally {
                        setVoiceUploading(false)
                }
        }

        return (
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3">
                        {/* Card header */}
                        <div className="mb-2.5 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--bg-muted)] text-[10px] font-medium text-[var(--text-secondary)]">
                                                {(index + 1).toLocaleString('fa-IR')}
                                        </span>
                                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                                                <TypeIcon className="h-3 w-3" />
                                        </div>
                                        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{typeLabel}</span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                        <button
                                                type="button"
                                                onClick={onMoveUp}
                                                disabled={index === 0}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30"
                                                aria-label="بالا"
                                        >
                                                <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                                type="button"
                                                onClick={onMoveDown}
                                                disabled={index === total - 1}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30"
                                                aria-label="پایین"
                                        >
                                                <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                                type="button"
                                                onClick={onRemove}
                                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--danger)]"
                                                aria-label="حذف"
                                        >
                                                <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                </div>
                        </div>

                        {/* Card body — by type */}
                        {message.type === 'TEXT' && (
                                <textarea
                                        value={message.text}
                                        onChange={(e) => onUpdate({ text: e.target.value })}
                                        placeholder="مثلاً سلام! برای مشاهده قیمت‌ها به دایرکت مراجعه کنید."
                                        rows={3}
                                        className="input resize-none"
                                />
                        )}

                        {(message.type === 'IMAGE' ||
                                message.type === 'AUDIO' ||
                                message.type === 'VIDEO') && (
                                <div className="space-y-3">
                                        {/* AUDIO: show EITHER the recorder OR the uploaded-file preview,
                                            never both at once. When a file is already uploaded
                                            (message.mediaUrl set), show the audio player + a "حذف"
                                            button. Otherwise show the recorder + the upload fallback. */}
                                        {message.type === 'AUDIO' && message.mediaUrl ? (
                                                <div className="space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                                                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                                                                <Mic className="h-3.5 w-3.5" />
                                                                ویس ضبط‌شده
                                                        </p>
                                                        <audio src={message.mediaUrl} controls className="h-9 w-full" />
                                                        <button
                                                                type="button"
                                                                onClick={() => onUpdate({ mediaUrl: undefined })}
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                                                        >
                                                                <Trash2 className="h-3 w-3" />
                                                                حذف و ضبط دوباره
                                                        </button>
                                                </div>
                                        ) : message.type === 'AUDIO' ? (
                                                <div className="space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                                                        <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                                                                <Mic className="h-3.5 w-3.5" />
                                                                ضبط صدا
                                                        </p>
                                                        <VoiceRecorder
                                                                onRecorded={(blob) => void uploadVoice(blob)}
                                                                onCleared={() => onUpdate({ mediaUrl: undefined })}
                                                                maxSeconds={60}
                                                        />
                                                        {voiceUploading && (
                                                                <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                        در حال آپلود…
                                                                </p>
                                                        )}
                                                        {voiceError && (
                                                                <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--danger)]">
                                                                        <AlertCircle className="h-3 w-3" />
                                                                        {voiceError}
                                                                </p>
                                                        )}
                                                </div>
                                        ) : null}

                                        {/* MediaUploader only for IMAGE/VIDEO. For AUDIO, the recorder
                                            above handles file capture; no duplicate uploader. */}
                                        {message.type !== 'AUDIO' && (
                                                <div className="space-y-2">
                                                        <MediaUploader
                                                                kind={message.type}
                                                                maxImages={1}
                                                                initial={initialItems}
                                                                onChange={(items: MediaItem[]) => {
                                                                        if (items.length === 0) {
                                                                                onUpdate({ mediaUrl: undefined })
                                                                                return
                                                                        }
                                                                        const first = items[0]
                                                                // Per the MediaUploader contract: prefer `remoteUrl`
                                                                // (the real S3 URL) and fall back to `url` (which
                                                                // may be a blob: URL while still uploading).
                                                                const savedUrl = first.remoteUrl ?? first.url
                                                                onUpdate({
                                                                        mediaUrl: savedUrl,
                                                                        text: first.caption ?? message.text,
                                                                })
                                                        }}
                                                />
                                                </div>
                                        )}

                                        {(message.type === 'IMAGE' || message.type === 'VIDEO') && (
                                                <div className="space-y-1.5">
                                                        <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                                                                کپشن (اختیاری)
                                                        </label>
                                                        <input
                                                                value={message.text}
                                                                onChange={(e) => onUpdate({ text: e.target.value })}
                                                                placeholder="مثلاً تخفیف ویژه تا پایان هفته"
                                                                className="input"
                                                        />
                                                </div>
                                        )}
                                </div>
                        )}

                        {message.type === 'QUICK_REPLY' && (
                                <div className="space-y-2.5">
                                        <div className="space-y-1.5">
                                                <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                                                        متن اصلی
                                                </label>
                                                <textarea
                                                        value={message.text}
                                                        onChange={(e) => onUpdate({ text: e.target.value })}
                                                        placeholder="مثلاً چه اطلاعاتی نیاز داری؟"
                                                        rows={2}
                                                        className="input resize-none"
                                                />
                                        </div>
                                        <div className="space-y-1.5">
                                                <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                                                        نوع دکمه
                                                </label>
                                                <div className="flex gap-2">
                                                        <button
                                                                type="button"
                                                                onClick={() => onUpdate({ buttonType: 'button' })}
                                                                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                                                                        (message.buttonType ?? 'button') === 'button'
                                                                                ? 'border-[var(--white)] bg-[var(--white)] text-[var(--bg-base)]'
                                                                                : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                                                                }`}
                                                        >
                                                                دکمه حبابی (Button Template)
                                                        </button>
                                                        <button
                                                                type="button"
                                                                onClick={() => onUpdate({ buttonType: 'quick_reply' })}
                                                                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                                                                        message.buttonType === 'quick_reply'
                                                                                ? 'border-[var(--white)] bg-[var(--white)] text-[var(--bg-base)]'
                                                                                : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                                                                }`}
                                                        >
                                                                تراشه (Quick Reply)
                                                        </button>
                                                </div>
                                                <p className="text-[11px] text-[var(--text-muted)]">
                                                        {(message.buttonType ?? 'button') === 'button'
                                                                ? 'دکمه داخل حباب پیام — در Message Requests هم دیده می‌شود.'
                                                                : 'تراشه بالای کادر تایپ — بعد از کلیک ناپدید می‌شود.'}
                                                </p>
                                        </div>
                                        <div className="space-y-1.5">
                                                <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                                                        دکمه‌ها (حداکثر ۳)
                                                </label>
                                                <ButtonBuilder
                                                        buttons={message.buttons ?? []}
                                                        onChange={(buttons) => onUpdate({ buttons })}
                                                />
                                        </div>
                                </div>
                        )}

                        {message.type === 'PRODUCT' && (
                                <div className="space-y-3">
                                        <ProductPicker
                                                channelId={channelId}
                                                selectedId={message.productId}
                                                onSelect={(p) =>
                                                        onUpdate({
                                                                productId: p.id,
                                                        })
                                                }
                                        />
                                        {message.productId && (
                                                <div className="space-y-1.5">
                                                        <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                                                                متن همراه (اختیاری)
                                                        </label>
                                                        <input
                                                                value={message.text}
                                                                onChange={(e) => onUpdate({ text: e.target.value })}
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

// ── Button Builder (Vardast-style rows, replaces QuickRepliesEditor) ──────
//
// Each row is a single QUICK_REPLY button: title (max 20 chars — IG limit),
// optional URL (turns the button into a "link" type), up/down arrows to
// reorder, and a trash button. Max 3 buttons per message (Instagram limit).
// The buttons prop is the new object form (`QuickReplyButton[]`), which the
// backend zod schema now accepts alongside the legacy plain-string form.
function ButtonBuilder({
        buttons,
        onChange,
}: {
        buttons: QuickReplyButton[]
        onChange: (b: QuickReplyButton[]) => void
}) {
        const MAX = 3
        const TITLE_MAX = 20

        function update(idx: number, patch: Partial<QuickReplyButton>) {
                const next = buttons.map((b, i) => (i === idx ? { ...b, ...patch } : b))
                onChange(next)
        }

        function remove(idx: number) {
                onChange(buttons.filter((_, i) => i !== idx))
        }

        function move(idx: number, dir: -1 | 1) {
                const target = idx + dir
                if (target < 0 || target >= buttons.length) return
                const next = buttons.slice()
                const [item] = next.splice(idx, 1)
                next.splice(target, 0, item)
                onChange(next)
        }

        function add() {
                if (buttons.length >= MAX) return
                onChange([...buttons, { title: '' }])
        }

        return (
                <div className="space-y-2">
                        {buttons.length === 0 && (
                                <p className="text-[11px] text-[var(--text-muted)]">
                                        هنوز دکمه‌ای اضافه نشده.
                                </p>
                        )}

                        {buttons.map((b, idx) => {
                                const isLink = !!(b.url && b.url.trim())
                                return (
                                        <div
                                                key={idx}
                                                className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-2.5"
                                        >
                                                {/* Row 1: reorder handle + title + type badge + delete */}
                                                <div className="flex items-center gap-1.5">
                                                        <div className="flex flex-col">
                                                                <button
                                                                        type="button"
                                                                        onClick={() => move(idx, -1)}
                                                                        disabled={idx === 0}
                                                                        className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30"
                                                                        aria-label="بالا"
                                                                >
                                                                        <ArrowUp className="h-3 w-3" />
                                                                </button>
                                                                <button
                                                                        type="button"
                                                                        onClick={() => move(idx, 1)}
                                                                        disabled={idx === buttons.length - 1}
                                                                        className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-30"
                                                                        aria-label="پایین"
                                                                >
                                                                        <ArrowDown className="h-3 w-3" />
                                                                </button>
                                                        </div>

                                                        <input
                                                                value={b.title}
                                                                onChange={(e) => update(idx, { title: e.target.value.slice(0, TITLE_MAX) })}
                                                                placeholder="مثلاً قیمت‌ها"
                                                                maxLength={TITLE_MAX}
                                                                dir="auto"
                                                                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-xs text-[var(--text-primary)] outline-none placeholder:text-[var(--text-hint)]"
                                                        />

                                                        {/* Type badge — link if URL is set, otherwise postback/text. */}
                                                        <span
                                                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                                                                        isLink
                                                                                ? 'bg-[var(--bg-muted)] text-[var(--text-primary)]'
                                                                                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                                                                }`}
                                                        >
                                                                {isLink ? <Link2 className="h-3 w-3" /> : <Type className="h-3 w-3" />}
                                                                {isLink ? 'لینک' : 'متن'}
                                                        </span>

                                                        <button
                                                                type="button"
                                                                onClick={() => remove(idx)}
                                                                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--danger)]"
                                                                aria-label="حذف دکمه"
                                                        >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                </div>

                                                {/* Row 2: URL input — always visible (placeholder "لینک (اختیاری)"). */}
                                                <div className="mt-2 flex items-center gap-1.5 ps-7">
                                                        <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                                                        <input
                                                                value={b.url ?? ''}
                                                                onChange={(e) => update(idx, { url: e.target.value })}
                                                                placeholder="لینک (اختیاری)"
                                                                dir="ltr"
                                                                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-hint)]"
                                                        />
                                                </div>

                                                {/* Character-count hint for the title. */}
                                                <div className="mt-1 ps-7 text-[10px] text-[var(--text-muted)]">
                                                        {b.title.length.toLocaleString('fa-IR')} / {TITLE_MAX.toLocaleString('fa-IR')}
                                                </div>
                                        </div>
                                )
                        })}

                        {buttons.length < MAX && (
                                <button
                                        type="button"
                                        onClick={add}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
                                >
                                        <Plus className="h-3.5 w-3.5" />
                                        افزودن کلید
                                </button>
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

        // Load initial 20 products when first opened (or when channelId changes).
        useEffect(() => {
                if (!open) return
                let cancelled = false
                setLoading(true)
                fetch(`/api/products?sort=newest`)
                        .then((r) => r.json())
                        .then((d) => {
                                if (cancelled) return
                                const list: ProductLite[] = ((d.products ?? []) as ProductLite[]).slice(0, 20)
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
                                .then((d) => setItems(((d.products ?? []) as ProductLite[]).slice(0, 20)))
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
                        .then((d) => (d as { product?: ProductLite }).product && setSelected((d as { product: ProductLite }).product))
                        .catch(() => {})
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selectedId])

        return (
                <div className="space-y-2">
                        {selected ? (
                                <div className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2.5">
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
                                        className="flex w-full items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
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
