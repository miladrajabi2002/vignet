'use client'

import {
        useState,
        useRef,
        useMemo,
        useEffect,
        type FormEvent,
        type KeyboardEvent,
        type UIEvent,
} from 'react'
import { useRouter } from 'next/navigation'
import { useUnsavedChangesGuard } from '@/lib/hooks/use-unsaved-changes-guard'
import Link from 'next/link'
import dynamic from 'next/dynamic'
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
        AlertTriangle,
        Check,
        ArrowUp,
        ArrowDown,
        Trash2,
        Type,
        ShoppingBag,
        Layers,
        Shield,
        Mic,
        Film,
        Link2,
        Eye,
        ChevronLeft,
        type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { SAVED_BEAT_MS, SaveButton, useSaveState } from '@/components/ui/save-button'
import { IphonePreview } from '@/components/instagram/iphone-preview'
import type { MediaItem } from '@/components/instagram/media-uploader'
import { PageHeader } from '@/components/dashboard/page-header'
import { MobileBottomSheet } from '@/components/ui/mobile-bottom-sheet'
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
import { parseInstagramPostReferences } from '@/lib/instagram/post-reference'
import { ProductImage } from '@/components/products/product-image'

// These tools are only shown after the operator chooses a media/voice action.
// Keep them out of the initial form chunk without removing any capability.
const MediaUploader = dynamic(
        () => import('@/components/instagram/media-uploader').then((module) => module.MediaUploader),
        { loading: () => <div className="h-24 animate-pulse rounded-2xl bg-[var(--bg-muted)]" /> },
)
const VoiceRecorder = dynamic(
        () => import('@/components/instagram/voice-recorder').then((module) => module.VoiceRecorder),
        { loading: () => <div className="h-12 animate-pulse rounded-xl bg-[var(--bg-muted)]" /> },
)

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
        // COMMENT + dmOnComment: short public reply on the comment itself
        // (e.g. «تو دایرکت فرستادم 🌟») so the comment isn't left unanswered.
        commentAckEnabled: boolean
        commentAckText: string
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
        // For NEW scenarios, default the keyword filter to SPECIFIC so the user
        // is prompted to enter keywords right away. For EXISTING scenarios,
        // infer the filter from the stored keywords (ANY when empty, SPECIFIC
        // otherwise) so editing older rows round-trips correctly.
        const keywordFilter: KeywordFilter =
                a === undefined
                        ? 'SPECIFIC'
                        : (a?.trigger.keywords?.length ?? 0) > 0
                                ? 'SPECIFIC'
                                : 'ANY'
        // LEGACY FIX (v3.1): older builds mapped the comment "ارسال در دایرکت"
        // option to replyMode SILENT + dmOnComment true — which the engine then
        // skipped as silent, so the funnel never delivered anything. When
        // editing such a row, surface it as what it was meant to be: a STATIC
        // comment→DM sequence.
        const legacyCommentDm = type === 'COMMENT' && a?.action.dmOnComment === true
        const storedReplyMode = a?.action.replyMode ?? defaultReplyMode(type)
        const effectiveReplyMode =
                legacyCommentDm && storedReplyMode === 'SILENT' ? 'STATIC' : storedReplyMode
        // Legacy comment→DM rows stored the DM body in `contentText` (the old
        // single-textarea UI) — seed it into the builder so nothing is lost.
        let seededMessages: AutomationMessage[] = a?.action.messages?.length
                ? a.action.messages.map(normalizeMessage)
                : type === 'COMMENT'
                        ? [emptyTextMessage()]
                        : []
        if (legacyCommentDm && !a?.action.messages?.length) {
                const legacyBody = a?.action.contentText || a?.action.replyText || ''
                if (legacyBody) seededMessages = [{ id: newMessageId(), type: 'TEXT', text: legacyBody }]
        }
        const base: FormState = {
                name: a?.name ?? '',
                active: a?.active ?? true,
                priority: a?.priority ?? 0,
                keywords: a?.trigger.keywords ?? [],
                matchMode: a?.trigger.matchMode ?? 'CONTAINS',
                storyScope: a?.trigger.storyScope ?? 'KEYWORD',
                postFilter: (a?.trigger.postIds?.length ?? 0) > 0 ? 'SPECIFIC' : 'ANY',
                postIdsText: (a?.trigger.postIds ?? []).join(', '),
                keywordFilter,
                replyMode: effectiveReplyMode,
                messages: seededMessages,
                dmOnComment: a?.action.dmOnComment ?? false,
                // New COMMENT funnels default the public comment-ack ON (with the
                // default text) — the #1 operator complaint was comments left
                // unanswered while the reply went to DM. Existing rows keep their
                // stored value (absent field → OFF) so nothing changes until the
                // operator opts in.
                commentAckEnabled: a ? a.action.commentAckEnabled === true : true,
                commentAckText: a?.action.commentAckText ?? (a === undefined ? DEFAULT_COMMENT_ACK_TEXT : ''),
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

/** Adds comma/newline-separated keywords from `raw`, skipping duplicates. */
function mergeKeywords(keywords: string[], raw: string): string[] {
        const next = keywords.slice()
        for (const piece of raw.split(/[,\n]/)) {
                const p = piece.trim()
                if (p && !next.includes(p)) next.push(p)
        }
        return next
}

/** A message the engine can actually deliver (not an empty draft card). */
function hasMessageContent(m: AutomationMessage): boolean {
        return Boolean(
                m.text.trim() ||
                m.mediaUrl ||
                m.productId ||
                (m.productIds && m.productIds.length > 0) ||
                (m.buttons && m.buttons.length > 0),
        )
}

/** Default public ack posted on the comment when the reply goes to DM. */
const DEFAULT_COMMENT_ACK_TEXT = 'تو دایرکت فرستادم 🌟'

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
                productIds: Array.isArray(m.productIds)
                        ? m.productIds.filter((id) => typeof id === 'string' && !!id).slice(0, 10)
                        : [],
                buttons: rawButtons.slice(0, 3).map(toButton),
                buttonType: m.buttonType ?? 'button',
        }
}

