/**
 * Shared types for the Instagram Automation dashboard (v3).
 *
 * These mirror the expanded `InstagramAutomation.action` JSON shape that the
 * BACKEND-AUTO-V2/V3 API expects (zod-validated in
 * `app/api/agents/[agentId]/instagram/automations/route.ts`), plus the
 * channel-level `InstagramAutomationSettings` exposed at
 * `GET/PATCH /api/agents/{agentId}/instagram/settings`.
 *
 * v3 changes (FRONTEND-AUTO-V3):
 *  - `MessageType` now includes `QUICK_REPLY` (with `buttons[]` up to 3).
 *  - `AutomationMessage.buttons` replaces the old `quickReplies` field (same
 *    meaning — quick-reply button titles). `quickReplies` is kept as a
 *    deprecated alias so older code paths still compile.
 *  - `InstagramAutomationSettings` no longer carries `welcomeMessage` or
 *    channel-level `followUp*` (those were removed from the UI in v3 per the
 *    task spec — the backend still stores them but the UI doesn't render or
 *    send them anymore). Per-scenario `followUp*` (on STORY actions) stays.
 */

export type AutomationType = 'DIRECT_MESSAGE' | 'COMMENT' | 'STORY'

export type MatchMode = 'EXACT' | 'CONTAINS' | 'STARTS_WITH'

export type StoryScope = 'ALL' | 'KEYWORD'

// ── Expanded reply modes (BACKEND-AUTO-V2) ───────────────────────────────
//   STATIC        → fixed text/media reply (uses messages[])
//   AI            → route through the agent's LLM engine
//   SILENT        → no reply (mute the trigger)
//   STOP_AI       → stop AI replies for this user/thread
//   MULTI_MESSAGE → pick one message from a list (used for COMMENT replies)
export type ReplyMode = 'STATIC' | 'AI' | 'SILENT' | 'STOP_AI' | 'MULTI_MESSAGE'

export type GateMode = 'SOFT' | 'STORY_MENTION'

// ── Message types (inside action.messages[]) ─────────────────────────────
//   TEXT        → plain text body (uses `text`)
//   IMAGE       → single image with optional caption (uses `mediaUrl` + `text`)
//   AUDIO       → voice clip (uses `mediaUrl`)
//   VIDEO       → video clip (uses `mediaUrl`)
//   QUICK_REPLY → text + up to 3 tappable button titles (uses `text` + `buttons`)
//   PRODUCT     → product card (uses `productId`)
export type MessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'QUICK_REPLY' | 'PRODUCT'

export type MediaType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PRODUCT'

/**
 * A tappable button on a QUICK_REPLY message. `title` is the label shown to
 * the user; `url` (optional) makes it a web_url button that opens a link,
 * omitting `url` makes it a postback button that sends the title back as a
 * message (Instagram quick-reply behavior).
 */
export interface QuickReplyButton {
        /** Button title (max 20 chars on Instagram). */
        title: string
        /** URL the button opens. When omitted, tapping sends `title` back as a message. */
        url?: string
}

/** A single message inside an action's `messages[]` list. */
export interface AutomationMessage {
        /** Client-generated stable id for React keys + reordering. NOT persisted by the backend. */
        id: string
        type: MessageType
        text: string
        mediaUrl?: string
        mediaType?: MediaType
        productId?: string
        /** Up to 3 quick-reply buttons (for QUICK_REPLY messages). Accepts the new
         *  object form ({title, url?}) or a legacy plain-string (treated as a
         *  postback button with that title). */
        buttons?: QuickReplyButton[]
        /** Button display style for QUICK_REPLY messages: 'button' = Button Template
         *  (inside the bubble, visible in Message Requests), 'quick_reply' = Quick
         *  Reply chip (above the input, disappears after click). Default: 'button'. */
        buttonType?: 'button' | 'quick_reply'
        /** @deprecated Use `buttons` — kept as alias for backward compat. */
        quickReplies?: string[]
}

export interface AutomationTrigger {
        keywords: string[]
        matchMode: MatchMode
        storyScope: StoryScope
        postIds: string[]
}