// ── Public component ────────────────────────────────────────────────────
export function AutomationForm({
        agentId,
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
        const [initialForm] = useState<FormState>(() => toFormState(initial, type))
        const formDirty = useMemo(
                () => JSON.stringify(form) !== JSON.stringify(initialForm),
                [form, initialForm],
        )
        // Warn before the tab is closed/reloaded with unsaved scenario edits.
        useUnsavedChangesGuard(formDirty)
        const [keywordInput, setKeywordInput] = useState('')
        const saveState = useSaveState()
        const [error, setError] = useState<string | null>(null)
        const [postReferencesTouched, setPostReferencesTouched] = useState(false)
        const [resolvingPostReferences, setResolvingPostReferences] = useState(false)
        const [postReferenceFeedback, setPostReferenceFeedback] = useState<{
                kind: 'ok' | 'error'
                text: string
        } | null>(null)
        const nameRef = useRef<HTMLInputElement>(null)
        const parsedPostReferences = useMemo(
                () => parseInstagramPostReferences(form.postIdsText),
                [form.postIdsText],
        )

        // Auto-focus name on mount.
        useEffect(() => {
                nameRef.current?.focus()
        }, [])

        const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
                setForm((f) => ({ ...f, [k]: v }))

        async function resolvePostReferences(showGlobalError = false): Promise<string[] | null> {
                setPostReferencesTouched(true)
                const parsed = parseInstagramPostReferences(form.postIdsText)
                if (parsed.invalid.length > 0 || (parsed.ids.length === 0 && parsed.shortcodes.length === 0)) {
                        const text = parsed.invalid.length > 0
                                ? `لینک یا شناسه «${parsed.invalid[0]}» شناخته نشد.`
                                : 'لینک یا شناسه حداقل یک پست را وارد کنید.'
                        setPostReferenceFeedback({ kind: 'error', text })
                        if (showGlobalError) setError(text)
                        return null
                }

                if (parsed.shortcodes.length === 0) {
                        set('postIdsText', parsed.ids.join(', '))
                        setPostReferenceFeedback({
                                kind: 'ok',
                                text: `${parsed.ids.length.toLocaleString('fa-IR')} شناسه معتبر آماده است.`,
                        })
                        return parsed.ids
                }

                setResolvingPostReferences(true)
                setPostReferenceFeedback(null)
                try {
                        const response = await fetch(`/api/agents/${agentId}/instagram/media/resolve`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ references: form.postIdsText }),
                        })
                        const data = (await response.json().catch(() => ({}))) as {
                                ids?: string[]
                                error?: string
                        }
                        if (!response.ok || !Array.isArray(data.ids) || data.ids.length === 0) {
                                const text = data.error === 'PLAN_BLOCKED'
                                        ? 'برای استفاده از اتوماسیون اینستاگرام، دورهٔ آزمایشی یا اشتراک فعال لازم است.'
                                        : data.error === 'MEDIA_NOT_FOUND'
                                        ? 'این پست در پیج متصل پیدا نشد؛ مطمئن شوید لینک متعلق به همین پیج است.'
                                        : data.error === 'IG_RECONNECT_REQUIRED'
                                                ? 'برای استخراج شناسه، اتصال اینستاگرام را یک‌بار تازه‌سازی کنید.'
                                                : 'استخراج شناسه از Meta انجام نشد؛ دوباره تلاش کنید یا شناسه عددی را وارد کنید.'
                                setPostReferenceFeedback({ kind: 'error', text })
                                if (showGlobalError) setError(text)
                                return null
                        }

                        const ids = [...new Set(data.ids.filter((id) => /^\d{5,30}$/.test(id)))]
                        if (ids.length === 0) {
                                const text = 'Meta برای این لینک شناسه معتبری برنگرداند.'
                                setPostReferenceFeedback({ kind: 'error', text })
                                if (showGlobalError) setError(text)
                                return null
                        }
                        set('postIdsText', ids.join(', '))
                        setPostReferenceFeedback({
                                kind: 'ok',
                                text: `شناسه عددی ${ids.length.toLocaleString('fa-IR')} پست از Meta استخراج شد.`,
                        })
                        return ids
                } catch {
                        const text = 'ارتباط با Meta برای استخراج شناسه برقرار نشد؛ دوباره تلاش کنید.'
                        setPostReferenceFeedback({ kind: 'error', text })
                        if (showGlobalError) setError(text)
                        return null
                } finally {
                        setResolvingPostReferences(false)
                }
        }

        // ── Keyword tag input ─────────────────────────────────────────────────
        function addKeyword(raw: string) {
                if (!raw.trim()) return
                setKeywords((arr) => mergeKeywords(arr, raw))
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
                                                : t === 'PRODUCT_LIST'
                                                        ? { id: newMessageId(), type: 'PRODUCT_LIST', text: '', productIds: [] }
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
        function buildPayload(resolvedPostIds?: string[], keywords: string[] = form.keywords): {
                trigger: AutomationTrigger
                action: AutomationAction
        } {
                // Trigger keywords — empty when filter = ANY (matches all messages).
                const effectiveKeywords = form.keywordFilter === 'SPECIFIC' ? keywords : []
                const effectivePostIds =
                        type === 'COMMENT' && form.postFilter === 'SPECIFIC'
                                ? resolvedPostIds ?? parsedPostReferences.ids
                                : []

                const trigger: AutomationTrigger = {
                        keywords: effectiveKeywords,
                        matchMode: form.matchMode,
                        storyScope: type === 'STORY' ? form.storyScope : 'KEYWORD',
                        postIds: effectivePostIds,
                }

                // Build messages based on type + replyMode.
                // COMMENT funnels deliver in the commenter's DM, so the full rich
                // sequence (text/image/voice/video/keys/showcase) is allowed there;
                // public comment replies stay TEXT-only (Instagram API constraint).
                let messages: AutomationMessage[] = []
                if (form.replyMode === 'STATIC' || form.replyMode === 'MULTI_MESSAGE') {
                        if (type === 'DIRECT_MESSAGE' || type === 'STORY') {
                                messages = form.messages
                        } else if (type === 'COMMENT' && form.dmOnComment) {
                                // SEND_DM: the rich sequence goes to the commenter's DM.
                                messages = form.messages
                        } else if (type === 'COMMENT' && form.replyMode === 'MULTI_MESSAGE') {
                                // Public random reply — text only.
                                messages = form.messages.filter((m) => m.text.trim())
                        }
                }

                // Strip client-only fields and clean up empty buttons.
                const cleanedMessages = messages.map((m) => {
                        const out: Record<string, unknown> = {
                                type: m.type,
                        }
                        if (m.text?.trim()) out.text = m.text
                        // Defense-in-depth: NEVER emit a `blob:` URL into the saved
                        // payload — it is browser-session-local and would permanently
                        // break the scenario preview and media delivery. The submit()
                        // gate already blocks this; stripping here ensures no code path
                        // can persist it even if the gate is bypassed.
                        if (m.mediaUrl && !/^blob:/i.test(m.mediaUrl)) out.mediaUrl = m.mediaUrl
                        if (m.productId) out.productId = m.productId
                        // PRODUCT_LIST: cap at 10 (Meta carousel limit), drop empties.
                        if (m.type === 'PRODUCT_LIST' && m.productIds && m.productIds.length > 0) {
                                out.productIds = m.productIds.filter((id) => typeof id === 'string' && !!id).slice(0, 10)
                        }
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
                        // Public comment ack — only meaningful for the comment→DM
                        // funnel; the text is always persisted so toggling it back
                        // on later keeps the operator's draft (same as gate fields).
                        commentAckEnabled: type === 'COMMENT' && form.dmOnComment && form.commentAckEnabled,
                        commentAckText: type === 'COMMENT' && form.dmOnComment ? form.commentAckText.trim() : '',
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
                        nameRef.current?.focus({ preventScroll: true })
                        nameRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                        return
                }
                // A keyword typed but not yet confirmed with Enter still counts —
                // fold it in so the operator never loses the last word they typed.
                const keywords = mergeKeywords(form.keywords, keywordInput)
                if (keywords.length !== form.keywords.length) {
                        set('keywords', keywords)
                        setKeywordInput('')
                }
                if (form.keywordFilter === 'SPECIFIC' && keywords.length === 0) {
                        setError('حداقل یک کلمه‌کلیدی اضافه کنید یا حالت «هر کلمه‌ای» را انتخاب کنید.')
                        return
                }
                if (type === 'COMMENT' && form.postFilter === 'SPECIFIC') {
                        setPostReferencesTouched(true)
                        if (parsedPostReferences.ids.length === 0 && parsedPostReferences.shortcodes.length === 0) {
                                setError('لینک یا شناسه حداقل یک پست را وارد کنید.')
                                return
                        }
                        if (parsedPostReferences.invalid.length > 0) {
                                setError('یکی از لینک‌ها یا شناسه‌های پست معتبر نیست؛ مورد مشخص‌شده زیر فیلد را اصلاح کنید.')
                                return
                        }
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
                if (
                        type === 'COMMENT' &&
                        form.replyMode === 'MULTI_MESSAGE' &&
                        !form.messages.some((m) => m.text.trim())
                ) {
                        setError('متن حداقل یک گزینهٔ ریپلای را بنویسید.')
                        return
                }
                // ── MEDIA UPLOAD GATE ──────────────────────────────────────────────
                // A `blob:` mediaUrl means the media upload is still in-flight (or
                // failed). blob: URLs are session-local to the operator's browser —
                // persisting one produces a permanently broken preview (404) and the
                // automation can never deliver the media. Block the save instead and
                // tell the operator to wait for the upload to finish (or retry it).
                const unfinishedMedia = form.messages.find(
                        (m) => !!m.mediaUrl && /^blob:/i.test(m.mediaUrl),
                )
                if (unfinishedMedia) {
                        setError(
                                'آپلود عکس/ویدیو هنوز کامل نشده است یا ناموفق بوده است. لطفاً تا پایان آپلود (علامت ✓ روی پیش‌نمایش) صبر کنید و سپس ذخیره کنید؛ اگر آپلود خطا داده، روی «تلاش دوباره» بزنید یا فایل را حذف کنید.',
                        )
                        return
                }
                // COMMENT SEND_DM: the funnel delivers the builder sequence in DM —
                // require at least one non-empty message so the scenario can't be
                // saved in a state that silently no-ops.
                if (type === 'COMMENT' && form.dmOnComment) {
                        if (!form.messages.some(hasMessageContent)) {
                                setError('برای «ارسال در دایرکت» حداقل یک پیام اضافه کنید.')
                                return
                        }
                }
                saveState.start()
                setError(null)
                let saved = false
                try {
                        const resolvedPostIds = type === 'COMMENT' && form.postFilter === 'SPECIFIC'
                                ? await resolvePostReferences(true)
                                : undefined
                        if (type === 'COMMENT' && form.postFilter === 'SPECIFIC' && !resolvedPostIds) return
                        const { trigger, action } = buildPayload(resolvedPostIds ?? undefined, keywords)
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
                                                data?.error === 'PLAN_BLOCKED'
                                                        ? 'برای استفاده از اتوماسیون اینستاگرام، دورهٔ آزمایشی یا اشتراک فعال لازم است.'
                                                        : data?.error === 'IG_NOT_CONNECTED'
                                                        ? 'اینستاگرام متصل نیست.'
                                                        : data?.details
                                                                ? 'ذخیره ناموفق بود. ورودی‌ها را بررسی کنید.'
                                                                : 'ذخیره ناموفق بود.',
                                        )
                                        return
                                }
                                saved = true
                        } else if (initial) {
                                const res = await fetch(`${base}/${initial.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(body),
                                })
                                const data = await res.json().catch(() => ({}))
                                if (!res.ok || !data.automation) {
                                        setError(data?.error === 'PLAN_BLOCKED'
                                                ? 'برای استفاده از اتوماسیون اینستاگرام، دورهٔ آزمایشی یا اشتراک فعال لازم است.'
                                                : 'ذخیره ناموفق بود.')
                                        return
                                }
                                saved = true
                        }
                } finally {
                        if (saved) {
                                // Let the button confirm the save before the page moves on.
                                saveState.done()
                                window.setTimeout(() => router.push('/instagram'), SAVED_BEAT_MS)
                        } else {
                                saveState.fail()
                        }
                }
        }

        // ── Derived flags ─────────────────────────────────────────────────────
        const isDm = type === 'DIRECT_MESSAGE'
        const isComment = type === 'COMMENT'
        const isStory = type === 'STORY'

        // The preview needs the bot's message text and the user-side keyword.
        // When the keyword filter is ANY (match-all), use a placeholder bubble
        // so the iPhone preview still shows something meaningful.
        // Every trigger keyword, separated by « / », so the preview shows all
        // the words that start this scenario (not only the first one).
        const previewUserText =
                form.keywordFilter === 'SPECIFIC'
                        ? form.keywords.map((keyword) => keyword.trim()).filter(Boolean).join(' / ')
                        : 'سلام'
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

        // The rich message builder renders for STATIC sequences — DM, STORY and
        // the comment→DM funnel (SEND_DM), which delivers in the commenter's DM
        // so it supports the full media toolkit. COMMENT public replies
        // (MULTI_MESSAGE) are text-only and use their own section below.
        const showBuilder =
                form.replyMode === 'STATIC' &&
                (isDm || isStory || (isComment && form.dmOnComment))

        const previewProps: React.ComponentProps<typeof IphonePreview> = {
                mode: type,
                accountUsername: accountUsername || 'vigent.bot',
                accountAvatarUrl,
                userText: previewUserText,
                replyMode: form.replyMode,
                messages: previewMessages,
                dmOnComment: form.dmOnComment,
                commentAckEnabled: form.commentAckEnabled,
                commentAckText: form.commentAckText,
                followGate: form.followGate,
                gatePrompt: form.gatePrompt,
                gateButton: form.gateQuickReply,
        }

        // ── Readiness — the save button stays disabled until these are done ──
        // Mirrors the submit() gates (a typed-but-unconfirmed keyword counts).
        const ready = ![
                !form.name.trim(),
                form.keywordFilter === 'SPECIFIC' && form.keywords.length === 0 && !keywordInput.trim(),
                isComment &&
                        form.postFilter === 'SPECIFIC' &&
                        (parsedPostReferences.invalid.length > 0 ||
                                (parsedPostReferences.ids.length === 0 && parsedPostReferences.shortcodes.length === 0)),
                showBuilder && !form.messages.some(hasMessageContent),
                isComment && form.replyMode === 'MULTI_MESSAGE' && !form.messages.some((m) => m.text.trim()),
                form.messages.some((m) => !!m.mediaUrl && /^blob:/i.test(m.mediaUrl)),
        ].some(Boolean)

        const modeLabel = isDm ? 'دایرکت' : isComment ? 'کامنت پست' : 'پاسخ استوری'
        const flowSteps = buildFlowSteps(form, type)

        // Mobile preview sheet — opened from the top card or the save dock.
        const [previewOpen, setPreviewOpen] = useState(false)
        const previewTriggerRef = useRef<HTMLElement | null>(null)
        const openPreview = (e: React.MouseEvent<HTMLElement>) => {
                previewTriggerRef.current = e.currentTarget
                setPreviewOpen(true)
        }

        return (
                <div className="mx-auto max-w-7xl space-y-5">
                        {/* Page header — unified with the rest of the dashboard.
                            The Instagram gradient is preserved on the icon box via inline style. */}
                        <PageHeader
                                icon={HeaderIcon}
                                title={mode === 'create' ? 'افزودن سناریو' : 'ویرایش سناریو'}
                                subtitle={
                                        type === 'DIRECT_MESSAGE' ? 'پاسخ خودکار به پیام‌های مستقیم'
                                        : type === 'COMMENT' ? 'پاسخ خودکار به کامنت پست‌ها'
                                        : 'پاسخ خودکار به استوری‌ها'
                                }
                                back={{ href: '/instagram', label: 'اینستاگرام' }}
                        />

                        <form onSubmit={submit} className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                                {/* ── LEFT: form fields ────────────────────────────────────── */}
                                <div className="space-y-6">
                                        {/* Scenario name */}
                                        <Section id="automation-condition" title="مشخصات سناریو">
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
                                        </Section>

                                        {/* ─── Trigger section ─────────────────────────────────── */}
                                        <Section id="automation-trigger" title="شرط اجرا" Icon={Zap}>
                                                {/* COMMENT: post scope (any / specific) */}
                                                {isComment && (
                                                        <SegmentedField
                                                                label="کدام پست‌ها؟"
                                                                value={form.postFilter}
                                                                onChange={(v) => {
                                                                        set('postFilter', v as PostFilter)
                                                                        setPostReferencesTouched(false)
                                                                }}
                                                                options={[
                                                                        { value: 'ANY', label: 'هر پستی' },
                                                                        { value: 'SPECIFIC', label: 'پست‌های مشخص' },
                                                                ]}
                                                        />
                                                )}
                                                {isComment && form.postFilter === 'SPECIFIC' && (
                                                        <div className="space-y-1.5">
                                                                <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                                        لینک یا شناسه پست‌ها
                                                                </label>
                                                                <input
                                                                        dir="ltr"
                                                                        value={form.postIdsText}
                                                                        onChange={(e) => {
                                                                                set('postIdsText', e.target.value)
                                                                                if (postReferencesTouched) setPostReferencesTouched(false)
                                                                                setPostReferenceFeedback(null)
                                                                        }}
                                                                        onBlur={() => void resolvePostReferences()}
                                                                        aria-invalid={postReferencesTouched && (parsedPostReferences.invalid.length > 0 || postReferenceFeedback?.kind === 'error')}
                                                                        aria-describedby="instagram-post-reference-help"
                                                                        placeholder="https://www.instagram.com/p/DdMvc4dDhai/"
                                                                        autoCapitalize="none"
                                                                        autoCorrect="off"
                                                                        spellCheck={false}
                                                                        className={`input ${postReferencesTouched && (parsedPostReferences.invalid.length > 0 || postReferenceFeedback?.kind === 'error') ? 'border-red-400 focus:border-red-500' : ''}`}
                                                                />
                                                                {resolvingPostReferences ? (
                                                                        <p id="instagram-post-reference-help" role="status" className="flex items-center gap-1.5 text-[12px] leading-5 text-[var(--text-secondary)]">
                                                                                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
                                                                                در حال دریافت شناسه دقیق پست از Meta…
                                                                        </p>
                                                                ) : postReferencesTouched && (parsedPostReferences.invalid.length > 0 || postReferenceFeedback?.kind === 'error') ? (
                                                                        <p id="instagram-post-reference-help" role="alert" className="flex items-start gap-1.5 text-[12px] leading-5 text-red-700">
                                                                                <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                                                {postReferenceFeedback?.text ?? `لینک یا شناسه «${parsedPostReferences.invalid[0]}» شناخته نشد.`}
                                                                        </p>
                                                                ) : postReferenceFeedback?.kind === 'ok' ? (
                                                                        <p id="instagram-post-reference-help" role="status" className="flex items-center gap-1.5 text-[12px] leading-5 text-emerald-700">
                                                                                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                                                                                {postReferenceFeedback.text}
                                                                        </p>
                                                                ) : (
                                                                        <p id="instagram-post-reference-help" className="text-[12px] leading-5 text-[var(--text-muted)]">
                                                                                لینک پست یا ریلز را با یا بدون <bdi dir="ltr">www / https</bdi> وارد کنید؛ شناسه عددی خودکار استخراج می‌شود. کد کوتاه و شناسه عددی هم پذیرفته می‌شوند و چند مورد را می‌توانید با کاما جدا کنید.
                                                                        </p>
                                                                )}
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
                                                                        <p className="text-[12px] text-[var(--text-muted)]">
                                                                                به هر ریپلای یا منشن استوری پاسخ داده می‌شود.
                                                                        </p>
                                                                )}
                                                        </div>
                                                )}

                                                {/* Keyword filter (ANY / SPECIFIC) — for DM, COMMENT and STORY.
                                                        ANY  = scenario matches ALL messages (no keyword filtering).
                                                        SPECIFIC = scenario matches only when one of `keywords` is present. */}
                                                <SegmentedField
                                                        label="کدام کلمات؟"
                                                        value={form.keywordFilter}
                                                        onChange={(v) => set('keywordFilter', v as KeywordFilter)}
                                                        options={[
                                                                { value: 'ANY', label: 'هر کلمه‌ای' },
                                                                { value: 'SPECIFIC', label: 'کلمات خاص' },
                                                        ]}
                                                />

                                                {/* Keywords tag input — shown only when SPECIFIC is selected.
                                                        For DM/COMMENT/STORY alike. */}
                                                {form.keywordFilter === 'SPECIFIC' && (
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
                                                                <p className="text-[12px] text-[var(--text-muted)]">
                                                                        زمانی که کاربر کلمات زیر را در {isDm ? 'دایرکت' : isComment ? 'کامنت' : 'استوری'} ارسال کند، این سناریو اجرا می‌شود. با Enter یا کاما اضافه کنید.
                                                                </p>
                                                        </div>
                                                )}

                                                {/* Match mode — SEGMENTED CONTROL (DM only, only meaningful with SPECIFIC keywords) */}
                                                {isDm && form.keywordFilter === 'SPECIFIC' && (
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
                                        <Section id="automation-response" title="سپس" Icon={Sparkles}>
                                                {/* Action selector — depends on type */}
                                                {isDm && (
                                                        <DmActionSelector
                                                                value={form.replyMode}
                                                                onChange={(v) => set('replyMode', v)}
                                                        />
                                                )}
                                                {isComment && (
                                                        <>
                                                                <CommentActionSelector
                                                                        replyMode={form.replyMode}
                                                                        dmOnComment={form.dmOnComment}
                                                                        onReplyModeChange={(v) => set('replyMode', v)}
                                                                        onDmOnCommentChange={(v) => set('dmOnComment', v)}
                                                                />
                                                                {form.dmOnComment && !form.followGate && (
                                                                        <div className="flex flex-col gap-3 rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-amber-950 sm:flex-row sm:items-center" role="status">
                                                                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                                                                        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                                                                                        <p className="text-xs leading-6">
                                                                                                اگر تعامل بالایی دارید، شرط فالو را فعال کنید تا ارسال پیام به افراد غیرفالوور کمتر و ریسک محدودشدن پیج پایین‌تر شود.
                                                                                        </p>
                                                                                </div>
                                                                                <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                                set('followGate', true)
                                                                                                requestAnimationFrame(() => document.getElementById('automation-follow-gate')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
                                                                                        }}
                                                                                        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-amber-900/15 bg-white px-3 text-xs font-bold text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/50"
                                                                                >
                                                                                        فعال‌کردن شرط فالو
                                                                                </button>
                                                                        </div>
                                                                )}
                                                        </>
                                                )}
                                                {isStory && (
                                                        <StoryActionSelector
                                                                value={form.replyMode}
                                                                onChange={(v) => set('replyMode', v)}
                                                        />
                                                )}
                                        </Section>

                                        {/* ─── MESSAGE BUILDER (DM/STORY STATIC, COMMENT SEND_DM) ── */}
                                        {showBuilder && (
                                                <Section
                                                        id="automation-messages"
                                                        title={isComment && form.dmOnComment ? 'پیام‌های دایرکت' : 'دنباله پیام‌ها'}
                                                        Icon={isComment && form.dmOnComment ? Send : MessageCircle}
                                                >
                                                        <MessageBuilder
                                                                messages={form.messages}
                                                                onAdd={addMessage}
                                                                onUpdate={updateMessage}
                                                                onRemove={removeMessage}
                                                                onMove={moveMessage}
                                                        />
                                                        <p className="text-[12px] text-[var(--text-muted)]">
                                                                {isComment && form.dmOnComment
                                                                        ? 'به‌جای ریپلای عمومی، این پیام‌ها در دایرکتِ کامنت‌گذار ارسال می‌شوند. می‌توانید متن، عکس، وویس، ویدیو، کلید و ویترین محصول اضافه کنید.'
                                                                        : 'پیام‌ها به‌ترتیب ارسال می‌شوند. می‌توانید متن، عکس، وویس، ویدیو، کلید و ویترین محصول را به دنباله اضافه کنید.'}
                                                        </p>
                                                </Section>
                                        )}

                                        {/* ─── COMMENT SEND_DM: public ack on the comment ─────── */}
                                        {/* The DM body must never leak publicly; this only posts a
                                            short operator-configured line under the comment itself
                                            so the comment isn't left unanswered. */}
                                        {isComment && form.dmOnComment && (
                                                <Section title="پاسخ روی کامنت" Icon={MessageSquare}>
                                                        <div className="flex items-start justify-between gap-3">
                                                                <div className="flex min-w-0 items-start gap-2.5">
                                                                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
                                                                        <div className="min-w-0">
                                                                                <p className="text-sm font-medium text-[var(--text-primary)]">
                                                                                        ریپلای عمومی روی کامنت
                                                                                </p>
                                                                                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                                                                                        بعد از ارسال دایرکت، یک پاسخ کوتاه زیر همان کامنت ثبت می‌شود تا کامنت بی‌جواب نماند.
                                                                                </p>
                                                                        </div>
                                                                </div>
                                                                <Switch
                                                                        checked={form.commentAckEnabled}
                                                                        onChange={(v) => {
                                                                                set('commentAckEnabled', v)
                                                                                if (v && !form.commentAckText.trim()) {
                                                                                        set('commentAckText', DEFAULT_COMMENT_ACK_TEXT)
                                                                                }
                                                                        }}
                                                                        aria-label="ریپلای عمومی روی کامنت"
                                                                />
                                                        </div>
                                                        {form.commentAckEnabled && (
                                                                <div className="space-y-1.5">
                                                                        <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                                                متن ریپلای
                                                                        </label>
                                                                        <textarea
                                                                                value={form.commentAckText}
                                                                                onChange={(e) => set('commentAckText', e.target.value)}
                                                                                placeholder="مثلاً: تو دایرکت فرستادم 🌟"
                                                                                rows={2}
                                                                                maxLength={200}
                                                                                className="input resize-none"
                                                                        />
                                                                        <p className="text-[12px] text-[var(--text-muted)]">
                                                                                این متن فقط زیر کامنت نمایش داده می‌شود و محتوای دایرکت را فاش نمی‌کند.
                                                                        </p>
                                                                </div>
                                                        )}
                                                </Section>
                                        )}

                                        {/* ─── COMMENT MULTI_MESSAGE: list of reply options ─────── */}
                                        {isComment && form.replyMode === 'MULTI_MESSAGE' && (
                                                <Section id="automation-messages" title="گزینه‌های پاسخ" Icon={MessageSquare}>
                                                        <div className="space-y-2">
                                                                <label className="text-xs font-medium text-[var(--text-secondary)]">
                                                                        یکی به‌صورت تصادفی ریپلای می‌شود
                                                                </label>
                                                                {form.messages.map((m, idx) => (
                                                                        <div key={m.id} className="flex items-start gap-2">
                                                                                <div className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[12px] font-medium text-[var(--text-secondary)]">
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
                                        <Section id="automation-follow-gate" title="شرط دنبال کردن" Icon={Shield}>
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
                                                                        <p className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-2 text-[12px] leading-5 text-amber-900">
                                                                                برای پیج‌های پرتعاملی پیشنهاد می‌شود؛ تعداد ارسال به افراد غیرفالوور را کمتر می‌کند و ریسک محدودشدن پیج را پایین می‌آورد.
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
                                                                <p className="rounded-lg bg-[var(--bg-base)] px-3 py-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
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
                                                <p className="flex items-start gap-2 rounded-lg bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-xs text-[var(--danger)]">
                                                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                        <span className="leading-relaxed">{error}</span>
                                                </p>
                                        )}

                                        {/* Footer — one compact sticky dock. On phones it also
                                            carries the preview button, beside the save action. */}
                                        <div
                                                id="automation-publish"
                                                data-sticky-actions=""
                                                className="sticky z-20 scroll-mt-28 [bottom:max(0.75rem,env(safe-area-inset-bottom))] md:bottom-4"
                                        >
                                                <div className="rounded-card border border-black/[0.07] bg-white/90 p-1.5 shadow-[var(--elev-2)] backdrop-blur-xl backdrop-saturate-150 sm:p-2">
                                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                                                <MobilePreviewButton onOpen={openPreview} />
                                                                {ready ? (
                                                                        <p className="hidden min-w-0 flex-1 items-center gap-2 truncate px-2 text-[12px] font-medium text-[var(--text-muted)] lg:flex">
                                                                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${form.active ? 'bg-success' : 'bg-[var(--text-hint)]'}`} />
                                                                                {`${form.name.trim()} · ${
                                                                                        mode === 'create'
                                                                                                ? 'بلافاصله پس از افزودن فعال می‌شود'
                                                                                                : form.active ? 'فعال' : 'غیرفعال'
                                                                                }`}
                                                                        </p>
                                                                ) : (
                                                                        <span aria-hidden className="hidden flex-1 lg:block" />
                                                                )}
                                                                <Link
                                                                        href="/instagram"
                                                                        className="hidden min-h-11 shrink-0 items-center rounded-2xl px-4 text-sm font-semibold text-[var(--text-secondary)] transition-colors hover:bg-black/[0.05] hover:text-[var(--text-primary)] sm:inline-flex"
                                                                >
                                                                        انصراف
                                                                </Link>
                                                                <SaveButton
                                                                        type="submit"
                                                                        state={saveState.state}
                                                                        disabled={!ready}
                                                                        label={mode === 'create' ? 'افزودن سناریو' : 'ذخیره تغییرات'}
                                                                        className="flex-1 lg:flex-none"
                                                                />
                                                        </div>
                                                </div>
                                        </div>
                                </div>

                                {/* ── RIGHT: sticky live iPhone preview ──────────────────── */}
                                <div className="hidden lg:block">
                                        <div className="sticky top-24">
                                                <PreviewStage
                                                        Icon={HeaderIcon}
                                                        modeLabel={modeLabel}
                                                        steps={flowSteps}
                                                        previewProps={previewProps}
                                                />
                                        </div>
                                </div>

                                <MobilePreviewSheet
                                        open={previewOpen}
                                        onClose={() => setPreviewOpen(false)}
                                        triggerRef={previewTriggerRef}
                                        modeLabel={modeLabel}
                                        steps={flowSteps}
                                        previewProps={previewProps}
                                />

                        </form>
                </div>
        )
}

// ── Desktop preview stage ─────────────────────────────────────────────────
const IG_GRADIENT = 'linear-gradient(45deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)'

interface FlowStep {
        Icon: LucideIcon
        label: string
        /** Still needs operator input — drawn as a dashed placeholder chip. */
        pending?: boolean
}

/** Plain-language «trigger → … → reply» summary of what the preview shows. */
function buildFlowSteps(form: FormState, type: AutomationType): FlowStep[] {
        const faNum = (n: number) => n.toLocaleString('fa-IR')
        const keywords = form.keywords.map((k) => k.trim()).filter(Boolean)
        const keywordLabel =
                keywords.length === 0 ? null
                : keywords.length === 1 ? `«${keywords[0]}»`
                : `«${keywords[0]}» و ${faNum(keywords.length - 1)} کلمه دیگر`
        const specific = form.keywordFilter === 'SPECIFIC'
        const steps: FlowStep[] = []

        if (type === 'DIRECT_MESSAGE') {
                steps.push({ Icon: MessageCircle, label: specific ? 'پیام دایرکت' : 'هر پیام دایرکت' })
        } else if (type === 'COMMENT') {
                steps.push({
                        Icon: MessageSquare,
                        label: form.postFilter === 'SPECIFIC' ? 'کامنت روی پست‌های مشخص' : 'کامنت روی هر پست',
                })
        } else {
                steps.push({ Icon: Circle, label: form.storyScope === 'ALL' ? 'هر پاسخ به استوری' : 'پاسخ به استوری' })
        }
        if (specific && !(type === 'STORY' && form.storyScope === 'ALL')) {
                steps.push({ Icon: Tag, label: keywordLabel ?? 'کلمه کلیدی؟', pending: !keywordLabel })
        }
        if (form.followGate) steps.push({ Icon: Shield, label: 'بررسی فالو' })

        const count = form.messages.filter(hasMessageContent).length
        if (type === 'COMMENT') {
                if (form.dmOnComment) {
                        steps.push({ Icon: Send, label: count ? `${faNum(count)} پیام در دایرکت` : 'پیام دایرکت؟', pending: !count })
                        if (form.commentAckEnabled && form.commentAckText.trim()) {
                                steps.push({ Icon: MessageSquare, label: 'ریپلای زیر کامنت' })
                        }
                } else if (form.replyMode === 'MULTI_MESSAGE') {
                        const options = form.messages.filter((m) => m.text.trim()).length
                        steps.push({
                                Icon: MessageSquare,
                                label: options === 0 ? 'متن ریپلای؟'
                                        : options === 1 ? 'ریپلای عمومی'
                                        : `ریپلای تصادفی از ${faNum(options)} گزینه`,
                                pending: options === 0,
                        })
                } else {
                        steps.push({ Icon: Circle, label: 'بدون ریپلای' })
                }
                return steps
        }
        if (form.replyMode === 'AI') steps.push({ Icon: Bot, label: 'پاسخ هوشمند ایجنت' })
        else if (form.replyMode === 'STATIC') steps.push({ Icon: Send, label: count ? `${faNum(count)} پیام سفارشی` : 'پیام سفارشی؟', pending: !count })
        else if (form.replyMode === 'STOP_AI') steps.push({ Icon: Zap, label: 'توقف هوش مصنوعی' })
        else steps.push({ Icon: Circle, label: 'بدون پاسخ' })
        return steps
}