export interface AutomationAction {
        // ── Expanded (BACKEND-AUTO-V2) ────────────────────────────────────────
        replyMode: ReplyMode
        /** Ordered list of messages (used by STATIC, MULTI_MESSAGE). */
        messages?: AutomationMessage[]
        /** Convenience: for STATIC with a single TEXT message, the body. */
        replyText?: string
        /** Legacy/compat field — kept so existing rows still round-trip. */
        mediaType?: MediaType
        mediaUrl?: string
        productId?: string
        // ── Comment funnel ────────────────────────────────────────────────────
        dmOnComment?: boolean
        // ── Follow gate (kept for v1 compatibility) ───────────────────────────
        followGate?: boolean
        gateMode?: GateMode
        /** Which button style to use for the gate prompt: 'button' (Button Template,
         *  inside the bubble, visible in Message Requests) or 'quick_reply' (chip
         *  above the input, disappears after click). Default: 'button'. */
        gateButtonType?: 'button' | 'quick_reply'
        gatePrompt?: string
        gateConfirmKeyword?: string
        gateQuickReply?: string
        contentText?: string
        aiAgentEnabled?: boolean
        // ── Follow-up (delayed second message after the main reply) ───────────
        //   NOTE: channel-level follow-up was removed from the UI in v3, but
        //   per-scenario follow-up (on STORY actions) is still supported.
        followUpEnabled?: boolean
        /** NOTE: the backend column is named `followUpDelayMin` (matches the Prisma
         *  model), NOT `followUpDelayMinutes`. The backend zod schema rejects the
         *  wrong name (strips it silently and uses the default). */
        followUpDelayMin?: number
        followUpMessage?: string
}

export interface Automation {
        id: string
        agentId: string
        channelId: string
        type: AutomationType
        name: string
        active: boolean
        priority: number
        trigger: AutomationTrigger
        action: AutomationAction
        createdAt: string
        updatedAt: string
}

// ── Channel-level settings (v3 — slimmed down per task spec) ───────────────
export type ReplyPolicy =
        | 'ALL_AGENT' // every message goes through the AI agent
        | 'AGENT_EXCEPT_SCENARIOS' // agent handles everything EXCEPT matched scenarios (default)
        | 'AUTOMATION_ONLY' // only automation scenarios reply; agent is silent

/**
 * v3 channel settings — JUST replyPolicy + stopWords + aiEnabled.
 *
 * `welcomeMessage` and `followUp*` were removed from the UI in v3 (the
 * backend still stores them if they were set previously, but the UI no
 * longer renders or sends them). Per-scenario `followUp*` (on STORY
 * actions) is unaffected.
 */
export interface InstagramAutomationSettings {
        replyPolicy: ReplyPolicy
        dmReplyPolicy: ReplyPolicy
        storyReplyPolicy: ReplyPolicy
        commentReplyPolicy: ReplyPolicy
        stopWords: string[]
        /** Master AI toggle (sent by backend, not edited in this UI yet). */
        aiEnabled?: boolean
        storyReactionReplyEnabled: boolean
        storyReactionReplyText: string | null
        commentEmojiReplyEnabled: boolean
        commentEmojiReplyText: string | null
        likeDmAfterReply: boolean
        likeStoryReplyAfterReply: boolean
        likeStoryReactionAfterReply: boolean
        likeCommentAfterReply: boolean
}

export const DEFAULT_SETTINGS: InstagramAutomationSettings = {
        replyPolicy: 'AGENT_EXCEPT_SCENARIOS',
        dmReplyPolicy: 'AGENT_EXCEPT_SCENARIOS',
        storyReplyPolicy: 'AGENT_EXCEPT_SCENARIOS',
        commentReplyPolicy: 'AGENT_EXCEPT_SCENARIOS',
        stopWords: [],
        aiEnabled: true,
        storyReactionReplyEnabled: false,
        storyReactionReplyText: null,
        commentEmojiReplyEnabled: false,
        commentEmojiReplyText: null,
        likeDmAfterReply: false,
        likeStoryReplyAfterReply: false,
        likeStoryReactionAfterReply: false,
        likeCommentAfterReply: false,
}