function PreviewStage({
        Icon,
        modeLabel,
        steps,
        previewProps,
}: {
        Icon: LucideIcon
        modeLabel: string
        steps: FlowStep[]
        previewProps: React.ComponentProps<typeof IphonePreview>
}) {
        return (
                <section aria-label="پیش‌نمایش زنده سناریو" className="spatial-surface overflow-hidden rounded-[1.75rem]">
                        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
                                <div className="flex min-w-0 items-center gap-2.5">
                                        <span
                                                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white shadow-[0_8px_18px_-8px_rgba(221,42,123,0.7)]"
                                                style={{ background: IG_GRADIENT }}
                                        >
                                                <Icon className="h-4 w-4" aria-hidden="true" />
                                        </span>
                                        <div className="min-w-0">
                                                <p className="text-sm font-bold text-[var(--text-primary)]">پیش‌نمایش زنده</p>
                                                <p className="truncate text-[12px] text-[var(--text-muted)]">
                                                        {modeLabel} · همان چیزی که مشتری می‌بیند
                                                </p>
                                        </div>
                                </div>
                                <LivePill />
                        </div>

                        <StageBackdrop className="mx-3 px-4 py-5">
                                {/* Sized from the viewport height so the whole phone stays
                                    in view while the column is sticky (19rem ≈ sticky offset
                                    + header + flow summary). */}
                                <div
                                        className="w-full"
                                        style={{ maxWidth: `min(340px, max(240px, calc((100dvh - 19rem) / ${PHONE_RATIO})))` }}
                                >
                                        <IphonePreview {...previewProps} frameClassName="max-w-none" />
                                </div>
                        </StageBackdrop>

                        <FlowSummary steps={steps} className="px-5 pb-4 pt-3" />
                </section>
        )
}

/** Framed phone height ÷ width (screen 393×852 plus the 2.1% bezel). */
const PHONE_RATIO = 2.12

function LivePill() {
        return (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[12px] font-bold text-success">
                        <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
                                <span className="relative h-1.5 w-1.5 rounded-full bg-success" />
                        </span>
                        زنده
                </span>
        )
}

/** Dotted backdrop + a soft Instagram-gradient glow, so the phone reads as the hero. */
function StageBackdrop({ className, children }: { className?: string; children: React.ReactNode }) {
        return (
                <div
                        className={cn(
                                'relative isolate grid place-items-center overflow-hidden rounded-[1.35rem] border border-black/[0.05] bg-[var(--bg-muted)]',
                                className,
                        )}
                        style={{
                                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.07) 1px, transparent 0)',
                                backgroundSize: '18px 18px',
                        }}
                >
                        <div
                                aria-hidden
                                className="pointer-events-none absolute left-1/2 top-[45%] -z-10 aspect-square w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
                                style={{ background: IG_GRADIENT }}
                        />
                        {children}
                </div>
        )
}

function FlowSummary({ steps, className }: { steps: FlowStep[]; className?: string }) {
        return (
                <div className={className}>
                        <p className="mb-2 text-[12px] font-bold text-[var(--text-muted)]">مسیر سناریو</p>
                        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
                                {steps.map((step, i) => (
                                        <li key={`${i}-${step.label}`} className="flex min-w-0 items-center gap-1">
                                                {i > 0 && <ChevronLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--text-hint)]" />}
                                                <span
                                                        className={cn(
                                                                'inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold',
                                                                step.pending
                                                                        ? 'border-dashed border-[var(--border-hover)] text-[var(--text-muted)]'
                                                                        : 'border-[var(--border-subtle)] bg-[var(--bg-base)] text-[var(--text-primary)]',
                                                        )}
                                                >
                                                        <step.Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                                                        <span className="max-w-[12rem] truncate">{step.label}</span>
                                                </span>
                                        </li>
                                ))}
                        </ol>
                </div>
        )
}