/** Shape sent to POST /api/agents/{agentId}/instagram/automations */
export interface CreateAutomationPayload {
        type: AutomationType
        name: string
        active: boolean
        priority: number
        trigger: AutomationTrigger
        action: AutomationAction
}

/** Shape sent to PATCH /api/agents/{agentId}/instagram/automations/{id} (partial) */
export interface UpdateAutomationPayload {
        name?: string
        active?: boolean
        priority?: number
        trigger?: AutomationTrigger
        action?: AutomationAction
}

// ── UI label maps ────────────────────────────────────────────────────────
//   Two flavors per map:
//     1) `*_LABEL_KEY` — i18n message keys, RELATIVE to the `instagram`
//        namespace in `messages/{en,fa}.json`. Use with
//        `useTranslations('instagram')`:
//             const t = useTranslations('instagram')
//             t(MATCH_MODE_LABEL_KEY[mode])   // → 'instagram.matchMode.EXACT'
//     2) `*_LABEL` (deprecated) — inline Persian fallbacks. Kept so existing
//        imports in components that have NOT yet been migrated to next-intl
//        (e.g. automation-form.tsx, iphone-preview.tsx, media-uploader.tsx,
//        voice-recorder.tsx) still compile. New code MUST use the
//        `*_LABEL_KEY` form + `t()` so the UI switches locale correctly.

export const MATCH_MODE_LABEL_KEY: Record<MatchMode, string> = {
        EXACT: 'matchMode.EXACT',
        CONTAINS: 'matchMode.CONTAINS',
        STARTS_WITH: 'matchMode.STARTS_WITH',
}

/** @deprecated Use MATCH_MODE_LABEL_KEY + `t()` from useTranslations('instagram'). */
export const MATCH_MODE_LABEL: Record<MatchMode, string> = {
        EXACT: 'دقیق',
        CONTAINS: 'شامل',
        STARTS_WITH: 'شروع با',
}

export const MATCH_MODE_DESC_KEY: Record<MatchMode, string> = {
        EXACT: 'matchModeDesc.EXACT',
        CONTAINS: 'matchModeDesc.CONTAINS',
        STARTS_WITH: 'matchModeDesc.STARTS_WITH',
}

/** @deprecated Use MATCH_MODE_DESC_KEY + `t()`. */
export const MATCH_MODE_DESC: Record<MatchMode, string> = {
        EXACT: 'دقیقاً برابر با کلمه‌کلیدی',
        CONTAINS: 'شامل کلمه‌کلیدی در هر جای متن',
        STARTS_WITH: 'شروع با کلمه‌کلیدی',
}

export const STORY_SCOPE_LABEL_KEY: Record<StoryScope, string> = {
        ALL: 'storyScope.ALL',
        KEYWORD: 'storyScope.KEYWORD',
}

/** @deprecated Use STORY_SCOPE_LABEL_KEY + `t()`. */
export const STORY_SCOPE_LABEL: Record<StoryScope, string> = {
        ALL: 'همه استوری‌ها',
        KEYWORD: 'بر اساس کلمه‌کلیدی',
}

export const REPLY_MODE_LABEL_KEY: Record<ReplyMode, string> = {
        STATIC: 'replyMode.STATIC',
        AI: 'replyMode.AI',
        SILENT: 'replyMode.SILENT',
        STOP_AI: 'replyMode.STOP_AI',
        MULTI_MESSAGE: 'replyMode.MULTI_MESSAGE',
}

/** @deprecated Use REPLY_MODE_LABEL_KEY + `t()`. */
export const REPLY_MODE_LABEL: Record<ReplyMode, string> = {
        STATIC: 'متن ثابت',
        AI: 'پاسخ هوشمند',
        SILENT: 'بدون پاسخ',
        STOP_AI: 'توقف هوش مصنوعی',
        MULTI_MESSAGE: 'چند پیام',
}