// ── Mobile preview ────────────────────────────────────────────────────────
// Gradient button in the save dock, right beside «افزودن سناریو»; it opens a
// sheet that mirrors the desktop stage.
function MobilePreviewButton({ onOpen }: { onOpen: (e: React.MouseEvent<HTMLElement>) => void }) {
        return (
                <button
                        type="button"
                        onClick={onOpen}
                        aria-haspopup="dialog"
                        className="spatial-press inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-transparent px-3.5 text-sm font-bold text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] lg:hidden"
                        style={{ background: `linear-gradient(#fff, #fff) padding-box, ${IG_GRADIENT} border-box` }}
                >
                        <span className="grid h-6 w-6 place-items-center rounded-lg text-white" style={{ background: IG_GRADIENT }}>
                                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        پیش‌نمایش
                </button>
        )
}

function MobilePreviewSheet({
        open,
        onClose,
        triggerRef,
        modeLabel,
        steps,
        previewProps,
}: {
        open: boolean
        onClose: () => void
        triggerRef: { current: HTMLElement | null }
        modeLabel: string
        steps: FlowStep[]
        previewProps: React.ComponentProps<typeof IphonePreview>
}) {
        return (
                <MobileBottomSheet
                        open={open}
                        title="پیش‌نمایش زنده"
                        description={`${modeLabel} · همان چیزی که مشتری می‌بیند`}
                        closeLabel="بستن پیش‌نمایش"
                        size="large"
                        triggerRef={triggerRef}
                        onClose={onClose}
                        contentClassName="flex flex-col overflow-hidden p-0"
                >
                        <FitPhoneStage previewProps={previewProps} />
                        <FlowSummary steps={steps} className="shrink-0 px-4 pt-3" />
                </MobileBottomSheet>
        )
}

/**
 * Fills whatever height the sheet leaves after its header and the flow
 * summary, and sizes the phone from the measured box — the whole device is
 * always visible, with no inner scroll, on any phone height.
 */
function FitPhoneStage({ previewProps }: { previewProps: React.ComponentProps<typeof IphonePreview> }) {
        const boxRef = useRef<HTMLDivElement>(null)
        const [width, setWidth] = useState(0)
        useEffect(() => {
                const box = boxRef.current
                if (!box) return
                const observer = new ResizeObserver(([entry]) => {
                        const { width: w, height: h } = entry.contentRect
                        setWidth(Math.floor(Math.min(320, w, h / PHONE_RATIO)))
                })
                observer.observe(box)
                return () => observer.disconnect()
        }, [])
        return (
                <StageBackdrop className="mx-3 mt-3 min-h-0 flex-1 px-4 py-4">
                        <div ref={boxRef} className="absolute inset-4" aria-hidden />
                        {width > 0 && (
                                <div style={{ width }}>
                                        <IphonePreview {...previewProps} frameClassName="max-w-none" />
                                </div>
                        )}
                </StageBackdrop>
        )
}