export const REPLY_MODE_SHORT_LABEL_KEY: Record<ReplyMode, string> = {
        STATIC: 'replyModeShort.STATIC',
        AI: 'replyModeShort.AI',
        SILENT: 'replyModeShort.SILENT',
        STOP_AI: 'replyModeShort.STOP_AI',
        MULTI_MESSAGE: 'replyModeShort.MULTI_MESSAGE',
}

/** @deprecated Use REPLY_MODE_SHORT_LABEL_KEY + `t()`. */
export const REPLY_MODE_SHORT_LABEL: Record<ReplyMode, string> = {
        STATIC: 'ثابت',
        AI: 'هوشمند',
        SILENT: 'بی‌صدا',
        STOP_AI: 'توقف AI',
        MULTI_MESSAGE: 'چندگزینه‌ای',
}

export const GATE_MODE_LABEL_KEY: Record<GateMode, string> = {
        SOFT: 'gateMode.SOFT',
        STORY_MENTION: 'gateMode.STORY_MENTION',
}

/** @deprecated Use GATE_MODE_LABEL_KEY + `t()`. */
export const GATE_MODE_LABEL: Record<GateMode, string> = {
        SOFT: 'نرم (اعتماد)',
        STORY_MENTION: 'سخت (منشن استوری)',
}

export const TYPE_LABEL_KEY: Record<AutomationType, string> = {
        DIRECT_MESSAGE: 'types.DIRECT_MESSAGE',
        COMMENT: 'types.COMMENT',
        STORY: 'types.STORY',
}

/** @deprecated Use TYPE_LABEL_KEY + `t()`. */
export const TYPE_LABEL: Record<AutomationType, string> = {
        DIRECT_MESSAGE: 'دایرکت',
        COMMENT: 'کامنت',
        STORY: 'استوری',
}

export const REPLY_POLICY_LABEL_KEY: Record<ReplyPolicy, string> = {
        ALL_AGENT: 'replyPolicy.ALL_AGENT',
        AGENT_EXCEPT_SCENARIOS: 'replyPolicy.AGENT_EXCEPT_SCENARIOS',
        AUTOMATION_ONLY: 'replyPolicy.AUTOMATION_ONLY',
}

/** @deprecated Use REPLY_POLICY_LABEL_KEY + `t()`. */
export const REPLY_POLICY_LABEL: Record<ReplyPolicy, string> = {
        ALL_AGENT: 'همه پیام‌ها توسط ایجنت',
        AGENT_EXCEPT_SCENARIOS: 'ایجنت به جز سناریوها',
        AUTOMATION_ONLY: 'فقط اتوماسیون',
}

export const REPLY_POLICY_DESC_KEY: Record<ReplyPolicy, string> = {
        ALL_AGENT: 'replyPolicyDesc.ALL_AGENT',
        AGENT_EXCEPT_SCENARIOS: 'replyPolicyDesc.AGENT_EXCEPT_SCENARIOS',
        AUTOMATION_ONLY: 'replyPolicyDesc.AUTOMATION_ONLY',
}

export const MESSAGE_TYPE_LABEL_KEY: Record<MessageType, string> = {
        TEXT: 'messageType.TEXT',
        IMAGE: 'messageType.IMAGE',
        AUDIO: 'messageType.AUDIO',
        VIDEO: 'messageType.VIDEO',
        QUICK_REPLY: 'messageType.QUICK_REPLY',
        PRODUCT: 'messageType.PRODUCT',
}

/** @deprecated Use MESSAGE_TYPE_LABEL_KEY + `t()`. */
export const MESSAGE_TYPE_LABEL: Record<MessageType, string> = {
        TEXT: 'متن',
        IMAGE: 'عکس',
        AUDIO: 'وویس',
        VIDEO: 'ویدیو',
        QUICK_REPLY: 'کلید',
        PRODUCT: 'محصول',
}

/** Generate a short stable id for a new AutomationMessage (client-only). */
export function newMessageId(): string {
        // crypto.randomUUID exists in all modern browsers; fall back to a counter
        // for SSR + tests where the API isn't available.
        if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
                return crypto.randomUUID()
        }
        return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