// ── Section wrapper ───────────────────────────────────────────────────────
function Section({
        id,
        title,
        Icon,
        collapsible = false,
        defaultCollapsed = false,
        children,
}: {
        id?: string
        title: string
        Icon?: LucideIcon
        collapsible?: boolean
        defaultCollapsed?: boolean
        children: React.ReactNode
}) {
        const [open, setOpen] = useState(!defaultCollapsed)
        if (!collapsible) {
                return (
                        <section id={id} className="spatial-surface scroll-mt-28 space-y-4 rounded-card p-5 sm:p-6">
                                <div className="flex items-center gap-2.5">
                                        {Icon && (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--text-primary)_10%,transparent)] text-[var(--text-primary)]">
                                                        <Icon className="h-4 w-4" />
                                                </div>
                                        )}
                                        <h2 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
                                </div>
                                {children}
                        </section>
                )
        }
        return (
                <section id={id} className="spatial-surface scroll-mt-28 overflow-hidden rounded-card">
                        <button
                                type="button"
                                onClick={() => setOpen((v) => !v)}
                                className="flex w-full items-center justify-between gap-2 px-5 py-4 text-start transition-colors hover:bg-[var(--bg-hover)] sm:px-6"
                        >
                                <div className="flex items-center gap-2.5">
                                        {Icon && (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--text-primary)_10%,transparent)] text-[var(--text-primary)]">
                                                        <Icon className="h-4 w-4" />
                                                </div>
                                        )}
                                        <h2 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">{title}</h2>
                                </div>
                                <ChevronDown
                                        className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
                                />
                        </button>
                        {open && <div className="space-y-4 border-t border-[var(--border-subtle)] px-5 py-5 sm:px-6">{children}</div>}
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
                                                        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
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
                        // SEND_DM is a STATIC sequence delivered in the commenter's DM —
                        // NOT 'SILENT'. (Older builds stored SILENT here, which made the
                        // engine skip the reply entirely — the "commented the keyword
                        // but nothing was sent" bug.)
                        onReplyModeChange('STATIC')
                        onDmOnCommentChange(true)
                }
        }
        const opts: { value: 'SILENT' | 'MULTI_MESSAGE' | 'SEND_DM'; label: string; desc: string; Icon: LucideIcon }[] = [
                { value: 'SILENT', label: 'ریپلای نکن', desc: 'کامنت بدون پاسخ رها می‌شود', Icon: Circle },
                { value: 'MULTI_MESSAGE', label: 'یکی از پیام‌ها', desc: 'به‌صورت تصادفی یکی از گزینه‌ها', Icon: MessageSquare },
                { value: 'SEND_DM', label: 'ارسال در دایرکت', desc: 'به‌جای ریپلای عمومی، پیام‌ها در دایرکت ارسال می‌شود', Icon: Send },
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
                                                        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{desc}</p>
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
                                                        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">
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
        onAdd,
        onUpdate,
        onRemove,
        onMove,
        }: {
                messages: AutomationMessage[]
        onAdd: (t: MessageType) => void
        onUpdate: (id: string, patch: Partial<AutomationMessage>) => void
        onRemove: (id: string) => void
        onMove: (id: string, dir: -1 | 1) => void
}) {
        // All six message types the builder supports. AUDIO and VIDEO are now
        // first-class options (previously only IMAGE existed, with a misleading
        // "عکس، وویس، ویدیو" label that only ever created an IMAGE entry).
        //
        // Note: PRODUCT (single-card) is intentionally NOT in this list anymore.
        // PRODUCT_LIST handles both cases — when the user picks a single product
        // the engine sends a regular product card (no carousel chrome), and when
        // they pick 2+ it sends a horizontal carousel. This collapses two
        // near-identical buttons into one and removes a recurring source of
        // confusion ("which one do I pick?").
        // The legacy PRODUCT type is still rendered in MessageCard (and still
        // round-trips through the API/engine) so existing scenarios that use it
        // remain editable — only NEW PRODUCT entries can't be created from the UI.
        const addOptions: { value: MessageType; label: string; Icon: LucideIcon }[] = [
                { value: 'TEXT', label: 'متن', Icon: Type },
                { value: 'IMAGE', label: 'عکس', Icon: ImagePlus },
                { value: 'AUDIO', label: 'صوت', Icon: Mic },
                { value: 'VIDEO', label: 'ویدیو', Icon: Film },
                { value: 'QUICK_REPLY', label: 'کلید', Icon: KeyRound },
                { value: 'PRODUCT_LIST', label: 'ویترین محصولات', Icon: Layers },
        ]

        return (
                <div className="space-y-3">
                        {/* Header: count badge + hint — makes it OBVIOUS the user can stack messages. */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-base)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-secondary)]">
                                        <MessageCircle className="h-3 w-3" />
                                        {messages.length > 0
                                                ? `${messages.length.toLocaleString('fa-IR')} پیام`
                                                : 'بدون پیام'}
                                </span>
                                <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
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
                                <p className="mb-2.5 text-[12px] font-medium text-[var(--text-secondary)]">
                                        افزودن پیام
                                </p>
                                <div className="grid grid-cols-3 gap-1.5">
                                        {addOptions.map(({ value, label, Icon }) => (
                                                <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => onAdd(value)}
                                                        className="group flex flex-col items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-2.5 text-[12px] font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:scale-95"
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
        onUpdate,
        onRemove,
        onMoveUp,
        onMoveDown,
}: {
        message: AutomationMessage
        index: number
        total: number
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
                                                        : 'ویترین محصولات'
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
                                setVoiceError(data?.error === 'PLAN_BLOCKED'
                                        ? 'برای آپلود رسانهٔ اتوماسیون، دورهٔ آزمایشی یا اشتراک فعال لازم است.'
                                        : data?.error || 'آپلود صوت ناموفق بود.')
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
                                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--bg-muted)] text-[12px] font-medium text-[var(--text-secondary)]">
                                                {(index + 1).toLocaleString('fa-IR')}
                                        </span>
                                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                                                <TypeIcon className="h-3 w-3" />
                                        </div>
                                        <span className="text-[12px] font-medium text-[var(--text-secondary)]">{typeLabel}</span>
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
                                                        <p className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
                                                                <Mic className="h-3.5 w-3.5" />
                                                                ویس ضبط‌شده
                                                        </p>
                                                        <audio src={message.mediaUrl} controls className="h-9 w-full" />
                                                        <button
                                                                type="button"
                                                                onClick={() => onUpdate({ mediaUrl: undefined })}
                                                                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                                                        >
                                                                <Trash2 className="h-3 w-3" />
                                                                حذف و ضبط دوباره
                                                        </button>
                                                </div>
                                        ) : message.type === 'AUDIO' ? (
                                                <div className="space-y-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                                                        <p className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
                                                                <Mic className="h-3.5 w-3.5" />
                                                                ضبط صدا
                                                        </p>
                                                        <VoiceRecorder
                                                                onRecorded={(blob) => void uploadVoice(blob)}
                                                                onCleared={() => onUpdate({ mediaUrl: undefined })}
                                                                maxSeconds={60}
                                                        />
                                                        {voiceUploading && (
                                                                <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                        در حال آپلود…
                                                                </p>
                                                        )}
                                                        {voiceError && (
                                                                <p className="inline-flex items-center gap-1.5 text-[12px] text-[var(--danger)]">
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
                                                        <label className="text-[12px] font-medium text-[var(--text-secondary)]">
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
                                                <label className="text-[12px] font-medium text-[var(--text-secondary)]">
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
                                                <label className="text-[12px] font-medium text-[var(--text-secondary)]">
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
                                                <p className="text-[12px] text-[var(--text-muted)]">
                                                        {(message.buttonType ?? 'button') === 'button'
                                                                ? 'دکمه داخل حباب پیام — در Message Requests هم دیده می‌شود.'
                                                                : 'تراشه بالای کادر تایپ — بعد از کلیک ناپدید می‌شود.'}
                                                </p>
                                        </div>
                                        <div className="space-y-1.5">
                                                <label className="text-[12px] font-medium text-[var(--text-secondary)]">
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
                                                selectedId={message.productId}
                                                onSelect={(p) =>
                                                        onUpdate({
                                                                productId: p.id,
                                                        })
                                                }
                                        />
                                        {message.productId && (
                                                <div className="space-y-1.5">
                                                        <label className="text-[12px] font-medium text-[var(--text-secondary)]">
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

                        {message.type === 'PRODUCT_LIST' && (
                                <div className="space-y-3">
                                        <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                                                یک محصول = کارت محصول تکی، دو یا بیشتر = ویترین افقی قابل‌scroll. ترتیب با فلش‌های بالا/پایین قابل تغییره. حداکثر ۱۰ محصول.
                                        </p>
                                        <MultiProductPicker
                                                selectedIds={message.productIds ?? []}
                                                onChange={(ids) => onUpdate({ productIds: ids })}
                                        />
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
                                <p className="text-[12px] text-[var(--text-muted)]">
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
                                                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium ${
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
                                                                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-[12px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-hint)]"
                                                        />
                                                </div>

                                                {/* Character-count hint for the title. */}
                                                <div className="mt-1 ps-7 text-[12px] text-[var(--text-muted)]">
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

// ── Shared paged product list (v3.3) ────────────────────────────────────
// Pickers used to load the FULL product list on open — with hundreds of
// products that meant a slow first paint and a heavy payload. Now the first
// page is the 10 NEWEST products ("۱۰ تا آخر"), search runs server-side, and
// more pages stream in via infinite scroll (or the "نمایش بیشتر" button).
const PICKER_PAGE_SIZE = 10

interface PagedProductList {
        items: ProductLite[]
        total: number
        loading: boolean
        loadingMore: boolean
        hasMore: boolean
        loadMore: () => void
        handleListScroll: (e: UIEvent<HTMLDivElement>) => void
}

function useProductPickerPages(open: boolean, q: string): PagedProductList {
        const [items, setItems] = useState<ProductLite[]>([])
        const [total, setTotal] = useState(0)
        const [loading, setLoading] = useState(false)
        const [loadingMore, setLoadingMore] = useState(false)
        const [hasMore, setHasMore] = useState(false)
        // Request sequence — guards against an older page-1 response arriving
        // after a newer one (typing while a fetch is in flight).
        const seqRef = useRef(0)
        // Latest items/query for the imperative loadMore (avoids stale closure).
        const stateRef = useRef({ items: [] as ProductLite[], q: '' })
        stateRef.current = { items, q: q.trim() }

        // (Re)load the FIRST page: immediately when the picker opens or the
        // query is cleared, debounced 300 ms while the user is typing.
        useEffect(() => {
                if (!open) return
                let cancelled = false
                const run = () => {
                        const seq = ++seqRef.current
                        setLoading(true)
                        const params = new URLSearchParams({
                                sort: 'newest',
                                limit: String(PICKER_PAGE_SIZE),
                        })
                        if (q.trim()) params.set('q', q.trim())
                        fetch(`/api/products?${params.toString()}`)
                                .then((r) => r.json())
                                .then((d: { products?: ProductLite[]; total?: number }) => {
                                        if (cancelled || seq !== seqRef.current) return
                                        const list = (d.products ?? []) as ProductLite[]
                                        const t = d.total ?? list.length
                                        setItems(list)
                                        setTotal(t)
                                        setHasMore(list.length < t)
                                })
                                .catch(() => {})
                                .finally(() => {
                                        if (!cancelled && seq === seqRef.current) setLoading(false)
                                })
                }
                if (q.trim()) {
                        const timer = setTimeout(run, 300)
                        return () => {
                                cancelled = true
                                clearTimeout(timer)
                        }
                }
                run()
                return () => {
                        cancelled = true
                }
        }, [open, q])

        // Append the next page (called by the scroll handler / "نمایش بیشتر").
        async function loadMore() {
                const { items: current, q: query } = stateRef.current
                if (loading || loadingMore || !hasMore || current.length === 0) return
                const seq = ++seqRef.current
                setLoadingMore(true)
                const params = new URLSearchParams({
                        sort: 'newest',
                        limit: String(PICKER_PAGE_SIZE),
                        offset: String(current.length),
                })
                if (query) params.set('q', query)
                try {
                        const r = await fetch(`/api/products?${params.toString()}`)
                        const d = (await r.json()) as { products?: ProductLite[]; total?: number }
                        if (seq !== seqRef.current) return
                        const list = (d.products ?? []) as ProductLite[]
                        const seen = new Set(current.map((x) => x.id))
                        const merged = [...current, ...list.filter((x) => x.id && !seen.has(x.id))]
                        const newTotal = d.total ?? merged.length
                        setItems(merged)
                        setTotal(newTotal)
                        setHasMore(merged.length < newTotal)
                } catch {
                        // Keep the current page; scrolling again retries.
                } finally {
                        if (seq === seqRef.current) setLoadingMore(false)
                }
        }

        // Infinite scroll: fetch the next page when the list nears its bottom.
        function handleListScroll(e: UIEvent<HTMLDivElement>) {
                const el = e.currentTarget
                if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) void loadMore()
        }

        return { items, total, loading, loadingMore, hasMore, loadMore, handleListScroll }
}

/** Footer chip: "x از y محصول" + load-more affordance for paged pickers. */
function PickerListFooter({ loadingMore, hasMore, shown, total, onMore }: { loadingMore: boolean; hasMore: boolean; shown: number; total: number; onMore: () => void }) {
        if (total <= 0 && !hasMore) return null
        return (
                <div className="flex items-center justify-center gap-2 border-t border-[var(--border-subtle)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
                        {loadingMore ? (
                                <>
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        در حال بارگذاری…
                                </>
                        ) : hasMore ? (
                                <button
                                        type="button"
                                        onClick={onMore}
                                        className="transition-colors hover:text-[var(--text-secondary)]"
                                >
                                        نمایش بیشتر ({shown.toLocaleString('fa-IR')} از {total.toLocaleString('fa-IR')})
                                </button>
                        ) : (
                                <span>
                                        {shown.toLocaleString('fa-IR')} از {total.toLocaleString('fa-IR')} محصول
                                </span>
                        )}
                </div>
        )
}

function ProductPicker({
        selectedId,
        onSelect,
}: {
        selectedId?: string
        onSelect: (p: ProductLite) => void
}) {
        const [open, setOpen] = useState(false)
        const [q, setQ] = useState('')
        const [selected, setSelected] = useState<ProductLite | null>(null)
        const { items, total, loading, loadingMore, hasMore, loadMore, handleListScroll } =
                useProductPickerPages(open, q)

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
                                                <p className="text-[12px] text-[var(--text-secondary)]">
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
                                        <div className="max-h-56 overflow-y-auto" onScroll={handleListScroll}>
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
                                                                                <p className="text-[12px] text-[var(--text-secondary)]">
                                                                                        {p.price != null
                                                                                                ? `${p.price.toLocaleString('fa-IR')} تومان`
                                                                                                : 'بدون قیمت'}
                                                                                </p>
                                                                        </div>
                                                                </button>
                                                        ))}
                                                {!loading && (
                                                        <PickerListFooter
                                                                loadingMore={loadingMore}
                                                                hasMore={hasMore}
                                                                shown={items.length}
                                                                total={total}
                                                                onMore={() => void loadMore()}
                                                        />
                                                )}
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
                return <ProductImage src={img} alt={product.name} width={36} height={36} loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
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

// ── Multi-product picker (carousel builder for PRODUCT_LIST messages) ─────
// Up to 10 products (Meta's Generic Template Carousel limit). Search + add,
// drag-free reorder via up/down arrows, click X to remove. Same API as the
// single ProductPicker above so the data shape (`ProductLite`) is shared.
function MultiProductPicker({
        selectedIds,
        onChange,
}: {
        selectedIds: string[]
        onChange: (ids: string[]) => void
}) {
        const MAX = 10
        const [open, setOpen] = useState(false)
        const [q, setQ] = useState('')
        // Cache of {id -> ProductLite} for the selected rows so the UI shows
        // thumbnails/names without re-fetching on every render.
        const [cache, setCache] = useState<Record<string, ProductLite>>({})
        const { items, total, loading, loadingMore, hasMore, loadMore, handleListScroll } =
                useProductPickerPages(open, q)

        // Resolve any selected ids that aren't in the cache yet (e.g. on form load).
        useEffect(() => {
                const missing = selectedIds.filter((id) => id && !cache[id])
                if (missing.length === 0) return
                let cancelled = false
                Promise.all(
                        missing.map((id) =>
                                fetch(`/api/products/${id}`)
                                        .then((r) => r.json())
                                        .then((d) => (d as { product?: ProductLite }).product ?? null)
                                        .catch(() => null),
                        ),
                ).then((rows) => {
                        if (cancelled) return
                        setCache((prev) => {
                                const next = { ...prev }
                                for (const p of rows) {
                                        if (p) next[p.id] = p
                                }
                                return next
                        })
                })
                return () => {
                        cancelled = true
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [selectedIds.join(',')])

        // Keep the cache warm from whatever page the list has loaded.
        useEffect(() => {
                if (items.length === 0) return
                setCache((prev) => {
                        const next = { ...prev }
                        for (const p of items) next[p.id] = p
                        return next
                })
        }, [items])

        function add(id: string) {
                if (selectedIds.includes(id)) return
                if (selectedIds.length >= MAX) return
                onChange([...selectedIds, id])
        }

        function remove(id: string) {
                onChange(selectedIds.filter((x) => x !== id))
        }

        function move(idx: number, dir: -1 | 1) {
                const next = idx + dir
                if (next < 0 || next >= selectedIds.length) return
                const arr = selectedIds.slice()
                const [item] = arr.splice(idx, 1)
                arr.splice(next, 0, item)
                onChange(arr)
        }

        return (
                <div className="space-y-2">
                        {/* Selected rows (reorderable) */}
                        {selectedIds.length > 0 && (
                                <div className="space-y-1.5">
                                        {selectedIds.map((id, idx) => {
                                                const p = cache[id]
                                                return (
                                                        <div
                                                                key={id}
                                                                className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2"
                                                        >
                                                                {p ? <ProductThumb product={p} /> : (
                                                                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-[var(--bg-muted)]" />
                                                                )}
                                                                <div className="min-w-0 flex-1">
                                                                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                                                                                {p?.name ?? '…'}
                                                                        </p>
                                                                        <p className="text-[12px] text-[var(--text-secondary)]">
                                                                                {p?.price != null
                                                                                        ? `${p.price.toLocaleString('fa-IR')} تومان`
                                                                                        : 'بدون قیمت'}
                                                                        </p>
                                                                </div>
                                                                {/* Reorder arrows (LTR for stable arrow direction) */}
                                                                <div className="flex flex-col" dir="ltr">
                                                                        <button
                                                                                type="button"
                                                                                onClick={() => move(idx, -1)}
                                                                                disabled={idx === 0}
                                                                                className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-30"
                                                                                aria-label="بالا"
                                                                        >
                                                                                <ArrowUp className="h-3 w-3" />
                                                                        </button>
                                                                        <button
                                                                                type="button"
                                                                                onClick={() => move(idx, 1)}
                                                                                disabled={idx === selectedIds.length - 1}
                                                                                className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-30"
                                                                                aria-label="پایین"
                                                                        >
                                                                                <ArrowDown className="h-3 w-3" />
                                                                        </button>
                                                                </div>
                                                                <button
                                                                        type="button"
                                                                        onClick={() => remove(id)}
                                                                        className="text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
                                                                        aria-label="حذف"
                                                                >
                                                                        <X className="h-4 w-4" />
                                                                </button>
                                                        </div>
                                                )
                                        })}
                                </div>
                        )}

                        {/* Add button (disabled when at the carousel limit) */}
                        {selectedIds.length < MAX ? (
                                <button
                                        type="button"
                                        onClick={() => setOpen((v) => !v)}
                                        className="flex w-full items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
                                >
                                        <span className="inline-flex items-center gap-2">
                                                <Plus className="h-3.5 w-3.5" />
                                                افزودن محصول ({selectedIds.length.toLocaleString('fa-IR')} از {MAX.toLocaleString('fa-IR')})
                                        </span>
                                        <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                        ) : (
                                <p className="text-center text-[12px] text-[var(--text-muted)]">
                                        حداکثر {MAX.toLocaleString('fa-IR')} محصول در هر ویترین.
                                </p>
                        )}

                        {open && selectedIds.length < MAX && (
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
                                        <div className="max-h-56 overflow-y-auto" onScroll={handleListScroll}>
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
                                                        items.map((p) => {
                                                                const isSelected = selectedIds.includes(p.id)
                                                                return (
                                                                        <button
                                                                                key={p.id}
                                                                                type="button"
                                                                                disabled={isSelected}
                                                                                onClick={() => add(p.id)}
                                                                                className={`flex w-full items-center gap-2.5 px-3 py-2 text-right transition-colors ${
                                                                                        isSelected
                                                                                                ? 'cursor-not-allowed opacity-40'
                                                                                                : 'hover:bg-[var(--bg-muted)]'
                                                                                }`}
                                                                        >
                                                                                <ProductThumb product={p} />
                                                                                <div className="min-w-0 flex-1">
                                                                                        <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                                                                                                {p.name}
                                                                                        </p>
                                                                                        <p className="text-[12px] text-[var(--text-secondary)]">
                                                                                                {p.price != null
                                                                                                        ? `${p.price.toLocaleString('fa-IR')} تومان`
                                                                                                        : 'بدون قیمت'}
                                                                                        </p>
                                                                                </div>
                                                                                {isSelected && <Check className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                                                                        </button>
                                                                )
                                                        })}
                                                {!loading && (
                                                        <PickerListFooter
                                                                loadingMore={loadingMore}
                                                                hasMore={hasMore}
                                                                shown={items.length}
                                                                total={total}
                                                                onMore={() => void loadMore()}
                                                        />
                                                )}
                                        </div>
                                </div>
                        )}
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
                        <div className="ui-seg w-full grid-flow-col [grid-auto-columns:minmax(0,1fr)]" role="radiogroup">
                                {options.map((o) => (
                                        <button
                                                key={o.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={value === o.value}
                                                data-active={value === o.value}
                                                onClick={() => onChange(o.value)}
                                                className="ui-seg-tab min-h-9 px-3 text-xs"
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
                <div className="input flex h-auto min-h-11 flex-wrap items-center gap-1.5 px-2.5 py-2">
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
